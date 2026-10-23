// Named continuations (TODO 5.6). Build once from the CC0 Lichess opening lines;
// query by position in the browser, independently of reference-game frequencies.
import { epd } from './knowledge.js';
import { quote } from './prompt.js';

/** @typedef {{eco: string, name: string}} OpeningName */
/** @typedef {OpeningName & {plies: number}} OpeningDestination Plies remaining AFTER the candidate move. */
/** @typedef {{uci: string, to: string, names: OpeningDestination[]}} NamedEdge */
/** @typedef {{version: number, lines: number, positions: Record<string, {names: OpeningName[], moves: NamedEdge[]}>}} OpeningCatalogue */
const nameKey = n => `${n.eco}\0${n.name}`;
const byName = (a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name);
const validName = n => n && typeof n.eco === 'string' && /^[A-E]\d{2}$/.test(n.eco)
  && typeof n.name === 'string' && n.name.trim().length > 0 && n.name.length <= 240;

/**
 * Compile complete legal standard-start rows [ECO, name, space-separated SAN] into an
 * EPD graph. Invalid rows contribute nothing, including no readable prefix. Each edge
 * retains its three nearest recorded named destinations; plies=0 means the move reaches that
 * name immediately. A transposed arrival also inherits names of its destination node.
 * No counts here represent game frequency. This runs during the build, not in the UI.
 * @param {import('./tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {string[][]} rows Named rows from openings.json/the same build input.
 * @returns {OpeningCatalogue} JSON-serialisable catalogue.
 */
export function buildNamedOpenings(Chess, rows) {
  const nodes = new Map(), seen = new Set();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { names: new Map(), moves: new Map() });
    return nodes.get(key);
  };
  let lines = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 3) continue;
    const [eco, name, text] = row, label = { eco, name };
    if (!validName(label) || typeof text !== 'string' || text.length > 1000) continue;
    const sans = text.trim().split(/\s+/);
    if (!sans.length || sans.length > 80) continue;
    const c = new Chess(), steps = [];
    try {
      for (const san of sans) {
        const before = epd(c.fen()), move = c.move(san);
        steps.push({ before, after: epd(c.fen()), uci: move.from + move.to + (move.promotion || '') });
      }
    } catch { continue; }
    const key = `${nameKey(label)}\0${steps.map(s => s.uci).join(' ')}`;
    if (seen.has(key)) continue;
    seen.add(key); lines++;
    const end = node(steps.at(-1).after), previous = end.names.get(nameKey(label));
    if (!previous || previous.depth < steps.length) end.names.set(nameKey(label), { ...label, depth: steps.length });
    steps.forEach((s, i) => {
      const at = node(s.before); node(s.after);
      if (!at.moves.has(s.uci)) at.moves.set(s.uci, { uci: s.uci, to: s.after, names: new Map() });
      const edge = at.moves.get(s.uci), plies = steps.length - i - 1;
      const old = edge.names.get(nameKey(label));
      if (!old || old.plies > plies) edge.names.set(nameKey(label), { ...label, plies });
    });
  }
  const positions = Object.create(null);
  for (const [key, n] of nodes) {
    const names = [...n.names.values()].sort((a, b) => b.depth - a.depth || byName(a, b)).slice(0, 3).map(({ eco, name }) => ({ eco, name }));
    const moves = [...n.moves.values()].map(e => {
      const destinations = new Map(e.names);
      for (const target of nodes.get(e.to).names.values()) destinations.set(nameKey(target), { eco: target.eco, name: target.name, plies: 0 });
      return { uci: e.uci, to: e.to, names: [...destinations.values()].sort((a, b) => a.plies - b.plies || byName(a, b)).slice(0, 3) };
    }).sort((a, b) => a.uci.localeCompare(b.uci));
    positions[key] = { names, moves };
  }
  return { version: 1, lines, positions };
}

/**
 * Revalidate every catalogue move in the query position and derive SAN/full FEN there.
 * Counters do not split EPDs; turn, castling and legal en-passant rights do. Reject an
 * illegal move or mismatched destination even if a fetched catalogue was tampered with.
 * Names are detached bounded text, not HTML, recommendations or engine evidence.
 * @param {import('./tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {OpeningCatalogue|null} catalogue Compiled local data.
 * @param {string} fen Current game/scratch FEN.
 */
export function namedContinuations(Chess, catalogue, fen) {
  const empty = { fen, current: [], moves: [] };
  if (typeof fen !== 'string' || !fen.trim()) return empty;
  let c; try { c = new Chess(fen); } catch { return empty; }
  if (catalogue?.version !== 1 || c.isGameOver()) return empty;
  const at = catalogue.positions?.[epd(c.fen())];
  if (!at || !Array.isArray(at.names) || !Array.isArray(at.moves)) return empty;
  const current = at.names.filter(validName).slice(0, 3).map(n => ({ eco: n.eco, name: n.name }));
  const moves = [], seen = new Set();
  for (const edge of at.moves.slice(0, 64)) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(edge?.uci) || seen.has(edge.uci) || !Array.isArray(edge.names)) continue;
    const names = edge.names.filter(n => validName(n) && Number.isInteger(n.plies) && n.plies >= 0 && n.plies <= 80).slice(0, 3)
      .map(n => ({ eco: n.eco, name: n.name, plies: n.plies }));
    if (!names.length) continue;
    try {
      const next = new Chess(fen), mv = next.move({ from: edge.uci.slice(0, 2), to: edge.uci.slice(2, 4), promotion: edge.uci[4] });
      if (epd(next.fen()) !== edge.to) continue;
      seen.add(edge.uci); moves.push({ uci: edge.uci, san: mv.san, fen: next.fen(), names });
    } catch { /* malformed/illegal catalogue edges are not displayable */ }
  }
  return { fen, current, moves };
}

/**
 * Catalogue names explain branches; they cannot establish a move's current strength.
 * Quote all names as bounded retrieval data and keep them separate from engine lines.
 * @param {ReturnType<typeof namedContinuations>} position Checked query result.
 * @returns {string} Caller applies General chess/live-help policy before including it.
 */
export function namedOpeningContext(position) {
  if (!position.current.length && !position.moves.length) return '';
  const [, side, , , , number] = position.fen.split(' ');
  return ['Named opening catalogue (metadata, not engine evidence). Names identify possible branches, not the strongest moves or their frequency. Use Stockfish lines or engine tools before recommending a concrete continuation.',
    ...position.current.map(n => `Current named position: ${quote(`${n.eco} ${n.name}`, 260)}.`),
    ...position.moves.slice(0, 32).map(m => {
      const name = m.names[0];
      return `- ${number}${side === 'w' ? '.' : '...'} ${m.san}: ${quote(`${name.eco} ${name.name}`, 260)}; ${name.plies} further plies to that name.`;
    })].join('\n');
}
