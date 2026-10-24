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

```mermaid
flowchart LR
  subgraph Browser["Browser page (site/src)"]
    UI["Board, dialogue, panels<br/>index.html"]
    SF["Stockfish 19 (WASM)<br/>analyst + opponent workers<br/>engine.js"]
    KN["Symbolic knowledge<br/>knowledge.js, tutor.js, play.js"]
    BL["In-browser model (optional)<br/>wllama on WebGPU / WASM<br/>browser-llm.js"]
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
- **Source modules** are grouped by responsibility under `site/src/`: `chess/` for rules, knowledge, engine and game helpers; `coach/` for prompts, tools, annotations and model support; `curriculum/` for lesson records, authored material and catalogue UI; `library/` for source records, classics and passage search; `openings/` for opening guides, repertoires and drills; and `platform/` for storage and localization. `index.html` composes them. The build preserves these paths in `dist/`, where vendored libraries and Stockfish workers live at the root. The same pure modules are imported directly by Node tests, the gateway and offline evaluation tools.
- **The local server** serves the page with a strict Content Security Policy. It mounts the AI gateway under `/api/ai/`, which holds the API keys (from `.env`), talks to the providers, enforces limits, and streams answers back as NDJSON. Keys never reach the page.
- **Two other deployments** use the same page:
  - **As a Claude artifact,** where the page uses the host's `window.claude` model instead of the gateway.
  - **Fully offline** (`just offline`), where a small model runs in the page and nothing leaves the machine (section 4).

## 3. Generative-AI patterns, as built here

The **curriculum catalogue** (6.1, `src/curriculum/`) is independent of the coach and active board. A pure compiler validates bounded module/lesson/exercise records, unique stable IDs, English/German teaching text, level and theme tags, attribution, and acyclic prerequisites. chess.js checks each starting position and recorded UCI line; mate exercises additionally establish terminal checkmate for the learner's colour. Reflection lines have authored rubrics and make no result claim unless accompanied by the exact tablebase evidence described below. The tactical catalogue (6.2) covers thirteen themes and includes a capturable-fork counterexample. Optional declared patterns must appear in the existing move/line motif detectors for that exact example; this checks geometric consistency, not tactical soundness or uniqueness. The Lessons panel filters and renders this data literally without provider requests or game changes. Lesson play, alternative-answer grading and progress remain 6.6/6.7.

The **strategy material** (6.3) adds ten reflections beside the king-activity foundation. IQP, Carlsbad and hanging-pawn examples declare optional `positionTag` metadata, which the compiler checks with the existing position-feature detector. Other lessons ask about weak squares, supported outposts, bishop routes, open files, pawn cover, useful piece roles and preventive ideas. Board-fact tests check their concrete support, attack, colour and flight-square relationships. These lesson tags and candidate demonstrations do not add new engine evaluations or certify a best plan.

The **endgame material** (6.4) contains six lessons and ten exercises, with 28 recorded Syzygy snapshots checking all 28 worked plies. `tablebase.js` validates canonical legal FENs with at most seven pieces and no castling rights, complete legal move sets, terminal facts, source URLs/dates and numeric distance fields. The compiler requires the declared result to hold at each branch position and after every move. Results are expressed from White's perspective; API move categories refer to the child side to move. Unlike engine evaluations, this evidence uses full FEN including counters because the fifty-move rule matters. Cursed/blessed, uncertain and unknown categories are not ordinary result evidence; DTZ is not DTM. `check-endgames.mjs` audits offline by default and queries only fixed authored diagrams with explicit `--refresh`. No game position leaves the browser. Snapshots substantiate these exact branches, not unique solutions, arbitrary transpositions or every possible continuation; interactive solving remains 6.6.

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

The existing flat local/account game documents gain an optional version-one provenance envelope. Reading legacy records adds no migration write; malformed/future source metadata remains untouched and is excluded from position retrieval. Import accepts optional attribution/licence fields, and source editing preserves the PGN. Built-ins identify the packaged collection and the project's annotation licence without inventing original score rights. Browser persistence writes only the changed collection and rolls back memory on failure. Compiled snapshots cache exact input, clear superseded position results while rebuilding, and reject late generations after source changes/deletion; held source edits recheck record identity. Retrieved source assertions enter coach context only through `quote()`. SQLite/IndexedDB and source deduplication remain planned.

**Passage search** (`text-search.js`, `dense-search.js`, 8.3; [design and comparison](TEXT-SEARCH.md)) indexes mainline comments and separate bilingual authored-guide fields with source revisions and exact UTF-16 locators. Default local BM25 needs no provider. Optional cosine ranking uses explicit ingestion/query actions through a stateless embedding route, with a separately configured provider, shared budgets and local-only enforcement. Selected sources/languages are filtered before ingestion; vectors and provider/model/revision/dimension metadata stay in browser memory and are erased on source/account/policy changes. Library search displays literal passages and opens annotation results at their full-FEN occurrence. Live-help restrictions clear results and guarded navigation rechecks source identity, revisions and game/library generations. Library searches do not themselves change coach context.

**Hybrid retrieval** (`hybrid-search.js`, 8.4; [design and measured tradeoffs](HYBRID-SEARCH.md)) fuses up to twenty candidates each from BM25, dense, exact/nonempty-pawn and feature-tag channels using reciprocal ranks, then reranks complete term matches and exact boards. Board relevance is explicit: legal source FENs/current visible board supply profiles, with compatible turn/check/phase for analogies. Guides supply their catalogue concept rather than a fabricated board. An optional every-term constraint can return no passage; it is literal coverage rather than semantic support. Source IDs resolve to canonical local records, and query/filter/main/scratch-board changes invalidate pending results and held actions without automatically uploading a replacement. No learned reranker or calibrated confidence threshold is claimed.

**Fuzzy pawn distance** (`pawn-distance.js`, 8.5; [definition and benchmark](PAWN-DISTANCE.md)) computes colour-specific pawn-square Jaccard distance. Combined search optionally admits up to 0.25 distance in its position channel, after the same dynamic/source eligibility checks. Exact boards remain distinct, and pawnless boards gain no analogy. The UI explains shared/unmatched squares; distance is neither a legal-move cost nor transferable-advice confidence. Default overlap remains exact. The legacy Reading position buckets retain their earlier behaviour.

**Cited coach context** (`retrieval-context.js`, 8.6; [design](RETRIEVAL-CITATIONS.md)) supplies up to three 900-character excerpts through local keyword/exact-pawn/tag retrieval, independently of Library controls, without implicit embeddings or fuzzy expansion. General chat uses the question without the active board; position chat/tutor also use their captured board. Source prose/metadata are quoted assertions, separate from engine evidence. Content-bound citation tokens resolve only inside their answer's captured bundle. Navigation rechecks canonical revisions and full-FEN occurrences, legally replays the game, confirms leaving live play and preserves the return path and dialogue. Source/account/help/provider changes revoke pending work/actions, remove source excerpts and clear old model-turn history; restricted live help supplies no passages. Board tools refresh the bundle before the next model turn. Valid citation identity does not establish semantic support.

The [offline retrieval benchmark](RETRIEVAL-EVAL.md) (8.8) replays a fixed, source-aware corpus through this production index. Manually labelled English/German queries distinguish exact matches, transpositions, requested occurrences, structural analogies and no-answer cases. It reports precision/recall/MRR/graded nDCG at 1/3/6 separately from no-answer false positives, with source revisions, corpus/case hashes and per-query rankings. It measures current retrieval limitations without a provider call or change to retrieval behaviour; it does not establish engine correctness or answer faithfulness.

### 3.3 Structured retrieval

Chess positions have structure that text embeddings would blur, so retrieval here uses keys from chess itself rather than vector similarity:

- **The exact position:** the EPD, a FEN without move counters, so transpositions match.
- **The pawn structure:** `pawnSignature()`, so a game with the same structure is found even when the pieces stand elsewhere.
- **Theme tags** from the detectors (IQP, Carlsbad, opposite castling, passed pawn, bishop pair, ...), which connect positions to books and lessons.
- **Engine evaluations** are stored by EPD, from White's point of view, and shared by the board, the review and the coach.

Planned: material and piece-placement signatures (8.1). Optional Combined Library search fuses passage embeddings with current exact/pawn and feature-tag signals, including opt-in fuzzy pawn distance (8.5); richer signatures/motif indexing remain separate work.

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

## 4. A language model in the browser

Offline mode (`just offline`, TODO 2.16) runs the coach's language model inside the page.

- **Runtime.** [wllama](https://github.com/ngxson/wllama) (llama.cpp compiled to WebAssembly) runs a GGUF model on the GPU through WebGPU, or on the CPU with multi-threaded WebAssembly where there's no WebGPU. One MIT-licensed module and one wasm file are copied into `dist/` and imported only when the model is first needed.
- **Models.** A small catalog (`server/models.mjs`) pins each model by size and SHA-256: Qwen2.5 1.5B Instruct by default, 0.5B as a lighter option, both Apache-2.0. `scripts/fetch-model.mjs` downloads one once into `site/models/`, and the local server hands it to the page. The page never fetches weights from another host.
- **Consent and resources:**
  - Nothing loads until the player presses Load, with the size shown.
  - The device memory is checked first.
  - The weights are cached in the browser's storage (OPFS) when there's room. When there isn't, as in a private window, the page fetches them itself and hands them over in memory.
  - The model unloads after ten idle minutes.
- **Sharing the machine.** On the CPU, the model and Stockfish compete for cores: while the model generates, the analyst runs with fewer threads, applied between searches. On WebGPU the CPU is left to Stockfish.
- **Same interface.** `browser-llm.js` exposes the same `sample()` call as the gateway client: streaming, cancellation, JSON-schema output. So the coach code doesn't care where the model runs. A setting can send only the quick requests (chips, automatic comments) to the in-browser model and everything else to a cloud provider.
- **Offline guarantee.** In offline mode the server loads no `.env` and turns on local-only mode. It serves the page without Google Fonts and with a CSP that allows no other host: nothing leaves the machine.
- **What it's good for.** A 1–2 billion parameter model is weak at chess judgement but adequate for putting the engine's facts into words. That is why the neurosymbolic split matters most here: the smaller the model, the more the engine and the answer check carry.

## 5. Security in brief

- **Keys stay on the server.** They are read from `.env` and used only by the gateway. They never appear in responses, logs or the page. The status endpoint names providers and models only.
- **The gateway only serves its own page.** It accepts JSON only from its own origin (against CSRF), only under a local host name (against DNS rebinding), and only up to a size limit. The Ollama base URL is checked against an allowlist (against SSRF).
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
- **Planned:** a tutor eval set scores the coach's answers on reference positions per provider, with engine checks plus a model as judge (3.8).
