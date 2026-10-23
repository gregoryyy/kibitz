// Human-authored relevance judgements, independent of the retriever under evaluation.
// Grade 2: directly relevant; grade 1: useful analogy; omitted candidates: not relevant.
export const SUITE_VERSION = 1;
const OPERA = 'rn2kb1r/p3qppp/2p2n2/1N2p1B1/2B1P3/1Q6/PPP2PPP/R3K2R b KQkq - 0 10';
const QGD = 'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5';
const REPEAT = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3';
const IQP = 'r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25';
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10';
const EP = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22';

/** A judgement names a record, never an index result or a computed similarity. */
const ref = (game, ply, reason, grade = 2, collection = 'library') => ({ game, collection, ply, grade, reason });
const opera = [ref('ex-opera', 19, 'The position after Morphy’s 10. Nxb5.', 2, 'classic')];
const qgd = [ref('qgd-a', 8, 'The first move order reaches this exact board.'), ref('qgd-b', 8, 'The second move order transposes to it.')];
const repeated = [ref('repeat', 1, 'First occurrence of the board.'), ref('repeat', 5, 'Second occurrence of the same board.')];
const structure = [ref('iqp-e1', null, 'Same IQP, rook on e1, no immediate check.'), ref('iqp-f1', null, 'Useful IQP analogy, but the rook is still on f1.', 1),
  ref('cl-steinitz-bardeleben', null, 'A real IQP example; White later places the rook on e1, with a different piece configuration.', 1, 'classic')];

/**
 * Position queries in both languages. Text and intent are passed to adapters; the current
 * position-only baseline ignores them, making occurrence/intent limitations measurable.
 * @type {Array<{id: string, group: string, language: string, text: string, fen: string,
 *   unit: 'occurrence'|'document', expected: ReturnType<typeof ref>[], excludeGameId?: string}>}
 */
export const RETRIEVAL_CASES = [
  { id: 'opera-en', group: 'exact', language: 'en', text: 'Find this Opera Game position after 10. Nxb5.', fen: OPERA, unit: 'occurrence', expected: opera },
  { id: 'opera-de', group: 'exact', language: 'de', text: 'Finde diese Stellung der Opernpartie nach 10. Sxb5.', fen: OPERA, unit: 'occurrence', expected: opera },
  { id: 'opera-counters', group: 'exact', language: 'en', text: 'Find the same position, ignoring move counters.', fen: OPERA.replace('0 10', '17 42'), unit: 'occurrence', expected: opera },
  { id: 'lucena-root', group: 'exact', language: 'en', text: 'Find the starting diagram of the Lucena study.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', unit: 'occurrence', expected: [ref('st-lucena', 0, 'Custom-start study root.', 2, 'classic')] },
  { id: 'philidor-black', group: 'exact', language: 'de', text: 'Finde die Philidor-Ausgangsstellung mit Schwarz am Zug.', fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1', unit: 'occurrence', expected: [ref('st-philidor', 0, 'Black-to-move study root.', 2, 'classic')] },
  { id: 'saavedra-root', group: 'exact', language: 'en', text: 'Find the Saavedra starting diagram.', fen: '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1', unit: 'occurrence', expected: [ref('st-saavedra', 0, 'The exact source diagram.', 2, 'classic')] },
  { id: 'castling-rights', group: 'exact', language: 'en', text: 'Find this position with all four castling rights.', fen: CASTLING, unit: 'occurrence', expected: [ref('castling', 0, 'Board, side and castling rights agree.')] },
  { id: 'en-passant-right', group: 'exact', language: 'de', text: 'Finde diese Stellung mit möglichem en passant auf d6.', fen: EP, unit: 'occurrence', expected: [ref('en-passant', 0, 'The legal en-passant right is part of position identity.')] },
  { id: 'qgd-en', group: 'transposition', language: 'en', text: 'Find both games that reach this QGD position.', fen: QGD, unit: 'occurrence', expected: qgd },
  { id: 'qgd-de', group: 'transposition', language: 'de', text: 'Finde beide Zugfolgen, die diese Stellung erreichen.', fen: QGD, unit: 'occurrence', expected: qgd },
  { id: 'qgd-counters', group: 'transposition', language: 'en', text: 'Find this transposition with different move counters.', fen: QGD.replace('2 5', '9 23'), unit: 'occurrence', expected: qgd },
  { id: 'qgd-exclude-current', group: 'transposition', language: 'de', text: 'Zeige die andere Partie, nicht die gerade geöffnete.', fen: QGD, unit: 'occurrence', excludeGameId: 'qgd-a', expected: [qgd[1]] },
  { id: 'repeat-both', group: 'occurrence', language: 'en', text: 'Find both arrivals at this board in the repetition game.', fen: REPEAT, unit: 'occurrence', expected: repeated },
  { id: 'repeat-second-en', group: 'occurrence', language: 'en', text: 'Find the note at the second arrival, after 3. Nf3, not 1. Nf3.', fen: REPEAT, unit: 'occurrence', expected: [repeated[1]] },
  { id: 'repeat-second-de', group: 'occurrence', language: 'de', text: 'Finde die Notiz nach 3. Sf3, beim zweiten Auftreten.', fen: REPEAT, unit: 'occurrence', expected: [repeated[1]] },
  { id: 'iqp-plan-en', group: 'structure', language: 'en', text: 'Find IQP middlegame examples for White with a rook on e1 and no immediate check.', fen: IQP, unit: 'document', expected: structure },
  { id: 'iqp-plan-de', group: 'structure', language: 'de', text: 'Finde Isolani-Beispiele für Weiß mit Turm auf e1 ohne unmittelbares Schach.', fen: IQP, unit: 'document', expected: structure },
  { id: 'iqp-exclude-current', group: 'structure', language: 'en', text: 'Find another quiet IQP example outside my current game.', fen: IQP, unit: 'document', excludeGameId: 'iqp-e1', expected: [structure[1], structure[2]] },
  { id: 'missing-exact-iqp', group: 'no-answer', language: 'en', text: 'Find an identical position, not a pawn-structure analogy.', fen: IQP, unit: 'occurrence', expected: [] },
  { id: 'missing-exact-iqp-de', group: 'no-answer', language: 'de', text: 'Finde exakt diese Stellung, kein Beispiel mit nur gleicher Bauernstruktur.', fen: IQP, unit: 'occurrence', expected: [] },
  { id: 'missing-castling-rights', group: 'no-answer', language: 'en', text: 'Find this exact diagram with castling rights removed.', fen: CASTLING.replace('KQkq', '-'), unit: 'occurrence', expected: [] },
  { id: 'missing-en-passant', group: 'no-answer', language: 'de', text: 'Finde dieselbe Stellung ohne en-passant-Recht.', fen: EP.replace('d6', '-'), unit: 'occurrence', expected: [] },
  { id: 'missing-side', group: 'no-answer', language: 'en', text: 'Find this exact rook position with Black to move.', fen: CASTLING.replace(' w ', ' b '), unit: 'occurrence', expected: [] },
  { id: 'excluded-only-match', group: 'no-answer', language: 'de', text: 'Finde diese Studie außerhalb der gerade geöffneten Saavedra-Studie.', fen: '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1', unit: 'occurrence', excludeGameId: 'st-saavedra', expected: [] },
];
