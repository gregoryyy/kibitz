# Kibitz: Neurosymbolic Chess Coach

Play Stockfish 19 in the browser, get your mistakes flagged as you play, ask Claude to explain positions, review finished games, keep a games library, and get reading suggestions matched to the position on the board.

Stockfish does all the calculation, locally in a Web Worker. Claude only explains: it receives the engine's lines and is told not to invent variations.

Claude url: https://claude.ai/chat/a529eba0-1588-46b2-ab42-b4f792b1d68d?artifact=9e603ff0-6c50-46b6-a1b1-80ec8e86fa65&org=02556618-dd82-41b1-950b-71fe78412f63

ChatGPT url: https://chatgpt.com/g/g-p-69a21eed60a8819192ac813ccef2b58f-chess/c/6ad712be-e674-83ed-afa7-fda0dfc3a14e

## Quick start

```bash
npm install
npm run serve            # builds dist/ and serves it with the AI gateway at http://127.0.0.1:8765/
npm test                 # AI gateway tests, then feature detection + retrieval checks (Node)
npm run test:e2e         # Playwright end-to-end tests in the installed Chrome (own server, mock AI provider)
npm run eval:retrieval   # offline labelled position-retrieval benchmark; no provider or build needed
```

Click **Analyse** during a game to pause it and its clock immediately. Explore moves or navigate the game, then click **Play** or **Return to my game** to resume exactly where you left it. Reopening Analyse keeps your study variation while the game is unchanged; after you play another move, it starts from the updated game. Both sessions stay in memory until you start a new game or reload the page.

In **Openings**, choose a saved White or Black repertoire and press **Review due moves** to practise new or due positions. Play on the drill board or type SAN/coordinates; the saved opponent reply follows automatically. Any saved choice at that position is accepted, including transpositions. A starting-square hint counts as help, and a legal move outside your repertoire counts as a recall miss rather than a chess judgement. Review dates and recall/help statistics stay in this browser. The drill leaves your game intact and follows its live-help setting; switch to Analyse to train without a running game.

**Opening ideas** shows original study notes for twelve opening families and seven pawn patterns, in English or German. A guide explains the idea, typical plans and possible structures; separate pattern notes reflect the pawns currently on the board. Guides follow transpositions and scratch variations, identifying earlier opening matches as background. **Discuss these ideas** gives the coach the same notes alongside permitted Stockfish evidence. Static guides need no provider. During a game they require Full engine help, following the explorer's policy; unsupported/endgame positions show an empty state instead of a guessed explanation.

**Named opening continuations** shows the current opening/ECO and legal next moves towards nearby named variations, including transpositions. A distance label distinguishes a later destination from an immediate name; these names do not rank move strength or frequency. Hover or focus previews the position after a move. Click or Enter extends a scratch line in analysis, or plays your next move at the current live position with Full help. Existing scratch lines stay separate from the game. **About this opening** gives the coach the actual position, quoted names and study notes; concrete advice still needs Stockfish. Browsing works without a provider and includes retry if the local catalogue fails to load. Off, Flag mistakes and Eval + mistakes hide the panel during play.

In **Library**, PGN imports accept optional source title, author/curator, URL and separate score/annotation licences. **Source and licences** lets you inspect or correct a saved game's fields. Missing details stay not supplied; old records are readable without a storage rewrite, and future metadata stays intact. Similar-position notes retain the exact game occurrence, including repeated boards and a study's initial position. Recorded study lines are checked for legality, with their result/solution still unverified. See the [source-aware data model](../docs/LIBRARY.md).

**Search study text** searches personal/classic PGN comments and original English/German study notes, with source and language filters. Read a literal passage and its source/licence, or open the precise annotated game step. Default **Keywords** search runs locally without a model; German move letters such as `Dxf7` also find English SAN. Optional **By meaning** shows the separately configured embedding destination: explicitly build the selected text index, then send a query with Search. Typing sends nothing. Vectors stay in memory and source/account/policy changes erase them. During play, both methods require Full engine help. The [design and measured comparison](../docs/TEXT-SEARCH.md) cover configuration and limitations, especially no-answer false positives. Hybrid ranking and generated-answer citations remain planned. Run `just retrieval-eval --mode text` from the repository root for the provider-free passage benchmark; `--mode dense` explicitly calls the configured embedding provider.

## Layout

```
src/index.html        The page: CSS, markup and the app module in one file.
                      Written as an artifact body (no <html>/<head>); the build wraps it for local use.
                      /*CG_BASE*/ and /*CG_PIECES*/ are replaced with chessground's CSS at build time.
src/knowledge.js      Pure functions, no DOM:
                        positionFeatures()   opening family, pawn structures, endgame type, passed pawns…
                        moveMotifs()         fork, pin, discovered attack, mate, sacrifice, Greek gift…
                        LITERATURE           book catalog (metadata + theme tags, no book text)
                        retrieveLiterature() ranks books by theme overlap and player level
                        buildPositionIndex() / similarPositions()   "seen before" search over the library
                        winPct / classify / moveAccuracy             Lichess-style move scoring
                        parseInfo()          UCI info-line parser
src/engine.js         Engine: Stockfish worker with fallbacks (multi-threaded when cross-origin isolated), job queue,
                      cancel by tag, time-capped depth searches; rejects all jobs if it dies
src/store.js          localStorage wrapper whose set() reports failure (e.g. quota exceeded)
src/library.js        Source assertions, revision-bound game/occurrence/annotation/study records and position-index adapter
src/openings.js       Reference-game position graph: continuations, record counts/results and sample occurrences
src/opening-guides.js Original bilingual study notes, visible-route/EPD matching, current pawn patterns and quoted coach context
src/opening-variations.js Build-time named-destination graph, checked position queries and quoted catalogue context
src/repertoire.js     Legal chosen opening lines, game/scratch path capture, position-based choices and browser storage
src/drills.js         Repertoire recall cards, legal replies, review queue, deterministic intervals and atomic progress storage
src/prompt.js         quote(): imported/user text goes into prompts as one-line «quoted» data
src/tutor.js          Coach comments: aspects and their prompts, what the coach sees mid-game, the check of its moves, the cache
src/coach-tools.js    Gateway tool capability policy per provider/model, honest fallback notices and runtime engine instructions
src/browser-llm.js    The in-browser model (wllama): loads on consent, streams answers, one request at a time, unloads when idle
src/style.js          Stockfish's playing style (Solid … Reckless): picks among near-best candidate moves
src/play.js           Game-end rules, timeouts, clocks, the opponent's search, the weakened mode below 1320
                      Elo (calibrated), draw offers, start-position checks
src/pgn.js            NAGs and original mainline comment locations, including repeated positions and initial notes
src/notation.js       Typed moves (SAN or coordinates) and moves in words for screen readers
data/eco/*.tsv        Lichess chess-openings dataset (CC0). Built into dist/eco.json keyed by position,
                      dist/openings.json (every named line with its moves, for "start from an opening"),
                      and dist/opening-variations.json (named destinations of legal next moves by position).
                      Data/compiler changes rebuild these outputs automatically; build:eco forces regeneration.
scripts/build.mjs     Copies vendored libraries, builds eco.json, inlines CSS → dist/
scripts/build-eco.mjs Opening table builder
scripts/calibrate.mjs Self-play round robin that measures the weakened levels against Stockfish's UCI_Elo
scripts/fetch-model.mjs  Downloads the in-browser model into models/ once and checks its SHA-256 (just offline)
scripts/record-ai-fixtures.mjs  Records real provider responses for the contract tests (uses .env keys)
scripts/serve.mjs     Local static server (UTF-8, security headers, no dotfiles); --api mounts the AI gateway, loads ../.env;
                      --models serves the in-browser model's weights; --offline drops Google Fonts and other hosts
server/ai.mjs         AI gateway core: config from env (every provider, models per task, local-only), provider
                      adapters with chat() (Anthropic SDK; openai SDK for OpenAI, Mistral, Ollama), embed(),
                      validation, error mapping, rate limit, mock provider; "browser" (the in-browser model) as a local provider
server/schema.mjs     Structured replies: the annotation format, a JSON Schema validator, fallback parsing
server/usage.mjs      Tokens per day, the daily token budget, cost estimate from AI_PRICES
server/models.mjs     Catalog of in-browser models (pinned by size and SHA-256), the download check, which files may be served
server/api.mjs        GET /api/ai/status; POST /api/ai/sample (NDJSON stream), /structured, /config, /test;
                      Host/Origin/size guards
server/fixtures/      Provider responses for the contract tests (recorded, or hand-written where marked)
server/static.mjs     Security headers (incl. COOP/COEP for cross-origin isolation) and the hash-based CSP for served pages
tests/unit/           node:test for the page modules; server/*.test.mjs for the gateway, incl. contract tests
                      (SDKs replaying server/fixtures) and live tests (only with KIBITZ_LIVE_AI=1)
tests/e2e/            Playwright: smoke (main flows), regressions (one test per fixed bug), preferences (Elo, style),
                      play (full game, typed moves, clock, draw offers, start positions, NAGs)
eslint.config.mjs     ESLint (recommended rules; eslint-plugin-html lints the script in index.html)
tsconfig.json         tsc --checkJs over src/, server/, scripts/ (JSDoc types, no emit)
```

## How the main pieces work

**Engine.** Two Stockfish workers: `opponent` (strength-limited with `UCI_Elo` from 1320 up; below that, Skill Level 0 plus a shallow multi-PV search with random picks) and `analyst` (full strength, MultiPV 3). The `Engine` class queues jobs and cancels by tag (`live`, `review`, `move`). It tries the WASM build, then a blob-URL worker, then the pure asm.js build.

**Scoring.** Evaluations are stored from White's point of view per position (`ANA`, keyed by FEN without move counters). A move is classified by the mover's win-percentage drop: <5 good, <10 inaccuracy, <20 mistake, otherwise blunder. Engine's top choice is "best"; positions in the ECO table within 30 plies are "book".

**Similar positions.** Every library game is replayed and indexed two ways: exact position (transpositions included) and pawn-structure signature (pawns only, from ply 12). Comments in imported PGNs are attached to their positions and passed to the coach. Matching is exact; fuzzy pawn-structure distance and theme-tag ranking are the obvious next steps.

**Coach prompt.** `contextFor(i)` assembles: player level, moves so far, FEN + ASCII board, Stockfish lines in SAN, motifs, last-move rating and the engine's alternative, detected themes, retrieved books, and similar library positions. `RULES` holds the standing instructions.

**Coach tools.** With a tool-capable gateway model, position chat in Analyse or with Full engine help can request fresh Stockfish evaluations, try/compare candidate moves and inspect threats or mates; the answer lists the engine evidence. During play, Off, Flag mistakes and Eval + mistakes withhold these tools; choosing **Full engine** enables them for the next question in the same conversation. The coach is instructed to explain this setting when asked about engine access. A model that explicitly rejects tool calling uses supplied context with a visible notice. This is tracked per provider/model. Switching models or successfully using **Test connection** allows tool support to be checked again; temporary provider errors do not disable the tools.

## Claude platform APIs (artifact runtime)

The page runs as a Claude artifact and uses `window.claude.use(name)`:

| Capability | Used for | Outside the artifact |
|---|---|---|
| `sample`    | Coach chat, review summary, study plan | Local AI gateway (`server/`); coach hidden if it's unavailable |
| `db` + `user` | Library at `data/users/<id>/kibitz/{games,books}` (private per user) | Falls back to `localStorage` |
| `downloads` | Save .pgn files | Falls back to copying the PGN |

Published with `capabilities: {sample: {}, db: {}, user: {}, downloads: true}`; vendored files are published alongside the page (`sf.wasm` as `application/wasm`), and so are `eco.json`, `openings.json` and `opening-variations.json`.

Outside an artifact, `use('sample')` returns `localSample()`, a function with the same signature that streams from the local AI gateway (`/api/ai/sample`). The prompts and `contextFor()` are unchanged. The library still falls back to `localStorage`; a server-side store is planned (TODO 7.6).

Open `_test.html?debug` to get `window.__kibitz` in the console, including `S`, `contextFor`, `ANA` and `libraryRecords()` for compiled source-aware records.

## Licences

GPL-3.0-or-later; see [LICENSE](../LICENSE) and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The build copies both into `dist/`.

- Stockfish.js (Stockfish 19): GPL-3.0
- chessground: GPL-3.0-or-later
- chess.js: BSD-2-Clause
- Opening names: lichess-org/chess-openings, CC0

## Ideas queued

- Fuzzy pawn-structure similarity (square-difference distance) and theme-tag ranking in `similarPositions`
- Model tiers per call: quick tier for chips, default for chat, complex for the review summary
- Puzzles generated from your own blunders
- Clock / time controls
