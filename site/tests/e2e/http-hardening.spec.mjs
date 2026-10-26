// Real configured CLI (--env=, mock only). Synthetic Origins prove policy, not a browser exploit.
import { test, expect } from '@playwright/test';

test('the actual HTTP CLI rejects same-host foreign schemes on every AI write route despite forwarding headers', async ({ request, baseURL }) => {
  const base = new URL(baseURL).origin, host = new URL(base).host;
  for (const origin of [`https://${host}`, `ftp://${host}`, `blob:${base}/id`, 'null']) {
    for (const route of ['/api/ai/config', '/api/ai/test', '/api/ai/sample', '/api/ai/structured', '/api/ai/embeddings']) {
      const response = await request.post(route, { data: { prompt: 'hi' }, headers: {
        origin, 'x-forwarded-proto': 'https', forwarded: 'proto=https',
      } });
      expect(response.status(), `${origin} ${route}`).toBe(403);
      expect((await response.json()).error.code).toBe('forbidden');
      expect(response.headers()['access-control-allow-origin']).toBeUndefined();
    }
  }
});

test('normal browser POSTs and direct local clients still work; simple cross-origin forms remain refused', async ({ page, request }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/ai/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'hi' }) });
    return { status: response.status, body: await response.text() };
  });
  expect(result.status).toBe(200); expect(result.body).toContain('"done":true');
  const direct = await request.post('/api/ai/sample', { data: { prompt: 'hi' } });
  expect(direct.status()).toBe(200); expect(await direct.text()).toContain('"done":true');
  const simple = await request.post('/api/ai/sample', { headers: { origin: 'https://untrusted.invalid', 'content-type': 'text/plain' }, data: '{"prompt":"hi"}' });
  expect(simple.status()).toBe(403);
  const preflight = await request.fetch('/api/ai/sample', { method: 'OPTIONS', headers: { origin: 'https://untrusted.invalid', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
  // Identity protection checks every request's native origin before dispatch,
  // including OPTIONS; a foreign preflight must not reach route lookup.
  expect(preflight.status()).toBe(403); expect((await preflight.json()).error.code).toBe('forbidden');
  expect(preflight.headers()['access-control-allow-origin']).toBeUndefined(); expect(preflight.headers()['set-cookie']).toBeUndefined();
  const localOptions = await request.fetch('/api/ai/sample', { method: 'OPTIONS' });
  expect(localOptions.status()).toBe(404); expect(localOptions.headers()['access-control-allow-origin']).toBeUndefined();
  expect(localOptions.headers()['set-cookie']).toBeUndefined();
});

test('actual SVG GET and HEAD declare UTF-8 and the browser renders an SVG document', async ({ request, page }) => {
  for (const method of ['GET', 'HEAD']) {
    const response = await request.fetch('/icon.svg', { method });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/svg+xml; charset=utf-8');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    if (method === 'HEAD') expect(await response.body()).toHaveLength(0);
    else expect(await response.text()).toContain('<svg');
  }
  await page.goto('/icon.svg');
  expect(await page.evaluate(() => ({ type: document.contentType, encoding: document.characterSet, root: document.documentElement.localName })))
    .toEqual({ type: 'image/svg+xml', encoding: 'UTF-8', root: 'svg' });
});
