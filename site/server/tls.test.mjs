import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTlsOptions } from './tls.mjs';
import { tlsMaterial } from '../tests/helpers/tls-material.mjs';
import { httpsCli } from '../tests/helpers/https-cli.mjs';

let fixture, other, root, models;
before(() => {
  fixture = tlsMaterial(); other = tlsMaterial();
  root = path.join(fixture.dir, 'public'); models = path.join(fixture.dir, 'models');
  fs.mkdirSync(root); fs.mkdirSync(models); fs.writeFileSync(path.join(root, '_test.html'), '<!doctype html><title>HTTPS</title>');
});
after(() => { fixture?.close(); other?.close(); });
const options = extra => ({ key: fixture.key, cert: fixture.cert, servedRoots: [root, models], ...extra });
const rejects = value => assert.throws(() => loadTlsOptions(value), error => error.code === 'ERR_KIBITZ_TLS_CONFIG'
  && !error.message.includes(fixture.dir) && !error.message.includes('PRIVATE KEY'));

test('TLS is explicitly selected; incomplete, empty or unreadable identities cannot select HTTP', () => {
  assert.equal(loadTlsOptions({ servedRoots: [root] }), null);
  for (const value of [options({ key: undefined }), options({ cert: undefined }), options({ key: '' }), options({ cert: '' }),
    options({ key: path.join(fixture.dir, 'missing.pem') }), options({ servedRoots: [] })]) rejects(value);
  assert.equal(loadTlsOptions(options()).minVersion, 'TLSv1.2');
});

test('the TLS pair is parsed and checked for a matching key before startup', () => {
  const malformed = path.join(fixture.dir, 'invalid.pem'); fs.writeFileSync(malformed, 'SYNTHETIC_INVALID_PEM');
  rejects(options({ cert: malformed })); rejects(options({ key: other.key }));
});

test('TLS identities stay outside both served roots, including parent aliases', () => {
  for (const directory of [root, models]) {
    const key = path.join(directory, 'key.pem'); fs.copyFileSync(fixture.key, key); fs.chmodSync(key, 0o600);
    const cert = path.join(directory, 'cert.pem'); fs.copyFileSync(fixture.cert, cert);
    rejects(options({ key })); rejects(options({ cert }));
    const alias = path.join(fixture.dir, path.basename(directory) + '-alias'); fs.symlinkSync(directory, alias);
    rejects(options({ key: path.join(alias, 'key.pem') }));
  }
});

test('key permissions, leaf aliases, hardlinks, non-files and actual byte limits are enforced', () => {
  const key = path.join(fixture.dir, 'copy.pem'); fs.copyFileSync(fixture.key, key); fs.chmodSync(key, 0o600);
  if (process.platform !== 'win32') { fs.chmodSync(key, 0o640); rejects(options({ key })); fs.chmodSync(key, 0o600); }
  const alias = path.join(fixture.dir, 'alias.pem'); fs.symlinkSync(key, alias); rejects(options({ key: alias }));
  const hardlink = path.join(fixture.dir, 'hardlink.pem'); fs.linkSync(key, hardlink); rejects(options({ key })); fs.unlinkSync(hardlink);
  rejects(options({ key: fixture.dir }));
  fs.writeFileSync(key, Buffer.alloc(1024 * 1024 + 1), { mode: 0o600 }); rejects(options({ key }));
  fs.writeFileSync(key, ''); rejects(options({ key }));
});

const get = (url, ca, extra = {}) => new Promise((resolve, reject) => {
  const req = https.get(url, { ca, agent: false, timeout: 5000, ...extra }, res => {
    const protocol = res.socket.getProtocol();
    let body = ''; res.setEncoding('utf8'); res.on('data', chunk => body += chunk);
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, protocol }));
  });
  req.once('timeout', () => req.destroy(Error('TLS request timed out'))); req.once('error', reject);
});

test('the actual CLI serves HTTPS with trusted chain/hostname validation, no plaintext fallback and native Secure cookies', async t => {
  const server = await httpsCli({ root, key: fixture.key, cert: fixture.cert }); t.after(server.close);
  const page = await get(server.base + '/', fixture.ca); assert.equal(page.status, 200); assert.match(page.body, /<title>HTTPS/);
  assert.equal(page.protocol, 'TLSv1.3');
  assert.equal((await get(server.base + '/', fixture.ca, { maxVersion: 'TLSv1.2' })).protocol, 'TLSv1.2');
  assert(page.headers['content-security-policy'].includes("frame-ancestors 'none'"));
  for (const route of ['/api/ai/status', '/api/library/records']) {
    const response = await get(server.base + route, fixture.ca, { headers: { 'x-forwarded-proto': 'http' } });
    assert.equal(response.status, 200); assert(response.headers['set-cookie'][0].split('; ').includes('Secure'));
  }
  await assert.rejects(get(server.base + '/', undefined));
  await assert.rejects(get(server.base + '/', fixture.ca, { servername: 'wrong.example' }));
  await assert.rejects(get(server.base + '/', fixture.ca, { maxVersion: 'TLSv1.1', minVersion: 'TLSv1', ciphers: 'DEFAULT@SECLEVEL=0' }),
    error => /protocol|alert/i.test(error.message));
  await new Promise((resolve, reject) => {
    const request = http.get(server.base.replace('https:', 'http:') + '/', { timeout: 3000 }, res => {
      res.resume(); if (res.statusCode >= 400) resolve(null); else reject(Error('Plaintext reached the HTTPS application'));
    });
    request.once('error', resolve); request.once('timeout', () => request.destroy());
  });
  assert(!server.output().includes(fixture.dir)); assert(!server.output().includes('PRIVATE KEY'));
});

test('invalid TLS exits before creating library/usage storage or printing identity paths/PEM errors', () => {
  const script = fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url));
  for (const flags of [['--tls-key', fixture.key], ['--tls-cert', fixture.cert], ['--tls-key=', '--tls-cert='],
    ['--tls-key', other.key, '--tls-cert', fixture.cert]]) {
    const dir = path.join(fixture.dir, 'must-not-create');
    const result = spawnSync(process.execPath, [script, root, '--library', path.join(dir, 'library.sqlite'), ...flags],
      { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 1); assert(!fs.existsSync(dir)); assert(!result.stdout.includes('Serving'));
    const event = JSON.parse(result.stderr.trim()); assert.equal(event.event, 'server_error');
    assert.equal(event.code, 'ERR_KIBITZ_TLS_CONFIG'); assert.match(event.hint, /both TLS PEM files/);
    for (const marker of [fixture.dir, other.dir, 'PRIVATE KEY', 'SYNTHETIC_INVALID_PEM']) assert(!result.stderr.includes(marker));
  }
});
