// Scanner follow-up: classification and phrase substitution bugs, with actual UI rendering.
import { Chess } from 'chess.js';
import { test, expect, open, loadPgn } from './fixtures.mjs';

test('a later Semi-Slav mention cannot replace the opening family used by the guide', async ({ page }) => {
  const pgn = '1. d4 d5 2. c4 e6', c = new Chess(); c.loadPgn(pgn);
  // Synthetic catalogue metadata isolates the family rule from the actual opening corpus.
  await page.route('**/eco.json', route => route.fulfill({ json: { [c.fen().split(' ').slice(0, 4).join(' ')]: ['D30', "Queen's Gambit Declined: Semi-Slav transposition"] } }));
  await open(page); await loadPgn(page, pgn); await page.locator('[data-tab="openings"]').click();
  await expect(page.locator('.opening-guide[data-guide="queens-gambit"]')).toBeVisible();
  await expect(page.locator('.opening-guide[data-guide="slav"]')).toHaveCount(0);
});

test('the page translator fills repeated phrase slots literally and keeps markup as text', async ({ page }) => {
  const value = '$& <img src=x onerror=window.__literalExecuted=true>', translated = `wörtlich ${value}`;
  const entries = { 'literal phrase {p}': 'Auswahl {p|* against *}', [`@${value} against ${value}`]: translated };
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await page.route('**/platform/i18n-de.js', async route => {
    const response = await route.fetch(), source = await response.text();
    // Extend the app-owned dictionary fixture; the real translator/MutationObserver renders it.
    await route.fulfill({ response, body: source.replace('export default {', () => `export default { ...${JSON.stringify(entries)},`) });
  });
  await open(page);
  await page.evaluate(value => {
    const node = document.createElement('p'); node.id = 'literalPhrase'; node.textContent = `literal phrase ${value}`;
    document.body.append(node);
  }, value);
  await expect(page.locator('#literalPhrase')).toHaveText(`Auswahl ${translated}`);
  await expect(page.locator('#literalPhrase img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__literalExecuted)).toBeUndefined();
});
