// The dialogue with the coach sits beside the board at its height; the panels below fold away.
import { test, expect, open } from './fixtures.mjs';

const box = (page, sel) => page.locator(sel).boundingBox();

test('the dialogue is beside the board and as tall as it, whichever tab is open', async ({ page }) => {
  await open(page);
  for (const tab of ['game', 'review', 'library']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator('#dialogue')).toBeVisible();
    await expect(page.locator('#coachInput')).toBeVisible();
  }
  const col = await box(page, '.boardcol'), bottom = await box(page, '#playerBottom'), dlg = await box(page, '#dialogue');
  expect(Math.abs(dlg.y - col.y)).toBeLessThanOrEqual(2); // top: level with the board column
  expect(Math.abs(dlg.y + dlg.height - (bottom.y + bottom.height))).toBeLessThanOrEqual(3); // bottom: level with the board
  expect(dlg.x).toBeGreaterThan(col.x + col.width); // to its right
  // It follows the board when the window changes.
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect.poll(async () => {
    const [b, d] = [await box(page, '#playerBottom'), await box(page, '#dialogue')];
    return Math.abs(d.y + d.height - (b.y + b.height));
  }).toBeLessThanOrEqual(3);
});

test('the panels fold away, stay folded after a reload, and any tab opens them again', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-pane="game"]')).toBeVisible();
  await page.locator('#btnTools').click();
  await expect(page.locator('#btnTools')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#btnTools')).toHaveAttribute('aria-label', 'Show the panels');
  await expect(page.locator('[data-pane="game"]')).toBeHidden();
  await expect(page.locator('#dialogue')).toBeVisible();
  await page.reload();
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await expect(page.locator('[data-pane="game"]')).toBeHidden();
  await page.locator('[data-tab="review"]').click();
  await expect(page.locator('[data-pane="review"]')).toBeVisible();
  await expect(page.locator('#btnTools')).toHaveAttribute('aria-expanded', 'true');
  expect((await page.locator('#btnTools').getAttribute('aria-controls')).split(' ')).toContain('pane-game');
  await expect(page.locator('#btnTools')).not.toHaveAttribute('aria-selected', /.*/); // not a tab
});

test('on a phone the dialogue comes after the board, with a capped height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const board = await box(page, '.board-outer'), dlg = await box(page, '#dialogue');
  expect(dlg.y).toBeGreaterThan(board.y + board.height);
  expect(dlg.height).toBeLessThanOrEqual(844 * 0.75 + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
