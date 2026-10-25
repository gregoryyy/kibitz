// OS-enforced filesystem policy for the native runtime. No Node permission-model claim.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const ISOLATION_ERROR = 'Native isolation is unavailable. Use the documented isolated runtime or explicit development mode.';
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const canonical = file => fs.realpathSync(file);
const fail = () => { throw Object.assign(new Error(ISOLATION_ERROR), { code: 'ERR_KIBITZ_ISOLATION' }); };
const unique = values => [...new Set(values)].sort();
const compact = roots => roots.filter(root => !roots.some(other => other !== root && inside(other, root)));

/**
 * Paths come from the trusted offline launcher, never HTTP/request/model data.
 * Resolve aliases before excluding source-control roots. No broad HOME or / grants.
 */
export function nativePolicy({ read = [], write = [], immutable = [], metadata = [], executable = process.execPath, platform = process.platform } = {}) {
  try {
    const program = canonical(executable), reads = unique([...read.map(canonical), program]), writes = unique(write.map(canonical));
    const denied = unique(metadata.map(file => path.resolve(file))), protectedPaths = compact(unique(immutable.map(canonical)));
    if ([...reads, ...writes, ...protectedPaths].some(root => root === path.parse(root).root || denied.some(file => inside(root, file) || inside(file, root)))) fail();
    if (writes.some(root => protectedPaths.some(file => inside(file, root)))) fail();
    if (platform !== 'darwin' && platform !== 'linux') fail();
    return { platform, executable: program, read: unique([...reads, ...writes, ...protectedPaths]), write: writes, immutable: protectedPaths, metadata: denied };
  } catch { fail(); }
}

const literal = value => JSON.stringify(value); // SBPL quoted strings; never shell interpolation.
const filters = roots => roots.length ? roots.map(root => `(subpath ${literal(root)})`).join(' ') : '(literal "/__kibitz_no_access__")';
const parentPaths = roots => unique(roots.flatMap(root => {
  const paths = []; for (let at = path.dirname(root); ; at = path.dirname(at)) { paths.push(at); if (at === path.dirname(at)) break; }
  return paths;
}));

/** Keep non-filesystem OS operations available; deny file access outside explicit roots. */
export function macProfile(policy) {
  if (policy.platform !== 'darwin') fail();
  const parents = parentPaths(policy.read).map(parent => `(literal ${literal(parent)})`).join(' ');
  return `(version 1)\n(allow default)\n` +
    // dyld reads the root directory while loading an executable. A literal grant
    // permits that directory listing, without granting any descendant contents.
    `(deny file-read-data file-map-executable (require-not (require-any (literal "/") ${filters(policy.read)})))\n` +
    `(deny file-read-metadata (require-not (require-any ${filters(policy.read)} ${parents})))\n` +
    `(deny file-write* (require-not (require-any ${filters(policy.write)})))\n` +
    (policy.immutable.length ? `(deny file-write* (require-any ${filters(policy.immutable)}))\n` : '') +
    policy.metadata.map(file => `(deny file-read* file-write* file-map-executable (subpath ${literal(file)}))\n`).join('');
}

/**
 * Platform system resources required by Node/SQLite/OpenSSL/resolution. No user-home grant.
 * Shared libraries are observed from this same Node executable, not a shell/ldd execution.
 */
export function nativeSystemReads(platform = process.platform) {
  const candidates = platform === 'darwin'
    ? ['/System/Library', '/usr/lib', '/usr/share/zoneinfo', '/private/etc/hosts', '/private/etc/resolv.conf', '/private/etc/localtime', '/private/var/db/timezone', '/private/var/run', '/dev/null', '/dev/urandom', '/dev/random']
    : ['/usr/lib', '/lib', '/lib64', '/usr/lib64', '/usr/share/zoneinfo', '/etc/hosts', '/etc/resolv.conf', '/etc/nsswitch.conf', '/etc/gai.conf', '/etc/localtime', '/etc/ssl/certs', '/sys/devices/system/cpu'];
  const report = /** @type {{sharedObjects?: string[]}} */ (process.report.getReport());
  return unique([...candidates, ...(report.sharedObjects || [])].filter(file => {
    try { const stat = fs.statSync(file); return stat.isFile() || stat.isDirectory() || stat.isCharacterDevice(); } catch { return false; }
  }).map(canonical));
}

export function sandboxCommand(policy, args, { bubblewrap = '/usr/bin/bwrap', cwd = process.cwd() } = {}) {
  if (policy.platform === 'darwin') return { command: '/usr/bin/sandbox-exec', args: ['-p', macProfile(policy), policy.executable, ...args] };
  if (policy.platform !== 'linux' || !fs.existsSync(bubblewrap)) fail();
  const options = ['--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent', '--new-session', '--cap-drop', 'ALL'];
  // Start from bubblewrap's empty root. Parent mount points contain no host files.
  options.push('--dir', cwd);
  for (const root of compact(policy.read.filter(root => !policy.write.includes(root) && !policy.immutable.some(file => inside(file, root))))) options.push('--ro-bind', root, root);
  for (const root of policy.write) options.push('--bind', root, root);
  for (const root of policy.immutable) options.push('--ro-bind', root, root);
  // Preserve known loader/resolver/trust aliases into mounted canonical roots.
  // Without these, a merged-/usr ELF loader or symlinked resolv.conf is absent.
  for (const alias of ['/lib', '/lib64', '/etc/hosts', '/etc/resolv.conf', '/etc/localtime', '/etc/ssl/certs', '/usr/share/zoneinfo']) {
    try {
      if (fs.lstatSync(alias).isSymbolicLink() && policy.read.some(root => inside(root, canonical(alias)))) {
        options.push('--symlink', canonical(alias), alias);
      }
    } catch {}
  }
  options.push('--proc', '/proc', '--dev', '/dev', '--chdir', cwd, '--', policy.executable, ...args);
  return { command: bubblewrap, args: options };
}

/**
 * Fixed failure category; no profile/paths/keys or raw OS diagnostics enter application logs.
 * @param {ReturnType<typeof nativePolicy>} policy
 * @param {string[]} args
 * @param {{cwd?: string, env?: NodeJS.ProcessEnv, stdio?: import('node:child_process').StdioOptions, bubblewrap?: string}} options
 */
export function spawnSandbox(policy, args, { cwd, env = process.env, stdio = ['ignore', 'pipe', 'pipe'], bubblewrap } = {}) {
  const invocation = sandboxCommand(policy, args, { bubblewrap, cwd });
  return spawn(invocation.command, invocation.args, { cwd, env, stdio, windowsHide: true });
}
