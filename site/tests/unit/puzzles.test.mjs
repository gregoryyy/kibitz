import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Chess } from 'chess.js';
import { parsePuzzleCsv, compilePuzzle, puzzleExerciseId, PUZZLE_FIELDS, PUZZLE_LIMITS } from '../../src/curriculum/puzzles.js';
import { PUZZLES, PUZZLE_SOURCE } from '../../src/curriculum/puzzle-data.js';
import { CURRICULUM } from '../../src/curriculum/catalogue.js';
import { compileCurriculum, curriculumModules } from '../../src/curriculum/curriculum.js';
import { compilePuzzleData, importPuzzles } from '../../scripts/import-puzzles.mjs';

const csv = await fs.readFile(new URL('../../data/puzzles/lichess-starter.csv', import.meta.url), 'utf8');
const manifest = JSON.parse(await fs.readFile(new URL('../../data/puzzles/lichess-starter.json', import.meta.url), 'utf8'));
const rows = csv.trimEnd().split('\n');
const sample = values => PUZZLE_FIELDS.join(',') + '\n' + values.join(',') + '\n';
const row = () => rows[1].split(',');
const fixture = (fen, moves, themes = 'endgame') => sample(['abc12', fen, moves, '1000', '80', '90', '100', themes, 'https://lichess.org/Abc12345#1', '', '']);

test('the recorded 64-row CC0 export deterministically regenerates every bundled record and manifest', async () => {
  assert.equal(PUZZLE_SOURCE.licence, 'CC0-1.0'); assert.equal(PUZZLE_SOURCE.sha256, manifest.sha256);
  const parsed = parsePuzzleCsv(Chess, csv);
  assert.equal(parsed.length, 64); assert.deepEqual(parsed, PUZZLES);
  assert.equal(compilePuzzleData(csv, manifest).output, await fs.readFile(new URL('../../src/curriculum/puzzle-data.js', import.meta.url), 'utf8'));
  const saved = globalThis.fetch; globalThis.fetch = () => { throw new Error('offline importer must not fetch'); };
  try { await importPuzzles(['--check']); } finally { globalThis.fetch = saved; }
  assert.throws(() => compilePuzzleData(csv + '\n', manifest), /digest/);
  assert.throws(() => compilePuzzleData(csv, { ...manifest, rows: 63 }), /row count/);
  assert.throws(() => compilePuzzleData(csv, { ...manifest, licence: 'unknown' }), /manifest/);
});

test('the learner starts AFTER the first opponent move, preserving turn, counters, setup SAN and the source FEN', () => {
  const p = PUZZLES[0], source = new Chess(p.sourceFen);
  assert.equal(source.turn(), 'b'); assert.equal(p.setup, 'f2g3');
  source.move({ from: 'f2', to: 'g3' });
  assert.equal(p.fen, source.fen()); assert.equal(p.fen.split(' ')[1], 'w'); assert.match(p.fen, / 0 25$/);
  assert.equal(p.setupSan, 'Bxg3'); assert.deepEqual(p.line, p.moves.slice(1)); assert.equal(p.line[0], 'e6e7');
  assert.equal(p.gameUrl, 'https://lichess.org/787zsVup/black#48');
  assert.equal(p.url, 'https://lichess.org/training/00008');
  for (const puzzle of PUZZLES) {
    const c = new Chess(puzzle.fen), learner = c.turn();
    for (const u of puzzle.line) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (puzzle.themes.includes('mate')) { assert.equal(c.isCheckmate(), true); assert.notEqual(c.turn(), learner); }
  }
});

test('setup/solutions preserve legal en passant, castling and explicit underpromotion', () => {
  const ep = parsePuzzleCsv(Chess, fixture('7k/3p4/8/4P3/8/8/8/7K b - - 0 1', 'd7d5 e5d6'))[0];
  assert.equal(ep.fen.split(' ')[3], 'd6'); assert.deepEqual(ep.sans, ['exd6']);
  const castle = parsePuzzleCsv(Chess, fixture('4k3/8/8/8/8/8/8/4K2R b K - 0 1', 'e8d7 e1g1'))[0];
  assert.deepEqual(castle.sans, ['O-O']);
  const promote = parsePuzzleCsv(Chess, fixture('7k/P7/8/8/8/8/8/6K1 b - - 0 1', 'h8g7 a7a8n', 'promotion'))[0];
  assert.deepEqual(promote.line, ['a7a8n']); assert.deepEqual(promote.sans, ['a8=N']);
  const mate = parsePuzzleCsv(Chess, fixture('8/7k/5KQ1/8/8/8/8/8 b - - 0 1', 'h7h8 g6g7', 'mate mateIn1'))[0];
  assert.deepEqual(mate.sans, ['Qg7#']);
});

test('CSV accepts quoting, BOM, CRLF and legacy ten-column records; malformed schemas and rows fail closed', () => {
  const values = row(), quoted = values.map(v => '"' + v.replaceAll('"', '""') + '"');
  assert.deepEqual(parsePuzzleCsv(Chess, '\uFEFF' + sample(quoted).replaceAll('\n', '\r\n')), [PUZZLES[0]]);
  const legacy = PUZZLE_FIELDS.slice(0, 10).join(',') + '\n' + values.slice(0, 10).join(',');
  assert.equal(parsePuzzleCsv(Chess, legacy)[0].dailyDate, null);
  for (const input of ['x,y\n1,2', PUZZLE_FIELDS.join(','), sample(values.slice(0, 10)), sample([...values, 'extra']), rows[0] + '\n"unclosed', sample(values).replace('00008,', '"00008"x,')]) {
    assert.throws(() => parsePuzzleCsv(Chess, input), /Invalid puzzle data/);
  }
  assert.throws(() => parsePuzzleCsv(Chess, rows.slice(0, 2).join('\n') + '\n' + rows[1]), /duplicate/);
  assert.throws(() => parsePuzzleCsv(Chess, 'x'.repeat(PUZZLE_LIMITS.bytes + 1)), /size/);
  assert.throws(() => parsePuzzleCsv(Chess, rows[0] + '\n' + (rows[1] + '\n').repeat(PUZZLE_LIMITS.records + 1)), /record limit/);
  const doubled = row(); doubled[7] = 'fork fork'; assert.throws(() => parsePuzzleCsv(Chess, sample(doubled)), /tokens/);
});

test('bad numeric metadata, unsafe URLs, illegal diagrams/lines and unsupported mate claims are rejected', () => {
  const reject = (index, value, reason) => { const values = row(); values[index] = value; assert.throws(() => parsePuzzleCsv(Chess, sample(values)), reason); };
  for (const [index, value] of [[3, 'NaN'], [3, '1000.5'], [4, '-1'], [5, '101'], [6, '9007199254740993'], [10, 'tomorrow']]) reject(index, value, /metadata|date/);
  for (const url of ['javascript:alert(1)', 'https://lichess.org.evil.test/Abc12345#1', 'https://user@lichess.org/Abc12345#1', 'https://lichess.org/Abc12345?secret=x#1']) reject(8, url, /URL/);
  reject(1, 'bad FEN', /FEN/); reject(1, '8/8/8/8/8/8/4k3/4K3 b - - 0 1', /source position/);
  reject(2, 'f2g3 a1a8', /illegal line/); reject(2, 'f2g3', /UCI line/); reject(2, 'f2g3 a7a8', /illegal line/);
  reject(7, '<img src=x>', /tokens/); reject(7, 'mate', /mate theme/); reject(7, 'mateIn1', /mate theme|mate-in-one/); reject(7, 'mateIn2', /mate theme/);
  const input = structuredClone(PUZZLES[0]); input.sourceFen = input.sourceFen.replace(' b - - ', ' b k - ');
  assert.throws(() => compilePuzzle(Chess, input), /source FEN/); // no rook on h8 to justify k
  input.sourceFen = PUZZLES[0].sourceFen; input.moves[0] += '\n'; assert.throws(() => compilePuzzle(Chess, input), /UCI line/);
});

test('source themes stay distinct from motif proof and case-sensitive IDs remain collision-free', () => {
  const input = structuredClone(PUZZLES[0]); input.themes = ['futureTheme', 'constructor', 'toString', 'fork'];
  input.openings = ['Réti_Opening'];
  const p = compilePuzzle(Chess, input); assert.deepEqual(p.themes, input.themes); assert.deepEqual(p.tags, ['calculation', 'fork']);
  assert.deepEqual(p.openings, ['Réti_Opening']);
  assert.notEqual(puzzleExerciseId('abc12'), puzzleExerciseId('Abc12'));
  assert.match(puzzleExerciseId('Abc12'), /^[a-z][a-z0-9-]+$/);
  input.url = 'javascript:alert(1)'; input.fen = 'bad'; input.sans = ['<img>']; input.licence = 'unknown';
  const normalized = compilePuzzle(Chess, input);
  assert.equal(normalized.url, PUZZLES[0].url); assert.equal(normalized.fen, PUZZLES[0].fen); assert.equal(normalized.licence, 'CC0-1.0');
  assert.equal(normalized.sans[0], 'Rxe7');
});

test('catalogue binds puzzle IDs, themes, source-derived FEN and solution; rating bands only organize browsing', () => {
  const data = compileCurriculum(Chess, CURRICULUM), module = data.modules.find(m => m.id === 'lichess-puzzles');
  assert.deepEqual(module.lessons.map(l => l.exercises.length), [20, 27, 13, 4]);
  assert.equal(curriculumModules(data, { module: module.id, level: 2 })[0].lessons.flatMap(l => l.exercises).length, 47);
  const forks = curriculumModules(data, { module: module.id, theme: 'fork' })[0].lessons.flatMap(l => l.exercises);
  assert.equal(forks.length, 7); assert.ok(forks.every(e => e.puzzle.themes.includes('fork') && !e.pattern));
  const invalid = change => {
    const copy = structuredClone(CURRICULUM), e = copy.modules.find(m => m.id === module.id).lessons.flatMap(l => l.exercises).find(e => e.goal === 'reflection' && e.tags.length > 1 && e.line.length > 1);
    change(e); assert.throws(() => compileCurriculum(Chess, copy), /puzzle position\/line binding|puzzle themes/);
  };
  invalid(e => { e.id = 'wrong-puzzle'; }); invalid(e => { e.line = e.line.slice(0, 1); });
  invalid(e => { e.fen = e.fen.replace(/ \d+ \d+$/, ' 1 99'); }); invalid(e => { e.tags = ['calculation']; });
});
