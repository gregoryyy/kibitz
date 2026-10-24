// Real IndexedDB, including native transaction aborts and version changes.
import { test, expect, open } from './fixtures.mjs';

test('cache scopes round-trip separately, survive reload and capture a snapshot before asynchronous opening', async ({ page }) => {
  await open(page);
  const first = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js');
    const cache = createLibraryCache({ now: () => '2026-10-24T09:00:00.000Z' }), a = 'a'.repeat(64), b = 'b'.repeat(64);
    const value = { version: 1, scope: a, revision: 1, games: [{ id: 'same', title: '<img src=x>', pgn: '1. e4 *', provenance: { version: 99, retained: true } }], books: [] };
    const pending = cache.write(value); value.games[0].title = 'Changed after call'; await pending;
    await cache.write({ ...value, scope: b, games: [{ id: 'same', pgn: '1. d4 *' }] });
    const result = [await cache.read(a), await cache.read(b)]; cache.close(); return result;
  });
  expect(first[0].snapshot.games[0].title).toBe('<img src=x>'); expect(first[0].snapshot.games[0].provenance.version).toBe(99);
  expect(first[1].snapshot.games[0].pgn).toBe('1. d4 *'); expect(first[0].cachedAt).toBe('2026-10-24T09:00:00.000Z');
  await page.reload();
  const restored = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'); const cache = createLibraryCache();
    const value = await cache.read('a'.repeat(64)); cache.close(); return value;
  });
  expect(restored).toEqual(first[0]);
});

test('a put success followed by native transaction abort never acknowledges a cache save or loses the previous snapshot', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'), cache = createLibraryCache(), scope = 'a'.repeat(64);
    const initial = { version: 1, scope, revision: 1, games: [{ id: 'keep', pgn: '1. e4 *' }], books: [] }; await cache.write(initial);
    const put = IDBObjectStore.prototype.put; let requestSucceeded = false, acknowledged = false, code;
    IDBObjectStore.prototype.put = function(value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      request.addEventListener('success', () => { requestSucceeded = true; this.transaction.abort(); }); return request;
    };
    try { await cache.write({ ...initial, revision: 2, games: [{ id: 'replacement', pgn: '1. d4 *' }] }); acknowledged = true; }
    catch (error) { code = error.code; }
    finally { IDBObjectStore.prototype.put = put; }
    const saved = await cache.read(scope); cache.close(); return { requestSucceeded, acknowledged, code, snapshot: saved.snapshot };
  });
  expect(result.requestSucceeded).toBe(true); expect(result.acknowledged).toBe(false); expect(result.code).toBe('library_cache_write'); expect(result.snapshot.revision).toBe(1); expect(result.snapshot.games[0].id).toBe('keep');
});

test('future cache envelopes are preserved through both reads and attempted writes', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache, LIBRARY_CACHE_DB } = await import('/library/cache.js'), scope = 'a'.repeat(64);
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(LIBRARY_CACHE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('snapshots', { keyPath: 'scope' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const future = { version: 99, scope, future: 'retain unknown fields' };
    await new Promise((resolve, reject) => { const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(future); tx.oncomplete = resolve; tx.onabort = reject; });
    const cache = createLibraryCache(), read = await cache.read(scope).catch(e => e.code), write = await cache.write({ version: 1, scope, revision: 0, games: [], books: [] }).catch(e => e.code);
    const retained = await new Promise(resolve => { const r = db.transaction('snapshots').objectStore('snapshots').get(scope); r.onsuccess = () => resolve(r.result); });
    cache.close(); db.close(); return { read, write, retained };
  });
  expect(result.read).toBe('library_cache_version'); expect(result.write).toBe('library_cache_version'); expect(result.retained.future).toBe('retain unknown fields'); expect(result.retained.version).toBe(99);
});

test('version changes close old connections and a future database is neither downgraded nor erased', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache, LIBRARY_CACHE_DB } = await import('/library/cache.js'), cache = createLibraryCache(), scope = 'a'.repeat(64);
    await cache.write({ version: 1, scope, revision: 3, games: [{ id: 'kept', pgn: '1. e4 *' }], books: [] });
    const future = await new Promise((resolve, reject) => { const r = indexedDB.open(LIBRARY_CACHE_DB, 2); r.onupgradeneeded = () => r.result.createObjectStore('future'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const code = await cache.read(scope).catch(e => e.code);
    const retained = await new Promise(resolve => { const r = future.transaction('snapshots').objectStore('snapshots').get(scope); r.onsuccess = () => resolve(r.result); });
    const version = future.version, hasFuture = future.objectStoreNames.contains('future'); future.close(); cache.close(); return { code, retained, version, hasFuture };
  });
  expect(result.code).toBe('library_cache_version'); expect(result.version).toBe(2); expect(result.hasFuture).toBe(true); expect(result.retained.snapshot.games[0].id).toBe('kept');
});

test('an unknown version-one database layout remains intact rather than being reset', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache, LIBRARY_CACHE_DB } = await import('/library/cache.js');
    const db = await new Promise(resolve => { const r = indexedDB.open(LIBRARY_CACHE_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('unknown'); r.onsuccess = () => resolve(r.result); });
    await new Promise(resolve => { const tx = db.transaction('unknown', 'readwrite'); tx.objectStore('unknown').put('original', 'key'); tx.oncomplete = resolve; });
    const cache = createLibraryCache(), code = await cache.read('a'.repeat(64)).catch(e => e.code);
    const retained = await new Promise(resolve => { const r = db.transaction('unknown').objectStore('unknown').get('key'); r.onsuccess = () => resolve(r.result); });
    cache.close(); db.close(); return { code, retained, names: [...db.objectStoreNames] };
  });
  expect(result.code).toBe('library_cache_version'); expect(result.retained).toBe('original'); expect(result.names).toEqual(['unknown']);
});

test('unavailable storage, invalid scopes and closing are explicit failures without clearing valid cached data', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'), scope = 'a'.repeat(64), value = { version: 1, scope, revision: 0, games: [], books: [] };
    const unavailable = createLibraryCache({ factory: null }), absent = await unavailable.write(value).catch(e => e.code);
    const cache = createLibraryCache(); await cache.write(value); const invalid = await cache.read('other-owner').catch(e => e.code); cache.close();
    const closed = await cache.read(scope).catch(e => e.code), fresh = createLibraryCache(), kept = await fresh.read(scope); fresh.close(); return { absent, invalid, closed, kept };
  });
  expect(result.absent).toBe('library_cache_unavailable'); expect(result.invalid).toBe('library_cache_invalid'); expect(result.closed).toBe('library_cache_unavailable'); expect(result.kept.snapshot.revision).toBe(0);
});
