import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { classicGames } from '../../src/library/classics.js';
import { BENCHMARK_CLASSICS } from '../../eval/retrieval/classics-fixture.mjs';
import { auditClassicsSources } from '../../scripts/check-classics.mjs';
import { transcribeDescriptive } from '../../scripts/classics-notation.mjs';
const book = JSON.parse(await readFile(new URL('../../data/classics/capablanca-scores.json', import.meta.url), 'utf8'));
const historical = JSON.parse(await readFile(new URL('../../data/classics/historical-scores.json', import.meta.url), 'utf8'));

test('all 21 game scores bind to published source facts; the twelve complete book tables reconstruct uniquely', () => {
  const result = auditClassicsSources(book, historical);
  assert.equal(result.games, 21); assert.equal(result.studies, 12); assert.equal(result.bookGames, 12);
  assert.equal(book.games.reduce((n, g) => n + g.line.length, 0), 980);
  assert.ok(book.games.every(g => ![3, 6].includes(g.gameNumber)));
  assert.equal(BENCHMARK_CLASSICS.length, 13); // fixed measured corpus, independent of production growth
});

test('changed source notation/rights/revisions or packaged scores fail the offline audit', () => {
  const changes = [
    b => { b.games[0].line[0] = 'e2e4'; },
    b => { b.games[0].sourceMoves[0].text = 'P - K 4'; },
    b => { b.games[0].sourceMoves[0].side = 'b'; },
    b => { b.book.score = 'not supplied'; },
    b => { b.games.pop(); },
  ];
  for (const change of changes) { const copy = structuredClone(book); change(copy); assert.throws(() => auditClassicsSources(copy, historical)); }
  const copy = structuredClone(historical); copy.games[0].source.url = 'https://en.wikipedia.org/wiki/Opera_Game';
  assert.throws(() => auditClassicsSources(book, copy));
  const games = classicGames(); games.find(g => g.id === 'cf-1').pgn = '1. e4 *';
  assert.throws(() => auditClassicsSources(book, historical, games));
});

test('rules check the concrete facts in the original new end-position notes, without proving a resignation result', () => {
  const finals = Object.fromEntries(classicGames().filter(g => g.id.startsWith('cf-')).map(g => { const c = new Chess(); c.loadPgn(g.pgn); return [g.id, c]; }));
  const piece = (id, square, type, color) => assert.deepEqual(finals[id].get(square), { type, color }, `${id} ${square}`);
  piece('cf-1', 'b6', 'q', 'w'); assert.equal(finals['cf-1'].history({ verbose: true }).at(-1).captured, 'r');
  assert.ok(finals['cf-2'].isCheck()); piece('cf-2', 'a2', 'p', 'b');
  assert.ok(finals['cf-4'].isCheck()); assert.ok(finals['cf-4'].isAttacked('e1', 'b')); piece('cf-4', 'e4', 'q', 'b');
  piece('cf-5', 'c5', 'n', 'w'); piece('cf-5', 'a8', 'r', 'w'); piece('cf-5', 'h7', 'r', 'w');
  piece('cf-7', 'g6', 'p', 'w'); piece('cf-7', 'h5', 'p', 'w');
  piece('cf-8', 'b2', 'p', 'b'); piece('cf-8', 'c3', 'r', 'b');
  piece('cf-9', 'g7', 'b', 'w'); piece('cf-9', 'e6', 'b', 'b'); piece('cf-9', 'e3', 'k', 'w');
  piece('cf-10', 'a7', 'p', 'w'); piece('cf-10', 'a5', 'r', 'w'); piece('cf-10', 'f5', 'k', 'w');
  piece('cf-11', 'c6', 'q', 'w'); piece('cf-11', 'c2', 'r', 'w'); piece('cf-11', 'd1', 'r', 'w');
  piece('cf-12', 'f4', 'k', 'w'); piece('cf-12', 'f5', 'q', 'w'); piece('cf-12', 'g7', 'q', 'b');
  piece('cf-13', 'e6', 'b', 'b'); piece('cf-13', 'g7', 'b', 'b'); piece('cf-13', 'f4', 'r', 'b');
  piece('cf-14', 'f4', 'k', 'b'); piece('cf-14', 'h2', 'p', 'b');
  assert.ok(Object.values(finals).every(c => !c.isCheckmate())); // resignation is a source report
});

test('traditional teaching versions disclose uncertainty and separate the played Réti finish from its mate demonstration', () => {
  const games = classicGames(), reti = games.find(g => g.id === 'cl-reti-tartakower'), legal = games.find(g => g.id === 'cl-legal'), c = new Chess();
  c.loadPgn(reti.pgn); const moves = c.history();
  assert.equal(moves[18], 'Bg5+'); assert.equal(moves.length, 21); assert.ok(c.isCheckmate());
  assert.match(reti.pgn, /published game ended here/); assert.match(reti.scoreNote, /teaching continuation/);
  assert.equal(legal.date, '????'); assert.match(legal.scoreNote, /rook odds are disputed/);
});

test('descriptive audit rejects ambiguity, wrong side, impossible checks and oversized/unrecognized input', () => {
  assert.deepEqual(transcribeDescriptive([{ side: 'w', text: 'P - Q 4' }]), ['d2d4']);
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: 'P - B 4' }]), /Ambiguous/);
  assert.throws(() => transcribeDescriptive([{ side: 'b', text: 'P - Q 4' }]));
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: 'P - Q 4 ch' }]));
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: 'P - Q 4 mate' }]));
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: 'Punknown - Q 4' }]));
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: 'P - K 4' }, { side: 'b', text: 'P - Q 4' }, { side: 'w', text: 'P × garbage' }]));
  assert.throws(() => transcribeDescriptive([{ side: 'w', text: '<script>' }]));
  assert.throws(() => transcribeDescriptive(Array(513).fill({ side: 'w', text: 'P - Q 4' })));
});
