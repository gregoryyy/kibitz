import { test, expect } from '@playwright/test';
test('search, typed filters, object source, graph walking, history and deep links', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const remote = []; page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:8787/')) remote.push(req.url()); });
  await page.addInitScript(() => { globalThis.assureViolations = []; document.addEventListener('securitypolicyviolation', e => globalThis.assureViolations.push(e.violatedDirective)); });
  await page.goto('/'); await expect(page.locator('#status')).toContainText('offline snapshots');
  await page.selectOption('#level', '2'); await page.selectOption('#type', 'object'); await page.fill('#search', 'utils/assure.mjs markdownReferences');
  const result = page.locator('#results button').filter({ hasText: 'program%3AmarkdownReferences%3Afunction:0' }); await expect(result).toHaveCount(1); await result.click();
  await expect(page.locator('#selected-name')).toHaveText('markdownReferences'); await expect(page.locator('#graph canvas').first()).toBeVisible();
  await page.click('#source'); await expect(page.locator('#source-text')).toContainText('function markdownReferences(text)');
  const url = page.url(); await page.reload(); await expect(page.locator('#selected-name')).toHaveText('markdownReferences'); expect(page.url()).toBe(url);
  await page.selectOption('#level', ''); await page.selectOption('#type', ''); await page.fill('#search', 'pr:136');
  await page.locator('#results button').filter({ hasText: 'pull_request · pr:136' }).click();
  await expect(page.locator('#selected-name')).toContainText('#136'); await page.selectOption('#relation', 'has_description'); await page.selectOption('#direction', 'out');
  await page.locator('#neighbors button').filter({ hasText: 'What and why' }).first().click();
  await expect(page.locator('#selected-name')).toHaveText('What and why'); await page.click('#source'); await expect(page.locator('#source-text')).toContainText('TODO 0.15');
  await page.click('#back'); await expect(page.locator('#selected-name')).toContainText('#136');
  expect(errors).toEqual([]); expect(remote).toEqual([]); expect(await page.evaluate(() => globalThis.assureViolations)).toEqual([]);
});
test('documentation navigation, explicit truncation and source endpoint confinement', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('#status')).toContainText('offline snapshots');
  await page.selectOption('#level', '3'); await page.selectOption('#type', 'section'); await page.fill('#search', 'docs/assure/LEVELS.md Level 2');
  await page.locator('#results button').first().click(); await expect(page.locator('#selected-name')).toContainText('Level 2');
  await page.click('#source'); await expect(page.locator('#source-text')).toContainText('ESLint');
  await page.selectOption('#level', ''); await page.selectOption('#type', ''); await page.fill('#search', 'file:docs/DONE.md');
  await page.locator('#results button').filter({ hasText: 'artifact · file:docs/DONE.md' }).click(); await page.selectOption('#depth', '3');
  await expect(page.locator('#walk-count')).toContainText('70-node limit');
  for (const path of ['/source?id=file:.env', '/source?id=../../.env', '/.env', '/docs/TODO.md', '/vendor/../../.env']) expect((await request.get(path)).status()).toBe(404);
  const response = await request.get('/'); expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect((await request.post('/data')).status()).toBe(403);
  expect((await request.get('/data', { headers: { Host: 'attacker.example' } })).status()).toBe(403);
});
test('untrusted graph labels and source content remain text', async ({ page }) => {
  await page.route('**/data', async route => {
    const response = await route.fetch(), data = await response.json();
    const node = data.layers[0].nodes.find(n => n.id === 'todo:0.16'); node.text = '<img src=x onerror="globalThis.pwned=1">';
    await route.fulfill({ response, json: data });
  });
  await page.goto('/'); await expect(page.locator('#selected-name')).toHaveText('<img src=x onerror="globalThis.pwned=1">');
  expect(await page.evaluate(() => globalThis.pwned)).toBeUndefined(); await expect(page.locator('img')).toHaveCount(0);
});

test('confidence filters control weighted relations and findings expose typed supporting paths', async ({ page }) => {
  await page.goto('/#' + encodeURIComponent('file:utils/assure-infer.mjs'));
  await expect(page.locator('#selected-name')).toHaveText('utils/assure-infer.mjs');
  await page.selectOption('#relation', 'implements'); await page.selectOption('#direction', 'out');
  await expect(page.locator('#neighbors')).toContainText('implements [0.90]');
  await page.selectOption('#confidence', '1'); await expect(page.locator('#neighbors button')).toHaveCount(0);
  await page.selectOption('#confidence', '0.8'); await expect(page.locator('#neighbors')).toContainText('Initial author assessment');
  await page.locator('#findings-panel summary').click(); await page.selectOption('#finding-status', 'recorded');
  await expect(page.locator('#finding-count')).not.toHaveText(/^0 findings/);
  await page.locator('#finding-results button').first().click(); await expect(page.locator('#finding-detail')).toContainText('recorded_deviation');
  await expect(page.locator('#finding-detail')).toContainText('has_deviation');
  await page.selectOption('#finding-status', 'candidate'); await page.fill('#finding-search', 'verifies_unassessed');
  await expect(page.locator('#finding-results')).toContainText('verifies_unassessed');
});
