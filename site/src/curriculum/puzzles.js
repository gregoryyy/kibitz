// Lichess CC0 puzzle ingestion (TODO 6.5). Pure; no network, DOM or provider calls.
import { checkStart, fixCastling } from '../chess/play.js';

/**
 * @typedef {{id: string, sourceFen: string, moves: string[], rating: number,
 * ratingDeviation: number, popularity: number, plays: number, themes: string[],
 * openings: string[], gameUrl: string, dailyDate: number|null}} PuzzleInput
 */
/** @typedef {PuzzleInput & {setup: string, setupSan: string, fen: string, line: string[], sans: string[], tags: string[], url: string, licence: string}} Puzzle */
export const PUZZLE_FIELDS = ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags', 'DailyDate'];
export const PUZZLE_LIMITS = Object.freeze({ bytes: 1_000_000, records: 1000, plies: 41, themes: 40 });
const require = (ok, reason) => { if (!ok) throw new Error(`Invalid puzzle data: ${reason}`); };
const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const number = (value, min, max) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
const list = (value, pattern, maximum) => value === '' ? [] : value.split(' ').filter((token, i, all) => {
  require(pattern.test(token) && all.indexOf(token) === i && all.length <= maximum, 'theme/opening tokens'); return true;
});
const THEMES = { fork: 'fork', pin: 'pin', skewer: 'skewer', interference: 'interference', deflection: 'deflection', promotion: 'promotion', sacrifice: 'sacrifice', zugzwang: 'zugzwang', endgame: 'endgame', mate: 'mate', hangingPiece: 'hanging-piece', backRankMate: 'back-rank', discoveredAttack: 'discovered-attack', doubleCheck: 'double-check', rookEndgame: 'rook-endgame', pawnEndgame: 'pawn-endgame' };
const mateTheme = themes => themes.some(t => t === 'mate' || /^mateIn\d+$/.test(t));

/** Bounded standard CSV quoting; reject ambiguous or malformed records instead of guessing. */
function csvRows(/** @type {string} */ input) {
  require(typeof input === 'string' && input.length <= PUZZLE_LIMITS.bytes && new TextEncoder().encode(input).length <= PUZZLE_LIMITS.bytes, 'CSV size');
  const text = input.replace(/^\uFEFF/, ''), rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const cell = () => { row.push(field); require(row.length <= 11, 'column limit'); field = ''; closed = false; };
  const record = () => { cell(); if (row.some(v => v !== '')) rows.push(row); row = []; require(rows.length <= PUZZLE_LIMITS.records + 1, 'record limit'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"') { require(!field && !closed, 'unexpected quote'); quoted = true; }
    else if (c === ',') cell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; record(); }
    else { require(!closed, 'characters after closing quote'); field += c; }
    require(field.length <= 4096, 'field limit');
  }
  require(!quoted, 'unterminated quote');
  if (field || row.length || closed) record();
  return rows;
}

/**
 * Read the current eleven-column export or the older ten-column schema without DailyDate.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {string} input Bounded CSV, never fetched implicitly.
 * @returns {Puzzle[]}
 */
export function parsePuzzleCsv(Chess, input) {
  const [header, ...rows] = csvRows(input);
  require(header && [10, 11].includes(header.length) && header.every((name, i) => name === PUZZLE_FIELDS[i]), 'CSV header');
  require(rows.length > 0, 'empty dataset');
  const ids = new Set();
  return rows.map((values, row) => {
    require(values.length === header.length, `column count in row ${row + 2}`);
    const [id, sourceFen, moves, rating, deviation, popularity, plays, themeText, gameUrl, openingText, daily = ''] = values;
    require(/^[A-Za-z0-9]{5}$/.test(id) && !ids.has(id), `duplicate/invalid ID in row ${row + 2}`); ids.add(id);
    require(number(rating, 0, 5000) && number(deviation, 0, 2000) && number(popularity, -100, 100) && number(plays, 0, 1_000_000_000_000), 'numeric metadata');
    require(daily === '' || number(daily, 0, 8_640_000_000_000_000), 'daily date');
    require(/^https:\/\/lichess\.org\/[A-Za-z0-9]{8}(?:\/(?:black|white))?#\d+$/.test(gameUrl), 'game URL');
    return compilePuzzle(Chess, { id, sourceFen, moves: moves.split(' '), rating: +rating, ratingDeviation: +deviation, popularity: +popularity, plays: +plays,
      themes: list(themeText, /^[a-zA-Z][a-zA-Z0-9]{0,47}$/, PUZZLE_LIMITS.themes), openings: list(openingText, /^[\p{L}\p{N}_'’-]{1,160}$/u, 10), gameUrl, dailyDate: daily === '' ? null : +daily });
  });
}

/**
 * Revalidate generated/imported records at the curriculum boundary. The source FEN precedes
 * the opponent's setup move; the returned FEN/line belong to the learner. Legality and mate
 * checks do not independently prove the source's strength, uniqueness or theme assertions.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {PuzzleInput} input
 * @returns {Puzzle}
 */
export function compilePuzzle(Chess, input) {
  const data = structuredClone(input);
  require(data && typeof data.id === 'string' && data.id.length === 5 && /^[A-Za-z0-9]{5}$/.test(data.id), 'puzzle ID');
  for (const [name, min, max] of [['rating', 0, 5000], ['ratingDeviation', 0, 2000], ['popularity', -100, 100], ['plays', 0, 1_000_000_000_000]]) {
    require(typeof data[name] === 'number' && number(String(data[name]), Number(min), Number(max)), 'numeric metadata');
  }
  require(data.dailyDate === null || (typeof data.dailyDate === 'number' && number(String(data.dailyDate), 0, 8_640_000_000_000_000)), 'daily date');
  require(typeof data.gameUrl === 'string' && data.gameUrl.length <= 150 && !/\s/.test(data.gameUrl) && /^https:\/\/lichess\.org\/[A-Za-z0-9]{8}(?:\/(?:black|white))?#\d+$/.test(data.gameUrl), 'game URL');
  const tokens = (values, pattern, maximum) => Array.isArray(values) && values.length <= maximum && new Set(values).size === values.length && values.every(v => typeof v === 'string' && !/\s/.test(v) && pattern.test(v));
  require(tokens(data.themes, /^[a-zA-Z][a-zA-Z0-9]{0,47}$/, PUZZLE_LIMITS.themes) && data.themes.length > 0, 'themes');
  require(tokens(data.openings, /^[\p{L}\p{N}_'’-]{1,160}$/u, 10), 'openings');
  require(typeof data.sourceFen === 'string' && data.sourceFen.length < 150 && !/[\r\n\t]/.test(data.sourceFen) && data.sourceFen.split(' ').length === 6 && fixCastling(data.sourceFen) === data.sourceFen, 'source FEN');
  const position = checkStart(Chess, data.sourceFen); require(!position.error, 'illegal source position');
  const c = new Chess(position.fen), sans = [], fens = [];
  require(Array.isArray(data.moves) && data.moves.length >= 2 && data.moves.length <= PUZZLE_LIMITS.plies && data.moves.every(m => typeof m === 'string' && m === m.trim() && uci.test(m)), 'UCI line');
  try {
    for (const m of data.moves) {
      require(!c.isGameOver(), 'line continues after game end');
      sans.push(c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }).san); fens.push(c.fen());
    }
  } catch { throw new Error('Invalid puzzle data: illegal line'); }
  const learner = fens[0].split(' ')[1];
  if (mateTheme(data.themes)) require(c.isCheckmate() && c.turn() !== learner, 'mate theme not established');
  if (data.themes.includes('mateIn1')) require(data.moves.length === 2 && c.isCheckmate(), 'mate-in-one theme');
  // Keep only known fields; upstream SAN, URLs or normalized positions cannot override facts.
  const { id, sourceFen, moves, rating, ratingDeviation, popularity, plays, themes, openings, gameUrl, dailyDate } = data;
  return { id, sourceFen, moves, rating, ratingDeviation, popularity, plays, themes, openings, gameUrl, dailyDate,
    setup: moves[0], setupSan: sans[0], fen: fens[0], line: moves.slice(1), sans: sans.slice(1),
    tags: [...new Set(['calculation', ...themes.map(t => Object.hasOwn(THEMES, t) ? THEMES[t] : null).filter(Boolean)])], url: `https://lichess.org/training/${id}`, licence: 'CC0-1.0' };
}

/** Stable case-sensitive source IDs encoded within the curriculum's lowercase ID alphabet. */
export const puzzleExerciseId = (/** @type {string} */ id) => 'lichess-puzzle-' + [...id].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

/**
 * Editorial rating bands for catalogue navigation, not an estimate of a player's chess Elo.
 * @param {Puzzle[]} puzzles Validated source records.
 * @returns {import('./curriculum.js').LessonModule}
 */
export function puzzleModule(puzzles) {
  const text = (en, de) => ({ en, de });
  const band = rating => rating <= 1200 ? 1 : rating <= 1800 ? 2 : rating <= 2300 ? 3 : 4;
  const lessons = [1, 2, 3, 4].map(level => ({
    id: `lichess-puzzles-level-${level}`, title: text(`Lichess puzzles: group ${level}`, `Lichess-Aufgaben: Gruppe ${level}`), level, tags: ['calculation'], prerequisites: [],
    introduction: text('These CC0 Lichess puzzles come from real games. The opponent’s setup move has already been played. Rating bands organize this starter collection; puzzle ratings are not playing Elo or measured curriculum difficulty. Source themes are labels, not a new engine verdict.', 'Diese gemeinfreien Lichess-Aufgaben stammen aus echten Partien. Der vorbereitende gegnerische Zug wurde bereits ausgeführt. Bewertungsbereiche ordnen diese Startsammlung; Aufgabenwertungen sind weder Spiel-Elo noch gemessene Lehrschwierigkeit. Quellthemen sind Bezeichnungen und kein neues Engine-Urteil.'),
    objectives: [text('Check candidate moves and replies against a legal recorded solution.', 'Prüfe Kandidatenzüge und Antworten anhand einer legalen aufgezeichneten Lösung.')],
    exercises: puzzles.filter(p => band(p.rating) === level).map(p => ({
      id: puzzleExerciseId(p.id), title: text(`Lichess puzzle ${p.id}`, `Lichess-Aufgabe ${p.id}`), level, tags: [...p.tags], fen: p.fen, line: [...p.line],
      goal: /** @type {'mate'|'reflection'} */ (mateTheme(p.themes) ? 'mate' : 'reflection'), puzzle: structuredClone(p),
      prompt: text('Compare candidate moves and the opponent’s replies in this puzzle position.', 'Vergleiche Kandidatenzüge und gegnerische Antworten in dieser Aufgabenstellung.'),
      rubric: [text('The recorded Lichess solution is a legal worked example. Mate claims are rules-checked; other strength and theme claims remain attributed to the source. Do not assume every alternative move is wrong.', 'Die aufgezeichnete Lichess-Lösung ist ein legales Beispiel. Mattangaben werden regelbasiert geprüft; andere Stärke- und Themenangaben bleiben der Quelle zugeordnet. Nimm nicht an, dass jeder alternative Zug falsch ist.')],
    })),
  })).filter(l => l.exercises.length);
  return { id: 'lichess-puzzles', title: text('Lichess puzzle collection', 'Lichess-Aufgabensammlung'), level: 1, tags: [...new Set(puzzles.flatMap(p => p.tags))], lessons };
}
