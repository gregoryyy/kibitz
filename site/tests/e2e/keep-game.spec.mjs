// The game on the board survives a reload in the local app (TODO 1.15): the snapshot the artifact
// host takes is kept in localStorage and read back at boot.
import { test, expect, open, S, loadPgn, OPERA } from './fixtures.mjs';

const typeMove = async (page, san) => { await page.locator('#moveInput').fill(san); await page.locator('#moveInput').press('Enter'); };
const reload = async page => { await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); };

test('a reload in the middle of a game: the same game, still running, your move', async ({ page }) => {
  await open(page);
  await page.locator('#btnNewGame').click();
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2, { timeout: 30_000 });
  const before = await page.locator('#moves').textContent();
  await reload(page);
  await expect(page.locator('#moves button')).toHaveCount(2);
  expect(await page.locator('#moves').textContent()).toBe(before);
  expect(await S(page)).toMatchObject({ mode: 'play', playing: true, userColor: 'w', nodes: 3 });
  await typeMove(page, 'd4'); // and it goes on
  await expect(page.locator('#moves button')).toHaveCount(4, { timeout: 30_000 });
});

test('a timed game comes back with the times it had', async ({ page }) => {
  await open(page);
  await page.locator('#optClock button[data-v="3+2"]').click();
  await page.locator('#btnNewGame').click();
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2, { timeout: 30_000 });
  await reload(page);
  const clock = await page.evaluate(() => { const c = /** @type {any} */ (window).__kibitz.S.clock; return c && { w: c.w, b: c.b }; });
  expect(clock).not.toBeNull();
  expect(clock.w).toBeGreaterThan(170_000); // about 3 minutes plus the increment, not reset and not run down
  expect(clock.w).toBeLessThanOrEqual(182_000);
  await expect(page.locator('.clock[data-side="w"]')).toBeVisible();
});

test('saved while Stockfish was to move: after the reload it moves', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.current', JSON.stringify({ pgn: '1. e4 e5 2. Nf3', mode: 'play', playing: true, userColor: 'w', orientation: 'white' })));
  await open(page);
  await expect(page.locator('#moves button')).toHaveCount(4, { timeout: 30_000 });
  expect(await S(page)).toMatchObject({ mode: 'play', playing: true });
});

test('a loaded game comes back in analysis, at the move it was on', async ({ page }) => {
  await open(page);
  await loadPgn(page, OPERA);
  await page.locator('#btnFirst').click();
  for (let k = 0; k < 19; k++) await page.locator('#btnNext').click();
  await reload(page);
  expect(await S(page)).toMatchObject({ mode: 'analysis', cursor: 19, nodes: 34 });
  await expect(page.locator('#playerTop, #playerBottom')).toContainText(['Duke Karl / Count Isouard', 'Paul Morphy']);
});

test('an untouched start isn\'t kept: the next visit starts a new game as before', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.current'))).toBe('null');
  await reload(page);
  expect(await S(page)).toMatchObject({ mode: 'play', nodes: 1 });
});
