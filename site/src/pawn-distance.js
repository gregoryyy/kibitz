// Colour-specific pawn-square geometry (TODO 8.5). No move, evaluation or plan-transfer claim.
export const PAWN_DISTANCE_POLICY = Object.freeze({ version: 'pawn-square-jaccard-v1', nearby: 0.25 });

/**
 * Decode a pawnSignature() placement into stable colour/square tokens. Validate the geometry,
 * not full chess legality: callers obtain signatures from already checked source/query boards.
 * @param {string} signature Eight ranks containing only p/P, empty-square digits and slashes.
 * @returns {string[]} Detached tokens such as w:d4 and b:e6; colours are never normalised.
 */
export function pawnSquares(signature) {
  if (typeof signature !== 'string' || signature.length > 71) throw new Error('Invalid pawn signature');
  const ranks = signature.split('/'), squares = [];
  if (ranks.length !== 8) throw new Error('Invalid pawn signature');
  ranks.forEach((rank, i) => {
    let file = 0;
    for (const ch of rank) {
      if (/^[1-8]$/.test(ch)) file += +ch;
      else if ((ch === 'p' || ch === 'P') && file < 8) { squares.push(`${ch === 'P' ? 'w' : 'b'}:${'abcdefgh'[file]}${8 - i}`); file++; }
      else throw new Error('Invalid pawn signature');
      if (file > 8) throw new Error('Invalid pawn signature');
    }
    if (file !== 8) throw new Error('Invalid pawn signature');
  });
  return squares.sort();
}

/**
 * Jaccard distance: symmetric difference divided by union size. Empty/empty is zero, but
 * retrieval separately excludes empty-pawn analogies. Square displacement has no move cost.
 * @param {string[]} query Colour/square tokens from the current checked board.
 * @param {string[]} source Colour/square tokens from the checked source board.
 * @returns {{distance: number, shared: number, total: number, onlyQuery: string[], onlySource: string[]}}
 */
export function comparePawns(query, source) {
  const checked = tokens => {
    if (!Array.isArray(tokens) || tokens.length > 64 || new Set(tokens).size !== tokens.length || tokens.some(t => typeof t !== 'string' || !/^[wb]:[a-h][1-8]$/.test(t))) throw new Error('Invalid pawn squares');
    return new Set(tokens);
  };
  const a = checked(query), b = checked(source), shared = [...a].filter(t => b.has(t)).length;
  const total = a.size + b.size - shared;
  return { distance: total ? (total - shared) / total : 0, shared, total,
    onlyQuery: [...a].filter(t => !b.has(t)).sort(), onlySource: [...b].filter(t => !a.has(t)).sort() };
}
