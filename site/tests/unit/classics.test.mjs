// The built-in classics (TODO 7.3, 3.2.5): every score legal, the mates real, retrieval by theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CLASSICS, classicGames, retrieveClassics } from '../../src/classics.js';
import { TAG_LABELS } from '../../src/knowledge.js';

test('every classic loads with chess.js, every move legal, the result consistent with the final position', () => {
  for (const g of classicGames()) {
    const c = new Chess();
    assert.doesNotThrow(() => c.loadPgn(g.pgn), g.id);
    const h = c.history();
    assert.ok(h.length > 0, g.id);
    if (h.at(-1).endsWith('#')) {
      assert.ok(c.isCheckmate(), `${g.id} ends in mate`);
      assert.equal(g.result, c.turn() === 'w' ? '0-1' : '1-0', `${g.id}: the mated side lost`);
    }
    const src = CLASSICS.find(x => x.id === g.id);
    assert.ok(src.moment >= 1 && src.moment <= h.length, `${g.id}: the key moment is in the game`);
    for (const t of g.tags) assert.ok(TAG_LABELS[t], `${g.id}: tag ${t} is in TAG_LABELS`);
  }
});

test('the famous finishes are where they should be', () => {
  const last = id => { const c = new Chess(); c.loadPgn(classicGames().find(g => g.id === id).pgn); return c.history().at(-1); };
  assert.equal(last('ex-opera'), 'Rd8#');
  assert.equal(last('ex-immortal'), 'Be7#');
  assert.equal(last('cl-evergreen'), 'Bxe7#');
  assert.equal(last('cl-century'), 'Rc2#');
  assert.equal(last('cl-reti-tartakower'), 'Bd8#');
  assert.equal(last('cl-legal'), 'Nd5#');
  assert.equal(last('cl-lasker-thomas'), 'Kd2#');
  assert.equal(last('st-saavedra'), 'Kb3');
});

test('retrieveClassics: by the position\'s themes, the opening family weighing most', () => {
  const r = retrieveClassics([{ tag: 'caro-kann', weight: 3 }, { tag: 'sacrifice', weight: 1 }]);
  assert.equal(r[0].game.id, 'cl-reti-tartakower');
  assert.equal(r.length, 3);
  const ending = retrieveClassics([{ tag: 'rook-pawn-vs-rook', weight: 3 }], { limit: 5 });
  assert.deepEqual(ending.map(x => x.game.id).sort(), ['st-lucena', 'st-philidor']);
  assert.ok(!retrieveClassics([{ tag: 'open-games', weight: 3 }], { exclude: 'ex-opera', limit: 9 }).some(x => x.game.id === 'ex-opera'));
  assert.deepEqual(retrieveClassics([{ tag: 'hedgehog', weight: 3 }]), []);
});
