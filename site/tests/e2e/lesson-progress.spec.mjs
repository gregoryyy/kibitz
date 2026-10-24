import { test, expect, open, S } from './fixtures.mjs';
import { PUZZLES } from '../../src/curriculum/puzzle-data.js';
import { puzzleExerciseId } from '../../src/curriculum/puzzles.js';

async function exercise(page, module, lesson, id) {
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumModule').selectOption(module); await page.locator('#curriculumLevel').selectOption('4');
  const details = page.locator(`[data-lesson-id="${lesson}"]`);
  if (!await details.evaluate(d => d.open)) await details.locator('summary').click();
  await page.locator(`[data-open-exercise="${id}"]`).click();
}
async function move(page, text) { await page.locator('#lessonMove').fill(text); await page.locator('#lessonMoveForm button').click(); }
const overview = page => page.locator('#lessonProgressOverview');

test('verified mates save once, survive reload and update badges without losing catalogue focus/filter state', async ({ page }) => {
  await open(page); const before = await S(page);
  await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await move(page, 'Re8#');
  await expect(overview(page)).toContainText('1 of 100 exercises practised.'); await expect(overview(page)).toContainText('Verified mates: 1');
  await expect(page.locator('[data-lesson-progress="back-rank-mate"]')).toHaveText('1/2 practised');
  await expect(page.locator('#curriculumModule')).toHaveValue('tactics'); await expect(page.locator('[data-lesson-id="back-rank-mate"]')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: 'Close lesson', exact: true }).click(); await expect(page.locator('[data-open-exercise="back-rank-white"]')).toBeFocused();
  expect(await S(page)).toEqual(before);
  await page.reload(); await page.locator('[data-tab="lessons"]').click();
  await expect(overview(page)).toContainText('Verified mates: 1'); await expect(page.locator('#lessonProgressRetry')).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.lessonProgress')));
  expect(saved.entries).toHaveLength(1); expect(saved.entries[0].record.completions).toBe(1);
});

test('source recall and existing coach challenge counters remain separate evidence by theme', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.challengeProgress', JSON.stringify({ fork: { right: 2, tries: 3 } })));
  await open(page); const p = PUZZLES[0];
  await exercise(page, 'lichess-puzzles', 'lichess-puzzles-level-3', puzzleExerciseId(p.id));
  for (let i = 0; i < p.line.length; i += 2) await move(page, p.line[i]);
  await expect(overview(page)).toContainText('Verified mates: 0'); await expect(overview(page)).toContainText('Source recalls: 1');
  await page.locator('#lessonProgressDetails summary').click();
  await expect(page.locator('[data-progress-theme-row="fork"]')).toContainText('Coach challenges: 2/3');
  await expect(page.locator('[data-progress-theme-row="hanging-piece"]')).toContainText('Source recalls: 1');
});

test('rubric self-assessment and revealed examples persist without becoming verified solves or storing the written response', async ({ page }) => {
  await open(page); await exercise(page, 'strategy', 'active-king', 'king-route-reflection');
  await page.locator('#lessonResponse').fill('PRIVATE-REFLECTION-ONLY: check the pawn race.'); await page.locator('#lessonCompare').click();
  await page.locator('[data-assessment="met"]').click();
  await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await page.locator('#lessonReveal').click();
  await expect(overview(page)).toContainText('Rubric comparisons: 1'); await expect(overview(page)).toContainText('Examples revealed: 1'); await expect(overview(page)).toContainText('Verified mates: 0');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.lessonProgress'))).not.toContain('PRIVATE-REFLECTION-ONLY');
  await page.reload(); await page.locator('[data-tab="lessons"]').click(); await expect(overview(page)).toContainText('2 of 100 exercises practised.');
});

test('failed saves retain multiple completed attempts across exercises and retry without double counting', async ({ page }) => {
  await page.addInitScript(() => {
    window.__blockLessonProgress = true; const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'kibitz.lessonProgress' && window.__blockLessonProgress) throw new DOMException('blocked', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await open(page); await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await move(page, 'Re8#');
  await expect(page.locator('#lessonProgressStatus')).toContainText('1 result is waiting in this tab.'); await expect(overview(page)).toContainText('0 of 100');
  await page.locator('#lessonExercise').selectOption('back-rank-black'); await move(page, 'Re1#');
  await expect(page.locator('#lessonProgressStatus')).toContainText('2 results are waiting in this tab.');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.lessonProgress'))).toBeNull();
  await page.evaluate(() => { window.__blockLessonProgress = false; }); await page.locator('#lessonProgressRetry').click();
  await expect(overview(page)).toContainText('Verified mates: 2'); await expect(page.locator('#lessonProgressRetry')).toBeHidden();
  await page.reload(); await page.locator('[data-tab="lessons"]').click(); await expect(overview(page)).toContainText('Verified mates: 2');
});

test('future saved data is preserved read-only and pending results can save after the data becomes readable', async ({ page }) => {
  const raw = JSON.stringify({ version: 99, keep: 'original future data' });
  await page.addInitScript(raw => { if (!sessionStorage.getItem('progressSeeded')) { localStorage.setItem('kibitz.lessonProgress', raw); sessionStorage.setItem('progressSeeded', 'yes'); } }, raw);
  await open(page); await page.locator('[data-tab="lessons"]').click(); await expect(page.locator('#lessonProgressStatus')).toContainText('Its original data is preserved.');
  await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await move(page, 'Re8#');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.lessonProgress'))).toBe(raw);
  await expect(page.locator('[data-exercise-progress="back-rank-white"]')).toHaveText('Progress unavailable');
  await page.evaluate(() => localStorage.removeItem('kibitz.lessonProgress')); await page.locator('#lessonProgressRetry').click();
  await expect(overview(page)).toContainText('Verified mates: 1'); await expect(page.locator('#lessonProgressRetry')).toBeHidden();
});

test('a revised task retains its older results without borrowing credit from them', async ({ page }) => {
  await open(page); await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await move(page, 'Re8#');
  await page.route('**/curriculum/catalogue.js', async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: await response.text() + '\nCURRICULUM.modules[0].lessons[0].exercises[0].prompt.en += " Updated task.";\n' });
  });
  await page.reload(); await page.locator('[data-tab="lessons"]').click();
  await expect(overview(page)).toContainText('0 of 100'); await expect(page.locator('#lessonProgressOlder')).toBeVisible();
  await exercise(page, 'tactics', 'back-rank-mate', 'back-rank-white'); await move(page, 'Re8#'); await expect(overview(page)).toContainText('Verified mates: 1');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.lessonProgress'))); expect(saved.entries).toHaveLength(2);
});

test('German phone progress summaries, tables and badges translate and fit the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await exercise(page, 'endgames', 'rook-and-king-mate', 'rook-mate-black'); await move(page, 'Tf1');
  await expect(overview(page)).toContainText('1 von 100 Übungen geübt.'); await expect(overview(page)).toContainText('Geprüfte Mattaufgaben: 1');
  await page.locator('#lessonProgress').screenshot({ path: info.outputPath('progress-phone.png') });
  await page.locator('#lessonProgressDetails summary').click(); await expect(page.locator('[data-progress-theme-row="mate"]')).toContainText('Geprüfte Mattaufgaben: 1');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
