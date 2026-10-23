import { test, expect, open, loadPgn, S } from './fixtures.mjs';

const tab = page => page.locator('[data-tab="openings"]').click();
const pgn = page => page.evaluate(() => window.__kibitz.toPGN({ annotate: false }));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.repertoires')));
const seedRep = async (page, items) => page.addInitScript(items => {
  localStorage.setItem('kibitz.repertoires', JSON.stringify({ version: 1, items }));
  localStorage.setItem('kibitz.repertoireSelected', JSON.stringify(items[0].id));
}, items);
const repertoire = (extra = {}) => ({ id: 'r', name: 'White repertoire', color: 'w', lines: [{ id: 'l', name: 'Open game', note: 'Develop pieces.', moves: ['e2e4', 'e7e5', 'g1f3'] }], ...extra });
async function create(page, name, side = 'w') {
  await page.locator('#repSelect').selectOption(''); await page.locator('#repName').fill(name);
  await page.locator('#repColor').selectOption(side); await page.locator('#repSave').click();
  await expect(page.locator('#repLinesEditor')).toBeVisible();
}
async function saveLine(page, name, moves, note = '') {
  await page.locator('#repLineName').fill(name); await page.locator('#repMoves').fill(moves);
  await page.locator('#repNote').fill(note); await page.locator('#repLineSave').click();
}

test('White and Black repertoires keep independent chosen lines across reload without changing games', async ({ page }) => {
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  const before = await pgn(page), library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await create(page, 'My White lines');
  await saveLine(page, 'Open games', '1. e4 e5 2. Nf3', 'Develop before attacking.');
  const white = (await stored(page)).items[0].id;
  await create(page, 'My Black lines', 'b');
  await saveLine(page, 'Sicilian', '1. e4 c5', 'Fight for d4.');
  const black = (await stored(page)).items[1].id;
  await expect(page.locator('#repChoices button')).toHaveCount(0);
  await page.locator('.repertoire-line').getByRole('button', { name: 'Open line', exact: true }).click();
  await page.locator('#scratchPrev').click();
  await expect(page.locator('#repChoices button')).toHaveText(['c5']);
  await page.locator('#repChoices button').click();
  expect((await S(page)).nodes).toBe(1); expect(await pgn(page)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
  await page.reload(); await expect(page.locator('#engineDot.ok')).toBeVisible();
  await page.locator('#modeAnalyse').click(); await tab(page);
  await expect(page.locator('#repSelect')).toHaveValue(black);
  await expect(page.locator('.repertoire-line h4')).toHaveText(['Sicilian']);
  await page.locator('#repSelect').selectOption(white);
  await expect(page.locator('.repertoire-line h4')).toHaveText(['Open games']);
  await expect(page.locator('#repChoices button')).toHaveText(['e4']);
});

test('capturing the board joins the main-game prefix and scratch line only up to the displayed move', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'ref', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5', kind: 'study' }])));
  await open(page); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6'); await page.locator('#btnPrev').click(); await tab(page);
  await page.locator('#explorerSource').selectOption('library');
  const before = await pgn(page), library = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await create(page, 'Ruy Lopez');
  await page.locator('.explorer-move[data-uci="b8c6"] .explorer-play').click();
  await page.locator('.explorer-move[data-uci="f1b5"] .explorer-play').click();
  await page.locator('#scratchPrev').click(); await page.locator('#repUseBoard').click();
  await expect(page.locator('#repMoves')).toHaveValue('1. e4 e5 2. Nf3 Nc6');
  await page.locator('#repLineName').fill('Up to Nc6'); await page.locator('#repLineSave').click();
  expect((await stored(page)).items[0].lines[0].moves).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  expect(await S(page)).toMatchObject({ nodes: 5, cursor: 3 }); expect(await pgn(page)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(library);
  await page.locator('#scratchClose').click();
  await loadPgn(page, '1. Nf3 Nf6 2. Ng1 Ng8'); await tab(page);
  await page.locator('.explorer-move[data-uci="e2e4"] .explorer-play').click(); await page.locator('#repUseBoard').click();
  await expect(page.locator('#repMoves')).toHaveValue('1. Nf3 Nf6 2. Ng1 Ng8 3. e4');
  await page.locator('#repLineName').fill('After the repetition'); await page.locator('#repLineSave').click();
  expect((await stored(page)).items[0].lines[1].moves).toEqual(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'e2e4']);
});

test('line edits keep identity; invalid/duplicate input does not save, and removals ask first', async ({ page }) => {
  await seedRep(page, [repertoire()]); await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await saveLine(page, 'Broken', '1. e4 e5 2. Bh6');
  await expect(page.locator('#repMsg')).toContainText('Nothing was saved');
  await saveLine(page, 'Duplicate', '1. e4 e5 2. Nf3');
  await expect(page.locator('#repMsg')).toContainText('already in this repertoire');
  await page.locator('.repertoire-line').getByRole('button', { name: 'Edit line', exact: true }).click();
  await saveLine(page, '<img src=x onerror=alert(1)>', '1. e4 c5 2. Nf3', '<b>Plain notes</b>');
  await expect(page.locator('.repertoire-line h4')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.rep-note')).toHaveText('<b>Plain notes</b>');
  await expect(page.locator('#repertoirePanel img, #repertoirePanel b')).toHaveCount(0);
  expect((await stored(page)).items[0].lines[0].id).toBe('l');
  await page.locator('.repertoire-line').getByRole('button', { name: 'Edit line', exact: true }).click();
  await page.locator('#repNote').fill('Unsaved draft');
  await page.locator('.repertoire-line').getByRole('button', { name: 'Remove line', exact: true }).click();
  await page.locator('.repertoire-line').getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('#repNote')).toHaveValue('Unsaved draft');
  await page.locator('#repLineCancel').click();
  await page.locator('.repertoire-line').getByRole('button', { name: 'Remove line', exact: true }).click();
  await page.locator('.repertoire-line').getByRole('button', { name: 'Remove line', exact: true }).click();
  await expect(page.locator('.repertoire-line')).toHaveCount(0);
  await page.locator('#repName').fill('Renamed repertoire'); await page.locator('#repColor').selectOption('b'); await page.locator('#repSave').click();
  expect((await stored(page)).items[0]).toMatchObject({ id: 'r', name: 'Renamed repertoire', color: 'b' });
  await page.locator('#repDelete').click(); await page.locator('#repDeleteNo').click();
  expect((await stored(page)).items).toHaveLength(1);
  await page.locator('#repDelete').click(); await page.locator('#repDeleteYes').click();
  expect((await stored(page)).items).toEqual([]);
});

test('restricted live help clears saved suggestions and editor contents, including while the tab is closed', async ({ page }) => {
  await seedRep(page, [repertoire()]); await open(page); await tab(page);
  await expect(page.locator('#repertoirePanel')).toBeHidden();
  await page.locator('[data-tab="game"]').click(); await page.locator('#optHelp button[data-v="full"]').click(); await tab(page);
  await page.locator('.repertoire-line').getByRole('button', { name: 'Open line', exact: true }).click();
  expect(await S(page)).toMatchObject({ playing: true, nodes: 1 });
  await page.locator('.repertoire-line').getByRole('button', { name: 'Edit line', exact: true }).click();
  for (const help of ['off', 'flags', 'eval']) {
    await page.locator('[data-tab="game"]').click(); await page.locator(`#optHelp button[data-v="${help}"]`).click();
    await expect(page.locator('.repertoire-line, #repChoices button')).toHaveCount(0);
    await expect(page.locator('#repMoves')).toHaveValue(''); await tab(page);
    await expect(page.locator('#repertoirePanel')).toBeHidden();
  }
  await page.locator('#modeAnalyse').click();
  await expect(page.locator('.repertoire-line h4')).toHaveText('Open game');
  expect((await stored(page)).items[0].lines).toHaveLength(1);
});

test('storage failure leaves saved lines intact and retains the edit for retry', async ({ page }) => {
  await seedRep(page, [repertoire()]);
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await page.evaluate(() => {
    window.__repFail = true;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'kibitz.repertoires' && window.__repFail) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await page.locator('.repertoire-line').getByRole('button', { name: 'Edit line', exact: true }).click();
  await saveLine(page, 'Sicilian', '1. e4 c5');
  await expect(page.locator('#toast')).toContainText('could not be saved');
  await expect(page.locator('.repertoire-line h4')).toHaveText('Open game');
  await expect(page.locator('#repMoves')).toHaveValue('1. e4 c5');
  expect((await stored(page)).items[0].lines[0].moves).toEqual(['e2e4', 'e7e5', 'g1f3']);
  await page.evaluate(() => { window.__repFail = false; }); await page.locator('#repLineSave').click();
  await expect(page.locator('.repertoire-line h4')).toHaveText('Sicilian');
});

test('an unreadable repertoire store is reported and left untouched', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.repertoires', '{broken'));
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await expect(page.locator('#repReadError')).toBeVisible(); await expect(page.locator('#repControls')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('kibitz.repertoires'))).toBe('{broken');
});

test('a saved line longer than the coach line limit opens and extends without losing its prefix', async ({ page }) => {
  await seedRep(page, [repertoire({ lines: [{ id: 'long', name: 'Long line', note: '', moves: [...Array.from({ length: 11 }, () => ['g1f3', 'g8f6', 'f3g1', 'f6g8']).flat()] }] })]);
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await page.locator('.repertoire-line').getByRole('button', { name: 'Open line', exact: true }).click();
  await expect(page.locator('#scratchMoves button')).toHaveCount(44);
  await page.locator('.explorer-move[data-uci="e2e4"] .explorer-play').click();
  await expect(page.locator('#scratchMoves button')).toHaveCount(45);
  await page.locator('#repUseBoard').click();
  await expect(page.locator('#repMoves')).toHaveValue(/23\. e4$/);
  expect((await S(page)).nodes).toBe(1);
});

test('the German repertoire builder works on a phone with literal names/notes and no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await page.locator('#modeAnalyse').click(); await tab(page);
  await create(page, 'Meine Antworten', 'b'); await saveLine(page, 'Sizilianisch', '1. e4 c5', 'Mein eigener Text');
  await expect(page.locator('#repertoirePanel > h3')).toHaveText('Repertoire aufbauen');
  await expect(page.locator('#repLineSave')).toHaveText('Variante speichern');
  await expect(page.locator('.rep-note')).toHaveText('Mein eigener Text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
