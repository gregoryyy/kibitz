/** Hybrid source identity, explicit uploads and board/filter cancellation use the real UI. */
import { test, expect, open, S, loadPgn, move } from './fixtures.mjs';

const PGN = '[Event "Hybrid fixture"]\n\n{Central plans} 1. Nf3 {First arrival: develop the knight.} Nf6 2. Ng1 Ng8 3. Nf3 {Second arrival: keep the king sheltered.} *';
const hits = page => page.locator('#studySearchResults .study-hit');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

/** Fake vectors deliberately make every passage related: literal coverage must do its own work. */
async function setup(page, fake = true) {
  await page.addInitScript(pgn => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'hybrid', title: 'Hybrid fixture', kind: 'study', white: 'A', black: 'B', pgn }])), PGN);
  const api = { calls: [], gate: null };
  page.on('request', r => { if (r.url().endsWith('/api/ai/embeddings') && r.method() === 'POST') api.calls.push(r.postDataJSON()); });
  if (fake) await page.route('**/api/ai/embeddings', async route => {
    const identity = { provider: 'mock', model: 'vectors', revision: 'v1', fingerprint: 'v1', scope: 'owner-a', inputVersion: 'title-text-v1' };
    if (route.request().method() === 'GET') return route.fulfill({ json: { ...identity, available: true, local: true } });
    const body = route.request().postDataJSON(), gate = api.gate; if (gate) await gate.promise;
    await route.fulfill({ json: { vectors: body.texts.map(() => [1, 0]), metadata: { ...identity, providerModel: 'v1', dimensions: 2 } } }).catch(() => {});
  });
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, PGN);
  await page.locator('[data-tab="library"]').click(); await page.locator('#studySource').selectOption('library');
  await page.locator('#studyMethod').selectOption('hybrid'); await expect(page.locator('#studyDenseBuild')).toBeEnabled();
  return api;
}
async function build(page) { await page.locator('#studyDenseBuild').click(); await expect(page.locator('#studyDenseMetadata')).toContainText(/3 passages|3 Textstellen/); }
async function search(page, query) { await page.locator('#studyQuery').fill(query); await page.locator('#studyDenseSearch').click(); }

test('the real mock gateway combines explicit text search and opens the precise repeated source step', async ({ page }) => {
  const api = await setup(page, false); await page.locator('#studyQuery').fill('second arrival'); expect(api.calls).toHaveLength(0);
  await build(page); await search(page, 'second arrival'); await expect(hits(page).first()).toContainText('Second arrival');
  await hits(page).first().getByText('Why this result').click(); await expect(hits(page).first()).toContainText('Found by keywords and meaning');
  expect(api.calls).toHaveLength(2); expect(api.calls[1].texts).toEqual(['second arrival']);
  await hits(page).first().getByRole('button', { name: 'Open annotated position' }).click(); expect((await S(page)).cursor).toBe(5);
});

test('all-term filtering rejects unsupported requests even when every vector is related, without implicit replacement calls', async ({ page }) => {
  const api = await setup(page); await build(page); await search(page, 'quantum knight teleportation');
  await expect(hits(page)).toHaveCount(3); await expect(hits(page).first()).toContainText('some search terms are absent');
  const n = api.calls.length; await page.locator('#studyAllTerms').check(); await expect(hits(page)).toHaveCount(0); expect(api.calls).toHaveLength(n);
  await page.locator('#studyDenseSearch').click(); await expect(page.locator('#studySearchStatus')).toContainText('No passage found containing every search term');
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseMetadata')).toContainText('3 passages');
  await search(page, 'second arrival'); await expect(hits(page)).toHaveCount(1); await expect(hits(page)).toContainText('Contains every search term');
});

test('a board step cancels a pending hybrid query while retaining source vectors and never sends the FEN to embeddings', async ({ page }) => {
  const api = await setup(page); await build(page); await page.locator('#studyBoardRelevance').check();
  const gate = api.gate = deferred(); await search(page, 'arrival'); await expect.poll(() => api.calls.length).toBe(2);
  await page.locator('#btnPrev').click(); gate.resolve(); api.gate = null;
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseSearch')).toBeEnabled();
  await expect(page.locator('#studyDenseMetadata')).toContainText('3 passages'); expect(api.calls).toHaveLength(2);
  expect(Object.keys(api.calls[1]).sort()).toEqual(['fingerprint', 'scope', 'texts']);
  await page.locator('#studyDenseSearch').click(); await expect(hits(page)).toHaveCount(3);
  await expect(hits(page).filter({ hasText: 'First arrival' })).not.toContainText('Same position, including turn and rights');
  await expect(hits(page).filter({ hasText: 'Central plans' })).toContainText('Same position, including turn and rights');
});

test('held result navigation rechecks board intent even when the game generation is unchanged', async ({ page }) => {
  await setup(page); await build(page); await page.locator('#studyBoardRelevance').check(); await search(page, 'second arrival');
  await expect(hits(page).first()).toContainText('Second arrival');
  await hits(page).first().getByRole('button', { name: 'Open annotated position' }).evaluate(b => { window.__heldHybrid = b; });
  await page.locator('#btnPrev').click(); const before = await S(page);
  await page.evaluate(() => window.__heldHybrid.click()); expect(await S(page)).toEqual(before); await expect(hits(page)).toHaveCount(0);
});

test('scratch-board changes cancel old board relevance without replacing the main game or uploading the board', async ({ page }) => {
  const api = await setup(page); await build(page); await page.locator('#studyBoardRelevance').check();
  const before = await S(page), gate = api.gate = deferred(); await search(page, 'arrival'); await expect.poll(() => api.calls.length).toBe(2);
  await page.locator('#btnWhatIf').click(); await move(page, 'e7', 'e5');
  gate.resolve(); api.gate = null;
  await expect(hits(page)).toHaveCount(0); expect((await S(page)).cursor).toBe(before.cursor);
  await expect(page.locator('#studyDenseSearch')).toBeEnabled(); expect(api.calls).toHaveLength(2);
});

test('source filtering clears pending hybrid results and vectors before late work completes', async ({ page }) => {
  const api = await setup(page); await build(page); const gate = api.gate = deferred();
  await search(page, 'arrival'); await expect.poll(() => api.calls.length).toBe(2);
  await page.locator('#studySource').selectOption('guide'); gate.resolve(); api.gate = null;
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
  await expect(page.locator('#studyDenseSearch')).toBeDisabled(); expect(api.calls).toHaveLength(2);
});

test('German phone hybrid controls, reasons and empty-filter state fit and are translated', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await setup(page); await build(page); await page.locator('#studyBoardRelevance').check(); await search(page, 'second arrival');
  await hits(page).first().getByText('Warum dieser Treffer').click(); await expect(hits(page).first()).toContainText('Gleiche Stellung');
  await page.locator('#studyAllTerms').check(); await search(page, 'quantum knight teleportation');
  await expect(page.locator('#studySearchStatus')).toContainText('Keine Textstelle mit jedem Suchbegriff gefunden');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  await page.screenshot({ path: info.outputPath('phone.png'), fullPage: true });
});
