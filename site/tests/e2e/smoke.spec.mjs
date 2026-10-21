// The main flows work end to end (replaces the old tests/e2e.py).
import { test, expect, open, move, S } from './fixtures.mjs';

test('play a move, Stockfish replies, resign and review', async ({ page }) => {
  await open(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('#btnResign').click();
  await page.locator('#confirmSlot .btn.primary').click();
  await expect(page.locator('#flagSlot')).toContainText('Game over');
  await page.locator('[data-tab="review"]').click();
  await page.locator('#btnReview').click();
  await expect(page.locator('#reviewProgress')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#reviewBody .tiles')).toBeVisible();
  expect((await S(page)).reviewDone).toBe(true);
});

test('library, reading and coach tabs render; the mock coach answers', async ({ page }) => {
  await open(page);
  await page.locator('[data-tab="library"]').click();
  await expect(page.locator('#libList .game')).toHaveCount(13); // the built-in classics, while the library is empty
  await page.locator('#libList .game').filter({ hasText: 'Opera' }).getByRole('button', { name: 'Open' }).click();
  await page.locator('[data-tab="reading"]').click();
  await expect(page.locator('#bookList .book').first()).toBeVisible();
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('What is the plan?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
});

test('security headers are sent with the page', async ({ page }) => {
  const res = await page.goto('/');
  const h = res.headers();
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'wasm-unsafe-eval' blob: 'sha256-/);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['referrer-policy']).toBe('no-referrer');
  expect((await page.request.get('/.env')).status()).toBe(404);
});

test('phone width in dark mode: no horizontal scrolling', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
  await ctx.close();
});
