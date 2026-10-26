// Playing against Stockfish: start positions, typed moves, clocks, draw offers, NAGs (TODO 1.6-1.12).
import { test, expect, open, S, reveal, loadPgn } from './fixtures.mjs';

const typeMove = async (page, san) => { await page.locator('#moveInput').fill(san); await page.locator('#moveInput').press('Enter'); };
async function startFromFen(page, fen, { color = 'w' } = {}) {
  await page.locator(`#optColor button[data-v="${color}"]`).click();
  await page.locator('#optStart button[data-v="fen"]').click();
  await page.locator('#fenInput').fill(fen);
  await page.locator('#btnNewGame').click();
}

test('a full game from a position: typed moves, Stockfish replies, checkmate, saved and reviewed', async ({ page }) => {
  await open(page);
  // 1. Qd7 leaves Black only Kf8 or Kh8; 2. Re8 mates after either.
  await startFromFen(page, '6k1/2Q5/8/8/8/4R3/8/1K6 w - - 0 1');
  await expect(page.locator('#openingName')).toHaveText('Custom position');
  await typeMove(page, 'Qd7');
  await expect(page.locator('#announce')).toHaveText('You played queen d7.');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect(page.locator('#announce')).toHaveText(/^Stockfish played king [fh]8\.$/);
  await typeMove(page, 'Re8');
  await expect(page.locator('#flagSlot')).toContainText('Game over: 1-0 by checkmate');
  const pgn = await page.evaluate(() => window.__kibitz.toPGN());
  expect(pgn).toContain('[FEN "6k1/2Q5/8/8/8/4R3/8/1K6 w - - 0 1"]');
  expect(pgn).toMatch(/1\. Qd7 K[fh]8 2\. Re8# 1-0/);
  await page.locator('[data-tab="library"]').click();
  await expect(page.locator('#libList .game').first()).toContainText('1-0');
  await page.locator('[data-tab="review"]').click();
  await page.locator('#btnReview').click();
  await expect(page.locator('#reviewBody .tiles')).toBeVisible({ timeout: 60_000 });
});

test('typed moves: illegal or out-of-turn input is explained and nothing is played', async ({ page }) => {
  await open(page);
  await typeMove(page, 'e5');
  await expect(page.locator('#moveInputMsg')).toHaveText("e5 isn't a legal move here.");
  await typeMove(page, 'Nf3');
  await expect(page.locator('#moves button')).toHaveCount(2);
  expect((await S(page)).nodes).toBe(3);
});

test('a broken FEN is explained before the game starts; stale castling rights are dropped', async ({ page }) => {
  await open(page);
  await page.locator('#optStart button[data-v="fen"]').click();
  await page.locator('#fenInput').fill('k7/1Q6/8/8/8/8/8/K7 w - - 0 1');
  await expect(page.locator('#startHint')).toHaveText("The side that isn't to move is in check.");
  await page.locator('#fenInput').fill('4k3/8/8/8/8/8/8/4K2R b KQkq - 0 1');
  await expect(page.locator('#startHint')).toContainText('Black to move');
  await page.locator('#btnNewGame').click();
  // White to start? No: Black is to move and the player has White, so Stockfish moves first.
  await expect(page.locator('#moves button')).toHaveCount(1);
  expect(await page.evaluate(() => window.__kibitz.S.start)).toBe('4k3/8/8/8/8/8/8/4K2R b K - 0 1');
});

test('start after an opening: its moves are set up and can\'t be taken back', async ({ page }) => {
  await open(page);
  await page.locator('#optStart button[data-v="opening"]').click();
  await page.locator('#openingSearch').fill('najdorf');
  await page.locator('#openingResults button', { hasText: /^B90Sicilian Defense: Najdorf Variation$/ }).click();
  await expect(page.locator('#startHint')).toContainText('1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6');
  await page.locator('#btnNewGame').click();
  await expect(page.locator('#moves button')).toHaveCount(10);
  await expect(page.locator('#openingName')).toHaveText('Sicilian Defense: Najdorf Variation');
  await expect(page.locator('#btnTakeback')).toBeDisabled();
  await typeMove(page, 'Be3');
  await expect(page.locator('#moves button')).toHaveCount(12);
  await page.locator('#btnTakeback').click();
  await expect(page.locator('#moves button')).toHaveCount(10);
  await expect(page.locator('#btnTakeback')).toBeDisabled();
  // The choice is remembered.
  await page.reload();
  await expect(page.locator('#startHint')).toContainText('B90 Sicilian Defense: Najdorf Variation');
});

test('clock: Stockfish uses its time, and the player loses on time', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.locator('#optClock button[data-v="3+2"]').click();
  await page.locator('#btnNewGame').click();
  await expect(page.locator('#playerBottom .clock')).toHaveText('3:00');
  await typeMove(page, 'e4');               // White's first move starts Black's clock
  await page.clock.runFor(100);             // the scheduled reply starts
  // A fast worker can finish its reply before the first polling observation.
  await expect.poll(() => S(page).then(s => s.thinking || s.nodes === 3), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => { await page.clock.runFor(200); return (await S(page)).nodes; }, { timeout: 20_000 }).toBe(3);
  const clk = await page.evaluate(() => ({ after1: window.__kibitz.S.nodes[1].clk, after2: window.__kibitz.S.nodes[2].clk, turn: window.__kibitz.S.clock.turn }));
  expect(clk.after1).toEqual({ w: 180_000, b: 180_000 }); // White's first move isn't timed
  expect(clk.after2.w).toBe(180_000);
  expect(clk.after2.b).toBeGreaterThan(170_000); expect(clk.after2.b).toBeLessThanOrEqual(182_000); // thinking time, then +2 s
  expect(clk.turn).toBe('w');
  await expect(page.locator('#playerBottom .clock')).toHaveClass(/run/);
  await page.clock.runFor(181_000);
  await expect(page.locator('#flagSlot')).toContainText('Game over: 0-1 by timeout');
  await expect(page.locator('#playerBottom .clock')).toHaveText('0.0');
  const pgn = await page.evaluate(() => window.__kibitz.toPGN());
  expect(pgn).toContain('[TimeControl "180+2"]');
  expect(pgn).toContain('[Termination "time forfeit"]');
});

test('draw offers: Stockfish declines when better, accepts when clearly worse', async ({ page }) => {
  await open(page);
  // Stockfish (Black) has two extra rooks: it declines, and the next offer has to wait.
  await startFromFen(page, '4k3/r7/r7/8/8/8/8/4K3 w - - 0 1');
  await typeMove(page, 'Kd2');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('#btnDraw').click();
  await expect(page.locator('#toast')).toHaveText('Stockfish declines the draw and plays on.');
  await expect(page.locator('#btnDraw')).toBeDisabled();
  // Now White has the two rooks: Stockfish takes the draw.
  await page.locator('#btnResign').click(); await page.locator('#confirmSlot .btn.primary').click();
  await startFromFen(page, '4k3/8/8/8/8/8/R7/R3K3 w - - 0 1');
  await typeMove(page, 'Ra3');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('#btnDraw').click();
  await expect(page.locator('#flagSlot')).toContainText('Game over: 1/2-1/2 by agreement');
});

test('NAGs from an imported PGN show in the move list and survive export', async ({ page }) => {
  await open(page);
  await loadPgn(page, '[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 2. Nf3!? Nc6 $2 3. Bb5 $14 (3. Bc4 $1) *');
  await expect(page.locator('#moves button', { hasText: 'Nf3' })).toHaveText('Nf3!?');
  await expect(page.locator('#moves button', { hasText: 'Nc6' })).toHaveText('Nc6?');
  await expect(page.locator('#moves button', { hasText: 'Bb5' })).toHaveText('Bb5⩲');
  const pgn = await page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));
  expect(pgn).toMatch(/2\. Nf3 \$5 Nc6 \$2 3\. Bb5 \$14/);
  await reveal(page, '#loadText');
  await loadPgn(page, pgn); // round trip
  await expect(page.locator('#moves button', { hasText: 'Nc6' })).toHaveText('Nc6?');
});

// Is the position on the board analysed? (Then the old tooltip would have shown its score.)
const analysed = page => page.evaluate(() => { const { S, ANA } = window.__kibitz; return ANA.has(S.nodes[S.cursor].fen.split(' ').slice(0, 4).join(' ')); });

test('help "Eval + mistakes": the bar shows the position after your move and holds it through Stockfish\'s reply', async ({ page }) => {
  await open(page);
  await page.locator('#optHelp button[data-v="eval"]').click();
  await expect(page.locator('#helpHint')).toContainText('holds while Stockfish replies');
  await page.locator('#btnNewGame').click();
  await expect(page.locator('#evalbar')).toHaveClass(/hidden-eval/); // no move of yours yet
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect.poll(() => analysed(page), { timeout: 30_000 }).toBe(true);
  await expect(page.locator('#evalbar')).not.toHaveClass(/hidden-eval/);
  await expect(page.locator('#evalbar')).toHaveAttribute('title', /^Stockfish after your move 1\. e4: [+−]?\d/);
  await expect(page.locator('#evalW')).not.toHaveAttribute('style', 'height: 50%;');
  await expect(page.locator('svg .best, [data-brush="best"]')).toHaveCount(0); // no best-move arrow
});

test('help "Eval + mistakes": the coach\'s context line says what the eval bar shows, not that it is hidden', async ({ page }) => {
  await open(page);
  await page.locator('#optHelp button[data-v="eval"]').click();
  await page.locator('#btnNewGame').click();
  await expect(page.locator('#coachCtx')).toContainText('eval after your first move');
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect(page.locator('#coachCtx')).toContainText(/eval after your move 1\. e4: [+−]?\d/, { timeout: 30_000 });
  await expect(page.locator('#coachCtx')).not.toContainText('hidden');
  await page.locator('#optHelp button[data-v="flags"]').click();
  await expect(page.locator('#coachCtx')).toContainText('eval hidden while you play');
});

test('with the evaluation hidden, its tooltip has no score either', async ({ page }) => {
  await open(page);
  await page.locator('#optHelp button[data-v="flags"]').click();
  await page.locator('#btnNewGame').click();
  await typeMove(page, 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect.poll(() => analysed(page), { timeout: 30_000 }).toBe(true);
  await expect(page.locator('#evalbar')).toHaveClass(/hidden-eval/);
  await expect(page.locator('#evalbar')).toHaveAttribute('title', 'Engine evaluation: hidden while you play');
});
