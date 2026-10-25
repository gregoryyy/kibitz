// Dedicated mock-only staging. No target option, operator .env, live provider or model load.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, chmodSync, readFileSync, writeFileSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(site, '..');
export const ZAP_IMAGE = 'ghcr.io/zaproxy/zaproxy:2.17.0@sha256:5ccfff9a411743ab2615136a2edd7416bec9ce41572fa94e935df38c14adb2b6';
export const REQUIRED_PATHS = ['/', '/data.html', '/icon.svg', '/api/ai/status', '/api/ai/embeddings', '/api/library/status', '/api/library/records'];

export function stagingTarget(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) throw new Error('Dedicated loopback staging target required');
  return url.origin;
}

/** Check application policy invariants on a real HTML response, not a general CSP evaluator. */
export function checkHeaders(headers, { inline = true } = {}) {
  const errors = [];
  for (const [name, expected] of Object.entries({
    'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
    'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp',
    'cross-origin-resource-policy': 'same-origin',
  })) if (headers.get(name) !== expected) errors.push(`Unexpected ${name}`);
  const directives = new Map();
  const csp = headers.get('content-security-policy') || '';
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (!name) continue;
    if (directives.has(name)) errors.push(`Duplicate CSP directive ${name}`);
    directives.set(name, values);
  }
  for (const [name, expected] of Object.entries({
    'default-src': ["'self'"], 'connect-src': ["'self'"], 'object-src': ["'none'"],
    'base-uri': ["'none'"], 'form-action': ["'none'"], 'frame-ancestors': ["'none'"], 'worker-src': ["'self'", 'blob:'],
  })) if (JSON.stringify(directives.get(name)) !== JSON.stringify(expected)) errors.push(`Unexpected CSP ${name}`);
  const scripts = directives.get('script-src') || [];
  for (const required of ["'self'", "'wasm-unsafe-eval'", 'blob:']) if (!scripts.includes(required)) errors.push(`Missing CSP script permission ${required}`);
  if (inline && !scripts.some(value => /^'sha256-[A-Za-z0-9+/]{43}='$/.test(value))) errors.push('Missing inline script hashes');
  if (scripts.some(value => !["'self'", "'wasm-unsafe-eval'", 'blob:'].includes(value)
      && !/^'sha256-[A-Za-z0-9+/]{43}='$/.test(value))) errors.push('Unexpected CSP script source');
  if (!csp) errors.push('Missing CSP');
  return errors;
}

/** @param {any} report @param {any} coverage */
export function checkZap(report, coverage, target) {
  const base = stagingTarget(target), errors = [], alerts = [];
  if (report?.['@version'] !== '2.17.0') errors.push('Unexpected ZAP version');
  if (!Array.isArray(report?.site) || report.site.length !== 1) errors.push('Expected one scanned site');
  for (const entry of Array.isArray(report?.site) ? report.site : []) {
    let matches = false;
    try { matches = new URL(entry['@name']).origin === base; } catch { /* Reject malformed site. */ }
    if (!matches) errors.push('Report target does not match staging');
    if (!Array.isArray(entry.alerts)) { errors.push('Missing alert list'); continue; }
    for (const alert of entry.alerts) {
      if (!alert || !/^[0-9]+$/.test(String(alert.pluginid)) || !/^[0-3]$/.test(String(alert.riskcode))
          || !Array.isArray(alert.instances) || !alert.instances.length) {
        errors.push('Malformed ZAP alert'); continue;
      }
      alerts.push({ id: String(alert.pluginid), risk: Number(alert.riskcode), instances: alert.instances.length });
      if (Number(alert.riskcode) >= 3) errors.push(`High ZAP alert ${alert.pluginid}`);
    }
  }
  if (!Array.isArray(coverage?.paths)) errors.push('Missing scan coverage');
  else for (const path of REQUIRED_PATHS) if (!coverage.paths.includes(path)) errors.push(`Unscanned required path ${path}`);
  if (coverage?.passivePending !== 0) errors.push('Passive scan did not finish');
  if (!Array.isArray(coverage?.enabledRules) || !coverage.enabledRules.length
      || coverage.enabledRules.some(id => typeof id !== 'string' || !/^\d+$/.test(id))) errors.push('Missing enabled passive rules');
  return { errors, alerts };
}

/** No shell interpolation; deadlines include the child process and cleanup escalation. */
export function command(file, args, { timeout = 600_000, env = process.env, cwd = site } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(file, args, { cwd, env, stdio: 'inherit' });
    let expired = false, killTimer;
    const timer = setTimeout(() => {
      expired = true; child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    }, timeout);
    child.once('error', error => { clearTimeout(timer); clearTimeout(killTimer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer); clearTimeout(killTimer);
      if (expired) reject(new Error('Security tool deadline exceeded'));
      else resolveResult(code);
    });
  });
}

async function startStaging() {
  const child = spawn(process.execPath, [resolve(site, 'scripts/serve.mjs'), resolve(site, 'dist'),
    '--api', '--env=', '--library', ':memory:', '--index', '_test.html', '--port', '0'], {
    cwd: site, stdio: ['ignore', 'pipe', 'pipe'],
    // Do not inherit provider keys, NODE_OPTIONS, endpoint overrides or operator model settings.
    env: { PATH: process.env.PATH, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock',
      EMBEDDING_REVISION: 'security-staging-v1', AI_LOCAL_ONLY: '1',
      AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000' },
  });
  const exited = new Promise(resolveExit => child.once('close', resolveExit));
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM'); const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited; clearTimeout(timer);
  };
  try {
    const base = await new Promise((resolveBase, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Staging startup timeout')), 15_000);
      const fail = () => { clearTimeout(timer); reject(new Error('Staging startup failed')); };
      child.once('error', fail); child.once('close', fail);
      child.stderr.on('data', () => {});
      child.stdout.on('data', chunk => {
        output = (output + chunk).slice(-8192);
        const match = output.match(/at (http:\/\/127\.0\.0\.1:\d+)\//);
        if (match) { clearTimeout(timer); resolveBase(stagingTarget(match[1])); }
      });
    });
    return { base, stop };
  } catch (error) { await stop(); throw error; }
}

export async function run(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(arg => arg !== '--headers-only')) throw new Error('Usage: node scripts/security-scan.mjs [--headers-only]');
  const output = resolve(site, 'tests/out/security'); mkdirSync(output, { recursive: true }); chmodSync(output, 0o770);
  // Stale reports must never stand in for a failed scanner execution.
  for (const name of ['zap.json', 'zap.html', 'zap.out', 'zap-home', 'scan-coverage.json', 'scan-summary.json', 'headers.json']) rmSync(resolve(output, name), { force: true, recursive: true });
  const headers = [];
  const container = `kibitz-zap-${process.pid}-${randomUUID().slice(0, 8)}`;
  const summary = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    date: new Date().toISOString(), node: process.version, image: ZAP_IMAGE,
    lockSha256: createHash('sha256').update(readFileSync(resolve(site, 'package-lock.json'))).digest('hex'),
    mode: args.includes('--headers-only') ? 'headers-only' : 'zap-baseline', alerts: [], complete: false };
  const staging = await startStaging();
  let containerStarted = false;
  try {
    for (const path of REQUIRED_PATHS) {
      const response = await fetch(staging.base + path, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (response.status !== 200) throw new Error(`Staging route unavailable: ${path}`);
      const type = response.headers.get('content-type') || '';
      if (path === '/' || path === '/data.html') {
        const errors = checkHeaders(response.headers, { inline: path === '/' });
        if (errors.length) throw new Error(`${path}: ${errors.join(', ')}`);
      }
      if (path === '/icon.svg' && type !== 'image/svg+xml; charset=utf-8') throw new Error('SVG encoding check failed');
      headers.push({ path, status: response.status, headers: Object.fromEntries(response.headers) });
      await response.body?.cancel();
    }
    writeFileSync(resolve(output, 'headers.json'), JSON.stringify(headers, null, 2) + '\n');
    if (!args.includes('--headers-only')) {
      copyFileSync(resolve(root, '.github/zap/hooks.py'), resolve(output, 'hooks.py'));
      containerStarted = true;
      const code = await command('docker', ['run', '--rm', '--name', container, '--network', 'host',
        // The pinned image's zap UID owns its browser-helper cache. Shared primary
        // group and umask keep only the synthetic report tree writable by CI too.
        '--user', `1000:${process.getgid()}`, '--workdir', '/zap/wrk', '-v', `${output}:/zap/wrk:rw`, ZAP_IMAGE,
        'bash', '-c', 'umask 0002; exec "$@"', 'kibitz-zap',
        'zap-baseline.py', '-t', staging.base + '/', '-m', '1', '-T', '5', '--autooff',
        '--hook', '/zap/wrk/hooks.py', '-z', '-silent -dir /zap/wrk/zap-home -host 127.0.0.1 -config api.addrs.addr.name=127.0.0.1 -config api.addrs.addr.regex=false',
        '-J', 'zap.json', '-r', 'zap.html']);
      containerStarted = false; // docker run --rm has exited and removed this container.
      if (code !== 0 && code !== 2) throw new Error(`ZAP baseline failed with exit ${code}`);
      const result = checkZap(JSON.parse(readFileSync(resolve(output, 'zap.json'), 'utf8')),
        JSON.parse(readFileSync(resolve(output, 'scan-coverage.json'), 'utf8')), staging.base);
      summary.alerts = result.alerts;
      if (result.errors.length) throw new Error(result.errors.join('; '));
    }
    summary.complete = true;
    console.log(`Security ${summary.mode}: ${REQUIRED_PATHS.length} staged routes; `
      + (summary.mode === 'headers-only' ? 'ZAP was not run.' : `${summary.alerts.length} ZAP alert types.`)
      + ' Inspect retained reports; this is not release approval.');
  } finally {
    try { writeFileSync(resolve(output, 'scan-summary.json'), JSON.stringify(summary, null, 2) + '\n'); }
    finally {
      if (containerStarted) {
        try { await command('docker', ['rm', '-f', container], { timeout: 15_000 }); } catch { /* Already removed or daemon unavailable. */ }
      }
      await staging.stop();
    }
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  run().catch(() => { console.error('Security scan failed; inspect the workflow and retained reports.'); process.exitCode = 1; });
}
