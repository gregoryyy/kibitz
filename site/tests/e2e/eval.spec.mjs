// The tutor eval runner (TODO 3.8) on the app with the mock provider: every reference position loads,
// is analysed and gets an answer through its chip, with the app's checks and the coach's context.
import { test, expect, open } from './fixtures.mjs';
import { POSITIONS } from '../../eval/positions.mjs';
import { evalPositions } from '../../eval/positions-de.mjs';
import { runPosition } from '../../scripts/eval.mjs';
import { quoteOf } from '../../scripts/coach-page.mjs';
import { keyPointHits } from '../../eval/score.mjs';

test('eval capture scores coach prose without source, engine or interface text', async ({ page }) => {
  await page.goto('about:blank');
  await page.setContent(`<div id="answer" class="msg coach">
    <span class="who">Coach</span><button class="message-context">Game at move 12</button>
    <div><p>Actual prose: <strong>alpha</strong> <span class="san invalid">Qh9</span> <span class="san">Nf3</span>.</p>
      <p class="check-note">A claim was flagged.</p><div class="board-marks"><button>Show marks</button></div>
      <details class="retrieval-sources"><summary>Passages supplied</summary><article><p>Brückenbau <span class="san invalid">Qa9</span></p></article></details>
    </div>
    <details class="evidence"><summary>Engine evidence</summary><ul><li>mate <span class="san invalid">Qb9</span></li></ul></details>
    <p class="usage-note">123 tokens</p>
  </div>`);
  const captured = await page.locator('#answer').evaluate(quoteOf);
  expect(captured.text).toBe('Actual prose: alpha ~~Qh9~~ Nf3.');
  expect(captured.checks).toEqual({ all: 2, invalid: 1, unchecked: 0 });
  expect(keyPointHits(captured.text, [{ point: 'bridge', all: ['Brückenbau'] }, { point: 'mate', all: ['mate'] }])).toEqual([false, false]);
  expect(captured.capture).toBe('coach-prose-v2');
});

test('every eval position runs in the app: loaded, analysed, asked through its chip, answer captured', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  for (const pos of POSITIONS) {
    const r = await runPosition(page, pos);
    expect(r.answer, pos.id).toContain('Mock coach');
    expect(r.capture).toBe('coach-prose-v2');
    expect(r.answer).not.toMatch(/Passages supplied to the coach|Show the mark|Stockfish checked/);
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
    expect(result.capture).toBe('coach-prose-v2'); expect(result.answer).not.toMatch(/Dem Coach bereitgestellte Textstellen|Markierungen auf dem Brett|Stockfish checked/);
    expect(result.context, position.id).toMatch(/Stockfish 19 \(depth \d+\) top lines/); expect(result.question.length, position.id).toBeGreaterThan(10);
    expect(JSON.stringify(sent.at(-1).messages), position.id).toContain('Answer in German (Deutsch)');
  }
});

test('German load success does not hide a provider error or produce an answer suitable for scoring', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de'))); await open(page);
  await page.route('**/api/ai/sample', route => route.fulfill({ status: 429, json: { error: { code: 'rate_limited', message: 'Provider rate limit' } } }));
  const result = await runPosition(page, evalPositions('de', 'back-rank')[0]); expect(result.error).toBe('rate_limited'); expect(result.answer).not.toContain('Mock coach');
});
