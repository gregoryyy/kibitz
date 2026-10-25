import { test, expect, open } from './fixtures.mjs';

test('authoritative expiry after a verified status erases cached private records instead of displaying them offline', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'), { createServerLibrary } = await import('/library/server-session.js');
    const cache = createLibraryCache(), scope = 'a'.repeat(64);
    await cache.write({ version: 1, scope, revision: 1, games: [{ id: 'private-expired', pgn: '1. e4 *' }], books: [] });
    const fetcher = async url => new Response(JSON.stringify(url.endsWith('status') ? { available: true, scope } : { error: { code: 'session_expired' } }), { status: url.endsWith('status') ? 200 : 401 });
    const session = createServerLibrary({ cache, fetcher }); await session.connect();
    const state = structuredClone(session.state), exists = (await indexedDB.databases()).some(db => db.name === 'kibitz-library'); session.close();
    return { state, exists };
  });
  expect(result.state.snapshot).toBeNull(); expect(result.state.mode).toBe('unavailable'); expect(result.state.error).toBe('session_expired'); expect(result.exists).toBe(false);
});

test('ending the session inside a pending cache transaction cannot publish, acknowledge or resurrect the old snapshot', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'), { createServerLibrary } = await import('/library/server-session.js');
    const cache = createLibraryCache(), scope = 'a'.repeat(64), snapshot = { version: 1, scope, revision: 1, games: [{ id: 'late-private', pgn: '1. e4 *' }], books: [] };
    const session = createServerLibrary({ cache, fetcher: async url => new Response(JSON.stringify(url.endsWith('status') ? { available: true, scope } : snapshot)) });
    const put = IDBObjectStore.prototype.put; let cleanup;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key);
      request.addEventListener('success', () => { cleanup = session.endSession(); }); return request;
    };
    let status;
    try { status = await session.connect().then(() => 'connected', error => error.code); }
    finally { IDBObjectStore.prototype.put = put; }
    const cleaned = await cleanup, state = structuredClone(session.state), exists = (await indexedDB.databases()).some(db => db.name === 'kibitz-library'); session.close();
    return { status, cleaned, state, exists };
  });
  expect(result.status).toBe('library_cancelled'); expect(result.cleaned).toBe(true); expect(result.state.snapshot).toBeNull(); expect(result.state.mode).toBe('off'); expect(result.exists).toBe(false);
});
