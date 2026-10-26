import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, open, move } from './fixtures.mjs';

test('the default loopback HTTP app supports play, mock coaching and the private library', async ({ page, context }) => {
  await open(page);
  const base = new URL(page.url()).origin;
  expect(new URL(base).protocol).toBe('http:');
  expect(new URL(base).hostname).toBe('127.0.0.1');
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('Explain the position');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  const saved = await page.evaluate(async () => {
    const snapshot = await (await fetch('/api/library/records')).json();
    const record = { id: 'local-http-study', kind: 'study', pgn: '1. e4 e5 *' };
    const response = await fetch('/api/library/records', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: snapshot.scope, revision: snapshot.revision, changes: [{ collection: 'games', id: record.id, record }] }),
    });
    return { status: response.status, snapshot: await response.json() };
  });
  expect(saved.status).toBe(200);
  expect(saved.snapshot.games.some(record => record.id === 'local-http-study')).toBe(true);
  const cookies = await context.cookies(base + '/api/library/records');
  for (const name of ['kibitz_uid', 'kibitz_library']) {
    expect(cookies.find(cookie => cookie.name === name)).toMatchObject({ secure: false, httpOnly: true, sameSite: 'Strict' });
  }
  expect((await page.request.get(base + '/')).headers()['content-security-policy']).toContain("style-src-attr 'none'");
});

test('the CLI rejects removed native TLS options before opening storage and keeps diagnostics private', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-http-cli-'));
  const script = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));
  const root = path.resolve(process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)));
  const key = path.join(dir, 'PRIVATE_TLS_KEY_MARKER.pem'), cert = path.join(dir, 'PRIVATE_TLS_CERT_MARKER.pem');
  const library = path.join(dir, 'private', 'library.sqlite');
  try {
    for (const flags of [['--tls-key', key], ['--tls-cert', cert], ['--tls-key', key, '--tls-cert', cert]]) {
      const result = await new Promise(resolve => execFile(process.execPath,
        [script, root, '--api', '--env=', '--library', library, '--port', '0', ...flags],
        { timeout: 20_000, maxBuffer: 64 * 1024, env: { ...process.env, AI_PROVIDER: 'mock' } },
        (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
      expect(result.code).toBe(1);
      expect(result.stdout).not.toContain('Serving');
      expect(result.stderr).not.toContain(dir);
      expect(result.stderr).not.toContain('PRIVATE_TLS_');
      const events = result.stderr.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ event: 'server_error', code: 'ERR_PARSE_ARGS_UNKNOWN_OPTION' });
      expect(fs.existsSync(path.dirname(library))).toBe(false);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
