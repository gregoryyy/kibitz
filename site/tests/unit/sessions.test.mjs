import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { gameCheckpoint } from '../../src/sessions.js';

/** Use legal lines so the transposition case really has an identical final FEN. */
function game(sans = []) {
  const c = new Chess(), start = c.fen(), nodes = [{ fen: start }];
  for (const san of sans) { c.move(san); nodes.push({ fen: c.fen() }); }
  return { gameId: 'game-a', start, userColor: 'w', cursor: nodes.length - 1, nodes, over: null };
}

test('study checkpoints follow full history, viewed step, game identity and result', () => {
  const first = game(['Nf3', 'Nf6', 'Nc3', 'Nc6']);
  const transposed = game(['Nc3', 'Nc6', 'Nf3', 'Nf6']);
  assert.equal(first.nodes.at(-1).fen, transposed.nodes.at(-1).fen);
  assert.notEqual(gameCheckpoint(first), gameCheckpoint(transposed));
  for (const change of [
    { gameId: 'game-b' }, { cursor: 2 }, { userColor: 'b' },
    { start: first.nodes[1].fen }, { nodes: first.nodes.slice(0, -1) },
    { over: { result: '0-1', reason: 'resignation' } },
  ]) assert.notEqual(gameCheckpoint(first), gameCheckpoint({ ...first, ...change }));
});

test('clock ticks and analysis results keep the checkpoint; changing a snapshot cannot change its key', () => {
  const live = game(['e4', 'e5']), key = gameCheckpoint(live);
  const snapshot = structuredClone(live);
  Object.assign(snapshot, { orientation: 'black', clock: { w: 5000, b: 10000 }, reviewDone: true });
  Object.assign(snapshot.nodes[1], { cls: 'best', eval: 34, clk: { w: 10000, b: 10000 } });
  assert.equal(gameCheckpoint(snapshot), key);
  snapshot.nodes.pop();
  assert.notEqual(gameCheckpoint(snapshot), key);
  assert.equal(gameCheckpoint(live), key);
});
