import { test, expect, open, loadPgn, S, reveal } from './fixtures.mjs';

const record = (id, moves, result = '*', extra = {}) => ({ id, kind: 'study', white: `White ${id}`, black: `Black ${id}`, result, pgn: `[White "White ${id}"]\n[Black "Black ${id}"]\n[Result "${result}"]\n\n${moves} ${result}`, updatedAt: 1, ...extra });
const seed = async (page, games) => page.addInitScript(games => { localStorage.setItem('kibitz.games', JSON.stringify(games)); }, games);
const explorer = async page => { await page.locator('[data-tab="openings"]').click(); await page.locator('#explorerSource').selectOption('library'); };
const row = (page, uci) => page.locator(`.explorer-move[data-uci="${uci}"]`);
const pgn = page => page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));

test('reference counts/results follow scratch continuations and backtracking, leaving the game/library intact', async ({ page }) => {
  await seed(page, [record('a', '1. e4 e5 2. Nf3 Nc6', '1-0'), record('b', '1. e4 c5', '0-1'), record('c', '1. e4 e6', '1/2-1/2'), record('u', '1. e4'), record('d', '1. d4 d5', '1-0'), record('bad', '1. e4 e5 2. Bh6')]);
  await open(page); await page.locator('#modeAnalyse').click(); await explorer(page);
  await expect(page.locator('#explorerSummary')).toHaveText('5 reference game records · 5 reached this position');
  await expect(row(page, 'e2e4')).toContainText('4 game records · 80%');
  await expect(row(page, 'e2e4').locator('.explorer-result')).toHaveText('1 / 1 / 1');
  await expect(row(page, 'e2e4')).toContainText('Unknown results: 1.');
  const before = await pgn(page), library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await row(page, 'e2e4').locator('.explorer-play').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#explorerPosition')).toHaveText('Black to move · move 1');
  await expect(page.locator('#explorerBody')).toContainText('Records ending here: 1.');
  await expect(row(page, 'e7e5')).toContainText('33.3% of continuations');
  await row(page, 'e7e5').locator('.explorer-play').click();
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4', 'e5']);
  expect((await S(page)).nodes).toBe(1);
  expect(await pgn(page)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
  await page.locator('#scratchPrev').click(); await page.locator('#scratchPrev').click();
  await expect(row(page, 'e2e4')).toContainText('80%');
  await page.locator('#scratchClose').click();
  await expect(page.locator('#scratchBar')).toBeHidden();
  expect(await pgn(page)).toBe(before);
});

test('transpositions share continuations and sample games open at the matching occurrence', async ({ page }) => {
  await seed(page, [record('a', '1. Nf3 d5 2. g3 Nf6 3. Bg2'), record('b', '1. g3 d5 2. Nf3 Nf6 3. c4')]);
  await open(page); await loadPgn(page, '1. g3 d5 2. Nf3 Nf6'); await explorer(page);
  await expect(page.locator('#explorerSummary')).toContainText('2 reached this position');
  await expect(page.locator('.explorer-play')).toHaveText(['c4', 'Bg2']);
  const library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await row(page, 'f1g2').locator('summary').click();
  await row(page, 'f1g2').locator('.explorer-examples button').click();
  expect(await S(page)).toMatchObject({ cursor: 5, mode: 'analysis' });
  expect(await page.evaluate(() => window.__kibitz.S.gameId)).toBe('a');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
});

test('restricted help exposes no continuations; Full help explores without making a live move', async ({ page }) => {
  await seed(page, [record('a', '1. e4 e5')]); await open(page);
  for (const help of ['off', 'flags', 'eval']) {
    await page.locator('[data-tab="game"]').click();
    await page.locator(`#optHelp button[data-v="${help}"]`).click();
    await page.locator('[data-tab="openings"]').click();
    await expect(page.locator('#explorerLocked')).toBeVisible();
    await expect(page.locator('#explorerBody')).toBeEmpty();
  }
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="full"]').click();
  await explorer(page);
  await row(page, 'e2e4').locator('.explorer-play').click();
  expect(await S(page)).toMatchObject({ playing: true, nodes: 1 });
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="off"]').click();
  await expect(page.locator('#explorerBody')).toBeEmpty();
  await page.locator('[data-tab="openings"]').click();
  await expect(page.locator('.explorer-play')).toHaveCount(0);
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('#explorerLocked')).toBeHidden();
  await expect(row(page, 'e7e5')).toBeVisible();
  await page.locator('#scratchClose').click();
  await expect(row(page, 'e2e4')).toBeVisible();
});

test('library imports refresh the explorer, and hostile metadata remains text', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await explorer(page);
  await expect(page.locator('#explorerSummary')).toContainText('0 reference game records');
  await page.locator('[data-tab="library"]').click(); await reveal(page, '#importText');
  await page.locator('#importText').fill('[White "<img src=x onerror=alert(1)>"]\n[Black "Other"]\n[Result "1-0"]\n\n1. d4 d5 1-0');
  await page.locator('#btnImport').click(); await expect(page.locator('#importMsg')).toContainText('Added 1 game');
  await explorer(page);
  await expect(row(page, 'd2d4')).toContainText('1 game record');
  await row(page, 'd2d4').locator('summary').click();
  await expect(page.locator('.explorer-examples button')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#explorerBody img')).toHaveCount(0);
  await page.locator('#explorerSource').selectOption('classic');
  await expect(page.locator('#explorerSummary')).toHaveText('9 reference game records · 9 reached this position');
  await page.locator('[data-tab="library"]').click();
  await page.locator('#libList').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('#libList').getByRole('button', { name: 'Delete', exact: true }).click();
  await explorer(page);
  await expect(page.locator('#explorerSummary')).toContainText('0 reference game records');
  await expect(page.locator('.explorer-play')).toHaveCount(0);
});

test('opening a sample during play asks first, keeps a return path and never saves the running game', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.locator('#optHelp button[data-v="full"]').click();
  await page.locator('#moveInput').fill('e4'); await page.locator('#moveInput').press('Enter');
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
  await expect.poll(async () => (await S(page)).thinking).toBe(false);
  const live = await pgn(page);
  const sample = await page.evaluate(async () => {
    const { Chess } = await import('/chess.js'); const c = new Chess();
    c.loadPgn(window.__kibitz.toPGN({ annotate: false })); c.move(c.moves()[0]);
    return c.pgn();
  });
  await page.locator('[data-tab="library"]').click(); await reveal(page, '#importText');
  await page.locator('#importText').fill(sample); await page.locator('#btnImport').click();
  await expect(page.locator('#importMsg')).toContainText('Added 1 game');
  const library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await explorer(page); await page.locator('.explorer-move summary').click();
  await page.locator('.explorer-examples button').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  await expect(page.locator('#chatConfirm').getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await expect(page.locator('#chatConfirm').getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
  await page.locator('#chatConfirm').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await S(page)).playing).toBe(true); expect(await pgn(page)).toBe(live);
  await page.locator('.explorer-examples button').click();
  await page.locator('#chatConfirm').getByRole('button', { name: 'Leave and analyse' }).click();
  await expect.poll(async () => (await S(page)).mode).toBe('analysis');
  expect((await S(page)).cursor).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
  await page.locator('#boardReturn').click();
  await expect.poll(async () => (await S(page)).playing).toBe(true);
  expect(await pgn(page)).toBe(live);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
});

test('the German explorer works on a phone without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { localStorage.setItem('kibitz.lang', JSON.stringify('de')); });
  await seed(page, [record('a', '1. e4 e5', '1-0')]); await open(page);
  await page.locator('#modeAnalyse').click(); await explorer(page);
  await expect(page.locator('#pane-openings h2')).toHaveText('Eröffnungsexplorer');
  await expect(page.locator('#explorerSummary')).toContainText('1 Referenzpartieeintrag');
  await row(page, 'e2e4').locator('.explorer-play').click();
  await expect(page.locator('#explorerPosition')).toHaveText('Schwarz am Zug · Zug 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
