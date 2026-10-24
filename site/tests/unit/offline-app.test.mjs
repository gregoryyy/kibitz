import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { offlineAsset, installOfflineBundle, registerOfflineWorker, offlineCachePrefix } from '../../src/platform/offline-worker.js';
import { removeOfflineApp } from '../../src/platform/offline-app.js';
import { offlineCoach, rememberOfflineCoach, OFFLINE_COACH_KEY } from '../../src/platform/offline-coach.js';

const scope = 'http://127.0.0.1:8765/app/', digest = bytes => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const asset = (path, body) => ({ path, bytes: Buffer.byteLength(body), sha256: digest(Buffer.from(body)) });
function storage() { const map = new Map(); return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; }
function cacheStorage() {
  const stores = new Map();
  return { stores, keys: async () => [...stores.keys()], delete: async name => stores.delete(name), match: async (key, options) => stores.get(options.cacheName)?.get(String(key))?.clone(), open: async name => {
    if (!stores.has(name)) stores.set(name, new Map()); const map = stores.get(name);
    return { put: async (key, response) => map.set(String(key), response), match: async key => map.get(String(key))?.clone() };
  } };
}

test('offline routing admits only bundle assets and app entry navigations, never APIs, models, other origins or mutations', () => {
  const assets = [asset('chess/engine.js', 'engine'), asset('offline.html', 'page')];
  const request = (path, options = {}) => ({ url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options });
  assert.equal(offlineAsset(request('chess/engine.js'), scope, assets), 'chess/engine.js');
  assert.equal(offlineAsset(request('chess/engine.js', { method: 'HEAD' }), scope, assets), 'chess/engine.js');
  assert.equal(offlineAsset(request('./?debug', { mode: 'navigate' }), scope, assets), 'offline.html');
  for (const path of ['api/ai/status', 'api/ai/sample', 'api/library/records', 'models/example.gguf', '../chess/engine.js', 'chess/engine.js?changed', 'https://other.test/app/chess/engine.js']) assert.equal(offlineAsset(request(path), scope, assets), null, path);
  assert.equal(offlineAsset(request('chess/engine.js', { method: 'POST' }), scope, assets), null);
});

test('offline install checks exact size/hash before storing, retains headers and never sends cookies', async () => {
  const caches = cacheStorage(), assets = [asset('engine.js', 'engine'), asset('offline.html', 'page')], requests = [];
  await installOfflineBundle({ caches, scope, assets, name: 'new', digest, fetcher: async (url, options) => {
    requests.push([url, options]); return new Response(url.endsWith('engine.js') ? 'engine' : 'page', { headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } });
  } });
  const cache = await caches.open('new'); assert.equal(await (await cache.match(scope + 'engine.js')).text(), 'engine');
  assert.equal((await cache.match(scope + 'offline.html')).headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.ok(requests.every(([, options]) => options.credentials === 'omit' && options.redirect === 'error' && options.cache === 'no-store'));
});

test('failed or changed offline downloads discard only the incomplete new bundle', async () => {
  for (const response of [new Response('bad'), new Response('xx'), new Response('down', { status: 503 })]) {
    const caches = cacheStorage(); await caches.open('previous');
    await assert.rejects(installOfflineBundle({ caches, scope, assets: [asset('one', 'one'), asset('two', 'two')], name: 'new', digest,
      fetcher: async url => url.endsWith('one') ? new Response('one') : response }));
    assert.deepEqual(await caches.keys(), ['previous']);
  }
});

test('activation cleans only obsolete bundles in this scope and never forces a waiting update', async () => {
  const caches = cacheStorage(), handlers = {}, prefix = offlineCachePrefix(scope); let claimed = 0;
  for (const name of [prefix + 'old', prefix + 'new', offlineCachePrefix('https://example.test/another/') + 'old', 'other-app']) await caches.open(name);
  registerOfflineWorker({ registration: { scope }, caches, fetch: async () => {}, clients: { claim: async () => claimed++ }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting: () => assert.fail('must not replace active app') }, [], 'new');
  let pending; handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
  assert.deepEqual(await caches.keys(), [prefix + 'new', offlineCachePrefix('https://example.test/another/') + 'old', 'other-app']); assert.equal(claimed, 0);
  let intercepted = false; handlers.fetch({ request: { url: scope + 'api/library/records', method: 'GET' }, respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false);
});

test('offline removal acknowledges this registration/cache only and propagates failures', async () => {
  const caches = cacheStorage(), prefix = offlineCachePrefix(scope); let removed = false;
  await caches.open(prefix + 'one'); await caches.open('unrelated');
  const registration = { scope, active: { scriptURL: scope + 'sw.js' }, unregister: async () => { removed = true; } };
  await removeOfflineApp({ getRegistration: async () => registration }, caches, scope + 'data.html');
  assert.equal(removed, true); assert.deepEqual(await caches.keys(), ['unrelated']);
  await assert.rejects(removeOfflineApp({ getRegistration: async () => { throw Error('blocked'); } }, caches, scope));
});

test('a still-controlled page cannot recreate erased bundle caches through later reads', async () => {
  const caches = cacheStorage(), handlers = {}, assets = [asset('offline.html', 'page')];
  registerOfflineWorker({ registration: { scope }, caches, fetch: async () => {}, addEventListener: (name, handler) => { handlers[name] = handler; } }, assets, 'erased');
  let response; handlers.fetch({ request: { url: scope, method: 'GET', mode: 'navigate' }, respondWith: promise => { response = promise; } });
  assert.equal((await response).status, 503); assert.deepEqual(await caches.keys(), []);
  let pending, message; handlers.message({ data: 'kibitz-offline-status', ports: [{ postMessage: value => { message = value; } }], waitUntil: promise => { pending = promise; } }); await pending;
  assert.equal(message.ready, false); assert.deepEqual(await caches.keys(), []);
});

test('offline coach retains only an explicitly selected browser descriptor, never network routing or user/API metadata', () => {
  const local = storage(), browser = { url: 'models/example.gguf', name: 'Example', bytes: 1234 };
  assert.equal(offlineCoach(local), null);
  assert.equal(rememberOfflineCoach(local, { available: true, provider: 'browser', browser, user: { private: 'secret' }, usage: 'private', models: { chat: 'private' } }), true);
  assert.deepEqual(JSON.parse(local.getItem(OFFLINE_COACH_KEY)), { version: 1, model: browser });
  const status = offlineCoach(local); assert.equal(status.provider, 'browser'); assert.equal(status.offline, true); assert.equal(status.localOnly, true); assert.equal(status.user, undefined);
  for (const provider of ['ollama', 'openai', 'mock']) { rememberOfflineCoach(local, { available: true, provider, browser }); assert.equal(offlineCoach(local), null); }
});

test('malformed/future offline coach data remains closed and intact; model URLs cannot become external requests', () => {
  for (const raw of ['broken', '{"version":2}', 'x'.repeat(3000)]) {
    const local = storage(); local.setItem(OFFLINE_COACH_KEY, raw); assert.equal(offlineCoach(local), null);
    assert.equal(rememberOfflineCoach(local, { available: false }), false); assert.equal(local.getItem(OFFLINE_COACH_KEY), raw);
  }
  for (const url of ['https://evil.test/model.gguf', '/models/model.gguf', 'models/../model.gguf', 'models/model.gguf?secret']) {
    const local = storage(); rememberOfflineCoach(local, { available: true, provider: 'browser', browser: { url, name: 'Example', bytes: 1 } }); assert.equal(offlineCoach(local), null);
  }
  assert.equal(offlineCoach({ getItem() { throw Error('denied'); } }), null);
});

test('built offline bundle binds every public asset digest, removes remote fonts and supplies a scoped install manifest', () => {
  const dist = new URL('../../dist/', import.meta.url), worker = readFileSync(new URL('sw.js', dist), 'utf8');
  const [, list, revision] = worker.match(/registerOfflineWorker\(self, (\[.*\]), "([a-f0-9]+)"\)/), assets = JSON.parse(list);
  assert.equal(createHash('sha256').update(JSON.stringify(assets)).digest('hex'), revision);
  for (const entry of assets) { const body = readFileSync(new URL(entry.path, dist)); assert.equal(body.length, entry.bytes, entry.path); assert.equal(digest(body), entry.sha256, entry.path); assert.ok(!/^(api|models)\//.test(entry.path)); }
  for (const path of ['sf.wasm', 'sf-mt.wasm', 'sf-asm.js', 'eco.json', 'openings.json', 'opening-variations.json', 'curriculum/catalogue.js', 'library/classics.js', 'wllama.js', 'wllama.wasm', 'data.html']) assert.ok(assets.some(entry => entry.path === path), path);
  const html = readFileSync(new URL('offline.html', dist), 'utf8'); assert.ok(!html.includes('href="https://fonts.')); assert.ok(html.includes('rel="manifest"'));
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', dist), 'utf8')); assert.equal(manifest.start_url, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.display, 'standalone');
});
