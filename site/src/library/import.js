// Conservative PGN document identity: formatting can vary; source content cannot disappear.
import { readProvenance } from './library.js';
import { checkPosition } from '../chess/play.js';

/** Bounded batch splitter. Tag-like text inside comments/variations never starts another game. */
export function splitPgnImport(text) {
  if (typeof text !== 'string' || text.length > 5_000_000) return { error: 'Import at most 5 million characters at a time.', games: [] };
  const games = []; let start = 0, i = 0, depth = 0, played = false, ended = false;
  const append = end => { const game = text.slice(start, end).trim(); if (game) games.push(game); start = end; };
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '{') { const end = text.indexOf('}', i + 1); i = end < 0 ? text.length : end + 1; continue; }
    if (ch === ';' || (ch === '%' && (i === 0 || /[\r\n]/.test(text[i - 1])))) {
      const end = text.indexOf('\n', i + 1); i = end < 0 ? text.length : end + 1; continue;
    }
    if (ch === '[') {
      if (!depth && played) { append(i); played = false; ended = false; }
      let quoted = false; i++;
      while (i < text.length) {
        const c = text[i++];
        if (c === '\\' && quoted) { i++; continue; }
        if (c === '"') quoted = !quoted;
        if (c === ']' && !quoted) break;
      }
    } else if (ch === '(' || ch === ')') { depth = Math.max(0, depth + (ch === '(' ? 1 : -1)); i++; }
    else {
      if (!depth && ended) { append(i); played = false; ended = false; }
      const tokenStart = i++;
      while (i < text.length && !/[\s{};()[\]]/.test(text[i])) i++;
      if (!depth) { played = true; ended = ['*', '1-0', '0-1', '1/2-1/2'].includes(text.slice(tokenStart, i)); }
    }
    if (games.length > 500) return { error: 'Import at most 500 games at a time.', games: [] };
  }
  append(text.length);
  if (games.length > 500) return { error: 'Import at most 500 games at a time.', games: [] };
  return { games, error: null };
}

/** Preserve comments, RAVs, glyphs and escape lines; only exterior whitespace/header order varies. */
function documentTokens(pgn) {
  const headers = [], tokens = [];
  let i = 0, depth = 0, started = false;
  while (i < pgn.length) {
    const ch = pgn[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '[') {
      const start = i++; let quoted = false, closed = false;
      while (i < pgn.length) {
        const c = pgn[i++];
        if (c === '\\' && quoted) { i++; continue; }
        if (c === '"') quoted = !quoted;
        if (c === ']' && !quoted) { closed = true; break; }
      }
      const raw = pgn.slice(start, i), match = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/.exec(raw);
      if (!closed || !match || started) return null;
      headers.push([match[1], match[2]]); continue;
    }
    started = true;
    if (ch === '{') {
      const end = pgn.indexOf('}', i + 1); if (end < 0) return null;
      tokens.push(['comment', pgn.slice(i + 1, end)]); i = end + 1; continue;
    }
    if (ch === ';' || (ch === '%' && (i === 0 || pgn[i - 1] === '\n'))) {
      let end = pgn.indexOf('\n', i + 1); if (end < 0) end = pgn.length;
      tokens.push([ch, pgn.slice(i + 1, end)]); i = end; continue;
    }
    if (ch === '(' || ch === ')') {
      depth += ch === '(' ? 1 : -1; if (depth < 0) return null;
      tokens.push([ch]); i++; continue;
    }
    if (ch === '$') {
      const start = i++; while (/\d/.test(pgn[i] || 'x')) i++;
      tokens.push(['nag', pgn.slice(start, i)]); continue;
    }
    const start = i;
    while (i < pgn.length && !/[\s{};()$[\]]/.test(pgn[i])) i++;
    if (start === i) return null;
    const word = pgn.slice(start, i), number = /^\d+\.+/.exec(word);
    // Mainline numbers are redundant after legal replay; RAV numbers still carry branch meaning.
    if (number && depth) tokens.push(['number', number[0]]);
    const rest = number ? word.slice(number[0].length) : word;
    if (rest) tokens.push(['word', rest]);
  }
  if (depth) return null;
  headers.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  return { headers, tokens };
}

/**
 * A derived exact key, never a stored ID or a fuzzy same-game claim. Unknown provenance/invalid
 * source documents receive no key, so an import cannot overwrite or suppress unknown data.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {{pgn: string, provenance?: any}} game
 * @returns {string|null}
 */
export function pgnImportIdentity(Chess, game) {
  const provenance = readProvenance(game).value;
  if (!provenance || typeof game.pgn !== 'string' || game.pgn.length > 200_000 || game.pgn.includes('\0')) return null;
  try {
    const pgn = game.pgn.replace(/\r\n?/g, '\n').trim(), c = new Chess(); c.loadPgn(pgn);
    const headers = c.getHeaders(), moves = c.history();
    const start = new Chess(headers.FEN).fen();
    if ((!moves.length && !headers.FEN) || moves.length > 4000 || checkPosition(Chess, start).error) return null;
    const content = documentTokens(pgn); if (!content) return null;
    return JSON.stringify([1, start, Object.entries(headers).sort(([a], [b]) => a.localeCompare(b, 'en')), moves,
      content, provenance.source, provenance.rights]);
  } catch { return null; }
}

/**
 * Skip only equivalent source documents already in this user's collection or earlier in this
 * batch. Existing records/IDs/PGN are never modified; distinct annotations/rights remain separate.
 * @template {{pgn: string, provenance?: any}} T
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {T[]} incoming
 * @param {{pgn: string, provenance?: any}[]} existing
 * @returns {{records: T[], duplicates: number}}
 */
export function deduplicatePgnImport(Chess, incoming, existing) {
  const seen = new Set(existing.map(g => pgnImportIdentity(Chess, g)).filter(Boolean));
  const records = []; let duplicates = 0;
  for (const game of incoming) {
    const key = pgnImportIdentity(Chess, game);
    if (key && seen.has(key)) { duplicates++; continue; }
    if (key) seen.add(key); records.push(game);
  }
  return { records, duplicates };
}
