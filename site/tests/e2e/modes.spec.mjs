// Explanation modes (TODO 3.9): commentary on every move, interesting moves, challenges.
import { test, expect, open, loadPgn, reveal, OPERA } from './fixtures.mjs';

// White to move mates in one with Ra8#.
const MATE_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

test('commentary: the coach comments on every move by either side, here a loaded game\'s', async ({ page }) => {
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#optCommentWhen button[data-v="commentary"]').click();
  await expect(page.locator('#modeHint')).toContainText('every move by either side');
  await loadPgn(page, OPERA);
  await page.locator('#btnFirst').click();
  await page.locator('#btnNext').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Coach on 1. e4', { timeout: 30_000 });
  await page.locator('#btnNext').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Coach on 1… e5', { timeout: 30_000 });
});

test('interesting moves: the best move with its evaluation, and the line count from the settings', async ({ page }) => {
  await open(page);
  await loadPgn(page, OPERA);
  await page.locator('#moves button >> nth=17').click(); // after 9... b5
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#interesting li').first()).toHaveText(/^Nxb5 \+\d+\.\d\d · best$/, { timeout: 30_000 });
  await page.locator('#optLines button[data-v="5"]').click();
  const lines = () => page.evaluate(() => { const { S, ANA } = window.__kibitz; return ANA.get(S.nodes[S.cursor].fen.split(' ').slice(0, 4).join(' '))?.lines.length; });
  await expect.poll(lines, { timeout: 30_000 }).toBe(5);
  await page.reload(); // the settings are kept
  await expect(page.locator('#optLines button[data-v="5"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a challenge: the engine checks the answer before anything is revealed, and progress counts it', async ({ page }) => {
  await open(page);
  await reveal(page, '#loadText');
  await page.locator('#loadText').fill(MATE_IN_1);
  await page.locator('#btnLoad').click();
  await expect(page.locator('#loadMsg')).toContainText('Position loaded');
  await page.locator('#btnChallenge').click();
  const ch = page.locator('#chat .msg.challenge').last();
  await expect(ch).toContainText(/Ra8# or \w+\?|\w+ or Ra8#\?/, { timeout: 30_000 });
  await expect(ch).not.toContainText('Right');
  await ch.locator('.chip', { hasText: 'Ra8#' }).click();
  await expect(ch.locator('.challenge-verdict.right')).toHaveText(/^Right: Ra8# is the better move \(mate for White\)\.$/);
  await expect(page.locator('#challengeProgress')).toHaveText(/Challenges: 1 of 1 right\. By theme: Checkmate pattern 1\/1\./);
  await expect(page.locator('#chat .msg.coach:not(.challenge)').last()).toContainText('Mock coach'); // the coach explains
  // A typed answer; something that isn't a legal move leaves the challenge open.
  await page.locator('#btnChallenge').click();
  await expect(page.locator('#chat .msg.challenge')).toHaveCount(2, { timeout: 30_000 });
  await page.locator('#coachInput').fill('Qh7');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.challenge').last().locator('.challenge-note')).toContainText("isn't a legal move here");
  await page.locator('#coachInput').fill('ra8');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.challenge').last().locator('.challenge-verdict.right')).toBeVisible();
  await expect(page.locator('#challengeProgress')).toContainText('2 of 2 right');
});

test('challenge mode: stepping through a game, the coach asks instead of explaining', async ({ page }) => {
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#optCommentWhen button[data-v="challenge"]').click();
  await loadPgn(page, OPERA);
  await page.locator('#moves button >> nth=16').click(); // after 9. Bg5, Black to move
  await expect(page.locator('#chat .msg.challenge').last()).toContainText('Challenge at 9. Bg5', { timeout: 30_000 });
  await expect(page.locator('#chat .msg.coach:not(.challenge)')).toHaveCount(0); // no explanation until answered
});
