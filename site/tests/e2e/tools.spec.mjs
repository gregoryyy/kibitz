// Engine tools for the coach (TODO 4.11): the loop runs in the page, on its own Stockfish, with the
// mock provider calling tools when a question asks it to ([mock:tool], [mock:loop], [mock:bad-tool]).
import { test, expect, open } from './fixtures.mjs';

const record = page => {
  const bodies = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) bodies.push(r.postDataJSON()); });
  return bodies;
};
const ask = async (page, q) => {
  await page.locator('#coachInput').fill(q); await page.locator('#coachSend').click();
  const a = page.locator('#chat .msg.coach').last();
  await expect(a).not.toHaveClass(/thinking/, { timeout: 60_000 });
  await expect(page.locator('#coachStop')).toBeHidden({ timeout: 60_000 });
  return a;
};

test('the coach calls a tool: the page runs it on Stockfish, sends the result back and shows the evidence', async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page, 'Is e4 good? [mock:tool]');
  await expect(a).toContainText('Mock coach used a tool and read:');
  expect(bodies).toHaveLength(2);
  expect(bodies[0].tools).toEqual(['analyse', 'try_move', 'threats', 'compare', 'find_mate', 'find_motifs']);
  const toolMsg = bodies[1].messages.at(-1);
  expect(toolMsg.role).toBe('tool');
  const result = JSON.parse(toolMsg.content);
  expect(result.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  expect(result.lines.length).toBeGreaterThan(0);
  expect(result.lines[0].moves).toMatch(/^1\. /);
  await expect(a.locator('.evidence summary')).toHaveText('Stockfish checked one thing for this answer');
  await a.locator('.evidence summary').click();
  await expect(a.locator('.evidence li')).toContainText(/^analyse, depth \d+/);
});

test('a model that keeps calling tools is stopped: at most 4 rounds, then it must answer', async ({ page }) => {
  test.setTimeout(120_000);
  const bodies = record(page);
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page, 'Analyse forever [mock:loop]');
  expect(bodies).toHaveLength(5);
  expect(bodies.slice(0, 4).every(b => Array.isArray(b.tools))).toBe(true);
  expect(bodies[4].tools).toBeUndefined(); // the last round offers none
  await expect(a).toContainText('Mock coach used a tool');
  await expect(a.locator('.evidence summary')).toHaveText('Stockfish checked 4 things for this answer');
});

test('hostile tool arguments are refused and the model is told why; nothing runs', async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator('#modeAnalyse').click();
  const a = await ask(page, 'Break it [mock:tool] [mock:bad-tool]');
  const result = JSON.parse(bodies[1].messages.at(-1).content);
  expect(result).toEqual({ error: 'not a legal position (FEN)' });
  await expect(a).toContainText('not a legal position');
  await expect(a.locator('.evidence')).toHaveCount(0);
});

test('no tools in a game with less engine help: the coach can\'t ask Stockfish what the player may not see', async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator('#optHelp button[data-v="flags"]').click();
  await page.locator('#btnNewGame').click();
  await ask(page, 'What now? [mock:tool]');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].tools).toBeUndefined();
});

test('a provider that refuses tools: the page asks again without them, and stops offering them', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/ai/sample', async r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (body.tools) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'The AI provider rejected the request: "m" does not support tools' } }) });
    return r.continue();
  });
  await open(page);
  await page.locator('#modeAnalyse').click();
  await expect(await ask(page, 'First')).toContainText('Mock coach');
  await expect(await ask(page, 'Second')).toContainText('Mock coach');
  expect(bodies.map(b => !!b.tools)).toEqual([true, false, false]);
});
