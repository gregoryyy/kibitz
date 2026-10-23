// Opening explorer (TODO 5.2). PGN mainlines become a position/move graph, not an opening-name
// tree: transpositions join, counters do not split positions, and rights remain part of the key.
// Pure functions; Chess is supplied so the same code runs in the browser and node:test.
import { epd } from './knowledge.js';

const RESULTS = { '1-0': 'white', '1/2-1/2': 'draw', '0-1': 'black', '*': 'unknown' };
const empty = () => ({ games: 0, ended: 0, moves: new Map() });

// An unreadable game or a fragment/study starting away from the initial position is excluded.
// Do not index a readable prefix of a corrupt PGN. Headers, not mutable library metadata, give
// the result. Every move/position below has been produced by chess.js.
export function openingGame(Chess, game, source) {
  if (!game || typeof game.pgn !== 'string' || !['classic', 'library'].includes(source)) return null;
  try {
    const c = new Chess(); c.loadPgn(game.pgn);
    const moves = c.history({ verbose: true });
    if (!moves.length || epd(moves[0].before) !== epd(new Chess().fen())) return null;
    return {
      id: game.id, source, result: Object.hasOwn(RESULTS, c.getHeaders().Result) ? RESULTS[c.getHeaders().Result] : 'unknown',
      steps: moves.map((m, i) => ({ before: epd(m.before), after: epd(m.after), uci: m.from + m.to + (m.promotion || ''), ply: i + 1 })),
    };
  } catch { return null; }
}

// Each record votes once per position: its first continuation. The final position is counted
// as an ending only if the game did not reach it earlier. Repeated imports remain separate
// records (library-wide deduplication is TODO 7.2), while duplicate ids within a source do not.
export function buildOpeningIndex(records) {
  const positions = new Map(), games = { classic: 0, library: 0 }, ids = new Set();
  for (const g of records) {
    if (!g) continue;
    const key = `${g.source}:${g.id}`;
    if (ids.has(key)) continue;
    ids.add(key); games[g.source]++;
    const seen = new Set();
    const node = position => {
      if (!positions.has(position)) positions.set(position, { classic: empty(), library: empty() });
      return positions.get(position)[g.source];
    };
    for (const p of g.steps) {
      if (seen.has(p.before)) continue;
      seen.add(p.before);
      const n = node(p.before); n.games++;
      if (!n.moves.has(p.uci)) n.moves.set(p.uci, { uci: p.uci, games: 0, white: 0, draw: 0, black: 0, unknown: 0, examples: [] });
      const m = n.moves.get(p.uci); m.games++; m[g.result]++;
      m.examples.push({ id: g.id, source: g.source, ply: p.ply });
    }
    const end = g.steps.at(-1)?.after;
    if (end && !seen.has(end)) { const n = node(end); n.games++; n.ended++; }
  }
  return { positions, games };
}

// Revalidate moves in the *query* position and derive SAN there (including check/promotion).
// Never borrow display notation or move counters from the first game that reached the node.
export function openingContinuations(Chess, index, fen, source = 'all') {
  const sources = source === 'all' ? ['classic', 'library'] : ['classic', 'library'].includes(source) ? [source] : [];
  const result = { records: sources.reduce((n, s) => n + index.games[s], 0), games: 0, ended: 0, moves: [] };
  let c;
  try { c = new Chess(fen); } catch { return result; }
  const n = index.positions.get(epd(c.fen()));
  if (!n) return result;
  const combined = new Map();
  for (const s of sources) {
    result.games += n[s].games; result.ended += n[s].ended;
    for (const [uci, entry] of n[s].moves) {
      if (!combined.has(uci)) combined.set(uci, { uci, games: 0, white: 0, draw: 0, black: 0, unknown: 0, examples: [] });
      const m = combined.get(uci);
      for (const k of ['games', 'white', 'draw', 'black', 'unknown']) m[k] += entry[k];
      m.examples.push(...entry.examples);
    }
  }
  for (const m of combined.values()) {
    try {
      const mv = c.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci[4] });
      result.moves.push({ ...m, san: mv.san }); c.undo();
    } catch { /* invalid indexed move: do not display it */ }
  }
  result.moves.sort((a, b) => b.games - a.games || a.uci.localeCompare(b.uci));
  return result;
}
