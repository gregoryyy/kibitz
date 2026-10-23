// Authored board/intent cases, separate from the unchanged lexical development labels.
export const HYBRID_SUITE_VERSION = 1;
const IQP = 'r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 12 26';
const REPEAT = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3';
const a = (game, ply) => ({ kind: 'annotation', collection: 'library', game, ply });
const BASE = { language: 'en', kind: 'annotation', collection: 'library' };
/** @type {import('./text-cases.mjs').TextCase[]} */
export const HYBRID_CASES = [
  { ...BASE, id: 'repeated-first', text: 'first arrival', fen: REPEAT, group: 'occurrence', expected: [a('repeat', 1)], reason: 'Literal first-arrival intent distinguishes equal boards; the exact board must not override the note.' },
  { ...BASE, id: 'repeated-second', text: 'second arrival', fen: REPEAT, group: 'occurrence', expected: [a('repeat', 5)], reason: 'The second occurrence has its own note and exact navigation target.' },
  { ...BASE, id: 'qgd-transposition', text: 'QGD transposition', fen: 'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5', group: 'exact', expected: [a('qgd-a', 8), a('qgd-b', 8)], reason: 'Both original notes describe the exact QGD transposition.' },
  { ...BASE, id: 'quiet-iqp', text: 'IQP middlegame', fen: IQP, group: 'analogy', expected: [a('iqp-f1', 12), a('iqp-e1', 12)], reason: 'The two quiet IQP notes fit the quiet board; the checked note is a distractor.' },
  { ...BASE, id: 'checked-iqp', text: 'in check', fen: 'r2qr1k1/ppp2ppp/2n5/7n/3P4/2N2N2/PP3PPP/R2QK2R w - - 12 26', group: 'exact', expected: [a('iqp-check', 12)], reason: 'The exact checked board explains why a general quiet plan cannot answer the check.' },
  { ...BASE, id: 'castling-rights', text: 'castling rights', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10', group: 'exact', expected: [a('castling', 0)], reason: 'The root note and complete EPD retain castling rights.' },
  { ...BASE, id: 'ep-root', text: 'en passant d6', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22', group: 'exact', expected: [a('en-passant', 0)], reason: 'A custom-start note has the exact legal en-passant board.' },
  { ...BASE, id: 'unsupported-with-board', text: 'quantum knight teleportation', fen: IQP, allTerms: true, expected: [], reason: 'Even a matching board cannot bypass the explicit all-terms requirement.' },
  { ...BASE, id: 'excluded-source', text: 'Dxf7', fen: IQP, allTerms: true, expected: [], reason: 'The classic Qxf7 source is excluded before any candidate channel.' },
  { ...BASE, id: 'empty-intent', text: 'the und für', fen: IQP, expected: [], reason: 'A query consisting only of stopwords has no text-search intent; board matches cannot fill it.' },
];
