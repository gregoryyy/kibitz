import { test, expect, open, S, move } from './fixtures.mjs';
const FORK_FEN = 'rb2k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
const game = (id, fen, line, extra = {}) => ({ id, kind: 'study', title: id, pgn: `[SetUp "1"]\n[FEN "${fen}"]\n\n${line} *`, ...extra });
const RECORDS = [game('unsafe-fork', FORK_FEN, '1. Nc7+ Bxc7', { title: '<img src=x> Unchecked fork', tags: ['mate'], patterns: [{ tag: 'mate', status: 'rules' }] }),
  game('actual-mate', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', '1. Ra8#'),
  game('root-themes', '1K6/1P1k4/8/8/8/8/r7/5R2 w - - 0 1', '{Fork and mate are source claims.}')];
const seed = page => page.addInitScript(records => { if (!localStorage.getItem('kibitz.games')) localStorage.setItem('kibitz.games', JSON.stringify(records)); }, RECORDS);
const openAnalysis = async page => { await open(page); await page.locator('#modeAnalyse').click(); };
async function browse(page, tag = 'fork', locked = false) {
  await page.locator('[data-tab="library"]').click(); await page.locator('#patternSearch').evaluate(d => { d.open = true; });
  if (locked) return;
  await page.locator('#patternCollection').selectOption('library'); await page.locator('#patternTag').selectOption(tag);
  await expect(page.locator('[data-pattern="message"]')).not.toHaveText('Indexing source patterns…');
}
const hit = (page, id) => page.locator(`#patternSearch article[data-game-id="${id}"]`);

test('local pattern browsing separates geometric candidates from rules facts, ignores claims and opens the exact recorded occurrence', async ({ page }) => {
  await seed(page); const calls = []; page.on('request', r => { if (/\/api\/ai\/(?:sample|structured|embeddings)$/.test(new URL(r.url()).pathname)) calls.push(r.url()); });
  await openAnalysis(page); await browse(page); const before = await S(page), saved = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await expect(hit(page, 'unsafe-fork')).toContainText('Pattern candidate; payoff unverified'); await expect(hit(page, 'unsafe-fork')).toContainText('<img src=x>');
  await expect(page.locator('#patternSearch img')).toHaveCount(0); await expect(hit(page, 'root-themes')).toHaveCount(0);
  await page.locator('#patternStatus').selectOption('rules'); await expect(page.locator('#patternSearch article')).toHaveCount(0);
  await page.locator('#patternTag').selectOption('mate'); await expect(hit(page, 'actual-mate')).toContainText('Rules-checked fact'); await expect(hit(page, 'unsafe-fork')).toHaveCount(0);
  await page.locator('#patternStatus').selectOption('heuristic'); await page.locator('#patternTag').selectOption('rook-pawn-vs-rook');
  await expect(hit(page, 'root-themes')).toContainText('Position heuristic; plan unverified');
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(saved); expect(calls).toEqual([]);
  await page.locator('#patternStatus').selectOption('candidate'); await page.locator('#patternTag').selectOption('fork');
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).click();
  await expect.poll(() => page.evaluate(() => window.__kibitz.S.cursor)).toBe(1);
  expect(await page.evaluate(() => window.__kibitz.S.nodes[1].fen)).toBe('rb2k3/2N5/8/8/8/8/8/4K3 b - - 1 1'); expect(calls).toEqual([]);
});

test('source combinations retain their three recorded plies; root themes and revised pattern IDs survive reload without stale entries', async ({ page }) => {
  await seed(page); await page.addInitScript(() => {
    const games = JSON.parse(localStorage.getItem('kibitz.games'));
    if (!games.some(g => g.id === 'combination')) games.push({ id: 'combination', kind: 'study', title: 'Combination', pgn: '[SetUp "1"]\n[FEN "3r3k/8/8/8/3q4/8/8/2RR3K w - - 0 1"]\n\n1. Rc8 Rxc8 2. Rxd4 *' });
    localStorage.setItem('kibitz.games', JSON.stringify(games));
  });
  await openAnalysis(page); await browse(page, 'overloading'); await expect(hit(page, 'combination')).toContainText('1. Rc8 1… Rxc8 2. Rxd4');
  const old = await hit(page, 'combination').getAttribute('data-pattern-id');
  await page.evaluate(() => { const games = JSON.parse(localStorage.getItem('kibitz.games')); games.find(g => g.id === 'combination').pgn += ' {A new note.}'; localStorage.setItem('kibitz.games', JSON.stringify(games)); });
  await page.reload(); await browse(page, 'overloading'); await expect(hit(page, 'combination')).not.toHaveAttribute('data-pattern-id', old);
  const evidence = await page.evaluate(() => [...window.__kibitz.patternIndex().byTag.values()].flat().find(h => h.g.id === 'combination' && h.pattern.tag === 'overloading'));
  expect(evidence.pattern.ucis).toEqual(['c1c8', 'd8c8', 'd1d4']); expect(evidence.pattern.fens).toHaveLength(4); expect(evidence.pattern.occurrenceId).toBe(evidence.p.id);
});

test('a deleted source cannot be opened through a held pattern action', async ({ page }) => {
  await seed(page); await openAnalysis(page); await browse(page);
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).evaluate(b => { window.__heldPattern = b; });
  const card = page.locator('#libList [data-game-id="unsafe-fork"][data-collection="library"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(hit(page, 'unsafe-fork')).toHaveCount(0); const before = await S(page);
  await page.evaluate(() => window.__heldPattern.click()); expect(await S(page)).toEqual(before);
  expect(await page.evaluate(() => [...window.__kibitz.patternIndex().byTag.values()].flat().some(h => h.g.id === 'unsafe-fork' && h.g.collection === 'library'))).toBe(false);
});

test('changing library storage clears personal pattern buckets and rejects actions from the previous context', async ({ page }) => {
  await seed(page); await openAnalysis(page); await browse(page);
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).evaluate(b => { window.__heldPattern = b; });
  await expect(page.locator('#libUseServer')).toBeVisible(); await page.locator('#libUseServer').click();
  await expect(page.locator('#libWhere')).toHaveText('Saved on this server'); await expect(page.locator('[data-pattern="message"]')).toHaveText('No matching source patterns.');
  const before = await S(page); await page.evaluate(() => window.__heldPattern.click()); expect(await S(page)).toEqual(before);
  expect(await page.evaluate(() => [...window.__kibitz.patternIndex().byTag.values()].flat().some(h => h.g.collection === 'library'))).toBe(false);
  await page.locator('#libUseBrowser').click(); await expect(hit(page, 'unsafe-fork')).toBeVisible();
});

test('live help hides patterns, held actions recheck policy and full-help navigation uses the existing confirmation and return path', async ({ page }) => {
  await seed(page); await openAnalysis(page); await browse(page);
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).evaluate(b => { window.__heldPattern = b; });
  await page.locator('[data-tab="game"]').click(); await page.locator('#optColor [data-v="w"]').click(); await page.locator('#optHelp [data-v="off"]').click(); await page.locator('#btnNewGame').click();
  await move(page, 'e2', 'e4'); await expect.poll(() => page.evaluate(() => window.__kibitz.S.thinking)).toBe(false);
  const before = await S(page); await page.evaluate(() => window.__heldPattern.click()); expect(await S(page)).toEqual(before);
  await browse(page, 'fork', true); await expect(page.locator('[data-pattern="locked"]')).toBeVisible(); await expect(page.locator('#patternSearch article')).toHaveCount(0);
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp [data-v="full"]').click(); await browse(page);
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).click(); await expect(page.locator('#confirmSlot')).toBeVisible();
  await page.locator('#confirmSlot').getByRole('button', { name: 'Cancel' }).click(); expect((await S(page)).playing).toBe(true);
  await hit(page, 'unsafe-fork').getByRole('button', { name: 'Open source position' }).click(); await page.locator('#confirmSlot').getByRole('button', { name: 'Open game' }).click();
  await expect.poll(() => page.evaluate(() => window.__kibitz.S.cursor)).toBe(1); expect((await S(page)).playing).toBe(false);
  await page.locator('#chatReturn').click(); expect((await S(page)).playing).toBe(true); expect((await S(page)).nodes).toBe(before.nodes);
});

test('German phone pattern controls wrap, evidence classes translate and source titles remain literal', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await seed(page); await openAnalysis(page); await browse(page);
  await expect(page.locator('#patternSearch summary')).toHaveText('Erkannte Muster suchen'); await expect(hit(page, 'unsafe-fork')).toContainText('Musterkandidat; Nutzen ungeprüft');
  await expect(hit(page, 'unsafe-fork')).toContainText('<img src=x> Unchecked fork'); await expect(hit(page, 'unsafe-fork').getByRole('button', { name: 'Quellenstellung öffnen' })).toBeVisible();
  await page.locator('#patternSearch').scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('patterns-phone.png') });
});
