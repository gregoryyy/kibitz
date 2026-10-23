// Conversation and board control (TODO 4.8–4.10), through the mock gateway and local commands.
import { test, expect, open, loadPgn, S } from './fixtures.mjs';

const requests = page => {
  const out = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) out.push(r.postDataJSON()); });
  return out;
};
const ask = async (page, q) => {
  const n = await page.locator('#chat .msg.coach').count();
  await page.locator('#coachInput').fill(q); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach')).toHaveCount(n + 1);
  const a = page.locator('#chat .msg.coach').last();
  await expect(a).not.toHaveClass(/thinking/, { timeout: 60_000 });
  await expect(page.locator('#coachStop')).toBeHidden();
  return a;
};
const action = (name, input) => `Please do this [mock:action:${name} ${JSON.stringify(input)}]`;

test('general questions send no position; context and history stay visible across tabs', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  await page.locator('#chatContext').selectOption('general');
  await expect(await ask(page, 'What is prophylaxis?')).toContainText('Mock coach');
  expect(JSON.stringify(bodies[0].messages)).not.toContain('Current position (FEN)');
  expect(bodies[0].tools).not.toContain('analyse');
  expect(bodies[0].messages[0].content).toContain('The player selected General chess');
  expect(bodies[0].messages[0].content).not.toContain('live-game help setting');
  await expect(page.locator('.message-context')).toHaveText('General chess');
  await ask(page, 'How can I practise it?');
  expect(JSON.stringify(bodies.at(-1).messages)).toContain('What is prophylaxis?');
  expect(JSON.stringify(bodies.at(-1).messages)).not.toContain('Current position (FEN)');
  for (const tab of ['review', 'library', 'reading', 'coach', 'game']) {
    await page.locator(`[data-tab="${tab}"]`).click();
    await expect(page.locator('#chatContext')).toHaveValue('general');
    await expect(page.locator('#chat .msg.coach')).toHaveCount(2);
    await expect(page.locator('#coachInput')).toBeVisible();
  }
  await page.locator('#chatContext').selectOption('position');
  await ask(page, 'What about this position?');
  expect(JSON.stringify(bodies.at(-1).messages)).toContain('Current position (FEN)');
  await page.locator('#chatContext').selectOption('general');
  await page.locator('#btnComment').click();
  await expect(page.locator('#chatContext')).toHaveValue('position');
});

test('typed chat moves work without an AI call and follow the player turn', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  await expect(await ask(page, 'play e4')).toContainText('Board updated');
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
  const before = await S(page);
  await expect(await ask(page, 'play Ke8')).toContainText('legal move');
  expect((await S(page)).nodes).toBe(before.nodes);
  expect(bodies).toHaveLength(0);
});

test('analysis commands use a scratch board, setups state the turn and castling, and undo restores it', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  await loadPgn(page, '1. e4 e5');
  await ask(page, 'play Nf3 Nc6');
  await expect(page.locator('#scratchMoves button')).toHaveText(['2. Nf3', 'Nc6']);
  expect((await S(page)).nodes).toBe(3);
  await ask(page, 'undo');
  await expect(page.locator('#scratchBar')).toBeHidden();
  await ask(page, 'remove the queens');
  const scratch = await page.evaluate(() => window.__kibitz.scratch());
  expect(scratch.start.split(' ')[0]).not.toMatch(/[qQ]/);
  await expect(page.locator('#chat .msg.coach').last()).toContainText('White · KQkq');
  await ask(page, 'undo');
  await ask(page, 'go to move 1');
  expect((await S(page)).cursor).toBe(1);
  await ask(page, 'undo');
  expect((await S(page)).cursor).toBe(2);
  expect(bodies).toHaveLength(0);
});

test('loading from chat asks before leaving a game, preserves it for return, and never writes the library', async ({ page }) => {
  await open(page);
  await ask(page, 'e4');
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
  await expect.poll(async () => (await S(page)).thinking).toBe(false);
  const games = await page.evaluate(() => localStorage.getItem('kibitz.games'));
  await page.locator('#coachInput').fill('open the Opera Game at move 10');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  expect((await S(page)).playing).toBe(true);
  await page.locator('#chatConfirm').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#coachStop')).toBeHidden();
  expect((await S(page)).nodes).toBe(3);

  await page.locator('#coachInput').fill('open the Opera Game at move 10');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  await page.locator('#coachStop').click();
  await expect(page.locator('#chatConfirm')).toBeHidden();
  expect((await S(page)).playing).toBe(true);

  await page.locator('#coachInput').fill('open the Opera Game at move 10');
  await page.locator('#coachSend').click();
  await page.locator('#chatConfirm').getByRole('button', { name: 'Leave and analyse' }).click();
  await expect(page.locator('#coachStop')).toBeHidden();
  expect((await S(page)).mode).toBe('analysis');
  expect((await S(page)).cursor).toBe(19);
  await expect(page.locator('#chatReturn')).toBeVisible();
  await page.locator('#chatReturn').click();
  await expect(page.locator('#coachStop')).toBeHidden();
  expect((await S(page)).playing).toBe(true);
  expect((await S(page)).nodes).toBe(3);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBe(games);
});

test('a model loads a game through the mock gateway, then receives its analysed position', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  const a = await ask(page, action('load_game', { id: 'ex-opera', ply: 19 }));
  await expect(a).toContainText('Mock coach used a tool');
  expect((await S(page)).cursor).toBe(19);
  expect(bodies).toHaveLength(2);
  const fen = await page.evaluate(() => window.__kibitz.S.nodes[19].fen);
  expect(bodies[1].messages.at(-1).content).toContain(`Current position (FEN): ${fen}`);
  expect(bodies[1].messages.at(-1).content).toContain('Stockfish 19 (depth');
  await expect(a.locator('.message-context')).toContainText('Morphy');
  await expect(a.locator('.evidence')).toHaveCount(0);
});

test('library and opening searches return usable records; an opening can be loaded without saving it', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  await ask(page, action('search_library', { query: 'Morphy' }));
  const games = JSON.parse(bodies.at(-1).messages.find(m => m.role === 'tool').content).games;
  expect(games.some(g => g.id === 'ex-opera')).toBe(true);
  expect(games[0].white).toMatch(/^«.*»$/);
  await ask(page, action('search_openings', { query: 'Italian' }));
  const openings = JSON.parse(bodies.at(-1).messages.find(m => m.role === 'tool').content).openings;
  expect(openings.length).toBeGreaterThan(0);
  await ask(page, action('load_opening', { moves: openings[0].moves }));
  expect((await S(page)).mode).toBe('analysis');
  expect((await S(page)).cursor).toBe(openings[0].moves.length);
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBeNull();
});

test('answer context links revisit analysis while keeping the active game available', async ({ page }) => {
  await open(page);
  await ask(page, 'What is the plan?');
  await ask(page, 'e4');
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
  await page.locator('.message-context').first().click();
  await expect(page.locator('#chatConfirm')).toBeVisible();
  await page.locator('#chatConfirm').getByRole('button', { name: 'Leave and analyse' }).click();
  expect((await S(page)).mode).toBe('analysis');
  expect((await S(page)).nodes).toBe(1);
  await page.locator('#chatReturn').click();
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
  expect((await S(page)).playing).toBe(true);
});

test('hostile loads and setups are refused before a board change', async ({ page }) => {
  await open(page);
  const before = await S(page);
  await expect(await ask(page, action('load_game', { id: '../../.env' }))).toContainText('not in the library');
  await expect(await ask(page, 'put a white knight on f5')).toContainText('only in analysis');
  await expect(await ask(page, action('load_position', { fen: '8/8/8/8/8/8/4k3/4K2Q w - - 0 1' }))).toContainText('check');
  expect((await S(page)).nodes).toBe(before.nodes);
  await expect(page.locator('#scratchBar')).toBeHidden();
});

test('a model cannot call an engine tool that the help setting withheld', async ({ page }) => {
  let round = 0, result;
  await page.route('**/api/ai/sample', async r => {
    const body = r.request().postDataJSON();
    if (++round === 1) return r.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ done: true, toolCalls: [{ id: 'sneak', name: 'analyse', input: { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1' } }] }) + '\n' });
    result = JSON.parse(body.messages.find(m => m.role === 'tool').content);
    return r.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text: 'No engine help.' }) + '\n' + JSON.stringify({ done: true }) + '\n' });
  });
  await open(page);
  await ask(page, 'Give me a hint');
  expect(result.error).toContain('not available');
});

test('a late answer cannot enter a new game history', async ({ page }) => {
  let release, entered;
  const gate = new Promise(r => { release = r; }), started = new Promise(r => { entered = r; });
  const bodies = [];
  await page.route('**/api/ai/sample', async r => {
    bodies.push(r.request().postDataJSON());
    if (bodies.length === 1) { entered(); await gate; }
    await r.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text: bodies.length === 1 ? 'OLD_ANSWER' : 'Fresh answer' }) + '\n' + JSON.stringify({ done: true }) + '\n' }).catch(() => {});
  });
  await open(page);
  await page.locator('#coachInput').fill('OLD_QUESTION'); await page.locator('#coachSend').click();
  await started;
  await page.locator('#btnNewGame').click(); release();
  await ask(page, 'New question');
  expect(JSON.stringify(bodies.at(-1).messages)).not.toContain('OLD_QUESTION');
  await expect(page.locator('#chat')).not.toContainText('OLD_ANSWER');
});

test('chat can load a pasted FEN and PGN, then explain the scratch position actually shown', async ({ page }) => {
  const bodies = requests(page);
  await open(page);
  await ask(page, '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  expect((await S(page)).mode).toBe('analysis');
  await ask(page, '1. e4 e5 2. Nf3 Nc6');
  expect((await S(page)).nodes).toBe(5);
  await ask(page, 'play Bb5 a6');
  await page.locator('#scratchPrev').click();
  const shown = await page.evaluate(() => { const s = window.__kibitz.scratch(); return s.fens[s.i]; });
  await ask(page, 'Explain the scratch board');
  expect(bodies.at(-1).messages.at(-1).content).toContain(`Position after the line (FEN): ${shown}`);
});

test('a named setup opens the initial study position without saving a game', async ({ page }) => {
  await open(page);
  await ask(page, 'set up a Lucena position');
  expect((await S(page)).cursor).toBe(0);
  expect((await S(page)).mode).toBe('analysis');
  expect(await page.evaluate(() => window.__kibitz.S.start)).toBe('1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1');
  expect(await page.evaluate(() => localStorage.getItem('kibitz.games'))).toBeNull();
});

test('chat context remains usable on phone portrait, landscape and tablet sizes', async ({ page }) => {
  await open(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#coachInput').scrollIntoViewIfNeeded();
    await expect(page.locator('#chatContext')).toBeVisible();
    await expect(page.locator('#coachInput')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('model board tools use the same scratch, navigation and undo rules as typed commands', async ({ page }) => {
  await open(page);
  await loadPgn(page, '1. e4 e5');
  await ask(page, action('move', { moves: ['Nf3', 'Nc6'] }));
  await expect(page.locator('#scratchMoves button')).toHaveText(['2. Nf3', 'Nc6']);
  await ask(page, action('setup', { pieces: [{ square: 'd1', piece: null }, { square: 'd8', piece: null }], turn: 'b' }));
  expect(await page.evaluate(() => window.__kibitz.scratch().start.split(' ')[1])).toBe('b');
  await ask(page, action('undo', {}));
  await expect(page.locator('#scratchMoves button')).toHaveText(['2. Nf3', 'Nc6']);
  await ask(page, action('goto', { ply: 1 }));
  expect((await S(page)).cursor).toBe(1);
  await expect(page.locator('#scratchBar')).toBeHidden();
  expect((await S(page)).nodes).toBe(3);
});

test('a line can be shortened by two moves and the whole change undone', async ({ page }) => {
  await open(page);
  await page.locator('#modeAnalyse').click();
  await ask(page, 'play e4 e5 Nf3');
  await ask(page, 'take back two moves');
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4']);
  await ask(page, 'undo');
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. e4', 'e5', '2. Nf3']);
});

test('local board commands are available when the AI provider is off', async ({ page }) => {
  await page.route('**/api/ai/status', async r => {
    const response = await r.fetch(); const status = await response.json();
    await r.fulfill({ json: { ...status, available: false, reason: 'No model configured' } });
  });
  await open(page);
  await expect(page.locator('#coachOff')).toBeVisible();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await ask(page, 'e4');
  await expect.poll(async () => (await S(page)).nodes).toBe(3);
});

test('a late summary cannot overwrite a newly loaded game', async ({ page }) => {
  let release, entered;
  const gate = new Promise(r => { release = r; }), started = new Promise(r => { entered = r; });
  await page.route('**/api/ai/sample', async r => {
    entered(); await gate;
    await r.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text: 'SUMMARY_FOR_OLD_GAME' }) + '\n' + JSON.stringify({ done: true }) + '\n' });
  });
  await open(page);
  await loadPgn(page, '1. e4 e5');
  await page.evaluate(() => { window.__kibitz.S.reviewDone = true; });
  await page.locator('[data-tab="review"]').click();
  await page.locator('#btnSummary').click(); await started;
  await loadPgn(page, '1. d4 d5');
  const response = page.waitForResponse(r => r.url().endsWith('/api/ai/sample'));
  release();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await (await response).finished();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate(() => window.__kibitz.S.summary)).toBe('');
});
