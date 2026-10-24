// Original bilingual teaching notes for conventional endgame diagrams (TODO 6.4).
// The recorded branches illustrate a method; Syzygy checks their result, not uniqueness.
const text = (en, de) => ({ en, de });
/**
 * @param {string} id Stable identifier.
 * @param {import('./curriculum.js').LessonText} title Bilingual title.
 * @param {number} level Teaching level.
 * @param {string[]} tags Themes.
 * @param {import('./curriculum.js').LessonText} prompt Question.
 * @param {string} fen Exact position, including counters.
 * @param {string[]} line Legal worked example.
 * @param {import('./tablebase.js').TablebaseOutcome} outcome Result from White's perspective.
 * @param {import('./curriculum.js').LessonText} rubric Authored explanation.
 * @param {'mate'|'reflection'} [goal]
 * @returns {import('./curriculum.js').Exercise}
 */
const exercise = (id, title, level, tags, prompt, fen, line, outcome, rubric, goal = 'reflection') =>
  ({ id, title, level, tags, prompt, fen, line, goal, rubric: [rubric], tablebase: { outcome } });

/** @type {import('./curriculum.js').Lesson[]} */
export const ENDGAMES = [
  { id: 'rook-and-king-mate', title: text('Close the edge with rook and king', 'Schließe den Rand mit Turm und König'), level: 1, tags: ['endgame', 'mate'], prerequisites: ['queen-and-king-mate'],
    introduction: text('The rook cuts off a rank or file while its king controls nearby escape squares. In the final position, the kings can face each other with one square between them. Check that the rook gives check and cannot be captured; restricting the king without check can be stalemate.', 'Der Turm schneidet eine Reihe oder Linie ab, während sein König nahe Fluchtfelder kontrolliert. In der Schlussstellung können die Könige mit einem Feld Abstand einander gegenüberstehen. Prüfe, ob der Turm Schach gibt und nicht geschlagen werden kann; Einschränkung ohne Schach kann Patt sein.'),
    objectives: [text('Combine the rook’s checking line with the king’s control of escape squares.', 'Verbinde die Schachlinie des Turms mit der Kontrolle der Fluchtfelder durch den König.')],
    exercises: [
      exercise('rook-mate-white', text('White finishes on the edge', 'Weiß setzt am Rand matt'), 1, ['endgame', 'mate'], text('Find a checkmate in one with White.', 'Finde ein Matt in einem Zug mit Weiß.'),
        '7k/5R2/6K1/8/8/8/8/8 w - - 0 1', ['f7f8'], 'white-win', text('Rf8 gives check on the eighth rank. The white king controls g7 and h7; g8 is controlled by the rook.', 'Tf8 gibt auf der achten Reihe Schach. Der weiße König kontrolliert g7 und h7; g8 wird vom Turm kontrolliert.'), 'mate'),
      exercise('rook-mate-black', text('Black finishes on the edge', 'Schwarz setzt am Rand matt'), 1, ['endgame', 'mate'], text('Find a checkmate in one with Black.', 'Finde ein Matt in einem Zug mit Schwarz.'),
        '8/8/8/8/8/6k1/5r2/7K b - - 0 1', ['f2f1'], 'black-win', text('Rf1 checks along the first rank. The black king controls g2 and h2, and the rook controls g1.', 'Tf1 gibt auf der ersten Reihe Schach. Der schwarze König kontrolliert g2 und h2, und der Turm kontrolliert g1.'), 'mate'),
    ] },
  { id: 'king-and-pawn', title: text('Support the pawn and check the corner', 'Unterstütze den Bauern und prüfe die Ecke'), level: 2, tags: ['endgame', 'pawn-endgame', 'promotion'], prerequisites: ['active-king'],
    introduction: text('King support and access to the promotion square matter more than simply owning an extra pawn. A rook pawn is an important exception: the defending king may draw in the corner even against an extra pawn and active king. Judge the exact position, including whose turn it is.', 'Königsunterstützung und Zugang zum Umwandlungsfeld sind wichtiger als ein Mehrbauer allein. Ein Randbauer ist eine wichtige Ausnahme: Der verteidigende König kann in der Ecke trotz Mehrbauer und aktivem König remis halten. Beurteile die genaue Stellung einschließlich des Zugrechts.'),
    objectives: [text('Compare an available promotion with a rook pawn blocked by the defending king.', 'Vergleiche eine mögliche Umwandlung mit einem vom verteidigenden König blockierten Randbauern.')],
    exercises: [
      exercise('supported-promotion', text('A safe promotion square', 'Ein sicheres Umwandlungsfeld'), 2, ['endgame', 'pawn-endgame', 'promotion'], text('Can White promote without stalemating Black? Check the resulting legal replies.', 'Kann Weiß umwandeln, ohne Schwarz pattzusetzen? Prüfe die danach legalen Antworten.'),
        'k7/4P3/4K3/8/8/8/8/8 w - - 0 1', ['e7e8q'], 'white-win', text('The pawn can become a queen on e8. Black is in check and has legal king replies, so this is not stalemate; the tablebase records a White win.', 'Der Bauer kann auf e8 zur Dame werden. Schwarz steht im Schach und hat legale Königszüge; dies ist kein Patt. Die Tablebase verzeichnet einen weißen Gewinn.')),
      exercise('rook-pawn-corner', text('An extra pawn that cannot win', 'Ein Mehrbauer, der nicht gewinnt'), 2, ['endgame', 'pawn-endgame'], text('Why does the a-pawn not guarantee a win when the black king stays near a8?', 'Warum garantiert der a-Bauer keinen Gewinn, wenn der schwarze König bei a8 bleibt?'),
        'k7/P7/K7/8/8/8/8/8 w - - 0 1', ['a6b6'], 'draw', text('The black king blocks a8. Moving the white king away does not force the defender out of the corner; the exact position and recorded move are tablebase draws.', 'Der schwarze König blockiert a8. Das Wegziehen des weißen Königs zwingt den Verteidiger nicht aus der Ecke; die genaue Stellung und der Beispielzug sind laut Tablebase remis.')),
    ] },
  { id: 'opposition', title: text('The same kings, a different turn', 'Dieselben Könige, ein anderes Zugrecht'), level: 2, tags: ['endgame', 'pawn-endgame', 'opposition'], prerequisites: ['king-and-pawn'],
    introduction: text('With kings facing each other one square apart, the side to move must give way. This direct opposition can help a king gain access to key squares, but pawn moves, rook pawns and the exact rank can change the result. Compare the same placement with the turn reversed.', 'Stehen sich Könige mit einem Feld Abstand gegenüber, muss die Seite am Zug ausweichen. Diese direkte Opposition kann Zugang zu Schlüsselfeldern ermöglichen; Bauernzüge, Randbauern und die genaue Reihe können das Ergebnis aber ändern. Vergleiche dieselbe Aufstellung mit vertauschtem Zugrecht.'),
    objectives: [text('Explain why side to move belongs to an endgame position, not just its piece placement.', 'Erkläre, warum das Zugrecht zur Endspielstellung gehört und nicht nur die Figurenaufstellung.')],
    exercises: [
      exercise('opposition-white-turn', text('White must move', 'Weiß muss ziehen'), 2, ['endgame', 'pawn-endgame', 'opposition'], text('Compare the kings on e4 and e6. Does White to move win?', 'Vergleiche die Könige e4 und e6. Gewinnt Weiß am Zug?'),
        '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', ['e4d4'], 'draw', text('With White to move, the exact position is drawn. Kd4 is one drawing move; an extra pawn alone does not settle the result.', 'Mit Weiß am Zug ist die genaue Stellung remis. Kd4 ist ein Remiszug; der Mehrbauer allein entscheidet das Ergebnis nicht.')),
      exercise('opposition-black-turn', text('Black must move', 'Schwarz muss ziehen'), 2, ['endgame', 'pawn-endgame', 'opposition'], text('Change only the turn to Black. Who can win with correct play?', 'Ändere nur das Zugrecht zu Schwarz. Wer kann bei richtigem Spiel gewinnen?'),
        '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', ['e6d6'], 'white-win', text('Black must yield the direct opposition. Syzygy records a loss for the side to move, which here means a White win; Kd6 does not change that result.', 'Schwarz muss die direkte Opposition aufgeben. Syzygy verzeichnet einen Verlust für die Seite am Zug; hier bedeutet das einen weißen Gewinn. Kd6 ändert dieses Ergebnis nicht.')),
    ] },
  { id: 'lucena-bridge', title: text('Lucena: build a bridge', 'Lucena: Baue eine Brücke'), level: 3, tags: ['endgame', 'rook-endgame', 'rook-pawn-vs-rook'], prerequisites: ['rook-and-king-mate', 'king-and-pawn'],
    introduction: text('In this Lucena diagram, the attacking king stands in front of its seventh-rank pawn and the defending king is cut off. Move the defending king farther away, prepare a rook on the fourth rank, then shelter the king from checks with that rook. The recorded branch illustrates the bridge; it is not the only defence or winning route.', 'In diesem Lucena-Diagramm steht der angreifende König vor seinem Bauern auf der siebten Reihe, und der verteidigende König ist abgeschnitten. Dränge ihn weiter ab, bereite einen Turm auf der vierten Reihe vor und schirme den König damit gegen Schachgebote ab. Die Beispielvariante zeigt die Brücke; sie ist weder die einzige Verteidigung noch der einzige Gewinnweg.'),
    objectives: [text('Identify the rook lift and the final interposition that shelters the king.', 'Erkenne das Turmmanöver und das abschließende Dazwischenziehen, das den König schützt.')],
    exercises: [exercise('lucena-worked-bridge', text('Prepare and use the fourth rank', 'Bereite die vierte Reihe vor und nutze sie'), 3, ['endgame', 'rook-endgame', 'rook-pawn-vs-rook'],
      text('Follow the checking branch. Why is the rook on d4 useful when the king reaches b5?', 'Verfolge die Schachvariante. Warum ist der Turm d4 nützlich, wenn der König b5 erreicht?'),
      '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', ['c1d1', 'd7e7', 'd1d4', 'a2a1', 'b8c7', 'a1c1', 'c7b6', 'c1b1', 'b6c6', 'b1c1', 'c6b5', 'c1b1', 'd4b4'], 'white-win',
      text('Rd4 prepares Rb4 to block the check on the b-file. Every recorded move preserves the tablebase White win; the branch demonstrates the method without proving that every opponent reply follows this sequence.', 'Td4 bereitet Tb4 vor, um das Schach auf der b-Linie zu blockieren. Jeder aufgezeichnete Zug erhält den weißen Tablebase-Gewinn; die Variante zeigt die Methode, ohne jede gegnerische Antwort auf diese Folge festzulegen.'))] },
  { id: 'philidor-defence', title: text('Philidor: wait, then check from behind', 'Philidor: Warte, dann gib von hinten Schach'), level: 3, tags: ['endgame', 'rook-endgame', 'rook-pawn-vs-rook'], prerequisites: ['lucena-bridge'],
    introduction: text('Here the defending rook holds the sixth rank, keeping the attacking king out. Once the pawn advances to that rank, the rook can switch behind it and check the king along open files. The exact diagram is drawn with correct defence; moving pieces to a similar-looking diagram may change that result.', 'Hier hält der verteidigende Turm die sechste Reihe und sperrt den angreifenden König aus. Sobald der Bauer auf diese Reihe vorrückt, kann der Turm hinter ihn wechseln und den König auf offenen Linien mit Schachgeboten verfolgen. Das genaue Diagramm ist bei richtiger Verteidigung remis; ähnliche Aufstellungen können ein anderes Ergebnis haben.'),
    objectives: [text('Recognize when the defender changes from a rank barrier to checks from behind.', 'Erkenne, wann der Verteidiger von der Reihensperre zu Schachgeboten von hinten wechselt.')],
    exercises: [exercise('philidor-worked-defence', text('Keep the king out, then change the rook’s job', 'Sperre den König aus und ändere dann die Turmaufgabe'), 3, ['endgame', 'rook-endgame', 'rook-pawn-vs-rook'],
      text('After the pawn reaches e6, why can the black rook leave the sixth rank?', 'Warum kann der schwarze Turm die sechste Reihe verlassen, nachdem der Bauer e6 erreicht?'),
      '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1', ['a6b6', 'e5e6', 'b6b1', 'd5d6', 'b1d1', 'd6e5', 'd1e1'], 'draw',
      text('The advanced pawn no longer gives the king shelter from checks behind it. Rb1 prepares Rd1+ and Re1+ in this branch; every recorded move preserves the tablebase draw.', 'Der vorgerückte Bauer bietet dem König keinen Schutz mehr gegen Schachgebote von hinten. Tb1 bereitet in dieser Variante Td1+ und Te1+ vor; jeder aufgezeichnete Zug erhält das Tablebase-Remis.'))] },
];
