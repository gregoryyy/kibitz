import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APP_HOST, HSTS, applicationHost, enforceTransport } from './transport.mjs';

function exchange(host = `${APP_HOST}:8765`, { encrypted = true, method = 'GET', url = '/', forwarded = 'https' } = {}) {
  const headers = new Map();
  return { req: { headers: { host, 'x-forwarded-proto': forwarded }, socket: { encrypted }, method, url },
    res: { setHeader: (name, value) => headers.set(name, value) }, headers };
}
const allow = x => enforceTransport(x.req, x.res, { hostname: APP_HOST });

test('application hostname is a dedicated canonical name under .test, never localhost or an IP', () => {
  assert.equal(applicationHost(), 'kibitz.test'); assert.equal(applicationHost('study.kibitz.test'), 'study.kibitz.test');
  for (const value of ['', 'localhost', 'kibitz.localhost', 'test', '127.0.0.1', '[::1]', '*.test', '.test', 'KIBITZ.test', 'kibitz.test.',
    'https://kibitz.test', 'kibitz.test:8765', 'public.example', '-bad.test', 'bad-.test', 'a'.repeat(64) + '.test']) {
    assert.throws(() => applicationHost(value), error => error.code === 'ERR_KIBITZ_APP_HOST');
  }
});

test('only the native TLS socket can select HSTS; the isolated hostname has a fixed one-year policy', () => {
  const secure = exchange(undefined, { forwarded: 'http' }); assert.equal(allow(secure), true); assert.equal(secure.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  const plain = exchange(undefined, { encrypted: false }); assert.equal(allow(plain), false); assert.equal(plain.headers.size, 0);
  assert.equal(HSTS.includes('includeSubDomains'), false); assert.equal(HSTS.includes('preload'), false);
});

test('published port mappings retain the application HSTS policy; malformed authorities cannot select a host', () => {
  for (const authority of [APP_HOST, `${APP_HOST}:443`, `${APP_HOST}:8766`, `${APP_HOST}:32769`]) { const mapped = exchange(authority); assert.equal(allow(mapped), true); assert.equal(mapped.headers.get('Strict-Transport-Security'), HSTS); }
  for (const host of [undefined, '', `${APP_HOST}@localhost:8765`, `${APP_HOST}:8765/path`, `${APP_HOST}:bad`, `${APP_HOST}:65536`,
    `${APP_HOST}:8765?query`, `${APP_HOST}:8765#fragment`, ` ${APP_HOST}:8765`, `${APP_HOST}:8765,localhost:8765`]) {
    const x = exchange(); x.req.headers.host = host; assert.equal(allow(x), false); assert.equal(x.headers.size, 0);
  }
});

test('probe aliases allow only the exact static manifest GET/HEAD and never emit HSTS', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    for (const method of ['GET', 'HEAD']) {
      const probe = exchange(`${host}:8765`, { method, url: '/manifest.webmanifest' }); assert.equal(allow(probe), true); assert.equal(probe.headers.size, 0);
    }
    for (const [method, url] of [['GET', '/'], ['GET', '/api/ai/status'], ['GET', '/api/library/records'], ['GET', '/models/model.gguf'],
      ['POST', '/manifest.webmanifest'], ['GET', '/manifest.webmanifest?query']]) {
      const x = exchange(`${host}:8765`, { method, url }); assert.equal(allow(x), false); assert.equal(x.headers.size, 0);
    }
  }
  const other = exchange('another.test:8765', { url: '/manifest.webmanifest' }); assert.equal(allow(other), false); assert.equal(other.headers.size, 0);
});

test('policy is established before downstream success, error, stream and HEAD response handling', () => {
  for (const method of ['GET', 'POST', 'HEAD']) {
    for (const url of ['/', '/api/ai/status', '/api/library/erase', '/models/missing.gguf', '/missing', '/%zz']) {
      const x = exchange(undefined, { method, url }); assert.equal(allow(x), true); assert.equal(x.headers.get('Strict-Transport-Security'), HSTS);
    }
  }
});
