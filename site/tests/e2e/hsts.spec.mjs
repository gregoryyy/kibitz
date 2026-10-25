import { fileURLToPath } from 'node:url';
import { test, expect, open, move } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';

// Only generated test certificates bypass browser trust. A separate native client
// checks real HSTS caching/HTTP upgrades using the exact fixture CA without bypass.
test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server, base;
test.beforeAll(async () => {
  identity = tlsMaterial();
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert, operatorSecret: identity.secret,
    final: true, script: process.env.KIBITZ_HSTS_SERVER_SCRIPT });
  base = server.base.replace('127.0.0.1', 'kibitz.test');
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });

test('the final isolated hostname has one-year HSTS and supports the built board, engine, mock coach and private library', async ({ page }) => {
  const external = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const cookie = await server.login(); await page.context().addCookies([{ name: '__Host-kibitz_session', value: cookie.split('=')[1], url: base, secure: true, httpOnly: true, sameSite: 'Strict' }]);
  const initial = await page.goto(base); expect(initial.headers()['strict-transport-security']).toBe('max-age=31536000');
  await open(page, base + '/?debug');
  await move(page, 'e2', 'e4'); await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('[data-tab="coach"]').click(); await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('Explain the position'); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  const saved = await page.evaluate(async () => {
    const snapshot = await (await fetch('/api/library/records')).json(), record = { id: 'hsts-study', kind: 'study', pgn: '1. e4 e5 *' };
    const response = await fetch('/api/library/records', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: snapshot.scope, revision: snapshot.revision, changes: [{ collection: 'games', id: record.id, record }] }) });
    return { status: response.status, hsts: response.headers.get('strict-transport-security'), snapshot: await response.json() };
  });
  expect(saved.status).toBe(200); expect(saved.hsts).toBe('max-age=31536000'); expect(saved.snapshot.games[0].id).toBe('hsts-study');
  expect(external).toEqual([]);
});

test('browser API, static, HEAD and error responses retain HSTS regardless of spoofed forwarding headers', async ({ page }) => {
  const cookie = await server.login(); await page.context().addCookies([{ name: '__Host-kibitz_session', value: cookie.split('=')[1], url: base, secure: true, httpOnly: true, sameSite: 'Strict' }]);
  await page.goto(base + '/icon.svg');
  const results = await page.evaluate(async () => {
    const cases = [['/api/ai/status', 'GET', 200], ['/api/library/status', 'GET', 200], ['/', 'HEAD', 200], ['/missing', 'GET', 404],
      ['/%zz', 'GET', 400], ['/api/ai/status', 'DELETE', 404], ['/api/library/records', 'DELETE', 405]];
    return await Promise.all(cases.map(async ([route, method, expected]) => {
      const response = await fetch(route, { method, headers: { 'x-forwarded-proto': 'http', 'x-forwarded-host': 'localhost' } });
      return { route, expected, status: response.status, hsts: response.headers.get('strict-transport-security') };
    }));
  });
  for (const result of results) { expect(result.status, result.route).toBe(result.expected); expect(result.hsts, result.route).toBe('max-age=31536000'); }
});

test('an IP alias cannot open the app or create a cookie and does not receive a localhost-wide HSTS policy', async ({ page, context }) => {
  const response = await page.goto(base.replace('kibitz.test', '127.0.0.1'));
  expect(response.status()).toBe(403); expect(response.headers()['strict-transport-security']).toBeUndefined();
  expect(await context.cookies()).toEqual([]); await expect(page.locator('body')).toContainText('Host not allowed');
});
