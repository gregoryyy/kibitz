// The tutor eval runner (TODO 3.8) on the app with the mock provider: every reference position loads,
// is analysed and gets an answer through its chip, with the app's checks and the coach's context.
import { test, expect, open } from './fixtures.mjs';
import { POSITIONS } from '../../eval/positions.mjs';
import { evalPositions } from '../../eval/positions-de.mjs';
import { runPosition } from '../../scripts/eval.mjs';

test('every eval position runs in the app: loaded, analysed, asked through its chip, answer captured', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  for (const pos of POSITIONS) {
    const r = await runPosition(page, pos);
    expect(r.answer, pos.id).toContain('Mock coach');
    expect(r.checks, pos.id).toMatchObject({ invalid: 0 });
    expect(r.context, pos.id).toMatch(/Stockfish 19 \(depth \d+\) top lines/);
    expect(r.question.length, pos.id).toBeGreaterThan(10);
    expect(r.error, pos.id).toBeNull();
  }
});

test('an error from the provider comes back as an error, not as an answer to score', async ({ page }) => {
  await open(page);
  await page.route('**/api/ai/sample', r => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'rate_limited', message: 'The AI provider is rate limiting requests' } }) }));
  const r = await runPosition(page, POSITIONS.find(p => p.id === 'back-rank'));
  expect(r.error).toBe('rate_limited');
  expect(r.answer).toMatch(/Too many questions/);
});

test('every German eval position uses its translated chip, German coaching instructions and the same engine context with mock answers', async ({ page }) => {
  test.setTimeout(240_000); const sent = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/ai/sample') sent.push(request.postDataJSON()); });
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page);
  for (const position of evalPositions('de')) {
    const result = await runPosition(page, position);
    expect(result.answer, position.id).toContain('Mock coach'); expect(result.error, position.id).toBeNull(); expect(result.checks.invalid, position.id).toBe(0);
    expect(result.context, position.id).toMatch(/Stockfish 19 \(depth \d+\) top lines/); expect(result.question.length, position.id).toBeGreaterThan(10);
    expect(JSON.stringify(sent.at(-1).messages), position.id).toContain('Answer in German (Deutsch)');
  }
});

test('German load success does not hide a provider error or produce an answer suitable for scoring', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page);
  await page.route('**/api/ai/sample', route => route.fulfill({ status: 429, json: { error: { code: 'rate_limited', message: 'Provider rate limit' } } }));
  const result = await runPosition(page, evalPositions('de', 'back-rank')[0]); expect(result.error).toBe('rate_limited'); expect(result.answer).not.toContain('Mock coach');
});
