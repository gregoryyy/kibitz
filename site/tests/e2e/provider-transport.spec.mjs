import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { test, expect, open, openSettings } from './fixtures.mjs';
import { tlsMaterial } from '../helpers/tls-material.mjs';
import { httpsCli } from '../helpers/https-cli.mjs';
import { CONSENT_HEADER, providerConsentHeader } from '../../src/platform/privacy.js';

test.use({ ignoreHTTPSErrors: true, launchOptions: { args: ['--host-resolver-rules=MAP kibitz.test 127.0.0.1', '--no-proxy-server'] } });
let identity, server, trap, endpoint, calls = 0;
test.beforeAll(async () => {
  identity = tlsMaterial();
  trap = http.createServer((req, res) => { calls++; req.resume(); res.writeHead(500); res.end('Synthetic plaintext trap'); });
  await new Promise(resolve => trap.listen(0, '127.0.0.1', resolve)); endpoint = `http://127.0.0.1:${trap.address().port}/v1`;
  const script = process.env.KIBITZ_TRANSPORT_SERVER_SCRIPT;
  server = await httpsCli({ root: process.env.E2E_DIST || fileURLToPath(new URL('../../dist', import.meta.url)), key: identity.key, cert: identity.cert,
    operatorSecret: identity.secret, final: true, script, extra: script ? ['--operator', identity.operator, '--permissions', identity.policy, '--sessions', identity.dir + '/sessions.sqlite'] : [],
    env: { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'syntheticTransportKey', OPENAI_BASE_URL: endpoint, OPENAI_MODEL: 'fixture', AI_LOCAL_ONLY: '', EMBEDDING_PROVIDER: 'openai', EMBEDDING_MODEL: 'fixture' } });
});
test.afterAll(async () => {
  try { await server?.close(); if (trap) { trap.closeAllConnections(); await new Promise(resolve => trap.close(resolve)); } }
  finally { identity?.close(); }
});

for (const german of [false, true]) test(`native HTTPS refuses plaintext coaching/embedding endpoints before transfer${german ? ' in German' : ''}`, async ({ page }) => {
  if (german) await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page, server.base + '/?debug'); await openSettings(page);
  await page.locator('[data-operator-secret]').fill(identity.secret); await page.locator('[data-operator-submit]').click();
  await expect(page.locator('[data-operator-logout]')).toBeVisible();
  const result = await page.evaluate(async ({ consentHeader, consent }) => {
    const status = await fetch('/api/ai/status'), embeddings = await fetch('/api/ai/embeddings');
    const attempt = await fetch('/api/ai/test', { method: 'POST', headers: { 'content-type': 'application/json', [consentHeader]: consent }, body: '{}' });
    return { status: status.status, config: await status.json(), embeddings: await embeddings.json(), attempt: attempt.status, error: (await attempt.json()).error };
  }, { consentHeader: CONSENT_HEADER, consent: providerConsentHeader('openai', 'coach') });
  expect(result.status).toBe(200); expect(result.config.available).toBe(false); expect(result.config.reason).toContain('HTTPS');
  expect(result.embeddings.available).toBe(false); expect(result.attempt).toBe(503); expect(result.error.code).toBe('unavailable');
  expect(calls).toBe(0);
  if (german) expect(await page.evaluate(() => [...window.__kibitz.I18N_GAPS])).toEqual([]);
  for (const secret of ['syntheticTransportKey', endpoint]) expect(server.output() + await page.locator('body').innerText()).not.toContain(secret);
});
