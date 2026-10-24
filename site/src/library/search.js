// Deterministic catalogue search. No model, storage, network or board mutation.
import { epd, TAG_LABELS } from '../chess/knowledge.js';

export const SEARCH_LIMITS = { text: 200, pgn: 200_000, plies: 4000, openingPlies: 40 };
const text = (value, limit = 500) => typeof value === 'string' ? value.slice(0, limit) : '';
// Keep punctuation literal. Removing combining marks permits Réti/reti and Grünfeld/grunfeld.
export const searchTextKey = value => text(value, 10_000).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const words = value => searchTextKey(value).split(' ').filter(Boolean);
const hasWords = (value, terms) => terms.every(term => value.includes(term));
const scores = ['1-0', '0-1', '1/2-1/2', '*'];

/** Parse once per changed PGN, independently of provenance/indexing readiness. */
export function gameSearchData(Chess, game) {
  if (typeof game?.pgn !== 'string' || game.pgn.length > SEARCH_LIMITS.pgn) return null;
  try {
    const c = new Chess(); c.loadPgn(game.pgn);
    const moves = c.history({ verbose: true });
    if (moves.length > SEARCH_LIMITS.plies) return null;
    const headers = c.getHeaders(), start = new Chess(headers.FEN).fen();
    const positions = epd(start) === epd(new Chess().fen()) ? moves.slice(0, SEARCH_LIMITS.openingPlies).map(m => epd(m.after)) : [];
    return { headers, positions };
  } catch { return null; } // Do not publish a readable prefix of an illegal game.
}

/**
 * Search/display facts from legal PGN headers, with flat legacy fields as fallback.
 * ECO is a label for the deepest matching early mainline position, not strength evidence.
 * @template T
 * @param {T} game
 * @param {ReturnType<typeof gameSearchData>} parsed
 * @param {Record<string, string[]>} [eco]
 */
export function gameSearchMetadata(game, parsed, eco = {}) {
  const g = /** @type {Record<string, unknown>} */ (game), h = parsed?.headers || {};
  const header = (key, fallback) => text(h[key]) && h[key] !== '?' ? text(h[key]) : text(fallback);
  let opening = null;
  for (const position of parsed?.positions || []) {
    const match = Object.hasOwn(eco, position) && eco[position];
    if (Array.isArray(match) && /^[A-E]\d{2}$/.test(match[0]) && typeof match[1] === 'string') opening = match;
  }
  return { ...game, title: text(g.title) || header('Event', ''), white: header('White', g.white), black: header('Black', g.black),
    date: header('Date', g.date), result: parsed ? text(h.Result) : text(g.result),
    eco: opening?.[0] || header('ECO', g.eco), opening: opening?.[1] || header('Opening', g.opening),
    tags: Array.isArray(g.tags) ? g.tags.filter(v => typeof v === 'string').slice(0, 64).map(v => text(v, 80)) : [] };
}

/** @typedef {{query?:string, player?:string, opening?:string, yearFrom?:number|string, yearTo?:number|string, score?:string, theme?:string, color?:string, result?:string}} GameSearch */
/** Unknown or partial dates never become a guessed year. */
export function recordedYear(value) {
  const match = /^(\d{4})(?:[.-](?:\d{2}|\?\?)[.-](?:\d{2}|\?\?))?$/.exec(text(value, 80).trim());
  return match && +match[1] > 0 ? +match[1] : null;
}
/** Shared UI/tool validation; reject invalid filters instead of silently broadening a search. */
export function gameSearchError(/** @type {GameSearch} */ input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Invalid library search.';
  for (const key of ['query', 'player', 'opening', 'theme']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > SEARCH_LIMITS.text)) return 'Use search fields of at most 200 characters.';
  for (const key of ['yearFrom', 'yearTo']) if (input[key] !== undefined && input[key] !== '' && (!['string', 'number'].includes(typeof input[key]) || !/^[1-9]\d{0,3}$/.test(String(input[key])))) return 'Use whole years from 1 to 9999.';
  if (input.yearFrom !== undefined && input.yearFrom !== '' && input.yearTo !== undefined && input.yearTo !== '' && +input.yearFrom > +input.yearTo) return 'The first year must not be after the last year.';
  if (input.score !== undefined && !scores.includes(input.score) || input.color !== undefined && !['w', 'b'].includes(input.color) || input.result !== undefined && !['win', 'loss', 'draw'].includes(input.result)) return 'Invalid library search.';
  return '';
}

/**
 * AND across fields and words. Theme IDs or English/localized labels are literal metadata.
 * result/color retain the coach's own-player semantics; score is the absolute PGN result.
 * @template T
 * @param {T[]} games
 * @param {GameSearch} [input]
 * @param {Record<string, string>} [labels]
 */
export function filterGames(games, input = {}, labels = {}) {
  const error = gameSearchError(input), active = !!input && Object.values(input).some(v => v !== undefined && (typeof v !== 'string' || v.trim() !== ''));
  if (error) return { games: /** @type {T[]} */ ([]), error, active };
  const query = words(input.query), player = words(input.player), opening = words(input.opening), theme = words(input.theme);
  const filtered = games.filter(game => {
    const g = /** @type {Record<string, unknown>} */ (game);
    const tags = Array.isArray(g.tags) ? g.tags.filter(v => typeof v === 'string').slice(0, 64) : [];
    const themes = tags.flatMap(tag => [tag, Object.hasOwn(TAG_LABELS, tag) ? TAG_LABELS[tag] : '', Object.hasOwn(labels, tag) ? labels[tag] : '']).join(' ');
    const players = searchTextKey([text(g.white), text(g.black)].join(' ')), openings = searchTextKey([text(g.eco), text(g.opening)].join(' '));
    if (!hasWords(players, player) || !hasWords(openings, opening)) return false;
    if (input.theme && Object.hasOwn(TAG_LABELS, input.theme) ? !tags.includes(input.theme) : !hasWords(searchTextKey(themes), theme)) return false;
    const year = recordedYear(g.date);
    if (input.yearFrom && (year === null || year < +input.yearFrom) || input.yearTo && (year === null || year > +input.yearTo)) return false;
    if (input.score !== undefined && g.result !== input.score || input.color && g.userColor !== input.color) return false;
    if (input.result) {
      const mine = g.userColor === 'w' ? '1-0' : g.userColor === 'b' ? '0-1' : null;
      if (!mine || (input.result === 'draw' ? g.result !== '1/2-1/2' : !['1-0', '0-1'].includes(text(g.result)) || (g.result === mine) !== (input.result === 'win'))) return false;
    }
    return hasWords(searchTextKey([text(g.title), text(g.searchTitle), players, openings, text(g.date), text(g.result), themes].join(' ')), query);
  });
  return { games: filtered, error: '', active };
}
