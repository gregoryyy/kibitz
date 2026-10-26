// Actual CLI and SDK with a synthetic provider policy; no request can reach a live API.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
const script = process.env.KIBITZ_LUNA_SERVER || fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const preload = new URL('../fixtures/luna-chat.mjs', import.meta.url).href;

async function launch() {
  const child = spawn(process.execPath, ['--import', preload, script, 'dist', '--api', '--http-dev', '--env=', '--index', '_test.html', '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'synthetic-luna-key',
      OPENAI_BASE_URL: 'https://luna-fixture.invalid/v1', OPENAI_MODEL: 'gpt-6-luna', EMBEDDING_PROVIDER: 'mock',
      BROWSER_RUNTIME: 'wllama', BROWSER_MODEL_URL: 'models/fake.gguf', BROWSER_MODEL_NAME: 'Fake model', BROWSER_MODEL_BYTES: '1000',
      AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000' },
  });
  const exited = new Promise(resolve => child.once('exit', resolve)); let output = '';
  const stop = async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; };
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Luna fixture startup timeout')), 20_000);
      child.stdout.on('data', chunk => { output += chunk; const match = output.match(/at (http:\/\/127\.0\.0\.1:\d+)\//); if (match) { clearTimeout(timer); resolve(match[1]); } });
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Luna fixture exited')); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    });
    return { base, stop, logs: () => output };
  } catch (error) { await stop(); throw error; }
}
async function prepare(page, server) {
  await open(page, server.base + '/?debug'); await page.locator('#modeAnalyse').click();
  await openSettings(page); await page.locator('[data-consent-provider="openai"][data-consent-purpose="coach"]').check(); await closeSettings(page);
}

test('Luna completes a real Stockfish tool round through CLI/SDK without losing capability to a rejection fallback', async ({ page }) => {
  const server = await launch(), bodies = [];
  try {
    await prepare(page, server);
    page.on('request', request => { if (request.url() === server.base + '/api/ai/sample') bodies.push(request.postDataJSON()); });
    await page.locator('#coachInput').fill('Use the engine to examine this position.'); await page.locator('#coachSend').click();
    const answer = page.locator('#chat .msg.coach').last();
    await expect(answer).toContainText('Stockfish returned an analysis.');
    await expect(answer.locator('.evidence summary')).toHaveText('Stockfish checked one thing for this answer');
    expect(bodies).toHaveLength(2); expect(bodies[0].tools).toContain('analyse');
    const result = bodies[1].messages.find(message => message.role === 'tool');
    expect(JSON.parse(result.content).lines.length).toBeGreaterThan(0);
    await expect(page.locator('.tool-notice')).toHaveCount(0);
    expect((await page.locator('body').innerText()) + server.logs()).not.toContain('synthetic-luna-key');
  } finally { await server.stop(); }
});

test('Luna connection check uses the supported mode for its small reply', async ({ page }) => {
  const server = await launch();
  try {
    await prepare(page, server); await openSettings(page); await page.locator('#btnTestAi').click();
    await expect(page.locator('#testAiMsg')).toContainText('Connected');
    expect(server.logs()).not.toContain('synthetic-luna-key');
  } finally { await server.stop(); }
});
