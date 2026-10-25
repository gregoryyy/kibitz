import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli, tlsRequest } from '../helpers/https-cli.mjs';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server;
test.beforeAll(async () => {
  identity = tlsMaterial(); server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert, operatorSecret: identity.secret, final: true });
});
test.afterAll(async () => { try { await server?.close(); } finally { identity?.close(); } });
const cards = page => page.locator('#libList .game[data-collection="library"]');
async function signIn(page) {
  await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-status]')).toHaveText('Signed in to the local server.');
}
async function seed(page) {
  return page.evaluate(async () => {
    const previous = await (await fetch('/api/library/records')).json(), record = { id: 'boundary-private', title: 'Boundary private game', pgn: '[Event "Boundary private game"]\n\n1. e4 *' };
    return (await fetch('/api/library/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: previous.scope, revision: previous.revision, changes: [{ collection: 'games', id: record.id, record }] }) })).json();
  });
}
async function connect(page) {
  await page.locator('[data-tab="library"]').click(); await page.locator('#libUseServer').click(); await expect(cards(page)).toContainText('Boundary private game');
}
const cacheExists = page => page.evaluate(async () => (await indexedDB.databases()).some(value => value.name === 'kibitz-library'));

test('a gateway 401 clears an already loaded server library and cache without waiting for a library failure', async ({ page }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page); await closeSettings(page); const saved = await seed(page); await connect(page);
  await expect.poll(() => cacheExists(page)).toBe(true);
  await page.route('**/api/ai/status', route => route.fulfill({ status: 401, body: 'not JSON' })); await openSettings(page);
  await expect(cards(page)).toHaveCount(0); await expect(page.locator('[data-operator-status]')).toContainText('session ended'); await expect.poll(() => cacheExists(page)).toBe(false);
  expect(await page.evaluate(async () => (await (await fetch('/api/library/records')).json()).scope)).toBe(saved.scope); // only the synthetic client response refused; canonical data stays
});

test('offline sign-out invalidates another live tab and survives reload without silently adopting its still-valid cookie', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page); await closeSettings(page); const saved = await seed(page); await connect(page);
  const cookie = '__Host-kibitz_session=' + (await context.cookies(server.base)).find(value => value.name === '__Host-kibitz_session').value;
  const other = await context.newPage(); await open(other, server.base + '/?debug'); await expect(cards(other)).toContainText('Boundary private game');
  await page.route('**/api/session/logout', route => route.abort('internetdisconnected')); await openSettings(page); await page.locator('[data-operator-logout]').click();
  await expect(page.locator('[data-operator-status]')).toContainText('could not be confirmed'); await expect(cards(other)).toHaveCount(0);
  await openSettings(other); await expect(other.locator('[data-operator-secret]')).toBeVisible(); await expect(other.locator('[data-operator-status]')).toContainText('session ended');
  expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(200);
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await openSettings(page);
  await expect(page.locator('[data-operator-secret]')).toBeVisible(); await expect(page.locator('[data-operator-status]')).toContainText('session ended'); await expect(cards(page)).toHaveCount(0);
  await signIn(page); expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(401);
  expect(await page.evaluate(async () => (await (await fetch('/api/library/records')).json()).games)).toEqual(saved.games); await other.close();
});

test('the observed absolute deadline clears the library while the entire browser connection is offline', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page); await closeSettings(page); await seed(page); await connect(page);
  const status = await page.evaluate(async () => (await fetch('/api/session/status')).json()), expires = Date.now() + 5000;
  await page.route('**/api/session/status', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...status, expires }) }));
  const observed = page.waitForResponse(value => new URL(value.url()).pathname === '/api/session/status'); await openSettings(page); await (await observed).finished(); await closeSettings(page);
  await context.setOffline(true);
  try { await expect(cards(page)).toHaveCount(0, { timeout: 20_000 }); await expect.poll(() => cacheExists(page)).toBe(false); }
  finally { await context.setOffline(false); }
  await openSettings(page); await expect(page.locator('[data-operator-secret]')).toBeVisible(); await expect(page.locator('[data-operator-status]')).toContainText('session ended');
});

test('a data-page 401 clears its loaded controls and shared cache without exposing malformed response text', async ({ page }) => {
  await page.goto(server.base + '/data.html'); await signIn(page); await seed(page); await page.locator('#serverLoad').click(); await expect(page.locator('#serverExport')).toBeEnabled();
  await page.evaluate(async () => {
    const { createLibraryCache } = await import('/library/cache.js'), cache = createLibraryCache();
    await cache.write({ version: 1, scope: 'a'.repeat(64), revision: 1, games: [{ id: 'private', pgn: '1. e4 *' }], books: [] }); cache.close();
  });
  await page.route('**/api/library/records', route => route.fulfill({ status: 401, body: '<img src=x>not JSON' })); await page.locator('#serverLoad').click();
  await expect(page.locator('[data-operator-status]')).toContainText('session ended'); await expect(page.locator('#serverExport')).toBeDisabled(); await expect.poll(() => cacheExists(page)).toBe(false); expect(await page.locator('#operatorSignIn img').count()).toBe(0);
});

test('failed termination-marker storage blocks fresh activation and reports that failure separately from cache erasure', async ({ page }) => {
  await page.addInitScript(() => {
    window.__blockSessionMarker = true; const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'kibitz.sessionBoundary' && window.__blockSessionMarker) throw Error('blocked'); return set.call(this, key, value); };
  });
  const proofs = []; page.on('request', request => { if (new URL(request.url()).pathname === '/api/library/session') proofs.push(request); });
  await open(page, server.base + '/?debug'); await openSettings(page); await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-status]')).toContainText('could not record the ended session'); expect(proofs).toHaveLength(0); await expect.poll(() => cacheExists(page)).toBe(false);
  await page.evaluate(() => { window.__blockSessionMarker = false; }); await signIn(page); expect(proofs).toHaveLength(1);
});

test('explicit browser erasure preserves its live server session without recreating browser keys on the next visibility check', async ({ page }) => {
  await page.goto(server.base + '/data.html'); await signIn(page); await seed(page); await page.locator('#serverLoad').click(); await expect(page.locator('#serverExport')).toBeEnabled();
  await page.locator('#browserErase').click(); await page.locator('#eraseProceed').click(); await expect(page.locator('#browserStatus')).toContainText('has been erased');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('kibitz.')))).toEqual([]);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await expect(page.locator('#serverLoad')).toBeEnabled(); await page.locator('#serverLoad').click(); await expect(page.locator('#serverExport')).toBeEnabled();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('kibitz.')))).toEqual([]);
});

test('a retained local termination blocks cached browser-coach fallback when all session APIs are offline after reload', async ({ page }) => {
  await open(page, server.base + '/?debug'); await openSettings(page); await signIn(page);
  await page.evaluate(async () => {
    const { rememberOfflineCoach } = await import('/platform/offline-coach.js');
    rememberOfflineCoach(localStorage, { available: true, provider: 'browser', browser: { url: 'models/fake.gguf', name: 'Fake model', bytes: 1000 } });
  });
  await page.route('**/api/session/logout', route => route.abort('internetdisconnected')); await page.locator('[data-operator-logout]').click(); await expect(page.locator('[data-operator-status]')).toContainText('could not be confirmed');
  await page.route('**/api/**', route => route.abort('internetdisconnected')); await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await page.locator('[data-tab="coach"]').click(); await expect(page.locator('#coachOff')).toContainText('Sign in'); await expect(page.locator('#btnStudyPlan')).toBeDisabled(); // This action specifically requires an LLM; Ask also accepts local chess commands.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.offlineCoach')).model.name)).toBe('Fake model');
});

test('a held fresh-proof response cannot reactivate the UI after a later client termination', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page);
  let release, ready; const gate = new Promise(resolve => { release = resolve; }), issued = new Promise(resolve => { ready = resolve; });
  await page.route('**/api/library/session', async route => {
    const result = await tlsRequest(server.base + '/api/library/session', identity.ca, { cookie: route.request().headers().cookie || '', body: route.request().postDataJSON() });
    const value = result.headers['set-cookie'].find(cookie => cookie.startsWith('__Host-kibitz_session=')).match(/^__Host-kibitz_session=([^;]+)/)[1];
    await context.addCookies([{ name: '__Host-kibitz_session', value, url: server.base, secure: true, httpOnly: true, sameSite: 'Strict' }]);
    ready('__Host-kibitz_session=' + value); await gate;
    await route.fulfill({ status: result.status, contentType: 'application/json', body: result.text });
  });
  await page.evaluate(() => {
    window.__proofStatuses = []; const status = document.querySelector('[data-operator-status]');
    new MutationObserver(() => window.__proofStatuses.push(status.textContent)).observe(status, { childList: true, characterData: true, subtree: true });
  });
  await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click(); const cookie = await issued;
  const peer = await context.newPage(); await peer.goto(server.base + '/icon.svg');
  await peer.evaluate(async () => {
    const { createClientSession, openSessionChannel } = await import('/platform/client-session.js');
    const client = createClientSession({ storage: localStorage, channel: openSessionChannel() }); await client.end(); client.close();
  });
  release(); await expect(page.locator('[data-operator-status]')).toContainText('session ended'); await expect(page.locator('[data-operator-secret]')).toBeVisible();
  expect(await page.evaluate(() => window.__proofStatuses.some(value => value === 'Signed in to the local server.'))).toBe(false);
  expect((await tlsRequest(server.base + '/api/ai/status', identity.ca, { cookie })).status).toBe(200); // denial is the later local intent, not a coincidental backend 401
  await peer.close();
});

test('a held Web Lock times out local preparation before sending proof and recovers after the holder releases it', async ({ page, context }) => {
  await open(page, server.base + '/?debug'); await openSettings(page);
  const peer = await context.newPage(); await peer.goto(server.base + '/icon.svg');
  await peer.evaluate(() => {
    window.__sessionLockHeld = false;
    void navigator.locks.request('kibitz-session-boundary-v1', async () => { window.__sessionLockHeld = true; await new Promise(resolve => { window.__releaseSessionLock = resolve; }); });
  });
  await expect.poll(() => peer.evaluate(() => window.__sessionLockHeld)).toBe(true);
  const proofs = []; page.on('request', request => { if (new URL(request.url()).pathname === '/api/library/session') proofs.push(request); });
  try {
    await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
    await expect(page.locator('[data-operator-status]')).toContainText('Check browser storage and Web Locks', { timeout: 10_000 }); expect(proofs).toHaveLength(0);
  } finally { await peer.evaluate(() => window.__releaseSessionLock()); }
  await signIn(page); expect(proofs).toHaveLength(1); await peer.close();
});
