// The flipbook's happy path through Kibitz: the single source of truth for docs/flipbook/.
// scripts/flipbook.mjs serves the build, drives the page headlessly with Playwright, applies each
// step's acts and takes one screenshot per step. The coach's answers are quoted under the shots.
// Edit this file, then run `just flipbook`; the screenshots are never edited by hand, so they
// can't drift from the app.
//
// Step shape:
//   id       kebab-case id, also the screenshot's name (NN-id.png)
//   title    the step's heading
//   caption  the narration under the screenshot (Markdown)
//   acts     UI actions, applied in order before the screenshot:
//            {tab}                          open a tab (game, coach, review, library, reading)
//            {click}, {fill, value}         a selector, and the text to type
//            {range, value}                 set a slider
//            {move: [san, ...]}             type the first legal move of the list, then wait for Stockfish's reply
//            {comment: true}                with a move: also wait for the coach's comment on it, and quote it
//            {ply: n}                       go to the position after ply n of the game (0 = start)
//            {ask: chip label | question}   a quick-question chip, or a typed question; waits for the answer and quotes it
//            {askBy: selector}              a button that asks the coach (e.g. a turning point's Explain)
//            {capture: selector, button, done, label}  click the button, wait for `done`, quote the text in selector
//            {hover}                        hover a selector, e.g. a move in the coach's answer
//            {confirm: true}                accept the confirmation under the board
//            {waitFor}, {wait: ms}          a selector to become visible, or a pause
//            {scroll}                       scroll a selector into view
//            {viewport: {width, height}}, {scheme: 'light' | 'dark'}
//            {js}                           a function run in the page (the ?debug hook is on)
//   settle   optional selector to wait for after the acts

// The Opera Game (Morphy, Paris 1858): short and famous. Black falls behind in development, and
// White's sacrifices open the lines against the uncastled king, so there is a lot to explain.
const OPERA = '[Event "Paris"]\n[Date "1858.??.??"]\n[White "Paul Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';
// The position after 9... b5, White to move, for playing the sacrifice yourself.
const AFTER_B5 = 'rn2kb1r/p3qppp/2p2n2/1p2p1B1/2B1P3/1QN5/PPP2PPP/R3K2R w KQkq - 0 10';

export const meta = {
  title: 'Kibitz flipbook: the Opera Game, explained',
  intro:
    '**Kibitz** is a neurosymbolic chess coach: Stockfish calculates, and a language model explains. ' +
    'This walkthrough follows one famous game, Morphy\'s Opera Game (Paris, 1858), to show what the model adds to the engine\'s numbers. ' +
    'It reads the position and the evaluation graph in words, proposes ideas of its own, and turns the turning points into something a club player can learn from. ' +
    'Everything it says about concrete moves is checked against Stockfish: under each answer, the flipbook counts the moves the engine backs, the legal ones it doesn\'t list, and the wrong ones, which the app strikes through. ' +
    'How it is built is in [ARCH.md](../ARCH.md).',
};

export const steps = [
  {
    id: 'load',
    title: 'Load a classic',
    acts: [
      { click: '#btnSettings' }, { click: '#optLevel button[data-v="2"]' }, { click: '#btnSettingsClose' },
      { js: () => { /** @type {HTMLDetailsElement} */ (document.querySelector('details:has(#loadText)')).open = true; } },
      { fill: '#loadText', value: OPERA },
      { click: '#btnLoad' },
      { waitFor: '#moves button' },
      { ply: 17 },
      { wait: 3000 },
    ],
    caption:
      'A PGN pasted on the **Game** tab loads into analysis. The level is **Club**, so the coach explains for a club player. ' +
      'The board shows the position after 9. Bg5: White has developed four pieces and is ready to castle queenside, while Black\'s king and kingside are still at home. ' +
      'Stockfish analyses each position as you step through the moves, and the eval bar beside the board follows.',
  },
  {
    id: 'plan',
    title: 'What is the plan?',
    acts: [{ ask: 'What\'s the plan?' }],
    caption:
      'A quick question about the position on the board. The model gets the facts first: the position, Stockfish\'s top lines with their scores, the motifs in the best move and the player\'s level. ' +
      'It answers in plans and reasons, not in numbers.',
  },
  {
    id: 'own-idea',
    title: 'The coach\'s own idea, checked by the engine',
    acts: [
      { ask: 'Leave Stockfish\'s first choice aside for a moment. What would you play here as Black, and why? Suggest an idea of your own that a club player would understand, then say honestly how it compares with the engine\'s lines.' },
      { hover: '#chat .msg.coach:last-child .san:not(.invalid)' },
      { wait: 600 },
    ],
    caption:
      'Asked for its own idea, the model proposes a move and argues for it. Then it measures the idea against the engine\'s lines instead of just repeating them. ' +
      'Every move it names is checked with chess.js and against Stockfish\'s lines. Moves the engine backs are highlighted, legal moves it doesn\'t list are greyed, and the rest are struck through, including legal moves strung into a line that Stockfish doesn\'t have. ' +
      'Hovering a move in the answer draws it on the board, as here.',
  },
  {
    id: 'sacrifice',
    title: 'Explain the sacrifice',
    acts: [{ ply: 18 }, { wait: 3000 }, { ask: 'Explain the best move' }],
    caption:
      'Black played 9... b5, and Stockfish\'s answer is 10. Nxb5!, a knight sacrifice. ' +
      'The engine only says that it wins. The coach explains why: which lines open, which black pieces can\'t join in, and what White threatens next.',
  },
  {
    id: 'why-not-take',
    title: 'A follow-up question',
    acts: [{ ask: 'If Black takes the knight with cxb5, Black is a piece up. Why is that still so bad for Black? Show me the key line.' }],
    caption:
      'Follow-up questions keep the context: the game, the position and the earlier answers. The key line the model quotes has to match the engine\'s line to be marked as backed.',
  },
  {
    id: 'review',
    title: 'Review: the evaluation graph and the turning points',
    acts: [
      { tab: 'review' },
      { click: '#btnReview' },
      { waitFor: '#reviewBody .moments' },
      { waitFor: '#btnSummary' },
    ],
    caption:
      'The review runs Stockfish over every position. It scores each move, gives both sides an accuracy, draws the evaluation over the game and lists the turning points. ' +
      'This is the symbolic side on its own: exact, and silent about why.',
  },
  {
    id: 'read-the-graph',
    title: 'The coach reads the graph',
    acts: [{ ask: 'Read the evaluation graph of this game for me. Where did it turn, and what did Black\'s mistakes have in common?' }],
    caption:
      'The model turns the curve into a story: where the evaluation moved, and the pattern behind Black\'s mistakes. ' +
      'It finds that pattern itself, across moves that the engine scored one at a time.',
  },
  {
    id: 'turning-point',
    title: 'Explain a turning point',
    acts: [{ askBy: '#reviewBody .moment:has-text("9… b5") button:has-text("Explain")' }],
    caption:
      'Each turning point has an **Explain** button. The coach gets the position before the move, the move played, the engine\'s better move with its line, and the motifs that refute the mistake.',
  },
  {
    id: 'summary',
    title: 'The coach\'s summary',
    acts: [{ capture: '#summaryBox', button: '#btnSummary', done: '#btnSummary:has-text("Rewrite")', label: 'Coach summary' }, { scroll: '#summaryBox' }],
    caption:
      'A short write-up of the whole game: the opening, what decided it, and what to practise. ' +
      'The model gets the turning points, the best moves and the motifs, and the references retrieved for the game\'s themes, and only explains them.',
  },
  {
    id: 'study-plan',
    title: 'A study plan from the game',
    acts: [{ tab: 'reading' }, { capture: '#studyPlan', button: '#btnStudyPlan', done: '#btnStudyPlan:enabled', label: 'Study plan' }, { scroll: '#studyPlan' }],
    caption:
      'The **Reading** tab lists the position\'s themes and the books and classic games that teach them, found by position, pawn structure and theme. ' +
      'From these, the coach writes a study plan that fits the player\'s level.',
  },
  {
    id: 'your-turn',
    title: 'Your turn: play the sacrifice yourself',
    acts: [
      { tab: 'coach' },
      { click: '#btnSettings' }, { click: '#optCommentWhen button[data-v="every"]' }, { click: '#btnSettingsClose' },
      { tab: 'game' },
      { click: '#optColor button[data-v="w"]' },
      { click: '#optStart button[data-v="fen"]' },
      { fill: '#fenInput', value: AFTER_B5 },
      { click: '#optHelp button[data-v="full"]' },
      { click: '#btnNewGame' },
      { wait: 1000 },
      { move: ['Nxb5'], comment: true },
    ],
    caption:
      'A new game from the position after 9... b5, against Stockfish, with the coach set to comment after every move. You play 10. Nxb5, Stockfish replies, and the coach comments beside the board. ' +
      'In a game, the help setting limits what the coach sees. Here it is **Full engine**, so the coach gets Stockfish\'s lines; with **Flag mistakes** it would only learn how your move rated, so it couldn\'t give the game away.',
  },
];
