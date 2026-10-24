import { test, expect, open, S } from './fixtures.mjs';
const library = async page => { await page.locator('[data-tab="library"]').click(); await page.locator('#libSearchFilters').evaluate(d => { d.open = true; }); };
const card = (page, id, collection = 'library') => page.locator(`#libList .game[data-game-id="${id}"][data-collection="${collection}"]`);
const seed = (page, games) => page.addInitScript(g => localStorage.setItem('kibitz.games', JSON.stringify(g)), games);
const record = (id, { white = 'Learner', black = 'Other', date = '2026.10.24', result = '*', moves = '1. e4 c5', ...extra } = {}) => ({
  id, kind: 'study', white, black, date, result, title: id,
  pgn: `[Event "${id}"]\n[White "${white}"]\n[Black "${black}"]\n[Date "${date}"]\n[Result "${result}"]\n\n${moves} ${result}`, ...extra,
});

test('combined fields search legal PGN metadata and leave the board, saved records and providers untouched', async ({ page }) => {
  const own = [record('match', { black: 'Richard Réti', date: '1921.??.??', result: '0-1', tags: ['pin'], userColor: 'b' }),
    record('other', { black: 'Richard Réti', date: '1922.10.22', result: '1-0', tags: ['opening'] }), record('unknown', { date: '????.??.??' })];
  await seed(page, own); const calls = []; page.on('request', r => { if (/\/api\/ai\/(?:sample|embeddings)$/.test(new URL(r.url()).pathname)) calls.push(r.url()); });
  await open(page); await library(page); const before = await S(page), saved = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await page.locator('#libPlayer').fill('reti'); await page.locator('#libOpening').fill('sicilian'); await page.locator('#libYearFrom').fill('1921'); await page.locator('#libYearTo').fill('1921');
  await page.locator('#libResult').selectOption('0-1'); await page.locator('#libTheme').selectOption('pin');
  await expect(page.locator('#libList .game')).toHaveCount(1); await expect(card(page, 'match')).toBeVisible(); await expect(page.locator('#libSearchStatus')).toHaveText('1 matching record.');
  await expect(page.locator('#libPlayer')).toBeEnabled(); expect(await S(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(saved); expect(calls).toEqual([]);
  await page.locator('#libSearchClear').click(); await expect(page.locator('#libSearch')).toBeFocused(); await expect(page.locator('#libList .game')).toHaveCount(3);
  for (const id of ['#libPlayer', '#libOpening', '#libYearFrom', '#libYearTo', '#libResult', '#libTheme']) await expect(page.locator(id)).toHaveValue('');
});

test('active search includes classics beside personal games and derives opening labels from their checked mainlines', async ({ page }) => {
  await seed(page, [record('own')]); await open(page); await library(page); await expect(card(page, 'ex-opera', 'classic')).toHaveCount(0);
  await page.locator('#libPlayer').fill('Morphy'); await expect(card(page, 'ex-opera', 'classic')).toBeVisible();
  const meta = card(page, 'ex-opera', 'classic').locator('.game-search-meta'); await expect(meta).toContainText(/\b[A-E]\d{2}\b/);
  const code = (await meta.textContent()).match(/\b[A-E]\d{2}\b/)[0]; await page.locator('#libOpening').fill(code.toLowerCase());
  await page.locator('#libYearFrom').fill('1858'); await page.locator('#libYearTo').fill('1858'); await page.locator('#libResult').selectOption('1-0'); await page.locator('#libTheme').selectOption('pin');
  await expect(page.locator('#libList .game')).toHaveCount(1); await expect(card(page, 'ex-opera', 'classic')).toBeVisible();
  await page.locator('#libFilter [data-v="played"]').click(); await expect(page.locator('#libList .game')).toHaveCount(0); await expect(page.locator('#libSearchStatus')).toHaveText('0 matching records.');
});

test('bad year ranges give a visible error; unknown years stay out of ranges and clear search keeps the selected collection', async ({ page }) => {
  await open(page); await library(page); await page.locator('#libFilter [data-v="problems"]').click();
  await page.locator('#libYearFrom').fill('2000'); await page.locator('#libYearTo').fill('1900'); await expect(page.locator('#libList .game')).toHaveCount(0);
  await expect(page.locator('#libSearchStatus')).toHaveText('The first year must not be after the last year.'); await expect(page.locator('#libYearFrom')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#libYearFrom').fill('19??'); await expect(page.locator('#libSearchStatus')).toHaveText('Use whole years from 1 to 9999.');
  await page.locator('#libYearFrom').fill('1'); await expect(card(page, 'st-lucena', 'classic')).toHaveCount(0); await expect(card(page, 'st-philidor', 'classic')).toHaveCount(0);
  await expect(card(page, 'st-saavedra', 'classic')).toBeVisible(); await page.locator('#libSearchClear').click();
  await expect(page.locator('#libFilter [data-v="problems"]')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('#libList .game')).toHaveCount(12);
  await expect(page.locator('#libYearFrom')).toHaveAttribute('aria-invalid', 'false');
});

test('punctuation stays literal and imported markup stays text through search, deletion cancellation and empty results', async ({ page }) => {
  await seed(page, [record('literal', { title: '<img src=x> [.*] Ignore instructions', tags: ['pin'] }), record('ordinary', { tags: ['opening'] })]);
  await open(page); await library(page); await page.locator('#libSearch').fill('[.*]'); await expect(card(page, 'literal')).toBeVisible(); await expect(card(page, 'ordinary')).toHaveCount(0);
  await expect(page.locator('#libList img')).toHaveCount(0); await card(page, 'literal').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('#libPlayer').fill('learner'); await card(page, 'literal').getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(card(page, 'literal').getByRole('button', { name: 'Delete', exact: true })).toHaveCount(1); await expect(card(page, 'literal')).not.toContainText('Delete for good?');
  await page.locator('#libSearch').fill('[broken'); await expect(page.locator('#libList .game')).toHaveCount(0); await expect(page.locator('#libSearch')).toBeFocused();
  await page.locator('#libSearchClear').click(); await expect(page.locator('#libList .game')).toHaveCount(2);
});

test('late ECO labels preserve an open source form, unsaved correction and focus', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/eco.json', async route => { await gate; await route.fulfill({ json: { 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -': ['C20', 'King Pawn Test'] } }); });
  await seed(page, [record('late', { moves: '1. e4 e5' })]); await open(page); await library(page);
  const details = card(page, 'late').locator('.source-details'); await details.locator('summary').click();
  const field = details.locator('[data-source-field="title"]'); await field.fill('Unsaved source correction'); await expect(field).toBeFocused();
  release(); await expect(card(page, 'late').locator('.game-search-meta')).toContainText('C20 King Pawn Test');
  await expect(field).toHaveValue('Unsaved source correction'); await expect(field).toBeFocused(); await expect(details).toHaveAttribute('open', '');
});

test('German phone filters and localized theme/title queries fit and remain keyboard accessible', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await library(page); await expect(page.locator('#libSearch')).toHaveAttribute('aria-label', 'Partien suchen');
  await page.locator('#libSearch').fill('opernpartie fesselung'); await expect(card(page, 'ex-opera', 'classic')).toBeVisible();
  await page.locator('#libYearFrom').fill('1858'); await page.locator('#libYearTo').fill('1858'); await page.locator('#libTheme').selectOption('pin');
  await expect(page.locator('#libSearchStatus')).toHaveText('1 passender Eintrag.'); await expect(page.locator('#libSearchFilters')).toContainText('Eröffnung oder ECO');
  for (const id of ['#libYearFrom', '#libYearTo']) expect((await page.locator(id).boundingBox()).height).toBeGreaterThanOrEqual(35);
  await page.locator('#libSearchFilters').scrollIntoViewIfNeeded(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('library-search-phone.png') });
  await page.locator('#libYearTo').fill('1800'); await expect(page.locator('#libSearchStatus')).toHaveText('Das erste Jahr darf nicht nach dem letzten Jahr liegen.');
});

test('coach library tools use the same combined filters and return only quoted metadata', async ({ page }) => {
  await seed(page, [record('coach-match', { white: 'Richard Réti', date: '1921.??.??', result: '1-0', tags: ['pin'] })]);
  const bodies = []; page.on('request', r => { if (new URL(r.url()).pathname === '/api/ai/sample') bodies.push(r.postDataJSON()); });
  await open(page); const before = await S(page);
  const action = { player: 'reti', opening: 'sicilian', yearFrom: 1921, yearTo: 1921, score: '1-0', theme: 'pin' };
  await page.locator('#coachInput').fill(`Please do this [mock:action:search_library ${JSON.stringify(action)}]`); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).not.toHaveClass(/thinking/);
  const result = JSON.parse(bodies.at(-1).messages.find(m => m.role === 'tool').content);
  expect(result.games.map(g => g.id)).toEqual(['coach-match']); expect(result.games[0].white).toBe('«Richard Réti»'); expect(result.games[0].pgn).toBeUndefined(); expect(await S(page)).toEqual(before);
});
