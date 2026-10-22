// The in-browser model (TODO 2.16): provider, consent and loading, routing, connection test.
// wllama.js is replaced by a fake runtime; the test server advertises a fake model (playwright.config.mjs).
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';

test.skip(process.env.KIBITZ_LIVE_MODEL === '1', 'the live run serves the real model');

const FAKE_WLLAMA = `
export class Wllama {
  constructor(paths, opts) { window.__fakeWllama = { paths, opts, loads: [], requests: [], exited: 0 }; }
  isSupportWebGPU() { return false; }
  async loadModelFromUrl(url, o) {
    window.__fakeWllama.loads.push({ url, n_threads: o.n_threads, n_ctx: o.n_ctx });
    o.progressCallback?.({ loaded: 1, total: 2 });
    await new Promise(r => setTimeout(r, 300));
    o.progressCallback?.({ loaded: 2, total: 2 });
  }
  async createChatCompletion(p) {
    window.__fakeWllama.requests.push(p.messages);
    const words = ['Fake ', 'browser ', 'coach: develop a piece.'];
    return (async function* () {
      for (const w of words) { await new Promise(r => setTimeout(r, 20)); yield { choices: [{ delta: { content: w } }] }; }
      yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
    })();
  }
  async exit() { window.__fakeWllama.exited++; }
}`;

// The provider choice lives on the test server: every test here starts and ends with the mock.
const resetProvider = request => request.post('/api/ai/config', { data: { localOnly: false, provider: 'mock' } });
test.beforeEach(({ request }) => resetProvider(request));
test.afterEach(({ request }) => resetProvider(request));

async function openWithFakeModel(page) {
  const gateway = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) gateway.push(r.url()); });
  await page.route('**/wllama.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_WLLAMA }));
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  return gateway;
}
const fake = page => page.evaluate(() => window.__fakeWllama || null);
async function ask(page, q) {
  await page.locator('#coachInput').fill(q);
  await page.locator('#coachSend').click();
  return page.locator('#chat .msg.coach').last();
}

test('"In browser" as the provider: asks for consent, loads with progress, answers in the page', async ({ page }) => {
  const gateway = await openWithFakeModel(page);
  await openSettings(page);
  await page.locator('#optProvider button[data-v="browser"]').click();
  await expect(page.locator('#optProvider button[data-v="browser"]')).toHaveAttribute('aria-pressed', 'true');
  await closeSettings(page);
  const box = page.locator('#browserModelBox');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Fake model (1.1 GB), in this browser');
  await expect(page.locator('#browserModelState')).toContainText('not loaded');

  // Before consent nothing loads: the coach says what to do.
  await expect(await ask(page, 'What now?')).toContainText('isn\'t loaded yet: press Load');
  expect(await fake(page)).toBeNull();

  await page.locator('#btnLoadModel').click();
  await expect(page.locator('#browserModelState')).toContainText('ready, on the CPU');
  const f = await fake(page);
  expect(f.loads).toHaveLength(1);
  expect(f.loads[0].url).toBe('models/fake.gguf');
  expect(f.loads[0].n_ctx).toBe(4096);
  expect(f.loads[0].n_threads).toBeGreaterThanOrEqual(1);
  expect(f.paths.default).toMatch(/\/wllama\.wasm$/);
  expect(f.opts.allowOffline).toBe(true);

  const answer = await ask(page, 'What now?');
  await expect(answer).toContainText('Fake browser coach: develop a piece.');
  const req = (await fake(page)).requests.at(-1);
  expect(req[0].role).toBe('user');
  expect(req[0].content).toContain('You are Kibitz');
  expect(req.at(-1).content).toContain('Question: What now?');
  expect(gateway).toHaveLength(0); // nothing went to the server

  await openSettings(page);
  await page.locator('#btnTestAi').click();
  await expect(page.locator('#testAiMsg')).toHaveText(/^Working: In browser, Fake model on the CPU, \d+ ms\.$/);
  await closeSettings(page);

  await page.locator('#btnUnloadModel').click();
  await expect(page.locator('#browserModelState')).toContainText('loads on the next question');
  expect((await fake(page)).exited).toBe(1);
  await expect(await ask(page, 'And now?')).toContainText('Fake browser coach'); // consent is remembered; it loads again
});

test('routing: quick questions go to the in-browser model, typed questions to the gateway', async ({ page }) => {
  const gateway = await openWithFakeModel(page);
  await openSettings(page);
  await expect(page.locator('#quickInBrowserRow')).toBeVisible();
  await page.locator('#optQuickInBrowser').check();
  await closeSettings(page);
  await page.locator('#btnLoadModel').click();
  await expect(page.locator('#browserModelState')).toContainText('ready');
  await page.locator('#coachChips .chip').first().click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Fake browser coach');
  expect(gateway).toHaveLength(0);
  await expect(await ask(page, 'Typed question')).toContainText('Mock coach');
  expect(gateway).toHaveLength(1);
  // The choice is saved.
  await page.reload();
  await openSettings(page);
  await expect(page.locator('#optQuickInBrowser')).toBeChecked();
});

test('local-only mode can use the in-browser model', async ({ page }) => {
  await openWithFakeModel(page);
  await openSettings(page);
  await page.locator('#optLocalOnly').check();
  for (const p of ['browser', 'mock']) await expect(page.locator(`#optProvider button[data-v="${p}"]`)).toBeEnabled();
  await page.locator('#optProvider button[data-v="browser"]').click();
  await expect(page.locator('#optProvider button[data-v="browser"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#optLocalOnly').uncheck();
});
