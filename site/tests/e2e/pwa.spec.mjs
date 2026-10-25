import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { BASE_HEADERS, cspFor } from '../../server/static.mjs';
import { test, expect, open, openSettings, closeSettings, S, move } from './fixtures.mjs';

// Installation verifies every asset and allows 120 seconds in the app. Large WASM
// bundles can exceed the default assertion wait on a busy CI/development machine.
const INSTALL_TIMEOUT = 130_000;
test.setTimeout(300_000);
const PREFIX = 'kibitz-app-v1:';
const appCaches = page => page.evaluate(prefix => caches.keys().then(keys => keys.filter(key => key.startsWith(prefix))), PREFIX);
async function prepare(page) {
  await openSettings(page); await page.locator('#offlinePrepare').click(); await expect(page.locator('#offlineStatus')).toContainText(/Offline app ready|Offline-App bereit/, { timeout: INSTALL_TIMEOUT });
  await closeSettings(page); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}
const reset = request => request.post('/api/ai/config', { data: { localOnly: false, provider: 'mock' } });
test.beforeEach(({ request }) => reset(request));
test.afterEach(({ request }) => reset(request));

// Real worker update requests bypass page routing. This local fixture changes its HTTP
// response in memory, while serving the unchanged built assets and security headers.
async function updateSite() {
  const root = new URL('../../dist/', import.meta.url); let replacement = null;
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://local').pathname, file = pathname === '/' ? '_test.html' : pathname.slice(1);
    try {
      if (file.startsWith('api/') || file.split('/').some(part => part.startsWith('.'))) throw Error('excluded');
      const target = new URL(file, root); if (!target.href.startsWith(root.href)) throw Error('outside fixture');
      const bytes = file === 'sw.js' && replacement ? Buffer.from(replacement) : await readFile(target);
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.json') ? 'application/json' : file.endsWith('.webmanifest') ? 'application/manifest+json' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.ttf') ? 'font/ttf' : 'text/plain';
      response.writeHead(200, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', ...(file.endsWith('.html') ? { 'Content-Security-Policy': cspFor(bytes.toString()) } : {}) }); response.end(bytes);
    } catch { response.writeHead(404, BASE_HEADERS); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, replace: body => { replacement = body; }, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

test('explicit preparation supports a fresh offline reload, actual Stockfish play, browser library, openings and lessons without caching private APIs', async ({ page, context, request }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('kibitz.games')) localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'offline-game', kind: 'study', title: 'Offline private game', pgn: '1. d4 d5 *' }])); });
  await open(page); expect(await appCaches(page)).toEqual([]); expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  const manifestResponse = await request.get('/manifest.webmanifest'); expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json'); expect((await manifestResponse.json()).display).toBe('standalone');
  await prepare(page); expect(await appCaches(page)).toHaveLength(1);
  const cached = await page.evaluate(async prefix => { const names = (await caches.keys()).filter(key => key.startsWith(prefix)); return (await (await caches.open(names[0])).keys()).map(request => new URL(request.url).pathname); }, PREFIX);
  expect(cached.some(path => /^\/(api|models)\//.test(path))).toBe(false);
  await context.setOffline(true); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await page.locator('#btnNewGame').click(); await move(page, 'e2', 'e4'); await expect.poll(async () => (await S(page)).nodes).toBeGreaterThanOrEqual(3);
  await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="library"]').click(); await expect(page.locator('#libList')).toContainText('Offline private game');
  await page.locator('[data-tab="lessons"]').click(); await page.locator('[data-lesson-id="back-rank-mate"] summary').click();
  await page.locator('[data-open-exercise="back-rank-white"]').click(); await expect(page.locator('#lessonPlayer')).toBeVisible();
  await page.locator('#lessonMove').fill('Re8#'); await page.locator('#lessonMoveForm button').click(); await expect(page.locator('#lessonFeedback')).toContainText('Checkmate, verified');
  expect(await page.evaluate(() => fetch('openings.json').then(r => r.json()).then(value => value.length))).toBeGreaterThan(100);
  await expect(page.locator('#coachOff')).toContainText('local AI gateway');
});

test('a prepared update waits for the current game tab to close and then retires only the old app bundle', async ({ page, context }) => {
  const site = await updateSite();
  try {
  await open(page, site.url + '?debug'); await prepare(page); const old = (await appCaches(page))[0];
  const source = await readFile(new URL('../../dist/sw.js', import.meta.url), 'utf8'), revision = 'f'.repeat(64);
  site.replace(source.replace(/, "[a-f0-9]{64}"\);/, `, "${revision}");`));
  const updateStarted = context.waitForEvent('serviceworker');
  await openSettings(page); await page.locator('#offlinePrepare').click(); await expect(page.locator('#offlineStatus')).toContainText('An update is prepared', { timeout: INSTALL_TIMEOUT }); const worker = await updateStarted;
  expect(await appCaches(page)).toContain(old); expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)).toBe(true);
  // Match the documented flow: close every tab before opening the replacement.
  await page.close();
  await expect.poll(() => worker.evaluate(async () => ({
    waiting: self.registration.waiting?.state ?? null, active: self.registration.active?.state ?? null,
    clients: (await self.clients.matchAll({ includeUncontrolled: true })).map(client => client.url),
  })), { timeout: 60_000 }).toMatchObject({ waiting: null, active: 'activated' });
  const next = await context.newPage(); await next.goto(site.url + '?debug'); await expect(next.locator('#engineDot')).toHaveClass(/ok/);
  await expect.poll(() => appCaches(next)).toEqual([old.slice(0, old.lastIndexOf(':') + 1) + revision]); await next.close();
  } finally { await site.close(); }
});

test('an integrity failure during an update keeps the previous complete offline app usable', async ({ page, context }) => {
  const site = await updateSite();
  try {
  await open(page, site.url + '?debug'); await prepare(page); const before = await appCaches(page), source = await readFile(new URL('../../dist/sw.js', import.meta.url), 'utf8');
  const changed = source.replace(/"sha256":"[a-f0-9]{64}"/, `"sha256":"${'0'.repeat(64)}"`).replace(/, "[a-f0-9]{64}"\);/, `, "${'1'.repeat(64)}");`);
  site.replace(changed);
  await openSettings(page); await page.locator('#offlinePrepare').click(); await expect(page.locator('#offlineStatus')).toContainText('could not be confirmed', { timeout: INSTALL_TIMEOUT }); expect(await appCaches(page)).toEqual(before);
  await context.setOffline(true); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  } finally { await site.close(); }
});

test('offline removal preserves saved games and unrelated caches; confirmed browser erasure also removes the offline registration', async ({ page }) => {
  await open(page); await page.evaluate(async () => { localStorage.setItem('kibitz.private', 'KEEP'); await caches.open('another-app'); }); await prepare(page);
  await openSettings(page); await page.locator('#offlineRemove').click(); await expect(page.locator('#offlineStatus')).toContainText('Offline copy removed');
  expect(await appCaches(page)).toEqual([]); expect(await page.evaluate(() => localStorage.getItem('kibitz.private'))).toBe('KEEP'); expect(await page.evaluate(() => caches.keys())).toEqual(['another-app']);
  await page.reload(); await prepare(page); await page.goto('/data.html'); await page.locator('#browserErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('has been erased');
  expect(await appCaches(page)).toEqual([]); expect(await page.evaluate(() => navigator.serviceWorker.getRegistration())).toBeUndefined(); expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('kibitz.')))).toEqual([]); expect(await page.evaluate(() => caches.keys())).toEqual(['another-app']);
  await page.evaluate(() => fetch('icon.svg')); expect(await appCaches(page)).toEqual([]);
});

test('a previously selected browser coach survives gateway loss and reload without replaying a cached network status', async ({ page, request }) => {
  // Fake runtime simulates its existing local weight cache; the separate offline-bundle test uses real Stockfish.
  await page.route('**/wllama.js', route => route.fulfill({ contentType: 'text/javascript', body: `export class Wllama { isSupportWebGPU(){return false} async loadModelFromUrl(){} async createChatCompletion(){return (async function*(){yield {choices:[{delta:{content:'Local cached coach.'}}]}})()} async exit(){} }` }));
  await request.post('/api/ai/config', { data: { provider: 'browser' } }); await open(page); await page.locator('#btnLoadModel').click(); await expect(page.locator('#browserModelState')).toContainText('ready');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.offlineCoach')).model.url)).toBe('models/fake.gguf');
  await page.route('**/api/**', route => route.abort('internetdisconnected')); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await page.locator('#coachInput').fill('Explain this position'); await page.locator('#coachSend').click(); await expect(page.locator('#chat .msg.coach').last()).toContainText('Local cached coach.');
  await openSettings(page); await expect(page.locator('#providerHint')).toContainText('previously selected browser coach'); await expect(page.locator('#optProvider [data-v="browser"]')).toHaveAttribute('aria-pressed', 'true');
});

test('an incomplete cache requires explicit removal and re-preparation, and failed removal retries without erasing saved data', async ({ page }) => {
  await open(page); await page.evaluate(() => localStorage.setItem('kibitz.keep', 'saved')); await prepare(page);
  await page.evaluate(async prefix => { const name = (await caches.keys()).find(name => name.startsWith(prefix)); await (await caches.open(name)).delete(new URL('icon.svg', location.href)); }, PREFIX);
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await openSettings(page); await expect(page.locator('#offlineStatus')).toContainText('offline copy is incomplete'); await expect(page.locator('#offlinePrepare')).toBeDisabled();
  await page.locator('#offlineRemove').click(); await expect(page.locator('#offlineStatus')).toContainText('Offline copy removed'); await page.reload(); await prepare(page); await openSettings(page);
  expect(await page.evaluate(async prefix => { const name = (await caches.keys()).find(name => name.startsWith(prefix)); return !!await (await caches.open(name)).match(new URL('icon.svg', location.href)); }, PREFIX)).toBe(true);
  await page.evaluate(() => { window.__cacheDelete = CacheStorage.prototype.delete; CacheStorage.prototype.delete = async () => { throw Error('blocked'); }; });
  await page.locator('#offlineRemove').click(); await expect(page.locator('#offlineStatus')).toContainText('could not be completed'); expect(await appCaches(page)).toHaveLength(1); expect(await page.evaluate(() => localStorage.getItem('kibitz.keep'))).toBe('saved');
  await page.evaluate(() => { CacheStorage.prototype.delete = window.__cacheDelete; }); await page.locator('#offlineRemove').click(); await expect(page.locator('#offlineStatus')).toContainText('Offline copy removed'); expect(await appCaches(page)).toEqual([]);
});

test('German phone offline controls are keyboard accessible, translated and fit the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page); await openSettings(page);
  await expect(page.locator('#offlineApp')).toContainText('Browserbibliothek'); await page.locator('#offlinePrepare').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#offlineStatus')).toContainText('Offline-App bereit', { timeout: INSTALL_TIMEOUT });
  await page.locator('#offlineApp').screenshot({ path: info.outputPath('offline-phone.png') }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
