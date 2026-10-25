import { fileURLToPath } from 'node:url';
import { test, expect, open, move } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';

// Browser-only trust exception for the generated test identity; native-client tests
// independently require its exact CA and reject bad chain/hostname/protocol inputs.
test.use({ ignoreHTTPSErrors: true });
let identity, server;
test.beforeAll(async () => {
  identity = tlsMaterial();
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert, operatorSecret: identity.secret });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });

test('native HTTPS serves the real board, engine, mock coach and private library with Secure cookies and unchanged CSP', async ({ page, context }) => {
  const external = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== server.base) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  const login = await page.request.post(server.base + '/api/library/session', { data: { secret: identity.secret, migrate: true } }); expect(login.status()).toBe(200);
  await open(page, server.base + '/?debug');
  expect(await page.evaluate(() => isSecureContext)).toBe(true);
  await move(page, 'e2', 'e4'); await expect(page.locator('#moves button')).toHaveCount(2);
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('Explain the position'); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  const saved = await page.evaluate(async () => {
    const snapshot = await (await fetch('/api/library/records')).json();
    const record = { id: 'tls-study', kind: 'study', pgn: '1. e4 e5 *' };
    const response = await fetch('/api/library/records', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: snapshot.scope, revision: snapshot.revision, changes: [{ collection: 'games', id: record.id, record }] }) });
    return { status: response.status, snapshot: await response.json() };
  });
  expect(saved.status).toBe(200); expect(saved.snapshot.games[0].id).toBe('tls-study');
  const cookies = await context.cookies(server.base + '/api/library/records');
  for (const name of ['__Host-kibitz_session']) expect(cookies.find(cookie => cookie.name === name)).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Strict' });
  expect((await page.request.get(server.base + '/')).headers()['content-security-policy']).toContain("style-src-attr 'none'");
  for (const file of ['/key.pem', '/cert.pem']) expect((await page.request.get(server.base + file)).status()).toBe(404);
  expect(external).toEqual([]); expect(server.output()).not.toContain(identity.dir);
});
