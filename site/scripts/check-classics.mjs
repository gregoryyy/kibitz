// Offline evidence audit: no download, provider, engine evaluation or storage write.
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { classicGames } from '../src/library/classics.js';
import { readBounded } from './import-puzzles.mjs';
import { transcribeDescriptive } from './classics-notation.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const requireFact = (ok, message) => { if (!ok) throw new Error(message); };
const validEvidence = record => typeof record?.retrievedAt === 'string' && Number.isFinite(Date.parse(record.retrievedAt)) && /^[a-f0-9]{64}$/.test(record.htmlSha256);

/** Bind saved published score facts to every packaged game, keeping study sources separate. */
export function auditClassicsSources(book, historical, games = classicGames()) {
  requireFact(book?.version === 1 && historical?.version === 1, 'Unsupported classic evidence version.');
  requireFact(Array.isArray(book.games) && book.games.length === 12 && Array.isArray(historical.games) && historical.games.length === 9, 'Incomplete source collection.');
  requireFact(validEvidence(book.book) && book.book.url === 'https://www.gutenberg.org/cache/epub/33870/pg33870-images.html'
    && book.book.catalogue === 'https://www.gutenberg.org/ebooks/33870' && book.book.score === 'Public domain (USA; 1921 score)', 'Invalid book provenance.');
  requireFact(historical.licence === 'CC-BY-SA-4.0' && historical.licenceUrl === 'https://creativecommons.org/licenses/by-sa/4.0/', 'Invalid historical source licence.');
  const current = new Map(games.filter(g => !g.problem).map(g => [g.id, g])), seen = new Set();
  let sourcePlies = 0;
  for (const record of [...book.games, ...historical.games]) {
    requireFact(record && typeof record.id === 'string' && current.has(record.id) && !seen.has(record.id), 'Source identity mismatch.');
    seen.add(record.id); const game = current.get(record.id), c = new Chess(); c.loadPgn(game.pgn);
    const line = c.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    requireFact(Array.isArray(record.line) && record.line.length <= 512 && same(line, record.line), `Source line mismatch: ${record.id}`);
    requireFact(game.provenance.rights.annotations === 'GPL-3.0-or-later', 'Teaching notes need their separate licence.');
    if (record.id.startsWith('cf-')) {
      requireFact(record.id === 'cf-' + record.gameNumber && Number.isInteger(record.page) && record.page >= 159 && record.page <= 246, 'Invalid book locator.');
      requireFact(game.provenance.source.url === book.book.url + '#page' + record.page && game.provenance.source.author === book.book.author
        && game.provenance.rights.score === book.book.score && game.result === record.result, 'Book attribution/result mismatch.');
      requireFact(Array.isArray(record.sourceMoves) && record.sourceMoves.every(m => typeof m.text === 'string' && !/[!?{}]/.test(m.text)), 'Only source move facts belong in the saved tables.');
      requireFact(same(transcribeDescriptive(record.sourceMoves), line), `Descriptive notation mismatch: ${record.id}`);
    } else {
      requireFact(validEvidence(record) && record.licenceUrl === historical.licenceUrl, 'Invalid historical retrieval record.');
      const url = new URL(record.source?.url);
      requireFact(url.protocol === 'https:' && ['en.wikipedia.org', 'de.wikipedia.org'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/w/index.php'
        && /^\d{6,12}$/.test(url.searchParams.get('oldid') || '') && !!url.searchParams.get('title'), 'A fixed published source revision is required.');
      requireFact(record.source.score === historical.licence && same(game.provenance.source, { title: record.source.title, author: record.source.author, url: record.source.url })
        && game.provenance.rights.score === record.source.score, 'Historical attribution mismatch.');
      requireFact(Array.isArray(record.sourceSans) && record.sourceSans.length === line.length, 'Missing published notation.');
      const replay = new Chess();
      for (const san of record.sourceSans) { requireFact(typeof san === 'string' && san.length <= 16 && !/[!?{}]/.test(san), 'Only score notation is retained.'); replay.move(san); }
      requireFact(same(replay.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')), line), 'Published notation mismatch.');
      requireFact((record.note || '') === (game.scoreNote || ''), 'A historical/teaching distinction is missing.');
      if (record.id === 'cl-reti-tartakower') requireFact(record.playedPlies === 19 && line.length === 21 && !!record.note, 'Distinguish the resigned game from its teaching continuation.');
      if (record.id === 'cl-legal') requireFact(game.date === '????' && !!record.note, 'Do not present the traditional date/odds as established history.');
    }
    sourcePlies += line.length;
  }
  requireFact(seen.size === current.size && current.size === 21, 'A packaged game has no source evidence.');
  return { games: current.size, bookGames: book.games.length, sourcePlies, studies: games.filter(g => g.problem).length };
}

export async function checkClassics() {
  const book = JSON.parse(await readBounded(fileURLToPath(new URL('../data/classics/capablanca-scores.json', import.meta.url)), 1_000_000));
  const historical = JSON.parse(await readBounded(fileURLToPath(new URL('../data/classics/historical-scores.json', import.meta.url)), 1_000_000));
  const result = auditClassicsSources(book, historical);
  console.log(`${result.games} published game scores (${result.sourcePlies} plies, ${result.bookGames} complete Capablanca games) verified offline; ${result.studies} problem/study records are audited separately.`);
  return result;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await checkClassics();
