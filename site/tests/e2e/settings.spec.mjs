// Settings behind the gear (TODO 4.12.1): a modal dialog with what isn't one tab's task.
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';

const focusInSettings = page => page.evaluate(() => !!document.activeElement?.closest('#settings'));
// The page behind a modal dialog is inert: focus is in the dialog, or past its end in the browser's
// own toolbar (then the page reports the body), never on an element behind it.
const focusNotBehind = page => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body || !!a.closest('#settings'); });

test('the gear opens the settings; Escape, the close button and a click outside close them, and focus comes back', async ({ page }) => {
  await open(page);
  await expect(page.locator('#settings')).toBeHidden();
  await openSettings(page);
  await expect(page.locator('#settings')).toHaveAttribute('open', '');
  expect(await focusInSettings(page)).toBe(true);
  for (let k = 0; k < 40; k++) { await page.keyboard.press('Tab'); expect(await focusNotBehind(page), `Tab ${k}`).toBe(true); }
  await closeSettings(page); // Escape
  await expect(page.locator('#btnSettings')).toBeFocused();

  await openSettings(page);
  await page.locator('#btnSettingsClose').click();
  await expect(page.locator('#settings')).toBeHidden();

  await openSettings(page);
  const box = await page.locator('#settings').boundingBox();
  await page.mouse.click(box.x - 20, box.y + 20); // on the backdrop
  await expect(page.locator('#settings')).toBeHidden();
  await openSettings(page);
  await page.locator('#settings h3').first().click(); // a click inside keeps it open
  await expect(page.locator('#settings')).toBeVisible();
});

test('the settings hold language, level, the coach\'s mode and provider, and the engine; the tabs keep their tasks', async ({ page }) => {
  await open(page);
  for (const id of ['#optLang', '#optLevel', '#optCommentWhen', '#coachSettings', '#optDepth']) await expect(page.locator(`#settings ${id}`)).toHaveCount(1);
  for (const id of ['#optLevel', '#optDepth', '#optCommentWhen', '#optLang']) await expect(page.locator(`.pane ${id}, header ${id}`)).toHaveCount(0);
  await expect(page.locator('.pane[data-pane="game"] #optHelp')).toHaveCount(1); // live help belongs to the game
  await expect(page.locator('.pane[data-pane="coach"] #aspectPicker')).toHaveCount(1);

  await openSettings(page);
  await page.locator('#optLevel button[data-v="3"]').click();
  await page.locator('#optCommentWhen button[data-v="every"]').click();
  await page.locator('#optDepth').selectOption('16');
  await closeSettings(page);
  await expect(page.locator('#playerBottom')).toContainText('advanced player');
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await openSettings(page);
  await expect(page.locator('#optLevel button[data-v="3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#optCommentWhen button[data-v="every"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#optDepth')).toHaveValue('16');
});

test('phone width: the settings fit without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await openSettings(page);
  const box = await page.locator('#settings').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(15);
  expect(box.x + box.width).toBeLessThanOrEqual(345);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#settings').evaluate(d => { d.scrollTop = d.scrollHeight; });
  await expect(page.locator('#optDepth')).toBeInViewport();
});
