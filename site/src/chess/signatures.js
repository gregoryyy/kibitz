// Reproducible board geometry (TODO 8.1), independent of DOM, providers and engine scores.
// Callers supply rules-checked FEN/EPD. Encoding checks here do not establish a legal game history.
export const POSITION_SIGNATURE_VERSION = 'counts-squares-v1';
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'], COLORS = ['w', 'b'];
/**
 * Colour-specific counts and occupied piece-square terms. Counters/turn/rights stay in the FEN,
 * rather than these deliberately lossy structural keys. No rotation or colour swap is performed.
 * @param {string} fen Canonical full FEN or four-field EPD from the rules layer.
 */
export function boardSignatures(fen) {
  if (typeof fen !== 'string' || fen.length > 200) throw new Error('Invalid signature position');
  const fields = fen.trim().split(/\s+/), [board, turn, rights, ep] = fields;
  if (![4, 6].includes(fields.length) || !['w', 'b'].includes(turn) || !/^(?:-|[KQkq]{1,4})$/.test(rights)
    || rights !== '-' && new Set(rights).size !== rights.length || !/^(?:-|[a-h][36])$/.test(ep)
    || fields.length === 6 && (!/^\d+$/.test(fields[4]) || !/^[1-9]\d*$/.test(fields[5]) || !Number.isSafeInteger(+fields[4]) || !Number.isSafeInteger(+fields[5]))) throw new Error('Invalid signature position');
  const ranks = board.split('/'); if (ranks.length !== 8) throw new Error('Invalid signature board');
  const counts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 } }, pieces = [];
  for (const [row, rank] of ranks.entries()) {
    let file = 0;
    for (const cell of rank) {
      if (/^[1-8]$/.test(cell)) { file += +cell; continue; }
      if (!/^[pnbrqkPNBRQK]$/.test(cell) || file >= 8) throw new Error('Invalid signature piece');
      const color = cell === cell.toUpperCase() ? 'w' : 'b', type = cell.toLowerCase();
      counts[color][type]++; pieces.push(color + type.toUpperCase() + 'abcdefgh'[file] + (8 - row)); file++;
    }
    if (file !== 8) throw new Error('Invalid signature rank');
  }
  if (COLORS.some(color => counts[color].k !== 1)) throw new Error('Invalid signature kings');
  pieces.sort();
  const material = POSITION_SIGNATURE_VERSION + ':' + COLORS.map(color => color + ':' + TYPES.map(type => counts[color][type]).join(',')).join('|');
  return { version: POSITION_SIGNATURE_VERSION, material, placement: POSITION_SIGNATURE_VERSION + ':' + pieces.join(','), counts, pieces };
}

/** All supplied terms must name actual query pieces; values never become regular expressions. */
export function checkedPieceTerms(query, selected = query.pieces) {
  if (!Array.isArray(selected) || !selected.length || selected.length > 64 || new Set(selected).size !== selected.length
    || selected.some(term => typeof term !== 'string' || !/^[wb][PNBRQK][a-h][1-8]$/.test(term) || !query.pieces.includes(term))) throw new Error('Invalid piece-square query');
  return selected.slice().sort();
}
