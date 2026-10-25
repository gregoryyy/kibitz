// Real CLI advertises the optional runtime; a fake Window API prevents all model downloads.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';

let server, base, output = '';
test.beforeAll(async () => {
  const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve)); base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['scripts/serve.mjs', 'dist', '--api', '--env=', '--index', '_test.html', '--port', String(port)], {
    cwd: process.cwd(), env: { ...process.env, AI_PROVIDER: 'mock', BROWSER_RUNTIME: 'chrome', AI_LOCAL_ONLY: '', AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', OLLAMA_MODEL: '', EMBEDDING_PROVIDER: 'mock' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome test server startup timed out: ' + output)), 15_000);
    server.stdout.on('data', chunk => { output += chunk; if (output.includes('Serving ')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { output += chunk; });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', () => { clearTimeout(timer); reject(new Error(output)); });
  });
});
test.afterAll(async () => { if (server && server.exitCode === null) { const closed = new Promise(resolve => server.once('exit', resolve)); server.kill(); await closed; } });
test.beforeEach(({ request }) => request.post(`${base}/api/ai/config`, { data: { localOnly: false, provider: 'mock' } }));

async function fakeChrome(page, options = {}) {
  await page.addInitScript(({ availability = 'available', missing = false, hold = false }) => {
    Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { brands: [{ brand: 'Google Chrome', version: '148' }] } });
    const state = window.__chromeFake = { creates: [], requests: [], sessions: [], probes: [], hold, release: null };
    function session(isBase = false) {
      const current = Object.assign(new EventTarget(), { isBase, destroyed: 0, contextWindow: 100_000,
        clone: async () => session(), measureContextUsage: async () => 100,
        promptStreaming(messages, options) {
          if (isBase) throw new Error('base was prompted');
          state.requests.push({ messages, constrained: !!options.responseConstraint });
          const words = options.responseConstraint ? ['{"arrows":[],', '"highlights":[]}'] : ['Chrome coach: ', 'develop a piece.']; let at = 0;
          return new ReadableStream({ async pull(controller) {
            await new Promise(resolve => setTimeout(resolve, 20));
            if (options.signal.aborted) controller.error(new DOMException('Stopped', 'AbortError'));
            else if (at === words.length) controller.close(); else controller.enqueue(words[at++]);
          } });
        }, destroy() { current.destroyed++; },
      });
      state.sessions.push(current); return current;
    }
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: missing ? undefined : {
      availability(options) { state.probes.push(options); return Promise.resolve(availability); },
      create(options) {
        state.creates.push({ active: navigator.userActivation.isActive, inputs: options.expectedInputs, outputs: options.expectedOutputs });
        const monitor = new EventTarget(); options.monitor(monitor); const progress = new Event('downloadprogress'); progress.loaded = 0.5; monitor.dispatchEvent(progress);
        if (state.hold) return new Promise(resolve => { state.release = () => { state.hold = false; resolve(session(true)); }; });
        return Promise.resolve(session(true));
      },
    } });
  }, options);
}
async function selectBrowser(page) {
  await openSettings(page); await page.locator('#optProvider button[data-v="browser"]').click(); await closeSettings(page);
  await page.locator('[data-tab="coach"]').click(); await expect(page.locator('#browserModelBox')).toBeVisible();
}
async function ask(page, text) {
  await page.locator('#coachInput').fill(text); await page.locator('#coachSend').click();
  await expect(page.locator('#coachSend')).toBeEnabled(); return page.locator('#chat .msg.coach').last();
}

test('Chrome needs an explicit Load per session, streams locally, uses disposable contexts and restores only its offline choice', async ({ page }) => {
  await fakeChrome(page); const gateway = [];
  page.on('request', request => { if (request.url().endsWith('/api/ai/sample')) gateway.push(request.url()); });
  await open(page, `${base}/?debug`); await selectBrowser(page);
  await expect(page.locator('#browserModelName')).toHaveText('Chrome built-in model');
  await expect(page.locator('#browserModelNotice')).toContainText('download its model');
  await expect(await ask(page, 'What now?')).toContainText('press Load');
  expect(await page.evaluate(() => window.__chromeFake.creates)).toHaveLength(0);
  await page.locator('#btnLoadModel').click(); await expect(page.locator('#browserModelState')).toHaveText('ready in Chrome');
  expect(await page.evaluate(() => window.__chromeFake.creates[0].active)).toBe(true);
  await expect(await ask(page, 'What now?')).toContainText('Chrome coach: develop a piece.');
  const schema = await page.evaluate(() => window.__kibitz.browserSample('JSON', { schema: { name: 'annotations', schema: { type: 'object' } } }));
  expect(JSON.parse(schema.text)).toEqual({ arrows: [], highlights: [] });
  await openSettings(page); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toHaveText(/^Working in Chrome, \d+ ms\.$/); await closeSettings(page);
  expect(gateway).toHaveLength(0);
  expect(await page.evaluate(() => window.__chromeFake.sessions.filter(s => !s.isBase).every(s => s.destroyed === 1))).toBe(true);
  expect(await page.evaluate(() => window.__chromeFake.requests[0].messages.at(-1).content)).toContain('What now?');
  await page.locator('#btnUnloadModel').click(); await expect(page.locator('#browserModelState')).toContainText('press Load');
  await expect(await ask(page, 'Again?')).toContainText('press Load'); expect(await page.evaluate(() => window.__chromeFake.creates)).toHaveLength(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.offlineCoach')).model)).toEqual({ runtime: 'chrome', name: 'Chrome built-in model' });
  expect(await page.evaluate(() => localStorage.getItem('kibitz.browserModelOk'))).toBeNull();
  await page.route('**/api/ai/status', route => route.abort()); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await expect(page.locator('#browserModelState')).toContainText('press Load');
  expect(await page.evaluate(() => window.__chromeFake.creates)).toHaveLength(0);
  await page.locator('#btnLoadModel').click(); await expect(page.locator('#browserModelState')).toHaveText('ready in Chrome');
  await expect(await ask(page, 'Offline?')).toContainText('Chrome coach'); expect(gateway).toHaveLength(0);
});

for (const [name, options] of [['absent', { missing: true }], ['unavailable', { availability: 'unavailable' }]]) test(`${name} Chrome model shows a closed state without download or cloud fallback`, async ({ page }) => {
  await fakeChrome(page, options); await open(page, `${base}/?debug`); await selectBrowser(page);
  await expect(page.locator('#browserModelState')).toContainText('unavailable here'); await expect(page.locator('#btnLoadModel')).toBeDisabled();
  expect(await page.evaluate(() => window.__chromeFake.creates)).toHaveLength(0);
  await expect(await ask(page, 'Explain this')).toContainText('press Load');
  expect(await page.evaluate(() => window.__chromeFake.requests)).toHaveLength(0);
});

test('switching away cancels a held Load; quick questions can use Chrome while typed chat uses the selected gateway', async ({ page }) => {
  await fakeChrome(page, { hold: true }); await open(page, `${base}/?debug`);
  await openSettings(page); await page.locator('#optQuickInBrowser').check(); await closeSettings(page); await page.locator('[data-tab="coach"]').click();
  await page.locator('#btnLoadModel').click(); await expect(page.locator('#browserModelState')).toContainText('loading');
  await openSettings(page); await page.locator('#optQuickInBrowser').uncheck(); await closeSettings(page); await expect(page.locator('#browserModelBox')).toBeHidden();
  await page.evaluate(() => window.__chromeFake.release());
  await expect.poll(() => page.evaluate(() => window.__chromeFake.sessions[0].destroyed)).toBe(1);
  await openSettings(page); await page.locator('#optQuickInBrowser').check(); await closeSettings(page);
  await page.locator('#btnLoadModel').click(); await expect(page.locator('#browserModelState')).toHaveText('ready in Chrome');
  await page.locator('#coachChips .chip').first().click(); await expect(page.locator('#chat .msg.coach').last()).toContainText('Chrome coach');
  await expect(await ask(page, 'Typed request')).toContainText('Mock coach');
});

test('German phone controls explain Chrome loading and fit the screen', async ({ page }, info) => {
  await fakeChrome(page, { availability: 'downloadable' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page, `${base}/?debug`); await selectBrowser(page);
  await expect(page.locator('#browserModelName')).toHaveText('In Chrome integriertes Modell');
  await expect(page.locator('#browserModelNotice')).toContainText('herunterladen');
  await expect(page.locator('#btnLoadModel')).toHaveText('Laden'); await page.locator('#btnLoadModel').click();
  await expect(page.locator('#browserModelState')).toHaveText('bereit in Chrome');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#browserModelBox').screenshot({ path: info.outputPath('chrome-model-de.png') });
});
