import { test, expect, open, S, move } from './fixtures.mjs';

const ROOT = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
const KING = '7k/7p/8/8/8/5K2/P7/8 w - - 0 1';
async function lesson(page, { king = false } = {}) {
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumLevel').selectOption('4');
  await page.locator('#curriculumModule').selectOption(king ? 'strategy' : 'tactics');
  const details = page.locator(`[data-lesson-id="${king ? 'active-king' : 'back-rank-mate'}"]`);
  if (!await details.evaluate(d => d.open)) await details.locator('summary').click();
  await page.locator(`[data-open-exercise="${king ? 'king-route-reflection' : 'back-rank-white'}"]`).click();
}
async function liveGame(page) {
  await open(page); await page.evaluate(() => { window.__kibitz.S.elo = 900; }); await move(page, 'e2', 'e4');
  await expect.poll(() => S(page)).toMatchObject({ nodes: 3, thinking: false, playing: true, userColor: 'w' });
}
const game = page => page.evaluate(() => {
  const s = window.__kibitz.S;
  return { gen: s.gen, start: s.start, id: s.gameId, mode: s.mode, userColor: s.userColor, colorPick: s.colorPick,
    orientation: s.orientation, tc: s.tc, gameTc: s.gameTc?.id, elo: s.elo, startPick: s.startPick, fens: s.nodes.map(n => n.fen), over: s.over };
});

test('the displayed worked position starts exactly, with explicit side and unchanged start/strength/clock preferences', async ({ page }) => {
  await open(page); await page.evaluate(() => { const s = window.__kibitz.S; s.colorPick = 'w'; s.elo = 900; s.tc = '3+2'; });
  const before = await game(page); await lesson(page, { king: true }); await page.locator('#lessonWorked').click(); await page.locator('#lessonNext').click();
  const fen = await page.locator('#lessonBoard').getAttribute('data-fen'); expect(fen).not.toBe(KING);
  await page.locator('#lessonPlayColor').selectOption('b'); await page.locator('#lessonPlayStart').click();
  await expect(page.locator('#lessonPlayer')).toBeHidden(); const after = await game(page);
  expect(after.start).toBe(fen); expect(after.fens).toEqual([fen]); expect(after.userColor).toBe('b'); expect(after.orientation).toBe('black');
  expect(after.elo).toBe(900); expect(after.tc).toBe('3+2'); expect(after.gameTc).toBe('3+2'); expect(after.colorPick).toBe(before.colorPick); expect(after.startPick).toEqual(before.startPick);
});

test('Stockfish replies first when the chosen side is not on move in the lesson root', async ({ page }) => {
  await open(page); await page.evaluate(() => { window.__kibitz.S.elo = 900; }); await lesson(page, { king: true });
  await page.locator('#lessonPlayColor').selectOption('b'); await page.locator('#lessonPlayStart').click();
  await expect.poll(() => S(page)).toMatchObject({ nodes: 2, thinking: false, userColor: 'b' });
  const after = await game(page); expect(after.start).toBe(KING); expect(after.fens[0]).toBe(KING); expect(after.fens[1]).toMatch(/ b /);
});

test('finished lesson positions are disabled; an earlier position can be played to mate and saved with its FEN', async ({ page }) => {
  await open(page); await lesson(page); await page.locator('#lessonReveal').click();
  await expect(page.locator('#lessonPlayStart')).toBeDisabled(); await expect(page.locator('#lessonPlayStatus')).toHaveText('Choose an earlier unfinished position to play.');
  await page.locator('#lessonWorked').click(); await page.locator('#lessonPlayStart').click(); await expect(page.locator('#lessonPlayer')).toBeHidden();
  expect((await game(page)).start).toBe(ROOT); await page.locator('#moveInput').fill('Re8#'); await page.locator('#moveInput').press('Enter');
  await expect.poll(() => S(page)).toMatchObject({ playing: false, nodes: 2 });
  const id = (await game(page)).id;
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('kibitz.games') || '[]').find(g => g.id === id)?.pgn || '', id)).toContain(`[FEN "${ROOT}"]`);
});

test('live-game confirmation cancels cleanly, then saves the old game; old resignation controls cannot end the new one', async ({ page }) => {
  await liveGame(page); const before = await game(page), saved = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await page.locator('#btnResign').click(); await page.locator('#confirmSlot .primary').evaluate(button => { window.__oldResign = button; }); await page.locator('#confirmSlot').getByRole('button', { name: 'Cancel' }).click();
  await lesson(page); await page.locator('#lessonPlayStart').click(); await expect(page.locator('#lessonPlayConfirm')).toBeVisible();
  await page.locator('#lessonPlayConfirm').getByRole('button', { name: 'Cancel' }).click(); expect(await game(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(saved);
  await page.locator('#lessonPlayStart').click(); await page.locator('#lessonPlayConfirm').getByRole('button', { name: 'Save and start lesson' }).click();
  await expect(page.locator('#lessonPlayer')).toBeHidden(); const after = await game(page); expect(after.start).toBe(ROOT); expect(after.id).not.toBe(before.id);
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('kibitz.games')).find(g => g.id === id).result, before.id)).toBe('*');
  await page.evaluate(() => window.__oldResign.click()); expect(await game(page)).toEqual(after);
});

test('a failed old-game save leaves it intact and permits a later successful retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem; window.__blockPracticeSave = false;
    Storage.prototype.setItem = function (key, value) { if (key === 'kibitz.games' && window.__blockPracticeSave) throw new DOMException('quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await liveGame(page); const before = await game(page); await lesson(page); await page.evaluate(() => { window.__blockPracticeSave = true; });
  await page.locator('#lessonPlayStart').click(); await page.locator('#lessonPlayConfirm').getByRole('button', { name: 'Save and start lesson' }).click();
  await expect(page.locator('#lessonPlayStatus')).toHaveText('The current game could not be saved. The lesson position has not been started.'); expect(await game(page)).toEqual(before);
  await page.evaluate(() => { window.__blockPracticeSave = false; }); await page.locator('#lessonPlayStart').click(); await page.locator('#lessonPlayConfirm').getByRole('button', { name: 'Save and start lesson' }).click();
  await expect(page.locator('#lessonPlayer')).toBeHidden(); expect((await game(page)).start).toBe(ROOT);
});

test('a lesson-view change aborts a pending confirmation and rejects a held confirmation button', async ({ page }) => {
  await liveGame(page); const before = await game(page); await lesson(page); await page.locator('#lessonPlayStart').click();
  await page.locator('#lessonPlayConfirm .primary').evaluate(button => { window.__heldPracticeYes = button; });
  await page.evaluate(() => document.querySelector('#lessonWorked').click()); await expect(page.locator('#lessonPlayConfirm')).toHaveCount(0);
  await page.evaluate(() => window.__heldPracticeYes.click()); expect(await game(page)).toEqual(before);
});

async function gateSave(page) {
  await page.evaluate(() => {
    const digest = SubtleCrypto.prototype.digest; window.__practiceDigests = []; window.__gatePracticeSave = true;
    SubtleCrypto.prototype.digest = async function (...args) { const result = await digest.apply(this, args); if (window.__gatePracticeSave) await new Promise(resolve => window.__practiceDigests.push(resolve)); return result; };
  });
}
async function releaseSave(page) { await page.evaluate(() => { window.__gatePracticeSave = false; window.__practiceDigests.splice(0).forEach(resolve => resolve()); }); }

test('a game-generation change during a gated save cannot start the stale lesson position', async ({ page }) => {
  await liveGame(page); await lesson(page); await gateSave(page); await page.locator('#lessonPlayStart').click();
  await page.locator('#lessonPlayConfirm .primary').click(); await expect.poll(() => page.evaluate(() => window.__practiceDigests.length)).toBeGreaterThan(0);
  await page.locator('#modeAnalyse').click(); const after = await game(page); expect(after.mode).toBe('analysis');
  await releaseSave(page); await expect(page.locator('#lessonPlayer')).toBeHidden();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games') || '[]').length)).toBeGreaterThan(0);
  expect(await game(page)).toEqual(after);
});

test('a move in the same game during a gated save rejects the start instead of replacing the newer position', async ({ page }) => {
  await liveGame(page); const before = await game(page); await lesson(page); await gateSave(page); await page.locator('#lessonPlayStart').click();
  await page.locator('#lessonPlayConfirm .primary').click(); await expect.poll(() => page.evaluate(() => window.__practiceDigests.length)).toBeGreaterThan(0);
  await move(page, 'g1', 'f3'); await releaseSave(page);
  await expect(page.locator('#lessonPlayStatus')).toHaveText('The current game changed. Start the lesson position again when ready.');
  const after = await game(page); expect(after.id).toBe(before.id); expect(after.gen).toBe(before.gen); expect(after.fens.length).toBeGreaterThan(3); expect(after.start).toBe(before.start);
});

test('a replacement lesson request waits for the aborted save and starts only its newly confirmed position', async ({ page }) => {
  await liveGame(page); await lesson(page); await gateSave(page); await page.locator('#lessonPlayStart').click();
  await page.locator('#lessonPlayConfirm .primary').click(); await expect.poll(() => page.evaluate(() => window.__practiceDigests.length)).toBeGreaterThan(0);
  await page.locator('#lessonExercise').selectOption('back-rank-black'); const target = await page.locator('#lessonBoard').getAttribute('data-fen');
  await page.locator('#lessonPlayStart').click(); await expect(page.locator('#lessonPlayConfirm')).toHaveCount(0);
  await releaseSave(page); await expect(page.locator('#lessonPlayConfirm')).toContainText('You will play Black.');
  await page.locator('#lessonPlayConfirm .primary').click(); await expect(page.locator('#lessonPlayer')).toBeHidden();
  const after = await game(page); expect(after.start).toBe(target); expect(after.start).not.toBe(ROOT); expect(after.userColor).toBe('b');
});

test('German phone play-out controls and confirmation translate and fit', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await liveGame(page); await lesson(page); await page.locator('#lessonPlayColor').selectOption('b'); await page.locator('#lessonPlayStart').click();
  await expect(page.locator('#lessonPlayConfirm')).toContainText('Du spielst Schwarz.'); await expect(page.locator('#lessonPlayConfirm')).toContainText('als unvollendet gespeichert');
  await page.locator('#lessonPlayConfirm').screenshot({ path: info.outputPath('lesson-start-phone.png') });
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#lessonPlayConfirm').getByRole('button', { name: 'Abbrechen' }).click();
});
