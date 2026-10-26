import { test, expect } from '@playwright/test';
import { cookieServers } from '../helpers/cookie-servers.mjs';

let servers;
test.beforeAll(async () => { servers = await cookieServers(); });
test.afterAll(async () => { await servers?.close(); });

for (const secure of [true, false]) test(`${secure ? 'HTTPS' : 'HTTP'} issuance stores separate HttpOnly cookies with the actual transport's Secure flag`, async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: secure,
    extraHTTPHeaders: { 'x-forwarded-proto': secure ? 'http' : 'https', forwarded: `proto=${secure ? 'http' : 'https'}` } });
  try {
    const base = servers[secure ? 'https' : 'http'], page = await context.newPage(); await page.goto(base);
    const sample = await page.evaluate(async () => {
      const response = await fetch('/api/ai/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: 'hi' }) });
      return { status: response.status, body: await response.text() };
    });
    expect(sample.status).toBe(200); expect(sample.body).toContain('"done":true');
    const codes = await page.evaluate(async () => {
      const codes = [];
      for (const route of ['/api/ai/status', '/api/library/records']) { const res = await fetch(route); await res.json(); codes.push(res.status); }
      return codes;
    });
    expect(codes).toEqual([200, 200]);
    const nameOf = suffix => secure ? '__Secure-kibitz_' + suffix : 'kibitz_dev_' + suffix;
    const cookies = await context.cookies(base + '/api/library/records'), usage = cookies.find(cookie => cookie.name === nameOf('uid')), library = cookies.find(cookie => cookie.name === nameOf('library'));
    expect(usage).toMatchObject({ secure, httpOnly: true, sameSite: 'Strict', path: '/api/' });
    expect(library).toMatchObject({ secure, httpOnly: true, sameSite: 'Strict', path: '/api/library/' });
    expect(usage.value).toMatch(/^[A-Za-z0-9_-]{22}$/); expect(library.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(usage.value).not.toBe(library.value);
  } finally { await context.close(); }
});
