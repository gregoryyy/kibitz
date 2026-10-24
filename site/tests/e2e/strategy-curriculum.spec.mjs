import { test, expect, open, S } from './fixtures.mjs';

test('strategy concepts and structure examples filter independently while preserving a running game', async ({ page }) => {
  await open(page); const before = await S(page);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumLevel').selectOption('3');
  await page.locator('#curriculumModule').selectOption('strategy');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(11);
  await page.locator('#curriculumTheme').selectOption('open-file');
  await page.locator('[data-lesson-id="open-files"] summary').click();
  await expect(page.locator('[data-lesson-id="open-files"]')).toContainText('An open file has no pawns of either colour.');
  await page.locator('#curriculumTheme').selectOption('hanging-pawns'); await page.locator('#curriculumLevel').selectOption('2');
  await expect(page.locator('#curriculumStatus')).toHaveText('No lessons match these filters.');
  await page.locator('#curriculumLevel').selectOption('3');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveAttribute('data-lesson-id', 'hanging-pawns');
  expect(await S(page)).toEqual(before);
});

test('new German strategy themes and authored text fit on a phone without translation gaps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumTheme').selectOption('outpost');
  await page.locator('[data-lesson-id="outposts"] summary').click();
  await expect(page.locator('#curriculumList')).toContainText('Unterstütze eine vorgerückte Figur');
  await expect(page.locator('#curriculumTheme option:checked')).toHaveText('Vorposten');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
