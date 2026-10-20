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
