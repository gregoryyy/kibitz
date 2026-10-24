import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { playLine } from '../../src/coach/annotations.js';
import { compileLibraryGame } from '../../src/library/library.js';
import { buildReviewReport, checkedReviewReport, summarizeReviews } from '../../src/player/reviews.js';
const FORK = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
const a = (cp, pv, extra = {}) => ({ depth: 12, lines: [{ score: { cp }, pv }], ...extra });
function setup(start = FORK, played = ['e1e2'], { side = 'w', before = a(500, ['b5c7', 'e8d7', 'c7a8']), after = a(0, ['a8a1']), reply = a(500, ['e8d7', 'c7a8']) } = {}) {
  const actual = playLine(Chess, start, played), best = playLine(Chess, start, before.lines[0].pv.slice(0, 1)), data = new Map([[actual.fens[0], before], [actual.fens[1], after]]), calls = [];
  let valid = true;
  const input = { start, ucis: played, side, analysis: fen => data.get(fen), current: () => valid,
    engine: async fen => { calls.push(fen); return fen === best?.fens.at(-1) ? reply : null; } };
  return { input, calls, data, cancel: () => { valid = false; } };
}
async function record(report, extra = {}, collection = 'library') {
  const c = new Chess(report.start); report.ucis.forEach(u => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }));
  const g = { id: 'own', kind: 'played', userColor: report.side, reviewed: true, pgn: c.pgn(), analysisReview: report, ...extra };
  return { g, snapshot: await compileLibraryGame(Chess, g, collection) };
}

test('a measured own error records a verified missed fork, keeping legal source and branch identity', async () => {
  const f = setup(), report = await buildReviewReport(Chess, f.input);
  assert.equal(report.decisions.length, 1); assert.equal(report.decisions[0].motif.status, 'confirmed'); assert.ok(report.decisions[0].motif.proof.tags.includes('fork'));
  assert.deepEqual(report.decisions[0].motif.proof.ucis, ['b5c7', 'e8d7', 'c7a8']); assert.ok(f.calls.length <= 12);
  const checked = checkedReviewReport(Chess, report, f.input.start, f.input.ucis, f.input.side);
  assert.equal(checked[0].classification, 'blunder'); assert.ok(checked[0].drop > 20); assert.equal(checked[0].fen, FORK); assert.equal(checked[0].uci, 'e1e2');
});

test('a refuted geometric fork does not become a missed confirmed theme', async () => {
  const f = setup('rb2k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['e1e2'], { before: a(0, ['b5c7', 'b8c7']), after: a(-500, ['a8a1']), reply: a(-200, ['b8c7']) });
  const report = await buildReviewReport(Chess, f.input); assert.equal(report.decisions[0].motif.status, 'refuted'); assert.equal(report.decisions[0].motif.proof, null);
  const summary = summarizeReviews(Chess, [await record(report)]); assert.equal(summary.measured, 1); assert.equal(summary.checkedThemes, 1); assert.equal(summary.confirmed, 0); assert.equal(summary.themes.size, 0);
});

test('Black-relative losses and promotion opportunities retain White-relative scores and custom source phase', async () => {
  const start = '7k/8/8/8/8/8/p7/7K b - - 0 1', f = setup(start, ['h8g8'], { side: 'b', before: a(-700, ['a2a1q', 'h1h2']), after: a(0, ['h1h2']), reply: a(-700, ['h1h2']) });
  const report = await buildReviewReport(Chess, f.input), checked = checkedReviewReport(Chess, report, start, f.input.ucis, 'b');
  assert.equal(report.decisions[0].before.score.cp, -700); assert.equal(checked[0].classification, 'blunder'); assert.equal(checked[0].phase, 'endgame'); assert.ok(checked[0].motif.proof.tags.includes('promotion'));
  assert.equal(checkedReviewReport(Chess, report, start, f.input.ucis, 'w'), null);
});

test('mate opportunities need no terminal engine PV and still bind to their actual legal branch', async () => {
  const start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', f = setup(start, ['a1a7'], { before: a(1000, ['a1a8']), after: a(0, ['g8f8']) });
  const report = await buildReviewReport(Chess, f.input); assert.equal(f.calls.length, 0); assert.ok(report.decisions[0].motif.proof.tags.includes('mate'));
  assert.equal(report.decisions[0].motif.proof.payoff, 'checkmate'); assert.ok(checkedReviewReport(Chess, report, start, f.input.ucis, 'w'));
});

test('restored, bounded, shallow, invalid-score and illegal-PV analysis stay unmeasured rather than generating a diagnosis', async () => {
  const bad = [a(500, ['b5c7'], { depth: 0 }), a(500, ['b5c7'], { depth: 5 }), { depth: 12, lines: [{ score: { cp: 500 }, pv: ['b5c7'], bound: 'lowerbound' }] }, a(500, ['a2a5']), a(500, ['Nc7+']), a(NaN, ['b5c7'])];
  for (const before of bad) {
    const f = setup(FORK, ['e1e2'], { before }), report = await buildReviewReport(Chess, f.input); assert.deepEqual(report.decisions, []); assert.deepEqual(f.calls, []);
    const summary = summarizeReviews(Chess, [await record(report)]); assert.equal(summary.ownMoves, 1); assert.equal(summary.measured, 0); assert.equal(summary.phases.endgame.accuracy, null);
  }
});

test('missing theme evidence abstains and game invalidation after an awaited search discards the entire new report', async () => {
  const missing = setup(FORK, ['e1e2'], { reply: null }); const report = await buildReviewReport(Chess, missing.input); assert.equal(report.decisions[0].motif.status, 'unverified');
  const stale = setup(); stale.input.engine = async () => { stale.cancel(); return a(500, ['e8d7', 'c7a8']); };
  assert.equal(await buildReviewReport(Chess, stale.input), null);
});

test('stored reports reject changed source lines, turn, scores, unknown schemas, fabricated phases/tags and invalid branches', async () => {
  const f = setup(), report = await buildReviewReport(Chess, f.input), validate = r => checkedReviewReport(Chess, r, FORK, ['e1e2'], 'w');
  for (const mutate of [r => { r.version = 99; }, r => { r.start = r.start.replace(' 0 1', ' 9 1'); }, r => { r.ucis[0] = 'e1d2'; }, r => { r.decisions.push(r.decisions[0]); }, r => { r.decisions[0].phase = 'opening'; }, r => { r.decisions[0].before.depth = 0; }, r => { r.decisions[0].after.score.cp = '0'; }, r => { r.decisions[0].motif.proof.tags = ['planning']; }, r => { r.decisions[0].motif.proof.ucis = ['e1e4']; }, r => { r.decisions[0].motif.proof.lossInPawns = 0.6; }]) {
    const copy = structuredClone(report); mutate(copy); assert.equal(validate(copy), null);
  }
  const checked = validate(report); checked[0].motif.proof.tags.push('fake'); assert.equal(validate(report)[0].motif.proof.tags.includes('fake'), false);
});

test('current-library summaries count a game once, exclude studies/classics/source claims and lose contributions on deletion or source replacement', async () => {
  const f = setup(), report = await buildReviewReport(Chess, f.input), own = await record(report), study = await record(report, { id: 'study', kind: 'study' }), classic = await record(report, { id: 'classic' }, 'classic');
  const legacy = await record(report, { id: 'legacy', analysisReview: undefined, cls: ['blunder'], summary: 'Missed fork and mate!' });
  const summary = summarizeReviews(Chess, [own, own, study, classic, legacy]); assert.equal(summary.games, 1); assert.equal(summary.ignored, 1); assert.equal(summary.ownMoves, 2); assert.equal(summary.measured, 1); assert.equal(summary.phases.endgame.errors, 1); assert.equal(summary.themes.get('fork'), 1); assert.equal(summary.themes.has('mate'), false);
  assert.deepEqual(summary.samples[0].line, ['Nc7+', 'Kd7', 'Nxa8']); assert.equal(summary.samples[0].playedLabel, '1. Ke2');
  assert.equal(summarizeReviews(Chess, []).games, 0);
  const changed = await record(report, { pgn: '[SetUp "1"]\n[FEN "' + FORK + '"]\n\n1. Kd2 *' }); assert.equal(summarizeReviews(Chess, [changed]).measured, 0);
});

test('rules-proven terminal outcomes need no fabricated engine PV and are independent of JSON property order', async () => {
  const start = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
  const f = setup(start, ['a1a8'], { before: a(1000, ['a1a8']), after: null }), report = await buildReviewReport(Chess, f.input);
  const terminal = report.decisions[0].after; assert.equal(terminal.basis, 'rules'); assert.equal(terminal.score.cp, 10000); assert.deepEqual(terminal.pv, []);
  report.decisions[0].after = { score: terminal.score, pv: [], depth: 0, basis: 'rules' };
  assert.ok(checkedReviewReport(Chess, report, start, ['a1a8'], 'w'));
  report.decisions[0].after.score.cp = 0; assert.equal(checkedReviewReport(Chess, report, start, ['a1a8'], 'w'), null);
});

test('moves recorded after an automatic terminal state cannot count as measured decisions', async () => {
  const start = '4k3/8/8/8/8/8/8/4K3 w - - 0 1', input = { start, ucis: ['e1e2'], side: 'w', current: () => true, analysis: () => { throw new Error('terminal positions need no analysis'); }, engine: async () => { throw new Error('no engine search'); } };
  const report = await buildReviewReport(Chess, input); assert.deepEqual(report.decisions, []);
  report.decisions.push({ ply: 1, before: { basis: 'rules', depth: 0, score: { cp: 0 }, pv: [] }, after: { basis: 'rules', depth: 0, score: { cp: 0 }, pv: [] }, phase: 'endgame', motif: { status: 'not-checked', proof: null } });
  assert.equal(checkedReviewReport(Chess, report, start, input.ucis, 'w'), null);
});
