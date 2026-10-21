// Shared setup: every test fails on uncaught page errors or Content-Security-Policy violations.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await use(page);
    const csp = await page.evaluate(() => window.__csp).catch(() => []);
    expect([...errors, ...csp.map(v => 'csp: ' + v)]).toEqual([]);
  },
});
export { expect };

export const S = page => page.evaluate(() => {
  const { S } = window.__kibitz;
  return { nodes: S.nodes.length, cursor: S.cursor, thinking: S.thinking, playing: S.playing, mode: S.mode, reviewDone: S.reviewDone, userColor: S.userColor };
});

// Opens the app (with the ?debug hook) and waits for Stockfish.
export async function open(page, path = '/?debug') {
  await page.goto(path);
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
}

async function squareCenter(page, sq) {
  const b = await page.locator('#board').boundingBox();
  const flipped = await page.evaluate(() => window.__kibitz?.S.orientation === 'black');
  const f = 'abcdefgh'.indexOf(sq[0]), r = Number(sq[1]);
  const fx = flipped ? 7 - f : f, ry = flipped ? r - 1 : 8 - r;
  return { x: b.x + (fx + 0.5) * b.width / 8, y: b.y + (ry + 0.5) * b.height / 8 };
}
// Click-click move on the board. Scrolls it into view first: the panels below the dialogue can push
// the page down when a test clicks an option there. Chessground forgets its cached board position on
// the scroll event, which fires on the next frame, so the clicks wait for that.
export async function move(page, from, to) {
  await page.locator('#board').scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (const sq of [from, to]) { const p = await squareCenter(page, sq); await page.mouse.click(p.x, p.y); await page.waitForTimeout(80); }
}

// Opens the collapsed <details> section that holds `selector`.
export const reveal = (page, selector) => page.locator(`details:has(${selector})`).evaluate(d => { d.open = true; });

export async function loadPgn(page, pgn) {
  await page.locator('[data-tab="game"]').click();
  await reveal(page, '#loadText');
  await page.locator('#loadText').fill(pgn);
  await page.locator('#btnLoad').click();
  await expect(page.locator('#loadMsg')).toContainText('Loaded');
}

export const OPERA = '[White "Paul Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';
