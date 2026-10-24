import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { openingName, openingMatches } from '../../src/openings/names-de.js';
import { CLASSICS, classicGames } from '../../src/library/classics.js';
import { DE_CLASSIC_COMMENTS } from '../../src/library/classic-comments-de.js';
import { compileLibraryGame } from '../../src/library/library.js';
import { annotationPassages, buildTextIndex, searchText } from '../../src/library/text-search.js';
import { filterGames } from '../../src/library/search.js';
import { CURATED_PROBLEMS } from '../../src/library/problem-data.js';
import { verifiedProblemEvidence } from '../../src/library/problems.js';
import { tablebaseIndex } from '../../src/curriculum/tablebase.js';
import { TABLEBASE_SNAPSHOTS } from '../../src/curriculum/tablebase-snapshots.js';
import { PROBLEM_TABLEBASES } from '../../src/library/problem-tablebases.js';

const catalogue = [...'abcde'].flatMap(file => readFileSync(new URL(`../../data/eco/${file}.tsv`, import.meta.url), 'utf8').trim().split('\n').slice(1).map(line => line.split('\t')));

test('German labels cover every current family without changing canonical names, ECO codes or legal score data', () => {
  const families = [...new Set(catalogue.map(([, name]) => name.split(/[:,] /)[0]))]; assert.equal(families.length, 141);
  for (const family of families) assert.notEqual(openingName(family, 'de'), family, family);
  for (const [eco, name] of catalogue) { assert.equal(openingName(name), name); assert.equal(openingName(name, 'fr'), name); const label = openingName(name, 'de'); assert.ok(label && label.length < 600); assert.ok(openingMatches(eco, name, eco, 'de')); }
  assert.equal(openingName('Sicilian Defense: Najdorf Variation, English Attack', 'de'), 'Sizilianische Verteidigung: Najdorf-Variante, Englischer Angriff');
  assert.equal(openingName('Benko Gambit Accepted', 'de'), 'Angenommenes Wolga-Gambit');
  assert.equal(openingName("King's Indian Defense: Classical Variation", 'de'), 'Königsindische Verteidigung: Klassische Variante');
  assert.equal(openingName('Hungarian Opening: Reversed Norwegian Defense', 'de'), 'Ungarische Eröffnung: Norwegische Verteidigung (mit vertauschten Farben)');
});

test('opening lookup accepts German/original labels and accents with every-term semantics and bounded unknown input', () => {
  const name = "King's Indian Defense: Sämisch Variation";
  for (const query of ["king's indian", 'königsindisch samisch', 'konigsindisch', 'E80']) assert.ok(openingMatches('E80', name, query, 'de'), query);
  assert.equal(openingMatches('E80', name, 'sizilianisch', 'de'), false); assert.equal(openingMatches('E80', name, '', 'de'), false); assert.equal(openingMatches('E80', name, 'x'.repeat(201), 'de'), false);
  const hostile = 'Private <img src=x> Defense'; assert.equal(openingName(hostile, 'de'), hostile);
  const huge = 'Sicilian Defense: ' + 'Reversed '.repeat(2000); assert.equal(openingName(huge, 'de'), huge); assert.equal(openingName(null, 'de'), '');
  const row = { id: 'a', opening: name, searchOpening: openingName(name, 'de'), eco: 'E80' };
  assert.deepEqual(filterGames([row], { opening: 'Königsindisch' }).games, [row]); assert.deepEqual(filterGames([row], { opening: "King's Indian" }).games, [row]);
});

test('all authored comments have German versions while the 33 records retain exact headers, legal moves, positions, sources and English default', () => {
  const comments = [...new Set(CLASSICS.flatMap(game => [...game.moves.matchAll(/\{([^}]*)\}/g)].map(match => match[1])))]; assert.equal(comments.length, 63);
  for (const comment of comments) { assert.ok(Object.hasOwn(DE_CLASSIC_COMMENTS, comment), comment); const translated = DE_CLASSIC_COMMENTS[comment]; assert.notEqual(translated, comment); assert.ok(!/[{}]/.test(translated)); }
  const english = classicGames(), german = classicGames({ language: 'de' }); assert.equal(german.length, 33);
  for (const [i, record] of german.entries()) {
    const before = new Chess(), after = new Chess(); before.loadPgn(english[i].pgn); after.loadPgn(record.pgn);
    assert.deepEqual(after.history(), before.history(), record.id); assert.equal(after.fen(), before.fen(), record.id); assert.deepEqual(after.getHeaders(), before.getHeaders());
    assert.deepEqual(record.provenance, english[i].provenance); assert.equal(record.id, english[i].id);
    assert.deepEqual(after.getComments().map(item => item.fen), before.getComments().map(item => item.fen));
  }
  assert.deepEqual(classicGames(), english);
});

test('German classic passages keep exact revised PGN locators and become locally searchable without touching imported notes', async () => {
  const english = classicGames().find(game => game.id === 'ex-opera'), german = classicGames({ language: 'de' }).find(game => game.id === english.id);
  const before = await compileLibraryGame(Chess, english, 'classic'), after = await compileLibraryGame(Chess, german, 'classic'); assert.notEqual(after.document.revision, before.document.revision);
  const passages = annotationPassages(after); for (const passage of passages) assert.equal(german.pgn.slice(passage.locator.start, passage.locator.end), passage.text);
  const hits = searchText(buildTextIndex(passages), 'Läuferpaar', { language: 'de' }); assert.equal(hits[0].passage.ply, 6);
  const imported = await compileLibraryGame(Chess, { id: 'copy', pgn: english.pgn }, 'library'); assert.ok(annotationPassages(imported).some(p => p.text.includes('bishop pair'))); assert.ok(!annotationPassages(imported).some(p => p.text.includes('Läuferpaar')));
  assert.ok(after.annotations.every(a => a.verification === 'unverified'));
});

test('translated problem annotations retain only their exact recorded chess evidence and imports gain no certificate', async () => {
  const lookup = tablebaseIndex(Chess, [...TABLEBASE_SNAPSHOTS, ...PROBLEM_TABLEBASES]), german = classicGames({ language: 'de' });
  for (const definition of CURATED_PROBLEMS) {
    const record = german.find(g => g.id === definition.id), snapshot = await compileLibraryGame(Chess, record, 'classic');
    assert.equal(verifiedProblemEvidence(Chess, snapshot, definition, lookup).outcome, definition.outcome);
    assert.equal(verifiedProblemEvidence(Chess, await compileLibraryGame(Chess, record, 'library'), definition, lookup), null);
  }
});
