// Real runtime stdout/stderr, with synthetic personal data and no live provider requests.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
const markers = ['PATH_PRIVATE', 'QUERY_PRIVATE', 'PROMPT_PRIVATE', 'COOKIE_PRIVATE', 'sk-synthetic-secret', 'MODEL_PRIVATE', 'FORGED_EVENT'];
async function launch(root) {
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [script, root, '--api', '--env=', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-synthetic-secret', OPENAI_MODEL: 'MODEL_PRIVATE\nFORGED_EVENT', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'mock' },
  });
  let output = '', errors = '';
  const exited = new Promise(resolve => child.once('exit', resolve));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('Logging fixture startup timeout')); }, 15_000);
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('Serving ')) { clearTimeout(timer); resolve(true); } });
    child.stderr.on('data', chunk => { errors += chunk; });
    child.once('exit', () => { clearTimeout(timer); resolve(false); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { started: await ready, base: `http://127.0.0.1:${port}`, output: () => output, errors: () => errors, stop: async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; } };
}

test('HTTP paths, queries, controls, cookies and prompt text stay out of default runtime logs', async ({ page }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-logs-PATH_PRIVATE-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<title>Private logs fixture</title><p>ready</p>');
  const server = await launch(dir);
  try {
    expect(server.started).toBe(true);
    await page.goto(server.base); await expect(page.locator('p')).toHaveText('ready');
    const headers = { cookie: 'kibitz_uid=abcdefghijklmnopqrstuv; personal=COOKIE_PRIVATE', 'content-type': 'application/json' };
    const paths = ['/PATH_PRIVATE%0a%1b%5b31mFORGED_EVENT?note=QUERY_PRIVATE&key=sk-synthetic-secret', '/api/library/PATH_PRIVATE?note=QUERY_PRIVATE', '/models/PATH_PRIVATE?note=QUERY_PRIVATE', '/%zz?note=QUERY_PRIVATE'];
    for (const url of paths) { const response = await fetch(server.base + url, { headers }); await response.text(); }
    for (const marker of markers) expect(server.output() + server.errors()).not.toContain(marker);
    const malformed = await new Promise((resolve, reject) => {
      const req = http.request(server.base, { path: 'http://[PATH_PRIVATE', headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject); req.end();
    });
    expect(malformed).toBe(400);
    // Invalid prompt is refused before a provider is called; no paid consent is supplied.
    const response = await fetch(server.base + '/api/ai/sample?note=QUERY_PRIVATE', { method: 'POST', headers, body: JSON.stringify({ prompt: 'PROMPT_PRIVATE' }) });
    expect(response.status).toBe(403); await response.text();
    await expect.poll(() => server.output().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)).some(event => event.event === 'http' && event.route === 'ai.sample')).toBe(true);
    for (const marker of markers) expect(server.output() + server.errors()).not.toContain(marker);
    const events = server.output().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    const requests = events.filter(event => event.event === 'http');
    expect(requests.map(event => event.route)).toEqual(expect.arrayContaining(['static', 'library', 'model', 'ai.sample']));
    expect(requests.every(event => Number.isInteger(event.ms) && event.ms >= 0 && event.complete)).toBe(true);
    expect(requests.some(event => event.status === 400)).toBe(true); expect(requests.some(event => event.status === 403)).toBe(true);
    expect(events.find(event => event.event === 'ai_config')).toMatchObject({ provider: 'openai', available: true });
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('startup failures retain an error category without reflecting filesystem paths', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-log-failure-'));
  const server = await launch(path.join(dir, 'PATH_PRIVATE'));
  try {
    expect(server.started).toBe(false);
    for (const marker of markers) expect(server.output() + server.errors()).not.toContain(marker);
    const event = server.errors().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line)).find(event => event.event === 'server_error');
    expect(event).toMatchObject({ event: 'server_error', code: 'ENOENT' });
    expect(event.hint).toContain('directory existence');
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
