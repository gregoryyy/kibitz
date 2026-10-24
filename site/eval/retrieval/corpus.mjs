// Authored test scores and notes, plus Kibitz's packaged classics. No external corpus.
import { BENCHMARK_CLASSICS } from './classics-fixture.mjs';
import { makeProvenance } from '../../src/library/library.js';

const IQP = 'r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 0 20';
const LOOP = '20. Nh4 Nh5 21. Nf3 Nf6 22. Nh4 Nh5 23. Nf3 Nf6 24. Nh4 Nh5 25. Nf3';
/** @typedef {{collection: 'classic'|'library', game: {id: string, kind: string, pgn: string, provenance: ReturnType<typeof makeProvenance>}}} CorpusEntry */

/**
 * An original fixture: source rights are explicit, unlike historical score assertions.
 * @returns {CorpusEntry}
 */
function fixture(id, moves, fen = '') {
  return { collection: 'library', game: { id, kind: 'study', pgn: `[Event "${id}"]\n${fen ? `[SetUp "1"]\n[FEN "${fen}"]\n` : ''}\n${moves}`,
    provenance: makeProvenance('builtin', { title: 'Kibitz retrieval benchmark fixtures', author: 'Kibitz contributors', score: 'GPL-3.0-or-later', annotations: 'GPL-3.0-or-later' }) } };
}

/**
 * Corpus order is deliberate: baseline ties follow the app's insertion order.
 * @returns {CorpusEntry[]}
 */
export function retrievalCorpus() {
  return [
    ...BENCHMARK_CLASSICS.map(game => ({ collection: /** @type {const} */ ('classic'), game })),
    fixture('qgd-a', '1. d4 d5 2. Nf3 Nf6 3. c4 e6 4. Nc3 Be7 {The same QGD position reached by the other move order.} *'),
    fixture('qgd-b', '1. Nf3 Nf6 2. d4 d5 3. c4 e6 4. Nc3 Be7 {A transposition, not a new board position.} *'),
    fixture('repeat', '1. Nf3 {First arrival: develop the knight.} Nf6 2. Ng1 Ng8 3. Nf3 {Second arrival: this note belongs to move three.} *'),
    fixture('iqp-f1', `${LOOP} Nf6 {An IQP middlegame with the rook on f1; White is not in check.} *`, IQP),
    fixture('iqp-e1', `${LOOP} Nf6 {An IQP middlegame with the rook on e1; White is not in check.} *`, IQP.replace('R2Q1RK1', 'R2QR1K1')),
    fixture('iqp-check', `${LOOP} Re8+ {White is in check: a general pawn plan cannot answer the check.} *`, IQP.replace('R2Q1RK1', 'R2QK2R')),
    fixture('castling', '{Both sides retain both castling rights.} *', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10'),
    fixture('en-passant', '{White can capture en passant on d6.} *', '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22'),
  ];
}
