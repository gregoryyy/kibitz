import { test, expect, open, S, loadPgn, move } from './fixtures.mjs';

const square = (page, sq) => page.locator(`#keyboardBoard [data-keyboard-square="${sq}"]`);
const position = fen => `[SetUp "1"]\n[FEN "${fen}"]\n\n*`;
const PROMO = '7k/P7/8/8/8/8/8/7K w - - 0 1';
const uci = page => page.evaluate(() => window.__kibitz.S.nodes.at(-1).uci);
async function keyboardMove(page, from, keys) {
  await square(page, from).focus(); await page.keyboard.press('Enter');
  for (const key of keys) await page.keyboard.press(key);
  await page.keyboard.press('Enter');
}
async function fakeAnswer(page, text) {
  await page.route('**/api/ai/sample', route => route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text }) + '\n' + JSON.stringify({ done: true }) + '\n' }));
}
async function ask(page) { await page.locator('#coachInput').fill('Explain this board'); await page.locator('#coachSend').click(); await expect(page.locator('#chat .msg.coach').last()).not.toHaveClass(/thinking/); }
async function fixedStart(page) {
  await page.evaluate(() => window.__kibitz.ANA.set('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', { depth: 99, multipv: 5, best: 'e2e4', lines: [{ score: { cp: 30 }, pv: ['e2e4', 'e7e5', 'g1f3'] }] }));
}

test('native board has one Tab stop, descriptive cells and orientation-aware navigation without history/flip shortcuts', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. e4 e5'); await page.locator('#btnFirst').click();
  const before = await S(page), orientation = await page.evaluate(() => window.__kibitz.S.orientation);
  await expect(page.locator('#keyboardBoard [role="row"]')).toHaveCount(8); await expect(page.locator('#keyboardBoard [role="gridcell"]')).toHaveCount(64); await expect(page.locator('#keyboardBoard [tabindex="0"]')).toHaveCount(1);
  await expect(square(page, 'e2')).toHaveAttribute('aria-label', 'White pawn on e2');
  await square(page, 'e2').focus(); await page.keyboard.press('ArrowRight'); await expect(square(page, 'f2')).toBeFocused(); await page.keyboard.press('f');
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => window.__kibitz.S.orientation)).toBe(orientation);
  await page.keyboard.press('Home'); await expect(square(page, 'a2')).toBeFocused(); await page.keyboard.press('End'); await expect(square(page, 'h2')).toBeFocused();
  await page.keyboard.press('Control+Home'); await expect(square(page, 'a8')).toBeFocused(); await page.keyboard.press('Control+End'); await expect(square(page, 'h1')).toBeFocused();
  await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#keyboardBoard'))).toBe(false);
  await keyboardMove(page, 'e2', ['ArrowUp', 'ArrowUp']); expect(await uci(page)).toBe('e2e4'); await expect(square(page, 'e4')).toHaveAttribute('aria-label', 'White pawn on e4');
});

test('Black-oriented keyboard moves follow visual directions and accept Space activation', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. e4'); await page.locator('#btnFlip').click();
  await expect(page.locator('#keyboardBoard [role="row"]').first().locator('[role="gridcell"]').first()).toHaveAttribute('data-keyboard-square', 'h1');
  await square(page, 'e7').focus(); await page.keyboard.press('ArrowRight'); await expect(square(page, 'd7')).toBeFocused(); await page.keyboard.press('ArrowLeft'); await expect(square(page, 'e7')).toBeFocused();
  await page.keyboard.press('Space'); await expect(square(page, 'e5')).toHaveAttribute('aria-label', /Legal destination/); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Space');
  expect(await uci(page)).toBe('e7e5'); await expect(square(page, 'e5')).toHaveAttribute('aria-label', 'Black pawn on e5');
});

test('read-only positions reject input and a replacement game clears the captured keyboard origin', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, position('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'));
  const idle = await S(page); await expect(page.locator('#keyboardBoard')).toHaveAttribute('aria-readonly', 'true'); await square(page, 'h8').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#keyboardStatus')).toContainText('cannot be entered'); expect(await S(page)).toEqual(idle);
  await page.locator('#btnNewGame').click(); await square(page, 'e2').focus(); await page.keyboard.press('Enter'); await expect(square(page, 'e2')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#btnNewGame').click(); await expect(page.locator('#keyboardBoard [aria-selected="true"]')).toHaveCount(0);
  await square(page, 'e4').focus(); await page.keyboard.press('Enter'); expect((await S(page)).nodes).toBe(1);
  await keyboardMove(page, 'e2', ['ArrowUp', 'ArrowUp']); await expect.poll(async () => (await S(page)).nodes).toBeGreaterThanOrEqual(3);
  await expect(page.locator('#keyboardBoard')).toHaveAttribute('aria-readonly', 'false');
});

test('keyboard promotion focuses explicit choices, cancels cleanly and restores focus after underpromotion for either side', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, position(PROMO));
  await keyboardMove(page, 'a7', ['ArrowUp']); await expect(page.locator('#promo')).toBeVisible(); await expect(page.locator('#promo [aria-label="Promote to queen"]')).toBeFocused(); await expect(page.locator('#keyboardBoard')).toBeHidden();
  await page.keyboard.press('Escape'); await expect(page.locator('#promo')).toBeHidden(); await expect(square(page, 'a8')).toBeFocused(); expect((await S(page)).nodes).toBe(1);
  await keyboardMove(page, 'a7', ['ArrowUp']); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  expect(await uci(page)).toBe('a7a8n'); await expect(square(page, 'a8')).toBeFocused(); await expect(square(page, 'a8')).toHaveAttribute('aria-label', 'White knight on a8');
  await loadPgn(page, position('7k/8/8/8/8/8/p7/7K b - - 0 1')); await page.locator('#btnFlip').click(); await keyboardMove(page, 'a2', ['ArrowUp']);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); expect(await uci(page)).toBe('a2a1r'); await expect(square(page, 'a1')).toBeFocused();
});

test('an old pointer promotion choice cannot alter a replacement game even when its FEN and promotion stay legal', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, position(PROMO)); await move(page, 'a7', 'a8');
  await expect(page.locator('#promo')).toBeVisible(); await page.locator('#promo [aria-label="Promote to queen"]').evaluate(button => { window.__oldMainPromotion = button; });
  const gen = await page.evaluate(() => window.__kibitz.S.gen); await loadPgn(page, '[Event "Replacement"]\n' + position(PROMO));
  expect(await page.evaluate(() => window.__kibitz.S.gen)).not.toBe(gen); const before = await S(page); await expect(page.locator('#promo')).toBeHidden();
  await page.evaluate(() => window.__oldMainPromotion.click()); expect(await S(page)).toEqual(before); expect((await S(page)).nodes).toBe(1);
});

test('switching from a pointer-selected king to a keyboard rook does not accidentally castle', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'));
  const board = page.locator('#board'), bounds = await board.boundingBox(); await board.click({ position: { x: bounds.width * 4.5 / 8, y: bounds.height * 7.5 / 8 } });
  await square(page, 'h1').focus(); await page.keyboard.press('Enter'); expect((await S(page)).nodes).toBe(1); await expect(square(page, 'h1')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape'); await square(page, 'e1').focus(); await page.keyboard.press('Enter'); await square(page, 'g1').focus(); await page.keyboard.press('Enter'); expect(await uci(page)).toBe('e1g1');
});

test('coach arrows have distinct visible patterns and literal text descriptions that disappear with restricted live help', async ({ page }) => {
  await fakeAnswer(page, 'Consider these marks.\n\n```board\narrow e2 e4\nthreat e7 e5\nlabel f3 !\nlabel f4 <img src=x>\n```');
  await open(page); await page.locator('#modePlay').click(); await page.locator('#optHelp [data-v="full"]').click(); await page.locator('#btnNewGame').click(); await fixedStart(page); await ask(page);
  const line = page.locator('#board svg.cg-shapes line[marker-end="url(#arrowhead-ks)"]').first(), threat = page.locator('#board svg.cg-shapes line[marker-end="url(#arrowhead-kt)"]').first();
  await expect(line).toHaveCount(1); await expect(threat).toHaveCount(1);
  const patterns = await Promise.all([line.evaluate(n => getComputedStyle(n).strokeDasharray), threat.evaluate(n => getComputedStyle(n).strokeDasharray)]);
  expect(patterns[0]).not.toBe('none'); expect(patterns[1]).not.toBe('none'); expect(patterns[0]).not.toBe(patterns[1]);
  await page.locator('#boardMarks summary').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#boardMarkList')).toContainText('Line or coach mark: e2 → e4'); await expect(page.locator('#boardMarkList')).toContainText('Threat mark: e7 → e5'); await expect(page.locator('#boardMarkList img')).toHaveCount(0);
  await page.locator('#optHelp [data-v="off"]').click(); await expect(page.locator('#boardMarks')).toBeHidden();
});

test('reduced-motion preference disables the actual Chessground animator and updates while the page is open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page); await page.locator('#modeAnalyse').click();
  expect(await page.evaluate(() => window.__kibitz.ground().state.animation.enabled)).toBe(false);
  await keyboardMove(page, 'e2', ['ArrowUp', 'ArrowUp']); expect(await uci(page)).toBe('e2e4'); expect(await page.evaluate(() => !!window.__kibitz.ground().state.animation.current)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await expect.poll(() => page.evaluate(() => window.__kibitz.ground().state.animation.enabled)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect.poll(() => page.evaluate(() => window.__kibitz.ground().state.animation.enabled)).toBe(false);
});

test('keyboard scratch play keeps the main score intact and previews temporarily remove the interactive grid', async ({ page }) => {
  await fakeAnswer(page, 'Start with 1. e4 e5 2. Nf3.'); await open(page); await page.locator('#modeAnalyse').click(); await fixedStart(page); await ask(page);
  const before = await S(page), answer = page.locator('#chat .msg.coach').last(); await answer.locator('.san', { hasText: 'Nf3' }).hover(); await expect(page.locator('#keyboardBoard')).toBeHidden();
  await page.locator('#coachInput').hover(); await expect(page.locator('#keyboardBoard')).toBeVisible(); expect(await S(page)).toEqual(before);
  await page.locator('#btnWhatIf').click(); await expect(page.locator('#scratchBar')).toBeVisible(); await keyboardMove(page, 'd2', ['ArrowUp', 'ArrowUp']);
  expect(await S(page)).toEqual(before); expect(await page.evaluate(() => window.__kibitz.scratch().ucis)).toEqual(['d2d4']);
});

test('German dark phone keyboard labels, instructions and focus remain readable without page overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('#modeAnalyse').click(); await expect(square(page, 'e2')).toHaveAttribute('aria-label', 'Weißer Bauer auf e2');
  await square(page, 'e2').focus(); await page.keyboard.press('Space'); await expect(page.locator('#keyboardStatus')).toContainText('Figur auf e2 ausgewählt'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(square(page, 'e4')).toBeFocused(); expect(await square(page, 'e4').evaluate(n => getComputedStyle(n).outlineStyle)).toBe('solid'); await expect(page.locator('#keyboardHelp')).toContainText('Tastaturbrett');
  await page.locator('.board-outer').screenshot({ path: info.outputPath('keyboard-phone.png') }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
