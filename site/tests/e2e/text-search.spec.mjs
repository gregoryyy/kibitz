/** @file Local text search preserves evidence locations, privacy/lifecycle and help restrictions. */
import { test, expect, open, loadPgn, reveal, S } from './fixtures.mjs';

const PGN = '[Event "Notebook"]\n\n{Initial note} 1. Nf3 {First arrival} Nf6 2. Ng1 Ng8 3. Nf3 {Second arrival needleword} *';
const openSearch = async page => { await open(page); await page.locator('#modeAnalyse').click(); };
const library = page => page.locator('[data-tab="library"]').click();
const hits = page => page.locator('#studySearchResults .study-hit');
const seed = async (page, pgn = PGN, extra = {}) => page.addInitScript(game => localStorage.setItem('kibitz.games', JSON.stringify([game])), { id: 'notes', kind: 'study', white: 'A', black: 'B', pgn, ...extra });
const query = async (page, text, source = 'library') => {
  if (await page.locator('[data-tab="library"]').getAttribute('aria-selected') !== 'true') await library(page);
  await page.locator('#studySource').selectOption(source); await page.locator('#studyQuery').fill(text);
};
const record = page => {
  const requests = []; page.on('request', r => { if (r.url().includes('/api/ai/')) requests.push(r.url()); });
  return requests;
};

/** The later note must open ply five, even though ply one has the identical EPD. */
test('imported comment search opens the exact repeated occurrence and preserves source identity on reload', async ({ page }) => {
  await openSearch(page); await library(page); await reveal(page, '#importText');
  await page.locator('#importText').fill(PGN); await page.locator('#btnImport').click();
  await expect(page.locator('#importMsg')).toContainText('Added 1 game');
  await query(page, 'Second arrival'); await expect(hits(page).first()).toContainText('Second arrival');
  await expect(hits(page).first()).toContainText('3. Nf3');
  const id = await hits(page).first().getAttribute('data-passage-id');
  await hits(page).first().getByRole('button', { name: 'Open annotated position' }).click();
  expect((await S(page)).cursor).toBe(5);
  expect(await page.evaluate(() => { const s = window.__kibitz.S; return s.comments[s.nodes[s.cursor].fen]; })).toContain('Second arrival');
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await query(page, 'Second arrival'); await expect(hits(page).first()).toHaveAttribute('data-passage-id', id);
  await query(page, 'Initial note'); await hits(page).first().getByRole('button', { name: 'Open annotated position' }).click();
  expect((await S(page)).cursor).toBe(0);
});

test('English/German authored notes work without a configured model and never issue AI requests', async ({ page }) => {
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(), status = await response.json();
    await r.fulfill({ json: { ...status, available: false, reason: 'No model configured' } });
  });
  await openSearch(page); const requests = record(page), before = await S(page);
  await query(page, 'blockade', 'guide'); await expect(hits(page).first()).toContainText('Isolated d-pawn');
  await page.locator('#studyLanguage').selectOption('de'); await page.locator('#studyQuery').fill('Isolani');
  await expect(hits(page).first()).toContainText('Isolierter d-Bauer');
  await hits(page).first().locator('summary').click(); await expect(hits(page).first()).toContainText('GPL-3.0-or-later');
  await expect(hits(page).getByRole('button', { name: 'Open annotated position' })).toHaveCount(0);
  expect(await S(page)).toEqual(before); expect(requests).toEqual([]);
});

test('SAN aliases, source/language filters and empty queries preserve literal imported text', async ({ page }) => {
  await seed(page, '[Event "<img src=x onerror=alert(1)>"]\n\n1. e4 {Qxf7+ maliciousneedle <script>alert(1)</script>} *');
  await openSearch(page); await query(page, 'Dxf7'); await expect(hits(page)).toHaveCount(1);
  await expect(hits(page)).toContainText('<img src=x onerror=alert(1)>'); await expect(hits(page)).toContainText('<script>alert(1)</script>');
  await expect(page.locator('#studySearchResults img, #studySearchResults script')).toHaveCount(0);
  await page.locator('#studySource').selectOption('guide'); await expect(hits(page)).toHaveCount(0);
  await page.locator('#studySource').selectOption('library'); await page.locator('#studyLanguage').selectOption('de');
  await expect(hits(page)).toHaveCount(1); // imported language is not guessed from its text
  await page.locator('#studySource').selectOption('classic');
  await expect(hits(page).first().locator('h4')).toHaveText('The Opera Game');
  await expect(hits(page).first()).toContainText('Paul Morphy');
  await page.locator('#studyQuery').fill('the und'); await expect(hits(page)).toHaveCount(0);
  await expect(page.locator('#studySearchStatus')).toContainText('No matching');
  await page.locator('#studyQuery').fill(''); await expect(page.locator('#studySearchStatus')).toContainText('Enter keywords');
});

test('searching leaves an open import/source draft intact', async ({ page }) => {
  await seed(page); await openSearch(page); await library(page);
  const card = page.locator('#libList .game[data-collection="library"]'); await card.locator('.source-details summary').click();
  await card.locator('[data-source-field="title"]').fill('Unsaved source correction');
  await reveal(page, '#importText'); await page.locator('#importText').fill('1. d4 {Unsaved draft} *');
  await query(page, 'needleword'); await expect(hits(page)).toHaveCount(1);
  await expect(card.locator('[data-source-field="title"]')).toHaveValue('Unsaved source correction');
  await expect(page.locator('#importText')).toHaveValue('1. d4 {Unsaved draft} *');
});

/** A delayed shared guide compilation must only combine with the current account-local notes. */
test('deletion clears results and delayed guide work cannot resurrect a deleted source or held action', async ({ page }) => {
  await seed(page); await openSearch(page); await query(page, 'needleword'); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__oldTextButton = b; });
  await page.evaluate(() => {
    const digest = SubtleCrypto.prototype.digest; window.__textDigests = [];
    SubtleCrypto.prototype.digest = async function(...args) { const result = await digest.apply(this, args); await new Promise(resolve => window.__textDigests.push(resolve)); return result; };
  });
  await page.locator('#studySource').selectOption('all'); await expect(page.locator('#studySearchStatus')).toContainText('Preparing');
  await expect.poll(() => page.evaluate(() => window.__textDigests.length)).toBe(38);
  const card = page.locator('#libList .game[data-collection="library"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click();
  const before = await S(page);
  await page.evaluate(() => { window.__textDigests.forEach(resolve => resolve()); window.__oldTextButton.click(); });
  await expect(page.locator('#studySearchStatus')).toContainText('No matching'); await expect(hits(page)).toHaveCount(0);
  expect(await S(page)).toEqual(before);
});

test('held search actions cannot leave a replacement game', async ({ page }) => {
  await seed(page); await openSearch(page); await query(page, 'needleword'); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__oldTextButton = b; });
  await loadPgn(page, '1. d4 d5'); const before = await S(page);
  await page.evaluate(() => window.__oldTextButton.click()); expect(await S(page)).toEqual(before);
});

test('all restricted live-help modes clear results even in a closed tab and reject held actions', async ({ page }) => {
  await seed(page); await openSearch(page); await page.locator('#optHelp button[data-v="full"]').click(); await page.locator('#btnNewGame').click();
  await query(page, 'needleword'); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__oldTextButton = b; });
  for (const help of ['off', 'flags', 'eval']) {
    await page.locator('[data-tab="game"]').click(); await page.locator(`#optHelp button[data-v="${help}"]`).click();
    await expect(page.locator('#studySearchControls')).toBeHidden(); await expect(page.locator('#studySearchResults')).toBeEmpty();
    const before = await S(page); await page.evaluate(() => window.__oldTextButton.click()); expect(await S(page)).toEqual(before);
  }
  await page.locator('#optHelp button[data-v="full"]').click(); await library(page); await expect(hits(page)).toHaveCount(1);
});

test('German phone search has translated controls and readable snippets without overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await openSearch(page); await query(page, 'Isolani', 'guide');
  await expect(page.locator('#studySearchTitle')).toHaveText('Studientexte durchsuchen');
  await expect(hits(page).first()).toContainText('Isolierter d-Bauer'); await expect(page.locator('#studySearchStatus')).toContainText('Fundstellen');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('phone.png'), fullPage: true });
});
