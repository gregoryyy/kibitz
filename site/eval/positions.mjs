// The tutor eval set (TODO 3.8): reference positions with the key points a good answer should hit.
// Each position is set up from its moves (or a FEN), the coach gets a question, and the answer is
// scored by eval/score.mjs: key points by pattern, wrong moves by the app's own answer check, and
// optionally an LLM judge. The best moves were checked with Stockfish 19 at depth 18.
//
// Position: id, title, moves (SAN from the start) or fen (+ optional moves), chip (the label of the
// quick question to ask, so every provider gets the app's own wording), and keyPoints:
// [{point, all: [regex, ...]}], where every regex (case-insensitive) must match for the point to count.

export const POSITIONS = [
  {
    id: 'opera-b5', title: 'Opera Game, after 9… b5',
    moves: 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5',
    chip: 'Explain the best move',
    keyPoints: [
      { point: 'names 10. Nxb5', all: ['Nxb5'] },
      { point: 'it is a sacrifice', all: ['sacrific|gives? (up )?(a |the )?(piece|knight)|piece for'] },
      { point: 'Black is behind in development, the king in the centre', all: ['develop|uncastled|castl|king (is |stays |remains |still )?(stuck )?(in|on) (the )?(cent|e8)'] },
      { point: 'lines open against the king', all: ['open'] },
    ],
  },
  {
    id: 'qh5-threat', title: '1. e4 e5 2. Qh5 Nc6 3. Bc4: Black to move',
    moves: 'e4 e5 Qh5 Nc6 Bc4',
    chip: 'Any tactics?',
    keyPoints: [
      { point: 'White threatens Qxf7 mate', all: ['Qxf7|f7', 'mate'] },
      { point: 'a defence: g6, Qe7 or Qf6', all: ['\\bg6\\b|Qe7|Qf6'] },
    ],
  },
  {
    id: 'qg5-fork', title: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5: Black to move',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5',
    chip: 'Any tactics?',
    keyPoints: [
      { point: 'names Qg5', all: ['Qg5'] },
      { point: 'a double attack on the knight and g2', all: ['e5|knight', 'g2'] },
    ],
  },
  {
    id: 'elephant-trap', title: 'Queen\'s Gambit: the Elephant Trap after 6. Nxd5',
    moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5',
    chip: 'Any tactics?',
    keyPoints: [
      { point: 'names Nxd5', all: ['Nxd5'] },
      { point: 'answers Bxd8 with Bb4+', all: ['Bb4'] },
      { point: 'Black wins material', all: ['win|piece|up'] },
    ],
  },
  {
    id: 'back-rank', title: 'A back-rank mate in one',
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    chip: 'Explain the best move',
    keyPoints: [
      { point: 'names Ra8#', all: ['Ra8'] },
      { point: 'it is mate', all: ['mate'] },
      { point: 'the king is stuck behind its own pawns', all: ['back.?rank|pawns|f7|g7|h7|escape'] },
    ],
  },
  {
    id: 'iqp-break', title: 'Steinitz–von Bardeleben, before 17. d5',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 d5 exd5 Nxd5 O-O Be6 Bg5 Be7 Bxd5 Bxd5 Nxd5 Qxd5 Bxe7 Nxe7 Re1 f6 Qe2 Qd7 Rac1 c6',
    chip: 'What\'s the plan?',
    keyPoints: [
      { point: 'the d5 break', all: ['\\bd5\\b'] },
      { point: 'the isolated pawn', all: ['isolat|IQP|d4'] },
      { point: 'against the king in the centre / open lines', all: ['king|e-file|open'] },
    ],
  },
  {
    id: 'opposition', title: 'King and pawn: Black has the opposition',
    fen: '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1',
    chip: 'What\'s the plan?',
    keyPoints: [
      { point: 'the opposition', all: ['opposition'] },
      { point: 'a draw with best play', all: ['draw'] },
    ],
  },
  {
    id: 'lucena', title: 'The Lucena position',
    fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
    chip: 'Explain the best move',
    keyPoints: [
      { point: 'cuts the king off or checks it away (Rd1+)', all: ['Rd1|cut'] },
      { point: 'the bridge on the fourth rank', all: ['bridge|Rd4|fourth rank|4th rank|shield'] },
      { point: 'White wins', all: ['win'] },
    ],
  },
  {
    id: 'philidor', title: 'The Philidor position: Black to move',
    fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
    chip: 'What\'s the plan?',
    keyPoints: [
      { point: 'the rook holds its rank (the sixth)', all: ['sixth|6th|third|3rd|rank'] },
      { point: 'checks from behind once the pawn advances', all: ['behind|checks?'] },
      { point: 'a draw', all: ['draw'] },
    ],
  },
  {
    id: 'sicilian-d4', title: 'Sicilian after 3. d4',
    moves: 'e4 c5 Nf3 d6 d4',
    chip: 'What\'s the plan?',
    keyPoints: [
      { point: 'takes on d4 (cxd4)', all: ['cxd4'] },
      { point: 'the half-open c-file or the central pawn majority', all: ['c-file|half-open|semi-open|majority|centre|center'] },
      { point: 'develops (Nf6)', all: ['Nf6|develop'] },
    ],
  },
];
