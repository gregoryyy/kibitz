/** @file Authored opening background, current pawn patterns and the permitted coach context. */
import { Chess } from 'chess.js';
import { test, expect, open, loadPgn, S, reveal } from './fixtures.mjs';

const FRENCH = '1. e4 e6 2. d4 d5 3. e5';
const FRENCH_OPEN = '1. e4 e6 2. d4 d5';
const guide = (page, id) => page.locator(`.opening-guide[data-guide="${id}"]`);
const tab = page => page.locator('[data-tab="openings"]').click();
const record = page => {
  const bodies = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) bodies.push(r.postDataJSON()); });
  return bodies;
};
async function ask(page, question) {
  await page.locator('#coachInput').fill(question); await page.locator('#coachSend').click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer).not.toHaveClass(/thinking/, { timeout: 60_000 });
  await expect(page.locator('#coachStop')).toBeHidden({ timeout: 60_000 });
  return answer;
}
const prompt = body => body.messages.at(-1).content;

test('guides explain both plans and structures without changing a game or calling a provider', async ({ page }) => {
  const bodies = record(page);
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(), status = await response.json();
    await r.fulfill({ json: { ...status, available: false, reason: 'No model configured' } });
  });
  await open(page); await loadPgn(page, FRENCH); await tab(page);
  const before = await S(page), games = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await expect(guide(page, 'french')).toContainText('French Defence');
  await expect(guide(page, 'french').locator('dt')).toHaveText(['Idea', 'Typical plans', 'Pawn structures']);
  await expect(guide(page, 'french-chain')).toContainText('White’s d4–e5 chain faces Black’s d5–e6 chain');
  await expect(guide(page, 'french-chain')).toContainText('Pawn-structure pattern');
  await expect(page.locator('#coachOff')).toBeVisible();
  await expect(page.locator('#discussOpening')).toBeDisabled();
  expect(bodies).toEqual([]); expect(await S(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(games);
});

/** General mode must become position mode when the player explicitly discusses a board guide. */
test('discussing a guide sends quoted background for the displayed position and keeps engine evidence separate', async ({ page }) => {
  const bodies = record(page);
  await open(page); await loadPgn(page, FRENCH); await tab(page);
  await page.locator('#chatContext').selectOption('general');
  await page.locator('#discussOpening').click();
  await expect(page.locator('#coachStop')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  await expect(page.locator('#chatContext')).toHaveValue('position');
  expect(prompt(bodies[0])).toContain('Kibitz opening study notes');
  expect(prompt(bodies[0])).toContain('Guide «french»');
  expect(prompt(bodies[0])).toContain('not engine evidence');
  expect(prompt(bodies[0])).toContain('Stockfish 19 (depth');
  await expect(page.locator('#chat .evidence')).toHaveCount(0);
  const answer = await ask(page, 'Check this with Stockfish. [mock:tool]');
  await expect(answer.locator('.evidence summary')).toHaveText('Stockfish checked one thing for this answer');
});

test('guides follow a scratch branch without inheriting a later opening, and setups clear disconnected history', async ({ page }) => {
  await open(page); await loadPgn(page, FRENCH); await tab(page);
  await page.locator('#btnFirst').click(); await page.locator('#btnNext').click();
  await ask(page, 'play c5');
  await expect(guide(page, 'sicilian')).toBeVisible(); await expect(guide(page, 'french')).toHaveCount(0);
  await page.locator('#scratchClose').click(); await page.locator('#btnLast').click();
  await expect(guide(page, 'french-chain')).toBeVisible();
  await ask(page, 'remove e6');
  await expect(guide(page, 'french')).toHaveCount(0); await expect(guide(page, 'french-chain')).toHaveCount(0);
  const bodies = record(page); await ask(page, 'Explain this setup.');
  expect(prompt(bodies[0])).not.toContain('Guide «french»');
  expect(prompt(bodies[0])).not.toContain('Opening: C');
  expect((await S(page)).nodes).toBe(6);
});

test('a transposed position finds the same opening and a later exchange removes its pawn note', async ({ page }) => {
  await open(page); await loadPgn(page, '1. d4 d5 2. e4 e6 3. e5'); await tab(page);
  await expect(guide(page, 'french-chain')).toBeVisible();
  await expect(guide(page, 'french')).toContainText('Known opening position');
  await loadPgn(page, `${FRENCH} c5 4. Nf3 Nc6 5. c3 f6 6. exf6 Nxf6`); await tab(page);
  await expect(guide(page, 'french')).toBeVisible(); await expect(guide(page, 'french-chain')).toHaveCount(0);
});

/** Previously rendered guide text and held buttons cannot bypass a live-help change. */
test('all restricted live-help modes clear guides and withhold them from prompts, including while the tab is closed', async ({ page }) => {
  const bodies = record(page), c = new Chess(); c.loadPgn(FRENCH_OPEN);
  await open(page); await page.locator('#optHelp button[data-v="full"]').click();
  await page.locator('#optStart button[data-v="fen"]').click(); await page.locator('#fenInput').fill(c.fen());
  await page.locator('#btnNewGame').click(); await tab(page);
  await expect(guide(page, 'french')).toBeVisible();
  await page.locator('#discussOpening').evaluate(b => { window.__oldGuideButton = b; });
  for (const help of ['flags', 'eval', 'off']) {
    await page.locator('[data-tab="game"]').click(); await page.locator(`#optHelp button[data-v="${help}"]`).click();
    await expect(page.locator('#openingGuidePanel')).toBeHidden(); await expect(page.locator('#openingGuideBody')).toBeEmpty();
    await ask(page, 'Explain the opening.');
    expect(prompt(bodies.at(-1))).not.toContain('Kibitz opening study notes');
    expect(bodies.at(-1).tools).not.toContain('analyse');
  }
  const requests = bodies.length; await page.evaluate(() => window.__oldGuideButton.click());
  expect(bodies).toHaveLength(requests); expect((await S(page)).playing).toBe(true);
  await page.locator('#optHelp button[data-v="full"]').click(); await tab(page);
  await expect(guide(page, 'french')).toBeVisible();
  await page.locator('#chatContext').selectOption('general'); await ask(page, 'What is an opening?');
  expect(prompt(bodies.at(-1))).not.toContain('Kibitz opening study notes');
});

test('a stale guide button cannot ask about a replacement game', async ({ page }) => {
  const bodies = record(page);
  await open(page); await loadPgn(page, FRENCH); await tab(page);
  await page.locator('#discussOpening').evaluate(b => { window.__oldGuideButton = b; });
  await loadPgn(page, '1. e4 c5'); await tab(page);
  await page.evaluate(() => window.__oldGuideButton.click()); expect(bodies).toEqual([]);
  await expect(guide(page, 'sicilian')).toBeVisible();
});

test('German phone guides use translated prose without overflow or untranslated interface text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await reveal(page, '#loadText');
  await page.locator('#loadText').fill(FRENCH); await page.locator('#btnLoad').click();
  await expect(page.locator('#loadMsg')).toHaveText('5 Züge geladen.'); await tab(page);
  await expect(page.locator('#openingGuidePanel h3')).toHaveText('Eröffnungsideen');
  await expect(guide(page, 'french').locator('h4')).toHaveText('Französische Verteidigung');
  await expect(guide(page, 'french-chain').locator('h4')).toHaveText('Verriegeltes französisches Zentrum');
  await expect(guide(page, 'french').locator('dt')).toHaveText(['Idee', 'Typische Pläne', 'Bauernstrukturen']);
  await expect(page.locator('#discussOpening')).toHaveText('Diese Ideen besprechen');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
