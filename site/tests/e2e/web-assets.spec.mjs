import { test, expect, open, openSettings, closeSettings } from './fixtures.mjs';

for (const phone of [false, true]) test(`original fonts and board layout work locally ${phone ? 'on a German phone' : 'on desktop'}`, async ({ page }, testInfo) => {
  if (phone) await page.setViewportSize({ width: 390, height: 844 });
  const requests = [], fonts = [];
  page.on('request', request => requests.push(request.url()));
  page.on('response', response => { if (response.url().endsWith('.ttf')) fonts.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] }); });
  await open(page);
  if (phone) { await openSettings(page); await page.locator('#optLang').selectOption('de'); await closeSettings(page); }
  const loaded = await page.evaluate(async () => {
    const results = await Promise.all(['700 26px "Bricolage Grotesque"', '400 15px "Instrument Sans"', '600 12px "JetBrains Mono"'].map(font => document.fonts.load(font, 'Kibitz ÄÖÜß')));
    return results.map(faces => faces.map(face => face.status));
  });
  expect(loaded).toEqual([['loaded'], ['loaded'], ['loaded']]);
  expect([...new Set(fonts.map(f => new URL(f.url).pathname))].sort()).toEqual(['/fonts/bricolage-grotesque.ttf', '/fonts/instrument-sans.ttf', '/fonts/jetbrains-mono.ttf']);
  expect(fonts.every(f => f.status === 200 && f.type === 'font/ttf')).toBe(true);
  const origin = new URL(page.url()).origin;
  expect(requests.every(url => new URL(url).origin === origin)).toBe(true);
  await expect(page.locator('#board cg-board')).toBeVisible();
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, board: document.querySelector('#board').getBoundingClientRect().width }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1); expect(sizes.board).toBeGreaterThan(250);
  expect((await page.request.get(page.url())).headers()['content-security-policy']).not.toContain('unsafe-inline');
  await page.screenshot({ path: testInfo.outputPath(phone ? 'german-phone.png' : 'desktop.png') });
});
