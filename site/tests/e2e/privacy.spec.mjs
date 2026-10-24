import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';
const consent = (page, provider = 'openai', purpose = 'coach') => page.locator(`[data-consent-provider="${provider}"][data-consent-purpose="${purpose}"]`);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function fakeCoach(page) {
  const state = { calls: [], held: null, provider: 'openai' }; let original = null;
  const status = () => ({ ...original, provider: state.provider, model: 'fake', models: { quick: 'fake', chat: 'fake', review: 'fake' }, available: true,
    providers: original.providers.map(p => ['openai', 'mistral'].includes(p.name) ? { ...p, available: true, model: 'fake' } : p) });
  await page.route('**/api/ai/status', async route => {
    const response = await route.fetch(); original = await response.json(); await route.fulfill({ json: status() });
  });
  await page.route('**/api/ai/config', async route => { state.provider = route.request().postDataJSON().provider || state.provider; await route.fulfill({ json: status() }); });
  await page.route('**/api/ai/test', async route => { state.calls.push(route.request().headers()['x-kibitz-consent']); await route.fulfill({ json: { ok: true, provider: state.provider, model: 'fake', ms: 1 } }); });
  await page.route('**/api/ai/sample', async route => {
    state.calls.push(route.request().headers()['x-kibitz-consent']); const held = state.held; if (held) await held.promise;
    await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ text: 'PRIVATE LATE ANSWER' }) + '\n' + JSON.stringify({ done: true }) + '\n' }).catch(() => {});
  }); return state;
}

test('network permission starts off; a saved coach grant allows only that provider/purpose and survives reload', async ({ page }) => {
  const api = await fakeCoach(page); await open(page); await openSettings(page);
  await expect(consent(page)).not.toBeChecked(); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toEqual([]);
  await consent(page).check(); await expect(page.locator('#privacyStatus')).toContainText('saved');
  await expect(consent(page, 'openai', 'embeddings')).not.toBeChecked(); await expect(consent(page, 'mistral')).not.toBeChecked();
  await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Connected'); expect(api.calls).toEqual(['v1:openai:coach']);
  await closeSettings(page); await page.reload(); await openSettings(page); await expect(consent(page)).toBeChecked();
  await consent(page).uncheck(); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(1);
});

test('switching to another provider updates the permission prompt without reusing the previous grant', async ({ page }) => {
  const api = await fakeCoach(page); await open(page); await openSettings(page); await consent(page).check();
  await page.locator('#optProvider [data-v="mistral"]').click(); await closeSettings(page); await expect(page.locator('#coachOff')).toContainText('Settings → Privacy');
  await openSettings(page); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(0);
  await consent(page, 'mistral').check(); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Connected'); expect(api.calls).toEqual(['v1:mistral:coach']);
});

test('quick browser routing becomes available while the configured cloud coach remains unconsented', async ({ page }) => {
  const api = await fakeCoach(page); await open(page); await expect(page.locator('#coachOff')).toBeVisible(); await expect(page.locator('#coachChips .chip').first()).toBeDisabled();
  await openSettings(page); await expect(page.locator('#optQuickInBrowser')).toBeVisible(); await page.locator('#optQuickInBrowser').check(); await closeSettings(page);
  await expect(page.locator('#coachOff')).toBeHidden(); await expect(page.locator('#coachChips .chip').first()).toBeEnabled(); await openSettings(page); await expect(consent(page)).not.toBeChecked();
  await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(0);
  await page.locator('#optQuickInBrowser').uncheck(); await closeSettings(page); await expect(page.locator('#coachOff')).toContainText('Settings → Privacy');
});

test('failed grants stay off and failed revocations deny immediately with a separate safe retry', async ({ page }) => {
  await page.addInitScript(() => { const set = Storage.prototype.setItem; window.__failConsent = true; Storage.prototype.setItem = function (k, v) { if (k === 'kibitz.providerConsent' && window.__failConsent) throw Error('quota'); return set.call(this, k, v); }; });
  const api = await fakeCoach(page); await open(page); await openSettings(page); await consent(page).click();
  await expect(consent(page)).not.toBeChecked(); await expect(page.locator('#privacyStatus')).toContainText('No new permission');
  await page.evaluate(() => { window.__failConsent = false; }); await consent(page).check(); await expect(consent(page)).toBeChecked();
  await page.evaluate(() => { window.__failConsent = true; }); await consent(page).uncheck(); await expect(page.locator('#privacyRetry')).toBeVisible();
  await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(0);
  await page.evaluate(() => { window.__failConsent = false; }); await page.locator('#privacyRetry').click(); await expect(page.locator('#privacyRetry')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.providerConsent')).grants)).toEqual([]);
});

test('revoking consent cancels a held coach answer and later tests stay blocked', async ({ page }) => {
  const api = await fakeCoach(page); await open(page); await page.locator('#modeAnalyse').click(); await openSettings(page); await consent(page).check(); await closeSettings(page);
  api.held = deferred(); await page.locator('#coachInput').fill('Explain general chess planning'); await page.locator('#coachSend').click(); await expect.poll(() => api.calls.length).toBe(1);
  await openSettings(page); await consent(page).uncheck(); api.held.resolve(); await closeSettings(page); await expect(page.locator('#coachSend')).toBeEnabled();
  await expect(page.locator('#chat')).not.toContainText('PRIVATE LATE ANSWER');
  await openSettings(page); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(1);
});

test('future consent data remains read-only and cannot enable sharing', async ({ page }) => {
  const raw = JSON.stringify({ version: 99, future: 'preserve' }); await page.addInitScript(raw => localStorage.setItem('kibitz.providerConsent', raw), raw);
  const api = await fakeCoach(page); await open(page); await openSettings(page); await expect(consent(page)).toBeDisabled(); await expect(page.locator('#privacyStatus')).toContainText('original data is preserved');
  await page.locator('#btnTestAi').click(); expect(api.calls).toHaveLength(0); expect(await page.evaluate(() => localStorage.getItem('kibitz.providerConsent'))).toBe(raw);
});

test('passage embeddings need their own provider grant and revocation blocks subsequent query transfer', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'consent-text', kind: 'study', title: 'Private passages', pgn: '{Private opening note} 1. e4 *' }])));
  const calls = [], d = { provider: 'mistral', model: 'vectors', revision: 'v1', fingerprint: 'consent-model', scope: 'consent-owner', inputVersion: 'title-text-v1', available: true, local: false, localOnly: false };
  await page.route('**/api/ai/embeddings', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: d });
    const body = route.request().postDataJSON(); calls.push({ body, header: route.request().headers()['x-kibitz-consent'] });
    return route.fulfill({ json: { vectors: body.texts.map(() => [1, 0]), metadata: { ...d, providerModel: 'vectors', dimensions: 2 } } });
  });
  await open(page); await page.locator('#modeAnalyse').click(); await page.locator('[data-tab="library"]').click(); await page.locator('#studySource').selectOption('library'); await page.locator('#studyMethod').selectOption('dense');
  await expect(page.locator('#studyDenseBuild')).toBeEnabled(); await page.locator('#studyDenseBuild').click(); await expect(page.locator('#studySearchStatus')).toContainText('Settings → Privacy'); expect(calls).toHaveLength(0);
  await openSettings(page); await consent(page, 'mistral', 'embeddings').check(); await expect(consent(page, 'mistral')).not.toBeChecked(); await closeSettings(page);
  await page.locator('#studyDenseBuild').click(); await expect(page.locator('#studyDenseMetadata')).toContainText('1 passages'); expect(calls).toHaveLength(1); expect(calls[0].header).toBe('v1:mistral:embeddings');
  await openSettings(page); await consent(page, 'mistral', 'embeddings').uncheck(); await closeSettings(page); await expect(page.locator('#studyDenseSearch')).toBeDisabled(); await page.locator('#studyDenseBuild').click();
  await expect(page.locator('#studySearchStatus')).toContainText('Settings → Privacy'); expect(calls).toHaveLength(1);
});

test('another tab revokes a saved grant and cancels an already held answer through native storage events', async ({ page }) => {
  const api = await fakeCoach(page); await open(page); await page.locator('#modeAnalyse').click(); await openSettings(page); await consent(page).check(); await closeSettings(page);
  api.held = deferred(); await page.locator('#coachInput').fill('Explain a general plan'); await page.locator('#coachSend').click(); await expect.poll(() => api.calls.length).toBe(1);
  const other = await page.context().newPage();
  try {
    await other.goto('/data.html'); await other.evaluate(() => { const data = JSON.parse(localStorage.getItem('kibitz.providerConsent')); data.revision++; data.grants = []; localStorage.setItem('kibitz.providerConsent', JSON.stringify(data)); });
    await openSettings(page); await expect(consent(page)).not.toBeChecked(); api.held.resolve(); await closeSettings(page); await expect(page.locator('#chat')).not.toContainText('PRIVATE LATE ANSWER');
    await openSettings(page); await page.locator('#btnTestAi').click(); await expect(page.locator('#testAiMsg')).toContainText('Settings → Privacy'); expect(api.calls).toHaveLength(1);
  } finally { await other.close(); api.held.resolve(); }
});

test('German phone privacy notice and controls translate and fit', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page); await openSettings(page);
  await page.locator('#providerPrivacy').scrollIntoViewIfNeeded(); await expect(page.locator('#providerPrivacy')).toContainText('Datenschutz und Anbieterfreigaben'); await consent(page).check(); await expect(page.locator('#privacyStatus')).toContainText('gespeichert');
  await page.locator('#providerPrivacy h3').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('privacy-phone.png') });
  await consent(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('privacy-controls-phone.png') }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
});
