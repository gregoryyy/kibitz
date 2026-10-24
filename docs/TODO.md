# TODO

Plan for Kibitz, a browser chess trainer. Stockfish (WASM) calculates; a choice of AI providers (OpenAI, Mistral, Claude, Ollama) explains. Progress, deviations and learnings are logged in [DONE.md](DONE.md).

Status: `[ ]` open, `[x]` done. Tags:
- *(prototype)*: came from the original artifact prototype. Ticked once it works in `site/`; open ones still need work there.
- *(added)*: not in the original brief; proposed during planning.

## Target architecture

- **Browser client:** chessground board, chess.js rules, and Stockfish 19 WASM in Web Workers (an opponent and an analyst). Single-threaded by default; multi-threaded when the page is cross-origin isolated.
- **Node server:** serves the app and sets security headers. It also runs the AI gateway (one adapter per provider, keys kept server-side), stores library and user data, and handles RAG retrieval.
- **Shared module:** pure chess knowledge (features, motifs, scoring, retrieval), used by both client and server (today's `knowledge.js`).

Design background: [research on milestones 5–7, RAG and neurosymbolic games](research/README.md), including an audit of the current Stockfish integration. Research recommendations are separate from implemented features below.

---

## 0. Foundation and process

- [x] 0.1 Create the GitHub repo, push `main`, and protect it (PRs required, CI must pass, no force pushes). Note: GitHub offers no branch protection or rulesets for private repos on the Free plan, so PR-only merging is a convention (AGENTS.md) until the repo is public or on Pro.
- [x] 0.2 Decide the target layout: evolve `claude/` and `codex/` in parallel, or merge them into one app folder. Record the decision in DONE.md. (Merged into `site/`.)
- [x] 0.3 Set up npm workspaces (`client`, `server`, `shared`) and pin Node LTS (`.nvmrc`, `engines`). Decided against workspaces for now: `site/` stays one npm project (see DONE.md). Node 24 LTS is pinned.
- [x] 0.4 Decide on typing: JS + JSDoc checked by `tsc --checkJs`, or TypeScript. JS + JSDoc, checked by `npm run typecheck`.
- [x] 0.5 Add linting and formatting (ESLint, Prettier). ESLint and `.editorconfig`; no Prettier (see DONE.md).
- [x] 0.6 Set up the test harness: `node:test` for unit tests, `@playwright/test` for e2e (port `claude/tests/e2e.py` to JS)
- [x] 0.7 Turn `knowledge.test.mjs` into real assertions; today it only prints output
- [x] 0.8 GitHub Actions on every PR: lint, unit, e2e, build, `npm audit`, CodeQL, secret scanning. CodeQL is skipped while the repo is private; gitleaks does the secret scanning.
- [x] 0.9 PR template with a checklist: tests, TODO/DONE updated, security impact
- [x] 0.10 Licensing: GPL-3.0 (required by Stockfish and chessground), `LICENSE` file, third-party notices. GPL-3.0-or-later.
- [x] 0.11 Fix `.gitignore`: `tests/out/` only matches at the repo root; use `**/tests/out/`
- [x] 0.12 Keep repository utilities under root `utils/`; move the PDF tooling to `utils/pdf/` and update its references. *(added)*
- [x] 0.13 Document the LLM and symbolic design across features in a brief [design overview](AI-DESIGN.md), distinguishing built behaviour, planned features and ROAD explorations. *(added)*
- [x] 0.14 Organize existing source modules into `chess/`, `coach/`, `library/`, `openings/` and `platform/`; preserve directories in the build and update imports, tests, tools and documentation. *(added)*

## 1. Play against the engine

- [x] 1.1 Board UI: legal moves, promotion, flip, coordinates *(prototype)*
- [x] 1.2 Stockfish 19 WASM worker with blob-URL and asm.js fallbacks *(prototype)*; `site/src/chess/engine.js`, unit-tested
- [x] 1.3 Multi-threaded Stockfish when cross-origin isolated (server sends COOP/COEP headers), with a single-threaded fallback
- [ ] 1.4 Strength levels: `UCI_Elo` from 1320 up, a weakened mode below that *(prototype)*; calibrate them against real ratings. The weakened mode is calibrated against Stockfish's UCI_Elo scale (`scripts/calibrate.mjs`). Remaining: checking the scale against human ratings, which needs players' results (see 9.2).
- [x] 1.5 Separate analyst engine (full strength, MultiPV) *(prototype)*
- [x] 1.6 Time controls and clock *(added)*
- [x] 1.7 Takeback, hint, resign *(prototype)*; draw offers; every game-end rule (threefold repetition, 50-move rule, insufficient material)
- [x] 1.8 Start from a FEN, an opening, or a curriculum position. FEN and opening done; curriculum positions moved to 6.8, since the curriculum doesn't exist yet.
- [x] 1.9 PGN import and export with comments and NAGs *(prototype)*
- [x] 1.10 Post-game review: eval graph, move classes, accuracy *(prototype)*
- [x] 1.11 Keyboard move entry and screen-reader move announcements *(added)*
- [x] 1.12 Tests: rule edge cases, engine adapter with a fake worker, e2e for a full game
- [x] 1.13 Playing style for Stockfish (Solid, Balanced, Active, Aggressive, Reckless), saved with the Elo setting *(added)*
- [x] 1.14 Help level "Eval + mistakes": mistakes are flagged, and the eval bar shows the position after the player's move, holding it through Stockfish's reply. The best move stays hidden, and the coach sees what it sees with Flag mistakes *(added)*
- [x] 1.15 Keep the game in progress across reloads in the local app *(added)*. Inside the Claude artifact the host's snapshot (`window.claude.hot`) restores it; the local app (`just serve`) kept nothing. The same snapshot (PGN, cursor, mode, colour, orientation, Elo and style, start ply, clock times) now goes to `localStorage` after every change and when the page goes away, and comes back at boot

## 2. AI provider layer

- [x] 2.1 Node server: static hosting, JSON API, security headers (CSP, COOP/COEP, HSTS). HSTS comes once hosted over HTTPS (12.2).
- [x] 2.2 Provider interface: `chat(messages, {stream, schema, maxTokens, signal})` and `embed(texts)`
- [x] 2.3 OpenAI adapter
- [x] 2.4 Mistral adapter
- [x] 2.5 Claude adapter (Anthropic Messages API)
- [x] 2.6 Ollama adapter (local models, so nothing leaves the machine)
- [x] 2.7 Structured output for board annotations on every provider (JSON schema or tool calling, plus fallback parsing)
- [x] 2.8 Stream replies to the browser (NDJSON over `fetch`), with cancellation
- [ ] 2.9 Key management: keys come from server env or an encrypted per-user store, and never reach the browser, logs or prompts. Remaining: the per-user store (depends on 10.1); env keys are done.
- [x] 2.10 Model choice per task (quick comment, chat, deep review) and per provider *(added)*
- [ ] 2.11 Limits: per-user rate limit, token budget, timeouts, cost display *(added)*. Done: timeouts, a daily token budget for the server, per-user budgets in tokens and dollars for paid models, and the tokens and cost of each answer and of the player's day in the dialogue. Users are told apart by a cookie, so the per-user budgets are soft until there are accounts. Remaining: a per-user rate limit, budgets tied to accounts (10.2), and usage kept across server restarts.
- [x] 2.12 Allowlist for the Ollama base URL (SSRF guard) *(added)*
- [x] 2.13 Mock provider with deterministic fixtures for tests and offline development *(added)*
- [x] 2.14 Settings UI: provider, model, connection test, local-only mode
- [ ] 2.15 Contract tests per adapter against recorded responses; live smoke tests run only when an env flag is set. Remaining: recorded fixtures for OpenAI, Mistral and Ollama (hand-written from the documented format until their keys work; Claude's are recorded).
- [ ] 2.16 Offline mode with an in-browser model: a small model runs in the page, so the coach works with no network, no key and no provider *(added)*
  - [x] 2.16.0 `just offline`, a recipe of its own: on first run it downloads the chosen model's weights into `site/models/` (gitignored, checksums verified); then it builds and serves the app with local-only mode on and the in-browser model as the provider. In this mode nothing leaves the machine: the weights come from our own server and the CSP allows `connect-src 'self'` only
  - [x] 2.16.1 Runtime:
    - WebLLM on WebGPU first: fast, with an OpenAI-style API and JSON-schema output
    - wllama when there's no WebGPU: llama.cpp in WebAssembly, multi-threaded under the COOP/COEP headers we already send
    - Chrome's built-in model (Prompt API) as an optional extra where it exists
    - Licences fit GPL-3.0 (Apache-2.0, MIT)
    - Done with wllama alone: since v3 it runs on WebGPU too, with WebAssembly on the CPU as its fallback (see DONE.md). Remaining: Chrome's built-in model
  - [x] 2.16.2 Model: a small open model under Apache-2.0 or MIT, chosen with the tutor eval set (3.8). It only puts into words what the engine and the detectors found, which is what makes a small model usable. The weights download on first use, only after the player agrees, with the size shown. They're cached in the browser and always come from our own server (2.16.0), never from a CDN. Done: Qwen2.5 1.5B Instruct (default) and 0.5B, Apache-2.0, pinned by SHA-256, consent before loading. The eval set (3.8) keeps 1.5B as the default: 50% against 42% for 0.5B, but far behind the cloud models (Haiku 79%, Opus 95%), so it stays the offline fallback
  - [x] 2.16.3 It runs in a Worker behind a page-side provider with the same interface as the gateway's (`chat()`, JSON formats, usage), so the coach code doesn't depend on where the model runs. The coach settings list it as "In browser", and local-only mode (2.14) counts it as local
  - [x] 2.16.4 Resources: on the CPU it competes with Stockfish for threads, so the analyst gets fewer threads while the model is generating. Free memory is checked before loading, and the model is unloaded when idle
  - [x] 2.16.5 Routing per task (2.10): quick comments run in the browser, and chat and reviews go to the gateway when one is set up
  - [x] 2.16.6 Tests: the page-side provider against a fake runtime in the Worker, and a live smoke test with a real model only when an env flag is set

## 3. Tutor commentary

- [x] 3.1 Grounding pipeline: engine lines in SAN, move class, motifs, position features and retrieved references go into the prompt context *(prototype: `contextFor`)*
- [x] 3.2 Aspect picker:
  - [x] 3.2.1 Last move: what it did, its rating, the engine's alternative
  - [x] 3.2.2 Future moves and opportunities: threats, plans, candidate moves
  - [x] 3.2.3 Things to keep in mind: weaknesses, king safety, loose pieces
  - [x] 3.2.4 Habits of strong players: blunder check, candidate moves, prophylaxis
  - [x] 3.2.5 Relevant classic games, taken from the reference library through RAG. The "Similar games" aspect uses similar positions from the player's library and the classic games that match the position's themes (`classics.js retrieveClassics`), which the Reading tab lists too
- [x] 3.3 A prompt template per aspect, with shared rules: don't invent variations, back every claim with an engine line
- [x] 3.4 Validate the output: check every move, square and line against chess.js and the engine's lines, then drop or flag the ones that can't be verified *(added)*. Flagged, not dropped (see DONE.md)
- [x] 3.5 Adapt to the player's level *(prototype)*
- [x] 3.6 When to comment: after every move, only after mistakes, or on request; no spoilers mid-game unless help is on
- [x] 3.7 Cache comments by position, ordered game/scratch history, aspects, help view, level, model and language. Equal EPDs at different game steps do not share numbered commentary
- [x] 3.8 Tutor eval set: reference positions with the key points a good comment should hit; scored by engine checks plus an LLM judge, run per provider *(added)*
- [x] 3.9 Explanation modes, chosen in the coach settings and switchable at any time *(added)*. In the Coach tab as "How the coach works": Only when asked, After my mistakes, After my moves, Commentary on every move, Challenge me
  - [x] 3.9.1 On request (today's behaviour): the coach speaks when asked or when a chip is clicked
  - [x] 3.9.2 Continuous commentary: a short comment on every move by either side, like a broadcast commentator. Uses the quick model, is cached per position (3.7), and keeps to the spoiler rules from 3.6 during a game
  - [x] 3.9.3 Challenges: the coach asks instead of explaining ("What does Black threaten?", "Find the best move", "Nf3 or Bg5?", "Which square is weak?"). The player's answer is checked against the engine and the motif detectors before the coach reveals anything, and results count toward progress per theme (6.7, 9.2). Done: best move, the better of two, and the threat (the position with the other side to move); results per theme are kept in the browser and shown in the Coach tab, for 6.7 and 9.2 to build on
  - [x] 3.9.4 Interesting moves, not only the best: the analyst's MultiPV count and a centipawn window become settings. From the moves inside the window, the coach picks the ones worth showing (a different plan, a sacrifice, a quiet move, a trap for the opponent) instead of always the engine's first line. Each pick shows its engine rank and evaluation
  - [x] 3.9.5 Tests: each mode with the mock provider, challenge answers checked against fixed engine lines, the move picker on reference positions

## 4. Chat and board annotations

- [x] 4.1 Chat panel: history per game and position, streaming, stop button *(prototype)*
- [x] 4.2 Annotation schema: arrows, square highlights, ghost pieces, labels, move sequences
- [x] 4.3 Rendering: chessground shapes for arrows and highlights; a ghost-piece layer; a variation stepper that leaves the game untouched. Commentary links use captured game/evidence positions and explicit move numbers, including historical occurrences and alternatives
- [x] 4.4 Check every annotation against the current position before drawing it
- [x] 4.5 "What if": the user tries a move on a scratch board, the engine evaluates it, the tutor explains
- [x] 4.6 Chat context: current position, game so far, selected aspects, recent tutor comments
- [x] 4.7 Tests: schema validation, rendering e2e, malformed and hostile model output
- [x] 4.8 Free conversation with the coach, about any game or position, not only the one on the board *(added)*
  - [x] 4.8.1 Open questions (plans, openings, general chess) without a position; answers stay grounded in the engine whenever a position is involved
  - [x] 4.8.2 Load from the chat: the player names a game ("the Opera Game", "my last loss with Black") or pastes a FEN or PGN, and the coach puts it on the board in analysis mode
  - [x] 4.8.3 Coach tools: search the library (7.5), load a game at a given move, load a position, load an opening line. Every load is checked with chess.js, and leaving a game in progress needs the player's confirmation; the tools only load, never change or delete anything (11.3.6). Builds on tool calling (2.7)
  - [x] 4.8.4 After a load, the engine analyses the position before the coach explains it, and the chat keeps track of which game and move each answer refers to
  - [x] 4.8.5 Tests: tool calls with the mock provider, invalid or hostile load requests, confirmation before leaving a game
- [x] 4.9 One chat outside the tabs: the chat stays visible whichever tab is open (play, analysis, review, openings, lessons), instead of living inside the Coach tab *(added)*
  - [x] 4.9.1 The chat follows the context. By default the coach talks about the active tab's game and position. A message that names something else ("this opening", "my last game", a FEN) switches the context, which shows as a chip above the input that the player can change. Each answer stays tied to the game and move it was about
  - [x] 4.9.2 Layout: a side panel on wide screens and a drawer on mobile (10.6), collapsible, with the history kept across tab switches. Done as the dialogue beside the board, as tall as it; the tab panels below fold away. On a phone it follows the board with a capped height, not a drawer
  - [x] 4.9.3 Tests: e2e for the chat across tabs, switching context by tab and by message, the mobile drawer. Covered by `layout.spec` and `chat.spec`: tab switches, general/position context, answer links, phone portrait and landscape, and tablet widths. The mobile layout remains the capped dialogue from 4.9.2
- [x] 4.10 Board control from the chat: the chat can make moves and set up pieces *(added)*
  - [x] 4.10.1 Moves: "play e4", "take back two moves", "go to move 15", "show me Nxf7 and what follows". Plain move text goes through the typed-move parser (`parseMoveInput`) without calling the model. In a game, the chat moves only for the player and follows the clock and help settings; elsewhere it plays in analysis, on a variation that leaves the game untouched (4.3)
  - [x] 4.10.2 Setup: "put a white knight on f5", "remove the queens", "set up a Lucena position", "White to move". This edits a scratch board in analysis mode, never a game in progress. The result must be a legal position (`checkStart`, `fixCastling`) before it's shown, with the side to move and castling rights stated
  - [x] 4.10.3 Coach tools for both (with 4.8.3): `move`, `goto`, `setup` taking pieces and squares, `undo`. Every call is checked with chess.js, every board change can be undone in one step, and none of them touches saved games or the library
  - [x] 4.10.4 After each change the engine re-analyses, and the coach's next answer is about the new position (async results checked against the FEN)
  - [x] 4.10.5 Tests: moves and setups through the mock provider, illegal or hostile requests (impossible positions, moves for the engine's side, setup during a game), undo
- [x] 4.11 Engine tools for the coach: the model asks, and Stockfish and the motif detectors answer *(added)*
  - [x] 4.11.1 Tools:
    - `analyse(fen, depth, lines)`: the top lines in SAN, with evaluations
    - `try_move(fen, move)`: does this move work, and what refutes it (`go searchmoves`)
    - `threats(fen)`: what the opponent would play if it were their move (side to move flipped; not when in check)
    - `compare(fen, moves)`
    - `find_mate(fen, n)`
    - `find_motifs(fen, line)`: `moveMotifs` on every move of a line
  - [x] 4.11.2 Pattern search over lines: detectors inspect every move, with before/after engine evaluations and a short best-reply continuation confirming material gain, mate or sustained positional compensation. Unverified and refuted patterns are withheld. Candidate detectors cover the tactical themes in 6.2, including skewers, double checks, deflection, decoy, overloading, interference, removing a defender and checking zwischenzugs. A 1.5-pawn gap flags an "only move" when the best move still holds. Checks share an EPD cache and a search/time budget; see DONE.md for the conservative limits
  - [x] 4.11.3 Native tool calling in the gateway: Claude tool use, and function calling for OpenAI, Mistral and Ollama. One mechanism also serves load tools (4.8.3) and board tools (4.10.3). Only an explicit unsupported-tool rejection enables fixed-context fallback, scoped to the actual provider/model for that task and shown in the answer. Temporary or unrelated provider errors preserve tool access. A successful connection test retries support for that model
  - [x] 4.11.4 Where the engine runs: in the page, with the gateway handing each tool call to the page and waiting for the result, or on the server, where the npm Stockfish build also runs in Node. Decide on latency, cost and hosted load (10.1). Each answer gets a cap on tool calls and engine time. Decided: in the page. The page asks the gateway for one model turn at a time and runs each tool call on its own Stockfish
  - [x] 4.11.5 Tool arguments are untrusted: FENs and moves are checked with chess.js, and depth, time and line count are capped. Every line the model quotes must come from a tool result (3.4). The tool results are kept with the answer, so the chat can show the evidence
  - [x] 4.11.6 Tests: tool loops with the mock provider and a fake engine; hostile arguments (illegal FEN, huge depth, a tool loop that doesn't end); contract fixtures per provider; transient failures, unrelated rejections, quick/chat model isolation, model-change/reconnection recovery, a translated fallback notice and live-help explanations with Full-help recovery in the same conversation
- [x] 4.12 UX review *(added)*
  - [x] 4.12.1 Settings behind a gear icon in the header, opening an overlay (a modal dialog: Escape and a click outside close it, focus stays inside while it is open). It takes what is spread over the tabs today: the coach settings and provider, local-only mode, the engine depth, the player's level, and when the coach comments. The tabs keep only what belongs to their task
  - [x] 4.12.2 The dialogue stays beside the board on desktop, tablets and phone landscape, and below it on phone portrait. While composing on a narrow screen, a temporary layout fits the board beside the composer in the visual viewport, including keyboard resizing. Full layout, Escape or sending restores the normal view. Covered at portrait, landscape and tablet sizes, with reduced viewports simulating the keyboard
  - [x] 4.12.3 Play (Game, Coach) and Study (Review, Library, Reading) group the tabs. The board, dialogue and review show the game and move. Entering review from a running game requires confirmation and pauses a snapshot, with a Return button; returning keeps the study's cursor and review results for the next visit. PGN/library loads and the Analyse switch also keep a way back. Both sessions are kept in memory, not across a reload
  - [x] 4.12.5 A wrong move in an answer is underlined in red instead of struck through, so it stays readable
  - [x] 4.12.6 Game references in answers link to the game: a classic named in the text ("the Opera Game", "Réti–Tartakower", "the Lucena position") shows its key position on the board while hovered or focused, and opens the game there on a click. A first step towards ROAD's "the text points at the board"
  - [x] 4.12.7 Direct game/analysis round trip: Analyse immediately pauses a detached game snapshot and its clock; Play or Return restores the original history, viewed step and result. Analysis branches and review results survive a return while the game checkpoint is unchanged; advancing the game opens fresh analysis. Return controls bypass chat/challenges, and switching cancels stale engine/coach work. Includes untouched/custom-start and finished games; paired sessions remain in memory
  - [x] 4.12.4 Tests: existing settings, layout and chat suites plus `ux.spec` cover the grouped navigation, explicit review confirmation/cancellation, both sessions surviving a round trip, PGN and Analyse transitions, a stale confirmation after a new game, and board/composer visibility in reduced phone/tablet viewports

## 5. Opening library

- [x] 5.1 Opening names by position (Lichess chess-openings, CC0), in `site/data/eco`
- [x] 5.2 Opening explorer: position/move graph from standard-start reference games, with corpus filters, continuation counts, White/draw/Black/unknown results and sample games at the matching ply. Transpositions join; repeated positions count once per record. Continuations use the scratch board and respect live help. Uses the existing classics and saved/imported games; no external explorer API
- [x] 5.3 Repertoire builder: named White/Black repertoires with editable standard-start lines and notes, capture from the game/scratch board up to the displayed move, position-based chosen moves, confirmed removal and PGN copy. Validated browser-local storage is separate from games; live-help restrictions apply
- [x] 5.4 Repertoire drill with spaced repetition: browser-local due/new position reviews for White and Black, accepting all saved choices at transpositions, with automatic opponent replies, board/keyboard input, hints/reveal, recall statistics and deterministic review intervals. A separate drill board preserves the game; live-help restrictions apply *(added)*
- [x] 5.5 Opening explanations: original English/German guides for twelve opening families and seven pawn patterns, covering ideas, typical plans and possible structures. EPD/visible-route matching follows transpositions and scratch branches; current pawn patterns are separate from opening background. Guides display without a provider and enter permitted coach context as quoted study notes; concrete moves still require engine evidence. Live-help restrictions apply
- [x] 5.6 Opening variations at the board: current opening and legal moves towards named destinations from the CC0 catalogue
  - [x] 5.6.1 Current name/ECO and each next move's three nearest named destinations, compiled from the same lines as `openings.json`. Deeper names show the remaining plies; frequencies stay in the reference-game explorer (5.2)
  - [x] 5.6.2 Hover/focus previews the position after the move. Click/Enter extends a scratch line in analysis; at the current live position it plays a normal player move, with turn/clock/engine-reply guards
  - [x] 5.6.3 EPD matching joins transpositions and preserves side/castling/en-passant rights. SAN and full move numbers come from the query FEN
  - [x] 5.6.4 Restricted live help (off, flags, eval) clears the panel, including while closed. Full help allows browsing; historical/opponent-turn moves cannot be played. Held actions recheck game, position and permission
  - [x] 5.6.5 Permitted coach context includes quoted catalogue metadata alongside 5.5 study notes. "About this opening" asks about the actual displayed position; General chess/restricted help omit names. Concrete advice still requires Stockfish evidence
  - [x] 5.6.6 Unit/browser coverage: known/deeper destinations, transpositions, rights/counters, malformed data, preview/keyboard cleanup, scratch/live actions, stale actions/loading, help policy, coach context and German phone layout

## 6. Tactics and strategy curriculum

- [x] 6.1 Curriculum structure: validated modules → lessons → exercises with stable IDs, levels, themes, bilingual authored text, acyclic prerequisites and source/licence metadata. Lessons catalogue filters by level/module/theme; positions and recorded lines are checked with chess.js, including terminal mate checks for mate exercises
- [x] 6.2 Tactics: 13 bilingual concept lessons covering forks, pins, skewers, discovered attacks, double checks, deflection, decoy, overloading, interference, removing a defender, zwischenzugs, back rank and mating patterns. Legal examples and declared motif geometry are checked; a capturable-fork counterexample distinguishes recognition from payoff
- [x] 6.3 Strategy: eleven bilingual reflection lessons covering IQP, Carlsbad and hanging-pawn structures, weak squares, outposts, bishop quality, open files, king safety, piece/king activity and prophylaxis. Legal examples, explicit objectives/rubrics, checked structure tags and board-fact tests support the authored material; candidate plans are not engine verdicts
- [x] 6.4 Endgames: six bilingual lessons cover queen/rook mates for both colours, king and pawn, the rook-pawn exception, opposition with either side to move, Lucena and Philidor. Ten exercises and all 28 worked plies are checked against recorded Syzygy outcomes for full FEN; offline audit and explicit refresh script preserve source/date/digests
- [x] 6.5 Puzzle source: bounded Lichess CC0 CSV ingestion and 64 recorded starter puzzles, with source IDs/themes/ratings/licence, provenance/digest and offline regeneration. Setup moves are applied before learner positions; all solutions replay legally and mate claims are rules-checked. Four editorial rating groups join the catalogue
- [x] 6.6 Lesson player: isolated interactive board, explanations, keyboard worked-line viewer, staged authored hints, explicit promotions and reveal/restart. Mate tasks accept every actual checkmate; source puzzles check recorded-line recall and replies; written reflections require rubric self-assessment. Completion events distinguish these outcomes and help use
- [x] 6.7 Progress per lesson and theme: versioned browser-local results with separate mate/recall/self-assessment/reveal and help counters, retained task revisions, validated Coach challenge counters, catalogue badges, retryable failed saves and preserved unreadable data. Counts describe practice rather than measured mastery; no reflection response text is stored
- [ ] 6.8 Play a lesson position out against Stockfish (the game start from 1.8 takes a FEN or moves)

## 7. Reference library: games and problems

- [x] 7.1 Source-aware data model: stable collection-scoped game/source IDs, shared EPD positions, full-FEN occurrences and revision-bound annotations/studies. Separate score/comment licences, exact mainline PGN locators, optional import/source editing and non-destructive legacy handling; [schema and lifecycle](LIBRARY.md)
- [ ] 7.2 PGN import with deduplication *(prototype)*. Remaining: deduplication.
- [ ] 7.3 Classic games collection: public game scores only, no copyrighted annotations. Started: 9 games and 4 studies in `classics.js`, tagged by theme, with our own notes, every score checked with chess.js; in the library under Classics. 7.1 now records their packaged source and project-authored annotation licence. Remaining: a larger collection and verified original score sources/licences per item
- [ ] 7.4 Problems and studies collection. Started: four classic studies (Réti, Saavedra, Lucena, Philidor) in `classics.js`
- [ ] 7.5 Search by player, opening, year, result, theme
- [ ] 7.6 Storage: SQLite on the server, IndexedDB cache in the browser
- [x] 7.7 The user's own games *(prototype)*

## 8. RAG on positions and tactical patterns

- [ ] 8.1 Position index: exact EPD and pawn-structure signature *(prototype)*, plus material signature and piece-placement features. Remaining: material and piece-placement signatures.
- [ ] 8.2 Pattern tags per position and move, from the motif and theme detectors *(prototype)*
- [x] 8.3 Text index for annotations and lesson text; embeddings from a separately configured provider (OpenAI, Mistral or Ollama; Anthropic has no embeddings API)
  - [x] 8.3.1 Local lexical passage index: mainline comments with source/occurrence locators, bilingual authored guide sections, filtered BM25 Library search, exact annotated-position navigation and a 28-query [passage benchmark](TEXT-SEARCH.md)
  - [x] 8.3.2 Explicit semantic indexing/search of selected passages, scoped in-memory vectors, local-only enforcement and provider/model/revision/dimension metadata. [Local bge-m3 comparison](eval/retrieval/dense-bge-m3.md) improves paraphrase recall but exposes uncalibrated no-answer false positives
- [x] 8.4 [Hybrid retrieval](HYBRID-SEARCH.md): bounded rank fusion of BM25, dense, exact/pawn and feature-tag candidates; deterministic term/board reranking, visible match reasons and optional literal every-term filtering. [Measured comparison](eval/retrieval/hybrid-bge-m3.md) records recall/no-answer tradeoffs; semantic support and calibrated abstention are not established
- [x] 8.5 [Fuzzy pawn-structure distance](PAWN-DISTANCE.md): colour-specific square-set Jaccard distance, optional ≥75% overlap in Combined search, compatible turn/check/phase, exact/analogy labels and unmatched-square explanations. [Offline spatial comparison](eval/retrieval/pawn-distance.md) records gains and the sparse one-pawn miss
- [x] 8.6 [Retrieved coach passages and citations](RETRIEVAL-CITATIONS.md): bounded local keyword/board retrieval for tutor/chat, quoted source excerpts, request-bound citation IDs, exact occurrence navigation and live-game confirmation/return. Citation identity is checked; semantic support is not automatically verified
- [x] 8.7 Treat retrieved text as untrusted: delimit it and never follow instructions inside it (imported PGN comments can carry prompt injection) *(added)*
- [x] 8.8 Retrieval eval: 24 labelled English/German position queries with expected source/occurrence references; offline production baseline with precision/recall/MRR/nDCG at 1/3/6 and separate no-answer false-positive rates. [Method and results](RETRIEVAL-EVAL.md) *(added)*
- [x] 8.9 Research text, structured and graph RAG, neurosymbolic game approaches, and AI use cases in milestones 5–7; document the current Stockfish boundary and proposed evaluations in [docs/research](research/README.md). Research delivery; subsequent implementation is tracked separately above. *(added)*

## 9. Progress and personalization *(added)*

- [ ] 9.1 User profile: level, rating estimate, goals
- [ ] 9.2 Weakness tracking from game reviews (missed themes, weak game phases)
- [ ] 9.3 Puzzles generated from the user's own mistakes
- [ ] 9.4 Spaced-repetition scheduler for puzzles, openings and lessons
- [x] 9.5 Study plan suggestions *(prototype)*

## 10. Accounts, privacy and reach *(added)*

- [ ] 10.1 Decide on the deployment mode: single-user local app or hosted multi-user service
- [ ] 10.2 Authentication, if hosted: sessions plus passkeys or OAuth
- [ ] 10.3 Data export and deletion
- [ ] 10.4 Privacy notice: what goes to which AI provider, with opt-in per provider
- [ ] 10.5 Accessibility: keyboard play, colour-blind-safe arrows, reduced motion
- [x] 10.6 Mobile layout and dark mode *(prototype)*
- [ ] 10.7 Offline use (PWA): engine, library and curriculum work offline; the coach works offline with Ollama or the in-browser model (2.16)
- [ ] 10.8 Internationalization
  - [x] 10.8.1 A language switch in the header, English and German: the page in German, the coach's answers in German, German move letters read (Sf3), screen-reader moves in German
  - [ ] 10.8.2 German letters or figurines in the move list and the answers, as a setting (today the app shows English SAN, as Lichess does)
  - [ ] 10.8.3 Opening names in German (eco.json is English), and the classic games' PGN comments
  - [ ] 10.8.4 The tutor eval set in German: the same positions with German key points, run against each provider

## 11. Security testing (before every release)

- [ ] 11.1 Threat model covering the data flows: browser ↔ server ↔ providers, PGN imports, RAG store
- [ ] 11.2 OWASP Top 10 (current edition): a checklist mapped to the code, with findings tracked as GitHub issues
- [ ] 11.3 OWASP Top 10 for LLM Applications (2025), with test cases for each item:
  - [x] 11.3.1 LLM01 Prompt injection: direct (chat) and indirect (PGN comments, library text)
  - [ ] 11.3.2 LLM02 Sensitive information disclosure: API keys, other users' data
  - [ ] 11.3.3 LLM03 Supply chain: pinned packages and model versions
  - [ ] 11.3.4 LLM04 Data and model poisoning: imported games and annotations in the RAG store
  - [ ] 11.3.5 LLM05 Improper output handling: model output never rendered as HTML; annotations validated. Remaining: annotation validation (with 4.4); output is already rendered as text only.
  - [ ] 11.3.6 LLM06 Excessive agency: model actions are limited to validated, bounded board tools; the saved library is read-only, and leaving a running game requires confirmation
  - [ ] 11.3.7 LLM07 System prompt leakage: no secrets in prompts
  - [ ] 11.3.8 LLM08 Vector and embedding weaknesses: users' data kept separate in the RAG store
  - [ ] 11.3.9 LLM09 Misinformation: every chess claim checked against the engine
  - [ ] 11.3.10 LLM10 Unbounded consumption: rate limits and token budgets. Remaining: per-user limits (10.1); the gateway has a rate limit, a daily token budget, max output tokens and size limits.
- [ ] 11.4 OWASP ASVS: pick a level (L1 for a local app, L2 if hosted with accounts), keep a verification checklist, automate checks where possible
- [ ] 11.5 Automated scans: Dependabot, CodeQL, secret scanning, OWASP ZAP baseline against staging, CSP check
- [ ] 11.6 Release gate: security checklist in the release PR; no open high-severity findings

## 12. Release and operations *(added)*

- [ ] 12.1 Semantic versioning and a changelog
- [ ] 12.2 Packaging: Docker image for the Node server and static client
- [ ] 12.3 Logging and monitoring, with no personal data or prompts in logs by default
- [ ] 12.4 Docs: user guide, provider setup, self-hosting with Ollama
