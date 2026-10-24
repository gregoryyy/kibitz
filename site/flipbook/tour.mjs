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
//            {select, value, reload?}      choose an option (and await a language reload)
//            {press, key}                  press a key in a control
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
//   region   optional selector for a focused panel capture instead of the full viewport
//   frame    'top' keeps the board and chat together in a viewport capture

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
    'Recognized moves are checked against chess.js and captured engine/game evidence. Red underlines flag tokens the checker could not validate; legal moves outside the evidence remain unverified. These checks do not certify every prose claim. ' +
    'The walkthrough then follows the current library, opening repertoire, lessons and spaced practice, ending with the German phone interface. ' +
    'How it is built is in [ARCH.md](../ARCH.md).',
};

export const steps = [
  {
    id: 'load', frame: 'top',
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
      'The board shows the position after 9. Bg5: White has developed four pieces and is ready to castle queenside, while Black\'s king and queenside remain on the back rank. ' +
      'Stockfish analyses each position as you step through the moves, and the eval bar beside the board follows.',
  },
  {
    id: 'plan', frame: 'top',
    title: 'What is the plan?',
    acts: [{ ask: 'What\'s the plan?' }],
    caption:
      'A quick question about the position on the board. The model gets the facts first: the position, Stockfish\'s top lines with their scores, the motifs in the best move and the player\'s level. ' +
      'It answers in plans and reasons, not in numbers.',
  },
  {
    id: 'own-idea', frame: 'top',
    title: 'The coach\'s own idea, checked by the engine',
    acts: [
      { ask: 'Consider a candidate other than Stockfish\'s first choice for Black. Use the engine tools to compare it with the best move, then explain the trade-off to a club player. Quote only continuations supplied by the engine and say when evidence is missing.' },
      { hover: '#chat .msg.coach:last-child .san:not(.invalid)' },
      { wait: 600 },
    ],
    caption:
      'Asked for its own idea, the model proposes a move and argues for it. Then it measures the idea against the engine\'s lines instead of just repeating them. ' +
      'Recognized moves are checked with chess.js and against captured Stockfish/game evidence. Matching moves are highlighted, legal moves outside the evidence are greyed, and failed checks have a red underline. A flagged token can also be a piece reference or an impossible move discussed as such. ' +
      'Hovering a move in the answer draws it on the board, as here.',
  },
  {
    id: 'sacrifice', frame: 'top',
    title: 'Explain the sacrifice',
    acts: [{ ply: 18 }, { wait: 3000 }, { ask: 'Explain the best move' }],
    caption:
      'Black played 9... b5, and Stockfish\'s answer is 10. Nxb5!, a knight sacrifice. ' +
      'The engine supplies the evaluation and concrete lines. The coach explains the development and king-safety ideas; its explanation remains subject to the evidence and checks shown in the app.',
  },
  {
    id: 'why-not-take', frame: 'top',
    title: 'A follow-up question',
    acts: [{ ask: 'If Black takes the knight with cxb5, Black is a piece up. Why is that still so bad for Black? Show me the key line.' }],
    caption:
      'Follow-up questions keep the context: the game, the position and the earlier answers. The key line the model quotes has to match the engine\'s line to be marked as backed.',
  },
  {
    id: 'review', region: '#reviewBody',
    title: 'Review: the evaluation graph and the turning points',
    acts: [
      { tab: 'review' },
      { click: '#btnReview' },
      { waitFor: '#reviewBody .moments' },
      { waitFor: '#btnSummary' },
    ],
    caption:
      'The review runs Stockfish over every position. It scores each move, gives both sides an accuracy, draws the evaluation over the game and lists the turning points. ' +
      'These are engine measurements, separate from the model\'s explanation; scores and classifications can change with search depth.',
  },
  {
    id: 'read-the-graph', frame: 'top',
    title: 'The coach reads the graph',
    acts: [{ ask: 'Read the evaluation graph of this game for me. Where did it turn, and what did Black\'s mistakes have in common?' }],
    caption:
      'The model turns the curve into a story: where the evaluation moved, and the pattern behind Black\'s mistakes. ' +
      'It finds that pattern itself, across moves that the engine scored one at a time.',
  },
  {
    id: 'turning-point', frame: 'top',
    title: 'Explain a turning point',
    acts: [{ askBy: '#reviewBody .moment:has-text("9… b5") button:has-text("Explain")' }],
    caption:
      'Each turning point has an **Explain** button. The coach gets the position before the move, the move played, the engine\'s better move with its line, and the motifs that refute the mistake.',
  },
  {
    id: 'summary', region: '#summaryBox',
    title: 'The coach\'s summary',
    acts: [{ capture: '#summaryBox', button: '#btnSummary', done: '#btnSummary:has-text("Rewrite")', label: 'Coach summary' }, { scroll: '#summaryBox' }],
    caption:
      'A short write-up of the whole game: the opening, what decided it, and what to practise. ' +
      'The model gets the turning points, the best moves and the motifs, and the references retrieved for the game\'s themes, and only explains them.',
  },
  {
    id: 'study-plan', region: '[data-pane="reading"]',
    title: 'A study plan from the game',
    acts: [{ tab: 'reading' }, { capture: '#studyPlan', button: '#btnStudyPlan', done: '#btnStudyPlan:enabled', label: 'Study plan' }, { scroll: '#studyPlan' }],
    caption:
      'The **Reading** tab lists the position\'s themes and the books and classic games that teach them, found by position, pawn structure and theme. ' +
      'From these, the coach writes a study plan that fits the player\'s level.',
  },
  {
    id: 'your-turn', frame: 'top',
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
      'A new game from the position after 9... b5, against Stockfish, with the coach set to comment after the player\'s moves. You play 10. Nxb5, Stockfish replies, and the coach comments beside the board. ' +
      'In a game, the help setting limits what the coach sees. Here it is **Full engine**, so the coach gets Stockfish\'s lines; with **Flag mistakes** it would only learn how your move rated, so it couldn\'t give the game away.',
  },
  {
    id: 'source-search', title: 'Find the source behind an idea', region: '.study-search',
    acts: [
      { click: '#modeAnalyse' },
      { click: '#btnSettings' }, { click: '#optCommentWhen button[data-v="request"]' }, { click: '#btnSettingsClose' },
      { tab: 'library' }, { select: '#studySource', value: 'classic' }, { fill: '#studyQuery', value: 'development' },
      { waitFor: '#studySearchResults .study-hit' }, { fill: '#libSearch', value: 'Morphy' }, { scroll: '#studySearchTitle' },
    ],
    caption: 'Pause the game for analysis, then search literal annotations in the bundled classics. Each passage carries its source and supplied licence and opens its exact game occurrence. Keyword search runs locally; a matching passage identifies source text without proving the coach\'s explanation.',
  },
  {
    id: 'opening-ideas', title: 'Opening names, continuations and plans',
    acts: [
      { tab: 'game' }, { js: () => { /** @type {HTMLDetailsElement} */ (document.querySelector('details:has(#loadText)')).open = true; } },
      { fill: '#loadText', value: '1. e4 e5 2. Nf3 Nc6 3. Bb5' }, { click: '#btnLoad' }, { ply: 5 },
      { tab: 'openings' }, { waitFor: '#namedOpeningCurrent' }, { waitFor: '#openingGuideBody' }, { scroll: '#openingVariations' },
    ],
    caption: 'The Openings tab follows the current board: named catalogue continuations, original guides and the reference-game explorer answer different questions. Here the Ruy Lopez supplies a concrete starting point for a repertoire. Catalogue names and counts are reference data, rather than fresh engine verdicts.',
  },
  {
    id: 'repertoire', title: 'Keep a repertoire with your own notes', region: '#repertoirePanel',
    acts: [
      { select: '#repSelect', value: '' }, { fill: '#repName', value: 'Development first' }, { select: '#repColor', value: 'w' }, { click: '#repSave' },
      { fill: '#repLineName', value: 'Open games' }, { fill: '#repMoves', value: '1. e4 e5 2. Nf3 Nc6 3. Bb5' },
      { fill: '#repNote', value: 'Develop and castle before looking for tactics.' }, { click: '#repLineSave' },
      { waitFor: '.repertoire-line' }, { scroll: '#repertoirePanel' },
    ],
    caption: 'Save legal lines for White or Black, with a name and personal notes. Repertoires stay in this browser and keep the loaded game intact. Saved choices define what to recall; they are not an assertion that every alternative is bad chess.',
  },
  {
    id: 'repertoire-recall', title: 'Recall a move on a separate board', region: '#repertoirePanel',
    acts: [{ click: '#drillStart' }, { fill: '#drillMove', value: 'e4' }, { press: '#drillMove', key: 'Enter' }, { waitFor: '#drillPlayed' }, { scroll: '#drillBoard' }],
    caption: 'Review due repertoire moves on an independent board. A saved move is accepted and the recorded opponent reply follows. Hints, mistakes and clean recalls determine the next review date; the session does not call the model or alter the main game.',
  },
  {
    id: 'lesson', title: 'Practise a rule-checked lesson', region: '#lessonPlayer',
    acts: [
      { click: '#drillStop' }, { tab: 'lessons' }, { select: '#curriculumLevel', value: '4' }, { select: '#curriculumModule', value: 'tactics' },
      { click: '[data-lesson-id="back-rank-mate"] summary' }, { click: '[data-open-exercise="back-rank-white"]' },
      { fill: '#lessonMove', value: 'Re8#' }, { click: '#lessonMoveForm button' }, { waitFor: '#lessonFeedback' }, { scroll: '#lessonPlayer' },
    ],
    caption: 'Lessons have their own board, authored explanations and staged hints. This back-rank mate is verified by chess.js after the move. Strategy reflections, recorded source lines and verified mates retain different result labels instead of sharing a guessed model grade.',
  },
  {
    id: 'spaced-practice', title: 'Return to the next useful practice', region: '#practiceSchedule',
    acts: [{ click: '#lessonPlayer button:has-text("Close lesson")' }, { scroll: '#practiceSchedule' }],
    caption: 'The practice queue combines lesson progress, repertoire recalls and saved exercises from reviewed mistakes. Due work and new material remain separate; completed recalls and next review dates persist in this browser. These are practice records, not a measured chess rating.',
  },
  {
    id: 'german-phone', title: 'Study in German on a phone',
    acts: [
      { viewport: { width: 390, height: 844 } }, { click: '#btnSettings' }, { select: '#optLang', value: 'de', reload: true },
      { waitFor: '#engineDot.ok' }, { click: '#btnSettings' }, { select: '#optMoveNotation', value: 'german' }, { click: '#btnSettingsClose' },
      { tab: 'openings' }, { waitFor: '#namedOpeningCurrent' }, { js: () => window.scrollTo(0, 0) },
    ],
    caption: 'The same saved study works in the German phone interface, with translated opening labels/guides and optional German move letters. Display notation is separate from canonical SAN in saved PGNs and engine data. Saved repertoires and practice survive the language reload.',
  },
  {
    id: 'german-opening-guide', title: 'Read the opening guide in German',
    acts: [{ scroll: '#openingGuidePanel' }],
    caption: 'The phone view also keeps the authored opening guide readable in German. Ideas, typical plans and pawn-structure notes are authored study material; concrete moves still need the engine\'s evidence. These pages are screenshots of the actual localized app.',
  },
];
