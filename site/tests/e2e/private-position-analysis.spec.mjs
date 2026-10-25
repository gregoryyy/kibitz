import { test, expect, open, loadPgn, move, S } from './fixtures.mjs';

const FEN = '4k3/8/8/8/3P4/8/8/4K3 b - - 7 23';
const tab = page => page.locator('[data-tab="reading"]').click();
const scratch = page => page.evaluate(() => window.__kibitz.scratch());
const score = page => page.evaluate(() => ({
  pgn: window.__kibitz.toPGN(), gen: window.__kibitz.S.gen, cursor: window.__kibitz.S.cursor,
  nodes: window.__kibitz.S.nodes.map(({ fen, san, uci }) => ({ fen, san, uci })),
}));
const hasPosition = value => {
  try { value = decodeURIComponent(value); } catch {}
  return value.includes(FEN.split(' ')[0]) || value.includes(FEN.replaceAll(' ', '_'));
};

test('Reading explores a private position with local Stockfish without position URLs, navigation, referrers or provider calls', async ({ page, context }) => {
  const requests = [], popups = [], logs = [];
  page.on('request', request => requests.push({ method: request.method(), url: request.url(), referrer: request.headers().referer || '' }));
  page.on('console', message => { if (message.type() === 'error') logs.push(message.text()); });
  context.on('page', popup => { if (popup !== page) popups.push(popup); });
  await open(page); await loadPgn(page, FEN); await tab(page);
  const anchors = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.href));
  expect(anchors.filter(hasPosition)).toEqual([]); // Fails on the previous position-bearing Lichess href.
  const before = await score(page), url = page.url(), history = await page.evaluate(() => window.history.length);
  await page.locator('#readingExplore').click(); await expect(page.locator('#scratchBar')).toBeVisible();
  expect((await scratch(page)).start).toBe(FEN); expect((await scratch(page)).free).toBe(true);
  await move(page, 'e8', 'e7'); expect((await scratch(page)).ucis).toEqual(['e8e7']);
  await expect(page.locator('#scratchEval')).not.toBeEmpty();
  expect(await score(page)).toEqual(before);
  await page.locator('#scratchClose').click(); await expect(page.locator('#scratchBar')).toBeHidden();
  expect(await score(page)).toEqual(before); expect(page.url()).toBe(url);
  expect(await page.evaluate(() => window.history.length)).toBe(history); expect(popups).toEqual([]);
  expect(requests.filter(request => hasPosition(request.url) || hasPosition(request.referrer))).toEqual([]);
  expect(requests.filter(request => new URL(request.url).origin !== new URL(url).origin)).toEqual([]);
  expect(requests.filter(request => request.method === 'POST' && /\/api\/ai\/(sample|structured|test|embeddings)$/.test(new URL(request.url).pathname))).toEqual([]);
  expect(logs.filter(hasPosition)).toEqual([]);
});

test('restricted live help and retained actions cannot open local analysis for a hidden or replacement position', async ({ page }) => {
  await open(page); await page.locator('#optHelp button[data-v="full"]').click(); await page.locator('#btnNewGame').click(); await tab(page);
  expect((await S(page)).playing).toBe(true);
  await page.locator('#readingExplore').evaluate(button => { window.__heldReadingExplore = button.onclick; });
  for (const help of ['flags', 'eval', 'off']) {
    await page.locator('[data-tab="game"]').click(); await page.locator(`#optHelp button[data-v="${help}"]`).click();
    await page.evaluate(() => window.__heldReadingExplore()); expect(await scratch(page)).toBeNull();
    await tab(page); await expect(page.locator('#readingExplore')).toBeDisabled();
    await page.evaluate(() => window.__heldReadingExplore()); expect(await scratch(page)).toBeNull();
    expect((await S(page)).playing).toBe(true);
  }
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="full"]').click(); await tab(page);
  await page.locator('#readingExplore').evaluate(button => { window.__heldReadingExplore = button.onclick; });
  await loadPgn(page, FEN); await tab(page); const before = await score(page);
  await page.evaluate(() => window.__heldReadingExplore()); expect(await scratch(page)).toBeNull(); expect(await score(page)).toEqual(before);
  await page.locator('#readingExplore').click(); expect((await scratch(page)).start).toBe(FEN);
});

test('engine startup failure keeps the analysis handoff local with no external fallback or position in diagnostics', async ({ page }) => {
  const requests = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(/\/sf(-mt|-asm)?\.js$/, route => route.abort());
  await page.goto('/?debug'); await expect(page.locator('#engineText')).toHaveText('Stockfish failed to start');
  await loadPgn(page, FEN); await tab(page); await page.locator('#readingExplore').click();
  await expect(page.locator('#scratchBar')).toBeVisible(); expect((await scratch(page)).start).toBe(FEN);
  expect(requests.some(hasPosition)).toBe(false); expect(errors.some(hasPosition)).toBe(false);
  expect(requests.filter(url => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
});

test('German phone Reading provides keyboard local analysis without translation gaps or horizontal overflow', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await page.setViewportSize({ width: 390, height: 844 });
  await open(page); await loadPgn(page, FEN); await tab(page);
  await expect(page.locator('#readingExplore')).toHaveText('Hier analysieren');
  await expect(page.locator('#readingExploreHint')).toContainText('auf dieser Seite');
  await page.locator('#readingExplore').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#scratchBar')).toBeVisible(); await expect(page.locator('#scratchClose')).toBeFocused();
  expect((await scratch(page)).start).toBe(FEN);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
