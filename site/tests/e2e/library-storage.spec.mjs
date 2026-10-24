import { test, expect, open, reveal, loadPgn, S } from './fixtures.mjs';
const PGN = '[Event "Server example"]\n[White "Server learner"]\n[Black "Opponent"]\n[Date "2026.10.24"]\n[Result "*"]\n\n1. d4 d5 *';
const LOCAL = { id: 'browser-only', kind: 'study', title: 'Browser private', white: 'Browser learner', black: 'Other', pgn: '1. e4 *' };
const library = page => page.locator('[data-tab="library"]').click();
const cards = page => page.locator('#libList .game[data-collection="library"]');
const connect = async page => {
  await library(page); await expect(page.locator('#libUseServer')).toBeVisible(); await page.locator('#libUseServer').click();
  await expect(page.locator('#libWhere')).toHaveText(/Saved on this server|Auf diesem Server gespeichert/); await expect(page.locator('#libServerRefresh')).toBeEnabled();
};
const submit = async (page, pgn = PGN) => { await reveal(page, '#importText'); await page.locator('#importText').fill(pgn); await page.locator('#btnImport').click(); };
const added = page => expect(page.locator('#importMsg')).toHaveText('Added 1 game.');
const snapshot = page => page.evaluate(() => fetch('api/library/records').then(r => r.json()));
const stored = page => page.evaluate(() => localStorage.getItem('kibitz.games'));
const postCounter = page => { const calls = []; page.on('request', r => { if (new URL(r.url()).pathname === '/api/library/records' && r.method() === 'POST') calls.push(r.postDataJSON()); }); return calls; };
async function seed(page, games = [LOCAL], books = []) {
  await page.addInitScript(value => { localStorage.setItem('kibitz.games', JSON.stringify(value.games)); localStorage.setItem('kibitz.books', JSON.stringify(value.books)); }, { games, books });
}

test('server storage is explicit, keeps the browser library separate, persists through reload and uses a scoped cache', async ({ page }) => {
  await seed(page); const posts = postCounter(page); await open(page); await library(page);
  const before = await S(page), local = await stored(page); await expect(cards(page)).toContainText('Browser private');
  expect((await page.context().cookies()).some(c => c.name === 'kibitz_library')).toBe(false); expect(posts).toHaveLength(0);
  await connect(page); await expect(cards(page)).toHaveCount(0); expect(posts).toHaveLength(0); expect(await stored(page)).toBe(local);
  await submit(page); await added(page); await expect(cards(page)).toHaveCount(1); expect(posts).toHaveLength(1);
  const server = await snapshot(page); expect(server.games[0].pgn).toBe(PGN); expect(await stored(page)).toBe(local); expect(await S(page)).toEqual(before);
  const cached = await page.evaluate(async scope => {
    const { createLibraryCache } = await import('/library/cache.js'), cache = createLibraryCache(); const value = await cache.read(scope); cache.close(); return value;
  }, server.scope);
  expect(cached.snapshot.revision).toBe(server.revision); expect(cached.snapshot.games[0].pgn).toBe(PGN);
  await page.reload(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server'); await expect(cards(page)).toContainText('Server example');
  await page.locator('#libUseBrowser').click(); await expect(page.locator('#libWhere')).toHaveText('Saved in this browser only'); await expect(cards(page)).toContainText('Browser private');
  expect(await stored(page)).toBe(local); expect(posts).toHaveLength(1);
});

test('fresh offline loads cannot reveal a previous cookie owner through the cache, and a new cookie gets an empty server library', async ({ page }) => {
  await seed(page); await open(page); await connect(page); await submit(page); await added(page);
  const owner = (await snapshot(page)).scope; await page.context().clearCookies();
  await page.route('**/api/library/status', route => route.abort('internetdisconnected'));
  await page.reload(); await expect(page.locator('#libWhere')).toHaveText('Server library unavailable'); await expect(cards(page)).toHaveCount(0); await expect(page.locator('#libStorageStatus')).toContainText('Reconnect or choose');
  await page.unroute('**/api/library/status'); await page.locator('#libServerRefresh').click(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server'); await expect(cards(page)).toHaveCount(0);
  expect((await snapshot(page)).scope).not.toBe(owner);
  const retained = await page.evaluate(async scope => { const { createLibraryCache } = await import('/library/cache.js'); const cache = createLibraryCache(); const value = await cache.read(scope); cache.close(); return value; }, owner);
  expect(retained.snapshot.games[0].pgn).toBe(PGN);
});

test('a successful SQLite save reports success even when the optional IndexedDB write fails', async ({ page }) => {
  await open(page); await connect(page);
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(value, key) { if (this.name === 'snapshots') throw new DOMException('full', 'QuotaExceededError'); return key === undefined ? put.call(this, value) : put.call(this, value, key); }; });
  await submit(page); await added(page); await expect(page.locator('#importText')).toHaveValue(''); await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#libStorageStatus')).toHaveText('Saved on this server. The browser cache is unavailable.');
  expect((await snapshot(page)).games).toHaveLength(1);
  await page.reload(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server'); await expect(cards(page)).toContainText('Server example'); await expect(page.locator('#libStorageStatus')).toHaveText('');
});

test('conflicts keep source edits available without overwriting the server; refresh permits an explicit corrected retry', async ({ page }) => {
  await open(page); await connect(page); await submit(page); await added(page);
  const details = cards(page).locator('.source-details'); await details.locator('summary').click();
  const title = details.locator('[data-source-field="title"]'); await title.fill('Source correction');
  await page.route('**/api/library/records', route => route.request().method() === 'POST' ? route.fulfill({ status: 409, json: { error: { code: 'conflict' } } }) : route.continue());
  await details.getByRole('button', { name: 'Save source details', exact: true }).click();
  await expect(page.locator('#libStorageStatus')).toContainText('changed elsewhere'); await expect(title).toHaveValue('Source correction'); await expect(details).toContainText('Source details could not be saved.');
  expect((await snapshot(page)).games[0].provenance.source.title).toBe('');
  await page.unroute('**/api/library/records'); await page.locator('#libServerRefresh').click(); await expect(page.locator('#libServerRefresh')).toBeEnabled();
  await cards(page).locator('.source-details summary').click(); await cards(page).locator('[data-source-field="title"]').fill('Source correction');
  await cards(page).getByRole('button', { name: 'Save source details', exact: true }).click(); await expect(page.locator('#toast')).toHaveText('Source details saved.');
  expect((await snapshot(page)).games[0].provenance.source.title).toBe('Source correction');
});

test('an old acknowledged response cannot change the browser library after switching away during a source save', async ({ page }) => {
  await seed(page); await open(page); await connect(page); await submit(page); await added(page); const local = await stored(page);
  const details = cards(page).locator('.source-details'); await details.locator('summary').click(); await details.locator('[data-source-field="title"]').fill('Held server correction');
  let release, reached; const gate = new Promise(resolve => { release = resolve; }), committed = new Promise(resolve => { reached = resolve; });
  await page.route('**/api/library/records', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch(); reached(); await gate; await route.fulfill({ response }).catch(() => {});
  });
  await details.getByRole('button', { name: 'Save source details', exact: true }).click(); await committed;
  await page.locator('#libUseBrowser').click(); await expect(cards(page)).toContainText('Browser private'); release();
  await expect(page.locator('#libWhere')).toHaveText('Saved in this browser only'); expect(await stored(page)).toBe(local); await expect(cards(page)).toHaveCount(1);
  await page.unroute('**/api/library/records'); await connect(page); await cards(page).locator('.source-details summary').click(); await expect(cards(page).locator('[data-source-field="title"]')).toHaveValue('Held server correction');
});

test('a held delete button cannot delete an equal ID in a newly selected browser library', async ({ page }) => {
  await open(page); await connect(page); await submit(page); await added(page); const id = (await snapshot(page)).games[0].id;
  await page.evaluate(value => localStorage.setItem('kibitz.games', JSON.stringify([{ ...value, title: 'Browser collision' }])), { ...LOCAL, id });
  await cards(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await cards(page).getByRole('button', { name: 'Delete', exact: true }).evaluate(button => { window.__heldStorageDelete = button; });
  await page.locator('#libUseBrowser').click(); const local = await stored(page); await page.evaluate(() => window.__heldStorageDelete.click());
  await expect(cards(page)).toContainText('Browser collision'); expect(await stored(page)).toBe(local); expect((await snapshot(page)).games).toHaveLength(1);
});

test('a lost acknowledgement retains import text; refresh and retry deduplicate the committed game without another write', async ({ page }) => {
  await open(page); await connect(page); const posts = postCounter(page);
  await page.route('**/api/library/records', async route => {
    if (route.request().method() !== 'POST') return route.continue(); await route.fetch(); await route.abort('connectionfailed');
  });
  await submit(page); await expect(page.locator('#importMsg')).toHaveText('Could not save 1 game. Retry the import.'); await expect(page.locator('#importText')).toHaveValue(PGN); await expect(page.locator('#libWhere')).toHaveText('Cached server library (read only)');
  await page.unroute('**/api/library/records'); await page.locator('#libServerRefresh').click(); await expect(cards(page)).toHaveCount(1); await expect(page.locator('#libServerRefresh')).toBeEnabled();
  await page.locator('#btnImport').click(); await expect(page.locator('#importMsg')).toHaveText('Skipped 1 duplicate.'); await expect(page.locator('#importText')).toHaveValue(''); expect(posts).toHaveLength(1);
});

test('references save on the server, keep newly typed notes during a delayed save, and leave browser references untouched', async ({ page }) => {
  const browserBooks = [{ id: 'browser-book', title: 'Browser reference', note: 'Local', tags: ['opening'] }];
  await seed(page, [], browserBooks); await open(page); await connect(page); await loadPgn(page, '1. e4 *'); await page.locator('[data-tab="reading"]').click();
  await reveal(page, '#refTitle');
  await page.locator('#refTitle').fill('Server reference'); await page.locator('#refNote').fill('<img src=x> literal source note'); await page.locator('#refTags [data-tag="opening"]').click();
  let release, reached; const gate = new Promise(resolve => { release = resolve; }), seen = new Promise(resolve => { reached = resolve; });
  await page.route('**/api/library/records', async route => { if (route.request().method() !== 'POST') return route.continue(); reached(); await gate; await route.continue(); });
  await page.locator('#btnAddRef').click(); await seen; await page.locator('#refNote').fill('Newly typed note'); release();
  await expect(page.locator('#refMsg')).toContainText('Added.'); await expect(page.locator('#refNote')).toHaveValue('Newly typed note'); await expect(page.locator('#bookList img')).toHaveCount(0);
  expect((await snapshot(page)).books[0].note).toBe('<img src=x> literal source note');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.books')))).toEqual(browserBooks);
  await page.unroute('**/api/library/records'); await page.locator('#bookList .book').filter({ hasText: 'Server reference' }).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.locator('#bookList')).not.toContainText('Server reference'); expect((await snapshot(page)).books).toHaveLength(0);
});

test('German phone storage choices and status fit without changing the active game', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); const before = await S(page); await connect(page); await expect(page.locator('#libStoragePanel')).toContainText('keine Partien oder Referenzen kopiert');
  await expect(page.locator('#libUseBrowser')).toHaveText('Browser-Bibliothek verwenden'); await page.locator('#libStoragePanel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]); expect(await S(page)).toEqual(before);
  await page.screenshot({ path: info.outputPath('library-storage-phone.png') });
});

test('late account callbacks cannot republish another source after fallback and an explicit server selection', async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    const callbacks = {}, errors = {};
    const account = { id: 'account-private', kind: 'study', title: 'Account private', pgn: '1. e4 *', white: 'Account learner', black: 'Other' };
    const collection = name => ({
      onSnapshot(fn, error) { callbacks[name] = fn; errors[name] = error; fn({ docs: name === 'games' ? [{ id: account.id, data: () => account }] : [] }); return () => {}; },
      doc() { return { async set() {}, async delete() {} }; },
    });
    window.__loseStorageAccount = () => errors.games(new Error('fake account unavailable'));
    window.__lateStorageAccount = () => callbacks.games({ docs: [{ id: account.id, data: () => account }] });
    window.claude = { use: async name => name === 'db' ? { doc: () => ({ collection }) } : name === 'user' ? { id: async () => 'fake-account' } : null };
  });
  await open(page); await library(page); await expect(page.locator('#libWhere')).toHaveText('Saved to your account'); await expect(cards(page)).toContainText('Account private');
  await page.evaluate(() => window.__loseStorageAccount()); await expect(cards(page)).toContainText('Browser private');
  await connect(page); await submit(page); await added(page); await page.evaluate(() => window.__lateStorageAccount());
  await expect(cards(page)).toHaveCount(1); await expect(cards(page)).toContainText('Server example'); await expect(page.locator('#libList')).not.toContainText('Account private');
  expect((await snapshot(page)).games).toHaveLength(1); expect(JSON.parse(await stored(page))).toEqual([LOCAL]);
});

test('saving the board names the server destination, and owned example metadata cannot remove the ability to delete the copy', async ({ page }) => {
  await open(page); await connect(page); await loadPgn(page, '1. e4 e5 *'); await library(page); await page.locator('#btnSaveCurrent').click();
  await expect(page.locator('#toast')).toHaveText('Saved on this server'); await expect(cards(page)).toHaveCount(1);
  const before = await snapshot(page), record = { ...before.games[0], kind: 'example', title: 'Owned example copy' };
  const status = await page.evaluate(async value => (await fetch('api/library/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: value.scope, revision: value.revision, changes: [{ collection: 'games', id: value.record.id, record: value.record }] }) })).status, { ...before, record });
  expect(status).toBe(200); await page.locator('#libServerRefresh').click(); await expect(cards(page)).toContainText('Owned example copy');
  await cards(page).getByRole('button', { name: 'Delete', exact: true }).click(); await cards(page).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(cards(page)).toHaveCount(0); await expect(page.locator('#libList .game[data-collection="classic"][data-game-id="ex-opera"]')).toBeVisible();
});
