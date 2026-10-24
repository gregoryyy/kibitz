import { test, expect, open, S, loadPgn } from './fixtures.mjs';

const KEY = 'kibitz.practiceSchedule';
const panel = page => page.locator('#practiceSchedule');
const rep = { id: 'r', name: '<img src=x> My openings', color: 'w', lines: [{ id: 'l', name: 'Open game', note: '', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] }] };
async function seed(page) {
  await page.addInitScript(rep => {
    if (!localStorage.getItem('kibitz.repertoires')) localStorage.setItem('kibitz.repertoires', JSON.stringify({ version: 1, items: [rep] }));
  }, rep);
}
async function lessons(page) { await page.locator('[data-tab="lessons"]').click(); }
async function exercise(page, id = 'back-rank-white') {
  await lessons(page); await page.locator('#curriculumModule').selectOption('tactics'); await page.locator('#curriculumLevel').selectOption('4');
  const details = page.locator('[data-lesson-id="back-rank-mate"]'); if (!await details.evaluate(n => n.open)) await details.locator('summary').click();
  await page.locator(`[data-open-exercise="${id}"]`).click();
}
async function answer(page, text = 'Re8#') { await page.locator('#lessonMove').fill(text); await page.locator('#lessonMoveForm').getByRole('button').click(); }
const schedule = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);

test('a lesson completion schedules once, survives reload, and becomes due again after its interval', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); const before = await S(page);
  await exercise(page); await answer(page);
  let saved = await schedule(page); expect(saved.entries).toHaveLength(1); expect(saved.entries[0].record).toMatchObject({ reviews: 1, grade: 'good', intervalDays: 1 });
  await page.locator('#practiceNew').uncheck(); await expect(panel(page)).toContainText('No practice is due');
  await page.reload(); await lessons(page); saved = await schedule(page); expect(saved.entries[0].record.reviews).toBe(1);
  await page.clock.setFixedTime(saved.entries[0].record.due + 1); await panel(page).getByRole('button', { name: 'Refresh queue' }).click();
  await expect(page.locator('[data-practice-id="back-rank-white"]')).toBeVisible();
  await page.locator('[data-practice-id="back-rank-white"]').click(); await expect(page.locator('#lessonExercise')).toHaveValue('back-rank-white'); await answer(page);
  expect((await schedule(page)).entries[0].record).toMatchObject({ reviews: 2, intervalDays: 3 }); expect(await S(page)).toEqual(before);
});

test('the combined queue orders due opening recall before new lessons and opens only that source card', async ({ page }) => {
  await seed(page);
  await page.addInitScript(async () => {
    // A valid historical record, keyed exactly as the existing opening store expects.
    const key = JSON.stringify(['r', 'w', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', ['e2e4']]);
    localStorage.setItem('kibitz.repertoireReviews', JSON.stringify({ version: 1, entries: [[key, { reviews: 1, clean: 0, mistakes: 1, hints: 0, lapses: 1, grade: 'again', intervalDays: 0, lastAt: Date.now() - 700000, due: Date.now() - 100000 }]] }));
  });
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. d4 d5'); const before = await S(page);
  await lessons(page); const rows = page.locator('#practiceQueue > li'); await expect(rows.first()).toContainText('My openings'); await expect(rows).toHaveCount(20);
  await expect(panel(page).locator('img')).toHaveCount(0); await rows.first().getByRole('button', { name: 'Practise' }).click();
  await expect(page.locator('#drillPosition')).toContainText('Position 1 of 1');
  await page.locator('#drillBoard').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('f'); expect(await S(page)).toEqual(before);
  await page.locator('#drillMove').fill('e4'); await page.locator('#drillMove').press('Enter');
  await expect(page.locator('#drillFeedback')).toContainText('Review scheduled');
  await lessons(page); await page.locator('#practiceType').selectOption('opening'); await page.locator('#practiceNew').uncheck(); await expect(panel(page)).toContainText('No practice is due');
  expect(await S(page)).toEqual(before);
});

test('a scheduler write failure retains its receipt without undoing or recounting lesson progress', async ({ page }) => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem; window.__failSchedule = true;
    Storage.prototype.setItem = function (key, value) { if (key === 'kibitz.practiceSchedule' && window.__failSchedule) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await open(page); await exercise(page); await answer(page); await expect(page.locator('#practiceStatus')).toContainText('Pending practice results: 1');
  await expect(page.locator('#lessonProgressOverview')).toContainText('Verified mates: 1'); expect(await schedule(page)).toBeNull();
  await page.evaluate(() => { window.__failSchedule = false; }); await page.locator('#practiceRetry').click();
  expect((await schedule(page)).entries[0].record.reviews).toBe(1); await expect(page.locator('#practiceRetry')).toBeHidden();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.lessonProgress'))); expect(progress.entries[0].record.completions).toBe(1);
});

test('future schedule data is preserved while opening recalls remain available and a pending lesson can retry', async ({ page }) => {
  const future = JSON.stringify({ version: 99, privateFutureData: 'keep original' }); await seed(page);
  await page.addInitScript(raw => localStorage.setItem('kibitz.practiceSchedule', raw), future);
  await open(page); await page.locator('#modeAnalyse').click(); await lessons(page); await expect(page.locator('#practiceStatus')).toContainText('original data is preserved');
  await expect(page.locator('#practiceQueue [data-practice-kind="lesson"]')).toHaveCount(0);
  await expect(page.locator('#practiceQueue [data-practice-kind="opening"]')).toHaveCount(2);
  await exercise(page); await page.locator('#lessonReveal').click();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBe(future);
  await page.evaluate(key => localStorage.removeItem(key), KEY); await page.locator('#practiceRetry').click();
  expect((await schedule(page)).entries[0]).toMatchObject({ basis: 'revealed', record: { intervalDays: 0, grade: 'again' } });
});

test('a changed task gets a new schedule and a held queue action cannot cross game/help guards', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await exercise(page); await answer(page);
  await page.route('**/curriculum/catalogue.js', async route => { const response = await route.fetch(); await route.fulfill({ response, body: await response.text() + '\nCURRICULUM.modules[0].lessons[0].exercises[0].prompt.en += " Revised target.";\n' }); });
  await page.reload(); await exercise(page); await answer(page); expect((await schedule(page)).entries).toHaveLength(2);
  await lessons(page); await page.locator('#practiceQueue button').first().evaluate(button => { window.__oldPractice = button; });
  await page.locator('#modePlay').click(); const before = await S(page); await page.evaluate(() => window.__oldPractice.click());
  await expect(panel(page)).toContainText('hidden while you play'); await expect(page.locator('#lessonPlayer')).toBeHidden(); expect(await S(page)).toEqual(before);
});

test('German phone queue controls, evidence labels and due dates fit without untrusted HTML', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await seed(page);
  await open(page); await page.locator('#modeAnalyse').click(); await exercise(page); await answer(page);
  const saved = await schedule(page); await page.clock.setFixedTime(saved.entries[0].record.due + 1);
  await panel(page).getByRole('button', { name: 'Liste aktualisieren' }).click(); await page.locator('#practiceNew').uncheck();
  await expect(panel(page)).toContainText('Wiederholungsplan'); await expect(panel(page)).toContainText('Matt nach Schachregeln'); await expect(panel(page)).toContainText('Fällig am');
  await panel(page).screenshot({ path: info.outputPath('schedule-phone.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
