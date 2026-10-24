// Original Kibitz teaching material; no imported prose or external puzzle database (TODO 6.1).
import { TACTICS } from './tactics.js';
const words = (en, de) => ({ en, de });
const source = { title: words('Kibitz original curriculum', 'Kibitz: eigene Lerninhalte'), author: 'Kibitz contributors', licence: 'GPL-3.0-or-later' };
/** @type {import('./curriculum.js').Curriculum} */
export const CURRICULUM = { version: 1, source, modules: [
  { id: 'tactics', title: words('Tactical foundations', 'Taktische Grundlagen'), level: 1, tags: [...new Set(['mate', 'back-rank', ...TACTICS.flatMap(l => l.tags)])], lessons: [
    { id: 'back-rank-mate', title: words('A trapped king on the back rank', 'Ein gefangener König auf der Grundreihe'), level: 1, tags: ['mate', 'back-rank'], prerequisites: [],
      introduction: words('A rook can give mate along the last rank when the enemy king has no safe square. Pawns in front of the king can block its escape. Check every escape square and every way to capture or block the checking piece.', 'Ein Turm kann auf der Grundreihe mattsetzen, wenn der gegnerische König kein sicheres Feld hat. Die eigenen Bauern vor dem König können die Flucht versperren. Prüfe alle Fluchtfelder und ob die Schachfigur geschlagen oder ihr Schach abgewehrt werden kann.'),
      objectives: [words('Identify the checking line and the king’s escape squares.', 'Erkenne die Schachlinie und die Fluchtfelder des Königs.'), words('Distinguish check from checkmate by checking every legal reply.', 'Unterscheide Schach und Matt, indem du alle legalen Antworten prüfst.')],
      exercises: [
        { id: 'back-rank-white', title: words('White closes the last rank', 'Weiß schließt die letzte Reihe'), level: 1, tags: ['mate', 'back-rank'], goal: 'mate',
          prompt: words('White to move: find a checkmate in one move.', 'Weiß am Zug: Finde ein Matt in einem Zug.'), fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', line: ['e1e8'],
          rubric: [words('The rook gives check along the king’s rank, and the pawns prevent escape.', 'Der Turm gibt auf der Reihe des Königs Schach, und die Bauern verhindern die Flucht.')] },
        { id: 'back-rank-black', title: words('Black uses the same pattern', 'Schwarz nutzt dasselbe Muster'), level: 1, tags: ['mate', 'back-rank'], goal: 'mate',
          prompt: words('Black to move: find a checkmate in one move.', 'Schwarz am Zug: Finde ein Matt in einem Zug.'), fen: '4r1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', line: ['e8e1'],
          rubric: [words('The same escape-square check works for either colour.', 'Dieselbe Prüfung der Fluchtfelder funktioniert für beide Farben.')] },
      ] },
    ...TACTICS,
  ] },
  { id: 'strategy', title: words('Planning foundations', 'Grundlagen der Planung'), level: 2, tags: ['planning', 'king-activity'], lessons: [
    { id: 'active-king', title: words('Give the king a useful role', 'Gib dem König eine aktive Rolle'), level: 2, tags: ['planning', 'king-activity', 'pawn-endgame'], prerequisites: [],
      introduction: words('With few attacking pieces left, the king can help pawns and contest central squares. First check whether a route is safe. A useful-looking route does not prove a win: pawn races and the opponent’s replies still matter.', 'Wenn nur wenige Angriffsfiguren übrig sind, kann der König Bauern unterstützen und zentrale Felder besetzen. Prüfe zuerst, ob der Weg sicher ist. Ein nützlich aussehender Weg beweist keinen Gewinn: Bauernrennen und gegnerische Antworten bleiben entscheidend.'),
      objectives: [words('Describe what the king could help without declaring the position won.', 'Beschreibe, wobei der König helfen könnte, ohne die Stellung als gewonnen zu bezeichnen.'), words('Ask what the opponent can do while the king travels.', 'Frage, was der Gegner während des Königsmarsches tun kann.')],
      exercises: [
        { id: 'king-route-reflection', title: words('Compare a route with the opponent’s plan', 'Vergleiche einen Weg mit dem gegnerischen Plan'), level: 2, tags: ['planning', 'king-activity', 'pawn-endgame'], goal: 'reflection',
          prompt: words('Explain what a move towards the centre might help and what you would check before choosing it.', 'Erkläre, wobei ein Zug zum Zentrum helfen könnte und was du vor der Entscheidung prüfen würdest.'), fen: '7k/7p/8/8/8/5K2/P7/8 w - - 0 1', line: ['f3e4'],
          rubric: [words('Discuss central access, support for the pawn and the opponent’s pawn race; no unique best move or winning result is asserted.', 'Besprich den Zugang zum Zentrum, die Unterstützung des Bauern und das gegnerische Bauernrennen; ein eindeutig bester Zug oder ein Gewinn wird nicht behauptet.')] },
      ] },
  ] },
  { id: 'endgames', title: words('Endgame foundations', 'Endspielgrundlagen'), level: 1, tags: ['endgame', 'mate'], lessons: [
    { id: 'queen-and-king-mate', title: words('Queen and king work together', 'Dame und König arbeiten zusammen'), level: 1, tags: ['endgame', 'mate'], prerequisites: ['back-rank-mate'],
      introduction: words('The queen controls ranks, files and diagonals. Its king can protect the final checking square. Before moving, check that the enemy king will be in check rather than merely unable to move: a trapped king without check is stalemate.', 'Die Dame kontrolliert Reihen, Linien und Diagonalen. Ihr König kann das letzte Schachfeld decken. Prüfe vor dem Zug, ob der gegnerische König im Schach steht und nicht nur zugunfähig ist: Ein gefangener König ohne Schach ist patt.'),
      objectives: [words('Find a checking square protected by your king.', 'Finde ein Schachfeld, das dein König deckt.'), words('Avoid confusing stalemate with checkmate.', 'Verwechsle Patt nicht mit Matt.')],
      exercises: [
        { id: 'queen-mate-white', title: words('Finish the mating net with White', 'Vollende das Mattnetz mit Weiß'), level: 1, tags: ['endgame', 'mate'], goal: 'mate',
          prompt: words('White to move: find a checkmate in one move.', 'Weiß am Zug: Finde ein Matt in einem Zug.'), fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', line: ['g6g7'],
          rubric: [words('The king protects the checking queen and every escape square is controlled.', 'Der König deckt die schachgebende Dame, und alle Fluchtfelder sind kontrolliert.')] },
        { id: 'queen-mate-black', title: words('Finish the mating net with Black', 'Vollende das Mattnetz mit Schwarz'), level: 1, tags: ['endgame', 'mate'], goal: 'mate',
          prompt: words('Black to move: find a checkmate in one move.', 'Schwarz am Zug: Finde ein Matt in einem Zug.'), fen: '8/8/8/8/8/5kq1/8/7K b - - 0 1', line: ['g3g2'],
          rubric: [words('Checkmate depends on the position, not on which colour is moving.', 'Matt hängt von der Stellung ab und nicht davon, welche Farbe am Zug ist.')] },
      ] },
  ] },
] };
