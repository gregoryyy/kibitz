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

**Settings → Player profile** saves explanation level, optional reported rating/pool/time control and up to 500 characters of learning goals in this browser. Level changes save immediately; use **Save profile** for the other fields. Goals accompany coach requests as quoted user data. Failed saves retain drafts, and stale tab edits require an explicit reload. Profile changes invalidate pending/cached teaching context while preserving the game and opponent strength. [Format and limits](../docs/PROFILE.md) distinguish preferences from measured ability.

**Review trends** summarizes compatible reports from your own reviewed games in the selected library. Counts and average move accuracy retain measured-move coverage by estimated phase. Bounded engine checks distinguish confirmed opportunities from refuted/unverified candidates; sample continuations open their exact source position. Re-running replaces a report, and deleting/changing its source or library removes its contribution. [Evidence and limits](../docs/REVIEWS.md) describe the historical-record boundary.

In **Openings**, choose a saved White or Black repertoire and press **Review due moves** to practise new or due positions. Play on the drill board or type SAN/coordinates; the saved opponent reply follows automatically. Any saved choice at that position is accepted, including transpositions. A starting-square hint counts as help, and a legal move outside your repertoire counts as a recall miss rather than a chess judgement. Review dates and recall/help statistics stay in this browser. The drill leaves your game intact and follows its live-help setting; switch to Analyse to train without a running game.

**Opening ideas** shows original study notes for twelve opening families and seven pawn patterns, in English or German. A guide explains the idea, typical plans and possible structures; separate pattern notes reflect the pawns currently on the board. Guides follow transpositions and scratch variations, identifying earlier opening matches as background. **Discuss these ideas** gives the coach the same notes alongside permitted Stockfish evidence. Static guides need no provider. During a game they require Full engine help, following the explorer's policy; unsupported/endgame positions show an empty state instead of a guessed explanation.

**Named opening continuations** shows the current opening/ECO and legal next moves towards nearby named variations, including transpositions. A distance label distinguishes a later destination from an immediate name; these names do not rank move strength or frequency. Hover or focus previews the position after a move. Click or Enter extends a scratch line in analysis, or plays your next move at the current live position with Full help. Existing scratch lines stay separate from the game. **About this opening** gives the coach the actual position, quoted names and study notes; concrete advice still needs Stockfish. Browsing works without a provider and includes retry if the local catalogue fails to load. Off, Flag mistakes and Eval + mistakes hide the panel during play.

In **Library**, PGN imports accept optional source title, author/curator, URL and separate score/annotation licences. **Source and licences** lets you inspect or correct a saved game's fields. Missing details stay not supplied; old records are readable without a storage rewrite, and future metadata stays intact. Similar-position notes retain the exact game occurrence, including repeated boards and a study's initial position. Recorded study lines are checked for legality, with their result/solution still unverified. See the [source-aware data model](../docs/LIBRARY.md).

Repeat PGN copies are skipped within the import and your current library, including harmless outside whitespace, move-number spacing and header-order differences. The first stored document/ID stays intact. Different headers, comments, variations, glyphs or source/licence details remain separate; this is conservative document matching rather than fuzzy same-game merging. Imports report added, duplicate, unreadable and failed counts separately. Failed/unreadable batches stay in the form for retry, and edits typed during an import are retained. Batches are limited to 500 games/5 million characters, with the existing per-game bounds. Account imports also remember acknowledged writes while snapshots catch up; simultaneous devices do not share a uniqueness transaction.

**Filter games** combines player (either colour), opening name/ECO, inclusive recorded-year range, absolute result and catalogue theme. Search words cover titles, players, openings, dates, results and theme IDs/English/German labels; words and fields all combine, ignoring case and accents. Unknown years are excluded from a range; bad ranges produce an error. A search in All includes classics alongside personal games; category filters still apply. **Clear search** retains the category. Metadata is read from legal PGN headers and cached early mainline positions, with flat legacy fields as fallback; ECO readiness keeps source-form drafts/focus. Search writes no records and calls no provider. The coach tool shares the matcher, with separate own-player win/loss/draw and absolute-score filters; [rules and limits](../docs/LIBRARY.md#catalogue-search).

**Search detected patterns** browses rules-replayed source positions and moves, with source/evidence filters and exact occurrence navigation. Position themes stay heuristic; move/three-ply motifs stay candidates unless chess.js proves the recorded move is mate or promotion. Candidates can be unsound and do not prove a forced payoff. This local search calls no provider or engine and follows live-help restrictions; the catalogue Theme filter remains separate. [Pattern fields and limits](../docs/LIBRARY.md#position-and-move-pattern-tags) describe source identity and evidence classes.

**Classics** contains 21 games alongside twelve problems/studies. Each game cites its published score and separate score/note rights: twelve complete scores from Capablanca's *Chess Fundamentals* join the nine earlier teaching versions, with original Kibitz notes. Source details and PGNs distinguish Réti's played resignation from the two-ply mate demonstration, and Légal's traditional teaching version from disputed history. `node scripts/check-classics.mjs` audits all 1,355 game plies offline, including reconstruction of the book's descriptive notation. [Sources and scope](data/classics/README.md) explain the recorded rights and excluded incomplete scores.

The **Problems** filter browses four mates in one and eight studies/reflections, with bilingual questions and separate published/authored sources. **Open** starts at the diagram; use the normal move controls to inspect its worked line. Source details distinguish actual mate proof and saved tablebase outcomes for that exact branch from authored notes. They identify the conventional Lucena/Philidor variants and link their methods. Viewing/exploring does not count as a lesson solve. Imported copies keep the general unverified-solution status. The [source/evidence notes](data/problems/README.md) cover the 48 checked plies, 50 snapshots, separate rights and explicit development refresh. `node scripts/check-problems.mjs` audits offline; `--refresh` fetches only its 22 fixed source-study FENs.

**Search study text** searches personal/classic PGN comments and original English/German study notes, with source and language filters. Read a literal passage and its source/licence, or open the precise annotated game step. Default **Keywords** search runs locally without a model; German move letters such as `Dxf7` also find English SAN. Optional **By meaning** shows the separately configured embedding destination: explicitly build the selected text index, then send a query with Search. Typing sends nothing. Vectors stay in memory and source/account/policy changes erase them. During play, search requires Full engine help. The [design and measured comparison](../docs/TEXT-SEARCH.md) cover configuration and limitations, especially no-answer false positives. [Coach questions and tutor comments](../docs/RETRIEVAL-CITATIONS.md) now retrieve up to three bounded, quoted source excerpts locally; supplied citations open the exact game occurrence or study note. Restricted live help omits passages. This separate path does not upload embeddings, and a valid source link does not verify a prose claim. Run `just retrieval-eval --mode text` from the repository root for the provider-free passage benchmark; `--mode dense` explicitly calls the configured embedding provider.

**Combined** search adds rank fusion and optional current-board relevance over exact/pawn/feature-tag signals. **Why this result** explains the match. **Require every search term** supports literal lookups with empty results; it can exclude paraphrases and does not verify an answer. Board and option changes cancel stale results without sending a replacement. [Hybrid design and results](../docs/HYBRID-SEARCH.md) record the measured ranking/recall tradeoffs; `just retrieval-eval --mode hybrid` runs the explicit provider comparison over authored data only.

With board relevance enabled, **Include similar pawn structures** optionally admits at least 75% colour-specific pawn-square overlap. Match details show shared and unmatched squares; exact positions keep their own label. [Pawn distance and its limits](../docs/PAWN-DISTANCE.md) include an offline benchmark (`just retrieval-eval --mode pawns`) and the known miss when the only pawn advances one square. The option defaults off and sends no new request until Search.

## Server library

Browser-only storage remains the default, and a hosted artifact keeps its account library. To offer a persistent local-server library, run from `site/`:

```sh
npm run build
node scripts/serve.mjs dist --index _test.html --api --env ../.env --library ../.kibitz-data/library.sqlite
```

Then choose **Use server library** in Library. Games and personal references persist in the private SQLite file; **Use browser library** restores the separate existing browser collection. Switching never copies either collection. `--library` also works without `--api`; `--library :memory:` provides temporary storage for tests. Database files must be private regular files outside the served directory, including through symlinks. New files use mode 0600 and new directories 0700; `.kibitz-data/` is ignored by Git.

Server libraries use an anonymous HttpOnly browser cookie. Clearing that cookie starts another library, leaving the earlier records in SQLite. Accounts and cross-device sign-in remain TODO 10.1–10.2. IndexedDB caches acknowledged records by the verified server scope. A failed cache write still reports a successful server save. Known-owner cached snapshots are read-only; a fresh load must verify the cookie owner before showing cached server data. Offline writes are not queued. Conflicts or an uncertain acknowledgement require **Refresh server library** before retrying; repeat imports then deduplicate against the refreshed records.

Source/PGN bytes, record IDs and extra metadata remain intact. Late responses and held controls cannot cross storage contexts; unchanged records retain source-form drafts through ordinary acknowledgements. Current-game and lesson state stays separate. [Schema, API, limits and lifecycle](../docs/LIBRARY.md#server-library-and-browser-cache) describe the implementation and scope.

## Layout

The **Lessons** tab browses English/German teaching material by module, level ceiling and theme. Expand a lesson to read its introduction, objectives, prerequisites and exercise prompts. The authored core has 30 lessons and 36 exercises: thirteen tactical lessons, eleven strategy lessons and six endgame lessons. Strategy covers pawn structures, weak squares, outposts, bishops, open files, king safety, activity and prophylaxis. A capturable fork illustrates why recognizing a pattern does not prove a gain. Endgames cover queen/rook mates, king and pawn, opposition, Lucena and Philidor. Their ten exercises show recorded Syzygy outcomes for the exact FEN and worked branch; other legal reflections make no result claim. No recorded branch asserts a unique best move.

**Open exercise** starts an isolated lesson board with explanations, a worked-line viewer and authored tutor hints. Type SAN/UCI or move on the board; promotions ask for an explicit piece. Every actual checkmate is accepted for a mate task. Other source puzzles practice their recorded line and reply, while written strategy/endgame reflections compare with a rubric and require your self-assessment. **Worked example** and **Reveal example** remain distinct from solving. Keyboard arrows/Home/End navigate the example board; closing returns focus to the catalogue. Lessons work offline without model requests and leave the active game intact. Loading another main game closes the lesson.

**Lesson progress** saves completed results in this browser and shows counts per lesson and theme. Verified mates, source recalls, rubric self-assessments and revealed examples remain separate, with hints, worked-example use and unassisted completions. Existing Coach challenge counters appear alongside. Catalogue badges update without resetting filters or focus. Written reflection text is not saved. Changed positions, lines, prompts or rubrics get separate progress revisions; older results are retained. If a save fails, completed results stay queued in the current tab for **Retry saving progress**; retry before closing or reloading that tab. Unsupported saved formats are preserved rather than overwritten. These counts describe practice, not a measured skill rating.

**Play against Stockfish** starts a normal game from the position currently displayed on the lesson board, including a step in its worked example. Choose White or Black for this game; existing engine strength and clock settings apply. An active game with moves must first be confirmed and successfully saved as unfinished. Cancel or a failed save leaves it running. If the game or lesson changes while confirmation/saving is pending, start again from the desired position. Finished diagrams need an earlier unfinished position. Practice games use the usual save/review controls and do not automatically count as completed exercises.

The **Lichess puzzle collection** adds 64 CC0 puzzles in four editorial rating groups, for 34 lessons and 100 exercises overall. Source links, original themes and puzzle ratings stay attached to each exercise. The opponent’s first move is applied before the learner position; the saved solution is replayed legally, with mate checks where claimed. Ratings organize browsing and are not playing Elo; source themes are separate from detected motifs. [Data and import instructions](data/puzzles/README.md) describe the bounded CSV pipeline, provenance manifest and offline regeneration (`node scripts/import-puzzles.mjs --check`). The page makes no Lichess requests until a source link is opened.

`node scripts/check-endgames.mjs` audits all 28 checked-in tablebase snapshots and example plies offline. The explicit `--refresh` option queries the [Lichess Syzygy API](https://github.com/lichess-org/lila-tablebase/blob/main/README.md) for these fixed authored positions only, validates every legal move and result, then replaces the snapshots. Source URLs, retrieval times and SHA-256 digests of the saved numerical facts accompany each record. The browser never sends a player's position to a tablebase service. DTZ is kept separate from distance to mate; uncertain and cursed/blessed results cannot substantiate an ordinary win/loss claim.

```
src/index.html        CSS, markup and application composition, written as an artifact body
                      (no <html>/<head>); the build wraps it for local use and inlines chessground CSS.
src/chess/            Rules, knowledge, engine integration and game helpers:
  engine.js           Stockfish workers, fallbacks, queued/time-capped searches and cancellation
  knowledge.js        Pure features, motifs, scoring, reference catalogue and position retrieval
  signatures.js       Colour-specific material classes and canonical occupied-square features
  play.js             Game-end rules, clocks, strength levels, draw offers and position validation
  style.js            Playing styles: picks among near-best engine candidates
  pgn.js              NAGs and exact mainline comment locations, including repeated positions
  notation.js         Typed moves and move descriptions for screen readers
  modes.js            Interesting moves, challenges and recorded theme progress
  sessions.js         Game-history checkpoints for suspended analysis
src/coach/            Prompts, model support, checked answers and conversation tools:
  prompt.js           quote(): imported/user text enters prompts as bounded quoted data
  tutor.js            Commentary aspects, help policy, move checking and comment cache
  tools.js            Engine/motif tool catalogue, argument checks and checked execution
  coach-tools.js      Provider/model tool capability policy and fallback instructions
  chat.js             Local commands, library queries and validated board actions
  annotations.js      Checked board marks and linked move sequences
  retrieval-context.js Bounded retrieved passages and request-bound citation identities
  browser-llm.js      In-browser wllama model: consent, streaming, resources and unloading
src/player/           Browser-local teaching preferences:
  profile.js          Validated profile, reported rating provenance, revisions and quoted goals
  profile-ui.js       Settings drafts, acknowledgement/retry and stale-tab handling
  reviews.js          Captured review evidence, source-bound validation and current-library trends
  review-history.js   Phase/theme totals, coverage and checked-opportunity navigation
src/library/          Source-aware records, classics, patterns and passage retrieval:
  library.js          Source revisions, game occurrences, annotations and position-index adapter
  search.js           Local metadata search, legal PGN/ECO labels and combined field filters
  storage.js          Shared snapshot format, IDs and byte/count bounds
  cache.js            Scoped IndexedDB snapshots; transaction acknowledgements and future-format preservation
  server-session.js   Cookie-owner verification, serialized optimistic writes and cache/failure state
  import.js           Bounded PGN batch splitting and conservative source-document deduplication
  classics.js         Built-in annotated games/studies and thematic retrieval
  capablanca.js       Twelve complete published book scores and original teaching notes
  classic-sources.js  Fixed-revision attribution/rights for the nine earlier teaching versions
  problem-data.js     Twelve sourced bilingual tasks and eight additional authored PGN records
  problem-tablebases.js Fixed numerical Réti/Saavedra snapshots, refreshed only explicitly
  problems.js         Exact curated-document/branch proof and actual mate-in-one checks
  text-search.js      Original annotation/guide passages, BM25 and literal excerpts
  dense-search.js     Explicit scoped embedding sessions and cosine ranking
  hybrid-search.js    Rank fusion and deterministic text/board/tag reranking
  pawn-distance.js    Colour-specific pawn-square distance for optional structural analogies
src/openings/         Opening study and recall:
  openings.js         Reference-game position graph, counts/results and sample occurrences
  opening-guides.js   Bilingual study notes and quoted position/route context
  opening-variations.js Named-destination graph, checked queries and catalogue context
  repertoire.js       Legal opening lines, position choices and browser persistence
  drills.js           Recall cards, legal replies, review queues and atomic progress storage
src/platform/         Browser utilities shared across features:
  store.js            localStorage wrapper that reports write failures
  i18n.js             Language selection, translation and German move-letter normalization
  i18n-de.js          German interface dictionary
src/curriculum/       Modules, lessons and exercises:
  curriculum.js       Bounded records, legal positions/lines, prerequisite DAG and filtered queries
  endgames.js         Bilingual mates, pawn endings, opposition, Lucena and Philidor
  tablebase.js        Exact-FEN offline evidence validation, White POV and branch checks
  tablebase-snapshots.js Recorded numerical Syzygy facts; refresh only by explicit script
  puzzles.js          Bounded Lichess CSV ingestion, setup replay and source-aware rating groups
  puzzle-data.js      Generated CC0 starter records and provenance; audited against data/puzzles/
  session.js         Pure exercise state, mate proof, source recall and reflection self-assessment
  player.js          Isolated board, worked examples, staged hints, promotions and completion events
  playout.js         Validate an unfinished full-FEN lesson position for a normal game
  playout-confirm.js Owned cancellable dialog before saving/replacing an active game
  progress.js        Versioned local counters, task revisions, retry identity and lesson/theme summaries
  progress-ui.js     Separate evidence counts, coach counters and pending-save status
  catalogue.js        Original bilingual teaching material, objectives, rubrics and attribution
  tactics.js          Thirteen tactical themes, recorded examples and a defensive counterexample
  strategy.js         Structure and planning reflections with explicit objectives and board examples
  ui.js               Literal catalogue rendering and local filters, independent of game/model work
data/eco/*.tsv        Lichess chess-openings dataset (CC0). Built into dist/eco.json keyed by position,
                      dist/openings.json (every named line with its moves, for "start from an opening"),
                      and dist/opening-variations.json (named destinations of legal next moves by position).
                      Data/compiler changes rebuild these outputs automatically; build:eco forces regeneration.
scripts/build.mjs     Copies the module directory tree and vendored libraries, builds opening data, inlines CSS → dist/
scripts/build-eco.mjs Opening table builder
scripts/calibrate.mjs Self-play round robin that measures the weakened levels against Stockfish's UCI_Elo
scripts/fetch-model.mjs  Downloads the in-browser model into models/ once and checks its SHA-256 (just offline)
scripts/record-ai-fixtures.mjs  Records real provider responses for the contract tests (uses .env keys)
scripts/serve.mjs     Local static server (UTF-8, security headers, no dotfiles); --api mounts the AI gateway, loads ../.env;
                      --models serves the in-browser model's weights; --offline drops Google Fonts and other hosts;
                      --library FILE mounts optional private SQLite storage independently of the AI gateway
server/ai.mjs         AI gateway core: config from env (every provider, models per task, local-only), provider
                      adapters with chat() (Anthropic SDK; openai SDK for OpenAI, Mistral, Ollama), embed(),
                      validation, error mapping, rate limit, mock provider; "browser" (the in-browser model) as a local provider
server/schema.mjs     Structured replies: the annotation format, a JSON Schema validator, fallback parsing
server/usage.mjs      Tokens per day, the daily token budget, cost estimate from AI_PRICES
server/models.mjs     Catalog of in-browser models (pinned by size and SHA-256), the download check, which files may be served
server/api.mjs        GET /api/ai/status; POST /api/ai/sample (NDJSON stream), /structured, /config, /test;
                      Host/Origin/size guards
server/library-store.mjs SQLite owner/collection records, schema version, atomic revisions and quotas
server/library-api.mjs Anonymous cookie scope, same-origin HTTP routes and validated record writes
server/library-files.mjs Private database creation outside the static root
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

**Similar positions.** Reading retains its exact EPD/pawn-signature prototype. Library Combined search also has optional graded pawn-square distance and theme-tag signals. Tutor/chat use the local keyword/exact-pawn/tag passage channels with bounded quoted excerpts and revision-bound occurrence links; source moves never become engine evidence.

**Coach prompt.** `contextFor(i)` assembles: player level, moves so far, FEN + ASCII board, Stockfish lines in SAN, motifs, last-move rating and the engine's alternative, detected themes, retrieved books and thematic classics. `coachSources()` separately adds the bounded passage bundle; its identity also participates in tutor cache keys. `COACH_RULES` holds the standing instructions.

**Coach tools.** With a tool-capable gateway model, position chat in Analyse or with Full engine help can request fresh Stockfish evaluations, try/compare candidate moves and inspect threats or mates; the answer lists the engine evidence. During play, Off, Flag mistakes and Eval + mistakes withhold these tools; choosing **Full engine** enables them for the next question in the same conversation. The coach is instructed to explain this setting when asked about engine access. A model that explicitly rejects tool calling uses supplied context with a visible notice. This is tracked per provider/model. Switching models or successfully using **Test connection** allows tool support to be checked again; temporary provider errors do not disable the tools.

## Claude platform APIs (artifact runtime)

The page runs as a Claude artifact and uses `window.claude.use(name)`:

| Capability | Used for | Outside the artifact |
|---|---|---|
| `sample`    | Coach chat, review summary, study plan | Local AI gateway (`server/`); coach hidden if it's unavailable |
| `db` + `user` | Library at `data/users/<id>/kibitz/{games,books}` (private per user) | Falls back to `localStorage` |
| `downloads` | Save .pgn files | Falls back to copying the PGN |

Published with `capabilities: {sample: {}, db: {}, user: {}, downloads: true}`; vendored files are published alongside the page (`sf.wasm` as `application/wasm`), and so are `eco.json`, `openings.json` and `opening-variations.json`.

Outside an artifact, `use('sample')` returns `localSample()`, a function with the same signature that streams from the local AI gateway (`/api/ai/sample`). The prompts and `contextFor()` are unchanged. The browser library uses `localStorage`; the optional server library uses SQLite and a scoped IndexedDB cache (TODO 7.6).

Open `_test.html?debug` to get `window.__kibitz` in the console, including `S`, `contextFor`, `ANA`, `libraryRecords()` for compiled source-aware records and `positionIndex()` for the actual current index and `patternIndex()` for source pattern lookups. Positions/occurrences carry versioned colour-specific material counts, placement keys and occupied piece-square terms. `knowledge.js` exposes `positionFeatureMatches()` for exact material/placement/subset predicates with bounded source filters; [index definitions and query examples](../docs/LIBRARY.md#material-and-piece-placement) distinguish these structural facts from exact EPD state and chess verification. Existing retrieval ranking keeps its recorded behavior.

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
