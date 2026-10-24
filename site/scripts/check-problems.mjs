// Offline by default. Explicit --refresh queries only 22 fixed published study positions.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { classicGames } from '../src/library/classics.js';
import { compileLibraryGame } from '../src/library/library.js';
import { CURATED_PROBLEMS } from '../src/library/problem-data.js';
import { verifiedProblemEvidence } from '../src/library/problems.js';
import { PROBLEM_TABLEBASES } from '../src/library/problem-tablebases.js';
import { TABLEBASE_SNAPSHOTS } from '../src/curriculum/tablebase-snapshots.js';
import { tablebaseIndex, validateTablebaseSnapshot } from '../src/curriculum/tablebase.js';
import { TAG_LABELS } from '../src/chess/knowledge.js';
import { CURRICULUM } from '../src/curriculum/catalogue.js';
import { compileCurriculum } from '../src/curriculum/curriculum.js';
import { readBounded } from './import-puzzles.mjs';
import { digest, savedResult } from './check-endgames.mjs';

const requireFact = (ok, message) => { if (!ok) throw new Error('Invalid problem collection: ' + message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const metadataFile = new URL('../data/problems/study-sources.json', import.meta.url);
const target = new URL('../src/library/problem-tablebases.js', import.meta.url);

/** Reconstruct a published diagram's piece placement from the recorded 64 source cells. */
export function diagramPlacement(cells) {
  requireFact(Array.isArray(cells) && cells.length === 64, '64 published diagram cells');
  const ranks = [];
  for (let row = 0; row < 8; row++) {
    let rank = '', empty = 0;
    for (const cell of cells.slice(row * 8, row * 8 + 8)) {
      requireFact(typeof cell === 'string' && (cell === '' || /^[kqrbnp][ld]$/.test(cell)), 'published piece code');
      if (!cell) { empty++; continue; }
      if (empty) { rank += empty; empty = 0; }
      rank += cell[1] === 'l' ? cell[0].toUpperCase() : cell[0];
    }
    if (empty) rank += empty; ranks.push(rank);
  }
  return ranks.join('/');
}

/** Validate every authored/published source and its separate rule/tablebase evidence. */
export async function auditProblemCollection(sources, { definitions = CURATED_PROBLEMS, snapshots = [...TABLEBASE_SNAPSHOTS, ...PROBLEM_TABLEBASES], games = classicGames() } = {}) {
  requireFact(sources?.version === 1 && Array.isArray(sources.studies) && sources.studies.length === 4, 'source version/count');
  requireFact(Array.isArray(definitions) && definitions.length === 12 && new Set(definitions.map(p => p.id)).size === definitions.length, 'twelve unique problems');
  for (const record of snapshots) {
    validateTablebaseSnapshot(Chess, record);
    requireFact(digest(record.result) === record.sha256, 'numerical snapshot digest');
  }
  const lookup = tablebaseIndex(Chess, snapshots), course = compileCurriculum(Chess, CURRICULUM);
  const exercises = new Map(course.modules.flatMap(m => m.lessons.flatMap(l => l.exercises.map(e => [e.id, e]))));
  const sourceIds = new Set();
  for (const study of sources.studies) {
    requireFact(study && !sourceIds.has(study.id), 'unique study source'); sourceIds.add(study.id);
    const definition = definitions.find(p => p.id === study.id), reference = study.reference;
    requireFact(definition && same(study.fen, definition.fen) && same(study.line, definition.line) && same(study.source, definition.source)
      && study.outcome === definition.outcome && same(reference, definition.reference), 'study source binding');
    const url = new URL(reference.url);
    requireFact(url.protocol === 'https:' && url.hostname === 'en.wikipedia.org' && !url.username && !url.password && url.pathname === '/w/index.php' && /^\d{6,12}$/.test(url.searchParams.get('oldid') || '')
      && !!url.searchParams.get('title') && reference.licence === 'CC-BY-SA-4.0' && reference.licenceUrl === 'https://creativecommons.org/licenses/by-sa/4.0/'
      && Number.isFinite(Date.parse(reference.retrievedAt)) && /^[a-f0-9]{64}$/.test(reference.htmlSha256), 'fixed reference/rights');
    if (study.kind === 'published-study') {
      requireFact(['st-reti', 'st-saavedra'].includes(study.id) && study.source.score === 'CC-BY-SA-4.0' && study.source.url === reference.url, 'published diagram attribution');
      requireFact(diagramPlacement(study.diagram) === study.fen.split(' ')[0] && study.diagramTurn === study.fen.split(' ')[1], 'published diagram/turn');
    } else {
      requireFact(study.kind === 'authored-teaching-variant' && ['st-lucena', 'st-philidor'].includes(study.id) && study.diagram === null
        && study.source.score === 'GPL-3.0-or-later' && study.note === definition.scoreNote && definition.date === '????', 'authored variant attribution/history');
    }
  }
  let mates = 0, plies = 0;
  for (const definition of definitions) {
    requireFact(/^[a-z][a-z0-9-]{0,79}$/.test(definition.id) && ['title', 'prompt'].every(key => ['en', 'de'].every(lang => typeof definition[key]?.[lang] === 'string' && definition[key][lang].trim().length > 0 && definition[key][lang].length <= 2000))
      && Number.isInteger(definition.level) && definition.level >= 1 && definition.level <= 4 && definition.tags.length > 0 && definition.tags.every(tag => Object.hasOwn(TAG_LABELS, tag)), 'bounded bilingual teaching metadata');
    const game = games.find(g => g.id === definition.id);
    requireFact(game && game.problem, 'packaged problem');
    const snapshot = await compileLibraryGame(Chess, game, 'classic'), evidence = verifiedProblemEvidence(Chess, snapshot, definition, lookup);
    requireFact(evidence && snapshot.annotations.every(a => a.verification === 'unverified'), 'separate chess/prose verification');
    if (definition.exerciseId) {
      const exercise = exercises.get(definition.exerciseId);
      requireFact(exercise && exercise.fen === definition.fen && same(exercise.line, definition.line) && exercise.tablebase?.outcome === definition.outcome && definition.source.score === course.source.licence, 'authored curriculum source binding');
    } else requireFact(sourceIds.has(definition.id), 'missing study source');
    if (evidence.goal === 'mate-in-one') mates++;
    plies += definition.line.length;
  }
  requireFact(games.filter(g => g.problem).length === definitions.length && mates === 4, 'catalogue coverage');
  return { problems: definitions.length, mates, studies: definitions.length - mates, plies, snapshots: snapshots.length };
}

/** Refresh only the fixed recorded Réti/Saavedra FENs; callers can inject fake clients for tests. */
export async function refreshProblemSnapshots({ fetcher = fetch, now = () => new Date().toISOString(), delay = () => new Promise(resolve => setTimeout(resolve, 1000)) } = {}) {
  const records = [];
  for (const fixed of PROBLEM_TABLEBASES) {
    validateTablebaseSnapshot(Chess, fixed);
    requireFact(digest(fixed.result) === fixed.sha256, 'fixed snapshot digest');
    const url = new URL('https://tablebase.lichess.ovh/standard'); url.searchParams.set('fen', fixed.fen);
    const response = await fetcher(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Tablebase HTTP ' + response.status);
    const text = await response.text(); requireFact(text.length <= 1_000_000, 'bounded response');
    const result = savedResult(JSON.parse(text));
    records.push(validateTablebaseSnapshot(Chess, { fen: fixed.fen, url: url.href, retrievedAt: now(), sha256: digest(result), result }));
    await delay();
  }
  return records;
}

export async function checkProblems(args = []) {
  if (args.some(arg => arg !== '--refresh')) throw new Error('Usage: node scripts/check-problems.mjs [--refresh]');
  const sources = JSON.parse(await readBounded(fileURLToPath(metadataFile), 100_000));
  const records = args.includes('--refresh') ? await refreshProblemSnapshots() : PROBLEM_TABLEBASES;
  const result = await auditProblemCollection(sources, { snapshots: [...TABLEBASE_SNAPSHOTS, ...records] });
  if (args.includes('--refresh')) {
    const body = '// Generated by scripts/check-problems.mjs --refresh; fixed source study positions only.\n'
      + '// Numerical Syzygy facts only; sha256 covers JSON.stringify(result).\n'
      + '/** @type {import(\'../curriculum/tablebase.js\').TablebaseSnapshot[]} */\nexport const PROBLEM_TABLEBASES = [\n'
      + records.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n];\n';
    const pending = new URL(target.href + '.tmp');
    try { await fs.writeFile(pending, body); await fs.rename(pending, target); }
    finally { await fs.rm(pending, { force: true }); }
  }
  console.log(`${result.problems} curated problems/studies (${result.mates} mates in one, ${result.plies} worked plies) checked against ${result.snapshots} saved snapshots; offline unless --refresh.`);
  return result;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await checkProblems(process.argv.slice(2));
