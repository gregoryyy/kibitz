// The board speaks (TODO 4.2-4.7): lines in an answer preview and step on a scratch board, the
// coach's board marks are checked before they're drawn, and the player can try moves, all without
// touching the game.
import { test, expect, open, move, loadPgn, OPERA } from './fixtures.mjs';

const answerWith = (page, text) => page.route('**/api/ai/sample', r => r.fulfill({
  status: 200, contentType: 'application/x-ndjson',
  body: [{ text }, { done: true, truncated: false }].map(l => JSON.stringify(l)).join('\n') + '\n',
}));
const K = (page, f) => page.evaluate(f);
const ask = async (page, q = 'What now?') => {
  await page.locator('#coachInput').fill(q); await page.locator('#coachSend').click();
  const a = page.locator('#chat .msg.coach').last();
  await expect(a).not.toHaveClass(/thinking/);
  return a;
};

test('a line in an answer: hovering previews the position before a move, a click steps through it on the scratch board', async ({ page }) => {
  await answerWith(page, 'Start with 1. e4 e5 2. Nf3, the main line.');
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page);
  await expect(a.locator('.san.in-line')).toHaveCount(3);
  await a.locator('.san', { hasText: 'Nf3' }).hover();
  await expect(page.locator('#boardPreview')).toHaveText('Before 2. Nf3');
  await page.locator('#coachInput').hover();
  await expect(page.locator('#boardPreview')).toBeHidden();

  await a.locator('.san', { hasText: 'e5' }).click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  await expect(page.locator('#scratchTitle')).toHaveText('Line from the coach');
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4', 'e5', '2. Nf3']);
  await expect(page.locator('#scratchMoves button[aria-current="true"]')).toHaveText('e5');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#scratchMoves button[aria-current="true"]')).toHaveText('2. Nf3');
  expect(await K(page, () => window.__kibitz.S.nodes.length)).toBe(1); // the game is untouched
  await page.locator('#scratchClose').click();
  await expect(page.locator('#scratchBar')).toBeHidden();
  expect(await K(page, () => window.__kibitz.scratch())).toBeNull();
});

test('the coach\'s board marks: checked, drawn, the rest counted; the block never shows as text', async ({ page }) => {
  await answerWith(page, 'Watch f7, and develop the knight.\n\n```board\nsquare f7\narrow g1 f3\narrow e2 e5\nghost wN d5\nlabel d5 !\n```');
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page);
  await expect(a).not.toContainText('```');
  await expect(a).not.toContainText('ghost');
  await expect(a.locator('.check-note')).toHaveText('One board mark didn\'t fit the position and was left out.');
  await expect(a.locator('.board-marks button')).toHaveText('Show the 4 marks on the board');
  const marks = await K(page, () => window.__kibitz.marks());
  expect(marks.shapes).toMatchObject([
    { orig: 'f7', brush: 'san' },
    { orig: 'g1', dest: 'f3', brush: 'san' },
    { orig: 'd5', brush: 'san', piece: { role: 'knight', color: 'white', scale: 0.8 } },
    { orig: 'd5', brush: 'san', label: { text: '!' } },
  ]);
  await expect(page.locator('#board svg .cg-shapes g, #board cg-auto-pieces piece, #board svg g')).not.toHaveCount(0);
});

test('hostile or malformed board marks draw nothing and run nothing', async ({ page }) => {
  let alerted = false;
  page.on('dialog', d => { alerted = true; d.dismiss(); });
  await answerWith(page, 'Fine.\n\n```board\n<img src=x onerror=alert(1)>\narrow e2 e9\nlabel e4 <script>alert(1)</script>\nghost wQ e2\n```');
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page);
  await expect(a.locator('img, script')).toHaveCount(0);
  await expect(a.locator('.check-note')).toHaveText('4 board marks didn\'t fit the position and were left out.');
  await expect(a.locator('.board-marks')).toHaveCount(0);
  expect(await K(page, () => window.__kibitz.marks())).toBeNull();
  expect(alerted).toBe(false);
});

test('what if: the player tries moves on a scratch board, Stockfish evaluates, the coach gets the line', async ({ page }) => {
  let sent = null;
  await page.route('**/api/ai/sample', async r => { sent = r.request().postDataJSON(); await r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ text: 'After 1. e4 the centre is yours.' }, { done: true, truncated: false }].map(l => JSON.stringify(l)).join('\n') + '\n' }); });
  await open(page);
  await page.locator('#modeAnalyse').click();
  await page.locator('#btnWhatIf').click();
  await expect(page.locator('#scratchTitle')).toHaveText('What if…');
  await move(page, 'e2', 'e4');
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4']);
  await expect(page.locator('#scratchEval')).toContainText('Stockfish:', { timeout: 30_000 });
  await move(page, 'e7', 'e5');
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4', 'e5']);
  expect(await K(page, () => window.__kibitz.S.nodes.length)).toBe(1); // the game is untouched
  await page.locator('#scratchAsk').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('the centre is yours');
  const prompt = sent.messages.at(-1).content;
  expect(prompt).toContain('trying a line on a scratch board');
  expect(prompt).toContain('1. e4 e5');
  expect(prompt).toContain('Aspects the player picked for comments:');
  await expect(page.locator('#chat .msg.coach').last().locator('.san.invalid')).toHaveCount(0); // its own line counts as backed
});

test('in a game with flags only, no what-if board; a line from an answer can be stepped, not played on', async ({ page }) => {
  await answerWith(page, 'Think about 1. e4 e5 2. Nf3.');
  await open(page);
  await page.locator('#optHelp button[data-v="flags"]').click();
  await page.locator('#btnNewGame').click();
  await expect(page.locator('#btnWhatIf')).toBeHidden();
  const a = await ask(page);
  await a.locator('.san', { hasText: 'Nf3' }).click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  expect(await K(page, () => window.__kibitz.scratch().free)).toBe(false);
  await expect(page.locator('#scratchEval')).toHaveText(''); // no engine view while the help setting hides it
});

test('the scratch board closes as soon as the game moves under it', async ({ page }) => {
  await open(page);
  await loadPgn(page, OPERA);
  await page.locator('#moves button >> nth=3').click();
  await page.locator('#btnWhatIf').click();
  await expect(page.locator('#scratchBar')).toBeVisible();
  await page.locator('#btnPrev').click();
  await expect(page.locator('#scratchBar')).toBeHidden();
  expect(await K(page, () => window.__kibitz.scratch())).toBeNull();
});
