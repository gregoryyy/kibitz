# Roadmap

Ideas for where Kibitz could go beyond [TODO.md](TODO.md). These are directions to explore, not planned work. When an idea is picked up, it becomes TODO items, and this file links to them.

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

- **Basis:** [A Gentle Primer on Neurosymbolic AI: Building a Chess Tutor](Primer_v01.pdf) (v01, October 2026). It is the Warsaw AI primer ("A Gentle Primer on Generative AI", 2026) adapted to this scenario, and it quotes the Opera Game flipbook. Part 1 covers the transformer, Part 2 the model's limits on the board and the engine and checker beside it, and Part 3 running such a system responsibly. What is still open is the hands-on part below.
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
- **Builds on:** ARCH.md, the coach's prompt templates (3.3) and answer checks (3.4), and the engine tools (4.11) for steps 7 and 8.
- **Open questions:**
  - the audience: developers, product designers, or chess players curious about AI;
  - the format: Markdown in the repo, a PDF, or slides for a talk;
  - recorded answers from a real model versus live ones;
  - keeping the text in step with the code as it changes.
