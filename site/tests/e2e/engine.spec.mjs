// Stockfish in the browser: multi-threaded when the page is cross-origin isolated (TODO 1.3).
import { test, expect, open, move, loadPgn, OPERA } from './fixtures.mjs';

test('the page is cross-origin isolated and the analyst runs the multi-threaded build', async ({ page }) => {
  const res = await page.goto('/?debug');
  expect(res.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const cores = await page.evaluate(() => navigator.hardwareConcurrency);
  if (cores > 2) await expect(page.locator('#engineText')).toContainText('threads');
  // The threaded analyst still analyses, and the single-threaded opponent still replies.
  await page.locator('#optHelp button[data-v="full"]').click();
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2);
  await expect(page.locator('#evalbar')).toHaveAttribute('title', /Stockfish: [+−#-]/);
});

test('without isolation, the single-threaded build runs', async ({ page }) => {
  // A host that drops COEP (e.g. some artifact hosts) must still get a working engine.
  await page.route('**/*', async route => {
    const r = await route.fetch();
    const headers = { ...r.headers() }; delete headers['cross-origin-embedder-policy'];
    await route.fulfill({ response: r, headers });
  });
  await open(page);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await expect(page.locator('#engineText')).not.toContainText('threads');
  await move(page, 'd2', 'd4');
  await expect(page.locator('#moves button')).toHaveCount(2);
});

test('a mate in one with losing alternatives is analysed within the time cap', async ({ page }) => {
  // Before the cap, MultiPV 3 on this position ran 8 s single-threaded and over 30 s with 4 threads,
  // and everything queued behind it (the coach, hints) waited.
  await open(page);
  await loadPgn(page, OPERA.replace(' 17. Rd8# 1-0', ' *'));
  const t0 = Date.now();
  await expect(page.locator('#evalbar')).toHaveAttribute('title', /Stockfish: #1/, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => { const a = window.__kibitz.ANA.get('1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k -'); return a ? a.depth >= 14 || a.capDepth >= 14 : false; }), { timeout: 15_000 }).toBe(true);
  expect(Date.now() - t0).toBeLessThan(12_000);
});
