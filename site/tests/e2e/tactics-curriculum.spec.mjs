import { test, expect, open, S } from './fixtures.mjs';

test('all tactics lessons can be browsed and a defensive counterexample stays visible without changing the game', async ({ page }) => {
  await open(page); const before = await S(page);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumLevel').selectOption('3');
  await page.locator('#curriculumModule').selectOption('tactics');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(13);
  await page.locator('[data-lesson-id="knight-forks"] summary').click();
  await expect(page.locator('[data-exercise-id="fork-can-be-captured"]')).toContainText('the other rook can capture the knight');
  await page.locator('#curriculumTheme').selectOption('deflection');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(1);
  await page.locator('[data-lesson-id="deflection"] summary').click();
  await expect(page.locator('[data-lesson-id="deflection"]')).toContainText('the alternatives before calling the combination forced');
  expect(await S(page)).toEqual(before);
});

test('German advanced tactics translate and remain usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('[data-tab="lessons"]').click();
  await page.locator('#curriculumLevel').selectOption('3'); await page.locator('#curriculumTheme').selectOption('overloading');
  await page.locator('[data-lesson-id="overloaded-defenders"] summary').click();
  await expect(page.locator('#curriculumList')).toContainText('Ein Verteidiger, zwei Aufgaben');
  await expect(page.locator('#curriculumList')).toContainText('konkurrierenden Aufgaben');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
