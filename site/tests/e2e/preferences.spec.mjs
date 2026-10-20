// Stockfish preferences: strength (Elo) and playing style.
import { test, expect, open, move } from './fixtures.mjs';

// Records every UCI command the page sends to its Stockfish workers.
const recordUci = page => page.addInitScript(() => {
  window.__uci = [];
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (m) { window.__uci.push(String(m)); return post.apply(this, arguments); };
});
// The commands of the opponent's searches: each starts with the strength setup.
const moveSearches = page => page.evaluate(() => {
  const out = []; let cur = null;
  for (const c of window.__uci) {
    if (c.startsWith('setoption name MultiPV')) cur = { multipv: +c.split(' ').pop(), setup: [] };
    else if (cur && c.startsWith('setoption')) cur.setup.push(c);
    else if (cur && c.startsWith('go')) { out.push({ ...cur, go: c }); cur = null; }
  }
  return out.filter(s => s.setup.some(x => /UCI_LimitStrength|Skill Level/.test(x)));
});

test('Elo and style are saved, survive a reload and show next to Stockfish\'s name', async ({ page }) => {
  await open(page);
  await page.locator('#optElo').fill('1800');
  await page.locator('#optElo').dispatchEvent('change');
  await page.locator('#optStyle').getByRole('button', { name: 'Aggressive' }).click();
  await expect(page.locator('#styleHint')).toContainText('checks, attacks and sacrifices');
  await expect(page.locator('#playerTop')).toContainText('≈1800 · aggressive');

  await page.reload();
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await expect(page.locator('#eloLabel')).toHaveText('1800');
  await expect(page.locator('#optStyle').getByRole('button', { name: 'Aggressive' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#playerTop')).toContainText('≈1800 · aggressive');
});

test('with a style, Stockfish is asked for candidate moves and still replies', async ({ page }) => {
  await recordUci(page);
  await open(page);
  await page.locator('#optStyle').getByRole('button', { name: 'Reckless' }).click();
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  const [s] = await moveSearches(page);
  expect(s.multipv).toBe(4);
  expect(s.setup).toContain('setoption name UCI_Elo value 1400');
});

test('balanced keeps the single-line search at club strength', async ({ page }) => {
  await recordUci(page);
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  const [s] = await moveSearches(page);
  expect(s.multipv).toBe(1);
});

test('below 1320 Elo a style still works and Stockfish replies', async ({ page }) => {
  await open(page);
  await page.locator('#optElo').fill('800');
  await page.locator('#optElo').dispatchEvent('change');
  await page.locator('#optStyle').getByRole('button', { name: 'Solid' }).click();
  await move(page, 'd2', 'd4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect(page.locator('#playerTop')).toContainText('≈800 · solid');
});
