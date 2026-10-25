import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';
import { legacyCookieData } from '../helpers/legacy-cookie-data.mjs';

let identity, server, legacy;
test.beforeAll(async () => {
  identity = tlsMaterial(); legacy = legacyCookieData(identity.dir);
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert,
    library: legacy.library, usage: legacy.usage, script: process.env.KIBITZ_COOKIE_SERVER_SCRIPT });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });
const cookie = (name, value, path) => ({ name, value, domain: '127.0.0.1', path, secure: true, httpOnly: true, sameSite: 'Strict' });

test('authenticated browser migration retains private records/counters and replaces grouping cookies with one host-only session', async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true }); let restored;
  try {
    await context.addCookies([cookie('kibitz_uid', legacy.uid, '/api/'), cookie('kibitz_library', legacy.token, '/api/library/')]);
    const backup = await context.storageState(); // Synthetic pre-upgrade profile; no secret export is added to the app.
    expect((await context.request.get(server.base + '/api/ai/status')).status()).toBe(401);
    expect((await context.request.post(server.base + '/api/library/session', { data: { secret: identity.secret, migrate: true } })).status()).toBe(200);
    const status = await context.request.get(server.base + '/api/ai/status'); expect(status.status()).toBe(200);
    const before = await status.json(); expect(before.user.requests).toBe(1);
    const response = await context.request.get(server.base + '/api/library/records'); expect(response.status()).toBe(200);
    const snapshot = await response.json(); expect(snapshot.scope).toBe(legacy.scope); expect(snapshot.games).toEqual([legacy.record]); expect(snapshot.revision).toBe(1);
    const cookies = await context.cookies(); expect(cookies.map(value => value.name).sort()).toEqual(['__Host-kibitz_session', '__Secure-kibitz_library', '__Secure-kibitz_uid']);
    expect(cookies.find(value => value.name === '__Host-kibitz_session')).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(await context.cookies(server.base + '/')).toHaveLength(1);
    const record = { id: 'browser-after-upgrade', kind: 'study', pgn: '1. c4 e5 *' };
    expect((await context.request.post(server.base + '/api/library/records', { data: { scope: snapshot.scope, revision: 1,
      changes: [{ collection: 'games', id: record.id, record }] } })).status()).toBe(200);
    expect((await context.request.post(server.base + '/api/ai/test', { data: {} })).status()).toBe(200);
    restored = await browser.newContext({ ignoreHTTPSErrors: true, storageState: backup });
    expect((await restored.request.post(server.base + '/api/library/session', { data: { secret: identity.secret, migrate: true } })).status()).toBe(200);
    const recovered = await (await restored.request.get(server.base + '/api/library/records')).json();
    expect(recovered.scope).toBe(legacy.scope); expect(recovered.revision).toBe(2);
    expect(recovered.games.map(value => value.id).sort()).toEqual(['browser-after-upgrade', 'legacy-study']);
    expect((await (await restored.request.get(server.base + '/api/ai/status')).json()).user.requests).toBe(2);
    const outsider = await browser.newContext({ ignoreHTTPSErrors: true });
    try { expect((await outsider.request.get(server.base + '/api/library/records')).status()).toBe(401); }
    finally { await outsider.close(); }
  } finally { await context.close(); await restored?.close(); }
});

test('two protected cookies at different paths cannot silently select or replace a library owner', async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    await context.addCookies([cookie('__Secure-kibitz_library', legacy.token, '/api/library/'), cookie('__Secure-kibitz_library', 'z'.repeat(43), '/api/')]);
    const before = await context.cookies();
    const response = await context.request.post(server.base + '/api/library/session', { data: { secret: identity.secret, migrate: true } }); expect(response.status()).toBe(400);
    expect(response.headers()['set-cookie']).toBeUndefined(); expect(await context.cookies()).toEqual(before);
  } finally { await context.close(); }
});
