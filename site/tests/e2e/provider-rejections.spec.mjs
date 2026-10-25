// Real browser + CLI + SDK; all provider responses are synthetic and intercepted in the child.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
const script = process.env.KIBITZ_REJECTION_SERVER || fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const preload = new URL('../fixtures/provider-rejections.mjs', import.meta.url).href;
const key = 'dummyMistralCredential0123456789abcd';
async function launch(kind) {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['--import', preload, script, 'dist', '--api', '--env=', '--index', '_test.html', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mistral', MISTRAL_API_KEY: key, MISTRAL_BASE_URL: 'https://fixture.invalid/v1', MISTRAL_MODEL: 'fixture-model',
      ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', OLLAMA_MODEL: '', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'mock', OPENAI_LOG: 'off', ANTHROPIC_LOG: 'off',
      // Match the normal E2E server's advertised browser model. It is never loaded/requested.
      BROWSER_RUNTIME: 'wllama', BROWSER_MODEL_URL: 'models/fake.gguf', BROWSER_MODEL_NAME: 'Fake model', BROWSER_MODEL_BYTES: '1000',
      AI_RATE_LIMIT_PER_MINUTE: '1000', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1000', KIBITZ_REJECTION_KIND: kind },
  });
  let output = ''; const exited = new Promise(resolve => child.once('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(Error('Rejection fixture startup timeout')); }, 20_000);
      child.stdout.on('data', chunk => { output += chunk; if (output.includes('Serving ')) { clearTimeout(timer); resolve(true); } });
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('exit', () => { clearTimeout(timer); reject(Error('Rejection fixture exited')); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
    });
  } catch (error) { child.kill(); await exited; throw error; }
  return { url: `http://127.0.0.1:${port}/?debug`, logs: () => output,
    stop: async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; } };
}
async function prepare(page, server) {
  await open(page, server.url); await page.locator('#modeAnalyse').click();
  await openSettings(page); await page.locator('[data-consent-provider="mistral"][data-consent-purpose="coach"]').check(); await closeSettings(page);
}
async function ask(page, question) {
  await page.locator('#coachInput').fill(question); await page.locator('#coachSend').click();
  const answer = page.locator('#chat .msg.coach').last(); await expect(answer).not.toHaveClass(/thinking/); return answer;
}

test('a reflected provider credential and private rejection prose never reach the page or CLI logs', async ({ page }) => {
  const server = await launch('generic');
  try {
    await prepare(page, server);
    const answer = await ask(page, 'Explain the main plan in this position.');
    await expect(answer).toHaveAttribute('data-error', 'provider_rejected');
    const visible = await page.locator('body').innerText();
    for (const marker of [key, 'PROMPT_PRIVATE', 'private.invalid', 'ACCOUNT_PRIVATE', 'FORGED_EVENT']) expect(visible + server.logs()).not.toContain(marker);
    await expect(answer).toContainText('Check the selected model and request settings.');
  } finally { await server.stop(); }
});

test('a fixed tool-support hint preserves context-only fallback and the model capability cache', async ({ page }) => {
  const server = await launch('tools'), bodies = [];
  page.on('request', request => { if (request.url().endsWith('/api/ai/sample')) bodies.push(request.postDataJSON()); });
  try {
    await prepare(page, server);
    await expect(await ask(page, 'Explain the main plan in this position.')).toContainText('A safe explanation');
    await expect(page.locator('.tool-notice')).toContainText('This model cannot call tools.');
    await expect(await ask(page, 'Explain another useful idea for this position.')).toContainText('A safe explanation');
    expect(bodies.map(body => !!body.tools)).toEqual([true, false, false]);
    expect((await page.locator('body').innerText()) + server.logs()).not.toContain(key);
    expect((await page.locator('body').innerText()) + server.logs()).not.toContain('PROMPT_PRIVATE');
  } finally { await server.stop(); }
});

test('German rejection hints translate while reflected private prose stays absent', async ({ page }) => {
  const server = await launch('generic');
  try {
    await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
    await prepare(page, server);
    const answer = await ask(page, 'Erkläre den wichtigsten Plan in dieser Stellung.');
    await expect(answer).toContainText('Prüfe das ausgewählte Modell und die Anfrageeinstellungen.');
    expect((await page.locator('body').innerText()) + server.logs()).not.toContain(key);
    expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  } finally { await server.stop(); }
});
