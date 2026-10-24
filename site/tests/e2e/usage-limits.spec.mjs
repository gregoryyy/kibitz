// Real CLI, private counters and mock-only inference; no fake usage responses.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { test, expect, open } from './fixtures.mjs';
const site = fileURLToPath(new URL('../..', import.meta.url));

test('a browser rate refusal and its usage survive a gateway restart while another browser retains its allowance', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-usage-ui-'));
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const url = `http://127.0.0.1:${port}/?debug`; let child, second;
  const stop = async () => { if (!child || child.exitCode !== null || child.signalCode !== null) return; const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done; };
  const start = async () => {
    child = spawn(process.execPath, ['scripts/serve.mjs', 'dist', '--api', '--env=', '--usage', path.join(dir, 'usage.sqlite'), '--index', '_test.html', '--port', String(port)], {
      cwd: site, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'mock', EMBEDDING_PROVIDER: 'mock', AI_LOCAL_ONLY: '',
        ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', MISTRAL_API_KEY: '', AI_RATE_LIMIT_PER_MINUTE: '10', AI_RATE_LIMIT_PER_USER_PER_MINUTE: '1', AI_TOKEN_BUDGET_PER_DAY: '0' },
    });
    await new Promise((resolve, reject) => {
      let output = '', errors = ''; const timer = setTimeout(() => { child.kill(); reject(Error('Usage fixture startup timeout')); }, 20_000);
      child.stdout.on('data', value => { output += value; if (output.includes('Serving')) { clearTimeout(timer); resolve(null); } });
      child.stderr.on('data', value => errors += value);
      child.once('exit', () => { clearTimeout(timer); reject(Error(errors)); }); child.once('error', reject);
    });
  };
  const ask = async (target, question) => { await target.locator('#coachInput').fill(question); await target.locator('#coachSend').click(); await expect(target.locator('#coachStop')).toBeHidden(); };
  try {
    await start(); await open(page, url);
    await ask(page, 'Why develop pieces?'); await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
    await expect(page.locator('#usageLine')).toContainText('You today: 1 answer');
    await stop(); await start(); await open(page, url);
    await expect(page.locator('#usageLine')).toContainText('You today: 1 answer');
    await ask(page, 'Why control the centre?'); await expect(page.locator('#chat .msg.coach').last()).toHaveAttribute('data-error', 'rate_limited');
    await expect(page.locator('#chat .msg.coach').last()).toContainText('Too many questions in a short time. Try again in a minute.');
    second = await browser.newContext(); const bob = await second.newPage(); await open(bob, url);
    await ask(bob, 'Why castle early?'); await expect(bob.locator('#chat .msg.coach').last()).toContainText('Mock coach');
    await expect(bob.locator('#usageLine')).toContainText('You today: 1 answer');
    const status = await page.request.get(url.replace('/?debug', '/api/ai/status')); expect((await status.json()).usage.requests).toBe(2);
    await page.goto(url.replace('/?debug', '/data.html')); await expect(page.locator('body')).toContainText('These export and erase controls leave those counters in place');
    await page.evaluate(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await page.reload();
    await expect(page.locator('body')).toContainText('Diese Export- und Löschfunktionen lassen die Zähler bestehen');
  } finally { await second?.close(); await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
