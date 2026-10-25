import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../helpers/https-cli.mjs';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server;
test.beforeAll(async () => {
  identity = tlsMaterial();
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert,
    operatorSecret: identity.secret, final: true, script: process.env.KIBITZ_TERMINATION_SERVER_SCRIPT,
    extra: process.env.KIBITZ_TERMINATION_SERVER_SCRIPT ? ['--operator', identity.operator, '--sessions', identity.dir + '/sessions.sqlite'] : [] });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });
async function signIn(page) {
  await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-logout]')).toBeVisible();
}
const copied = async context => '__Host-kibitz_session=' + (await context.cookies(server.base)).find(value => value.name === '__Host-kibitz_session').value;

test('Settings logout rejects copied sessions in every tab and keeps the collection for fresh-proof recovery', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page);
  const cookie = await copied(context);
  const before = await page.evaluate(async () => {
    const previous = await (await fetch('/api/library/records')).json(), record = { id: 'logout-book', title: 'Keep this private reference', tags: [] };
    return await (await fetch('/api/library/records', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: previous.scope, revision: previous.revision, changes: [{ collection: 'books', id: record.id, record }] }) })).json();
  });
  const other = await context.newPage(); await other.goto(server.base + '/icon.svg');
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/session/logout');
  await page.locator('[data-operator-logout]').click(); expect((await response).status()).toBe(200);
  await expect(page.locator('[data-operator-status]')).toContainText(/Signed out|abgemeldet/);
  expect((await context.cookies(server.base)).find(value => value.name === '__Host-kibitz_session')).toBeUndefined();
  expect((await context.cookies(server.base + '/api/library/records')).map(value => value.name).sort()).toEqual(['__Secure-kibitz_library', '__Secure-kibitz_uid']);
  expect(await other.evaluate(async () => (await fetch('/api/library/records')).status)).toBe(401); await other.close();
  expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(401);
  await signIn(page);
  const recovered = await page.evaluate(async () => (await fetch('/api/library/records')).json()); expect(recovered).toEqual(before);
  expect((await tlsRequest(server.base + '/api/library/records', identity.ca, { cookie })).status).toBe(401);
});

test('German mobile data controls confirm backend logout and permit a new sign-in', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(server.base + '/data.html'); await signIn(page); const cookie = await copied(context);
  await expect(page.locator('[data-operator-logout]')).toHaveText('Abmelden'); await page.locator('#serverLoad').click();
  await page.locator('[data-operator-logout]').click(); await expect(page.locator('[data-operator-status]')).toHaveText('Vom lokalen Server abgemeldet.');
  await expect(page.locator('#serverExport')).toBeDisabled(); expect((await tlsRequest(server.base + '/api/library/records', identity.ca, { cookie })).status).toBe(401);
  await signIn(page); await page.locator('#serverLoad').click(); await expect(page.locator('#serverStatus')).toContainText('Gespeicherte Partien');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed logout is not reported as completion; retry requires actual backend termination', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page); const cookie = await copied(context);
  await page.route('**/api/session/logout', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unavailable' } }) }));
  await page.locator('[data-operator-logout]').click(); await expect(page.locator('[data-operator-status]')).toContainText(/could not|nicht bestätigt/);
  await expect(page.locator('[data-operator-logout]')).toBeVisible(); expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(200);
  await page.unroute('**/api/session/logout'); await page.locator('[data-operator-logout]').click();
  await expect(page.locator('[data-operator-status]')).toContainText(/Signed out|abgemeldet/); expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(401);
});
