import { test, expect, open, S, loadPgn } from './fixtures.mjs';
import { PUZZLES } from '../../src/curriculum/puzzle-data.js';
import { puzzleExerciseId } from '../../src/curriculum/puzzles.js';

async function openExercise(page, module, lesson, exercise, level = '4') {
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumLevel').selectOption(level);
  await page.locator('#curriculumModule').selectOption(module);
  const details = page.locator(`[data-lesson-id="${lesson}"]`);
  if (!await details.evaluate(d => d.open)) await details.locator('summary').click();
  await page.locator(`[data-open-exercise="${exercise}"]`).click(); await expect(page.locator('#lessonPlayer')).toBeVisible();
}
async function play(page, input) { await page.locator('#lessonMove').fill(input); await page.locator('#lessonMoveForm button').click(); }

test('mate exercises use an isolated board, staged hints and rules-based results without provider requests', async ({ page }) => {
  const requests = []; page.on('request', r => { if (/\/api\/ai\/(sample|embeddings)$/.test(r.url()) && r.method() === 'POST') requests.push(r.url()); });
  await open(page); const before = await S(page);
  await openExercise(page, 'tactics', 'back-rank-mate', 'back-rank-white');
  const fen = await page.locator('#lessonBoard').getAttribute('data-fen');
  await play(page, 'e9'); await expect(page.locator('#lessonFeedback')).toHaveText('Enter a legal move for this exercise.');
  await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', fen);
  await page.locator('#lessonHint').click(); await page.locator('#lessonHint').click(); await page.locator('#lessonHint').click();
  await expect(page.locator('#lessonHints')).toContainText('The recorded next move is Re8#.');
  await expect(page.locator('#lessonHint')).toBeDisabled();
  await play(page, 'Re2'); await expect(page.locator('#lessonFeedback')).toHaveText('That move is legal, but it does not give checkmate.');
  await play(page, 'Re8#'); await expect(page.locator('#lessonFeedback')).toHaveText('Checkmate, verified by the chess rules.');
  await expect(page.locator('#lessonMove')).toBeDisabled();
  await page.getByRole('button', { name: 'Close lesson', exact: true }).click();
  await expect(page.locator('#lessonPlayer')).toBeHidden(); await expect(page.locator('[data-open-exercise="back-rank-white"]')).toBeFocused();
  expect(await S(page)).toEqual(before); expect(requests).toEqual([]);
});

test('source puzzles start after the setup, play recorded replies and scope worked-example keys to their board', async ({ page }) => {
  await open(page); const before = await S(page), p = PUZZLES[0];
  await openExercise(page, 'lichess-puzzles', 'lichess-puzzles-level-3', puzzleExerciseId(p.id));
  await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', p.fen); await expect(page.locator('#lessonPosition')).toHaveText('White to move · move 25');
  await play(page, p.line[0]); await expect(page.locator('#lessonPlayed')).toHaveText('Rxe7 Qb1+');
  await page.locator('#lessonWorked').click(); await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', p.fen);
  await page.locator('#lessonNext').evaluate(button => { window.__heldLessonNext = button; });
  await page.locator('#lessonBoard').focus(); await page.keyboard.press('End');
  await expect(page.locator('#lessonNext')).toBeDisabled(); await expect(page.locator('#lessonBoard')).not.toHaveAttribute('data-fen', p.fen);
  const last = await page.locator('#lessonBoard').getAttribute('data-fen'); await page.evaluate(() => window.__heldLessonNext.click());
  await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', last);
  await page.keyboard.press('Home'); await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', p.fen);
  await page.locator('#lessonSolve').click(); await expect(page.locator('#lessonPlayed')).toHaveText('Rxe7 Qb1+');
  for (let i = 2; i < p.line.length; i += 2) await play(page, p.line[i]);
  await expect(page.locator('#lessonFeedback')).toHaveText('Recorded line completed.'); expect(await S(page)).toEqual(before);
});

test('written reflections render literal text and require an explicit rubric self-assessment', async ({ page }) => {
  await open(page); const before = await S(page);
  await openExercise(page, 'strategy', 'active-king', 'king-route-reflection');
  await expect(page.locator('#lessonMoveForm')).toHaveCount(0); await expect(page.locator('#lessonRubric')).toHaveCount(0);
  await page.locator('#lessonCompare').click(); await expect(page.locator('#lessonFeedback')).toHaveText('Write your reasoning before comparing it.');
  const answer = '<img src=x onerror=alert(1)> I would check the pawn race.';
  await page.locator('#lessonResponse').fill(answer); await page.locator('#lessonCompare').click();
  await expect(page.locator('#lessonResponse')).toHaveValue(answer); await expect(page.locator('#lessonPlayer img')).toHaveCount(0);
  await expect(page.locator('#lessonResponse')).toBeDisabled();
  await expect(page.locator('#lessonRubric')).toContainText('the opponent’s pawn race');
  await page.locator('[data-assessment="practice"]').click(); await expect(page.locator('#lessonFeedback')).toHaveText('Reflection compared with the rubric.');
  await expect(page.locator('#lessonResponse')).toBeDisabled(); expect(await S(page)).toEqual(before);
});

test('explicit promotion choices cannot act on a replacement exercise through a held button', async ({ page }) => {
  const p = PUZZLES.find(p => p.themes.includes('promotion')), level = p.rating <= 1200 ? 1 : p.rating <= 1800 ? 2 : p.rating <= 2300 ? 3 : 4;
  await open(page); const before = await S(page);
  await openExercise(page, 'lichess-puzzles', `lichess-puzzles-level-${level}`, puzzleExerciseId(p.id));
  const promotionAt = p.line.findIndex((u, i) => i % 2 === 0 && u.length === 5); expect(promotionAt).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < promotionAt; i += 2) await play(page, p.line[i]);
  const uci = p.line[promotionAt]; await play(page, uci.slice(0, 4));
  await expect(page.locator('#lessonPromotion')).toBeVisible();
  const beforePromotion = await page.locator('#lessonBoard').getAttribute('data-fen');
  await page.locator(`#lessonPromotion [data-piece="${uci[4]}"]`).click();
  await expect(page.locator('#lessonPromotion')).toHaveCount(0); await expect(page.locator('#lessonBoard')).not.toHaveAttribute('data-fen', beforePromotion);
  await page.getByRole('button', { name: 'Restart exercise', exact: true }).click();
  for (let i = 0; i < promotionAt; i += 2) await play(page, p.line[i]);
  await play(page, uci.slice(0, 4)); await expect(page.locator('#lessonPromotion')).toBeVisible();
  await page.locator(`#lessonPromotion [data-piece="${uci[4]}"]`).evaluate(button => { window.__heldLessonPromotion = button; });
  await page.evaluate(() => {
    const select = document.querySelector('#lessonExercise'); select.value = [...select.options].find(o => o.value !== select.value).value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const fen = await page.locator('#lessonBoard').getAttribute('data-fen');
  await page.evaluate(() => window.__heldLessonPromotion.click());
  await expect(page.locator('#lessonBoard')).toHaveAttribute('data-fen', fen); await expect(page.locator('#lessonPromotion')).toHaveCount(0);
  expect(await S(page)).toEqual(before);
});

test('loading another main game invalidates the lesson and held hint controls', async ({ page }) => {
  await open(page); await openExercise(page, 'tactics', 'back-rank-mate', 'back-rank-white');
  await page.locator('#lessonHint').evaluate(button => { window.__heldLessonHint = button; });
  await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. d4 d5 *');
  await expect(page.locator('#lessonPlayer')).toBeHidden(); const after = await S(page);
  await page.evaluate(() => window.__heldLessonHint.click()); await expect(page.locator('#lessonPlayer')).toBeHidden(); expect(await S(page)).toEqual(after);
});

test('German phone lesson controls, board and move input fit and retain keyboard focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await openExercise(page, 'endgames', 'rook-and-king-mate', 'rook-mate-black');
  await expect(page.locator('#lessonPlayer')).toContainText('Schließe den Rand mit Turm und König');
  await expect(page.locator('#lessonPosition')).toHaveText('Schwarz am Zug · Zug 1');
  await page.locator('#lessonWorked').click(); await page.locator('#lessonBoard').focus(); await page.keyboard.press('End'); await expect(page.locator('#lessonNext')).toBeDisabled();
  await page.locator('#lessonSolve').click(); await play(page, 'Tf1');
  await expect(page.locator('#lessonFeedback')).toHaveText('Schachmatt, anhand der Schachregeln geprüft.');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#lessonPlayer').screenshot({ path: info.outputPath('lesson-phone.png') });
});
