/** Explicit semantic retrieval: only selected text, current scope/model and literal source links. */
import { test, expect, open, S, openSettings, closeSettings } from './fixtures.mjs';

const PGN = '[Event "Semantic fixture"]\n\n{Central plans} 1. Nf3 {Develop a knight} Nf6 2. Ng1 Ng8 3. Nf3 {Keep the king sheltered behind pawns.} *';
const hits = page => page.locator('#studySearchResults .study-hit');
const seed = page => page.addInitScript(pgn => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'semantic', title: 'Semantic fixture', kind: 'study', white: 'A', black: 'B', pgn }])), PGN);
const library = page => page.locator('[data-tab="library"]').click();
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

/** Fake semantic geometry makes the paraphrase oracle independent of production ranking. */
async function service(page) {
  const state = { calls: [], gate: null, wrongDimensions: false, descriptor: { provider: 'mock', model: 'vectors', revision: 'v1', fingerprint: 'model-v1', scope: 'owner-a', inputVersion: 'title-text-v1', available: true, local: true, localOnly: false } };
  await page.route('**/api/ai/embeddings', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { ...state.descriptor } });
    const body = route.request().postDataJSON(); state.calls.push(body);
    const d = { ...state.descriptor }, gate = state.gate; if (gate) await gate.promise;
    await route.fulfill({ json: { vectors: body.texts.map(t => /king|monarch/i.test(t) ? [1, 0] : [0, 1]), metadata: { ...d, providerModel: 'vectors-v1', dimensions: state.wrongDimensions ? 3 : 2 } } }).catch(() => {});
  });
  return state;
}
async function setup(page, { fake = true } = {}) {
  await seed(page); const api = fake ? await service(page) : null;
  await open(page); await page.locator('#modeAnalyse').click(); await library(page);
  await page.locator('#studySource').selectOption('library'); await page.locator('#studyMethod').selectOption('dense');
  await expect(page.locator('#studyDenseBuild')).toBeEnabled(); return api;
}
async function build(page) {
  await page.locator('#studyDenseBuild').click();
  await expect(page.locator('#studyDenseMetadata')).toContainText(/3 passages|3 Textstellen/);
}
async function search(page, query = 'protect the monarch') {
  await page.locator('#studyQuery').fill(query); await page.locator('#studyDenseSearch').click();
  await expect(page.locator('#studySearchStatus')).toContainText(/study text results|Fundstellen/);
}

test('the real mock gateway builds only after a click, keeps vectors ephemeral, and reports index metadata', async ({ page }) => {
  const calls = []; page.on('request', r => { if (r.url().endsWith('/api/ai/embeddings') && r.method() === 'POST') calls.push(r.postDataJSON()); });
  await setup(page, { fake: false });
  await page.locator('#studyQuery').fill('king safety'); expect(calls).toHaveLength(0);
  await build(page); expect(calls).toHaveLength(1);
  expect(calls[0].texts).toHaveLength(3); expect(calls[0].texts.every(t => t.startsWith('Semantic fixture\n'))).toBe(true);
  await search(page, 'king'); expect(calls).toHaveLength(2);
  await page.locator('#studyDenseMetadata details').evaluate(d => { d.open = true; });
  await expect(page.locator('#studyDenseMetadata')).toContainText('8 dimensions');
  await page.reload(); await library(page); await page.locator('#studyMethod').selectOption('dense');
  await expect(page.locator('#studyDenseBuild')).toBeEnabled(); await expect(page.locator('#studyDenseSearch')).toBeDisabled();
  expect(calls).toHaveLength(2);
});

test('a paraphrase missing from keywords opens its exact later annotation, never the repeated earlier board', async ({ page }) => {
  const api = await setup(page);
  await page.locator('#studyMethod').selectOption('keyword'); await page.locator('#studyQuery').fill('protect the monarch');
  await expect(hits(page)).toHaveCount(0);
  await page.locator('#studyMethod').selectOption('dense'); await expect(page.locator('#studyDenseBuild')).toBeEnabled();
  expect(api.calls).toHaveLength(0); await build(page); await search(page);
  await expect(hits(page)).toHaveCount(1); await expect(hits(page)).toContainText('Keep the king sheltered');
  expect(api.calls[1].texts).toEqual(['protect the monarch']);
  await hits(page).getByRole('button', { name: 'Open annotated position' }).click();
  expect((await S(page)).cursor).toBe(5);
  expect(await page.evaluate(() => { const s = window.__kibitz.S; return s.comments[s.nodes[s.cursor].fen]; })).toContain('Keep the king sheltered');
});

test('language/source changes erase vectors and ingestion sends only the newly selected passages', async ({ page }) => {
  const api = await setup(page);
  await page.locator('#studySource').selectOption('guide'); await page.locator('#studyLanguage').selectOption('de');
  await expect(page.locator('#studyDenseBuild')).toBeEnabled(); await page.locator('#studyDenseBuild').click();
  await expect(page.locator('#studyDenseMetadata')).toContainText('57 passages');
  const german = api.calls.flatMap(c => c.texts); expect(german).toHaveLength(57);
  expect(german.some(t => t.includes('Französische Verteidigung'))).toBe(true);
  expect(german.some(t => t.includes('Keep the king sheltered') || t.includes('French Defence'))).toBe(false);
  await page.locator('#studySource').selectOption('library'); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
  const previous = api.calls.length; await build(page);
  expect(api.calls.slice(previous).flatMap(c => c.texts)).toHaveLength(3);
});

test('deleting a source during ingestion cancels it and late vectors cannot recreate the index', async ({ page }) => {
  const api = await setup(page), gate = api.gate = deferred();
  await page.locator('#studyDenseBuild').click(); await expect.poll(() => api.calls.length).toBe(1);
  const card = page.locator('#libList .game[data-collection="library"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click();
  gate.resolve(); api.gate = null;
  await expect(page.locator('#studyDenseMetadata')).toBeEmpty(); await expect(hits(page)).toHaveCount(0);
  await expect(page.locator('#studyDenseSearch')).toBeDisabled();
  await page.locator('#studyDenseBuild').click(); await expect(page.locator('#studySearchStatus')).toContainText('Select 1–512');
  expect(api.calls).toHaveLength(1);
});

test('typing cancels a pending query, clear cancels ingestion, and neither sends a replacement automatically', async ({ page }) => {
  const api = await setup(page); await build(page);
  const queryGate = api.gate = deferred();
  await page.locator('#studyQuery').fill('protect the monarch'); await page.locator('#studyDenseSearch').click();
  await expect.poll(() => api.calls.length).toBe(2); await page.locator('#studyQuery').fill('new query');
  queryGate.resolve(); api.gate = null;
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseSearch')).toBeEnabled();
  expect(api.calls).toHaveLength(2);
  await page.locator('#studyDenseClear').click();
  const buildGate = api.gate = deferred(); await page.locator('#studyDenseBuild').click(); await expect.poll(() => api.calls.length).toBe(3);
  await page.locator('#studyDenseCancel').click(); buildGate.resolve(); api.gate = null;
  await expect(page.locator('#studyDenseMetadata')).toBeEmpty(); await expect(page.locator('#studyDenseSearch')).toBeDisabled();
  expect(api.calls).toHaveLength(3);
});

test('owner/model changes require a new explicit build and dimension drift clears results', async ({ page }) => {
  const api = await setup(page); await build(page);
  api.descriptor.scope = 'owner-b'; api.descriptor.fingerprint = 'model-v2'; api.descriptor.model = 'vectors-v2';
  await page.locator('#studyQuery').fill('protect the monarch'); await page.locator('#studyDenseSearch').click();
  await expect(page.locator('#studySearchStatus')).toContainText('Review the provider');
  expect(api.calls).toHaveLength(1); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
  await build(page); expect(api.calls[1].scope).toBe('owner-b'); expect(api.calls[1].fingerprint).toBe('model-v2');
  api.wrongDimensions = true; await page.locator('#studyDenseSearch').click();
  await expect(page.locator('#studySearchStatus')).toContainText('Embedding request failed');
  await expect(hits(page)).toHaveCount(0); await expect(page.locator('#studyDenseMetadata')).toBeEmpty();
});

test('local-only and restricted live help purge vectors even in a closed Library tab', async ({ page }) => {
  const api = await setup(page); api.descriptor.provider = 'openai'; api.descriptor.local = false;
  await openSettings(page); await page.locator('[data-consent-provider="openai"][data-consent-purpose="embeddings"]').check(); await closeSettings(page);
  await page.locator('#studyDenseRefresh').click(); await expect(page.locator('#studyDenseBuild')).toBeEnabled(); await build(page);
  await openSettings(page); await page.locator('#optLocalOnly').check(); await closeSettings(page);
  await expect(page.locator('#studyDenseMetadata')).toBeEmpty(); await expect(page.locator('#studyDenseBuild')).toBeDisabled();
  await expect(page.locator('#studyDenseProvider')).toContainText('Local-only mode blocks');
  const count = api.calls.length; await page.locator('#studyDenseBuild').evaluate(b => b.dispatchEvent(new MouseEvent('click'))); expect(api.calls).toHaveLength(count);
  await openSettings(page); await page.locator('#optLocalOnly').uncheck(); await closeSettings(page); await build(page);
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="full"]').click(); await page.locator('#btnNewGame').click();
  await page.locator('#optHelp button[data-v="flags"]').click();
  await expect(page.locator('#studyDenseMetadata')).toBeEmpty(); await library(page); await expect(page.locator('#studySearchControls')).toBeHidden();
  await page.locator('#modeAnalyse').click(); await expect(page.locator('#studyDenseSearch')).toBeDisabled(); expect(api.calls).toHaveLength(count + 1);
});

test('German phone semantic controls and literal passages fit without untranslated interface text', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await setup(page); await build(page); await search(page);
  await expect(page.locator('#studyDenseBuild')).toHaveText('Semantischen Index aufbauen');
  await page.locator('#studyDenseMetadata details').evaluate(d => { d.open = true; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('phone.png'), fullPage: true });
});
