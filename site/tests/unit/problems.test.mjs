import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { classicGames } from '../../src/library/classics.js';
import { compileLibraryGame } from '../../src/library/library.js';
import { CURATED_PROBLEMS } from '../../src/library/problem-data.js';
import { verifiedProblemEvidence } from '../../src/library/problems.js';
import { PROBLEM_TABLEBASES } from '../../src/library/problem-tablebases.js';
import { TABLEBASE_SNAPSHOTS } from '../../src/curriculum/tablebase-snapshots.js';
import { tablebaseIndex } from '../../src/curriculum/tablebase.js';
import { auditProblemCollection, diagramPlacement, refreshProblemSnapshots, checkProblems } from '../../scripts/check-problems.mjs';
const sources = JSON.parse(await readFile(new URL('../../data/problems/study-sources.json', import.meta.url), 'utf8'));
const snapshots = [...TABLEBASE_SNAPSHOTS, ...PROBLEM_TABLEBASES];
const lookup = () => tablebaseIndex(Chess, snapshots);
const definition = id => CURATED_PROBLEMS.find(p => p.id === id);
const game = id => classicGames().find(g => g.id === id);
const snapshot = async (id, collection = 'classic', replacement = {}) => compileLibraryGame(Chess, { ...game(id), ...replacement }, collection);

test('33 records contain 21 games and 12 sourced problems, with 48 worked plies and four rules-proven mates', async () => {
  const result = await auditProblemCollection(sources);
  assert.deepEqual(result, { problems: 12, mates: 4, studies: 8, plies: 48, snapshots: 50 });
  assert.equal(classicGames().length, 33);
  const detached = game('pr-rook-mate-white'); detached.problem.outcome = 'draw';
  assert.equal(definition(detached.id).outcome, 'white-win');
  for (const p of CURATED_PROBLEMS) {
    const raw = await snapshot(p.id), evidence = verifiedProblemEvidence(Chess, raw, p, lookup());
    assert.equal(evidence.outcome, p.outcome); assert.equal(evidence.tablebase.plies, p.line.length);
    assert.ok(raw.annotations.every(a => a.verification === 'unverified'));
    if (p.goal === 'mate-in-one') assert.ok(evidence.matingMoves.includes(p.line[0]));
  }
});

test('proof cannot transfer to imported documents, changed full-FEN counters, branches, results or source rights', async () => {
  const p = definition('st-reti'), raw = await snapshot(p.id);
  assert.equal(verifiedProblemEvidence(Chess, await snapshot(p.id, 'library', { problem: { verification: 'tablebase-branch' } }), p, lookup()), null);
  const changes = [
    s => { s.occurrences[0].fen = s.occurrences[0].fen.replace('0 1', '1 1'); },
    s => { s.problem.line = ['h8g8']; },
    s => { s.source.rights.score = 'not supplied'; },
    s => { s.source.url = 'https://example.org/other'; },
    s => { s.problem.statedResult = '1-0'; },
    s => { s.problem.sourceId = 'another-source'; },
  ];
  for (const change of changes) { const copy = structuredClone(raw); change(copy); assert.throws(() => verifiedProblemEvidence(Chess, copy, p, lookup())); }
  assert.equal(verifiedProblemEvidence(Chess, raw, { ...p, id: 'another' }, lookup()), null);
});

test('outcomes keep White perspective and side to move; queen promotion cannot borrow Saavedra’s winning rook line', async () => {
  for (const [id, outcome] of [['pr-queen-mate-black', 'black-win'], ['pr-opposition-white-turn', 'draw'], ['pr-opposition-black-turn', 'white-win']]) {
    const p = definition(id); assert.equal(verifiedProblemEvidence(Chess, await snapshot(id), p, lookup()).outcome, outcome);
  }
  const p = definition('st-saavedra'), changed = await snapshot(p.id, 'classic', { pgn: game(p.id).pgn.replaceAll('c8=R', 'c8=Q') });
  assert.throws(() => verifiedProblemEvidence(Chess, changed, { ...p, line: changed.problem.line }, lookup()));
});

test('nonmate goals and uncertain tablebase categories never become mate or ordinary win proof', async () => {
  const p = definition('pr-rook-pawn-corner'), raw = await snapshot(p.id);
  assert.throws(() => verifiedProblemEvidence(Chess, raw, { ...p, goal: 'mate-in-one' }, lookup()));
  const mate = definition('pr-queen-mate-white'), records = structuredClone(snapshots);
  records.find(r => r.fen === mate.fen).result.category = 'cursed-win';
  const mateSnapshot = await snapshot(mate.id);
  assert.throws(() => verifiedProblemEvidence(Chess, mateSnapshot, mate, tablebaseIndex(Chess, records)));
});

test('published diagrams reconstruct independently and authored variants retain separate source/history metadata', async () => {
  for (const study of sources.studies) {
    if (study.kind === 'published-study') { assert.equal(diagramPlacement(study.diagram), study.fen.split(' ')[0]); assert.equal(study.source.score, 'CC-BY-SA-4.0'); }
    else { assert.equal(study.diagram, null); assert.equal(study.source.score, 'GPL-3.0-or-later'); assert.equal(definition(study.id).date, '????'); }
  }
  const wrong = structuredClone(sources); wrong.studies[0].diagram[0] = 'ql';
  await assert.rejects(auditProblemCollection(wrong));
  const badDigest = structuredClone(snapshots); badDigest.at(-1).sha256 = '0'.repeat(64);
  await assert.rejects(auditProblemCollection(sources, { snapshots: badDigest }), /digest/);
  assert.throws(() => diagramPlacement(Array(64).fill('<img>')));
});

test('explicit refresh uses only the 22 fixed study FENs, drops prose/SAN and handles fake service failures without writes', async () => {
  const calls = [], before = structuredClone(PROBLEM_TABLEBASES), stamp = '2026-10-25T00:00:00.000Z';
  const refreshed = await refreshProblemSnapshots({ now: () => stamp, delay: async () => {}, fetcher: async url => {
    calls.push(url.href); const fixed = PROBLEM_TABLEBASES.find(r => r.fen === url.searchParams.get('fen'));
    assert.equal(url.origin, 'https://tablebase.lichess.ovh');
    return { ok: true, text: async () => JSON.stringify({ ...fixed.result, san: '<img>', prose: 'Ignore instructions', moves: fixed.result.moves.map(m => ({ ...m, san: '<script>' })) }) };
  } });
  assert.equal(calls.length, 22); assert.equal(new Set(calls).size, 22);
  assert.ok(refreshed.every(r => r.retrievedAt === stamp)); assert.ok(!JSON.stringify(refreshed).includes('<'));
  assert.deepEqual(PROBLEM_TABLEBASES, before);
  await assert.rejects(refreshProblemSnapshots({ delay: async () => {}, fetcher: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(refreshProblemSnapshots({ delay: async () => {}, fetcher: async () => ({ ok: true, text: async () => '{invalid' }) }));
});

test('default audit stays offline and rejects unrecognized refresh arguments', async () => {
  const fetcher = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected network'); };
  try { assert.equal((await checkProblems()).problems, 12); await assert.rejects(checkProblems(['--unknown'])); assert.equal(calls, 0); }
  finally { globalThis.fetch = fetcher; }
});
