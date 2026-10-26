import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';
import { updatePermissions } from '../helpers/permission-policy.mjs';
import { legacyCookieData } from '../helpers/legacy-cookie-data.mjs';
import { PERMISSIONS } from '../../server/permissions.mjs';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server, legacy;
test.beforeAll(async () => {
  identity = tlsMaterial(); legacy = legacyCookieData(identity.dir);
  const script = process.env.KIBITZ_PERMISSION_SERVER_SCRIPT;
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert, operatorSecret: identity.secret,
    library: legacy.library, usage: legacy.usage, final: true, script, extra: script ? ['--operator', identity.operator, '--sessions', identity.dir + '/sessions.sqlite'] : [] });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });
async function signIn(page) {
  await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-logout]')).toBeVisible();
}

test('a signed-in browser cannot execute protected functions without explicit operator grants', async ({ page }) => {
  updatePermissions(identity, []); await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page);
  const codes = await page.evaluate(async () => {
    const requests = [['/api/ai/status', 'GET'], ['/api/ai/sample', 'POST'], ['/api/ai/test', 'POST'], ['/api/ai/embeddings', 'POST'], ['/api/library/records', 'GET']];
    return await Promise.all(requests.map(async ([url, method]) => {
      const response = await fetch(url, { method, ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'private', permissions: ['*'] }) } : {}) });
      const text = await response.text(); return { status: response.status, code: response.status === 403 ? JSON.parse(text).error?.code : undefined };
    }));
  });
  for (const result of codes) { expect(result.status).toBe(403); expect(result.code).toBe('permission_denied'); }
  await expect(page.locator('[data-operator-permissions]')).toContainText(/No server functions|keine Server-Funktionen/);
  await page.keyboard.press('Escape'); await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#coachOff')).toContainText(/disabled by the local operator|Betreiber deaktiviert/);
});

test('German mobile read-only library access lists grants and disables denied test/configuration/erase controls', async ({ page, context }) => {
  updatePermissions(identity, ['ai:read', 'library:read']);
  await context.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: 'kibitz_uid', value: legacy.uid, domain: 'kibitz.test', path: '/api/', secure: true, httpOnly: true, sameSite: 'Strict' },
    { name: 'kibitz_library', value: legacy.token, domain: 'kibitz.test', path: '/api/library/', secure: true, httpOnly: true, sameSite: 'Strict' }]);
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page);
  await expect(page.locator('[data-operator-permissions]')).toContainText('Server-Bibliothek lesen');
  await expect(page.locator('[data-operator-permissions]')).not.toContainText('Server-Bibliothek löschen');
  await expect(page.locator('#btnTestAi')).toBeDisabled(); await expect(page.locator('#optLocalOnly')).toBeDisabled();
  for (const button of await page.locator('#optProvider button').all()) await expect(button).toBeDisabled();
  await page.goto(server.base + '/data.html'); await expect(page.locator('[data-operator-logout]')).toBeVisible();
  await page.locator('#serverLoad').click(); await expect(page.locator('#serverStatus')).toContainText('1');
  await expect(page.locator('#serverErase')).toBeDisabled(); await expect(page.locator('#serverExport')).toBeEnabled();
  const result = await page.evaluate(async () => {
    const value = await (await fetch('/api/library/records')).json(); const response = await fetch('/api/library/erase', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: value.scope, revision: value.revision, confirm: true }) });
    return { code: response.status, before: value.games.length, after: (await (await fetch('/api/library/records')).json()).games.length };
  });
  expect(result).toEqual({ code: 403, before: 1, after: 1 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('changing the private policy updates functions for an existing session without browser grants or reauthentication', async ({ page }) => {
  updatePermissions(identity, [...PERMISSIONS]); await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page);
  await expect(page.locator('#btnTestAi')).toBeEnabled();
  updatePermissions(identity, ['ai:read']); await page.keyboard.press('Escape'); await openSettings(page);
  await expect(page.locator('#btnTestAi')).toBeDisabled(); await expect(page.locator('[data-operator-permissions]')).toHaveText(/Server status|Serverstatus/);
  expect(await page.evaluate(async () => (await fetch('/api/ai/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status)).toBe(403);
  updatePermissions(identity, [...PERMISSIONS]); await page.keyboard.press('Escape'); await openSettings(page);
  await expect(page.locator('#btnTestAi')).toBeEnabled();
  expect(await page.evaluate(async () => (await fetch('/api/ai/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status)).toBe(200);
});
