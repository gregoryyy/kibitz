import { test, expect, open, S } from './fixtures.mjs';

test('CC0 puzzle collection filters rating groups and source themes with safe provenance links and no game/provider changes', async ({ page }) => {
  const requests = [];
  page.on('request', r => {
    const url = new URL(r.url());
    if ((/^\/api\/ai\/(sample|embeddings)$/.test(url.pathname) && r.method() === 'POST') || ['lichess.org', 'database.lichess.org'].includes(url.hostname)) requests.push(r.url());
  });
  await open(page); const before = await S(page);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumModule').selectOption('lichess-puzzles');
  await expect(page.locator('#curriculumList [data-lesson-id]')).toHaveCount(2);
  await expect(page.locator('#curriculumList [data-exercise-id]')).toHaveCount(47);
  await page.locator('#curriculumLevel').selectOption('4');
  await expect(page.locator('#curriculumList [data-exercise-id]')).toHaveCount(64);
  await page.locator('[data-lesson-id="lichess-puzzles-level-3"] summary').click();
  const first = page.locator('[data-exercise-id="lichess-puzzle-3030303038"]');
  await expect(first).toContainText('Lichess puzzle 00008'); await expect(first).toContainText('CC0-1.0');
  await expect(first).toContainText('Lichess rating: 1811 ±76');
  await expect(first.locator('a').first()).toHaveAttribute('href', 'https://lichess.org/training/00008');
  await expect(first.locator('a').last()).toHaveAttribute('href', 'https://lichess.org/787zsVup/black#48');
  await expect(first.locator('a').first()).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(first.locator('.puzzle-themes')).toContainText('hangingPiece');
  await page.locator('#curriculumTheme').selectOption('fork');
  await expect(page.locator('#curriculumList [data-exercise-id]')).toHaveCount(7);
  expect(await S(page)).toEqual(before); expect(requests).toEqual([]);
});

test('German phone puzzle metadata is literal, translated and keyboard accessible; unsafe source URLs fail before rendering', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumModule').selectOption('lichess-puzzles');
  const summary = page.locator('[data-lesson-id="lichess-puzzles-level-1"] summary'); await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#curriculumList')).toContainText('Lichess-Aufgaben: Gruppe 1');
  await expect(page.locator('[data-lesson-id="lichess-puzzles-level-1"]')).toContainText('Lichess-Wertung:');
  await expect(page.locator('[data-lesson-id="lichess-puzzles-level-1"]')).toContainText('Aufgabe bei der Quelle öffnen');
  await expect(page.locator('#curriculumList')).toContainText('Quellthemen:');
  const before = await S(page);
  const error = await page.evaluate(async () => {
    const { CURRICULUM } = await import('/curriculum/catalogue.js'), { compileCurriculum } = await import('/curriculum/curriculum.js'), { Chess } = await import('/chess.js');
    const data = structuredClone(CURRICULUM);
    data.modules.find(m => m.id === 'lichess-puzzles').lessons[0].exercises[0].puzzle.gameUrl = 'javascript:alert(1)';
    try { compileCurriculum(Chess, data); return ''; } catch (error) { return error.message; }
  });
  expect(error).toContain('game URL'); expect(await S(page)).toEqual(before);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
