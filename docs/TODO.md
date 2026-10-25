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
  - [x] 0.3.1 Make `just` dependency installation detect changed manifests/lockfiles/runtime and missing or mismatched packages before building; retain a fast path only for a verified complete tree.
- [x] 0.4 Decide on typing: JS + JSDoc checked by `tsc --checkJs`, or TypeScript. JS + JSDoc, checked by `npm run typecheck`.
- [x] 0.5 Add linting and formatting (ESLint, Prettier). ESLint and `.editorconfig`; no Prettier (see DONE.md).
- [x] 0.6 Set up the test harness: `node:test` for unit tests, `@playwright/test` for e2e (port `claude/tests/e2e.py` to JS)
- [x] 0.7 Turn `knowledge.test.mjs` into real assertions; today it only prints output
- [x] 0.8 GitHub Actions on every PR: lint, unit, e2e, build, `npm audit`, CodeQL, secret scanning. CodeQL is skipped while the repo is private; gitleaks does the secret scanning.
- [x] 0.9 PR template with a checklist: tests, TODO/DONE updated, security impact
- [x] 0.10 Licensing: GPL-3.0 (required by Stockfish and chessground), `LICENSE` file, third-party notices. GPL-3.0-or-later.
- [x] 0.11 Fix `.gitignore`: `tests/out/` only matches at the repo root; use `**/tests/out/`
- [x] 0.12 Keep repository utilities under root `utils/`; move the PDF tooling to `utils/pdf/` and update its references. *(added)*
  - [x] 0.12.1 Rebuild Markdown PDFs only when missing, empty or older than their source/rendering inputs; use modification dates for both `just pdf` and `just pdfs`, retaining agent-instruction exclusions. *(added)*
- [x] 0.13 Document the LLM and symbolic design across features in a brief [design overview](AI-DESIGN.md), distinguishing built behaviour, planned features and ROAD explorations. *(added)*
- [x] 0.14 Organize existing source modules into `chess/`, `coach/`, `library/`, `openings/` and `platform/`; preserve directories in the build and update imports, tests, tools and documentation. *(added)*

- [x] 0.15 Create a typed file-level assurance lineage graph linking artifacts, TODO items, DONE entries, insights and deviations; retain provenance/gaps and provide reproducible validation and queries. *(added)*
- [x] 0.16 Extend assurance with separate object/PR and documentation/link graphs, reproducible object selection, and a small searchable dependency browser in `utils/`.
  - [x] 0.16.1 Object/function/block lineage and retained PR description sections with explicit provenance.
  - [x] 0.16.2 Documentation headings, fenced blocks, project links and cross-level planning/rationale connections.
  - [x] 0.16.3 Compare compatible graph foundations and implement offline search, traversal and source inspection.
- [x] 0.17 Add confidence-weighted typed links, editable relation assessments, transparent gap/deviation inference, browser filters and an assurance README.

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
- [x] 2.9 Key management for the selected local single-user deployment: operator keys come from server env and never reach the browser, logs or prompts. An encrypted per-account store is deferred with hosted accounts; [deployment decision](DEPLOYMENT.md)
- [x] 2.10 Model choice per task (quick comment, chat, deep review) and per provider *(added)*
  - [x] 2.10.1 Use GPT-6 Luna's supported non-reasoning mode for Chat Completions, including per-task selection, Stockfish tool continuations, structured replies and the connection check; keep other models/providers unchanged
- [x] 2.11 Limits for the selected local single-user app: shared and per-cookie minute rates, daily server tokens, per-cookie paid token/cost thresholds, timeouts and usage display. Standard serve recipes persist counters across restarts in private SQLite. Cookies supply soft local grouping; hosted account budgets remain deferred with 10.2. [Behavior, retention and admission-threshold limits](USAGE.md).
- [x] 2.12 Allowlist for the Ollama base URL (SSRF guard) *(added)*
- [x] 2.13 Mock provider with deterministic fixtures for tests and offline development *(added)*
- [x] 2.14 Settings UI: provider, model, connection test, local-only mode
- [ ] 2.15 Contract tests per adapter against recorded responses; live smoke tests run only when an env flag is set. Remaining: recorded fixtures for OpenAI, Mistral and Ollama (hand-written from the documented format until their keys work; Claude's are recorded).
- [x] 2.16 Offline mode with an in-browser model: default pinned wllama/GGUF inference plus optional Chrome built-in model, explicit loading consent and offline lifecycle. Initial weight provisioning needs the relevant download; [runtime-specific limits](OFFLINE.md#optional-chrome-built-in-coach) *(added)*
  - [x] 2.16.0 `just offline`, a recipe of its own: on first run it downloads the chosen model's weights into `site/models/` (gitignored, checksums verified); then it builds and serves the app with local-only mode on and the in-browser model as the provider. In this mode nothing leaves the machine: the weights come from our own server and the CSP allows `connect-src 'self'` only
  - [x] 2.16.1 Runtime:
    - WebLLM on WebGPU first: fast, with an OpenAI-style API and JSON-schema output
    - wllama when there's no WebGPU: llama.cpp in WebAssembly, multi-threaded under the COOP/COEP headers we already send
    - Chrome's built-in model (Prompt API) as an optional extra where it exists
    - Licences fit GPL-3.0 (Apache-2.0, MIT)
    - Default wllama covers WebGPU and WebAssembly without a second dependency. Optional Chrome Prompt API is selected explicitly with `BROWSER_RUNTIME=chrome` or `just offline-chrome`; browser-managed weights/resources and explicit Load-per-session requirements are documented separately
  - [x] 2.16.2 Model: a small open model under Apache-2.0 or MIT, chosen with the tutor eval set (3.8). It only puts into words what the engine and the detectors found, which is what makes a small model usable. The weights download on first use, only after the player agrees, with the size shown. They're cached in the browser and always come from our own server (2.16.0), never from a CDN. Done: Qwen2.5 1.5B Instruct (default) and 0.5B, Apache-2.0, pinned by SHA-256, consent before loading. The eval set (3.8) keeps 1.5B as the default: 50% against 42% for 0.5B, but far behind the cloud models (Haiku 79%, Opus 95%), so it stays the offline fallback
  - [x] 2.16.3 wllama runs in its own Worker behind the page-side sample interface; Chrome's current API requires Window access and uses disposable session clones. Both support streaming/cancellation and requested JSON constraints; native Chrome has character/time bounds without invented token usage. Settings list them as "In browser", and local-only mode (2.14) counts them as local
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
- [x] 6.8 Play the displayed lesson position against Stockfish as either colour, preserving its full FEN and using existing strength/clock settings. Active games require a confirmed successful save; cancellation, stale actions and save failures leave the current game intact

## 7. Reference library: games and problems

- [x] 7.1 Source-aware data model: stable collection-scoped game/source IDs, shared EPD positions, full-FEN occurrences and revision-bound annotations/studies. Separate score/comment licences, exact mainline PGN locators, optional import/source editing and non-destructive legacy handling; [schema and lifecycle](LIBRARY.md)
- [x] 7.2 PGN import with conservative document deduplication: skip repeat copies within a batch/current user library, allowing outside whitespace/header-order differences while preserving distinct annotations, variations, headers, full-FEN starts and source/licence assertions. Separate added/duplicate/unreadable/failed counts, bounded batches and retry-safe local/account writes
- [x] 7.3 Classic games collection: 21 games, with per-game published score sources/rights and original Kibitz notes. Twelve complete Capablanca book scores join nine sourced teaching versions; 1,355 plies audit offline, including reconstruction of 980 descriptive book plies. Fixed revisions/page links, retained source licences, explicit historical/teaching distinctions and excluded incomplete scores are documented in [the source manifest](../site/data/classics/README.md). Problem/study sources are covered in 7.4
- [x] 7.4 Problems and studies collection: twelve sourced positions, four actual mates in one and eight studies/reflections. Published Réti/Saavedra diagrams, explicit Lucena/Philidor teaching variants and eight authored curriculum examples have bilingual questions, a Problems filter and diagram-first opening. Exact source/FEN/line bindings check 48 worked plies against 50 saved tablebase records; imports/prose/other branches gain no certificate. [Sources, rights and offline audit](../site/data/problems/README.md)
- [x] 7.5 Search by player, opening, recorded year range, result and theme: combined literal case/accent-insensitive metadata filters, localized titles/theme labels, legal PGN/ECO facts, explicit invalid/unknown-year handling and shared coach-tool matching. Accessible English/German controls retain category/reset behavior and source drafts/focus; [rules and limits](LIBRARY.md#catalogue-search)
- [x] 7.6 Storage: optional private SQLite server library with anonymous cookie scopes, atomic optimistic writes, bounded legal records and a verified-scope IndexedDB cache. Explicit English/German selection keeps browser/account stores separate without uploads or migration; cache failures do not revoke server saves, and conflicts/uncertain receipts require refresh. [Storage lifecycle and limits](LIBRARY.md#server-library-and-browser-cache)
- [x] 7.7 The user's own games *(prototype)*

## 8. RAG on positions and tactical patterns

- [x] 8.1 Position index: exact EPD and pawn signature plus versioned colour-specific material counts, full piece placement and occupied piece-square terms. Rules-replayed source occurrences retain full FEN/revisions; bounded, source-filtered feature lookups distinguish structural matches without changing default retrieval ranking. [Fields and limits](LIBRARY.md#material-and-piece-placement)
- [x] 8.2 Pattern tags per source position and recorded move/three-ply branch, derived from legal replay with exact occurrence/revision identities. Position heuristics, geometric candidates and rules-proven mate/promotion facts remain distinct. Local English/German pattern search filters evidence/source and opens exact occurrences under live-help/source-generation guards; [fields and limits](LIBRARY.md#position-and-move-pattern-tags)
- [x] 8.3 Text index for annotations and lesson text; embeddings from a separately configured provider (OpenAI, Mistral or Ollama; Anthropic has no embeddings API)
  - [x] 8.3.1 Local lexical passage index: mainline comments with source/occurrence locators, bilingual authored guide sections, filtered BM25 Library search, exact annotated-position navigation and a 28-query [passage benchmark](TEXT-SEARCH.md)
  - [x] 8.3.2 Explicit semantic indexing/search of selected passages, scoped in-memory vectors, local-only enforcement and provider/model/revision/dimension metadata. [Local bge-m3 comparison](eval/retrieval/dense-bge-m3.md) improves paraphrase recall but exposes uncalibrated no-answer false positives
- [x] 8.4 [Hybrid retrieval](HYBRID-SEARCH.md): bounded rank fusion of BM25, dense, exact/pawn and feature-tag candidates; deterministic term/board reranking, visible match reasons and optional literal every-term filtering. [Measured comparison](eval/retrieval/hybrid-bge-m3.md) records recall/no-answer tradeoffs; semantic support and calibrated abstention are not established
- [x] 8.5 [Fuzzy pawn-structure distance](PAWN-DISTANCE.md): colour-specific square-set Jaccard distance, optional ≥75% overlap in Combined search, compatible turn/check/phase, exact/analogy labels and unmatched-square explanations. [Offline spatial comparison](eval/retrieval/pawn-distance.md) records gains and the sparse one-pawn miss
- [x] 8.6 [Retrieved coach passages and citations](RETRIEVAL-CITATIONS.md): bounded local keyword/board retrieval for tutor/chat, quoted source excerpts, request-bound citation IDs, exact occurrence navigation and live-game confirmation/return. Citation identity is checked; semantic support is not automatically verified
- [x] 8.7 Treat retrieved text as untrusted: delimit it and never follow instructions inside it (imported PGN comments can carry prompt injection) *(added)*
- [x] 8.8 Retrieval eval: 24 labelled English/German position queries with expected source/occurrence references; offline production baseline with precision/recall/MRR/nDCG at 1/3/6 and separate no-answer false-positive rates. [Method and results](RETRIEVAL-EVAL.md); [literature algorithm comparison](research/position-retrieval-comparison.md) distinguishes current measurements from published tasks and proposed replications *(added)*
- [x] 8.9 Research text, structured and graph RAG, neurosymbolic game approaches, and AI use cases in milestones 5–7; document the current Stockfish boundary and proposed evaluations in [docs/research](research/README.md). Research delivery; subsequent implementation is tracked separately above. *(added)*

## 9. Progress and personalization *(added)*

- [x] 9.1 Browser-local player profile: explanation level, optional self-reported rating/pool/time control and bounded learning goals. Acknowledged saves, future-format preservation, stale-tab draft protection and quoted request context keep preferences separate from measured ability/opponent strength; [lifecycle and limits](PROFILE.md)
- [x] 9.2 Own-game review trends: source-bound historical analysis reports, measured-move/error/accuracy coverage by estimated phase and bounded engine-confirmed opportunities. Refuted/unverified motifs and restored values gain no credit; reruns replace contributions, while deletion/source/library changes remove them. Localized source navigation and future-format preservation follow existing guards; [evidence and limits](REVIEWS.md)
- [x] 9.3 Puzzles generated from compatible own-game review mistakes: fresh bounded Stockfish targets, arbitrary legal alternatives, explicit promotions, independent practice board and source/help/generation guards; [criteria and limits](OWN-PUZZLES.md)
- [x] 9.4 Browser-local spaced practice across current lesson/puzzle tasks, opening recalls and selected-owner own mistakes: due-first bounded queue, shared deterministic intervals, distinct evidence labels, revision/source guards and acknowledged retry receipts; [lifecycle and limits](PRACTICE.md)
- [x] 9.5 Study plan suggestions *(prototype)*

## 10. Accounts, privacy and reach *(added)*

- [x] 10.1 Local single-user app, confirmed by the project owner: loopback Node server, browser-first storage, optional private SQLite library and operator env keys; [decision and plan consequences](DEPLOYMENT.md)
- [ ] 10.2 Authentication, if hosted: sessions plus passkeys or OAuth. *Deferred by 10.1's local deployment decision; no hosted authentication is claimed.*
- [x] 10.3 Local data export/deletion: standalone raw browser/current-owner server JSON exports, separate explicit confirmations, cache-aware acknowledged erasure and atomic server revision tombstones; [formats and scope](DATA.md)
- [x] 10.4 Explicit provider/purpose privacy opt-in: initially off network coach/test and passage/query-embedding grants, acknowledged saves/revocation retry, actual-routing gateway preconditions and cancelled late/cross-tab work; [data flows and limits](PRIVACY.md)
- [x] 10.5 Accessibility: native keyboard square play with legal destinations and explicit promotion, independent arrow patterns/text descriptions and live reduced-motion control; [controls and verification limits](ACCESSIBILITY.md)
- [x] 10.6 Mobile layout and dark mode *(prototype)*
- [x] 10.7 Explicit offline/PWA preparation: verified public engine/reference/lesson bundle, browser library, waiting updates, scoped removal and browser-coach fallback. Ollama retains its local gateway requirement; [preparation and storage limits](OFFLINE.md)
- [ ] 10.8 Internationalization
  - [x] 10.8.1 A language switch in the header, English and German: the page in German, the coach's answers in German, German move letters read (Sf3), screen-reader moves in German
  - [x] 10.8.2 German letters or figurines in the move list and the answers, as a setting (today the app shows English SAN, as Lichess does)
  - [x] 10.8.3 Opening names in German (eco.json is English), and the classic games' PGN comments
  - [ ] 10.8.4 The tutor eval set in German: the same positions with German key points, run against each provider
    - [x] 10.8.4.1 German versions of the same ten positions/28 concepts, actual UI chips, language-bound reports and no-call planning; mock/unit/browser validation
    - [x] 10.8.4.2 Record approved live German trials against the four configured providers; [results and limitations](eval/german-plan.md). Claude answered ten positions; OpenAI authentication, Mistral rate limits and missing Ollama model blocked the other runs. Legacy capture contamination is retained and labelled; future captures exclude source/tool/UI cards
    - [ ] 10.8.4.3 Complete the provider comparison after credentials/quota/model availability are fixed, using a new approved plan and comparable `coach-prose-v2` captures; no semantic quality grade is inferred from regex cue scores

## 11. Security testing (before every release)

- [x] 11.1 Threat model covering browser/server/provider boundaries, PGN and retrieval data, browser inference, private libraries, usage counters, offline caches and exports; [flows, controls, evidence and residual risks](THREAT-MODEL.md).
- [x] 11.2 OWASP Top 10:2025: [code/evidence checklist](OWASP-TOP10.md), supported local deployment and findings tracked in issues #96–99. Post-merge main `71a863d` has no open CodeQL highs and three reviewed medium alerts; deployment/LLM/asset follow-ups and release verification remain open
  - [x] 11.2.1 Reject library/usage databases inside either served root, including aliases; validate model directories before file creation. Issue #96, unit and real-CLI Playwright regressions
  - [x] 11.2.2 Bound model downloads by pinned bytes and a total deadline; verify before publishing, clean up handled failures and preserve earlier weights before publication. Issue #97, synthetic CLI and stream/filesystem tests
  - [x] 11.2.3 Remove raw URL/provider/config/path text from default runtime logs; fixed category/code/status events, startup diagnostics and local monitoring. Issue #98; hostile marker, malformed-target and CLI regressions
  - [x] 11.2.4 Correct both Slav prefix alternatives and literal/all-slot phrase interpolation, with unit/browser regressions. CodeQL contexts 16/17 under #99; remaining file/scanner findings stay open
  - [x] 11.2.5 Serve static/model bytes, metadata and HTML CSP from one validated regular-file descriptor; reject asset aliases, handle read faults/disconnects and close handles. CodeQL contexts 7/8 under #99; filesystem/CLI/browser regressions
  - [x] 11.2.6 Issue the AI usage cookie with Secure on a native TLS socket, matching the library. Preserve supported local HTTP behavior; real TLS/browser regressions cover scope, reuse and untrusted forwarding headers. Cookie context 4 remains deployment-scoped under #99
  - [x] 11.2.7 Select CSP script hashes with an HTML parser, including correct tag/attribute/text boundaries and inert content; bounded missing-dependency startup, licence notices and browser regressions. Contexts 2/3/5 under #99; other scanner findings remain open
  - [x] 11.2.8 Stage provider fixtures privately after explicit execution; bound capture, reject errors/incomplete/credential-bearing responses and replace files atomically. Context 9 under #99; synthetic SDK/CLI regressions. Real missing-provider recordings (2.15) and main-branch scan verification remain open
- [ ] 11.3 OWASP Top 10 for LLM Applications (2025), with test cases for each item; [evidence, limits and 2026 crosswalk](OWASP-LLM.md). Review, rejection privacy and runtime response bounds are complete; model identity and unrestricted claim verification remain open:
  - [x] 11.3.1 LLM01 Prompt injection: direct (chat) and indirect (PGN comments, library text)
  - [x] 11.3.2 LLM02 Sensitive information disclosure: credential/context separation, cookie-scoped library isolation, provider/purpose consent and fixed provider-rejection hints tested in the local deployment; authorized private context/provider retention remain separate risks
    - [x] 11.3.2.1 Replace raw page-facing HTTP 400 rejection prose with fixed capability/generic hints across coach, structured, connection-test and embedding routes; real-SDK and actual-CLI/browser regressions retain tool fallback and cover German hints
  - [ ] 11.3.3 LLM03 Supply chain: packages/GGUF bytes are pinned and tested; [registry signatures and browser-runtime source candidates](COMPONENT-PROVENANCE.md) are recorded, with compilation linkage unverified. Cloud IDs, Ollama tags and Chrome-managed updates remain mutable. Model identity/upgrade evidence remains open; automated scans are recorded in 11.5
    - [x] 11.3.3.1 Pin both browser-model download locators to exact official Qwen commits matching the existing size/hash pins; retain verified LFS pointers and dated model-card/licence evidence, with offline catalogue and actual-CLI regressions. Model bytes/cache compatibility stay the same; training/quantization lineage and other runtimes remain open
  - [x] 11.3.4 LLM04 Data and model poisoning: imported games/annotations stay validated source assertions in the scoped RAG store; source identity never promotes their prose to engine evidence. Source/model truth is not certified
  - [x] 11.3.5 LLM05 Improper output handling: model prose rendered as text; schema, board marks, legal moves and request-bound citations validated, with hostile unit/browser cases
  - [x] 11.3.6 LLM06 Excessive agency: model actions are limited to validated, bounded board tools; the saved library is read-only, and leaving a running game requires confirmation
  - [x] 11.3.7 LLM07 System prompt leakage: configured credentials remain transport-only; four real-SDK/gateway tests inspect model context and public responses. Prompts/policies are not secret authorization controls
  - [x] 11.3.8 LLM08 Vector and embedding weaknesses: scoped/model-bound in-memory vectors, pre-upload filtering, separate consent and stale/cross-scope rejection tests; hosted tenancy is not claimed
  - [ ] 11.3.9 LLM09 Misinformation: every chess claim checked against the engine. Partial only: recognized move/selected English piece claims and confirmed motifs are checked; arbitrary prose can still return zero problems. Owner direction on 2026-10-25 retains experimental free-form prose for the first candidate with this limitation documented; the general verification requirement remains unmet
  - [x] 11.3.10 LLM10 Unbounded consumption: shared/per-cookie rates, persistent soft thresholds and independent per-operation time/body/result bounds tested; usage thresholds are not hard spending or concurrency reservations
    - [x] 11.3.10.1 Bound runtime chat/embedding SDK operations to a total deadline (default 60 seconds, maximum 15 minutes), 8 MiB body/embedding-result caps and a smaller 128 KiB decoded coaching cap; stalled/overflow/abort, actual loopback/CLI/browser, accounting/private-diagnostic and connection-test disconnect regressions. SDK retries disabled; format/tool/server-side fallbacks remain separately bounded calls
  - [x] 11.3.11 Review all ten categories against code/tests, add four-adapter credential-context tests and a 2026 numbering crosswalk, and reproduce unresolved misinformation/stream-deadline limits without live calls
- [x] 11.4 OWASP ASVS review: selected stable 5.0.0 L1 for the local single-user app; [70 individually assessed requirements](ASVS.md), pinned offline coverage/evidence/document checks in CI. Review completion is not compliance or release approval; HTTP findings, deployment deviations and incomplete inventory remain explicit
  - [x] 11.4.1 HTTP hardening from the L1 review: compare the AI gateway Origin's native scheme as well as host, preserve direct local clients, ignore forwarded-header spoofing, and declare UTF-8 on SVG responses; native HTTP/TLS and actual-CLI/browser regressions, both old behaviors reproduced
  - [ ] 11.4.2 Resolve all ten ASVS deviations and both open controls accepted temporarily in PR #133 **before the first final (non-prerelease) release**. The RC exceptions do not carry into that release. Each child needs implemented remediation, cited verification and an updated assessment; approval or another exception does not close a fix. The project maintainer owns follow-up. Keep the 2026-11-01 review dates, 2026-11-24 component-plan date and original finding deadlines; final-release readiness is an additional gate, not a deadline extension. Preserve the local single-user scope; hosted accounts remain deferred under 10.2.
    - [ ] 11.4.2.1 **ASVS 3.3.1 — cookie protection:** use Secure cookies with the required `__Host-` or `__Secure-` prefix in the supported final deployment. Design and test a data-preserving migration for existing usage/private-library groups, including rollback and cookie-scope isolation; update compatibility guidance.
    - [ ] 11.4.2.2 **ASVS 3.4.1 — HSTS:** establish an isolated HTTPS application hostname/deployment and send HSTS with at least a one-year maximum age on every response. Test success/error paths and document deployment/rollback effects without applying a localhost-wide policy to unrelated apps.
    - [ ] 11.4.2.3 **ASVS 7.2.1 — backend session verification:** replace trusted grouping-cookie assertions with backend-verified, issued sessions bound to the local operator. Reject invented or cross-owner tokens and migrate existing private collections safely; verify gateway and library access. This does not introduce hosted multi-user accounts.
    - [ ] 11.4.2.4 **ASVS 7.4.1 — session termination:** invalidate sessions at the backend on logout and expiry, rejecting copied tokens and further use after termination. Test replay, expiry, concurrent requests and restart behavior; browser cookie expiry alone is insufficient.
    - [ ] 11.4.2.5 **ASVS 8.2.1 — explicit function permissions:** enforce backend permissions for the authenticated local operator across AI, connection-test, embedding and private-library functions. Test missing/denied permission and cross-owner access; same-origin checks and sharing consent remain separate controls.
    - [ ] 11.4.2.6 **ASVS 12.1.1 — actual TLS inventory:** record protocol settings and verified negotiated versions for every supported final browser/gateway/provider/service transport, allowing only currently recommended TLS versions and preferring the latest. Retain dated endpoint evidence without credentials; enforce the reviewed configuration and test downgrade refusal. Initial inventory review remains due 2026-11-01.
    - [ ] 11.4.2.7 **ASVS 12.2.1 — encrypted connectivity:** require TLS for the final browser/gateway deployment and external HTTP service connections, rejecting insecure fallback and unsupported plaintext endpoint overrides. Test actual native/container boundaries and failure behavior; update deployment/provider instructions.
      - [x] 11.4.2.7.1 Add [native Node HTTPS](TLS.md) with operator-supplied PEM identities, bounded private-file checks, refusal of invalid TLS configuration without HTTP fallback, real CLI/browser tests and a packaged-image TLS case. This prerequisite does not close cookie migration, final transport enforcement, external endpoint policy or the parent ASVS control
    - [ ] 11.4.2.8 **ASVS 12.2.2 — public certificate trust:** inventory externally facing services and verify publicly trusted certificates, hostname checks and renewal/expiry handling. Test invalid/untrusted/expired certificates without a trust bypass; private test certificates are not release endpoint evidence.
    - [ ] 11.4.2.9 **ASVS 13.4.1 — checkout isolation:** ensure source-control metadata is unavailable both over HTTP and to the application process in every supported final execution mode, including native operation. Stage or isolate native runtime files outside readable checkout metadata; test process-level and HTTP access while preserving packaged exclusion.
    - [ ] 11.4.2.10 **ASVS 14.2.1 — private positions in URLs:** replace the position-bearing external navigation path with a handoff that keeps sensitive FEN/private data out of URLs, query strings and browser history. Verify outbound navigation, referrers and error/log paths; document the replacement analysis workflow.
    - [ ] 11.4.2.11 **ASVS 14.3.1 — authenticated client-data lifecycle:** clear authenticated data from DOM, memory and browser storage when the client/session terminates, including offline termination. Coordinate session revocation, caches and in-flight results; test logout, expiry, owner changes and recovery, with explicit migration/backup handling for existing saved collections.
    - [ ] 11.4.2.12 **ASVS 15.2.1 — component remediation evidence:** complete the component/build/tool/model inventory and advisory-age evidence, resolve coverage/provenance gaps, and remediate any component beyond the documented timeframes. Retain exact source/licence/version/scan evidence and independently review final runtime/build assets. Component review remains due 2026-11-01 and the remediation plan 2026-11-24; closure is required before final release even if those dates are later.
- [x] 11.5 Automated scans: Dependabot version-PR configuration, existing CodeQL/Gitleaks/audit, pinned ZAP against isolated mock staging, CSP check and retained inventory/evidence; [actual CI baseline](SECURITY-SCANS.md) covers seven required routes / sixty passive rules, zero highs, two medium and three informational finding types. Native GitHub feature settings are documented separately; no release/compliance claim
  - [x] 11.5.1 [Web assets](WEB-ASSETS.md): trusted stylesheet hashes and blocked style attributes, original pinned local fonts/licences, canonical wrapper charset and preserved interface/offline behavior. Old-backend regression fails, thirty browser cases pass, and the actual unsuppressed raw baseline reports zero high/medium findings; informational source-comment/cookie findings remain recorded
  - [x] 11.5.2 Keep CodeQL initialization/analysis on the same immutable revision; group future Dependabot updates and reproduce the split-version failure with a unit regression (PR #130)
  - [x] 11.5.3 Preserve strict style CSP with Chessground 10.4.2: move its fixed SVG color-scheme declaration to trusted CSS, document the local build adaptation and reproduce the attribute/appearance failure in Playwright
- [ ] 11.6 Release gate: security checklist in the release PR; no open high-severity findings. [Dated local review packet](RELEASE-REVIEW.md) records prerequisite evidence, individual ASVS deviations/open controls, retained advisory targets and required owner/candidate decisions; preparation does not close the gate. RC-only acceptance in #133 requires all twelve ASVS remediation items 11.4.2.1–11.4.2.12 fixed and verified before the first final release
  - [x] 11.6.1 [Exact image advisory evidence and minimal runtime](IMAGE-ADVISORIES.md): pinned verified publisher/scanner, fresh hashed DB, independent config/rootfs and OS/production-library coverage, four actual container/compatibility cases and a strict high/critical gate. Actual raw report has zero high/critical; 23 medium/eight low findings retain triage targets. CodeQL races fixed without dismissal. Parent release approval and broader component/model reviews remain separate
  - [x] 11.6.2 Reconcile the integrated draft candidate and existing owner-approved exceptions; retain sixteen raw scan/inventory files with source/merge identities, checksums and independently reviewed results in the [candidate evidence](releases/0.1.0-rc.1.md). All ASVS statuses, findings and original deadlines remain; final-head checks and the parent release decision stay open

## 12. Release and operations *(added)*

- [x] 12.1 Semantic versioning and a [changelog](../CHANGELOG.md): documented compatibility scope, 0.x bump rules, candidates, package/lock alignment, data migrations and immutable release tags; [release procedure](RELEASING.md). Existing 0.1.0 remains an unreleased development baseline; no release was tagged/published
- [x] 12.2 Packaging: [local Docker image and Compose recipe](CONTAINER.md), pinned Node 24, non-root runtime, private named volume and excluded operator/checkout files; four actual Linux image/browser/restart/previous-packaging cases pass, with publisher signature and image/source/package advisory evidence (11.6.1). No registry publication or release approval
- [x] 12.3 Logging and monitoring for the local app: closed-vocabulary HTTP/AI/config/startup events, no raw URLs/provider messages or personal payloads; [operator checks and retention](OPERATIONS.md), fake-SDK and real-CLI regressions
- [x] 12.4 Docs: [user guide](GUIDE.md), [provider setup and native Ollama self-hosting](PROVIDERS.md), linked to existing privacy, offline, data, evidence and container instructions; primary-source console references checked, mock/local commands verified without real inference
  - [x] 12.4.1 Refresh the flipbook for the current interface, repertoire/lessons/practice and German phone views; nineteen screenshots and nine approved fresh Haiku 5.5 answers, with prose-only capture and recorded provenance. Parent user/provider/Ollama documentation is complete in 12.4
