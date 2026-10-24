import { test, expect, open, S } from './fixtures.mjs';
const START = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
const REPORT = { version: 1, engine: 'Stockfish', start: START, ucis: ['e1e2'], side: 'w', decisions: [{ ply: 1,
  before: { basis: 'engine', depth: 20, score: { cp: 500 }, pv: ['b5c7', 'e8d7', 'c7a8'] }, after: { basis: 'engine', depth: 20, score: { cp: 0 }, pv: ['a8a1'] }, phase: 'endgame',
  motif: { status: 'confirmed', proof: { tags: ['fork'], start: START, ucis: ['b5c7', 'e8d7', 'c7a8'], lossInPawns: 0, payoff: 'material gain within the continuation' } } }] };
const GAME = { id: 'review-own', kind: 'played', played: true, userColor: 'w', white: 'Learner', black: 'Opponent', title: '<img src=x> Own review',
  pgn: `[SetUp "1"]\n[FEN "${START}"]\n\n1. Ke2 *`, reviewed: true, analysisReview: REPORT };
const seed = (page, games = [GAME]) => page.addInitScript(records => { if (!localStorage.getItem('kibitz.games')) localStorage.setItem('kibitz.games', JSON.stringify(records)); }, games);
const history = page => page.locator('#reviewHistory');
async function trends(page) { await page.locator('[data-tab="review"]').click(); }
async function analysis(page) { await open(page); await page.locator('#modeAnalyse').click(); }
async function openOwn(page) { await page.locator('[data-tab="library"]').click(); await page.locator('#libList [data-game-id="review-own"]').getByRole('button', { name: /^(Open|Open review)$/ }).click(); }
async function seedEngine(page, gate = false) {
  await page.evaluate(({ start, gate }) => {
    const K = window.__kibitz, epd = fen => fen.split(' ').slice(0, 4).join(' ');
    const entry = (cp, pv) => ({ depth: 99, multipv: 5, lines: [{ score: { cp }, pv }], best: pv[0] });
    K.ANA.set(epd(start), entry(500, ['b5c7', 'e8d7', 'c7a8'])); K.ANA.set(epd(K.S.nodes[1].fen), entry(0, ['a8a1']));
    if (!gate) K.ANA.set(epd('r3k3/2N5/8/8/8/8/8/4K3 b - - 1 1'), entry(500, ['e8d7', 'c7a8']));
    else {
      const post = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function(message, ...args) { if (typeof message === 'string' && /^go /.test(message)) { window.__heldReviewSearch = true; return; } return post.call(this, message, ...args); };
    }
  }, { start: START, gate });
}

test('review trends derive from compatible own-game evidence, ignore prose/classes/studies and open the precise source position', async ({ page }) => {
  await seed(page, [GAME, { ...GAME, id: 'study-copy', kind: 'study' }, { ...GAME, id: 'legacy', analysisReview: undefined, summary: 'Missed mate!', cls: [null, 'blunder'] }]);
  const calls = []; page.on('request', r => { if (/\/api\/ai\/(?:sample|structured|embeddings)$/.test(new URL(r.url()).pathname)) calls.push(r.url()); });
  await analysis(page); await trends(page); await expect(history(page)).toContainText('Reviewed games: 1. Measured player moves: 1/2.');
  await expect(history(page)).toContainText('Fork: 1'); await expect(history(page)).toContainText('Re-run their review'); await expect(history(page).locator('img')).toHaveCount(0);
  await expect(history(page)).toContainText('1. Ke2'); await expect(history(page)).toContainText('Nc7+ Kd7 Nxa8');
  const row = history(page).locator('[data-review-phase="endgame"]'); await expect(row.locator('td').nth(0)).toHaveText('1'); await expect(row.locator('td').nth(1)).toHaveText('1'); expect(calls).toEqual([]);
  await history(page).getByRole('button', { name: 'Open reviewed opportunity' }).click();
  expect(await page.evaluate(() => window.__kibitz.S.nodes[window.__kibitz.S.cursor].fen)).toBe(START); expect((await S(page)).cursor).toBe(0);
});

test('a new real review stores bounded report evidence and a repeated review replaces its contribution', async ({ page }) => {
  await seed(page, [{ ...GAME, reviewed: false, analysisReview: undefined }]); await analysis(page); await openOwn(page); await seedEngine(page);
  await trends(page); await page.locator('#btnReview').click(); await expect(page.locator('#reviewProgress')).toBeHidden();
  await expect(history(page)).toContainText('Reviewed games: 1. Measured player moves: 1/1.'); await expect(history(page)).toContainText('Fork: 1');
  const report = await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games')).find(g => g.id === 'review-own').analysisReview);
  expect(report.decisions[0].motif.status).toBe('confirmed'); expect(report.decisions[0].motif.proof.ucis).toEqual(['b5c7', 'e8d7', 'c7a8']);
  await page.locator('#btnReview').click(); await expect(page.locator('#reviewProgress')).toBeHidden(); await expect(history(page)).toContainText('Fork: 1'); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await trends(page); await expect(history(page)).toContainText('Fork: 1');
});

test('a library change clears trends and invalidates a held source action; deleting a source removes its contribution', async ({ page }) => {
  await seed(page); await analysis(page); await trends(page); await expect(history(page)).toContainText('Fork: 1');
  await history(page).getByRole('button', { name: 'Open reviewed opportunity' }).evaluate(b => { window.__heldReview = b; });
  await page.locator('[data-tab="library"]').click(); await expect(page.locator('#libUseServer')).toBeVisible(); await page.locator('#libUseServer').click(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server');
  await trends(page); await expect(history(page)).not.toContainText('Fork: 1'); const before = await S(page); await page.evaluate(() => window.__heldReview.click()); expect(await S(page)).toEqual(before);
  await page.locator('[data-tab="library"]').click(); await page.locator('#libUseBrowser').click(); const card = page.locator('#libList [data-game-id="review-own"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click(); await trends(page); await expect(history(page)).not.toContainText('Fork: 1');
});

test('a game replacement while a tactical confirmation waits cannot publish a stale report', async ({ page }) => {
  await seed(page, [{ ...GAME, reviewed: false, analysisReview: undefined }]); await analysis(page); await openOwn(page); await seedEngine(page, true); await trends(page); await page.locator('#btnReview').click();
  await expect.poll(() => page.evaluate(() => !!window.__heldReviewSearch)).toBe(true);
  await expect(page.locator('#reviewStage')).toHaveText('Checking tactical opportunities…');
  await page.locator('#modePlay').click(); await expect(page.locator('#reviewProgress')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games')).find(g => g.id === 'review-own').analysisReview)).toBeUndefined();
});

test('future report metadata remains intact after a re-review and does not become a compatible trend', async ({ page }) => {
  const future = { version: 99, futureData: 'retain' }; await seed(page, [{ ...GAME, analysisReview: future }]); await analysis(page); await openOwn(page); await seedEngine(page); await trends(page); await page.locator('#btnReview').click(); await expect(page.locator('#reviewProgress')).toBeHidden();
  await expect(history(page)).toContainText('Some review formats are unsupported'); await expect(history(page)).not.toContainText('Fork: 1'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games')).find(g => g.id === 'review-own').analysisReview)).toEqual(future);
});

test('German phone trends retain literal source titles and keep the wide phase table within its scroll area', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await seed(page); await analysis(page); await trends(page);
  await expect(history(page)).toContainText('Entwicklung der Partieanalysen'); await expect(history(page)).toContainText('Gabel: 1'); await expect(history(page)).toContainText('<img src=x> Own review'); await expect(history(page).locator('img')).toHaveCount(0);
  await history(page).scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('review-history-phone.png') });
});
