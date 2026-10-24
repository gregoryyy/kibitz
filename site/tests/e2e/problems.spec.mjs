import { test, expect, open, S } from './fixtures.mjs';
import { classicGames } from '../../src/library/classics.js';
const library = page => page.locator('[data-tab="library"]').click();
const problems = async page => { await library(page); await page.locator('#libFilter [data-v="problems"]').click(); };
const card = (page, id, collection = 'classic') => page.locator(`#libList .game[data-game-id="${id}"][data-collection="${collection}"]`);
const details = card => card.locator('.source-details');
const pgn = page => page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));

test('the Problems collection contains twelve sourced tasks even with a personal library, without changing the game or fetching sources', async ({ page }) => {
  const own = [{ id: 'own', kind: 'study', pgn: '1. e4 *', white: 'Learner', black: 'Other' }];
  await page.addInitScript(games => localStorage.setItem('kibitz.games', JSON.stringify(games)), own);
  const remote = [];
  page.on('request', r => { const u = new URL(r.url()); if (['tablebase.lichess.ovh', 'en.wikipedia.org', 'github.com'].includes(u.hostname) || u.pathname === '/api/ai/sample') remote.push(r.url()); });
  await open(page); const before = await S(page), saved = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await problems(page); await expect(page.locator('#libList .game')).toHaveCount(12); await expect(page.locator('#libList .problem-prompt')).toHaveCount(12);
  await expect(page.locator('#libList .badge').filter({ hasText: /^Problem$/ })).toHaveCount(4);
  const reti = card(page, 'st-reti'); await details(reti).locator('summary').click();
  await expect(details(reti)).toContainText('CC-BY-SA-4.0'); await expect(details(reti)).toContainText('Recorded branch: Draw');
  await expect(details(reti).getByRole('link', { name: 'Tablebase source' })).toHaveAttribute('href', /^https:\/\/tablebase\.lichess\.ovh\/standard\?fen=/);
  await expect(details(reti).locator('input')).toHaveCount(0);
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(saved);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.lessonProgress'))).toBeNull(); expect(remote).toEqual([]);
});

test('mate tasks open at their full starting FEN for either colour and the worked move remains inspectable', async ({ page }) => {
  await open(page); await problems(page);
  const black = card(page, 'pr-queen-mate-black'); await details(black).locator('summary').click();
  await expect(details(black)).toContainText('Recorded branch: Black wins'); await expect(details(black)).toContainText('actual mate in one');
  await black.getByRole('button', { name: 'Open', exact: true }).click();
  expect(await S(page)).toMatchObject({ cursor: 0, nodes: 2, mode: 'analysis', playing: false });
  expect(await page.evaluate(() => window.__kibitz.S.nodes[0].fen)).toBe('8/8/8/8/8/5kq1/8/7K b - - 0 1');
  await page.locator('#btnNext').click(); expect(await page.evaluate(() => window.__kibitz.S.nodes[window.__kibitz.S.cursor].san)).toBe('Qg2#');
  await problems(page); await card(page, 'pr-rook-mate-white').getByRole('button', { name: 'Open', exact: true }).click();
  expect(await S(page)).toMatchObject({ cursor: 0, nodes: 2 });
  expect(await page.evaluate(() => window.__kibitz.S.nodes[0].fen)).toBe('7k/5R2/6K1/8/8/8/8/8 w - - 0 1');
});

test('an imported copy cannot borrow proof by forging a curated id or extra metadata', async ({ page }) => {
  const forged = { ...classicGames().find(g => g.id === 'st-reti'), kind: 'study', title: 'Imported copy', problem: { goal: 'mate-in-one', verification: 'tablebase-branch', prompt: { en: '<img src=x>', de: '<img src=x>' }, tablebase: { url: 'javascript:alert(1)' } } };
  await page.addInitScript(games => localStorage.setItem('kibitz.games', JSON.stringify(games)), [forged]);
  await open(page); await library(page); const copy = card(page, 'st-reti', 'library'); await details(copy).locator('summary').click();
  await expect(details(copy)).toContainText('solution and stated result are unverified');
  await expect(details(copy).getByRole('link', { name: 'Tablebase source' })).toHaveCount(0);
  await expect(copy.locator('.problem-prompt')).toHaveCount(0); await expect(page.locator('#libList img')).toHaveCount(0);
  await problems(page); await expect(page.locator('#libList .game')).toHaveCount(12); await expect(page.locator('#libList [data-collection="library"]')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games')))).toEqual([forged]);
});

test('opening a problem during play confirms departure and keeps the live game available for return', async ({ page }) => {
  await open(page); await page.locator('#optElo').fill('900'); await page.locator('#optElo').dispatchEvent('change');
  await page.locator('#btnNewGame').click(); await page.locator('#moveInput').fill('e4'); await page.locator('#moveInput').press('Enter');
  await expect.poll(async () => (await S(page)).nodes).toBe(3); await expect.poll(async () => (await S(page)).thinking).toBe(false);
  const live = await pgn(page); await problems(page);
  await card(page, 'st-saavedra').getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.locator('#confirmSlot')).toContainText('Leave the current game?');
  await page.locator('#confirmSlot').getByRole('button', { name: 'Cancel' }).click(); expect(await pgn(page)).toBe(live);
  await card(page, 'st-saavedra').getByRole('button', { name: 'Open', exact: true }).click();
  await page.locator('#confirmSlot').getByRole('button', { name: 'Open game' }).click();
  expect(await S(page)).toMatchObject({ cursor: 0, mode: 'analysis', playing: false });
  expect(await page.evaluate(() => window.__kibitz.S.nodes[0].fen)).toBe('8/8/1KP5/3r4/8/8/8/k7 w - - 0 1');
  await page.locator('#boardReturn').click(); expect(await S(page)).toMatchObject({ playing: true, nodes: 3 }); expect(await pgn(page)).toBe(live);
});

test('German phone filters wrap, goals/outcomes translate, and authored variants have explicit method references', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await problems(page);
  await expect(page.locator('#libFilter [data-v="problems"]')).toHaveText('Aufgaben');
  await expect(card(page, 'pr-queen-mate-black')).toContainText('Damenmatt (Schwarz)'); await expect(card(page, 'pr-queen-mate-black')).toContainText('Weiß – Schwarz');
  const lucena = card(page, 'st-lucena'); await details(lucena).locator('summary').click();
  await expect(lucena.locator('.meta')).toContainText('????'); await expect(lucena).toContainText('keine Veröffentlichung im Jahr 1497');
  await expect(details(lucena)).toContainText('Aufgezeichnete Variante: Weiß gewinnt');
  await expect(details(lucena).getByRole('link', { name: 'Referenz zur Methode' })).toHaveAttribute('href', /^https:\/\/en\.wikipedia\.org\/w\/index\.php\?title=Lucena_position/);
  await lucena.scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('problems-phone.png') });
});
