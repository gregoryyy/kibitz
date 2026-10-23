// Engine tools for the coach (TODO 4.11): arguments checked as untrusted, results from a fake engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { TOOLS, ENGINE_TOOL_NAMES, CAPS, checkToolCall, runTool } from '../../src/tools.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// After 1. e4 e5 2. Qh5 Nc6 3. Bc4, Black to move: White threatens Qxf7#.
const QH5 = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

// A fake engine: fixed lines per position (White's point of view), and a log of what it was asked.
function fakeEngine(table) {
  const calls = [];
  const engine = async (fen, opts) => { calls.push({ fen, ...opts }); return table[fen.split(' ').slice(0, 4).join(' ')] || { depth: opts.depth, lines: [] }; };
  return { engine, calls };
}
const key = fen => fen.split(' ').slice(0, 4).join(' ');

test('the catalogue: every tool has a description and an object schema', () => {
  assert.deepEqual(ENGINE_TOOL_NAMES, ['analyse', 'try_move', 'threats', 'compare', 'find_mate', 'find_motifs']);
  for (const n of ENGINE_TOOL_NAMES) { assert.ok(TOOLS[n].description.length > 20, n); assert.equal(TOOLS[n].schema.type, 'object', n); assert.ok(TOOLS[n].schema.required.includes('fen'), n); }
});

test('arguments are untrusted: unknown tools, extra fields, bad positions, illegal moves and caps are refused', () => {
  assert.equal(checkToolCall(Chess, 'rm_rf', { fen: START }).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', null).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', [START]).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', { fen: START, script: 'x' }).why, 'unknown argument script');
  assert.equal(checkToolCall(Chess, 'analyse', { fen: 'not a fen' }).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', { fen: '8/8/8/8/8/8/8/8 w - - 0 1' }).ok, false, 'no kings');
  assert.equal(checkToolCall(Chess, 'analyse', { fen: 'x'.repeat(5000) }).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', { fen: START, depth: 99 }).ok, false, 'over the depth cap');
  assert.equal(checkToolCall(Chess, 'analyse', { fen: START, depth: 12.5 }).ok, false);
  assert.equal(checkToolCall(Chess, 'analyse', { fen: START, lines: 50 }).ok, false);
  assert.deepEqual(checkToolCall(Chess, 'analyse', { fen: START }).args, { fen: START, depth: 14, lines: 3 });
  assert.equal(checkToolCall(Chess, 'try_move', { fen: START, move: 'Ke2' }).ok, false);
  assert.equal(checkToolCall(Chess, 'try_move', { fen: START, move: 'g1f3' }).args.move, 'Nf3', 'UCI becomes SAN');
  assert.equal(checkToolCall(Chess, 'compare', { fen: START, moves: ['e4'] }).ok, false);
  assert.equal(checkToolCall(Chess, 'compare', { fen: START, moves: ['e4', 'd4', 'c4', 'Nf3', 'g3', 'b3'] }).ok, false, 'over the cap');
  assert.equal(checkToolCall(Chess, 'compare', { fen: START, moves: ['e4', 'Qh5'] }).ok, false);
  assert.equal(checkToolCall(Chess, 'find_mate', { fen: START, n: 20 }).ok, false);
  assert.equal(checkToolCall(Chess, 'find_motifs', { fen: START, line: ['e4', 'e4'] }).ok, false);
  assert.equal(checkToolCall(Chess, 'find_motifs', { fen: START, line: Array(CAPS.lineMoves + 1).fill('Nf3') }).ok, false);
  const check = '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1';
  assert.equal(checkToolCall(Chess, 'threats', { fen: check }).ok, false, 'in check: no threats question');
});

test('analyse: lines in SAN with move numbers, evaluations, motifs, and "only move" when the second line is far worse', async () => {
  const { engine, calls } = fakeEngine({ [key(QH5)]: { depth: 14, lines: [{ score: { cp: -20 }, pv: ['g7g6', 'h5f3', 'g8f6'] }, { score: { mate: 1 }, pv: ['g8f6', 'h5f7'] }] } });
  const { result, lines } = await runTool(Chess, engine, checkToolCall(Chess, 'analyse', { fen: QH5, lines: 2 }));
  assert.equal(calls[0].depth, 14); assert.equal(calls[0].lines, 2);
  assert.equal(result.sideToMove, 'Black');
  assert.equal(result.onlyMove, true);
  assert.equal(result.lines[0].moves, '3... g6 4. Qf3 Nf6');
  assert.equal(result.lines[1].eval, '#1');
  assert.ok(result.lines[1].motifs.some(m => /checkmate/.test(m)));
  assert.deepEqual(lines, [['g6', 'Qf3', 'Nf6'], ['Nf6', 'Qxf7#']]);
});

test('try_move: a mistake, its loss and the refuting reply', async () => {
  const after = new Chess(QH5); after.move('Nf6');
  const { engine } = fakeEngine({ [key(QH5)]: { depth: 14, lines: [{ score: { cp: -20 }, pv: ['g7g6', 'h5f3'] }] }, [key(after.fen())]: { depth: 14, lines: [{ score: { mate: 1 }, pv: ['h5f7'] }] } });
  const { result, lines } = await runTool(Chess, engine, checkToolCall(Chess, 'try_move', { fen: QH5, move: 'Nf6' }));
  assert.equal(result.best, 'g6');
  assert.equal(result.reply, '4. Qxf7#');
  assert.match(result.verdict, /mistake/);
  assert.deepEqual(lines[0], ['Nf6', 'Qxf7#']);
});

test('threats: the other side\'s best move with the side to move flipped', async () => {
  const flipped = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 3 3';
  const { engine } = fakeEngine({ [key(flipped)]: { depth: 14, lines: [{ score: { mate: 1 }, pv: ['h5f7'] }] } });
  const { result } = await runTool(Chess, engine, checkToolCall(Chess, 'threats', { fen: QH5 }));
  assert.equal(result.side, 'White'); assert.equal(result.threat, 'Qxf7#');
});

test('compare, find_mate and find_motifs', async () => {
  const e4 = new Chess(START); e4.move('e4'); const d4 = new Chess(START); d4.move('d4');
  const { engine } = fakeEngine({ [key(e4.fen())]: { depth: 12, lines: [{ score: { cp: 30 }, pv: ['e7e5'] }] }, [key(d4.fen())]: { depth: 12, lines: [{ score: { cp: 40 }, pv: ['d7d5'] }] },
    [key('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1')]: { depth: 8, lines: [{ score: { mate: 1 }, pv: ['a1a8'] }] } });
  const c = await runTool(Chess, engine, checkToolCall(Chess, 'compare', { fen: START, moves: ['e4', 'd4'] }));
  assert.deepEqual(c.result.moves.map(m => m.move), ['d4', 'e4'], 'best first for the side to move');
  const m = await runTool(Chess, engine, checkToolCall(Chess, 'find_mate', { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', n: 1 }));
  assert.equal(m.result.mate, 1); assert.equal(m.result.line, '1. Ra8#');
  const none = await runTool(Chess, engine, checkToolCall(Chess, 'find_mate', { fen: START, n: 3 }));
  assert.equal(none.result.mate, null);
  const f = await runTool(Chess, engine, checkToolCall(Chess, 'find_motifs', { fen: QH5, line: ['Nf6', 'Qxf7#'] }));
  assert.deepEqual(f.result.line.map(x => x.move), ['Nf6', 'Qxf7#']);
  assert.ok(f.result.line[1].motifs.some(x => /checkmate/.test(x)));
});
