// The coach's connection to the AI gateway: tasks, settings, usage (TODO 2.10-2.14).
import { test, expect, open } from './fixtures.mjs';

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
  await expect(page.locator('#coachUsage')).toContainText(/Today: \d+ requests?/);
  await page.locator('#optLocalOnly').check();
  await expect(page.locator('#optLocalOnly')).toBeChecked();
  await expect(page.locator('#optProvider button[data-v="mock"]')).toHaveAttribute('aria-pressed', 'true'); // mock is local
  await page.locator('#optLocalOnly').uncheck();
  await expect(page.locator('#coachSend')).toBeEnabled();
});
