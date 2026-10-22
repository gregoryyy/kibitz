// Languages (TODO 10.8): switching to German translates the page, asks the coach for German, and
// reads German move letters. With ?debug the page lists any text it showed without a translation.
import { test, expect, open, reveal, OPERA } from './fixtures.mjs';

const gaps = page => page.evaluate(() => [.../** @type {any} */ (window).__kibitz.I18N_GAPS].map(([text, where]) => `${text} (${where})`));

test('German: the switch translates the page, the coach is asked for German, and nothing shown is left in English', async ({ page }) => {
  test.setTimeout(120_000);
  let sent = null;
  await page.route('**/api/ai/sample', async r => {
    sent = r.request().postDataJSON();
    await r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ text: 'Spiel Sf3 und dann Dh5, wie in der Opernpartie.' }, { done: true, truncated: false }].map(l => JSON.stringify(l)).join('\n') + '\n' });
  });
  await open(page);
  await expect(page.locator('[data-tab="game"]')).toHaveText('Game');
  await page.locator('#optLang').selectOption('de');
  await expect(page.locator('#engineDot')).toHaveClass(/ok/); // the page reloads in German
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('[data-tab="game"]')).toHaveText('Partie');
  await expect(page.locator('#btnNewGame')).toHaveText('Partie starten');
  await expect(page.locator('#coachInput')).toHaveAttribute('placeholder', 'Frag nach dieser Stellung, deinem letzten Zug oder einem Plan');
  await expect(page.locator('#coachCtx')).toContainText('Weiß am Zug');

  // A move typed with German letters
  await page.locator('#modeAnalyse').click();
  await page.locator('#moveInput').fill('Sf3'); await page.locator('#moveInput').press('Enter');
  await expect(page.locator('#moves button').first()).toContainText('Nf3');

  // The coach: asked in English for a German answer; the answer's German letters are read as moves
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachChips .chip', { hasText: 'Was ist der Plan?' }).click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer).not.toHaveClass(/thinking/);
  expect(JSON.stringify(sent.messages)).toContain('Answer in German (Deutsch)');
  await expect(page.locator('#chat .msg.user').last()).toHaveText('Was ist hier der Hauptplan für die Seite am Zug, und warum?');
  await expect(answer.locator('.san', { hasText: 'Nf6' })).toHaveCount(0);
  await expect(answer).toContainText('Spiel Nf3 und dann Qh5');
  await expect(answer.locator('.game-ref')).toHaveText('der Opernpartie');

  // Every tab, a loaded game and the reading list: no text shown without a translation
  await page.locator('[data-tab="game"]').click(); await reveal(page, '#loadText');
  await page.locator('#loadText').fill(OPERA); await page.locator('#btnLoad').click();
  await expect(page.locator('#loadMsg')).toHaveText('33 Züge geladen.');
  for (const tab of ['game', 'coach', 'review', 'library', 'reading']) { await page.locator(`[data-tab="${tab}"]`).click(); await page.waitForTimeout(200); }
  await page.locator('[data-tab="library"]').click();
  await page.locator('#libFilter button[data-v="classics"]').click();
  await expect(page.locator('#libList')).toContainText('Die Opernpartie');
  expect(await gaps(page)).toEqual([]);

  // And back to English
  await page.locator('#optLang').selectOption('en');
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await expect(page.locator('[data-tab="game"]')).toHaveText('Game');
});

test('switching the language in a running game keeps the game going', async ({ page }) => {
  await open(page);
  await page.locator('#btnNewGame').click();
  await page.locator('#moveInput').fill('e4'); await page.locator('#moveInput').press('Enter');
  await expect(page.locator('#moves button')).toHaveCount(2, { timeout: 30_000 });
  await page.locator('#optLang').selectOption('de');
  await expect(page.locator('[data-tab="game"]')).toHaveText('Partie');
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await expect(page.locator('#moves button')).toHaveCount(2);
  expect(await page.evaluate(() => { const { S } = /** @type {any} */ (window).__kibitz; return [S.mode, S.playing]; })).toEqual(['play', true]);
});
