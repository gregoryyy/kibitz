// Checked chess facts for curated problems. General imported study records keep their own status.
import { tablebaseKey, verifyTablebaseLine } from '../curriculum/tablebase.js';
const requireFact = (ok, message) => { if (!ok) throw new Error('Invalid curated problem: ' + message); };
/**
 * Evidence belongs to an exact curated document/root/line and its separately declared source.
 * It certifies WDL preservation along this recorded branch, and actual mate when requested.
 * Neither annotations nor arbitrary alternatives acquire a strength/uniqueness certificate.
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {Awaited<ReturnType<typeof import('./library.js').compileLibraryGame>>} snapshot
 * @param {{id: string, fen: string, line: string[], goal: string, outcome: import('../curriculum/tablebase.js').TablebaseOutcome, source: {title: string, author: string, url: string, score: string}}} definition
 * @param {(fen: string) => import('../curriculum/tablebase.js').TablebaseSnapshot} lookup
 */
export function verifiedProblemEvidence(Chess, snapshot, definition, lookup) {
  if (!definition || snapshot.document.collection !== 'classic' || snapshot.document.localId !== definition.id) return null;
  requireFact(snapshot.problem && snapshot.occurrences.length > 1, 'a recorded study line is required');
  const root = snapshot.occurrences[0], c = new Chess(root.fen);
  requireFact(root.fen === tablebaseKey(Chess, definition.fen) && !c.isGameOver(), 'exact unfinished full FEN');
  requireFact(['mate-in-one', 'study'].includes(definition.goal), 'goal');
  requireFact(Array.isArray(definition.line) && definition.line.length > 0 && definition.line.length <= 40
    && JSON.stringify(snapshot.problem.line) === JSON.stringify(definition.line), 'recorded branch');
  requireFact(snapshot.problem.occurrenceId === root.id && snapshot.problem.documentId === snapshot.document.id, 'source occurrence');
  const result = definition.outcome === 'draw' ? '1/2-1/2' : definition.outcome === 'white-win' ? '1-0' : '0-1';
  requireFact(snapshot.problem.statedResult === result && snapshot.problem.sourceId === snapshot.source.id, 'source result');
  const source = definition.source;
  requireFact(source && snapshot.source.title === source.title && snapshot.source.author === source.author && snapshot.source.url === source.url
    && snapshot.source.rights.score === source.score, 'source/score rights');
  const tablebase = verifyTablebaseLine(Chess, { fen: root.fen, line: definition.line, tablebase: { outcome: definition.outcome } }, lookup);
  const matingMoves = [];
  if (definition.goal === 'mate-in-one') {
    requireFact(definition.line.length === 1, 'mate-in-one length');
    const first = definition.line[0], m = c.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] });
    requireFact(c.isCheckmate() && tablebase.outcome === (m.color === 'w' ? 'white-win' : 'black-win'), 'actual checkmate');
    const board = new Chess(root.fen);
    for (const candidate of board.moves({ verbose: true })) {
      board.move(candidate.san);
      if (board.isCheckmate()) matingMoves.push(candidate.from + candidate.to + (candidate.promotion || ''));
      board.undo();
    }
    requireFact(matingMoves.includes(first), 'recorded mate');
  }
  return { goal: definition.goal, outcome: tablebase.outcome, tablebase, matingMoves };
}
