// Engine tools for the coach (TODO 4.11): the loop runs in the page, on its own Stockfish, with the
// mock provider calling tools when a question asks it to ([mock:tool], [mock:loop], [mock:bad-tool]).
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';

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
  expect(bodies[0].tools).toEqual(expect.arrayContaining(['analyse', 'try_move', 'threats', 'compare', 'find_mate', 'find_motifs', 'search_library', 'load_game', 'setup']));
  expect(bodies[0].messages[0].content).toContain('Stockfish evaluation tools are available');
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

for (const help of ['flags', 'eval', 'off']) test(`no engine tools during live play with ${help} help: explain the restriction`, async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator(`#optHelp button[data-v="${help}"]`).click();
  await page.locator('#btnNewGame').click();
  await ask(page, 'What now? [mock:tool]');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].tools).not.toContain('analyse');
  expect(bodies[0].tools).toContain('load_game');
  expect(bodies[0].messages[0].content).toContain('live-game help setting');
  expect(bodies[0].messages[0].content).toContain('Full engine');
});

/** Earlier restricted-mode replies must not obscure tools enabled later in the same conversation. */
test('enabling full help makes Stockfish available after a restricted live-game reply', async ({ page }) => {
  const bodies = record(page);
  const denial = 'Ich habe keinen Befehl, mit dem ich Stockfish direkt befragen kann.';
  let replies = 0;
  await page.route('**/api/ai/sample', r => ++replies === 1
    ? r.fulfill({ contentType: 'application/x-ndjson', body: `${JSON.stringify({ text: denial })}\n${JSON.stringify({ done: true })}\n` })
    : r.continue());
  await open(page);
  await page.locator('#optHelp button[data-v="flags"]').click();
  await page.locator('#btnNewGame').click();
  await expect(await ask(page, 'Can you ask Stockfish?')).toContainText(denial);
  await page.locator('#optHelp button[data-v="full"]').click();
  const answer = await ask(page, 'Ask Stockfish now. [mock:tool]');
  expect(bodies[1].tools).toContain('analyse');
  expect(bodies[1].messages[0].content).toContain('Stockfish evaluation tools are available');
  expect(bodies[1].messages.some(m => m.role === 'assistant' && m.content === denial)).toBe(true);
  await expect(answer.locator('.evidence summary')).toHaveText('Stockfish checked one thing for this answer');
});

test('a provider that refuses tools: the page asks again without them, and stops offering them', async ({ page }) => {
  const bodies = [];
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await page.route('**/api/ai/sample', async r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (body.tools) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'The AI provider rejected the request: "m" does not support tools' } }) });
    return r.continue();
  });
  await open(page);
  await page.locator('#modeAnalyse').click();
  await expect(await ask(page, 'What is the main plan for the side to move here, and why?')).toContainText('Mock coach');
  await expect(await ask(page, "Explain the idea behind Stockfish's best move in this position.")).toContainText('Mock coach');
  expect(bodies.map(b => !!b.tools)).toEqual([true, false, false]);
  await expect(page.locator('#chat .msg.coach .tool-notice')).toHaveCount(2);
  await expect(page.locator('#chat .msg.coach .tool-notice').first()).toContainText('Dieses Modell kann keine Werkzeuge aufrufen');
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  expect(bodies[1].messages[0].content).toContain('This model cannot call tools');
  await expect(page.locator('#chat .msg.coach').last().locator('.evidence')).toHaveCount(0);
});

/** Full engine help permits fresh Stockfish requests during play, including after a service failure. */
test('a transient provider error preserves Stockfish access during a live game with full help', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/ai/sample', r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (bodies.length === 1) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_error', message: 'Temporary service error' } }) });
    return r.continue();
  });
  await open(page);
  await page.locator('#optHelp button[data-v="full"]').click();
  await page.locator('#btnNewGame').click();
  expect(await page.evaluate(() => window.__kibitz.S.playing)).toBe(true);
  await ask(page, 'Evaluate this position.');
  await expect(page.locator('#chat .msg.coach').last()).toHaveAttribute('data-error', 'provider_error');
  const answer = await ask(page, 'Please ask Stockfish. [mock:tool]');
  await expect(answer.locator('.evidence summary')).toHaveText('Stockfish checked one thing for this answer');
  expect(bodies.every(b => b.tools?.includes('analyse'))).toBe(true);
});

/** A rejected parameter is not evidence that the model lacks function calling. */
test('an unrelated request rejection does not silently fall back or disable engine tools', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/ai/sample', r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (bodies.length === 1) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'Invalid effort parameter' } }) });
    return r.continue();
  });
  await open(page); await page.locator('#modeAnalyse').click();
  await ask(page, 'Check the position.');
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Invalid effort parameter');
  expect(bodies).toHaveLength(1);
  await expect((await ask(page, 'Try again. [mock:tool]')).locator('.evidence')).toHaveCount(1);
});

/** Quick and chat tasks may use different models; one model's limitations must not affect the other. */
test('an unsupported quick model does not disable the chat model Stockfish tools', async ({ page }) => {
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(), status = await response.json();
    await r.fulfill({ json: { ...status, models: { ...status.models, quick: 'text-only-model' } } });
  });
  const bodies = [];
  await page.route('**/api/ai/sample', r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (body.task === 'quick' && body.tools) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'This model does not support tools' } }) });
    return r.continue();
  });
  await open(page); await page.locator('#modeAnalyse').click();
  await page.locator('#coachChips .chip').first().click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  await expect(page.locator('#coachStop')).toBeHidden();
  await expect((await ask(page, 'Use Stockfish now. [mock:tool]')).locator('.evidence')).toHaveCount(1);
  expect(bodies.filter(b => b.task === 'chat').every(b => b.tools?.includes('analyse'))).toBe(true);
});

test('a refreshed model selection restores tools without reloading the page', async ({ page }) => {
  let model = 'text-only-model';
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(), status = await response.json();
    await r.fulfill({ json: { ...status, model, models: { quick: model, chat: model, review: model } } });
  });
  await page.route('**/api/ai/sample', r => {
    if (model === 'text-only-model' && r.request().postDataJSON().tools) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'This model does not support tools' } }) });
    return r.continue();
  });
  await open(page); await page.locator('#modeAnalyse').click();
  await ask(page, 'First question.'); model = 'mock';
  await openSettings(page); await expect(page.locator('#coachModels')).toContainText('mock'); await closeSettings(page);
  await expect((await ask(page, 'Use the selected model. [mock:tool]')).locator('.evidence')).toHaveCount(1);
});

/** An explicit successful connection test lets the same model be tried again after reconfiguration. */
test('testing the connection retries tool support for the same model', async ({ page }) => {
  const bodies = [];
  await page.route('**/api/ai/sample', r => {
    const body = r.request().postDataJSON(); bodies.push(body);
    if (bodies.length === 1) return r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'This model does not support tools' } }) });
    return r.continue();
  });
  await open(page); await page.locator('#modeAnalyse').click();
  await ask(page, 'First question.'); await ask(page, 'Second question.');
  expect(bodies.map(b => !!b.tools)).toEqual([true, false, false]);
  await openSettings(page); await page.locator('#btnTestAi').click();
  await expect(page.locator('#testAiMsg')).toContainText('Connected'); await closeSettings(page);
  const answer = await ask(page, 'Retry tools after reconnecting. [mock:tool]');
  await expect(answer.locator('.evidence')).toHaveCount(1); await expect(answer.locator('.tool-notice')).toHaveCount(0);
});

/** A late capability error belongs to the original route, not a newly selected model. */
test('a late rejection from the previous model cannot trigger a fallback on the new model', async ({ page }) => {
  let model = 'previous-model', pending;
  const bodies = [];
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(), status = await response.json();
    await r.fulfill({ json: { ...status, model, models: { quick: model, chat: model, review: model } } });
  });
  await page.route('**/api/ai/sample', r => {
    bodies.push(r.request().postDataJSON());
    if (bodies.length === 1) { pending = r; return; }
    return r.continue();
  });
  await open(page); await page.locator('#modeAnalyse').click();
  await page.locator('#coachInput').fill('Ask the engine.'); await page.locator('#coachSend').click();
  await expect.poll(() => !!pending).toBe(true); model = 'mock';
  await openSettings(page); await expect(page.locator('#coachModels')).toContainText('mock'); await closeSettings(page);
  await pending.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'This model does not support tools' } }) });
  await expect(page.locator('#coachStop')).toBeHidden(); expect(bodies).toHaveLength(1);
  await expect((await ask(page, 'Use this model. [mock:tool]')).locator('.evidence')).toHaveCount(1);
});

test('a supplied legal line is not labelled as engine evidence; only confirmed motifs are returned', async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator('#modeAnalyse').click();
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const a = await ask(page, `Check this line [mock:action:find_motifs ${JSON.stringify({ fen, line: ['e4', 'e5'] })}]`);
  const result = JSON.parse(bodies[1].messages.at(-1).content);
  expect(result.line.map(r => r.status)).toEqual(['no pattern', 'no pattern']);
  expect(result.line.every(r => r.motifs.length === 0)).toBe(true);
  await a.locator('.evidence summary').click();
  await expect(a.locator('.evidence li')).toContainText('e4 (no pattern) e5 (no pattern)');
});

test('the tool shows a legal mate as confirmed even though Stockfish has no PV after checkmate', async ({ page }) => {
  const bodies = record(page);
  await open(page);
  await page.locator('#modeAnalyse').click();
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
  const a = await ask(page, `Check this mate [mock:action:find_motifs ${JSON.stringify({ fen, line: ['Nf6', 'Qxf7#'] })}]`);
  const result = JSON.parse(bodies[1].messages.at(-1).content);
  expect(result.line[1].status).toBe('confirmed');
  expect(result.line[1].payoff).toBe('checkmate');
  expect(result.line[1].motifs).toContain('Qxf7# is checkmate');
  await a.locator('.evidence summary').click();
  await expect(a.locator('.evidence li')).toContainText('Qxf7# is checkmate');
});
