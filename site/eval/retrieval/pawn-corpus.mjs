import { makeProvenance } from '../../src/library.js';

export const PAWN_SUITE_VERSION = 1;
export const START_PAWNS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ONE = 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR w KQkq - 0 1';
const CHECK = 'r1bqkbnr/pppppppp/8/8/8/3n4/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BOUNDARY = '4k3/8/8/8/8/8/PPP5/4K3 w - - 0 1';

/** Original source diagrams: legal FEN replay, not assertions about a connecting move sequence. */
export function pawnCorpus() {
  return [
    ['same', START_PAWNS], ['advance-one', ONE],
    ['advance-two', 'rnbqkbnr/pppppppp/8/8/8/PP6/2PPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['missing-one', 'rnbqkbnr/pppppppp/8/8/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1'],
    ['far', 'rnbqkbnr/pppppppp/8/8/8/PPP5/3PPPPP/RNBQKBNR w KQkq - 0 1'],
    ['black', ONE.replace(' w ', ' b ')], ['checked', CHECK],
    ['empty', '4k3/8/8/8/8/8/8/4K3 w - - 0 1'],
    ['single', '4k3/8/8/8/8/8/5P2/4K3 w - - 0 1'], ['boundary', BOUNDARY],
  ].map(([id, fen]) => ({ collection: /** @type {const} */ ('library'), game: { id, kind: 'study',
    pgn: `[Event "Pawn ${id}"]\n[SetUp "1"]\n[FEN "${fen}"]\n\n{Authored pawn diagram.} *`,
    provenance: makeProvenance('builtin', { title: 'Kibitz pawn-distance fixtures', author: 'Kibitz contributors', score: 'GPL-3.0-or-later', annotations: 'GPL-3.0-or-later' }) } }));
}
const label = game => ({ kind: 'annotation', collection: 'library', game, ply: 0 });
const base = { text: 'analogy', language: 'en', kind: 'annotation', collection: 'library' };
/** Manual spatial relevance judgements, including an intentional sparse-structure false negative. */
export const PAWN_CASES = [
  { ...base, id: 'dense-structure', fen: START_PAWNS, group: 'overlap', expected: ['same', 'missing-one', 'advance-one', 'advance-two'].map(label), reason: 'Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.' },
  { ...base, id: 'black-turn', fen: START_PAWNS.replace(' w ', ' b '), group: 'turn', expected: [label('black')], reason: 'Only the black-to-move source is dynamically compatible.' },
  { ...base, id: 'in-check', fen: CHECK, group: 'check', expected: [label('checked')], reason: 'An exact checked diagram is relevant; quiet structures cannot substitute for it.' },
  { ...base, id: 'quarter-boundary', fen: BOUNDARY.replace('PPP5', 'PPPP4'), group: 'boundary', expected: [label('boundary')], reason: 'Three of four pawn squares remain; one missing pawn is a useful spatial analogy.' },
  { ...base, id: 'single-pawn-shift', fen: '4k3/8/8/8/8/5P2/8/4K3 w - - 0 1', group: 'sparse', expected: [label('single')], reason: 'A one-square advance in a one-pawn diagram is spatially nearby, although square-set overlap will miss it. No plan transfer is asserted.' },
  { ...base, id: 'pawnless', fen: '7k/8/8/8/8/8/8/K7 w - - 0 1', expected: [], reason: 'Empty pawn sets do not establish a useful structural analogy between different boards.' },
  { ...base, id: 'unrelated', fen: '4k3/8/p7/8/8/4PPPP/8/4K3 w - - 0 1', expected: [], reason: 'No source provides a close pawn-square structure with compatible phase.' },
  { ...base, id: 'wrong-turn-boundary', fen: BOUNDARY.replace('PPP5', 'PPPP4').replace(' w ', ' b '), expected: [], reason: 'The nearby endgame source has the opposite side to move.' },
];
