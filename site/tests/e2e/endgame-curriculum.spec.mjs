import { test, expect, open, S } from './fixtures.mjs';

test('endgame catalogue shows exact checked outcomes and advanced methods without sending positions or changing the game', async ({ page }) => {
  const external = [], ai = [];
  page.on('request', r => {
    if (/tablebase\.lichess\.ovh/.test(r.url())) external.push(r.url());
    if (/\/api\/ai\/(sample|embeddings)$/.test(r.url()) && r.method() === 'POST') ai.push(r.url());
  });
  await open(page); const before = await S(page);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumModule').selectOption('endgames');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(4);
  await page.locator('#curriculumTheme').selectOption('opposition');
  await page.locator('[data-lesson-id="opposition"] summary').click();
  await expect(page.locator('[data-exercise-id="opposition-white-turn"] .tablebase-evidence')).toContainText('Syzygy: Draw');
  await expect(page.locator('[data-exercise-id="opposition-black-turn"] .tablebase-evidence')).toContainText('Syzygy: White wins');
  await page.locator('#curriculumTheme').selectOption('rook-pawn-vs-rook');
  await expect(page.locator('#curriculumStatus')).toHaveText('No lessons match these filters.');
  await page.locator('#curriculumLevel').selectOption('3');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(2);
  await page.locator('[data-lesson-id="lucena-bridge"] summary').click();
  await expect(page.locator('[data-lesson-id="lucena-bridge"]')).toContainText('prepare a rook on the fourth rank');
  await expect(page.locator('[data-lesson-id="lucena-bridge"] .tablebase-evidence')).toContainText('White wins');
  await page.locator('[data-lesson-id="philidor-defence"] summary').click();
  await expect(page.locator('[data-lesson-id="philidor-defence"] .tablebase-evidence')).toContainText('Draw');
  expect(await S(page)).toEqual(before); expect(external).toEqual([]); expect(ai).toEqual([]);
});

test('German phone endgame results translate, fit and distinguish a Black win from side-to-move loss', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumModule').selectOption('endgames');
  await page.locator('[data-lesson-id="rook-and-king-mate"] summary').click();
  await expect(page.locator('[data-exercise-id="rook-mate-black"] .tablebase-evidence')).toContainText('Syzygy: Schwarz gewinnt · geprüft am');
  await page.locator('#curriculumTheme').selectOption('opposition');
  const summary = page.locator('[data-lesson-id="opposition"] summary'); await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-exercise-id="opposition-black-turn"] .tablebase-evidence')).toContainText('Weiß gewinnt');
  await expect(page.locator('#curriculumList')).toContainText('Geprüft für diese Stellung');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
