import { test, expect, open, loadPgn, S } from './fixtures.mjs';

const german = page => page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
async function search(page, query, source) {
  await page.locator('[data-tab="library"]').click(); await page.locator('#studySource').selectOption(source); await page.locator('#studyQuery').fill(query);
}

test('German opening labels and bilingual catalogue lookup preserve English names in saved selections and engine context', async ({ page }) => {
  await german(page); await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6 3. Bb5');
  await expect(page.locator('#openingName')).toContainText('Spanische Partie'); await expect(page.locator('#openingName')).toHaveAttribute('title', /^Ruy Lopez/);
  expect(await page.evaluate(() => window.__kibitz.contextFor(window.__kibitz.S.cursor))).toContain('Ruy Lopez');
  await page.locator('[data-tab="openings"]').click(); await expect(page.locator('#namedOpeningCurrent')).toContainText('Spanische Partie');
  await page.locator('[data-tab="game"]').click(); await page.locator('#optStart [data-v="opening"]').click(); await page.locator('#openingSearch').fill('Wolga');
  const options = page.locator('#openingResults button'); await expect(options.first()).toContainText('Wolga-Gambit'); const names = await options.allTextContents();
  await options.first().focus(); await page.keyboard.press('Enter'); await expect(page.locator('#startHint')).toContainText('Die Partie beginnt nach');
  const selected = await page.evaluate(() => window.__kibitz.S.startPick.opening); expect(selected.name).toContain('Benko Gambit');
  await page.locator('#openingSearch').fill(selected.eco + ' ' + selected.name); await expect(options.filter({ hasText: names[0] }).first()).toBeVisible(); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});

test('German authored comments are searchable and open the exact source occurrence with canonical SAN and revised literal PGN', async ({ page }) => {
  await german(page); await open(page); await page.locator('#modeAnalyse').click(); await search(page, 'Läuferpaar', 'classic');
  const hit = page.locator('#studySearchResults .study-hit').first(); await expect(hit).toContainText('Fesselt den Springer'); await expect(hit).toContainText('Läuferpaar');
  await hit.getByRole('button', { name: 'Kommentierte Stellung öffnen' }).click(); expect((await S(page)).cursor).toBe(6);
  const result = await page.evaluate(() => { const { S, toPGN } = window.__kibitz; return { comment: S.comments[S.nodes[S.cursor].fen], pgn: toPGN({ annotate: false }) }; });
  expect(result.comment).toContain('Läuferpaar'); expect(result.pgn).toContain('Nf3'); expect(result.pgn).toContain('Fesselt den Springer');
  expect(await page.evaluate(() => window.__kibitz.S.meta.provenance.rights.annotations)).toBe('GPL-3.0-or-later');
});

test('German library opening filters match aliases while imported English comments and stored documents remain literal', async ({ page }) => {
  const record = { id: 'private-english', title: 'Private English', kind: 'study', pgn: '[Event "Private English"]\n\n1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 {Pinning the knight, but Black soon has to give up the bishop pair. <img src=x>} *' };
  await german(page); await page.addInitScript(record => localStorage.setItem('kibitz.games', JSON.stringify([record])), record); await open(page); await page.locator('#modeAnalyse').click();
  await page.locator('[data-tab="library"]').click(); await expect(page.locator('#libList .game-search-meta').first()).toContainText('Königsindisch');
  const saved = await page.evaluate(() => localStorage.getItem('kibitz.games')); await page.locator('#libSearchFilters').evaluate(details => { details.open = true; }); await page.locator('#libOpening').fill('Königsindisch'); await expect(page.locator('#libList .game[data-collection="library"]')).toHaveCount(1);
  await page.locator('#libOpening').fill("King's Indian"); await expect(page.locator('#libList .game[data-collection="library"]')).toHaveCount(1);
  await search(page, 'bishop pair', 'library'); await expect(page.locator('#studySearchResults .study-hit')).toContainText('Pinning the knight'); await expect(page.locator('#studySearchResults img')).toHaveCount(0);
  await page.locator('#studyQuery').fill('Läuferpaar'); await expect(page.locator('#studySearchResults .study-hit')).toHaveCount(0); expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(saved);
});

test('German phone opening continuations and original-name tooltips fit without translation gaps', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await german(page); await open(page); await page.locator('#modeAnalyse').click(); await loadPgn(page, '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6');
  await page.locator('[data-tab="openings"]').click(); await expect(page.locator('#namedOpeningCurrent')).toContainText('Sizilianische Verteidigung: Najdorf-Variante');
  await expect(page.locator('#namedOpeningCurrent [title]')).toHaveAttribute('title', /Sicilian Defense: Najdorf Variation/);
  await page.locator('#openingVariations').screenshot({ path: info.outputPath('german-openings-phone.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
