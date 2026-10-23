/** @file Browser recall sessions: separate board, saved reviews, failure recovery and help policy. */
import { Chess } from 'chess.js';
import { buildDrillCards, scheduleDrillReview } from '../../src/drills.js';
import { test, expect, open, loadPgn, S } from './fixtures.mjs';

const DAY = 86_400_000;
const rep = (extra = {}) => ({ id: 'r', name: 'My repertoire', color: 'w', lines: [{ id: 'l', name: 'Open game', note: 'Develop.', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] }], ...extra });
const promotionRep = () => rep({ lines: [{ id: 'p', name: 'Promotion', note: '', moves: ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8n'] }] });
const learnedPrefix = repertoire => buildDrillCards(Chess, repertoire).slice(0, -1).map(card => [card.key, scheduleDrillReview(null, { mistakes: 0, hints: 0, revealed: false }, Date.now())]);
const tab = page => page.locator('[data-tab="openings"]').click();
const records = page => page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.repertoireReviews'))?.entries || []);
const pgn = page => page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));

/** Seed only once so reloads exercise real persistence instead of replacing saved progress. */
async function seed(page, repertoire = rep(), reviews = null) {
  await page.addInitScript(({ repertoire, reviews }) => {
    if (!localStorage.getItem('kibitz.repertoires')) {
      localStorage.setItem('kibitz.repertoires', JSON.stringify({ version: 1, items: [repertoire] }));
      localStorage.setItem('kibitz.repertoireSelected', JSON.stringify(repertoire.id));
      if (reviews) localStorage.setItem('kibitz.repertoireReviews', JSON.stringify(reviews));
    }
  }, { repertoire, reviews });
}
async function start(page) {
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page); await page.locator('#drillStart').click();
  await expect(page.locator('#drillMove')).toBeVisible();
}
async function answer(page, text) {
  await page.locator('#drillMove').fill(text); await page.locator('#drillMove').press('Enter');
}
/** Click-click on the independent board, including its Black orientation. */
async function boardMove(page, from, to, color = 'w') {
  await page.locator('#drillBoard').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = await page.locator('#drillBoard').boundingBox();
  for (const sq of [from, to]) {
    const file = 'abcdefgh'.indexOf(sq[0]), rank = +sq[1];
    await page.mouse.click(box.x + (color === 'w' ? file + 0.5 : 7.5 - file) * box.width / 8, box.y + (color === 'w' ? 8.5 - rank : rank - 0.5) * box.height / 8);
  }
}

/** Completed recalls persist; a legal unsaved move must not be called bad chess or alter either board. */
test('White recall saves clean and missed choices across reload without changing the game or calling AI', async ({ page }) => {
  await seed(page); let calls = 0; page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) calls++; });
  await start(page);
  const before = await pgn(page), state = await S(page), library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await expect(page.locator('#repLinesEditor')).toBeHidden();
  await answer(page, 'e5'); await expect(page.locator('#drillFeedback')).toContainText('Enter a legal move');
  expect(await records(page)).toEqual([]);
  await boardMove(page, 'e2', 'e4');
  await expect(page.locator('#drillPlayed')).toHaveText('1. e4 e5');
  await expect(page.locator('#drillFeedback')).toContainText('Correct recall');
  await page.locator('#drillNext').click(); await expect(page.locator('#drillPosition')).toContainText('move 2');
  await answer(page, 'Nc3'); await expect(page.locator('#drillFeedback')).toContainText('Legal, but not one of your saved choices');
  await expect(page.locator('#drillNext')).toBeDisabled(); expect(await records(page)).toHaveLength(1);
  await answer(page, 'Nf3'); await expect(page.locator('#drillPlayed')).toHaveText('2. Nf3 Nc6');
  expect((await records(page)).map(([, r]) => [r.grade, r.mistakes])).toEqual([['good', 0], ['again', 1]]);
  await page.locator('#drillNext').click(); await expect(page.locator('#drillPosition')).toContainText('1 clean recalls, 1 with help or mistakes');
  await page.locator('#drillStop').click(); await expect(page.locator('#drillStart')).toBeDisabled();
  await expect(page.locator('#drillDue')).toContainText('Next review');
  expect(await pgn(page)).toBe(before); expect(await S(page)).toMatchObject(state);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library); expect(calls).toBe(0);
  await page.reload(); await expect(page.locator('#engineDot.ok')).toBeVisible(); await page.locator('#modeAnalyse').click(); await tab(page);
  await expect(page.locator('#drillStats')).toHaveText('New: 0 · due: 0 · reviewed: 2');
  await expect(page.locator('#drillHistory')).toHaveText('Completed recalls: 2 · clean: 1 · mistakes: 1 · hints: 0');
  expect((await records(page))[0][1].reviews).toBe(1);
});

test('Black board orientation accepts any saved choice and plays its matching White reply', async ({ page }) => {
  const repertoire = rep({ color: 'b', lines: [
    { id: 'a', name: 'Sicilian', note: '', moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6'] },
    { id: 'b', name: 'Open game', note: '', moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'] },
  ] });
  await seed(page, repertoire); await start(page);
  await expect(page.locator('#drillBoard')).toHaveClass(/orientation-black/);
  await expect(page.locator('#drillPosition')).toContainText('Black to move · move 1');
  await boardMove(page, 'e7', 'e5', 'b');
  await expect(page.locator('#drillPlayed')).toHaveText('1… e5 2. Nf3');
  expect((await records(page))[0][1].grade).toBe('good');
  expect((await S(page)).nodes).toBe(1);
});

test('a hint and a revealed answer get different intervals and cumulative help counts', async ({ page }) => {
  await seed(page); await start(page);
  await page.locator('#drillHint').click(); await expect(page.locator('#drillFeedback')).toContainText('e2');
  await expect(page.locator('#drillHint')).toBeDisabled();
  await answer(page, 'e4'); await page.locator('#drillNext').click();
  await page.locator('#drillReveal').click(); await expect(page.locator('#drillPlayed')).toHaveText('2. Nf3 Nc6');
  const saved = (await records(page)).map(([, r]) => r);
  expect(saved[0]).toMatchObject({ grade: 'hard', intervalDays: 1, hints: 1, clean: 0 });
  expect(saved[1]).toMatchObject({ grade: 'again', intervalDays: 0, lapses: 1, clean: 0 });
  expect(saved[0].due - saved[0].lastAt).toBe(DAY); expect(saved[1].due - saved[1].lastAt).toBe(600_000);
});

/** A stored overdue second position must be asked before a new first position. */
test('due positions precede new ones and clean reviews expand the saved interval', async ({ page }) => {
  const repertoire = rep(), card = buildDrillCards(Chess, repertoire)[1];
  const record = scheduleDrillReview(null, { mistakes: 0, hints: 0, revealed: false }, Date.now() - 2 * DAY);
  await seed(page, repertoire, { version: 1, entries: [[card.key, record]] }); await start(page);
  await expect(page.locator('#drillPosition')).toContainText('move 2');
  await answer(page, 'Nf3'); expect((await records(page))[0][1]).toMatchObject({ reviews: 2, intervalDays: 3 });
  await page.locator('#drillNext').click(); await expect(page.locator('#drillPosition')).toContainText('move 1');
});

test('a failed save keeps the answered board and blocks advancing until a single successful retry', async ({ page }) => {
  await seed(page); await start(page);
  await page.evaluate(() => {
    window.__reviewFail = true; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'kibitz.repertoireReviews' && window.__reviewFail) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await answer(page, 'e4');
  await expect(page.locator('#drillFeedback')).toContainText('could not be saved');
  await expect(page.locator('#drillNext')).toBeDisabled(); await expect(page.locator('#drillMove')).toBeDisabled();
  await expect(page.locator('#drillPlayed')).toHaveText('1. e4 e5'); expect(await records(page)).toEqual([]);
  await page.evaluate(() => { window.__reviewFail = false; }); await page.locator('#drillRetry').click();
  await expect(page.locator('#drillNext')).toBeEnabled(); await expect(page.locator('#drillRetry')).toBeHidden();
  expect((await records(page))[0][1].reviews).toBe(1);
});

test('unreadable review data stays untouched and disables drills while repertoire editing remains available', async ({ page }) => {
  await seed(page, rep(), { version: 99, entries: [] }); await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await expect(page.locator('#drillReadError')).toBeVisible(); await expect(page.locator('#drillStart')).toBeDisabled();
  await expect(page.locator('#repLineForm')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.repertoireReviews')).version)).toBe(99);
});

/** Closed tabs and synthetic stale actions must not bypass the live game's help permission. */
test('restricting help cancels and clears a drill and stale actions cannot save a result', async ({ page }) => {
  await seed(page); await open(page); await page.locator('#optHelp button[data-v="full"]').click(); await tab(page);
  await page.locator('#drillStart').click(); await page.locator('[data-tab="game"]').click();
  await page.locator('#optHelp button[data-v="off"]').click();
  await expect(page.locator('#drillSession')).toBeHidden(); await expect(page.locator('#drillBoard piece')).toHaveCount(0);
  await expect(page.locator('#drillPlayed')).toBeEmpty();
  await page.locator('#drillReveal').evaluate(b => b.click()); expect(await records(page)).toEqual([]);
  await tab(page); await expect(page.locator('#repertoirePanel')).toBeHidden();
  await page.locator('#modeAnalyse').click(); await expect(page.locator('#drillStart')).toBeVisible();
});

test('renaming a line retains learned cards, while changed saved choices produce a new recall', async ({ page }) => {
  await seed(page); await start(page); await answer(page, 'e4'); await page.locator('#drillStop').click();
  await page.locator('.repertoire-line').getByRole('button', { name: 'Edit line', exact: true }).click();
  await page.locator('#repLineName').fill('Renamed'); await page.locator('#repLineSave').click();
  await expect(page.locator('#drillStats')).toHaveText('New: 1 · due: 0 · reviewed: 1');
  await page.locator('#repLineName').fill('Queen pawn'); await page.locator('#repMoves').fill('1. d4 d5'); await page.locator('#repLineSave').click();
  await expect(page.locator('#drillStats')).toHaveText('New: 2 · due: 0 · reviewed: 0');
  await page.locator('#drillStart').click(); await answer(page, 'd4');
  await expect(page.locator('#drillPlayed')).toHaveText('1. d4 d5');
  expect((await records(page))).toHaveLength(2);
});

test('underpromotion uses an explicit choice on the drill board and preserves the main game', async ({ page }) => {
  const repertoire = promotionRep();
  await seed(page, repertoire, { version: 1, entries: learnedPrefix(repertoire) }); await start(page);
  await expect(page.locator('#drillPosition')).toContainText('move 5');
  await boardMove(page, 'b7', 'a8'); await expect(page.locator('#drillPromo')).toBeVisible();
  await page.locator('#drillPromo').getByRole('button', { name: 'Promote to knight' }).click();
  await expect(page.locator('#drillPlayed')).toHaveText('5. bxa8=N');
  expect((await S(page)).nodes).toBe(1); expect((await records(page)).at(-1)[1].grade).toBe('good');
});

/** A promotion callback captured before a game replacement must not answer a later session's card. */
test('replacing the game invalidates the session and a held promotion callback cannot grade a new session', async ({ page }) => {
  const repertoire = promotionRep();
  await seed(page, repertoire, { version: 1, entries: learnedPrefix(repertoire) }); await start(page);
  await boardMove(page, 'b7', 'a8');
  await page.locator('#drillPromo').getByRole('button', { name: 'Promote to knight' }).evaluate(b => { window.__oldDrillChoice = b; });
  await loadPgn(page, '1. d4 d5');
  await expect(page.locator('#drillSession')).toBeHidden(); await expect(page.locator('#drillBoard piece')).toHaveCount(0);
  await tab(page); await page.locator('#drillStart').click();
  await page.evaluate(() => window.__oldDrillChoice.click());
  await expect(page.locator('#drillNext')).toBeDisabled(); await expect(page.locator('#drillPlayed')).toBeEmpty();
  expect(await records(page)).toHaveLength(4); expect((await S(page)).nodes).toBe(3);
});

test('German phone drill supports keyboard moves, literal names and a layout without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  const name = '<img src=x>' + 'Knight'.repeat(14);
  await seed(page, rep({ lines: [{ id: 'n', name, note: '', moves: ['g1f3', 'd7d5'] }] }));
  await start(page); await expect(page.locator('#drillPanel h3')).toHaveText('Repertoiretraining');
  await expect(page.locator('#drillLineName')).toHaveText(name);
  await expect(page.locator('#drillPanel img')).toHaveCount(0);
  await page.locator('#drillHint').click(); await answer(page, 'Sf3');
  await expect(page.locator('#drillPlayed')).toHaveText('1. Nf3 d5');
  await page.locator('#drillNext').click(); await page.locator('#drillStop').click();
  await expect(page.locator('#drillStart')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
