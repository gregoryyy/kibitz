// The flipbook's happy path through Kibitz: the single source of truth for docs/flipbook/.
// scripts/flipbook.mjs serves the build, drives the page headlessly with Playwright, applies each
// step's acts and takes one screenshot per step. Edit this file, then run `just flipbook`; the
// screenshots are never edited by hand, so they can't drift from the app.
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
//            {ask: chip label | question}   a quick-question chip, or a typed question; waits for the answer
//            {confirm: true}                accept the confirmation under the board
//            {waitFor}, {wait: ms}          a selector to become visible, or a pause
//            {scroll}                       scroll a selector into view
//            {viewport: {width, height}}, {scheme: 'light' | 'dark'}
//            {js}                           a function run in the page (the ?debug hook is on)
//   settle   optional selector to wait for after the acts

// The Opera Game (Morphy, Paris 1858): short, famous, and the review finds clear turning points.
const OPERA = '[Event "Paris"]\n[Date "1858.??.??"]\n[White "Paul Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0';

export const meta = {
  title: 'Kibitz flipbook',
  intro:
    'A happy path through **Kibitz**, the neurosymbolic chess coach: Stockfish plays and measures, a language model explains. ' +
    'It plays a short game against Stockfish, asks the coach about it, then loads a classic game for analysis, review, the library and the reading list, ' +
    'and ends with the coach settings, the phone layout and dark mode. How it is built is in [ARCH.md](../ARCH.md).',
};

export const steps = [
  {
    id: 'start',
    title: 'The board and the coaching desk',
    acts: [],
    caption:
      'Kibitz opens on the board, with the coaching desk beside it. Stockfish runs in the page as WebAssembly, so analysis and play need no server. ' +
      'The **Game** tab sets up a game: your colour, the start position, Stockfish\'s strength, style and clock, how much the engine may help while you play, ' +
      'and your level, which sets the coach\'s language.',
  },
  {
    id: 'new-game',
    title: 'Set up a game',
    acts: [
      { click: '#optColor button[data-v="w"]' },
      { range: '#optElo', value: 1200 },
      { click: '#optHelp button[data-v="flags"]' },
      { click: '#optLevel button[data-v="2"]' },
    ],
    caption:
      'White against Stockfish at 1200 Elo, with **Flag mistakes** as the live help: the engine says when a move was a mistake, but not what to play. ' +
      'The level is **Club**, so the coach explains for a club player.',
  },
  {
    id: 'opening',
    title: 'Play the opening',
    acts: [
      { click: '#btnNewGame' },
      { move: ['e4'] },
      { move: ['Nf3', 'Nc3'] },
      { move: ['Bc4', 'd4', 'Nc3', 'Be2'] },
      { move: ['O-O', 'Nc3', 'd3', 'c3'] },
    ],
    caption:
      'Moves are played on the board or typed (`e4`, `Nf3`, `O-O`), and Stockfish replies at the chosen strength. ' +
      'The move list names the opening as it goes, and the eval bar beside the board shows who stands better.',
  },
  {
    id: 'hint',
    title: 'Ask for a hint',
    acts: [{ click: '#btnHint' }, { wait: 2500 }],
    caption:
      'A hint draws Stockfish\'s choice as a yellow arrow, and names the motif when the move has one (a fork, a pin, a discovered attack). ' +
      'The game counts hints, and the review reports them.',
  },
  {
    id: 'quick-question',
    title: 'A quick question to the coach',
    acts: [{ tab: 'coach' }, { ask: 'What\'s the plan?' }],
    caption:
      'The quick questions ask the coach about the position on the board. The coach only sees what the help setting allows, so asking can\'t spoil the game: ' +
      'with **Flag mistakes** it gets the position and the flags, not Stockfish\'s lines. ' +
      'Moves it names are checked with chess.js against the engine, and the ones that don\'t hold up are struck through.',
  },
  {
    id: 'typed-question',
    title: 'Talk about the game',
    acts: [{ ask: 'Which piece should I develop next, and why?' }],
    caption:
      'Anything can be typed into the dialogue. The answer is tied to the game and the move it was about, and the history stays when you switch tabs.',
  },
  {
    id: 'game-over',
    title: 'Resign, and the game is saved',
    acts: [{ click: '#btnResign' }, { confirm: true }, { tab: 'game' }, { wait: 2600 }], // the toast fades after 2.2 s
    settle: '#flagSlot',
    caption:
      'A finished game, won, lost or resigned, goes into the library in the browser\'s storage, ready for review. Nothing is uploaded.',
  },
  {
    id: 'analysis',
    title: 'Load a classic for analysis',
    acts: [
      { js: () => { /** @type {HTMLDetailsElement} */ (document.querySelector('details:has(#loadText)')).open = true; } },
      { fill: '#loadText', value: OPERA },
      { click: '#btnLoad' },
      { waitFor: '#moves button' },
      { click: '#moves button >> nth=18' },
      { wait: 3000 },
    ],
    caption:
      'A FEN or a PGN loads into analysis: here the Opera Game, Morphy against the Duke of Brunswick and Count Isouard, Paris 1858, at 10. Nxb5, the knight sacrifice. ' +
      'Stockfish analyses each position as you step through the moves, and the eval bar follows.',
  },
  {
    id: 'review',
    title: 'Review the game',
    acts: [
      { tab: 'review' },
      { click: '#btnReview' },
      { waitFor: '#reviewBody .tiles' },
      { waitFor: '#btnSummary' },
    ],
    caption:
      'The review runs Stockfish over every position. It scores each move, gives both sides an accuracy, draws the evaluation over the game and lists the turning points, ' +
      'each with a button to show it on the board and one to ask the coach about it.',
  },
  {
    id: 'review-summary',
    title: 'The coach\'s summary',
    acts: [{ click: '#btnSummary' }, { waitFor: '#btnSummary:has-text("Rewrite")' }, { scroll: '#summaryBox' }],
    caption:
      'The coach turns the numbers into a short write-up: the opening, what decided the game, and what to practise. ' +
      'It gets the engine\'s facts (turning points, the best moves, the motifs that refute the mistakes) and the references retrieved for the game\'s themes, and only explains them.',
  },
  {
    id: 'library',
    title: 'The library',
    acts: [{ tab: 'library' }],
    caption:
      'Saved and imported games, searchable. Imported PGN comments are indexed, so the coach can quote an annotation when a similar position comes up later.',
  },
  {
    id: 'reading',
    title: 'Reading for this position',
    acts: [{ tab: 'reading' }],
    caption:
      'The position\'s themes, from the opening family to pawn structures and tactical motifs, and the books, courses and classic games that teach them, chosen for your level. ' +
      'Retrieval is structured: by position, pawn structure and theme, not by embeddings.',
  },
  {
    id: 'coach-settings',
    title: 'Coach settings',
    acts: [
      { tab: 'coach' },
      { js: () => { const d = /** @type {HTMLDetailsElement} */ (document.querySelector('#coachSettings')); d.hidden = false; d.open = true; } },
      { click: '#btnTestAi' },
      { waitFor: '#testAiMsg:not(:empty)' },
      { scroll: '#coachSettings' },
    ],
    caption:
      'The AI provider: Claude, OpenAI, Mistral, Ollama, or a small model running in the browser. Keys stay in `.env` on the server and never reach the page. ' +
      '**Local only** keeps everything on this machine. Without any provider, play, analysis, flags, review and reading all still work.',
  },
  {
    id: 'phone',
    title: 'On a phone',
    acts: [{ viewport: { width: 390, height: 844 } }, { js: () => window.scrollTo(0, 0) }, { wait: 800 }],
    caption: 'On a phone the desk follows the board in one column.',
  },
  {
    id: 'dark',
    title: 'Dark mode',
    acts: [{ viewport: { width: 1360, height: 900 } }, { scheme: 'dark' }, { tab: 'game' }, { js: () => window.scrollTo(0, 0) }, { wait: 800 }],
    caption: 'Kibitz follows the system\'s colour scheme.',
  },
];
