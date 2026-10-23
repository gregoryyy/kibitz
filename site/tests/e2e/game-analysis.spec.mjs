// Direct mode switches must preserve separate game and study sessions without involving chat.
import { test, expect, open, S } from './fixtures.mjs';

const typeMove = async (page, san) => {
  await page.locator('#moveInput').fill(san);
  await page.locator('#moveInput').press('Enter');
};
/** Capture game identity/history independently of evaluations arriving in the background. */
const board = page => page.evaluate(() => {
  const { S } = window.__kibitz;
  return { gameId: S.gameId, start: S.start, fens: S.nodes.map(n => n.fen), cursor: S.cursor,
    orientation: S.orientation, userColor: S.userColor, startPly: S.startPly, over: S.over };
});

test('Analyse pauses immediately; Play restores the timed game and revisiting keeps the study branch', async ({ page }) => {
  const calls = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) calls.push(r); });
  await open(page);
  await page.locator('#optClock button[data-v="3+2"]').click();
  await page.locator('#btnNewGame').click();
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect.poll(async () => (await S(page)).thinking).toBe(false);
  await page.locator('#btnFirst').click();
  const live = await board(page);
  const remaining = await page.evaluate(() => {
    const c = window.__kibitz.S.clock;
    return c.w - (c.turn === 'w' ? performance.now() - c.since : 0);
  });
  const games = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('#modeAnalyse')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#confirmSlot')).toBeEmpty();
  await expect(page.locator('#boardReturn')).toBeVisible();
  expect(await board(page)).toEqual(live);
  expect(await page.evaluate(() => window.__kibitz.S.clock)).toBeNull();
  await typeMove(page, 'd4'); // Replace the mainline only in the study copy.
  await page.locator('#btnFirst').click();
  const study = await board(page);
  expect(study.fens).toHaveLength(2);
  await page.waitForTimeout(1100); // The game clock must not charge time spent analysing.
  await page.locator('#modePlay').click();
  expect(await board(page)).toEqual(live);
  const clock = await page.evaluate(() => window.__kibitz.S.clock);
  expect(clock.turn).toBe('w');
  expect(clock.w).toBeLessThanOrEqual(remaining);
  expect(clock.w).toBeGreaterThan(remaining - 1000);
  await page.locator('#modeAnalyse').click();
  expect(await board(page)).toEqual(study);
  await page.locator('#coachInput').fill('return to my game');
  await page.locator('#coachSend').click();
  await expect(page.locator('#coachStop')).toBeHidden();
  expect(await board(page)).toEqual(live);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(games);
  expect(calls).toHaveLength(0);
});

test('once the live game advances, Analyse opens its new position instead of an older study', async ({ page }) => {
  await open(page);
  await page.locator('#modeAnalyse').click();
  await typeMove(page, 'd4');
  await page.locator('#modePlay').click();
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect.poll(async () => (await S(page)).thinking).toBe(false);
  const advanced = await board(page);
  await page.locator('#modeAnalyse').click();
  expect(await board(page)).toEqual(advanced);
  await page.locator('#modePlay').click();
  expect(await board(page)).toEqual(advanced);
});

test('an unanswered analysis challenge cannot intercept the return controls', async ({ page }) => {
  await open(page);
  await page.locator('#optStart button[data-v="fen"]').click();
  await page.locator('#fenInput').fill('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  await page.locator('#btnNewGame').click();
  const live = await board(page);
  const controls = ['#modePlay', '#boardReturn', '#chatReturn'];
  for (const [i, control] of controls.entries()) {
    await page.locator('#modeAnalyse').click();
    await page.locator('#btnChallenge').click();
    await expect(page.locator('#chat .msg.challenge')).toHaveCount(i + 1);
    await page.locator(control).click();
    expect(await S(page)).toMatchObject({ playing: true, mode: 'play', nodes: 1 });
    expect(await board(page)).toEqual(live);
  }
});

test('a cancelled opponent reply cannot play or clear a newer search after the round trip', async ({ page }) => {
  await open(page);
  // Delay only opponent searches. Keep genuine Stockfish for the analysis worker.
  await page.evaluate(async () => {
    const { Engine } = await import('/engine.js');
    const go = Engine.prototype.go;
    window.__replies = [];
    Engine.prototype.go = function (fen, opts = {}) {
      if (opts.tag !== 'move') return go.call(this, fen, opts);
      return new Promise(resolve => window.__replies.push({ fen, resolve }));
    };
  });
  await typeMove(page, 'e4');
  await expect.poll(() => page.evaluate(() => window.__replies.length)).toBe(1);
  const live = await board(page);
  await page.locator('#modeAnalyse').click();
  await expect.poll(async () => (await S(page)).mode).toBe('analysis');
  expect((await S(page)).thinking).toBe(false);
  await page.locator('#modePlay').click();
  await expect.poll(() => page.evaluate(() => window.__replies.length)).toBe(2);
  await page.evaluate(() => window.__replies[0].resolve({ best: 'e7e5', lines: [] }));
  await page.waitForTimeout(600);
  expect(await board(page)).toEqual(live);
  expect((await S(page)).thinking).toBe(true);
  await page.evaluate(() => window.__replies[1].resolve({ best: 'e7e5', lines: [] }));
  await expect(page.locator('#moves button')).toHaveCount(2);
  expect((await S(page)).thinking).toBe(false);
});

test('Analyse dismisses an older review confirmation and preserves a scratch line across switches', async ({ page }) => {
  await open(page);
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  const live = await board(page);
  await page.locator('[data-tab="review"]').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('#chatConfirm')).toBeHidden();
  await expect(page.locator('[data-tab="game"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#coachInput').fill('play d4');
  await page.locator('#coachSend').click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  const line = await page.evaluate(() => {
    const { start, sans, fens, i } = window.__kibitz.scratch();
    return { start, sans, fens, i };
  });
  await page.locator('#modePlay').click();
  expect(await board(page)).toEqual(live);
  await expect(page.locator('#scratchBar')).toBeHidden();
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  expect(await page.evaluate(() => {
    const { start, sans, fens, i } = window.__kibitz.scratch();
    return { start, sans, fens, i };
  })).toEqual(line);
});

test('initial and finished games survive analysis, including the result and an unstarted clock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.locator('#optClock button[data-v="3+2"]').click();
  await page.locator('#optStart button[data-v="fen"]').click();
  await page.locator('#fenInput').fill('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  await page.locator('#btnNewGame').click();
  const initial = await board(page);
  await page.locator('#modeAnalyse').click();
  await page.locator('#modePlay').click();
  expect(await board(page)).toEqual(initial);
  expect(await page.evaluate(() => window.__kibitz.S.clock.turn)).toBeNull();
  await typeMove(page, 'Ta8#');
  await expect.poll(async () => (await S(page)).playing).toBe(false);
  const finished = await board(page);
  expect(finished.over).toEqual({ result: '1-0', reason: 'checkmate' });
  await page.locator('#modeAnalyse').click();
  await page.locator('#btnFirst').click();
  await page.locator('#boardReturn').click();
  expect(await board(page)).toEqual(finished);
  expect(await S(page)).toMatchObject({ mode: 'play', playing: false });
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  await page.locator('#chatUndo').click();
  await expect(page.locator('#boardReturn')).toBeVisible();
  expect((await S(page)).mode).toBe('analysis');
  await page.locator('#boardReturn').click();
  expect(await board(page)).toEqual(finished);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
