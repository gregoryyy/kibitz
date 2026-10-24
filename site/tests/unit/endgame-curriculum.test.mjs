import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum, curriculumModules } from '../../src/curriculum/curriculum.js';
import { TABLEBASE_SNAPSHOTS } from '../../src/curriculum/tablebase-snapshots.js';
import { tablebaseKey, tablebaseOutcome, validateTablebaseSnapshot, tablebaseIndex, verifyTablebaseLine } from '../../src/curriculum/tablebase.js';
import { checkEndgames, digest } from '../../scripts/check-endgames.mjs';

const endgames = () => compileCurriculum(Chess, CURRICULUM).modules.find(m => m.id === 'endgames');
const exercise = id => endgames().lessons.flatMap(l => l.exercises).find(e => e.id === id);

test('six bilingual endgame lessons have rules-checked and tablebase-checked examples for both colours', () => {
  const module = endgames();
  assert.deepEqual(module.lessons.map(l => l.id), ['queen-and-king-mate', 'rook-and-king-mate', 'king-and-pawn', 'opposition', 'lucena-bridge', 'philidor-defence']);
  assert.equal(module.lessons.flatMap(l => l.exercises).length, 10);
  let plies = 0;
  for (const lesson of module.lessons) for (const e of lesson.exercises) {
    assert.ok(e.prompt.en && e.prompt.de && e.rubric[0].en && e.rubric[0].de);
    assert.match(e.tablebase.url, /^https:\/\/tablebase\.lichess\.ovh\/standard\?fen=/);
    assert.ok(Number.isFinite(Date.parse(e.tablebase.checkedAt)));
    assert.equal(e.tablebase.plies, e.line.length); plies += e.line.length;
    if (e.goal === 'mate') {
      const c = new Chess(e.fen);
      for (const u of e.line) c.move({ from: u.slice(0, 2), to: u.slice(2, 4) });
      assert.equal(c.isCheckmate(), true);
    }
  }
  assert.equal(plies, 28);
  assert.equal(exercise('queen-mate-black').tablebase.outcome, 'black-win');
  assert.equal(exercise('rook-mate-white').tablebase.outcome, 'white-win');
  assert.equal(curriculumModules(compileCurriculum(Chess, CURRICULUM), { module: 'endgames', level: 2 })[0].lessons.length, 4);
  assert.deepEqual(curriculumModules(compileCurriculum(Chess, CURRICULUM), { theme: 'opposition' })[0].lessons.map(l => l.id), ['opposition']);
});

test('opposition changes with the turn; the blocked rook pawn is drawn and promotion avoids stalemate', () => {
  const white = exercise('opposition-white-turn'), black = exercise('opposition-black-turn');
  assert.equal(white.fen.split(' ')[0], black.fen.split(' ')[0]);
  assert.equal(white.tablebase.outcome, 'draw'); assert.equal(black.tablebase.outcome, 'white-win');
  assert.equal(exercise('rook-pawn-corner').tablebase.outcome, 'draw');
  const c = new Chess(exercise('supported-promotion').fen);
  c.move('e8=Q+'); assert.equal(c.inCheck(), true); assert.equal(c.isStalemate(), false); assert.ok(c.moves().length);
  assert.equal(exercise('lucena-worked-bridge').tablebase.plies, 13);
  assert.equal(exercise('philidor-worked-defence').tablebase.plies, 7);
});

test('API child categories use the next side to move; uncertain and fifty-move categories remain unverified', () => {
  assert.equal(tablebaseOutcome('win', 'w'), 'white-win'); assert.equal(tablebaseOutcome('loss', 'b'), 'white-win');
  assert.equal(tablebaseOutcome('win', 'b'), 'black-win'); assert.equal(tablebaseOutcome('loss', 'w'), 'black-win');
  assert.equal(tablebaseOutcome('draw', 'b'), 'draw'); assert.equal(tablebaseOutcome('draw', '?'), null);
  for (const category of ['cursed-win', 'blessed-loss', 'unknown', 'syzygy-win', 'syzygy-loss', 'maybe-win', 'maybe-loss']) {
    assert.equal(tablebaseOutcome(category, 'w'), null);
    const records = structuredClone(TABLEBASE_SNAPSHOTS);
    records[0].result.category = category;
    assert.throws(() => compileCurriculum(Chess, CURRICULUM, { tablebases: records }), /outcome/);
  }
  const e = exercise('queen-mate-white'), records = structuredClone(TABLEBASE_SNAPSHOTS);
  records[0].result.moves.find(m => m.uci === e.line[0]).category = 'win';
  assert.throws(() => verifyTablebaseLine(Chess, e, tablebaseIndex(Chess, records)), /changes the outcome/);
});

test('evidence requires exact full FEN, available snapshots and an outcome-preserving legal branch', () => {
  const e = exercise('queen-mate-white'), lookup = tablebaseIndex(Chess, TABLEBASE_SNAPSHOTS);
  assert.equal(tablebaseKey(Chess, e.fen), e.fen);
  for (const fen of [e.fen.replace(' 0 1', ' 98 1'), e.fen.replace(' 0 1', ' 0 2')]) {
    assert.notEqual(tablebaseKey(Chess, fen), e.fen);
    assert.throws(() => verifyTablebaseLine(Chess, { ...e, fen }, lookup), /missing exact-position/);
  }
  assert.throws(() => tablebaseKey(Chess, e.fen.split(' ').slice(0, 4).join(' ')), /full FEN/);
  assert.throws(() => tablebaseKey(Chess, '4k3/8/8/8/8/8/8/4K2R w K - 0 1'), /castling/);
  assert.throws(() => tablebaseKey(Chess, new Chess().fen().replace('KQkq', '-')), /seven pieces/);
  assert.throws(() => tablebaseKey(Chess, '8/8/8/8/8/8/4k3/4K3 w - - 0 1'), /legal position/);
  assert.throws(() => compileCurriculum(Chess, CURRICULUM, { tablebases: [] }), /missing exact-position/);
  assert.throws(() => tablebaseIndex(Chess, [TABLEBASE_SNAPSHOTS[0], TABLEBASE_SNAPSHOTS[0]]), /duplicate/);
  // Qf7 is legal but stalemates the bare black king; a source line cannot call it a win.
  assert.throws(() => verifyTablebaseLine(Chess, { ...e, line: ['g6f7'] }, lookup), /changes the outcome/);
  const data = structuredClone(CURRICULUM);
  data.modules.find(m => m.id === 'endgames').lessons[0].exercises[0].tablebase.outcome = 'draw';
  assert.throws(() => compileCurriculum(Chess, data), /outcome/);
});

test('snapshot validation rejects malformed distances, provenance, omitted/duplicate/illegal moves and false terminal facts', () => {
  const reject = (change, pattern) => {
    const record = structuredClone(TABLEBASE_SNAPSHOTS[0]); change(record);
    assert.throws(() => validateTablebaseSnapshot(Chess, record), pattern);
  };
  reject(r => { r.result.dtz = NaN; }, /root facts/);
  reject(r => { r.result.dtm = '1'; }, /root facts/);
  reject(r => { r.result.category = 'winning'; }, /root facts/);
  reject(r => { r.result.moves.pop(); }, /complete legal/);
  reject(r => { r.result.moves[1] = r.result.moves[0]; }, /legal move facts/);
  reject(r => { r.result.moves[0].uci = 'a1a8'; }, /legal move facts/);
  reject(r => { r.result.moves[0].checkmate = false; }, /terminal move facts/);
  reject(r => { r.result.moves[0].dtz = Infinity; }, /legal move facts/);
  reject(r => { r.url = 'https://example.com/'; }, /source URL/);
  reject(r => { r.retrievedAt = 'yesterday'; }, /source URL\/date/);
  reject(r => { r.sha256 = 'bad'; }, /digest/);
  const record = structuredClone(TABLEBASE_SNAPSHOTS[0]);
  record.result.moves[0].san = '<img src=x onerror=alert(1)>';
  assert.doesNotThrow(() => validateTablebaseSnapshot(Chess, record)); // response prose is ignored
});

test('checked-in numerical evidence has reproducible digests and the audit runs without network access', async () => {
  for (const record of TABLEBASE_SNAPSHOTS) assert.equal(digest(record.result), record.sha256);
  const saved = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('offline audit must not fetch'); };
  try { await checkEndgames([]); } finally { globalThis.fetch = saved; }
});
