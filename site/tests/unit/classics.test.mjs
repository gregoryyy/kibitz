// The built-in classics (TODO 7.3, 3.2.5): every score legal, the mates real, retrieval by theme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CLASSICS, classicGames, retrieveClassics, findGameRefs, keyPosition } from '../../src/library/classics.js';
import { TAG_LABELS } from '../../src/chess/knowledge.js';

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

test('game references: titles and pairings name the classic; openings and people alone do not', () => {
  const ids = t => findGameRefs(t).map(r => r.id);
  assert.deepEqual(ids('Just like the Opera Game: Morphy vs. the Duke.'), ['ex-opera', 'ex-opera']);
  assert.deepEqual(ids('Réti–Tartakower, Vienna 1910, and Reti-Tartakower again'), ['cl-reti-tartakower', 'cl-reti-tartakower']);
  assert.deepEqual(ids('Rubinstein\'s Immortal is not the Immortal Game.'), ['cl-rotlewi-rubinstein', 'ex-immortal']);
  assert.deepEqual(ids('the Game of the Century, the Evergreen Game, Steinitz–von Bardeleben, Lasker v Thomas'), ['cl-century', 'cl-evergreen', 'cl-steinitz-bardeleben', 'cl-lasker-thomas']);
  assert.deepEqual(ids('the Lucena position and the Philidor position, the Saavedra study, Réti\'s king march, Légal\'s mate'), ['st-lucena', 'st-philidor', 'st-saavedra', 'st-reti', 'cl-legal']);
  assert.deepEqual(ids('The Philidor Defence, Lucena and Philidor section, an immortal attack, Morphy\'s style'), []);
  // German answers (TODO 10.8)
  assert.deepEqual(ids('Wie in der Opernpartie (Morphy gegen den Herzog), Rétis Damenopfer und das Seekadettenmatt'), ['ex-opera', 'ex-opera', 'cl-reti-tartakower', 'cl-legal']);
  assert.deepEqual(ids('die Unsterbliche Partie, nicht Rubinsteins Unsterbliche; die Lucena-Stellung und die Philidor-Stellung'), ['ex-immortal', 'cl-rotlewi-rubinstein', 'st-lucena', 'st-philidor']);
  assert.deepEqual(ids('die Philidor-Verteidigung'), []);
  assert.deepEqual(ids('Capablanca-Marshall, St. Petersburg 1914; Marshall–Capablanca, New York 1918'), ['cf-10', 'cf-14']);
  assert.deepEqual(ids('Capablanca and Marshall'), []);
  const [r] = findGameRefs('See the Opera Game.');
  assert.equal('See the Opera Game.'.slice(r.index, r.index + r.length), 'the Opera Game');
  for (const c of CLASSICS) assert.ok(findGameRefs(`about ${c.title}`).some(x => x.id === c.id) || ['cl-reti-tartakower', 'cl-lasker-thomas', 'cl-steinitz-bardeleben'].includes(c.id), `${c.id} is found by its title or a pairing`);
});

test('key position: the game at its key moment, as the library opens it, with the move that led there', () => {
  for (const g of classicGames()) {
    const kp = keyPosition(Chess, g.id);
    const c = new Chess(); c.loadPgn(g.pgn);
    const h = c.history({ verbose: true });
    assert.equal(kp.fen, h[g.moment - 1]?.after ?? c.getHeaders().FEN, g.id);
    assert.deepEqual(kp.lastMove, g.moment ? [h[g.moment - 1].from, h[g.moment - 1].to] : null, g.id);
  }
  assert.equal(keyPosition(Chess, 'ex-opera').label, '10. Nxb5');
  assert.equal(keyPosition(Chess, 'cl-century').label, '17… Be6');
  assert.equal(keyPosition(Chess, 'nope'), null);
});
