import { readFile } from 'node:fs/promises';
import { test, expect, open, loadPgn } from './fixtures.mjs';

const dataPage = async page => { await page.goto('/data.html'); await expect(page.locator('#browserExport')).toBeEnabled(); };
async function exported(page, button) {
  const pending = page.waitForEvent('download'); await page.locator(button).click(); const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^kibitz-.*\.json$/); return JSON.parse(await readFile(await download.path(), 'utf8'));
}
async function serverSeed(page) {
  return page.evaluate(async () => {
    const first = await fetch('/api/library/records').then(r => r.json());
    const saved = await fetch('/api/library/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: first.scope, revision: first.revision, changes: [
      { collection: 'games', id: 'private-game', record: { id: 'private-game', kind: 'study', pgn: '1. e4 {<img src=x> Private annotation} *' } },
      { collection: 'books', id: 'private-book', record: { id: 'private-book', title: 'Private reference', note: 'Original note', tags: ['pin'] } },
    ] }) }).then(r => r.json());
    const { createLibraryCache } = await import('/library/cache.js'); const cache = createLibraryCache(); await cache.write(saved); cache.close(); return saved;
  });
}

test('settings opens an isolated data page and browser export preserves raw future data and the saved game', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('dataSeeded')) { localStorage.setItem('kibitz.futureData', '{future-raw'); localStorage.setItem('other-app.secret', 'EXCLUDE'); sessionStorage.setItem('dataSeeded', '1'); } });
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. d4 d5 2. c4');
  await page.locator('#btnSettings').click(); await page.locator('#manageData').click(); await expect(page).toHaveURL(/\/data\.html$/);
  const download = await exported(page, '#browserExport'), entries = new Map(download.entries);
  expect(download.format).toBe('kibitz-browser-data'); expect(entries.get('kibitz.futureData')).toBe('{future-raw'); expect(entries.has('kibitz.current')).toBe(true);
  expect(JSON.stringify(download)).not.toContain('EXCLUDE'); expect(await page.evaluate(() => window.__kibitz)).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem('kibitz.futureData'))).toBe('{future-raw');
});

test('browser erasure requires confirmation, removes all Kibitz keys and cached owners, and keeps server and unrelated data', async ({ page }) => {
  await dataPage(page); const server = await serverSeed(page);
  await page.evaluate(() => { localStorage.setItem('kibitz.games', '[private]'); localStorage.setItem('kibitz.future', '{unknown'); localStorage.setItem('another.setting', 'keep'); });
  await page.locator('#browserErase').click(); await expect(page.locator('#eraseConfirm')).toBeVisible(); await expect(page.locator('#eraseCancel')).toBeFocused();
  await page.keyboard.press('Escape'); expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe('[private]');
  await page.locator('#browserErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('has been erased');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kibitz.')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('another.setting'))).toBe('keep');
  expect(await page.evaluate(async () => (await indexedDB.databases()).some(d => d.name === 'kibitz-library'))).toBe(false);
  const remaining = await page.evaluate(() => fetch('/api/library/records').then(r => r.json())); expect(remaining).toEqual(server);
  await page.reload(); expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kibitz.')))).toEqual([]);
});

test('server export and atomic erasure keep browser data; the owner cache is removed and old writes conflict', async ({ page }) => {
  await dataPage(page); const before = await serverSeed(page); await page.evaluate(() => localStorage.setItem('kibitz.private', 'KEEP-BROWSER'));
  await expect(page.locator('#serverErase')).toBeDisabled(); await page.locator('#serverLoad').click(); await expect(page.locator('#serverStatus')).toContainText('Saved games: 1 · references: 1');
  const download = await exported(page, '#serverExport'); expect(download.library).toEqual(before); expect(download.format).toBe('kibitz-server-library'); await expect(page.locator('img')).toHaveCount(0);
  await page.locator('#serverErase').click(); await page.locator('#eraseCancel').click(); await expect(page.locator('#eraseConfirm')).toBeHidden();
  await page.locator('#serverErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#serverStatus')).toContainText('and its cache on this device have been erased');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.private'))).toBe('KEEP-BROWSER');
  const result = await page.evaluate(async before => {
    const now = await fetch('/api/library/records').then(r => r.json());
    const late = await fetch('/api/library/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: before.scope, revision: before.revision, changes: [{ collection: 'games', id: 'late', record: { id: 'late', pgn: '1. d4 *' } }] }) });
    const { createLibraryCache } = await import('/library/cache.js'); const cache = createLibraryCache(), cached = await cache.read(before.scope); cache.close(); return { now, late: late.status, cached };
  }, before);
  expect(result.now.games).toEqual([]); expect(result.now.books).toEqual([]); expect(result.now.revision).toBe(before.revision + 1); expect(result.late).toBe(409); expect(result.cached).toBeNull();
});

test('a stale server confirmation and a changed browser preview are refused without deleting newer data', async ({ page }) => {
  await dataPage(page); const initial = await serverSeed(page); await page.locator('#serverLoad').click(); await expect(page.locator('#serverErase')).toBeEnabled();
  await page.locator('#serverErase').click(); await page.evaluate(async initial => {
    await fetch('/api/library/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: initial.scope, revision: initial.revision, changes: [{ collection: 'games', id: 'new', record: { id: 'new', pgn: '1. d4 *' } }] }) });
  }, initial);
  await page.locator('#eraseProceed').click(); await expect(page.locator('#serverStatus')).toContainText('changed');
  expect(await page.evaluate(() => fetch('/api/library/records').then(r => r.json()).then(v => v.games.length))).toBe(2);
  await page.evaluate(() => localStorage.setItem('kibitz.future', 'first')); await page.locator('#browserErase').click(); await page.evaluate(() => localStorage.setItem('kibitz.future', 'newer'));
  await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('could not be completed'); expect(await page.evaluate(() => localStorage.getItem('kibitz.future'))).toBe('newer');
});

test('failed browser deletion reports partial erasure and retries, while an uncertain server receipt does not claim success', async ({ page }) => {
  await page.addInitScript(() => {
    const remove = Storage.prototype.removeItem; window.__blockErase = true;
    Storage.prototype.removeItem = function (key) { if (key === 'kibitz.b' && window.__blockErase) throw new DOMException('blocked', 'SecurityError'); return remove.call(this, key); };
  });
  await dataPage(page); await page.evaluate(() => { localStorage.setItem('kibitz.a', 'a'); localStorage.setItem('kibitz.b', 'b'); });
  await page.locator('#browserErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('partly erased');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.a'))).toBeNull(); expect(await page.evaluate(() => localStorage.getItem('kibitz.b'))).toBe('b');
  await page.evaluate(() => { window.__blockErase = false; }); await page.locator('#browserErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('has been erased');
  await serverSeed(page); await page.locator('#serverLoad').click(); await expect(page.locator('#serverErase')).toBeEnabled();
  await page.route('**/api/library/erase', async route => { await route.fetch(); await route.abort('failed'); });
  await page.locator('#serverErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#serverStatus')).toContainText('could not be confirmed'); await expect(page.locator('#serverErase')).toBeDisabled();
  await page.locator('#serverLoad').click(); await expect(page.locator('#serverStatus')).toContainText('Saved games: 0 · references: 0');
});

test('German phone data controls and confirmation fit and stay translated after browser erasure', async ({ page }, info) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('dataLang')) { localStorage.setItem('kibitz.lang', JSON.stringify('de')); sessionStorage.setItem('dataLang', '1'); } });
  await page.setViewportSize({ width: 390, height: 844 }); await dataPage(page); await expect(page.locator('h1')).toHaveText('Deine Daten');
  await page.locator('#browserErase').click(); await expect(page.locator('#eraseTitle')).toHaveText('Daten in diesem Browser löschen?');
  await expect(page.locator('#eraseProceed')).toHaveText('Endgültig löschen'); await page.screenshot({ path: info.outputPath('data-phone.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('wurden gelöscht'); await expect(page.locator('h1')).toHaveText('Deine Daten');
});
