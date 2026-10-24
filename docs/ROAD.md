# Roadmap

Ideas for where Kibitz could go beyond [TODO.md](TODO.md). These are directions to explore, not planned work. When an idea is picked up, it becomes TODO items, and this file links to them.

The selected deployment is a [local single-user app](DEPLOYMENT.md). A future hosted service must revisit accounts, sessions/passkeys/OAuth, tenant isolation, account-based quotas, encrypted per-account provider keys and account-wide export/deletion before claiming multi-user support. TODO 10.2 remains explicitly deferred.

## 1. Show the options on the board

The coach explains a position by showing the main options side by side, not just the best move.

- **What it looks like:** two to four candidate moves, each drawn in its own colour on the board (arrows, target squares). Each comes with a one-line idea ("Nf3: develops and guards e5"), its evaluation, and a follow-up line you can step through on a scratch board. Next to it is the opponent's best reply to each option.
- **The text points at the board:** hovering over a piece, square or move in an explanation highlights it on the board ("the knight on f5" lights up the knight). Clicking a variation in the text plays it on a scratch board, ready to step through, and leaves the game untouched. Only what `checkAnswer` has verified becomes a link: legal moves that match an engine line, and squares that hold the piece named. On a phone, where there is no hover, a tap highlights and a second tap plays.
- **Builds on:**
  - board annotations and rendering (4.2–4.4);
  - the checked moves in answers (3.4), which already mark each move in the text;
  - the variation stepper (4.3);
  - picking interesting moves from Stockfish's ranked lines (3.9.4);
  - engine tools for the coach (4.11).
- **Open questions:** how many options before it's noise, telling the options apart without relying on colour alone (10.5), and the layout on a phone.

## 2. See tactics, then strategy, through the literature

Make the possibilities in a position visible: first the tactical ones, later the strategic ones. Each is tied to the games and books that made the idea famous.

- **Tactics first:**
  - The motif detectors run over the engine's lines (4.11.2). They highlight the pattern on the board: the forking square and the two targets, the pin line, the overloaded defender, the back rank.
  - Patterns that are only possible (a fork that works after a preparatory move, a pin waiting to happen) are shown differently from those that work now.
- **Strategy later:** weak squares and outposts, open files, pawn breaks, good and bad pieces, plans that follow from the pawn structure. These are harder to show than a fork, and harder to check with the engine. They start as highlighted squares and arrows with an explanation, checked against the engine's lines where possible.
- **Connected to the literature:**
  - Each pattern or plan links to the classic games where it decided the game (Morphy's Opera Game for development and the back rank, Capablanca for simple endgames, the Carlsbad minority attack in Queen's Gambit games). The game opens at the moment in question.
  - The books and chapters that teach it link from the reading list (7.3, 8.6, the literature catalog in `knowledge.js`).
  - Retrieval by pattern and structure (8.1–8.5) finds the references for the position on the board.
- **Builds on:** the motif detectors (`knowledge.js`, 6.2–6.3), the reference library (7), RAG on positions and patterns (8), and the "Similar games" aspect (3.2.5).
- **Open questions:** where the classic games and annotations come from without copyright problems (only public game scores, 7.3), and how to check a strategic claim.

## 3. Commentary that fits the player's strength

The coach leaves out what the player already sees, and spends its words on what they probably don't.

- **What changes:**
  - An advanced player doesn't hear that a piece is attacked by a pawn, that the centre matters, or that 1. e4 opens lines.
  - A beginner does, and doesn't hear about minority attacks yet.
  - Today only the tone changes with the level (3.5); this would change what gets said.
- **How to judge "obvious":**
  - **Search depth:** the depth at which Stockfish first finds an idea is a measure of how hard it is. A one-move threat is obvious to a club player, a three-move combination is not.
  - **Pattern difficulty:** how hard the motif behind it is, ranked from the puzzle themes (6.5).
  - **The player's own history:** what they found or missed in their games (9.2). Themes they handle well get shorter comments, their weak spots longer ones.
- **Builds on:** the player profile and rating estimate (9.1), the aspect picker (3.2), and the tutor eval set (3.8), which could check the result by level.
- **Open questions:** how to stay right when the profile is wrong (a strong player new to the app); letting the player say "too basic" or "too much".

## 4. Plans checked by the engine and the pattern recognizer

When the coach suggests a plan, the symbolic side tests it before the player sees it, as it already does for single moves.

- **What it looks like:**
  - "Play for b4–b5, a minority attack" is checked by asking Stockfish about the plan's key moves (`go searchmoves`): does the evaluation hold, and what does the opponent do against it?
  - The tactic recognizer runs over the resulting lines and flags what the plan allows, for example a fork once the knight leaves.
  - A plan that fails is either dropped or shown with its refutation: "b4 looks natural, but after ...Nxe4 the e-pawn falls."
- **Plans as patterns:** typical plans per pawn structure (Carlsbad: minority attack; IQP: d4–d5 break, kingside attack; opposite castling: pawn storms) become checkable templates. Each has key moves the engine can test, and a pattern the recognizer can spot in the current position.
- **Builds on:** engine tools for the coach (4.11, including `try_move` and the pattern search over lines), the strategy themes (6.3), and the answer check (3.4), which today only checks single moves and lines.
- **Open questions:** a plan unfolds over many moves, beyond what a quick search sees. How far to trust the evaluation after a plan's first few moves, and how to say so honestly.

## 5. Talk to the coach: audio in and out

Every exchange can happen by voice: speak your moves and questions, and hear the commentary.

- **Input:** speech to text for questions and moves ("knight f3", "castle short"). Moves go through the typed-move parser (`parseMoveInput`) and chess.js, like typed ones. Push-to-talk, so the coach doesn't listen all the time.
- **Output:** text to speech for comments, moves and clock warnings. Moves are already put into words for screen readers (`sanToSpeech`).
- **Options:**
  - **The browser's Web Speech API:** quick to add. But Chrome's speech recognition sends the audio to Google, so it can't be used in local-only or offline mode.
  - **On-device speech in the browser:** a speech model such as Whisper in WebAssembly or WebGPU for input, and a small voice model for output. It fits offline mode (2.16) and needs the same consent and memory care as the in-browser language model.
  - **Cloud speech services through the gateway,** with the keys on the server.
- **Open questions:**
  - the privacy notice (10.4): audio leaves the machine unless it's processed on the device;
  - latency during a timed game;
  - languages (10.8);
  - how much this helps players who can't see the board (10.5).

## 6. How-to courses: visualisation, openings, tactical patterns

Guided paths that train a skill, not just answer questions.

- **Learn to visualise:**
  - blindfold and "fading" modes, where pieces disappear after a few moves and you play from memory;
  - following a line in notation without moving the pieces;
  - drills such as "where does the knight stand after these three moves?" or "which colour is f6?";
  - difficulty that rises as you succeed.
- **Understand openings:**
  - the ideas, typical plans and pawn structures of each opening (5.5);
  - the named continuations at the board (5.6);
  - repertoire drills with spaced repetition (5.4);
  - the coach asking "why this move?" instead of telling (3.9.3).
- **See tactical patterns:**
  - pattern families (6.2) from puzzles (6.5) and from your own games (9.3);
  - after each solution, the pattern is highlighted on the board and linked to a classic example (idea 2).
- **Builds on:** the curriculum (6), challenges (3.9.3), progress and spaced repetition (9).
- **Open questions:** where the exercise content comes from and under which licence; how to measure that a skill has improved (9.2).

## 7. Mobile apps for iOS and Android

- **Path:** first the installable web app (PWA, 10.7), then store apps that wrap the same page (for example with Capacitor), rather than a native rewrite.
- **To settle first:**
  - **Engine threads:** multi-threaded Stockfish needs cross-origin isolation, which an app's web view may not provide. The single-threaded fallback already exists.
  - **Where the AI comes from:** keys can't ship inside an app. It's either a hosted gateway with accounts (10.1, 10.2), or the in-browser model (2.16) on phones with enough memory and storage.
  - **Store rules:** app store rules on downloading model weights after install.
  - **Licences:** GPL-3.0 and the app stores' terms need a check before publishing, since Stockfish and chessground are GPL. Other GPL chess apps, such as Lichess, are on both stores.
  - **Design:** a touch-first board and layout (10.6). Voice (idea 5) suits phones well.

## 8. A tutorial that follows one position

A primer that accompanies the repo and follows one chess question through the patterns in [ARCH.md](ARCH.md). Each step adds context and ends with what the coach can say at that point. The model stays the same, and the answer gets sharper as its context grows.

- **Basis:** [A Gentle Primer on Neurosymbolic AI: Building a Chess Tutor](primer/Primer_v01.pdf) (v01, October 2026). It is the Warsaw AI primer ("A Gentle Primer on Generative AI", 2026) adapted to this scenario, and it quotes the Opera Game flipbook. Part 1 covers the transformer, Part 2 the model's limits on the board and the engine and checker beside it, and Part 3 running such a system responsibly. What is still open is the hands-on part below.
- **The scenario:** a club player has just played a move, and asks "What should I play now?"
- **The steps:**
  1. The bare question with only the FEN: the model guesses, and names moves that are illegal or lose.
  2. Context control: the position described in words, the player's level, and the help setting that limits what the coach may reveal (ARCH 3.1).
  3. The engine's facts: Stockfish's top lines and evaluations, which the model may only explain.
  4. Motifs and themes from `knowledge.js`: why a line works, not just that it does.
  5. Structured retrieval: the opening, and similar games from the library by position and pawn structure, without embeddings.
  6. Structured output and verification: every move in the answer checked against the engine, and the wrong ones struck through.
  7. Tool use: the model asks the engine for what it needs (4.11).
  8. Agency under policy: the coach loads a position or plays a line on a scratch board, with confirmation and undo (4.8, 4.10).
  - A closing step on running it all in the browser, with no key and nothing leaving the machine (2.16).
- **Hands-on:** each step can be repeated in the app. A prompt view shows exactly what the model saw at that step, and the mock provider makes the outputs reproducible.
- **Appendices:** the transformer in more depth, literature, and links, as in the primer.
- **Animated web presentation:** see idea 11 for a Primer website focused on visualising the neurosymbolic and retrieval flows.
- **Builds on:** ARCH.md, the coach's prompt templates (3.3) and answer checks (3.4), and the engine tools (4.11) for steps 7 and 8.
- **Open questions:**
  - the audience: developers, product designers, or chess players curious about AI;
  - the format: Markdown in the repo, a PDF, or slides for a talk;
  - recorded answers from a real model versus live ones;
  - keeping the text in step with the code as it changes.

## 9. Piece power: attacks and defence in four corners

Show each piece's relationships to the other pieces as small dots in the four corners around it. Each dot represents one distinct related piece; these are counts, not material values or an engine evaluation.

| Corner | Relationship | What the dots count |
| --- | --- | --- |
| Top left | Inbound attack | Enemy pieces attacking this piece. |
| Top right | Outbound attack | Enemy pieces this piece attacks. |
| Bottom left | Inbound defence | Friendly pieces defending this piece. |
| Bottom right | Outbound defence | Friendly pieces this piece defends. |

- **Two display modes:**
  - **Always show:** display the dots on every piece. Right-click a piece for details and highlights of the particular pieces involved.
  - **On demand:** keep the dots hidden until a piece is right-clicked, then show its dots, details and related-piece highlights.
- **Details:** list the related pieces and their squares under the four relationship labels. Let the player select a relationship or an individual listed piece to highlight the corresponding pieces on the board. Keep the corner meanings consistent when the board is flipped, and show an explicit zero in the details when a corner has no dots.
- **Mobile equivalent to explore:** press and hold a piece to inspect it, cancelling inspection if the gesture becomes a drag. An explicit Inspect toggle followed by a tap is another option, with a keyboard/screen-reader equivalent. Settle the gesture through touch testing so inspection and moving pieces do not interfere.
- **Existing right-click behaviour:** right-click currently draws a highlighting circle; dragging with the drawing gesture supports arrows. Decide how inspection coexists with these annotations, for example an inspection mode, a modifier or a menu action for the existing circle. Preserve access to manual annotations.
- **Chess meaning:** compute the relationships from the displayed position through chess rules and board features; the model can explain them. Define geometric attacks/defence versus legal captures before implementation, especially for pinned pieces, kings and pawn diagonals. Decide whether indirect or x-ray relationships are excluded or shown separately. A high defender count alone does not establish that a piece is tactically safe.
- **Builds on:** board rendering and annotations (4.2–4.4), pure attack/defence features in `knowledge.js`, tactical lessons (6.2), accessibility (10.5) and mobile layout (10.6). During a game, respect the live-help setting.
- **Open questions:** dot size, spacing and overflow on crowded or small boards; distinguishing relationships without colour alone; dismissing transient details; and the right-click/mobile gesture design above.

## 10. Position similarity by aspect

Find positions that are similar in the respect the player wants to study. The closest example for pawn structure may be quite different from the closest example for a tactical combination, piece activity or an endgame plan.

- **What it looks like:** “Find positions like this” offers an aspect such as opening, pawn structure, tactics, king safety, piece activity or endgame technique. Results say why they match and what differs; each opens the source game or lesson at the relevant position.
- **A family of similarity measures:** investigate a score or distance parameterised by aspect, using explicit feature groups and weights before trying a learned conditional embedding. Keep exact-position matches separate from analogies. The existing tutor aspects (3.2) can suggest a retrieval profile, but are not themselves a complete chess-similarity taxonomy.
- **Examples:**
  - Match an isolated-pawn structure despite different minor-piece squares.
  - Find the same deflection-and-mate idea despite a different-looking board.
  - Compare attack/defence relationships and piece roles, including the information behind the four-corner display (idea 9).
  - Retrieve a relevant rook-ending technique, accounting for material, king placement, side to move and draw-rule state.
- **Checks:** similar appearance or equal engine scores do not establish that the same move or plan works. Validate any advice in the current position and label exact, structural and thematic matches distinctly. Respect the live-help setting during a game.
- **Research:** [aspect-conditioned position similarity](research/position-similarity.md), including prior chess retrieval work, candidate distances, conditional metric learning and an evaluation plan. This is an investigation, not a selected or implemented metric.
- **Builds on:** position/pattern retrieval (8.1–8.5), retrieval evaluation (8.8), the reference library (7), curriculum examples (6) and piece relationships (idea 9).
- **Open questions:** which aspects and default weights are useful; whether the task needs a mathematical metric or a relevance score; colour/board symmetries; multi-aspect requests; and how experts and learners judge similarity under each aspect.

## 11. Animated Primer website

Present the [Primer](primer/Primer_v01.md) as a website with animations and interactive, step-by-step diagrams. Focus especially on the neurosymbolic combination and RAG, following one chess position through the system as in idea 8.

- **Neurosymbolic flow:** animate how the position reaches the rules, Stockfish search/NNUE and feature detectors; how their evidence enters the LLM context; and how explanations, tool requests and board marks pass through validation. Show which component supplies each fact and what happens when a move or motif is unsupported.
- **RAG flow:** animate the query/aspect, position and tag matching, candidate references, ranking, the selected evidence packet and the answer's citations. Let the reader open a retrieved example on the board. Distinguish exact matches from structural/thematic analogies, explicit passage embeddings and hybrid ranking; show current source citation checks, with semantic support checks and graph retrieval as planned/research extensions.
- **Inspection and controls:** pause, step forward/back and replay; inspect intermediate facts, tool results, retrieval matches and the context actually sent to the model. Switching the position or aspect should make the changed evidence visible.
- **Presentation:** reuse the existing Primer text/figures and the [design overview](AI-DESIGN.md). Provide keyboard controls, reduced-motion/static alternatives and a mobile layout. Recorded or mock traces can make the main walkthrough reproducible; live engine/model demonstrations are an optional extension.
- **Builds on:** the Primer sources, tutorial idea 8, the checked coach/board flow (3–4), RAG (8) and the [retrieval research](research/README.md).
- **Open questions:** the first scenes to animate, how closely the website follows the printed Primer, the animation/site tooling and hosting, and whether any live provider calls belong in the public walkthrough.
