// Milestone 4 UX: explicit game/review transitions and a composer that keeps the board in view.
import { test, expect, open, S, reveal } from './fixtures.mjs';

const pgn = page => page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));
const play = async page => {
  await page.locator('#btnNewGame').click();
  await page.locator('#moveInput').fill('e4'); await page.locator('#moveInput').press('Enter');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect.poll(async () => (await S(page)).thinking).toBe(false);
};
const review = async page => {
  await page.locator('[data-tab="review"]').click();
  await page.locator('#chatConfirm').getByRole('button', { name: 'Pause and review' }).click();
  await expect.poll(async () => (await S(page)).mode).toBe('analysis');
};

test('Play and Study are grouped; reviewing pauses a game, and both sessions survive a round trip', async ({ page }) => {
  await open(page);
  await expect(page.locator('.tab-group').first().getByRole('tab')).toHaveText(['Game', 'Coach']);
  await expect(page.locator('.tab-group').last().getByRole('tab')).toHaveText(['Review', 'Library', 'Reading', 'Openings']);
  await page.locator('#optClock button[data-v="3+2"]').click();
  await play(page);
  const live = await pgn(page);
  await page.locator('[data-tab="review"]').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  expect((await S(page)).playing).toBe(true);
  await page.locator('#chatConfirm').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('[data-tab="game"]')).toHaveAttribute('aria-selected', 'true');
  expect(await pgn(page)).toBe(live);

  await review(page);
  await expect(page.locator('#boardMode')).toHaveText('Review & analysis');
  expect(await page.evaluate(() => window.__kibitz.S.clock)).toBeNull();
  await expect(page.locator('#btnReview')).toBeEnabled();
  await page.locator('#btnPrev').click();
  await page.locator('#btnReview').click();
  await expect.poll(async () => (await S(page)).reviewDone).toBe(true);
  const study = await S(page);
  await expect(page.locator('#reviewGame')).toHaveText(await page.locator('#boardGame').textContent());

  await page.locator('#boardReturn').click();
  await expect.poll(async () => (await S(page)).playing).toBe(true);
  await expect(page.locator('#boardMode')).toHaveText('Current game');
  await expect(page.locator('[data-tab="game"]')).toHaveAttribute('aria-selected', 'true');
  expect(await pgn(page)).toBe(live);
  const clock = await page.evaluate(() => window.__kibitz.S.clock);
  expect(clock.w).toBeGreaterThan(170_000);
  expect(clock.w).toBeLessThanOrEqual(182_000);

  await page.locator('#chatUndo').click();
  await expect.poll(async () => (await S(page)).mode).toBe('analysis');
  await expect(page.locator('#boardReturn')).toBeVisible();
  await page.locator('#boardReturn').click();
  await expect.poll(async () => (await S(page)).playing).toBe(true);
  expect(await pgn(page)).toBe(live);

  await review(page);
  expect(await S(page)).toMatchObject({ cursor: study.cursor, nodes: study.nodes, reviewDone: true });
  await expect(page.locator('#reviewBody .tiles')).toBeVisible();
});

test('loading a PGN through the panel also keeps the running game, and returning keeps the study', async ({ page }) => {
  await open(page); await play(page);
  const live = await pgn(page);
  await reveal(page, '#loadText');
  await page.locator('#loadText').fill('not a PGN or FEN');
  await page.locator('#btnLoad').click();
  await page.locator('#confirmSlot').getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#boardReturn')).toBeHidden();
  expect((await S(page)).playing).toBe(true);
  expect(await pgn(page)).toBe(live);
  await page.locator('#loadText').fill('[White "Study White"]\n[Black "Study Black"]\n\n1. d4 d5');
  await page.locator('#btnLoad').click();
  await page.locator('#confirmSlot').getByRole('button', { name: 'Load', exact: true }).click();
  await expect(page.locator('#boardGame')).toContainText('Study White – Study Black');
  const study = await pgn(page);
  await page.locator('#boardReturn').click();
  await expect.poll(async () => (await S(page)).playing).toBe(true);
  expect(await pgn(page)).toBe(live);
  await review(page);
  expect(await pgn(page)).toBe(study);
});

test('the Analyse mode switch keeps a way back to the running game', async ({ page }) => {
  await open(page); await play(page);
  const live = await pgn(page);
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('#boardReturn')).toBeVisible();
  await page.locator('#modePlay').click();
  await expect.poll(async () => (await S(page)).playing).toBe(true);
  expect(await pgn(page)).toBe(live);
});

test('a pending review confirmation cannot replace a newly started game', async ({ page }) => {
  await open(page); await play(page);
  await page.locator('[data-tab="review"]').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  await page.locator('#btnNewGame').click();
  await page.locator('#confirmSlot').getByRole('button', { name: 'Leave and start new' }).click();
  await expect(page.locator('#chatConfirm')).toBeHidden();
  expect(await S(page)).toMatchObject({ mode: 'play', playing: true, nodes: 1 });
  await expect(page.locator('#boardReturn')).toBeHidden();
});

test('a confirmed tactic later in a tool line opens from its own position', async ({ page }) => {
  await page.route('**/api/ai/sample', r => {
    if (r.request().postDataJSON().messages.at(-1)?.role !== 'tool') return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ text: 'The follow-up is 4. Qxf7#.' }, { done: true, truncated: false }].map(x => JSON.stringify(x)).join('\n') + '\n' });
  });
  await open(page); await page.locator('#modeAnalyse').click();
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
  await page.locator('#coachInput').fill(`Check the mate [mock:action:find_motifs ${JSON.stringify({ fen, line: ['Nf6', 'Qxf7#'] })}]`);
  await page.locator('#coachSend').click();
  const san = page.locator('#chat .msg.coach').last().locator('.san.in-line');
  await expect(san).toHaveText('Qxf7#');
  await san.click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  const scratch = await page.evaluate(() => window.__kibitz.scratch());
  expect(scratch.start.split(' ')[1]).toBe('w');
  expect(scratch.start.split(' ')[0]).toContain('2n2n2');
  expect(scratch.sans).toEqual(['Qxf7#']);
});

test('phone portrait, landscape and tablet: typing with a reduced viewport keeps board and composer visible', async ({ page }) => {
  await open(page);
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (size.width >= 720) {
      const board = await page.locator('#board').boundingBox(), chat = await page.locator('#dialogue').boundingBox();
      expect(chat.x).toBeGreaterThan(board.x + board.width);
    }
    await page.locator('#coachInput').fill('Keep the board in view while I type');
    await expect(page.locator('body')).toHaveClass(/chat-typing/);
    const keyboardHeight = size.height < 500 ? 240 : 420;
    await page.setViewportSize({ width: size.width, height: keyboardHeight });
    for (const selector of ['#board', '#coachInput', '#coachSend']) {
      await expect.poll(async () => {
        const b = await page.locator(selector).boundingBox();
        return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= size.width + 1 && b.y + b.height <= keyboardHeight + 1;
      }, { message: `${selector} stays in the visible viewport at ${size.width}×${keyboardHeight}` }).toBe(true);
    }
    await page.locator('#chatFocusClose').click();
    await expect(page.locator('body')).not.toHaveClass(/chat-typing/);
    await page.setViewportSize(size);
  }
});
