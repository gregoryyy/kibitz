import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { CookieError, identityCookie } from './cookies.mjs';
import { createApi } from './api.mjs';
import { loadConfig } from './ai.mjs';
import { createLibraryApi } from './library-api.mjs';

const uid = 'a'.repeat(22), library = 'b'.repeat(43);
function exchange(cookie = '', encrypted = true) {
  const headers = new Map();
  return { req: { headers: { cookie }, socket: { encrypted } }, res: { getHeader: key => headers.get(key), setHeader: (key, value) => headers.set(key, value) }, headers };
}
const identify = (x, kind = 'usage', options = {}) => identityCookie(x.req, x.res, kind, options);

test('HTTPS migrates each exact legacy token with protected attributes and expires only its old canonical path', () => {
  for (const [kind, name, token, path] of [['usage', 'kibitz_uid', uid, '/api/'], ['library', 'kibitz_library', library, '/api/library/']]) {
    const x = exchange(`${name}=${token}`);
    assert.equal(identify(x, kind), token);
    const cookies = x.headers.get('Set-Cookie'); assert.equal(cookies.length, 2);
    assert.equal(cookies[0], `__Secure-${name}=${token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=31536000; Secure`);
    assert.equal(cookies[1], `${name}=; Path=${path}; HttpOnly; SameSite=Strict; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    assert(!cookies.join().includes('Domain='));
    const repeated = exchange(`__Secure-${name}=${token}`); assert.equal(identify(repeated, kind), token); assert.equal(repeated.headers.size, 0);
  }
});

test('protected identity wins over conflicting legacy cookies without changing store keys', () => {
  const x = exchange(`__Secure-kibitz_uid=${uid}; kibitz_uid=${'z'.repeat(22)}; kibitz_uid=invalid`);
  assert.equal(identify(x), uid); assert.equal(x.headers.get('Set-Cookie').length, 1);
  assert.match(x.headers.get('Set-Cookie')[0], /^kibitz_uid=;.*Max-Age=0/);
});

test('malformed or duplicate secure identities fail without issuing, deleting or rotating a cookie', () => {
  for (const cookie of [`__Secure-kibitz_uid=short; kibitz_uid=${uid}`, `__Secure-kibitz_uid=${uid}; __Secure-kibitz_uid=${uid}`,
    `kibitz_uid=${uid}; kibitz_uid=${'z'.repeat(22)}`, 'kibitz_uid=bad', '__Secure-kibitz_uid', 'kibitz_uid=']) {
    const x = exchange(cookie);
    assert.throws(() => identify(x, 'usage', { create: true }), error => error instanceof CookieError && error.code === 'bad_request');
    assert.equal(x.headers.size, 0);
  }
});

test('HTTP requires explicit development permission and ignores both production namespaces even with spoofed transport headers', () => {
  const x = exchange(`kibitz_uid=${uid}; __Secure-kibitz_uid=${uid}`, false);
  x.req.headers['x-forwarded-proto'] = 'https';
  assert.throws(() => identify(x, 'usage', { create: true }), error => error.code === 'forbidden'); assert.equal(x.headers.size, 0);
  const dev = identify(x, 'usage', { create: true, allowInsecureHttp: true }); assert.notEqual(dev, uid);
  assert.match(x.headers.get('Set-Cookie')[0], /^kibitz_dev_uid=/); assert(!x.headers.get('Set-Cookie')[0].includes('Secure'));
  assert.equal(identify(exchange(`kibitz_dev_uid=${dev}`, false), 'usage', { allowInsecureHttp: true }), dev);
  const secure = exchange(`kibitz_dev_uid=${dev}`); assert.equal(identify(secure), null); assert.equal(secure.headers.size, 0);
});

test('API constructors refuse plaintext by default before store, provider, or cookie changes', async t => {
  let touched = 0;
  const libraryApi = createLibraryApi({ store: { read() { touched++; } } });
  const api = createApi({ config: loadConfig({ AI_PROVIDER: 'mock' }), countUsage() { touched++; return null; } });
  const server = http.createServer(async (req, res) => { if (!await libraryApi(req, res)) await api(req, res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  for (const route of ['ai/status', 'ai/sample', 'library/status', 'library/records']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, {
      method: route.endsWith('sample') ? 'POST' : 'GET', headers: { cookie: `kibitz_uid=${uid}; kibitz_library=${library}`, 'x-forwarded-proto': 'https' },
    });
    assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null); await response.text();
  }
  assert.equal(touched, 0);
});
