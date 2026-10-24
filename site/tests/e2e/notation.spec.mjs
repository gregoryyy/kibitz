import { test, expect, open, openSettings, closeSettings, loadPgn, S } from './fixtures.mjs';

async function choose(page, mode) { await openSettings(page); await page.locator('#optMoveNotation').selectOption(mode); await closeSettings(page); }
async function answer(page) {
  await page.route('**/api/ai/sample', route => route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text: 'Try 1. Nf3 d5 2. g3. A square f3 stays a square. <img src=x>' }) + '\n' + JSON.stringify({ done: true }) + '\n' }));
  await page.evaluate(() => window.__kibitz.ANA.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', { depth: 99, multipv: 5, best: 'g1f3', lines: [{ score: { cp: 20 }, pv: ['g1f3', 'd7d5', 'g2g3'] }] }));
  await page.locator('#coachInput').fill('Suggest a line'); await page.locator('#coachSend').click(); await expect(page.locator('#chat .msg.coach').last()).not.toHaveClass(/thinking/);
}

test('German display updates existing score and coach links while canonical PGN, NAGs, game state and line actions keep their meaning', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. Nf3 $1 d5 2. g3'); await page.locator('#btnFirst').click(); await answer(page);
  const before = await S(page), pgn = await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));
  await choose(page, 'german'); await expect(page.locator('#moves .san-display').first()).toHaveText('Sf3'); await expect(page.locator('#moves .g').first()).toHaveText('!');
  const reply = page.locator('#chat .msg.coach').last(); await expect(reply.locator('.san.in-line').first()).toHaveText('Sf3'); await expect(reply).toContainText('A square f3 stays a square. <img src=x>'); await expect(reply.locator('img')).toHaveCount(0);
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }))).toBe(pgn); expect(pgn).toContain('Nf3');
  await reply.locator('.san.in-line').first().focus(); await page.keyboard.press('Enter'); await expect(page.locator('#scratchMoves')).toContainText('Sf3'); expect(await page.evaluate(() => window.__kibitz.scratch().ucis[0])).toBe('g1f3');
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await expect(page.locator('#moves .san-display').first()).toHaveText('Sf3');
});

test('figurines have spoken move labels, preserve check/promotion notation and can be pasted into typed move entry', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. Nf3 Nf6'); await choose(page, 'figurine');
  await expect(page.locator('#moves .san-display').first()).toHaveText('♘f3'); await expect(page.locator('#moves .san-display').first()).toHaveAttribute('aria-label', 'knight f3'); await expect(page.locator('#moves .san-display').nth(1)).toHaveText('♘f6');
  await loadPgn(page, '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n*');
  await page.locator('#moveInput').fill('a8=♘'); await page.locator('#moveInput').press('Enter'); await expect(page.locator('#moves .san-display')).toHaveText('a8=♘'); await expect(page.locator('#moves .san-display')).toHaveAttribute('aria-label', 'a8 promotes to knight');
  expect(await page.evaluate(() => window.__kibitz.S.nodes.at(-1).san)).toBe('a8=N'); expect(await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }))).toContain('a8=N');
});

test('a failed preference save retains the previous display and unreadable saved preferences remain intact until explicitly changed', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('kibitz.moveNotation', '{"future":true}'); const set = Storage.prototype.setItem; window.__blockNotation = true;
    Storage.prototype.setItem = function(key, value) { if (window.__blockNotation && key === 'kibitz.moveNotation') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, key, value); }; });
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. Nf3'); await openSettings(page); await expect(page.locator('#optMoveNotation')).toHaveValue('san');
  await page.locator('#optMoveNotation').selectOption('german'); await expect(page.locator('#optMoveNotation')).toHaveValue('san'); await expect(page.locator('#toast')).toContainText('could not be saved'); await expect(page.locator('#moves .san-display')).toHaveText('Nf3');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.moveNotation'))).toBe('{"future":true}'); await page.evaluate(() => { window.__blockNotation = false; });
  await page.locator('#optMoveNotation').selectOption('german'); await expect(page.locator('#moves .san-display')).toHaveText('Sf3'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.moveNotation')))).toBe('german');
});

test('a native cross-tab preference change repaints moves without changing either game', async ({ page, context }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. Nf3'); const before = await S(page);
  const other = await context.newPage(); await open(other); const otherBefore = await S(other); await choose(other, 'german');
  await expect(page.locator('#moves .san-display')).toHaveText('Sf3'); expect(await S(page)).toEqual(before); expect(await S(other)).toEqual(otherBefore); await other.close();
});

test('German phone move settings and figurine labels translate without overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. Nf3 Nf6');
  await openSettings(page); await expect(page.locator('label[for="optMoveNotation"]')).toHaveText('Zugdarstellung'); await page.locator('#optMoveNotation').selectOption('figurine'); await closeSettings(page);
  await expect(page.locator('#moves .san-display').first()).toHaveAttribute('aria-label', 'Springer f3'); await page.locator('#moves').screenshot({ path: info.outputPath('figurines-phone.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
