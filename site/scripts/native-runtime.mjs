// Trusted local bootstrap only: no listeners, SDKs, prompts or private databases.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { nativePolicy, nativeSystemReads, spawnSandbox, ISOLATION_ERROR } from './native-sandbox.mjs';
import { acceptNativeProof, ancestorMetadata, assertMetadataUnavailable, imageDeployment, sourceControlRoots } from '../server/deployment.mjs';
import { serverErrorEvent } from '../server/logging.mjs';

const SITE = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const fail = () => { throw Object.assign(new Error(ISOLATION_ERROR), { code: 'ERR_KIBITZ_ISOLATION' }); };
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const existing = file => { try { return fs.realpathSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

/** Loader/child stderr is not trusted structured application output. */
export function nativeDiagnostic(line) {
  try {
    const event = JSON.parse(line);
    return event.event === 'server_error' ? serverErrorEvent({ code: event.code, message: event.hint }) : null;
  } catch { return null; }
}

function databaseParent(file, publicRoots, metadata) {
  const requested = path.resolve(file), missing = [];
  let at = path.dirname(requested);
  while (!fs.existsSync(at)) { missing.unshift(path.basename(at)); at = path.dirname(at); }
  const directory = path.join(fs.realpathSync(at), ...missing);
  if (publicRoots.some(root => inside(root, directory))
    || inside(directory, SITE) || metadata.some(root => inside(directory, root) || inside(root, directory))) fail();
  // Only directories are prepared here; the isolated server validates/opens files.
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.statSync(directory);
  if (!stat.isDirectory() || (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid())) fail();
  return directory;
}

/** @returns {Promise<boolean>} true means the launcher has handled the invocation. */
export async function isolateFinalRuntime(opt, publicRoots) {
  if (process.env.KIBITZ_NATIVE_CHILD !== undefined) {
    if (process.env.KIBITZ_NATIVE_CHILD !== '1') fail();
    acceptNativeProof(); delete process.env.KIBITZ_NATIVE_CHILD;
    assertMetadataUnavailable([...ancestorMetadata(SITE), ...publicRoots.flatMap(ancestorMetadata)]);
    process.once('disconnect', () => process.exit(1));
    return false;
  }
  if (imageDeployment(SITE)) return false;

  const read = [SITE, ...publicRoots, ...nativeSystemReads()], immutable = [SITE, ...publicRoots];
  for (const file of [opt.env, opt.operator, opt.permissions, opt['tls-key'], opt['tls-cert'], process.env.NODE_EXTRA_CA_CERTS]) {
    if (!file) continue;
    const resolved = existing(file); if (resolved) { read.push(resolved); immutable.push(resolved); }
  }
  // Bind the policy directory, rather than its current inode: offline atomic
  // replacement/unlink must become visible to live revocation checks on Linux.
  if (opt.permissions) { const directory = fs.realpathSync(path.dirname(opt.permissions)); read.push(directory); immutable.push(directory); }
  const paths = [...read, ...[opt.sessions, opt.usage, opt.library].filter(file => file && file !== ':memory:').map(file => {
    let at = path.dirname(path.resolve(file)); while (!fs.existsSync(at)) at = path.dirname(at); return at;
  })];
  const metadata = [...new Set(paths.flatMap(file => sourceControlRoots(fs.statSync(file).isDirectory() ? file : path.dirname(file))))];
  const write = [...new Set([opt.sessions, opt.usage, opt.library].filter(file => file && file !== ':memory:').map(file => databaseParent(file, publicRoots, metadata)))];
  const policy = nativePolicy({ read, write, immutable, metadata });
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-isolation-proof-')));
  const file = path.join(directory, 'proof.json');
  let fd, child, reported = false, buffer = '';
  const forward = signal => { if (child) child.kill(signal); };
  const onTerm = () => forward('SIGTERM'), onInt = () => forward('SIGINT');
  try {
    fs.writeFileSync(file, JSON.stringify({ version: 1, nonce: randomBytes(32).toString('hex'), file, metadata }), { flag: 'wx', mode: 0o600 });
    fd = fs.openSync(file, 'r');
    child = spawnSandbox(policy, [...process.execArgv, process.argv[1], ...process.argv.slice(2)], {
      cwd: process.cwd(), env: { ...process.env, KIBITZ_NATIVE_CHILD: '1' }, stdio: ['ignore', 'inherit', 'pipe', fd, 'ipc'],
    });
    fs.closeSync(fd); fd = undefined;
    process.on('SIGTERM', onTerm); process.on('SIGINT', onInt);
    // OS loader diagnostics can contain private paths. Preserve only application
    // startup events, which already use fixed-vocabulary structured logging.
    child.stderr.on('data', bytes => {
      buffer = (buffer + bytes.toString()).slice(-32 * 1024);
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        const safe = nativeDiagnostic(line);
        if (safe) { console.error(safe); reported = true; }
      }
    });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGTERM' || signal === 'SIGINT' ? 0 : 1)));
    });
    process.exitCode = Number(status);
    if (status && !reported) console.error(serverErrorEvent(Object.assign(new Error(ISOLATION_ERROR), { code: 'ERR_KIBITZ_ISOLATION' })));
    return true;
  } catch { fail(); }
  finally {
    process.off('SIGTERM', onTerm); process.off('SIGINT', onInt);
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
