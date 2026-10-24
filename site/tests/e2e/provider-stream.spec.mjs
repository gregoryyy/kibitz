import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
const script = process.env.KIBITZ_STREAM_SERVER || fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const preload = new URL('../fixtures/provider-stream.mjs', import.meta.url).href;
const key = 'dummyMistralCredential0123456789abcd';
async function launch(kind) {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['--import', preload, script, 'dist', '--api', '--env=', '--index', '_test.html', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mistral', MISTRAL_API_KEY: key, MISTRAL_BASE_URL: 'https://fixture.invalid/v1', MISTRAL_MODEL: 'fixture-model',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', OLLAMA_MODEL: '', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'mock', OPENAI_LOG: 'debug', ANTHROPIC_LOG: 'debug',
      AI_TIMEOUT_MS: kind.endsWith('hang') ? '350' : '5000', AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000', KIBITZ_STREAM_KIND: kind,
      BROWSER_RUNTIME: 'wllama', BROWSER_MODEL_URL: 'models/fake.gguf', BROWSER_MODEL_NAME: 'Fake model', BROWSER_MODEL_BYTES: '1000' },
  });
  let output = ''; const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(Error('Stream fixture startup timeout')); }, 20_000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('Serving ')) { clearTimeout(timer); resolve(true); } });
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Stream fixture exited')); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    });
  } catch (error) { child.kill(); await exited; throw error; }
  return { base: `http://127.0.0.1:${port}`, logs: () => output,
    stop: async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; } };
}

for (const kind of ['headers-hang', 'body-hang', 'oversize', 'error-oversize', 'tool-oversize', 'text-oversize', 'body-hang-de', 'connection-test-de']) test(`provider stream ${kind}: ends with a bounded private error and no successful usage`, async ({ page }) => {
  const german = kind.endsWith('-de'), connection = kind === 'connection-test-de';
  const scenario = connection ? 'body-hang' : german ? kind.slice(0, -3) : kind, server = await launch(scenario);
  try {
    if (german) await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
    await open(page, server.base + '/?debug'); await page.locator('#modeAnalyse').click();
    await openSettings(page); await page.locator('[data-consent-provider="mistral"][data-consent-purpose="coach"]').check();
    if (connection) await page.locator('#btnTestAi').click();
    else { await closeSettings(page); await page.locator('#coachInput').fill('Explain a useful plan in this position.'); await page.locator('#coachSend').click(); }
    const answer = connection ? page.locator('#testAiMsg') : page.locator('#chat .msg.coach').last(), code = scenario.includes('hang') ? 'timeout' : 'response_too_large';
    if (!connection) await expect(answer).toHaveAttribute('data-error', code, { timeout: 3000 });
    await expect(page.locator('#coachStop')).toBeHidden();
    await expect(answer).toContainText(german ? 'Der KI-Anbieter hat nicht rechtzeitig geantwortet' : code === 'timeout' ? 'The AI provider timed out.' : 'The AI provider returned too much data.', { timeout: 3000 });
    const events = () => server.logs().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    await expect.poll(() => events().some(e => e.event === 'ai_error' && e.code === code)).toBe(true);
    expect(events().filter(e => e.fixture === 'provider-stream' && e.event === 'request')).toHaveLength(1);
    const status = await page.request.get(server.base + '/api/ai/status'); expect((await status.json()).usage.requests).toBe(0);
    for (const marker of [key, 'fixture.invalid', 'x'.repeat(100)]) expect((await page.locator('body').innerText()) + server.logs()).not.toContain(marker);
    if (german) expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  } finally { await server.stop(); }
});
