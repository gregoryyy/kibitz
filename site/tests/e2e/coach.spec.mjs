// The coach's connection to the AI gateway: tasks, settings, usage (TODO 2.10-2.14).
import { test, expect, open, loadPgn, OPERA } from './fixtures.mjs';

test('quick questions, typed questions and the review summary ask for their own task', async ({ page }) => {
  const tasks = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) tasks.push(JSON.parse(r.postData()).task); });
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachChips .chip').first().click();
  await expect(page.locator('#chat .msg.coach')).toHaveCount(1);
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  await page.locator('#coachInput').fill('What now?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach')).toHaveCount(2);
  await expect(page.locator('#chat .msg.coach').last()).toContainText('Mock coach');
  expect(tasks).toEqual(['quick', 'chat']);
});

test('coach settings: providers, models, local-only, connection test and usage', async ({ page }) => {
  await open(page);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachSettings summary').click();
  await expect(page.locator('#optProvider button[data-v="mock"]')).toHaveAttribute('aria-pressed', 'true');
  for (const p of ['anthropic', 'openai', 'mistral', 'ollama']) await expect(page.locator(`#optProvider button[data-v="${p}"]`)).toBeDisabled(); // no keys in the test server
  await expect(page.locator('#providerHint')).toContainText('ANTHROPIC_API_KEY');
  await expect(page.locator('#coachModels')).toContainText('Reviews and plans');
  await page.locator('#btnTestAi').click();
  await expect(page.locator('#testAiMsg')).toHaveText(/^Connected: Mock \(offline\), mock, \d+ ms\.$/);
  await expect(page.locator('#coachUsage')).toContainText(/Server today: \d+ requests?/);
  await page.locator('#optLocalOnly').check();
  await expect(page.locator('#optLocalOnly')).toBeChecked();
  await expect(page.locator('#optProvider button[data-v="mock"]')).toHaveAttribute('aria-pressed', 'true'); // mock is local
  await page.locator('#optLocalOnly').uncheck();
  await expect(page.locator('#coachSend')).toBeEnabled();
});

test('after a review, the chat knows the evaluation graph and the turning points', async ({ page }) => {
  const bodies = [];
  page.on('request', r => { if (r.url().endsWith('/api/ai/sample')) bodies.push(JSON.stringify(JSON.parse(r.postData()).messages)); });
  await open(page);
  await loadPgn(page, OPERA);
  const ask = async q => {
    const n = await page.locator('#chat .msg.coach').count();
    await page.locator('#coachInput').fill(q);
    await page.locator('#coachSend').click();
    await expect(page.locator('#chat .msg.coach')).toHaveCount(n + 1);
    await expect(page.locator('#coachStop')).toBeHidden();
  };
  await ask('Where did the game turn?');
  expect(bodies.at(-1)).not.toContain('Game review by Stockfish');
  await page.locator('[data-tab="review"]').click();
  await page.locator('#btnReview').click();
  await expect(page.locator('#reviewBody .moments')).toBeVisible({ timeout: 60_000 });
  await ask('Where did the game turn?');
  const prompt = bodies.at(-1);
  expect(prompt).toContain('Game review by Stockfish');
  expect(prompt).toMatch(/Evaluation after each move \(White's point of view\): 1\. e4 [+−]\d\.\d, 1… e5 /);
  expect(prompt).toContain('17. Rd8# mate for White');
  expect(prompt).toMatch(/Turning points:\\n {2}- \d+(\.|…) /);
});

test('each answer shows its tokens and cost, and the dialogue the player\'s total today', async ({ page }) => {
  await open(page);
  await expect(page.locator('#usageLine')).toBeHidden();
  await page.locator('#coachChips .chip').first().click();
  const answer = page.locator('#chat .msg.coach').last();
  await expect(answer.locator('.usage-note')).toHaveText(/^[\d,]+ \+ \d+ tokens · \$\d+\.\d+$/);
  await expect(page.locator('#usageLine')).toHaveText(/^You today: 1 answer, [\d,]+ tokens, about \$\d+\.\d+\.$/);
  await page.locator('#coachInput').fill('And now?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#usageLine')).toHaveText(/^You today: 2 answers, /);
  await page.locator('[data-tab="coach"]').click();
  await page.locator('#coachSettings summary').click();
  await expect(page.locator('#coachUsage')).toContainText(/You today: 2 answers/);
});

test('a spent budget shows the server\'s message in the dialogue', async ({ page }) => {
  await open(page);
  await page.route('**/api/ai/sample', route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'budget_exceeded', message: 'You\'ve used today\'s budget of 20 tokens on paid models. It resets at midnight; local models (Ollama, the in-browser model) still work.' } }) }));
  await page.locator('#coachChips .chip').first().click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('You\'ve used today\'s budget of 20 tokens on paid models');
});

test('a request the provider rejects shows its reason, not a generic error', async ({ page }) => {
  await page.route('**/api/ai/sample', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: { code: 'provider_rejected', message: 'The AI provider rejected the request: "deepseek-R1:latest" does not support chat' } }) }));
  await open(page);
  await page.locator('#coachInput').fill('What now?');
  await page.locator('#coachSend').click();
  await expect(page.locator('#chat .msg.coach').last()).toContainText('does not support chat');
});
