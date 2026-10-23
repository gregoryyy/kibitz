import { test, expect, open, loadPgn } from './fixtures.mjs';

const response = (route, text) => route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ text }, { done: true, truncated: false }].map(x => JSON.stringify(x)).join('\n') + '\n' });
async function ask(page) {
  await page.locator('#coachInput').fill('Explain the move order.'); await page.locator('#coachSend').click();
  await expect(page.locator('#coachStop')).toBeHidden();
  return page.locator('#chat .msg.coach').last();
}

test('numbered commentary links preserve historical occurrences after the cursor moves', async ({ page }) => {
  await page.route('**/api/ai/sample', r => response(r, 'After **1. Nf3** the knight developed; **3. Nf3** returned to that square.'));
  await open(page); await loadPgn(page, '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3');
  const answer = await ask(page);
  await expect(answer.locator('.san.in-line')).toHaveCount(2);
  await page.locator('#btnFirst').click();
  await answer.locator('.san.in-line').first().click();
  expect(await page.evaluate(() => window.__kibitz.scratch().start.split(' ').at(-1))).toBe('1');
  await page.locator('#scratchClose').click();
  await answer.locator('.san.in-line').last().click();
  expect(await page.evaluate(() => window.__kibitz.scratch().start.split(' ').at(-1))).toBe('3');
  expect(await page.evaluate(() => window.__kibitz.S.nodes.length)).toBe(6);
});

test('a numbered alternative starts at the stated turn, including bold moves', async ({ page }) => {
  await page.route('**/api/ai/sample', r => response(r, 'Try **1. e4 e5**. Another option is **1. d4 d5**.'));
  await open(page); await page.locator('#modeAnalyse').click();
  await page.evaluate(() => window.__kibitz.ANA.set(window.__kibitz.S.start.split(' ').slice(0, 4).join(' '), { depth: 99, best: 'e2e4', lines: [{ score: { cp: 0 }, pv: ['e2e4', 'e7e5'] }, { score: { cp: 0 }, pv: ['d2d4', 'd7d5'] }] }));
  const answer = await ask(page);
  await expect(answer.locator('.san.in-line')).toHaveCount(4);
  await answer.locator('.san.in-line', { hasText: 'd4' }).hover();
  await answer.locator('.san.in-line', { hasText: 'd4' }).click();
  expect(await page.evaluate(() => window.__kibitz.scratch().start)).toBe(await page.evaluate(() => window.__kibitz.S.start));
  await expect(page.locator('#scratchMoves button')).toHaveText(['1. d4', 'd5']);
});

test('commentary cache distinguishes the same position reached at a different game step', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/ai/sample', r => response(r, `After ${++requests === 1 ? '1' : '3'}. Nf3 the knight is developed.`));
  await open(page); await loadPgn(page, '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3');
  await page.locator('#moves button').nth(0).click(); await page.locator('#btnComment').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('After 1. Nf3');
  await page.locator('#moves button').nth(4).click(); await page.locator('#btnComment').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('After 3. Nf3');
  expect(requests).toBe(2);
});

test('Comment on this position uses the scratch position and pins a way back to it', async ({ page }) => {
  let sent;
  await page.route('**/api/ai/sample', r => { sent = JSON.stringify(r.request().postDataJSON().messages); return response(r, 'The line 1. e4 e5 opens the centre.'); });
  await open(page); await page.locator('#modeAnalyse').click();
  await page.locator('#coachInput').fill('play e4 e5'); await page.locator('#coachSend').click();
  await expect(page.locator('#scratchMoves button')).toHaveCount(2);
  const end = await page.evaluate(() => window.__kibitz.scratch().fens[2]);
  await page.locator('#btnComment').click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer).toContainText('opens the centre');
  expect(sent).toContain(end); expect(sent).toContain('trying a line on a scratch board');
  await expect(answer.locator('.message-context')).toHaveCount(1);
  await page.locator('#scratchClose').click(); await answer.locator('.message-context').click();
  expect(await page.evaluate(() => window.__kibitz.scratch().fens[2])).toBe(end);
  expect(await page.evaluate(() => window.__kibitz.S.nodes.length)).toBe(1);
});

test('saved review summaries link earlier moves against the reviewed game, independently of the cursor', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.games', JSON.stringify([{ id: 'review', kind: 'study', white: 'White', black: 'Black', reviewed: true, summary: 'After **1. e4 e5**, White developed with **2. Nf3**.', pgn: '1. e4 e5 2. Nf3 Nc6' }])));
  await open(page); await page.locator('[data-tab="library"]').click();
  await page.locator('#libList').getByRole('button', { name: 'Open review', exact: true }).click();
  await expect(page.locator('#summaryBox .san.in-line')).toHaveCount(3);
  await page.locator('#btnFirst').click(); await page.locator('[data-tab="review"]').click();
  await page.locator('#summaryBox .san.in-line', { hasText: 'Nf3' }).click();
  expect(await page.evaluate(() => window.__kibitz.scratch().start.split(' ').at(-1))).toBe('2');
  await expect(page.locator('#scratchMoves button[aria-current="true"]')).toHaveText('2. Nf3');
});

test('a delayed comment keeps its original step and engine lines while the player navigates', async ({ page }) => {
  let pending;
  await page.route('**/api/ai/sample', r => { pending = r; });
  await open(page); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6');
  await page.evaluate(() => {
    const { S, ANA } = window.__kibitz;
    ANA.set(S.nodes[1].fen.split(' ').slice(0, 4).join(' '), { depth: 99, best: 'e7e5', lines: [{ score: { cp: 0 }, pv: ['e7e5', 'g1f3'] }] });
  });
  await page.locator('#moves button').nth(0).click(); await page.locator('#btnComment').click();
  await expect.poll(() => !!pending).toBe(true);
  await page.locator('#btnLast').click();
  await page.evaluate(() => {
    const { S, ANA } = window.__kibitz;
    ANA.set(S.nodes[1].fen.split(' ').slice(0, 4).join(' '), { depth: 99, best: 'd7d5', lines: [{ score: { cp: 0 }, pv: ['d7d5'] }] });
  });
  await response(pending, 'Consider 1... e5 2. Nf3.');
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer.locator('.san.in-line')).toHaveCount(2);
  await expect(answer.locator('.san.invalid, .san.unchecked')).toHaveCount(0);
  await answer.locator('.message-context').click();
  expect(await page.evaluate(() => window.__kibitz.S.cursor)).toBe(1);
});

test('a delayed study plan keeps its original game position after navigation', async ({ page }) => {
  let pending;
  await page.route('**/api/ai/sample', r => { pending = r; });
  await open(page); await loadPgn(page, '1. e4 e5 2. Nf3 Nc6');
  await page.locator('[data-tab="reading"]').click(); await page.locator('#btnStudyPlan').click();
  await expect.poll(() => !!pending).toBe(true); await page.locator('#btnFirst').click();
  await response(pending, 'Study the development after 2. Nf3.');
  await expect(page.locator('#studyPlan .san.in-line')).toHaveCount(1);
  await page.locator('#studyPlan .san.in-line').click();
  expect(await page.evaluate(() => window.__kibitz.scratch().start.split(' ').at(-1))).toBe('2');
  await page.locator('#scratchClose').click(); await page.locator('#studyPlan .message-context').click();
  expect(await page.evaluate(() => window.__kibitz.S.cursor)).toBe(4);
});
