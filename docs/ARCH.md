# Architecture

How Kibitz is built, and the ideas behind it. The plan is in [TODO.md](TODO.md), ideas beyond it in [ROAD.md](ROAD.md), and what was built, with its trade-offs, in [DONE.md](DONE.md). For a gentler introduction, from how a language model works to running such a system responsibly, see the [primer](primer/Primer_v01.pdf); the [flipbook](flipbook/README.md) shows the app at work. Items that are planned but not built yet are marked with their TODO number.

For the brief feature-level map, see [LLM and symbolic design](AI-DESIGN.md). The [research notes](research/README.md) examine AI responsibilities in milestones 5–7, Stockfish component use, retrieval methods and neurosymbolic game systems, distinguishing the current code from proposed experiments.

## Motivation

The Kibitz repo uses a modern chess training app to demonstrate key concepts in LLM-based and neurosymbolic architecture. Chess suits this well:

- **Rules and lines can be checked.** Legal moves and terminal game states have explicit rules. Stockfish supplies strong, finite-search evidence about continuations; its scores do not prove every strategic or explanatory claim. Those claims still need source support or chess-aware review.
- **Calculation and explanation are different skills.** Stockfish combines neural evaluation with explicit search, while the language model puts checked evidence into words. Kibitz connects rules, search, features and sources to language rather than asking the language model to calculate from notation alone.
- **The patterns are the ones production systems need.** Context control, retrieval, structured output, tool use, verification and agency under policy (section 3) all appear here, at a scale one person can read and run. The same shape fits other domains where a system of record knows the facts and a model explains them.
- **It runs on one machine.** The engine, and even a small language model, run in the browser, so the whole architecture can be studied without cloud accounts or keys (section 4).

## 1. The idea: a symbolic engine and a neural explainer

Kibitz is a neurosymbolic chess coach. Two very different kinds of system work together, and each does only what it's good at.

- **The symbolic side calculates and checks.**
  - Stockfish combines NNUE neural evaluation with search over legal continuations. Rules have exact checks; finite-search scores and lines are bounded evidence.
  - chess.js knows the rules.
  - `knowledge.js` detects motifs (fork, pin, discovered attack, back rank, ...), pawn structures and position themes, and classifies moves by how much they change the winning chances.
  - Rules, features and search results have separate tests. Features can be heuristic; tactical candidates need engine confirmation, which remains limited by the search budget.
- **The neural side explains.** A language model (Claude, OpenAI, Mistral, Ollama, or a small model running in the browser) turns those facts into language a player at a given level can use: ideas, plans, what to watch for. It is good at language and teaching, and unreliable at calculating variations.
- **The application controls evidence and actions.** The model receives permitted engine results, position facts and retrieved/user text. Its move lines must come from supplied evidence, and its answer is checked afterwards (section 3.6). Wrong moves are marked for the player; these checks do not prove every prose explanation.

This split is also the user experience:

- **The numbers come from the engine.** Evaluations, best moves, mistakes and the review are Stockfish's, shown directly: the eval bar, the flags, the review graph. The coach adds the "why".
- **Help is a dial.** In a running game, the player decides how much the engine may reveal (help Off, Flag mistakes, Eval + mistakes, Full). The coach's view follows that setting, so asking it can't spoil the game (section 3.1).
- **Trust is visible.** Moves the coach names are highlighted when they're backed by Stockfish's lines or the game, greyed when they're legal but unchecked, and underlined in red when they're wrong.
- **The coach is optional.** Without any language model, play, analysis, flags, review, library and reading suggestions all still work.

## 2. Where things run

The selected deployment is a local single-user app, confirmed in TODO 10.1. Existing loopback defaults, operator env keys and browser/optional private SQLite storage define the target; hosted authentication is deferred. [Deployment scope](DEPLOYMENT.md) distinguishes local hosting from the independent choice of cloud or local model inference.

The owner selected [native Node HTTPS](TLS.md) with operator-supplied certificates
for the final local deployment. The CLI's required TLS listener for APIs shares the same
static/API handlers and uses the real socket for Origin and cookie transport
checks; public identity-file exclusion and validation happen before storage opens.
[Protected-cookie migration](COOKIE-MIGRATION.md) retains exact ownership/usage
keys and rejects ambiguous identities. Explicit HTTP development uses separate
cookies. The isolated `kibitz.test` hostname has exact-SAN startup validation,
operator loopback resolution and one-year HSTS before application routing;
IP/localhost aliases expose only the static health manifest. Cross-host data
transition and explicit legacy-origin recovery are documented in the TLS guide.
External transport policy and other ASVS remediations remain open.

```mermaid
flowchart LR
  subgraph Browser["Browser page (site/src)"]
    UI["Board, dialogue, panels<br/>index.html"]
    SF["Stockfish 19 (WASM)<br/>analyst + opponent workers<br/>engine.js"]
    KN["Symbolic knowledge<br/>knowledge.js, tutor.js, play.js"]
    BL["In-browser model (optional)<br/>wllama on WebGPU / WASM<br/>or Chrome Prompt API"]
  end
  subgraph Server["Local Node server (site/server)"]
    ST["Static files + security headers<br/>serve.mjs, static.mjs"]
    GW["AI gateway<br/>api.mjs, ai.mjs, schema.mjs, usage.mjs"]
    MD["Model weights<br/>site/models (just offline)"]
  end
  P["Providers<br/>Anthropic, OpenAI, Mistral, Ollama"]
  UI --> SF
  UI --> KN
  UI -- "facts + question" --> GW
  UI -. "quick or offline" .-> BL
  GW --> P
  ST --> UI
  MD --> BL
```

- **The page** is a single HTML file plus plain ES modules, with no framework and no bundler. Stockfish runs in Web Workers. When the page is cross-origin isolated (COOP and COEP headers), the analyst uses the multi-threaded build.
- **Source modules** are grouped by responsibility under `site/src/`: `chess/` for rules, knowledge, engine and game helpers; `coach/` for prompts, tools, annotations and model support; `curriculum/` for lesson records, authored material and catalogue UI; `library/` for source records, classics and passage search; `openings/` for opening guides, repertoires and drills; `player/` for teaching preferences, and `platform/` for storage and localization. `index.html` composes them. The build preserves these paths in `dist/`, where vendored libraries and Stockfish workers live at the root. The same pure modules are imported directly by Node tests, the gateway and offline evaluation tools.
- **The local server** serves the page with a strict Content Security Policy. It mounts the AI gateway under `/api/ai/`, which holds the API keys (from `.env`), talks to the providers, enforces limits, and streams answers back as NDJSON. Keys never reach the page.
- **Two other deployments** use the same page:
  - **As a Claude artifact,** where the page uses the host's `window.claude` model instead of the gateway.
  - **Fully offline** (`just offline`), where a small model runs in the page and nothing leaves the machine (section 4).

The **player profile** (9.1, `player/`) stores a versioned browser-local explanation level, optional self-reported rating/pool/time control and bounded learning goals. Missing profiles inherit the old level in memory; unknown formats remain intact/read-only. Revision checks reject stale sequential-tab edits, with drafts retained after failed writes. Profile identity invalidates pending/cached teaching context and old model history without replacing the game; goals enter prompts through `quote()`. Ratings do not set opponent strength or infer measured ability. [Profile lifecycle and sharing](PROFILE.md) describe the limits.

The **review trend layer** (9.2, `player/reviews.js`) captures exact/depth-qualified before/after analysis for own moves, with rules-based terminal facts and occurrence-bound phases. A shared bounded motif verifier checks up to six priority errors; only confirmed alternatives enter theme totals. Source-bound historical reports live with each own-game record, so reruns replace contributions and deletion/owner changes remove them. Reader validation does not authenticate or freshly recompute stored scores. The localized Review panel reports measured coverage and guards exact-source actions; [review evidence and lifecycle](REVIEWS.md) describe the limits.

The **own-game exercise layer** (9.3, `player/mistake-puzzles.js`/`puzzle-player.js`) takes measured own errors from the current library and rechecks a fresh reference/original-child gap. Its independent board grades any legal answer against qualified engine child evidence, with rules-proven mate, hints/reveal and unknown outcomes kept separate. A dedicated search tag and source/library/game/policy guards fence async work; moves never enter the main board implicitly. Shared chess evidence/input helpers preserve authored lesson behavior, including explicit promotion. [Exercise scope and criteria](OWN-PUZZLES.md) document the bounded target and FEN-diagram assumption.

The **practice scheduler** (9.4, `player/schedule.js`/`schedule-ui.js`) combines current lesson revisions, existing opening-drill records and selected-owner own-exercise targets. It reuses deterministic opening intervals, keeps rules/recall/engine/self-assessment evidence separate and opens existing isolated players. Lesson progress is acknowledged before a separate scheduling write; failed schedule receipts remain visible for idempotent retry. Source/revision/help guards and read-only unknown formats preserve existing boundaries; [practice lifecycle](PRACTICE.md) documents limits and localStorage concurrency.

The **data controls** (10.3, standalone `data.html`/`platform/data*.js`) run without app autosave. Raw versioned browser exports preserve unknown values; intentional browser erasure removes only the Kibitz namespace and named library cache after explicit confirmation. Separate current-owner server exports/erasure use bounded same-origin reads and a cookie/scope/revision-checked SQLite transaction, preserving a revision tombstone against older writes. Server acknowledgement and cache cleanup stay distinct; [data scope](DATA.md) excludes provider histories, host-managed account libraries, other devices and operator backups.

## 3. Generative-AI patterns, as built here

The **provider privacy layer** (10.4, `platform/privacy.js`/`privacy-ui.js`) stores acknowledged provider/purpose grants, initially off for network providers. A shared transport rereads grants, attaches an exact destination/purpose attestation and aborts/fences pending work on changes. The gateway checks actual routing before SDK/budget admission, including tests/embeddings. Failed revocation denies the current tab while retaining a persistence retry; future formats stay closed. [Privacy scope](PRIVACY.md) distinguishes local model loading, configured endpoints, fonts, direct-client attestations and provider retention.

The **curriculum catalogue** (6.1, `src/curriculum/`) is independent of the coach and active board. A pure compiler validates bounded module/lesson/exercise records, unique stable IDs, English/German teaching text, level and theme tags, attribution, and acyclic prerequisites. chess.js checks each starting position and recorded UCI line; mate exercises additionally establish terminal checkmate for the learner's colour. Reflection lines have authored rubrics and make no result claim unless accompanied by the exact tablebase evidence described below. The tactical catalogue (6.2) covers thirteen themes and includes a capturable-fork counterexample. Optional declared patterns must appear in the existing move/line motif detectors for that exact example; this checks geometric consistency, not tactical soundness or uniqueness. The Lessons panel filters and renders this data literally without provider requests or game changes. Exercise play and progress are described below.

The **strategy material** (6.3) adds ten reflections beside the king-activity foundation. IQP, Carlsbad and hanging-pawn examples declare optional `positionTag` metadata, which the compiler checks with the existing position-feature detector. Other lessons ask about weak squares, supported outposts, bishop routes, open files, pawn cover, useful piece roles and preventive ideas. Board-fact tests check their concrete support, attack, colour and flight-square relationships. These lesson tags and candidate demonstrations do not add new engine evaluations or certify a best plan.

The **endgame material** (6.4) contains six lessons and ten exercises, with 28 recorded Syzygy snapshots checking all 28 worked plies. `tablebase.js` validates canonical legal FENs with at most seven pieces and no castling rights, complete legal move sets, terminal facts, source URLs/dates and numeric distance fields. The compiler requires the declared result to hold at each branch position and after every move. Results are expressed from White's perspective; API move categories refer to the child side to move. Unlike engine evaluations, this evidence uses full FEN including counters because the fifty-move rule matters. Cursed/blessed, uncertain and unknown categories are not ordinary result evidence; DTZ is not DTM. `check-endgames.mjs` audits offline by default and queries only fixed authored diagrams with explicit `--refresh`. No game position leaves the browser. Snapshots substantiate these exact branches, not unique solutions, arbitrary transpositions or every possible continuation.

The **puzzle source** (6.5) adds 64 CC0 Lichess puzzles in four editorial rating groups. `puzzles.js` parses bounded standard CSV (current eleven columns or legacy ten), validates IDs, metadata, URLs, positions and UCI replay, then applies the first opponent move before deriving the learner FEN/solution. Original themes stay attached; known theme mappings enable filters without claiming detector proof. Case-sensitive upstream IDs map to collision-free curriculum IDs. The curriculum compiler revalidates each source record and binds its exercise ID, full FEN, line and themes to the derived facts. Source links/ratings/licence render as literal text or validated external URLs. `import-puzzles.mjs` regenerates/audits the JS records from a saved CSV and provenance manifest with a digest; no automatic download, runtime source fetch or provider call occurs. [Dataset scope and format](../site/data/puzzles/README.md) distinguish source strength claims from local legality/mate checks. Future model context must quote imported source text through the same prompt boundary as library material.

The **lesson player** (6.6, `session.js`/`player.js`) uses detached exercise state and a separate Chessground board. It provides authored explanations/objectives, a keyboard worked-line viewer, exercise selection, SAN/UCI input, explicit promotions, staged hints and reveal/restart. Rules prove actual checkmate, including mating alternatives; non-mating source puzzles check recall of the recorded line and automatically play its recorded reply. A legal choice outside that reference is not assigned a chess-strength verdict. Authored reflections require a bounded literal response before revealing the rubric and then an explicit self-assessment. Hints progress through concept, origin square and recorded next move, resetting per position while preserving the total help count. Completion events distinguish mate proof, source recall, reflection and revealed examples. Renderer versions, session identity, promotion-dialog identity and the main game's generation reject held actions; a changed generation closes the player through `syncBoard()`. Controls restore focus, scope navigation keys to the lesson and mark their already-localized attributes to avoid a second translation pass. Solving/viewing stays independent of the active game and providers; the explicit game handoff is described below.

The **lesson game handoff** (6.8, `playout.js`/`playout-confirm.js`) validates the displayed full FEN as an unfinished rules-legal position and lets the player choose either colour for this game. It uses the normal engine/clock lifecycle and existing strength/time settings without changing saved start/colour preferences. Invalid/finished diagrams never fall back to a normal opening position. A native owned dialog confirms saving an active game with moves; a detached unfinished snapshot must save successfully before replacement. Requests serialize across pending saves and check lesson identity/render version/abort signal, main-game generation and an exact checkpoint including metadata/comments before applying results. The main game keeps running during confirmation/saving; a changed checkpoint prevents the handoff, though an already-authorized detached snapshot may have saved. Closing/changing the lesson aborts its dialog, and old generic confirmation controls also require their original connected element and game generation. Practice uses ordinary game save/review and makes no automatic lesson-completion claim.

The **lesson progress store** (6.7, `progress.js`) consumes those completions. `kibitz.lessonProgress` keeps bounded version-1 entries keyed by exercise ID and an exact task revision (goal, full FEN, line, source ID, prompt and rubric). It stores counts/timestamps and recent completion IDs, never reflection responses. Mate proof, source recall, self-assessment outcomes, reveal, legal choices, hints, outside-reference choices and worked-example use stay distinct; per-lesson/theme summaries describe practice rather than calibrated mastery. Old task versions remain retained but do not credit changed content. Invalid/future data remains read-only. A successful single-key write precedes publication; failures remain queued in the tab for retry, with recent-ID deduplication. Writes reread current storage to retain sequential tab updates; localStorage does not supply a transaction across simultaneous writers. Cross-device storage belongs to later profile/storage work. The UI shows validated existing Coach challenge counters separately, updates catalogue badges in place to preserve filters/details/focus and responds to other tabs' lesson-progress storage events. Pending results survive lesson selection/game changes in memory; closing/reloading the tab discards unsaved pending results.

Kibitz is also a working example of common patterns for building with language models. Each one below says where it lives in the code.

### 3.1 Context control

What the model sees is assembled on purpose, not dumped in.

- **A grounded context per request.** `contextFor()` in the page builds it:
  - the player's level and the game;
  - the moves so far;
  - the position as FEN and as a board diagram;
  - Stockfish's top lines in SAN, with scores;
  - the motifs in the best move;
  - the last move's rating and the engine's alternative;
  - the position themes;
  - board facts such as loose pieces and king shelter (`safetyNotes()`);
  - retrieved references (section 3.2).
- **Shared rules** (`COACH_RULES` in `tutor.js`):
  - take every move and line from the engine lines or the game, at most six plies;
  - explain ideas, not variations;
  - describe evaluations in words;
  - recommend only the references provided;
  - stay short.
- **Context that follows the game state.** `engineView()` decides what the model may see during a game:
  - **everything,** when the game is over, in analysis, or with help Full;
  - **only how the player's own moves rated,** with help Flag mistakes or Eval + mistakes;
  - **no engine data at all,** with help Off.

  This is enforced where the context is built, not by asking the model to keep a secret.
- **Templates per intent** (`tutor.js`). The player picks aspects (last move, what's next, keep in mind, good habits, similar games). Each becomes a fixed instruction, in a fixed order, under a word limit (`commentRequest()`).
- **Untrusted text is quoted.** PGN headers and comments, and the player's own notes, go into prompts only through `quote()` (`prompt.js`): one line, in «guillemets», with control characters removed and a length cap. A standing rule tells the model to treat quoted text as data. This is the defence against indirect prompt injection (OWASP LLM01).
- **Cost and speed:**
  - a model per task: quick questions, chat, reviews;
  - a daily token budget for the server, budgets in tokens and dollars per user for paid models (users told apart by a cookie until there are accounts), and a per-minute rate limit in the gateway;
  - the tokens and cost of every answer, and the player's total today, shown in the dialogue;
  - a cache of coach comments keyed by position, ordered game/scratch history, move, aspects, engine view, level, model, language and retrieved-source bundle identity (`commentKey()`, `lruCache()`).

### 3.2 Retrieval (RAG)

The coach recommends reading and recalls games, but only from what retrieval found.

- **Literature retrieval** (`retrieveLiterature()` in `knowledge.js`). A catalog of books holds metadata and theme tags, not book text. The catalog and the player's own references are ranked by overlap with the position's themes and closeness to the player's level. The top hits go into the context, with the matching part of each book where known. The rules say: recommend only from these.
- **"Seen before"** (`buildPositionIndex()`, `similarPositions()`). Every game in the player's library is indexed by position. The current position is looked up there, and the matches, with the notes made in those games, go into the context and the "Similar games" aspect.

**Source-aware library records** (`library.js`, 7.1; [schema](LIBRARY.md)) keep logical game/source IDs separate from shared EPD positions and game occurrences. A SHA-256 revision of the stored PGN binds each occurrence and annotation to its source text; full FENs, relative plies and move labels preserve counters and repeated arrivals. Mainline comment locators reproduce the original text with UTF-16 ranges; NAGs remain source judgements, not engine verdicts. Custom-start studies retain their root, stated result and a legality-checked recorded line, without claiming a verified solution. Original score and annotation licence assertions stay separate and may explicitly be unknown. Shared position records obtain provenance through their occurrences.

The existing flat local/account game documents gain an optional version-one provenance envelope. Reading legacy records adds no migration write; malformed/future source metadata remains untouched and is excluded from position retrieval. Import accepts optional attribution/licence fields, and source editing preserves the PGN. Built-ins identify the packaged collection and the project's annotation licence without inventing original score rights. Browser persistence writes only the changed collection and rolls back memory on failure. Compiled snapshots cache exact input, clear superseded position results while rebuilding, and reject late generations after source changes/deletion; held source edits recheck record identity. Retrieved source assertions enter coach context only through `quote()`. Conservative import deduplication (7.2, `library/import.js`) compares source documents within the current user collection/batch after async validation, preserving distinct annotations/variations/headers/licences and existing IDs/PGN. Bounded imports report separate outcomes, retain failed/newly typed input, avoid duplicate-only writes and track acknowledged account imports until snapshots arrive. This does not provide cross-device uniqueness or fuzzy score merging; see [identity and retry rules](LIBRARY.md#import-deduplication). Optional SQLite persistence and a scoped IndexedDB cache are implemented in 7.6; explicit server selection preserves the separate browser/account stores. See [storage lifecycle](LIBRARY.md#server-library-and-browser-cache).

The **classic-game sources** (7.3, `classic-sources.js`/`capablanca.js`) cover 21 games. Nine earlier teaching versions retain fixed Wikipedia revision attribution and CC BY-SA 4.0 move-data rights. Twelve complete scores from Capablanca's 1921 book carry per-page links and its source's public-domain-in-the-USA statement. Teaching notes are original GPL-3.0-or-later material; external prose, variations and judgement glyphs are excluded. The offline `check-classics.mjs` audit binds 1,355 legal plies to saved source facts/locators and reconstructs the 980 book plies through bounded legal-candidate search over descriptive notation. Resignations remain source reports; this is not optimal-play proof. Two incomplete book scores are omitted. Cards/source details/own PGN notes distinguish Réti's resigned game from its later teaching continuation and label the uncertain Légal version. Multi-theme Reading labels localize each label before joining, avoiding corpus-dependent translation gaps. The original retrieval corpus is frozen separately to preserve previously measured hashes; [scope and evidence](../site/data/classics/README.md) describe the limits.

The **problem collection** (7.4, `problem-data.js`/`problems.js`) adds eight authored curriculum examples beside the four historical/conventional studies: twelve tasks and 33 total reference records. Bilingual questions, separate sources/rights, a Problems filter and diagram-first opening make the collection explicit. Published Réti/Saavedra diagram cells match their exact placements; Lucena/Philidor are labelled authored variants with method references and unknown publication dates. The general library compiler retains legal-replay-only status. Snapshot composition certifies only known curated `classic` documents after exact source/result/full-FEN/UCI binding. Four actual mates in one are checked with chess.js, and 48 recorded plies preserve declared White-perspective outcomes in 50 saved Syzygy snapshots. Imported ID/metadata copies cannot opt in, annotations remain unverified and viewing earns no lesson-completion claim. `check-problems.mjs` audits offline; its explicit refresh targets only the 22 fixed Réti/Saavedra FENs, while 28 shared curriculum snapshots keep their own refresh path. No current game is queried remotely. [Source/evidence scope](../site/data/problems/README.md) distinguishes branch checking from unique solutions, other replies or performance grading.

**Passage search** (`text-search.js`, `dense-search.js`, 8.3; [design and comparison](TEXT-SEARCH.md)) indexes mainline comments and separate bilingual authored-guide fields with source revisions and exact UTF-16 locators. Default local BM25 needs no provider. Optional cosine ranking uses explicit ingestion/query actions through a stateless embedding route, with a separately configured provider, shared budgets and local-only enforcement. Selected sources/languages are filtered before ingestion; vectors and provider/model/revision/dimension metadata stay in browser memory and are erased on source/account/policy changes. Library search displays literal passages and opens annotation results at their full-FEN occurrence. Live-help restrictions clear results and guarded navigation rechecks source identity, revisions and game/library generations. Library searches do not themselves change coach context.

**Hybrid retrieval** (`hybrid-search.js`, 8.4; [design and measured tradeoffs](HYBRID-SEARCH.md)) fuses up to twenty candidates each from BM25, dense, exact/nonempty-pawn and feature-tag channels using reciprocal ranks, then reranks complete term matches and exact boards. Board relevance is explicit: legal source FENs/current visible board supply profiles, with compatible turn/check/phase for analogies. Guides supply their catalogue concept rather than a fabricated board. An optional every-term constraint can return no passage; it is literal coverage rather than semantic support. Source IDs resolve to canonical local records, and query/filter/main/scratch-board changes invalidate pending results and held actions without automatically uploading a replacement. No learned reranker or calibrated confidence threshold is claimed.

**Fuzzy pawn distance** (`pawn-distance.js`, 8.5; [definition and benchmark](PAWN-DISTANCE.md)) computes colour-specific pawn-square Jaccard distance. Combined search optionally admits up to 0.25 distance in its position channel, after the same dynamic/source eligibility checks. Exact boards remain distinct, and pawnless boards gain no analogy. The UI explains shared/unmatched squares; distance is neither a legal-move cost nor transferable-advice confidence. Default overlap remains exact. The legacy Reading position buckets retain their earlier behaviour.

**Cited coach context** (`retrieval-context.js`, 8.6; [design](RETRIEVAL-CITATIONS.md)) supplies up to three 900-character excerpts through local keyword/exact-pawn/tag retrieval, independently of Library controls, without implicit embeddings or fuzzy expansion. General chat uses the question without the active board; position chat/tutor also use their captured board. Source prose/metadata are quoted assertions, separate from engine evidence. Content-bound citation tokens resolve only inside their answer's captured bundle. Navigation rechecks canonical revisions and full-FEN occurrences, legally replays the game, confirms leaving live play and preserves the return path and dialogue. Source/account/help/provider changes revoke pending work/actions, remove source excerpts and clear old model-turn history; restricted live help supplies no passages. Board tools refresh the bundle before the next model turn. Valid citation identity does not establish semantic support.

The [offline retrieval benchmark](RETRIEVAL-EVAL.md) (8.8) replays a fixed, source-aware corpus through this production index. Manually labelled English/German queries distinguish exact matches, transpositions, requested occurrences, structural analogies and no-answer cases. It reports precision/recall/MRR/graded nDCG at 1/3/6 separately from no-answer false positives, with source revisions, corpus/case hashes and per-query rankings. It measures current retrieval limitations without a provider call or change to retrieval behaviour; it does not establish engine correctness or answer faithfulness.

### 3.3 Structured retrieval

The [position retrieval literature comparison](research/position-retrieval-comparison.md) maps these implemented paths to relational/solution-aware IR, CQL and chess embeddings, with separate task-specific measurements and remaining gaps.

Chess positions have structure that text embeddings would blur, so retrieval here uses keys from chess itself rather than vector similarity:

- **The exact position:** the EPD, a FEN without move counters, so transpositions match.
- **The pawn structure:** `pawnSignature()`, so a game with the same structure is found even when the pieces stand elsewhere.
- **Material and occupied squares:** versioned, colour-specific piece counts, full placement keys and individual piece-square terms, derived from rules-replayed boards. Bounded lookups retain source occurrences and distinguish equal material, equal placement and selected-square matches; turn, rights and counters remain in the separate full FEN.
- **Theme tags** from the detectors (IQP, Carlsbad, opposite castling, passed pawn, bishop pair, ...), which connect positions to books and lessons.
- **Engine evaluations** are stored by EPD, from White's point of view, and shared by the board, the review and the coach.

The [material and placement indexes](LIBRARY.md#material-and-piece-placement) (8.1) expose structural predicates without changing the current Reading/Combined rankings. Equal geometry does not verify a transferable move, source prose or a study result. Optional Combined Library search fuses passage embeddings with current exact/pawn and feature-tag signals, including opt-in fuzzy pawn distance (8.5); The separate pattern index (8.2) derives position themes and recorded move/three-ply motifs from legal source replay, retaining exact occurrence/branch identities and heuristic/candidate/rules evidence classes. Library pattern browsing filters these classes and rechecks source/policy/generation before navigation; it makes no engine/provider requests. Source claims and geometric candidates gain no payoff proof, and the current retrieval rankings remain separate. [Pattern schema and limits](LIBRARY.md#position-and-move-pattern-tags) describe the boundary.

The **opening explorer** (`openings.js`, 5.2) builds a separate EPD-keyed move graph from standard-start PGN mainlines in the reference collection. Transpositions join; each record contributes its first continuation at a position. Corpus filters, result counts and sample occurrences are explicit data queries. Continuation clicks use the scratch board and require the same help permission as engine analysis. This does not use a language model or an external explorer API.

The **repertoire builder** (`repertoire.js`, 5.3) stores named White/Black collections of ordered UCI lines and notes under the versioned browser key `kibitz.repertoires`, separately from saved games. chess.js validates complete standard-start lines on input and reload. Board capture joins a game prefix to a connected scratch variation, keeping only the displayed portion. A position graph shows the selected side's chosen moves across transpositions; the stored routes stay intact for editing and drills. Opening a line uses the scratch board, and live-help restrictions cover both saved suggestions and actions. Writes publish to memory only after storage succeeds; unreadable or unknown-version data is kept untouched. This needs no LLM and has no cloud sync yet.

The **repertoire drill** (`drills.js`, 5.4) derives one recall card per repertoire-side EPD, accepting the union of saved choices across shared prefixes and transpositions. Card identity includes repertoire id, side, EPD and sorted choices: renamed lines/notes preserve progress, while changed choices get a new card. A session captures up to 20 due/new cards, with overdue positions first. chess.js checks answers and replays one stored opponent reply; a legal unsaved move is a recall miss, not an engine judgement. The separate chessground board never edits the game, scratch board, clock or library. Repertoire changes, game-generation changes and reduced live help invalidate the session, including pending promotion callbacks.

Review progress is stored separately under versioned `kibitz.repertoireReviews`. Clean recall uses intervals of 1 day, 3 days, then doubling to 180 days; an origin-square hint keeps at least a one-day interval, and a miss/reveal schedules a ten-minute retry. This is a simple deterministic rule, not a fitted memory model. Completed attempts save atomically; a failed write retains the answered card for an explicit retry without double-counting. Malformed/future-version progress remains untouched with drills disabled. Counts cover current cards only; old keys are retained but do not transfer a grade to changed choices. Completed recalls survive reloads; unfinished sessions do not. This scheduling is local to openings; the shared puzzle/lesson scheduler (9.4) and cloud persistence remain planned. No LLM or engine analysis is required for recall or hints.

**Opening explanations** (`opening-guides.js`, 5.5) retrieve original English/German study notes for twelve opening families and seven pawn patterns. A direct ECO/EPD match identifies the displayed position, including transpositions. An earlier match on its opening route is labelled as background; scratch branches replace the later game route, and disconnected setups inherit no game history. Current structure notes are selected independently by the existing board-feature detectors, so a central exchange can remove a note without erasing the opening background. The bounded selection is one family and at most two structures; unsupported and endgame positions receive no fabricated guide. These are general plans, without authored move variations or evaluation claims.

The Openings panel works without a model. It clears guide text under restricted live help, including while closed; discussion buttons recheck the game generation, FEN and permission. Discussing a guide explicitly selects position chat. Permitted position/commentary/study requests receive the same captured notes through `quote()` as bounded retrieval data, separate from Stockfish evidence; General chess and restricted-help prompts omit them. The coach may adapt their explanation, while any concrete continuation still needs the supplied engine lines or engine-tool results. This is structural retrieval over a small authored catalogue, not a text/embedding index or an external book-content service.

**Named opening continuations** (`opening-variations.js`, 5.6) compile the same CC0 rows as `openings.json` into `opening-variations.json` at build time. The EPD graph joins transpositions and records legal outgoing UCI moves with their three nearest named destinations. Zero remaining plies means an immediate name; deeper names explicitly state their distance. Names at a target reached through another move order also label its incoming edges. The browser checks every move and destination again with chess.js and derives SAN/full FEN from the query position, preserving its counters. Catalogue input/compiler changes invalidate the generated files. The current dataset has 3,865 lines and 7,983 graph positions (about 2.75 MB uncompressed); no full-line replay runs at browser startup.

The panel distinguishes exact current names from an earlier opening on the visible route. Hover/focus temporarily previews the position after a move without changing game, scratch, analysis or coach context; restoration preserves the rows for keyboard navigation. The list scrolls independently, and the desktop board stays visible while browsing Openings. Analysis clicks extend a scratch line. At the current live position, Full-help clicks use the normal player-move path, including turn, clock and engine-reply checks; historical/opponent-turn buttons are disabled. Existing scratch boards remain scratch boards. All restricted live-help modes clear names even in a closed tab, and held actions recheck generation, mode, scratch identity, FEN and permission. Loading/retry redraws against the current game rather than a captured old position.

Permitted coach requests add bounded, quoted catalogue names and next moves alongside the 5.5 study notes. **About this opening** uses the actual game/scratch position and is unavailable in General chess or reduced live help. The catalogue establishes names and branches, not strength, frequency or engine evidence: Stockfish still checks concrete advice, while record frequencies remain in 5.2. Opening browsing needs no provider or external service.

### 3.4 Structured output

Machine-facing output uses constrained formats: named JSON replies for structured requests, schemas for tool calls, and a small `board` grammar for marks in chat answers.

Commentary links retain the game positions and engine lines supplied with each request. The resolver in `annotations.js` checks move number, side and legality against that snapshot, joining prose continuations while resetting separate alternatives. Historical moves, scratch lines and review references keep their original FENs when the player navigates. A legal link permits inspection; engine/game backing remains a separate verdict, and unsupported claims stay flagged. Unknown or ambiguous positions stay unlinked. Commentary cache keys include the ordered game/scratch route and full position, since equal EPDs can occur at different move numbers.

- **Named formats only.** The page asks for a format by name (`/api/ai/structured`, `FORMATS` in `schema.mjs`) and can't send a schema of its own.
- **Native first, then a fallback.** The gateway asks each provider for native JSON-schema output. If the provider rejects that, or the reply doesn't fit, it repeats the request with the schema in the instructions and parses the JSON out of the text (`completeJson()`).
- **Validated twice.** The gateway validates every reply against the schema (`validate()`), including limits that strict provider modes can't express (lengths, patterns, item counts). The page checks every square against the position before drawing it (4.4).
- **Chat marks.** `parseBoardBlock()` in `annotations.js` parses a bounded block of arrows, squares, ghost pieces and labels. The page checks these against the displayed position; normal chat prose is not required to be JSON.

### 3.5 Tool use

Instead of receiving a fixed context, the model asks the symbolic side questions (4.11, 4.8.3, 4.10.3):

- **Engine tools:** `analyse`, `try_move` (compare a move with the best), `threats` (what the opponent would do if it were their move), `compare`, `find_mate`.
- **Pattern tools:** `find_motifs` over a line. The same verifier checks patterns in analysis and threat lines: before/after evaluations must lose no more than half a pawn against the best, with a payoff within six plies (material, mate or an advantage that persists at the horizon). Only confirmed motifs are returned. Combination labels also require the engine's reply and follow-up to match. A shared EPD cache, at most twelve additional searches, and a fifteen-second admission budget bound the checks; unresolved patterns stay unverified. A supplied legal line is never evidence by itself.
- **Library tools:** search saved and classic games, search named openings, and load a game at a move, a FEN, a PGN or an opening line.
- **Board tools:** make a move, navigate, set up pieces, and undo a board change. In analysis, moves and setups use the scratch board.

The page checks each call before it runs:

- tool arguments are untrusted, so every FEN and move is checked with chess.js, and depth, time and line count are capped;
- every line the model quotes must come from a tool result;
- tools only load and show, never change or delete saved data;
- leaving a game in progress needs the player's confirmation.

The loop runs in the page, capped at four rounds and six calls per answer. Every round tells the model whether Stockfish evaluation tools are actually offered, withheld by General chess/live-help context, or exhausted by the call budget. Restricted live help is explained as a setting: choosing Full engine help enables fresh searches during play, including in an existing conversation; General chess has a separate explanation. A load analyses its new position before asking the model to explain it. The in-browser model uses fixed context. A gateway model falls back only after explicitly rejecting tool support: `coach-tools.js` recognises that capability error and keys the page-local cache by the actual provider/model for the task. Temporary service errors and unrelated request rejections stay visible without disabling tools. A different model keeps its own capability state; a successful connection test allows the tested model to try tools again. A visible, translated notice identifies context-only gateway answers, without claiming a new model-requested search. Local commands such as `play e4`, `open the Opera Game`, `remove the queens` and `undo` work without tool support or an AI provider.

The chat's Discuss control selects the current position or general chess. General questions keep their own history and send no board context. Each answer keeps a snapshot of the game and move it was about, with a button to revisit it in analysis. Leaving a running game keeps it in memory with a way back, including its clock; loads and scratch changes never write the saved library.

Play and Study group the task tabs. **Analyse** immediately pauses a detached game snapshot, including its clock; **Play** and either **Return to my game** button restore that game directly, bypassing chat and challenges. The original history, viewed step, starting position and result survive analysis edits, even for untouched or finished games. Switching cancels chat/opponent work and advances the game generation before applying the other session. Returning retains the study's cursor, scratch variation and review results. `sessions.js` identifies the corresponding game checkpoint by its game ID, full position history, cursor, player colour and result: revisiting an unchanged game restores that study, while a game that has advanced opens fresh analysis. Clock ticks and engine annotations do not invalidate the study. Entering Review from a live game still requires confirmation and uses the same pause/restore path. Switching itself does not save an unfinished game to the library. The board, dialogue and review identify their game and move. These paired sessions live in memory, not across a reload. On narrow screens the composer temporarily fits beside the board inside the visual viewport, following keyboard resizing; sending or choosing Full layout restores the normal arrangement.

### 3.6 Verification and guardrails

`openings/names-de.js` formats catalogue labels and supplies bilingual search aliases while canonical names remain available to feature detection, selections and prompts. `library/classic-comments-de.js` localizes only project-authored built-ins at construction; translated PGNs receive ordinary revision-bound source snapshots and locators. Imported/saved notes are not rewritten, and translated annotations remain unverified. [Coverage and evidence boundaries](GERMAN-STUDY.md) record catalogue/comment audits and tablebase invariants.

The opt-in [offline app](OFFLINE.md) uses a generated public asset manifest and a scoped module service worker. Installation verifies exact sizes/digests before activation. Failed updates remove incomplete caches; complete updates wait for existing tabs to close. Navigation/modules stay within one cached bundle. API/model-weight/private-owner requests are excluded, and confirmed browser erasure removes the app registration/cache. A separately validated, explicitly selected browser-model descriptor can restore the local coach when the gateway is unavailable; cloud status and user metadata are never replayed from the app cache.

The main board's `chess/keyboard-board.js` supplies a native roving-focus grid over Chessground. chess.js derives square labels and legal destinations; keyboard moves call the existing guarded pointer path. Captured game/FEN/orientation permissions invalidate selections, and promotion choices retain game/scratch identity before acting. `board-marks.js` supplies distinct arrow patterns and text descriptions; reduced-motion changes update the actual Chessground animator. [Controls and verification limits](ACCESSIBILITY.md) distinguish automated coverage from accessibility conformance.

The model's output is untrusted.

- **Never HTML.** The page renders answers as text, with a minimal markdown subset built from DOM nodes.
- **The answer check** (`checkAnswer()` in `tutor.js`) sorts every move-like token in an answer:
  - in Stockfish's lines, for the position or the one before;
  - one of the game's moves;
  - legal but unchecked;
  - invalid;
  - a bare square.

  Moves joined only by move numbers must form a contiguous run of an engine line or the game. Claims like "the bishop on b5" are checked against the board. Invalid moves are underlined in red, and a note counts the wrong claims.
- **Stale answers are dropped.** Every async step (engine, coach, review) checks that the game is still the one it started for (`S.gen`, the node, or the FEN) before showing anything.
- **Limits** on input size, request rate and daily tokens, enforced in the gateway.

### 3.7 Agency (planned)

The bounded chat tool loop above is implemented. Longer autonomous investigations across several games remain planned.

The coach as an agent: it decides which tools to call, in a bounded loop, to answer a question like "why did I lose this game?" or "find where I went wrong in my last three losses" (4.8, 4.11). It would:

- load the games;
- run the engine on the critical moments;
- look up the patterns and the matching literature;
- explain what it found.

Bounds:

- a cap on tool calls and engine time per answer;
- read-only tools by default;
- confirmation before anything leaves the current game;
- every claim traceable to a tool result, which the chat can show as evidence.

**Catalogue metadata search** (7.5, `library/search.js`) shares literal accent/case-insensitive AND matching across Library controls and the coach tool. Player, opening/ECO, inclusive recorded-year bounds, absolute result and theme filters combine. Cached legal PGN headers/early mainline EPDs supply names/dates/results/opening labels; custom-start studies are not classified from their final boards. Unknown years stay outside ranges and invalid bounds return an accessible error. Theme IDs match tag membership exactly, with English/German labels also searchable, without any chess-verification claim. Active searches can include classics beside personal games; category/reset behavior and current-game isolation remain explicit. ECO readiness updates retained cards without discarding source drafts/focus. The coach's own-colour win/loss/draw filters stay separate from absolute results, and its eight bounded metadata hits remain quoted. Local browsing uses no model/storage mutation; [matching rules and limits](LIBRARY.md#catalogue-search) describe the boundary.

## 4. A language model in the browser

Offline mode (`just offline`, TODO 2.16) runs the coach's language model inside the page.

The default below is wllama. The optional `BROWSER_RUNTIME=chrome` / `just offline-chrome` backend uses [`chrome-llm.js`](../site/src/coach/chrome-llm.js) with the same page-side sample result and quick-request routing. Its Window-only API, Chrome-managed weights, explicit Load per session, disposable request clones, cancellation/generation guards, context/output/deadline bounds and opaque resource/version limits are documented in [Offline app](OFFLINE.md#optional-chrome-built-in-coach). A Chrome descriptor has no weight URL or invented byte count; it cannot authorize loading automatically.

- **Runtime.** [wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WebAssembly) runs a GGUF model on the GPU through WebGPU, or on the CPU with multi-threaded WebAssembly where there's no WebGPU. One MIT-licensed module and one wasm file are copied into `dist/` and imported only when the model is first needed.
- **Models.** A small catalog (`server/models.mjs`) pins each model by size and SHA-256: Qwen2.5 1.5B Instruct by default, 0.5B as a lighter option, both Apache-2.0. `scripts/fetch-model.mjs` downloads one once into `site/models/`, and the local server hands it to the page. The page never fetches weights from another host.
- **Consent and resources:**
  - Nothing loads until the player presses Load, with the size shown.
  - The device memory is checked first.
  - The weights are cached in the browser's storage (OPFS) when there's room. When there isn't, as in a private window, the page fetches them itself and hands them over in memory.
  - The model unloads after ten idle minutes.
- **Sharing the machine.** On the CPU, the model and Stockfish compete for cores: while the model generates, the analyst runs with fewer threads, applied between searches. On WebGPU the CPU is left to Stockfish.
- **Same interface.** `browser-llm.js` exposes the same `sample()` call as the gateway client: streaming, cancellation, JSON-schema output. So the coach code doesn't care where the model runs. A setting can send only the quick requests (chips, automatic comments) to the in-browser model and everything else to a cloud provider.
- **Offline page and provider policy.** Normal and offline serving both use local bundled fonts, hashed trusted stylesheets and same-origin browser connections; style attributes are blocked. [Asset policy and provenance](WEB-ASSETS.md) document the boundary. The standard offline recipe loads no `.env` and selects browser inference with local-only provider policy. An operator-configured Ollama endpoint can be on another machine; see the [network boundaries](THREAT-MODEL.md).
- **What it's good for.** A 1–2 billion parameter model is weak at chess judgement but adequate for putting the engine's facts into words. That is why the neurosymbolic split matters most here: the smaller the model, the more the engine and the answer check carry.

## 5. Security in brief

The [threat model](THREAT-MODEL.md) gives the supported deployment assumptions, data-flow diagram, asset/privilege boundaries, evidence and residual risks. The notes below are a brief overview rather than a release checklist.

- **Keys stay on the server.** They are read from `.env` and used only by the gateway. They never appear in responses, logs or the page. The status endpoint names providers and models only.
- **Local operator sessions.** Experimental backend issuance (`server/operator.mjs`,
  `sessions.mjs`, `session-api.mjs`) verifies a private installation key before
  issuing a 256-bit HttpOnly host cookie. A separate private registry hashes session
  tokens and binds usage/library identifiers to the operator; raw grouping assertions
  no longer authorize TLS APIs. [Setup and migration](SESSIONS.md) describe storage
  and recovery. [Backend termination](SESSION-TERMINATION.md) serializes protected
  actions with durable revocation, closes held responses and preserves recovery
  locators. Explicit permissions and complete client cleanup keep their TODOs.
- **Local browser request guards.** The default listener is loopback; browser POSTs require the same host/origin and JSON, with bounded bodies. Final Host checks accept the configured isolated `.test` hostname; explicit legacy/development modes retain localhost/IP checks. Non-browser local clients can omit Origin; these guards and cookie scopes are not authentication. The operator-configured Ollama base URL has a host allowlist.
- **Page hardening:**
  - a hash-based CSP: inline scripts by hash only, no plugins, no framing, `base-uri 'none'`, and `connect-src 'self'`;
  - cross-origin isolation;
  - no dot-files served.
- **Untrusted input everywhere it enters:**
  - imported PGN, model output and library text are never rendered as HTML;
  - every move and square from them is checked with chess.js;
  - every prompt quotes them.
- **Release gate:** before each release, the OWASP Top 10, the OWASP Top 10 for LLM Applications and ASVS checks (TODO 11).

## 6. Testing the parts

- **Unit tests** (`node:test`) cover the symbolic modules and the gateway:
  - motifs, features, classification;
  - the tutor logic and the answer check;
  - clocks and game-end rules;
  - the gateway's validation, limits and providers.
- **No test calls a real provider.**
  - The gateway tests use fake SDK clients and a mock provider.
  - Contract tests replay recorded provider responses through the real SDKs.
  - The page tests run against the mock provider, and the in-browser model is replaced by a fake runtime.
- **Live tests** with real providers or the real in-browser model run only when an environment flag is set (`KIBITZ_LIVE_AI=1`, `KIBITZ_LIVE_MODEL=1`).
- **Playwright** drives the built page in Chrome: full games, the engine fallbacks, the coach, the layout, and a regression test for every fixed bug.
- **Tutor evaluation:** fixed positions, recorded engine checks, lexical cue coverage and an optional judge remain separate evidence. German preparation retains the same concepts and language-specific references; mock results and lexical matches do not establish provider quality.

### Persistent local accounting

`server/usage-store.mjs` stores current-day counters and bounded minute admissions in a private versioned SQLite database. `usageAccounting()` shares it across coach/tests/embeddings, commits both server/user completion totals atomically and checks per-cookie plus aggregate rates before provider work. Cookie IDs are hashed; no prompts, responses, raw cookies or keys enter the ledger. Standard serve recipes select `.kibitz-data/usage.sqlite`; direct CLI calls default to memory. Shared private-file checks keep both usage and library databases outside the static tree. [Accounting behavior and lifecycle](USAGE.md) explain threshold overshoot, failures, retention and the deferred account boundary.
