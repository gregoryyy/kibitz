/** Fuzzy board candidates without lexical/dense filler: model responses use orthogonal vectors. */
import { test, expect, open, S, move } from './fixtures.mjs';

const ADVANCE = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 1';
const MISSING = 'rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1';
const hits = page => page.locator('#studySearchResults .study-hit');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

/** A single legally replayed source root; no text/embedding match can conceal the position path. */
async function setup(page, fen = ADVANCE) {
  const pgn = `[Event "Pawn fixture"]\n[SetUp "1"]\n[FEN "${fen}"]\n\n{Nearby source.} *`;
  await page.addInitScript(pgn => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'pawn-source', title: 'Pawn fixture', kind: 'study', white: 'A', black: 'B', pgn }])), pgn);
  const api = { calls: [], gate: null };
  await page.route('**/api/ai/embeddings', async route => {
    const identity = { provider: 'mock', model: 'vectors', revision: 'v1', fingerprint: 'v1', scope: 'owner-a', inputVersion: 'title-text-v1' };
    if (route.request().method() === 'GET') return route.fulfill({ json: { ...identity, available: true, local: true } });
    const body = route.request().postDataJSON(); api.calls.push(body); const gate = api.gate; if (gate) await gate.promise;
    await route.fulfill({ json: { vectors: body.texts.map(t => t.includes('\n') ? [1, 0] : [0, 1]), metadata: { ...identity, providerModel: 'v1', dimensions: 2 } } }).catch(() => {});
  });
  await open(page); await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="library"]').click();
  await page.locator('#studySource').selectOption('library'); await page.locator('#studyMethod').selectOption('hybrid');
  await expect(page.locator('#studyDenseBuild')).toBeEnabled(); return api;
}
async function build(page) { await page.locator('#studyDenseBuild').click(); await expect(page.locator('#studyDenseMetadata')).toContainText(/1 passages|1 Textstellen/); }
async function search(page) { await page.locator('#studyQuery').fill('analogy'); await page.locator('#studyDenseSearch').click(); }
async function enable(page) { await page.locator('#studyBoardRelevance').check(); await page.locator('#studyNearbyPawns').check(); }

test('fuzzy matching is explicit, keeps vectors and explains literal pawn-square differences before exact source navigation', async ({ page }) => {
  const api = await setup(page); await expect(page.locator('#studyNearbyPawns')).toBeDisabled();
  await build(page); await page.locator('#studyBoardRelevance').check(); await search(page);
  await expect(page.locator('#studySearchStatus')).toContainText('No related'); expect(api.calls).toHaveLength(2);
  await page.locator('#studyNearbyPawns').check(); expect(api.calls).toHaveLength(2); await expect(page.locator('#studyDenseMetadata')).toContainText('1 passages');
  await page.locator('#studyDenseSearch').click(); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByText('Why this result').click(); await expect(hits(page)).toContainText('Similar pawn structure');
  await expect(hits(page)).toContainText('Shared pawn squares: 15 of 17'); await expect(hits(page)).toContainText('♙ a2'); await expect(hits(page)).toContainText('♙ a3');
  expect(api.calls[2].texts).toEqual(['analogy']); expect(api.calls[2].texts.join('')).not.toContain('rnbq');
  await hits(page).getByRole('button', { name: 'Open annotated position' }).click();
  expect(await page.evaluate(() => { const s = window.__kibitz.S; return s.nodes[s.cursor].fen; })).toBe(ADVANCE);
});

test('changing the fuzzy option cancels late work and held actions without uploading a replacement', async ({ page }) => {
  const api = await setup(page); await build(page); await enable(page);
  const gate = api.gate = deferred(); await search(page); await expect.poll(() => api.calls.length).toBe(2);
  await page.locator('#studyNearbyPawns').uncheck(); gate.resolve(); api.gate = null;
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseSearch')).toBeEnabled(); expect(api.calls).toHaveLength(2);
  await page.locator('#studyNearbyPawns').check(); await search(page); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__oldPawnResult = b; });
  await page.locator('#studyNearbyPawns').uncheck(); const before = await S(page);
  await page.evaluate(() => window.__oldPawnResult.click()); expect(await S(page)).toEqual(before); expect(api.calls).toHaveLength(3);
});

test('restricted live help erases a closed fuzzy index and a held Search action cannot upload', async ({ page }) => {
  const api = await setup(page); await build(page); await enable(page); await search(page); await expect(hits(page)).toHaveCount(1);
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="full"]').click(); await page.locator('#btnNewGame').click();
  await page.locator('#optHelp button[data-v="flags"]').click(); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
  const n = api.calls.length; await page.locator('#studyDenseSearch').evaluate(b => b.dispatchEvent(new MouseEvent('click'))); expect(api.calls).toHaveLength(n);
  await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="library"]').click(); await expect(page.locator('#studyDenseSearch')).toBeDisabled();
});

test('source deletion clears fuzzy results and pending work cannot resurrect vectors', async ({ page }) => {
  const api = await setup(page); await build(page); await enable(page); const gate = api.gate = deferred();
  await search(page); await expect.poll(() => api.calls.length).toBe(2);
  const card = page.locator('#libList .game[data-collection="library"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click();
  gate.resolve(); api.gate = null; await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
  await expect(page.locator('#studyDenseSearch')).toBeDisabled(); expect(api.calls).toHaveLength(2);
});

test('scratch changes invalidate a fuzzy match and a turn mismatch supplies no new pawn analogy', async ({ page }) => {
  await setup(page); await build(page); await enable(page); await search(page); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__oldPawnResult = b; });
  await page.locator('#btnWhatIf').click(); await move(page, 'e2', 'e4'); const before = await S(page);
  await page.evaluate(() => window.__oldPawnResult.click()); expect(await S(page)).toEqual(before); await expect(hits(page)).toHaveCount(0);
  await search(page); await expect(page.locator('#studySearchStatus')).toContainText('No related'); await expect(hits(page)).toHaveCount(0);
});

test('German phone details translate unmatched and empty pawn-square lists without overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await setup(page, MISSING); await build(page); await enable(page); await search(page); await expect(hits(page)).toHaveCount(1);
  await hits(page).getByText('Warum dieser Treffer').click(); await expect(hits(page)).toContainText('Gemeinsame Bauernfelder: 15 von 16');
  await expect(hits(page)).toContainText('Keine'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  await page.screenshot({ path: info.outputPath('phone.png'), fullPage: true });
});
