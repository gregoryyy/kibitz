// Live smoke test with the real in-browser model (TODO 2.16.6). Runs only with KIBITZ_LIVE_MODEL=1,
// after `just offline` has downloaded a model:
//   KIBITZ_LIVE_MODEL=1 [BROWSER_MODEL=qwen2.5-0.5b] npx playwright test offline-live
import { test, expect, open } from './fixtures.mjs';

test.skip(process.env.KIBITZ_LIVE_MODEL !== '1', 'set KIBITZ_LIVE_MODEL=1 (and download a model with just offline)');

test('the real model loads in the page and answers a question', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const outside = [];
  // http(s) requests to other hosts; blob: URLs are the runtime's own workers. Google Fonts is allowed
  // here (this server isn't --offline); serve.test.mjs checks that offline mode drops it.
  page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname) && !/(^|\.)(gstatic|googleapis)\.com$/.test(u.hostname)) outside.push(r.url()); });
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachSettings summary').click();
  await page.locator('#optProvider button[data-v="browser"]').click();
  await page.locator('#btnLoadModel').click();
  await expect(page.locator('#browserModelState')).toContainText('ready', { timeout: 8 * 60_000 });
  await page.locator('#coachInput').fill('Name one principle for the opening, in one sentence.');
  await page.locator('#coachSend').click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(page.locator('#coachStop')).toBeHidden({ timeout: 5 * 60_000 }); // the whole answer is in
  await expect(answer).not.toContainText(/couldn't|failed|didn't load/i);
  expect((await answer.innerText()).length).toBeGreaterThan(20);
  console.log('Answer:', (await answer.innerText()).replace(/\s+/g, ' ').slice(0, 300));
  console.log('Runtime:', await page.locator('#browserModelState').innerText());
  expect(outside).toEqual([]); // the weights and the runtime come from this server
});
