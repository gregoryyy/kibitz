import { test, expect, open, S, loadPgn } from './fixtures.mjs';
const FORK = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', PROMO = '7k/8/8/8/8/8/p7/7K b - - 0 1';
const report = (start, side, actual, best, reply, actualReply) => ({ version: 1, engine: 'Stockfish', start, ucis: [actual], side, decisions: [{ ply: 1,
  before: { basis: 'engine', depth: 14, score: { cp: side === 'w' ? 500 : -500 }, pv: [best, ...reply] }, after: { basis: 'engine', depth: 14, score: { cp: 0 }, pv: actualReply }, phase: 'endgame', motif: { status: 'not-checked', proof: null } }] });
const GAMES = [{ id: 'own-fork', kind: 'played', played: true, reviewed: true, userColor: 'w', title: '<img src=x> Fork exercise', pgn: `[SetUp "1"]\n[FEN "${FORK}"]\n\n1. Ke2 *`, analysisReview: report(FORK, 'w', 'e1e2', 'b5c7', ['e8d7', 'c7a8'], ['a8a1']) },
  { id: 'own-promo', kind: 'played', played: true, reviewed: true, userColor: 'b', title: 'Promotion exercise', pgn: `[SetUp "1"]\n[FEN "${PROMO}"]\n\n1... Kg8 *`, analysisReview: report(PROMO, 'b', 'h8g8', 'a2a1q', ['h1h2'], ['h1h2']) }];
const box = page => page.locator('#ownPuzzlePlayer');
async function setup(page) {
  await page.addInitScript(games => { if (!localStorage.getItem('kibitz.games')) localStorage.setItem('kibitz.games', JSON.stringify(games)); }, GAMES);
  await open(page); await page.locator('#modeAnalyse').click();
  await page.evaluate(async ({ fork, promo }) => {
    const { Chess } = await import('/chess.js'), next = (fen, uci) => { const c = new Chess(fen); c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); return c.fen(); };
    const a = (cp, pv) => ({ depth: 14, lines: [{ score: { cp }, pv }] });
    window.__ownCalls = []; window.__ownData = new Map([
      [fork, a(0, ['b5c7', 'e8d7', 'c7a8'])], [next(fork, 'b5c7'), a(0, ['e8d7', 'c7a8'])], [next(fork, 'e1e2'), a(-500, ['a8a1'])], [next(fork, 'e1d2'), a(-50, ['a8a1'])],
      [promo, a(-700, ['a2a1q', 'h1h2'])], [next(promo, 'a2a1q'), a(-700, ['h1h2'])], [next(promo, 'h8g8'), a(0, ['h1h2'])], [next(promo, 'a2a1r'), a(-650, ['h1h2'])],
    ]);
    window.__kibitz.ownPuzzles().setEngine(async fen => { window.__ownCalls.push(fen); if (window.__ownGate) await window.__ownGate; return window.__ownData.get(fen) || null; });
  }, { fork: FORK, promo: PROMO });
  await page.locator('[data-tab="review"]').click(); await expect(page.locator('#ownPuzzleChoice')).toBeVisible();
}
async function start(page, title = 'Fork exercise', label = 'Start exercise') {
  const value = await page.locator('#ownPuzzleChoice option').evaluateAll((options, title) => options.find(o => o.textContent.includes(title)).value, title);
  await page.locator('#ownPuzzleChoice').selectOption(value); await box(page).getByRole('button', { name: label, exact: true }).click(); await expect(page.locator('#ownPuzzleMove')).toBeEnabled();
}
async function answer(page, move, label = 'Check move') { await page.locator('#ownPuzzleMove').fill(move); await box(page).getByRole('button', { name: label, exact: true }).click(); }

test('freshly checked own-game exercise accepts another strong legal move and leaves the main game and source collection intact', async ({ page }) => {
  const providers = []; page.on('request', r => { if (/\/api\/ai\/(?:sample|structured|embeddings)$/.test(new URL(r.url()).pathname)) providers.push(r.url()); });
  await setup(page); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6'); await page.locator('#btnFirst').click(); await page.locator('[data-tab="review"]').click(); await start(page);
  const before = await S(page), stored = await page.evaluate(() => localStorage.getItem('kibitz.games')), orientation = await page.evaluate(() => window.__kibitz.S.orientation);
  await page.locator('#ownPuzzleBoard').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('f'); expect(await S(page)).toEqual(before); expect(await page.evaluate(() => window.__kibitz.S.orientation)).toBe(orientation);
  await answer(page, 'Ke2'); await expect(page.locator('#ownPuzzleStatus')).toContainText('below the current target'); await expect(page.locator('#ownPuzzleBoard')).toHaveAttribute('data-fen', FORK);
  await answer(page, 'Kd2'); await expect(page.locator('#ownPuzzleStatus')).toHaveText('Your move meets the engine target.'); await expect(box(page)).toContainText('Attempts: 2 · hints: 0');
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(stored); expect(providers).toEqual([]); await expect(box(page).locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__ownCalls.length)).toBe(4);
});

test('unknown engine evidence gives no failed attempt; hints and reveal stay distinct from an independent solve', async ({ page }) => {
  await setup(page); await start(page); await answer(page, 'Kf2'); await expect(page.locator('#ownPuzzleStatus')).toContainText('without a penalty'); await expect(box(page)).toContainText('Attempts: 0 · hints: 0');
  await box(page).getByRole('button', { name: 'Hint', exact: true }).click(); await expect(box(page)).toContainText('Consider the piece on b5.');
  await box(page).getByRole('button', { name: 'Reveal checked line' }).click(); await expect(page.locator('#ownPuzzleStatus')).toContainText('not an independent solve'); await expect(page.locator('#ownPuzzleMove')).toBeDisabled(); await expect(box(page)).toContainText('Nc7+ Kd7 Nxa8');
});

test('Black board promotion requires a choice and another qualified underpromotion is accepted', async ({ page }) => {
  await setup(page); await start(page, 'Promotion exercise'); await answer(page, 'a2a1'); await expect(page.locator('#ownPuzzlePromotion')).toBeVisible();
  await page.locator('#ownPuzzlePromotion [data-piece="r"]').click(); await expect(page.locator('#ownPuzzleStatus')).toHaveText('Your move meets the engine target.'); await expect(page.locator('#ownPuzzleBoard')).toHaveAttribute('data-fen', /r6K/);
});

test('held grading and promotion actions cannot alter a replacement game', async ({ page }) => {
  await setup(page); await start(page); await page.evaluate(() => { window.__ownGate = new Promise(resolve => { window.__releaseOwn = resolve; }); });
  await answer(page, 'Kd2'); await expect(page.locator('#ownPuzzleStatus')).toHaveText('Checking your move…'); await page.locator('#modePlay').click(); const before = await S(page);
  await page.evaluate(() => { window.__releaseOwn(); window.__ownGate = null; }); await expect(box(page)).toContainText('hidden while you play'); expect(await S(page)).toEqual(before); await expect(page.locator('#ownPuzzleMove')).toHaveCount(0);
  await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="review"]').click(); await start(page, 'Promotion exercise'); await answer(page, 'a2a1');
  await page.locator('#ownPuzzlePromotion [data-piece="q"]').evaluate(button => { window.__heldOwnPromotion = button; }); await page.keyboard.press('Escape'); await page.locator('#modePlay').click(); const restored = await S(page);
  await page.evaluate(() => window.__heldOwnPromotion.click()); expect(await S(page)).toEqual(restored);
});

test('a library switch removes own-source exercises and rejects an old prepared source action', async ({ page }) => {
  await setup(page); await start(page); await box(page).getByRole('button', { name: 'Open source position' }).evaluate(button => { window.__heldOwnSource = button; });
  await page.locator('[data-tab="library"]').click(); await expect(page.locator('#libUseServer')).toBeVisible(); await page.locator('#libUseServer').click(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server');
  await page.locator('[data-tab="review"]').click(); await expect(box(page)).toContainText('Review your own played games'); const before = await S(page); await page.evaluate(() => window.__heldOwnSource.click()); expect(await S(page)).toEqual(before); await expect(page.locator('#ownPuzzleChoice')).toHaveCount(0);
});

test('German phone practice uses literal source text, German move input and accessible controls without overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await setup(page); await start(page, 'Promotion exercise', 'Aufgabe starten');
  await expect(box(page)).toContainText('Aus eigenen Fehlern lernen'); await answer(page, 'a1=T+', 'Zug prüfen'); await expect(page.locator('#ownPuzzleStatus')).toHaveText('Dein Zug erreicht das Engine-Ziel.');
  await box(page).scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath('own-puzzles-phone.png') });
});

test('keyboard focus on an authored lesson board cannot navigate or flip the main board', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6'); await page.locator('#btnFirst').click();
  const before = await S(page), orientation = await page.evaluate(() => window.__kibitz.S.orientation);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#curriculumLevel').selectOption('4'); await page.locator('#curriculumModule').selectOption('tactics');
  await page.locator('[data-lesson-id="back-rank-mate"] summary').click(); await page.locator('[data-open-exercise="back-rank-white"]').click();
  await page.locator('#lessonBoard').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('f');
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => window.__kibitz.S.orientation)).toBe(orientation);
});

test('the real WASM engine prepares a missed mate, and another actual mate succeeds by rules', async ({ page }) => {
  const fen = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1';
  const game = { id: 'real-mate', kind: 'played', played: true, reviewed: true, userColor: 'w', title: 'Missed mate before stalemate', pgn: `[SetUp "1"]\n[FEN "${fen}"]\n\n1. Qe6 *`,
    analysisReview: { version: 1, engine: 'Stockfish', start: fen, ucis: ['f7e6'], side: 'w', decisions: [{ ply: 1, before: { basis: 'engine', depth: 14, score: { cp: 500 }, pv: ['f7f8'] }, after: { basis: 'rules', depth: 0, score: { cp: 0 }, pv: [] }, phase: 'endgame', motif: { status: 'not-checked', proof: null } }] } };
  await page.addInitScript(g => localStorage.setItem('kibitz.games', JSON.stringify([g])), game); await open(page); await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="review"]').click();
  await expect(page.locator('#ownPuzzleChoice')).toBeVisible(); const before = await S(page); await start(page, 'Missed mate before stalemate'); await answer(page, 'Qf8#');
  await expect(page.locator('#ownPuzzleStatus')).toHaveText('Checkmate, verified by the chess rules.'); expect(await S(page)).toEqual(before);
});

test('own-mistake schedules persist separately, open through the due queue and recheck the target', async ({ page }) => {
  await setup(page); await start(page); await answer(page, 'Kd2');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.practiceSchedule')));
  expect(saved.entries[0]).toMatchObject({ card: { kind: 'own' }, basis: 'engine-target', record: { reviews: 1, intervalDays: 1 } });
  await page.clock.setFixedTime(saved.entries[0].record.due + 1); await page.locator('[data-tab="lessons"]').click();
  await page.locator('#practiceType').selectOption('own'); await page.locator('#practiceNew').uncheck();
  await expect(page.locator('#practiceQueue > li')).toHaveCount(1); const calls = await page.evaluate(() => window.__ownCalls.length);
  await page.locator('#practiceQueue button').click(); await expect(page.locator('#ownPuzzleMove')).toBeEnabled();
  expect(await page.evaluate(() => window.__ownCalls.length)).toBe(calls + 3); await answer(page, 'Kd2');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.practiceSchedule')).entries[0].record.intervalDays)).toBe(3);
  await page.locator('[data-tab="lessons"]').click(); await page.locator('#practiceNew').check();
  await page.locator('#practiceQueue button').evaluate(button => { window.__heldOwnQueue = button; });
  await page.locator('[data-tab="library"]').click(); await page.locator('#libUseServer').click(); await expect(page.locator('#libWhere')).toHaveText('Saved on this server');
  await page.locator('[data-tab="lessons"]').click(); await expect(page.locator('#practiceCounts')).toHaveText('Due: 0 · new: 0 · upcoming: 0');
  await page.evaluate(() => window.__heldOwnQueue.click()); await expect(page.locator('[data-pane="lessons"]')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.practiceSchedule')).entries)).toHaveLength(1);
});

test('own grading remains visible when a schedule save fails and its source-bound receipt retries once', async ({ page }) => {
  await page.addInitScript(() => {
    window.__failOwnSchedule = true; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'kibitz.practiceSchedule' && window.__failOwnSchedule) throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await setup(page); await start(page); await answer(page, 'Kd2');
  await expect(page.locator('#ownPuzzleStatus')).toHaveText('Your move meets the engine target.'); await expect(page.locator('#ownPracticeSaveStatus')).toContainText('Pending practice results: 1');
  await page.evaluate(() => { window.__failOwnSchedule = false; }); await page.locator('#ownPracticeRetry').click();
  await expect(page.locator('#ownPracticeRetry')).toBeHidden(); await expect(page.locator('#ownPracticeSaveStatus')).toContainText('saved in this browser');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.practiceSchedule')).entries[0].record.reviews)).toBe(1);
});
