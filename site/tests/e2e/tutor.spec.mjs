// Tutor comments: aspects, templates, checked answers, when the coach comments, cache (TODO 3.2-3.7).
import { test, expect, open, move, openSettings, closeSettings } from './fixtures.mjs';

// Records the bodies of the page's requests to the AI gateway.
function recordSamples(page) {
  const bodies = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) bodies.push(JSON.parse(r.postData())); });
  return bodies;
}
const lastMessage = body => body.messages.at(-1).content;

test('aspect picker: the comment covers the chosen aspects in order; a repeat comes from the cache, also after a reload', async ({ page }) => {
  const bodies = recordSamples(page);
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  const chip = id => page.locator(`#aspectPicker button[data-v="${id}"]`);
  await expect(page.locator('#aspectPicker button')).toHaveCount(5);
  for (const [id, on] of [['last', 'true'], ['next', 'true'], ['mind', 'true'], ['habits', 'false'], ['games', 'false']]) await expect(chip(id)).toHaveAttribute('aria-pressed', on);
  await chip('next').click();
  await chip('habits').click();
  await page.locator('#btnComment').click();
  const first = page.locator('#chat .msg.coach').last();
  await expect(first).toContainText('Coach on the start: Last move · Keep in mind · Good habits');
  await expect(first).toContainText('Mock coach');
  expect(bodies).toHaveLength(1);
  expect(bodies[0].task).toBe('quick');
  expect(lastMessage(bodies[0])).toMatch(/1\. The last move[\s\S]*2\. Things to keep in mind[\s\S]*3\. One habit/);
  expect(lastMessage(bodies[0])).not.toMatch(/What comes next/);

  await page.locator('#btnComment').click();
  await expect(page.locator('#chat .msg.coach')).toHaveCount(2);
  await expect(page.locator('#chat .msg.coach').last()).toContainText('(saved)');
  expect(bodies).toHaveLength(1);

  await page.reload();
  await expect(page.locator('#engineDot')).toHaveClass(/ok/);
  await page.locator('[data-tab="coach"]').click();
  await expect(chip('habits')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('next')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#btnComment').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('(saved)');
  expect(bodies).toHaveLength(1);
});

test('an answer\'s moves and piece claims are checked: an illegal move is underlined in red and counted', async ({ page }) => {
  await page.route('**/api/ai/sample', r => r.fulfill({
    status: 200, contentType: 'application/x-ndjson',
    body: [{ text: 'Start with e4. Qh5 wins at once, and the knight on f3 is strong.' }, { done: true, truncated: false }].map(l => JSON.stringify(l)).join('\n') + '\n',
  }));
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachInput').fill('What now?');
  await page.locator('#coachSend').click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer.locator('.san.invalid')).toHaveText('Qh5');
  await expect(answer.locator('.san.invalid')).toHaveAttribute('title', /Not a legal move/);
  // Underlined, not struck through, so the move stays readable (and red).
  const style = await answer.locator('.san.invalid').evaluate(e => { const c = getComputedStyle(e); return { line: c.textDecorationLine, border: c.borderBottomStyle, color: c.color, blunder: getComputedStyle(document.documentElement).getPropertyValue('--blunder') }; });
  expect(style.line).toBe('none');
  expect(style.border).toBe('solid');
  expect(style.blunder.trim()).not.toBe('');
  await expect(answer.locator('.san', { hasText: 'e4' })).not.toHaveClass(/invalid/);
  await expect(answer.locator('.san', { hasText: 'f3' })).toHaveCount(0); // "on f3" is a square, not a move
  await expect(answer.locator('.check-note')).toContainText('2 claims in this answer don\'t match');
});

test('after every move: the coach comments on the player\'s move beside the board, without spoiling the position', async ({ page }) => {
  const bodies = recordSamples(page);
  await open(page);
  await openSettings(page);
  await page.locator('#optCommentWhen button[data-v="every"]').click();
  await closeSettings(page);
  await move(page, 'e2', 'e4');
  const comment = page.locator('#chat .msg.coach').last();
  await expect(comment).toContainText('Coach on 1. e4', { timeout: 20_000 });
  await expect(comment).toContainText('Mock coach');
  await expect(comment).toBeVisible(); // the dialogue is beside the board, whichever tab is open
  // Engine help is "flag mistakes": the coach sees how the move rated, not Stockfish's view of the position.
  expect(bodies).toHaveLength(1);
  const prompt = lastMessage(bodies[0]);
  expect(prompt).toContain('flag mistakes only');
  expect(prompt).not.toContain('top lines');
  expect(prompt).not.toMatch(/What comes next/);
  await page.locator('[data-tab="coach"]').click();
  await expect(page.locator('#aspectHint')).toContainText('What\'s next: left out while you play');
});

test('with engine help off, the coach stays quiet during the game', async ({ page }) => {
  const bodies = recordSamples(page);
  await open(page);
  await page.locator('#optHelp button[data-v="off"]').click();
  await openSettings(page);
  await page.locator('#optCommentWhen button[data-v="every"]').click();
  await closeSettings(page);
  await move(page, 'e2', 'e4');
  await expect(page.locator('#moves button')).toHaveCount(2); // Stockfish replied
  await page.waitForTimeout(2_000); // time for the moves to be classified
  expect(bodies).toHaveLength(0);
  await expect(page.locator('#chat .msg.coach')).toHaveCount(0);
});
