import { test, expect, open, S, loadPgn, OPERA } from './fixtures.mjs';
import { CLASSICS } from '../../src/library/classics.js';
const library = page => page.locator('[data-tab="library"]').click();
const card = (page, id) => page.locator(`#libList .game[data-game-id="${id}"][data-collection="classic"]`);

test('the expanded collection opens exact published scores with separate source/annotation licences and no source download', async ({ page }) => {
  const remote = [], ai = [];
  page.on('request', r => { const url = new URL(r.url()); if (['www.gutenberg.org', 'en.wikipedia.org', 'de.wikipedia.org'].includes(url.hostname)) remote.push(r.url()); if (url.pathname === '/api/ai/sample') ai.push(r.url()); });
  await open(page); await library(page);
  await expect(page.locator('#libList .game')).toHaveCount(CLASSICS.length);
  await expect(page.locator('#libList .game[data-game-id^="cf-"]')).toHaveCount(12);
  const game = card(page, 'cf-12'), details = game.locator('.source-details'); await details.locator('summary').click();
  await expect(details).toContainText('Chess Fundamentals (1921), game 12, p. 225');
  await expect(details).toContainText('Public domain (USA; 1921 score)'); await expect(details).toContainText('GPL-3.0-or-later');
  await expect(details.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', 'https://www.gutenberg.org/cache/epub/33870/pg33870-images.html#page225');
  await expect(details.locator('input')).toHaveCount(0);
  await game.getByRole('button', { name: 'Open', exact: true }).click();
  expect(await S(page)).toMatchObject({ mode: 'analysis', nodes: 90, cursor: 89, playing: false });
  expect(await page.evaluate(() => window.__kibitz.S.nodes.at(-1).fen)).toBe('4r1k1/p2R1pq1/1p5p/2p1NQ1P/P1P2K2/1P6/5P2/8 b - - 2 45');
  expect(await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }))).toContain('White’s king reaches f4 with both queens still present.');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBeNull(); expect(remote).toEqual([]); expect(ai).toEqual([]);
});

test('traditional versions disclose uncertain history and the extra Réti mate plies stay a labelled teaching continuation', async ({ page }) => {
  await open(page); await library(page);
  const reti = card(page, 'cl-reti-tartakower'), legal = card(page, 'cl-legal');
  await expect(reti).toContainText('The published game ended after 10.Bg5+. The final two plies show a teaching continuation.');
  await expect(legal).toContainText('Traditional teaching version. The historical date, move order and rook odds are disputed.');
  await expect(legal.locator('.meta')).toContainText('????'); await expect(legal.locator('.meta')).not.toContainText('1750');
  await reti.locator('.source-details summary').click();
  await expect(reti.locator('.source-details')).toContainText('CC-BY-SA-4.0');
  await expect(reti.getByRole('link', { name: 'Open source' })).toHaveAttribute('href', /oldid=248632842$/);
  await reti.getByRole('button', { name: 'Open', exact: true }).click(); expect(await S(page)).toMatchObject({ cursor: 21, nodes: 22 });
  const pgn = await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));
  expect(pgn).toContain('published game ended here with Black resigning'); expect(pgn).toContain('teaching continuation'); expect(pgn).toContain('Bd8#');
  await library(page); await legal.getByRole('button', { name: 'Open', exact: true }).click();
  expect(await page.evaluate(() => window.__kibitz.S.nodes.slice(1, 6).map(n => n.san))).toEqual(['e4', 'e5', 'Nf3', 'd6', 'Bc4']);
});

test('German phone source distinctions and new titles translate and fit while source metadata stays literal', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await library(page);
  await expect(card(page, 'cf-10')).toContainText('Capablanca–Marshall, St. Petersburg 1914');
  const reti = card(page, 'cl-reti-tartakower'); await expect(reti).toContainText('Die letzten beiden Halbzüge zeigen eine Lehrfortsetzung.');
  await reti.locator('.source-details summary').click(); await reti.scrollIntoViewIfNeeded();
  await expect(reti.locator('.source-details')).toContainText('Wikipedia contributors');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('classic-source-phone.png') });
  await loadPgn(page, OPERA); await page.locator('[data-tab="reading"]').click();
  await expect(page.locator('#classicList .k').filter({ hasText: 'Freibauer' }).first()).toContainText('1.e4 e5 offene Spiele');
  await expect(page.locator('#classicList')).not.toContainText('Passed pawn');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
