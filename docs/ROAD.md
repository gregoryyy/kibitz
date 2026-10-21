# Roadmap

Ideas for where Kibitz could go beyond [TODO.md](TODO.md). These are directions to explore, not planned work. When an idea is picked up, it becomes TODO items, and this file links to them.

## 1. Show the options on the board

The coach explains a position by showing the main options side by side, not just the best move.

- **What it looks like:** two to four candidate moves, each drawn in its own colour on the board (arrows, target squares). Each comes with a one-line idea ("Nf3: develops and guards e5"), its evaluation, and a follow-up line you can step through on a scratch board. Next to it is the opponent's best reply to each option.
- **Builds on:**
  - board annotations and rendering (4.2–4.4);
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

## 3. Talk to the coach: audio in and out

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

## 4. How-to courses: visualisation, openings, tactical patterns

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

## 5. Mobile apps for iOS and Android

- **Path:** first the installable web app (PWA, 10.7), then store apps that wrap the same page (for example with Capacitor), rather than a native rewrite.
- **To settle first:**
  - **Engine threads:** multi-threaded Stockfish needs cross-origin isolation, which an app's web view may not provide. The single-threaded fallback already exists.
  - **Where the AI comes from:** keys can't ship inside an app. It's either a hosted gateway with accounts (10.1, 10.2), or the in-browser model (2.16) on phones with enough memory and storage.
  - **Store rules:** app store rules on downloading model weights after install.
  - **Licences:** GPL-3.0 and the app stores' terms need a check before publishing, since Stockfish and chessground are GPL. Other GPL chess apps, such as Lichess, are on both stores.
  - **Design:** a touch-first board and layout (10.6). Voice (idea 3) suits phones well.
