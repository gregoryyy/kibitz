import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import tls from 'node:tls';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli } from '../tests/helpers/https-cli.mjs';
import { HSTS } from './transport.mjs';

const get = (base, ca, route = '/', { headers = {}, method = 'GET', body = undefined } = {}) => new Promise((resolve, reject) => {
  const request = https.request(base + route, { ca, agent: false, timeout: 5000, method, servername: new URL(base).hostname === '127.0.0.1' ? '' : new URL(base).hostname,
    lookup: (_name, _options, done) => done(null, [{ address: '127.0.0.1', family: 4 }]), headers }, response => {
    let text = ''; response.setEncoding('utf8'); response.on('data', part => text += part);
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: text }));
  });
  request.once('error', reject); request.once('timeout', () => request.destroy(Error('HSTS fixture request timed out'))); request.end(body);
});
function publicRoot(identity) {
  const root = path.join(identity.dir, 'public'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, '_test.html'), '<!doctype html><title>Isolated HTTPS</title>');
  fs.writeFileSync(path.join(root, 'manifest.webmanifest'), '{}'); return root;
}

test('the final CLI enforces its isolated hostname and sends one-year HSTS through all supported success/error routes', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const root = publicRoot(identity), models = path.join(identity.dir, 'models'), model = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
  fs.mkdirSync(models); fs.writeFileSync(path.join(models, model), 'SYNTHETIC_MODEL_BYTES');
  const server = await httpsCli({ root, key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true, extra: ['--models', models] }); t.after(server.close);
  assert.equal(new URL(server.base).hostname, 'kibitz.test');
  const cookie = await server.login();
  const cases = [
    ['/', {}, 200], ['/', { method: 'HEAD' }, 200], ['/manifest.webmanifest', {}, 200],
    ['/models/' + model, {}, 200], ['/models/' + model, { method: 'HEAD' }, 200],
    ['/api/ai/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'hi' }) }, 200],
    ['/api/ai/status', {}, 200], ['/api/library/status', {}, 200], ['/api/library/records', {}, 200],
    ['/api/library/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, 400],
    ['/api/ai/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }, 400],
    ['/api/ai/status', { headers: { origin: 'https://localhost:8765' } }, 403],
    ['/api/ai/missing', {}, 404], ['/missing', {}, 404], ['/models/missing.gguf', {}, 404],
    ['/%zz', {}, 400], ['/', { method: 'POST' }, 405],
    ['/api/ai/test', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }, 415],
  ];
  for (const [route, options, status] of cases) {
    const response = await get(server.base, identity.ca, route, { ...options, headers: { cookie, ...options.headers } });
    assert.equal(response.status, status, `${options.method || 'GET'} ${route}`); assert.equal(response.headers['strict-transport-security'], HSTS, route);
  }
  assert.equal((await get(server.base, identity.ca, '/models/' + model)).body, 'SYNTHETIC_MODEL_BYTES');
  const port = new URL(server.base).port;
  for (const host of [`localhost:${port}`, `127.0.0.1:${port}`, `another.test:${port}`]) {
    const response = await get(server.base, identity.ca, '/api/ai/status', { headers: { host, 'x-forwarded-host': `kibitz.test:${port}`, 'x-forwarded-proto': 'https' } });
    assert.equal(response.status, 403); assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(response.headers['strict-transport-security'], undefined);
  }
  const mapped = await get(server.base, identity.ca, '/api/ai/status', { headers: { cookie, host: 'kibitz.test:32769', origin: 'https://kibitz.test:32769' } });
  assert.equal(mapped.status, 200); assert.equal(mapped.headers['strict-transport-security'], HSTS);
  const foreignPort = await get(server.base, identity.ca, '/api/ai/status', { headers: { host: 'kibitz.test:32769', origin: 'https://kibitz.test:32768' } });
  assert.equal(foreignPort.status, 403); assert.equal(foreignPort.headers['strict-transport-security'], HSTS);
  const probe = await get(server.base, identity.ca, '/manifest.webmanifest', { headers: { host: `127.0.0.1:${port}` } });
  assert.equal(probe.status, 200); assert.equal(probe.headers['set-cookie'], undefined); assert.equal(probe.headers['strict-transport-security'], undefined);
  assert(!server.output().includes(identity.dir));
});

test('parser-level failures close the TLS socket without emitting a response outside the hostname policy', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const server = await httpsCli({ root: publicRoot(identity), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true }); t.after(server.close);
  const bytes = await new Promise((resolve, reject) => {
    let bytes = 0;
    const socket = tls.connect({ host: '127.0.0.1', port: Number(new URL(server.base).port), servername: 'kibitz.test', ca: identity.ca }, () => {
      socket.write('GET / HTTP/1.1\r\nHost: kibitz.test\r\nBad Header: value\r\n\r\n');
    });
    socket.setTimeout(5000, () => socket.destroy(Error('Parser fixture timed out')));
    socket.on('data', chunk => { bytes += chunk.length; }); socket.once('error', reject); socket.once('close', () => resolve(bytes));
  });
  assert.equal(bytes, 0);
});

test('invalid application hosts, mode combinations and missing SANs fail before creating private storage', () => {
  const identity = tlsMaterial({ hostname: 'other.test' });
  try {
    const root = publicRoot(identity), script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
    const tlsFlags = ['--tls-key', identity.key, '--tls-cert', identity.cert];
    for (const [flags, code] of [[tlsFlags, 'ERR_KIBITZ_TLS_CONFIG'],
      [[...tlsFlags, '--app-host', 'localhost'], 'ERR_KIBITZ_APP_HOST'], [[...tlsFlags, '--app-host', '127.0.0.1'], 'ERR_KIBITZ_APP_HOST'],
      [[...tlsFlags, '--app-host', 'kibitz.test', '--legacy-origin'], 'ERR_KIBITZ_APP_HOST'],
      [['--app-host', 'kibitz.test', '--http-dev'], 'ERR_KIBITZ_APP_HOST'], [['--legacy-origin', '--http-dev'], 'ERR_KIBITZ_APP_HOST']]) {
      const dir = path.join(identity.dir, 'must-not-create');
      const result = spawnSync(process.execPath, [script, root, '--api', '--env=', '--usage', path.join(dir, 'usage.sqlite'), ...flags], { encoding: 'utf8', timeout: 10_000 });
      assert.equal(result.status, 1); assert.equal(JSON.parse(result.stderr.trim()).code, code); assert(!fs.existsSync(dir));
      assert(!result.stdout.includes('Serving')); assert(!result.stderr.includes(identity.dir));
    }
  } finally { identity.close(); }
});

test('explicit legacy-origin recovery retains protected cookie ownership and has no localhost-wide HSTS', async t => {
  const identity = tlsMaterial(); t.after(identity.close);
  const server = await httpsCli({ root: publicRoot(identity), key: identity.key, cert: identity.cert, operatorSecret: identity.secret }); t.after(server.close);
  assert.equal(new URL(server.base).hostname, '127.0.0.1');
  const cookie = await server.login('kibitz_uid=' + 'a'.repeat(22));
  const response = await get(server.base, identity.ca, '/api/ai/status', { headers: { cookie } });
  assert.equal(response.status, 200); assert.equal(response.headers['strict-transport-security'], undefined);
  assert.equal(response.headers['set-cookie'], undefined);
});


test('a custom .test identity enforces its own SAN/hostname and preserves HSTS on an actual filesystem error', async t => {
  const hostname = 'study.kibitz.test', identity = tlsMaterial({ hostname }); t.after(identity.close);
  const root = publicRoot(identity), faulty = path.join(root, 'fault.html'), hook = path.join(identity.dir, 'fault.mjs');
  fs.writeFileSync(faulty, 'synthetic');
  fs.writeFileSync(hook, `import fs from 'node:fs';
const open = fs.promises.open.bind(fs.promises);
fs.promises.open = async (...args) => {
  const handle = await open(...args);
  if (String(args[0]) === ${JSON.stringify(faulty)}) handle.readFile = async () => { throw Object.assign(new Error('PRIVATE_FAULT_MARKER'), {code: 'EIO'}); };
  return handle;
};`);
  const server = await httpsCli({ root, key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true, extra: ['--app-host', hostname], nodeArgs: ['--import', hook] }); t.after(server.close);
  assert.equal(new URL(server.base).hostname, hostname);
  const failure = await get(server.base, identity.ca, '/fault.html');
  assert.equal(failure.status, 500); assert.equal(failure.headers['strict-transport-security'], HSTS); assert.equal(failure.body, 'File unavailable\n');
  const healthy = await get(server.base, identity.ca, '/'); assert.equal(healthy.status, 200); assert.equal(healthy.headers['strict-transport-security'], HSTS);
  assert(!server.output().includes('PRIVATE_FAULT_MARKER'));
});

test('an independently trusted HSTS client caches the policy and upgrades HTTP on the same port without a redirect or trust bypass', async t => {
  const run = promisify(execFile), identity = tlsMaterial(), wrong = tlsMaterial(); t.after(identity.close); t.after(wrong.close);
  const server = await httpsCli({ root: publicRoot(identity), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true }); t.after(server.close);
  const version = (await run('curl', ['--version'])).stdout; assert.match(version, /Features:.*\bHSTS\b/);
  const port = new URL(server.base).port, cache = path.join(identity.dir, 'hsts-cache');
  const args = ['--noproxy', '*', '--resolve', `kibitz.test:${port}:127.0.0.1`, '--hsts', cache, '--max-time', '5', '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{url_effective} %{http_code}'];
  await assert.rejects(run('curl', [...args, '--cacert', wrong.cert, server.base + '/']), error => error.code === 60);
  assert(!fs.existsSync(cache) || !/^kibitz\.test /m.test(fs.readFileSync(cache, 'utf8')));
  const trusted = [...args, '--cacert', identity.cert];
  assert.equal((await run('curl', [...trusted, server.base + '/'])).stdout, server.base + '/ 200');
  assert.match(fs.readFileSync(cache, 'utf8'), /^kibitz\.test /m);
  assert.equal((await run('curl', [...trusted, server.base.replace('https:', 'http:') + '/'])).stdout, server.base + '/ 200');
});
