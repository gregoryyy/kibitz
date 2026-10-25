import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server;
test.beforeAll(async () => {
  identity = tlsMaterial();
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert,
    final: true, script: process.env.KIBITZ_SESSION_SERVER_SCRIPT });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });

async function signIn(page, secret = identity.secret) {
  await page.locator('[data-operator-secret]').fill(secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-secret]')).toHaveValue('');
}

test('the operator form unlocks the real mock gateway without persisting or exposing the proof', async ({ page, context }) => {
  await page.goto(server.base + '/icon.svg');
  expect(await page.evaluate(async () => (await fetch('/api/ai/status')).status)).toBe(401);
  await open(page, server.base + '/?debug'); await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachOff')).toBeVisible(); await expect(page.locator('#coachOff')).toContainText(/Sign in|Melde dich/);
  await openSettings(page); await expect(page.locator('#operatorSignIn')).toBeVisible();
  await signIn(page, 'x'.repeat(43)); await expect(page.locator('[data-operator-status]')).toContainText(/could not|nicht bestätigt/);
  expect(await page.evaluate(async () => (await fetch('/api/library/records')).status)).toBe(401);
  await signIn(page); await expect(page.locator('[data-operator-status]')).toContainText(/Signed in|angemeldet/);
  const snapshot = await page.evaluate(() => ({ cookies: document.cookie, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage), html: document.body.innerHTML, url: location.href }));
  for (const value of Object.values(snapshot)) expect(value).not.toContain(identity.secret);
  expect(snapshot.cookies).not.toContain('__Host-kibitz_session');
  const cookies = await context.cookies(server.base); expect(cookies.map(value => value.name)).toEqual(['__Host-kibitz_session']);
  const locators = await context.cookies(server.base + '/api/library/records');
  expect(locators.map(value => value.name).sort()).toEqual(['__Host-kibitz_session', '__Secure-kibitz_library', '__Secure-kibitz_uid']);
  expect(cookies[0]).toMatchObject({ httpOnly: true, secure: true, path: '/', sameSite: 'Strict' });
  await closeSettings(page); await expect(page.locator('#coachSend')).toBeEnabled();
  await page.locator('#coachInput').fill('Explain the position'); await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  expect(await page.evaluate(async () => (await fetch('/api/library/records')).status)).toBe(200);
  expect(server.output()).not.toContain(identity.secret);
});

test('German mobile sign-in and the data page share the backend-issued session', async ({ page, context }) => {
  await context.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(server.base + '/data.html'); await expect(page.locator('#operatorSignIn')).toBeVisible();
  await expect(page.locator('#operatorSignIn h3')).toHaveText('Am lokalen Server anmelden');
  await signIn(page); await expect(page.locator('[data-operator-status]')).toHaveText('Am lokalen Server angemeldet.');
  await page.locator('#serverLoad').click(); await expect(page.locator('#serverStatus')).toContainText('Gespeicherte Partien');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await open(page, server.base + '/?debug'); await openSettings(page);
  await expect(page.locator('#operatorSignIn form')).toBeHidden();
  await expect(page.locator('[data-operator-status]')).toHaveText('Am lokalen Server angemeldet.');
});

test('a pending sign-in keeps its path when settings trigger another probe and clears the key on page departure', async ({ page }) => {
  await open(page, server.base + '/?debug'); await openSettings(page);
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/library/session', async route => { await gate; await route.continue(); });
  await signIn(page); await expect(page.locator('[data-operator-submit]')).toBeDisabled();
  await closeSettings(page); await openSettings(page); release();
  await expect(page.locator('[data-operator-status]')).toContainText(/Signed in|angemeldet/);
  await expect(page.locator('[data-operator-submit]')).toBeEnabled();
  await page.evaluate(() => { const input = document.querySelector('[data-operator-secret]'); input.value = 'private-departure-marker'; dispatchEvent(new PageTransitionEvent('pagehide')); });
  await expect(page.locator('[data-operator-secret]')).toHaveValue('');
});

test('oversized untrusted status streams are cancelled instead of entering the operator panel', async ({ page }) => {
  await page.route('**/api/session/status', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ required: true, authenticated: false, marker: '<img src=x onerror=alert(1)>' + 'x'.repeat(9000) }) }));
  await open(page, server.base + '/?debug'); await openSettings(page);
  await expect(page.locator('#operatorSignIn')).toBeHidden(); expect(await page.locator('#operatorSignIn img').count()).toBe(0);
});
