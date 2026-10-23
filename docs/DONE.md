# DONE

Progress log for [TODO.md](TODO.md), newest first. Each entry gives the date, the TODO items covered, and then:
- **Implementation notes:** what was built, and where.
- **Deviations:** what differs from the plan, and why.
- **Insights:** what we learned that matters for later work.

---

## 2026-10-23 — Research: RAG, neurosymbolic games and milestones 5–7

TODO items: 8.9 (research); informs milestones 5–8.

### Implementation notes

- Added [docs/research](research/README.md) with a milestone-by-milestone AI use-case analysis, a code audit of Stockfish integration, a retrieval-methods study and a primary-source review of neurosymbolic chess and other games.
- The retrieval study covers source-aware passage ingestion, lexical/dense/hybrid search, reranking, structured chess queries, position/concept graphs, GraphRAG, LightRAG, HippoRAG, RAPTOR and LazyGraphRAG. It proposes a provenance-aware schema, staged delivery and separate retrieval/chess/teaching evaluations.
- The games review covers engine-grounded and concept-guided commentary, Queen, ChessGPT, Maia-2, AlphaZero, MuZero, NNUE, TextWorld logical policies, DeepProbLog and shielding. It identifies concrete experiments rather than adopting new frameworks.
- Linked the research from README, ARCH and TODO; clarified ARCH's distinction between explicit chess rules, finite engine search and claims about explanations.
- Validation: `npm run check`, a fresh build and mock-provider unit tests pass (243 passed, one opt-in live test skipped). Checked local document links and rendered the research and updated documentation PDFs; no app/UI code changed.

### Deviations

- This is documentation and selective literature review, not a runtime implementation, systematic survey or reproduction of paper benchmarks. Milestones 5–8 retain their feature status; only the research item is marked complete.
- No dependencies, datasets, model weights, embedding index or engine exports were added. The audit is pinned to `0176c62`; the pending Primer-source PR is linked separately.

### Insights

- Kibitz already uses a separate complete Stockfish analyst outside the opponent game. It does not call standalone NNUE, hidden representations, static evaluation traces or Syzygy. The embedding client helpers likewise do not constitute an implemented text-retrieval pipeline.
- A legal position/move graph, a text-derived entity graph and a hierarchy of summaries solve different retrieval problems. Establish a labelled lexical/structural baseline before adding graph complexity.
- Engine agreement, source grounding, explanation faithfulness and learner improvement need separate checks. Finite-depth analysis and a model judge should not be presented as universal chess truth.
## 2026-10-23 — Keep the game and the review, with the board visible while typing

TODO items: 4.12.2, 4.12.3, 4.12.4; completes 4.12 and milestone 4 with 4.11.2.

### Implementation notes

- The tabs are grouped into Play (Game, Coach) and Study (Review, Library, Reading), retaining their ARIA tab keyboard navigation. A banner above the board identifies the current game, finished game or analysis, with its players/title and move. The dialogue and review name their position too; imported titles remain text.
- Selecting Review during a running game asks to pause it. Cancellation keeps playing. Acceptance snapshots the live game and clock, then opens a separate analysis session. Returning resumes the live game; revisiting Review restores the previous study's cursor, scratch board and review results. Undoing a transition also keeps the other session. A confirmation tied to an old game cannot replace a newer one.
- The board and dialogue both offer Return. The header's Play switch resumes a suspended game too. Panel PGN loads, library loads and the Analyse switch preserve a return snapshot before the existing save operation normalizes metadata, so returning keeps the original headers as well as the moves and clock. Failed imports do not leave a phantom suspended game.
- Confirmed continuations later in a motif tool's line carry their own starting FEN into the answer's board links. Clicking such a tactic opens it from its actual position, rather than the tool's original root position.
- The normal dialogue stays below the board on portrait phones and beside it on tablets and landscape phones. Narrow-screen chips scroll in one row. While composing, the board and composer fit side by side inside `visualViewport`; its height and offset follow keyboard/viewport changes. Sending, Escape, losing composer focus or Full layout restores the normal view. The textarea uses 16px text on narrow screens to avoid input zoom.
- `ux.spec` adds end-to-end coverage for review confirmation/cancellation, both sessions over a round trip, preserved headers, invalid/valid imports, the Analyse switch, stale confirmation, and visible board/input/send controls at portrait, landscape and tablet sizes with a reduced keyboard viewport. Existing settings, layout and chat tests remain in place. No dependencies were added.

### Deviations

- The temporary composition view replaces a mobile drawer. It keeps the board visible without putting it behind the chat.
- The suspended game and last study remain session memory. Reload persistence for both sessions is outside this milestone; the existing single current-game snapshot remains unchanged.
- Mobile keyboard geometry is exercised in Chrome with reduced viewports. Physical iOS/Android keyboard behavior has not been manually tested.

### Insights

- Saving can change display metadata, so preserving only the moves is not enough for a faithful return: take the snapshot before saving.
- A tall stacked page can pass a simple visibility check while its board is far outside the keyboard viewport. The new tests check the actual rectangles of the board and composer.

---

## 2026-10-23 — Engine-confirmed tactical patterns

TODO items: 4.11.2; completes 4.11.

### Implementation notes

- Pattern detection now separates geometric candidates from confirmed tactics. `tools.js` checks the engine's best evaluation before and after each candidate move, from the mover's perspective. A move losing over half a pawn against the best is refuted. Missing, shallow (below depth 6), bounded or illegal engine results never confirm a motif.
- A short engine continuation must show a material gain, legal mate, or a positional advantage/compensation that a fresh evaluation still confirms at its six-ply horizon. Legal mates are conclusive even when the engine returns no terminal PV. Confirmation details, losses, continuations and reasons for abstaining travel back to the model.
- The checks apply to `analyse`, `try_move` replies, `threats` and `find_motifs`. The latter no longer passes an arbitrary supplied legal line to the answer checker as engine evidence; it supplies only confirmed continuations. A gap of 1.5 pawns marks an only move only if the best move still holds.
- `knowledge.js` adds candidate detectors for skewers, double checks, discoveries against material, interference and removing defenders. Concrete three-ply sequences identify deflection, overloaded defenders, decoys and checking zwischenzugs. Combination labels require the supplied reply/follow-up to match the engine's continuation.
- Each tool shares an EPD cache across its lines, with at most twelve additional searches and no new search after fifteen seconds. Individual searches retain the page's five-second cap. The page checks cancellation and game generation before and after every engine search, including searches inside one tool.
- Tests cover sound and poisoned forks for both colors, score validity, large scores without display clamping, terminal mates, cooperative supplied lines, bounds and the new detectors. Browser regressions exercise the model/tool round trip and evidence display with the mock provider.

### Deviations

- These are conservative detectors and finite-depth checks, not an exhaustive tactics solver. Long combinations, positional sacrifices without a stable short horizon, non-checking zwischenzugs and candidates beyond the search budget stay unverified. The broader lesson curriculum in 6.2 remains open.
- No live model evaluation was run; all provider tests use mocks. No dependencies were added.

### Insights

- A legal line can contain a losing fork or a cooperative reply. Legality alone must never turn a model's proposed continuation into engine evidence.
- A display-clamped evaluation can conceal a large loss in an already winning position. Pattern checks use the full centipawn value.

---

## 2026-10-22 — Chat context, library loading and board control

TODO items: 4.8, 4.9, 4.10 (milestone 4, part 2b).

### Implementation notes

- **Commands and validation** (`site/src/chat.js`, pure): legal moves through the existing typed-move parser; FEN and PGN loading; move-number navigation; piece edits and side to move; library search by player, opening or theme, with own-game color and result filters. Imported metadata is quoted before it goes into tool results or history. Position checks now reject an attacked non-moving king as well as malformed FENs; game-start checks additionally reject terminal positions.
- **Local commands:** `e4`, `play Nf3`, `show me e4 and what follows`, `take back two moves`, `go to move 15`, `put a white knight on f5`, `remove the queens`, `White to move`, `undo`, and `return to my game`. These work without a model. Analysis moves and setups stay on a scratch board; live moves respect the player's turn, clock and help level.
- **Tools:** library and opening searches, game/FEN/PGN/opening loads, `move`, `goto`, `setup`, `undo`, using the same provider adapters as the engine tools. Each action is validated again against the current board. The existing four-round/six-call cap applies to both tool groups; engine tools withheld by the help setting are also refused if the model calls one anyway.
- **Loading a running game requires confirmation.** Cancellation leaves it in place. An accepted load suspends it in memory, with a Return button; its clock resumes when returning. Loads, scratch edits and navigation never write the saved library. A board change can be undone as one action.
- **Context:** the Discuss selector switches between the current game/position and General chess, which has its own history and sends no board context. The active tab is included in position requests. Answers carry a context button that revisits their position in analysis. Loads preserve the conversation and send fresh engine context before the next model turn; scratch questions use the position actually shown, including after stepping backwards.
- **Async guards:** cancelled or replaced requests cannot add old messages to a new game. Board actions check both generation and FEN. Review summaries now discard responses when their original game has been replaced.
- **Tests:** unit coverage for parsing, hostile arguments, legal setups, long/custom-start PGNs, quoted retrieval and gateway tool shapes; browser coverage for local and model commands, confirmation/cancellation/return, undo, searches and loads, context switches and links, withheld engine help, stale chat/summary responses, and phone/tablet layouts. Providers are mocked throughout.

### Deviations

- The context control is a select and answer buttons; the existing mobile dialogue stays in place rather than becoming a drawer.
- Suspended games and undo snapshots live only in the current session. Saving games and resuming across a reload continue to use the existing explicit library save and current-game snapshot mechanisms.
- Models without tool support still answer from fixed context. Local commands work with those models and when the coach is off. Named setups such as Lucena load their initial position from the classic collection, locally or through library tools.
- This completes the chat continuation (4.8–4.10). Evaluation-confirmed pattern search (4.11.2) and the remaining game/review UX work (4.12) stay open.

### Insights

- Checking FEN syntax is not checking a legal position: chess.js accepts some impossible king placements. A shared position check protects both loads and engine tools.
- An answer needs a snapshot of its position, not a later lookup of the same move index in whichever game is on the board. The same distinction makes general conversation, scratch analysis and return-to-game work together.

---

## 2026-10-22 — Consistent primer filenames

TODO items: none directly; documentation upkeep.

### Implementation notes

- The primer source, HTML and PDF share the `Primer_v01` basename. The build script reads and writes in `docs/primer/`, with the same prefix for intermediate Markdown files.
- Updated the primer README and the links in ARCH.md and ROAD.md for the PDF's location in `docs/primer/`.

### Deviations

- No planned feature changed.

### Insights

- One basename in the build script keeps source and output names aligned.

---

## 2026-10-22 — Engine tools for the coach: the model asks, Stockfish answers

TODO items: 4.11.1, 4.11.3, 4.11.4, 4.11.5, 4.11.6; 4.11.2 in part (milestone 4, part 2a).

### Implementation notes

- **The catalogue** (`site/src/tools.js`, pure):
  - Six tools: `analyse`, `try_move`, `threats`, `compare`, `find_mate`, `find_motifs`.
  - `checkToolCall` checks every argument as untrusted. Unknown tools and extra fields are refused, FENs and moves go through chess.js, and depth, line count, mate length and line length are capped. Nothing over a cap is quietly clamped.
  - `runTool` runs a call against an engine passed in as a function: the page's Stockfish, or a fake in the tests. It returns the result for the model and the SAN lines it showed.
- **In the gateway** (4.11.3):
  - Messages can carry tool calls (`{role: 'assistant', toolCalls}`) and results (`{role: 'tool', toolCallId}`). Every call must be answered, and only tools from the catalogue may appear. A request names its tools, and the definitions sent to the provider are the server's, never the client's.
  - Anthropic gets `tool_use` and `tool_result` blocks, with the results of one turn grouped. OpenAI, Mistral and Ollama get function calling, with the streamed pieces of each call assembled by index; unreadable arguments become `{}`, which the page then refuses with a reason.
  - Tool calls come back in the stream's done line.
- **The loop runs in the page** (4.11.4, your choice): the page asks for one model turn at a time and runs each call on its own Stockfish, under the tag `tool`. Caps: 4 rounds and 6 calls per answer. The last round offers no tools, so the model must answer.
- **When tools are used:** chat and quick questions, in analysis, a finished game, or with Full engine help. They're never offered in a game with less help, since the tools would show what the player chose not to see. The in-browser model has no tools, and neither does a provider that rejects them: the page asks once more without tools and stops offering them for the session. Those models answer from the context, as before.
- **Evidence** (4.11.5): what the tools found is kept with the answer, shown under it ("Stockfish checked 2 things for this answer"), and counted by the answer check, so the lines the coach quotes from it are backed. Lines that start in positions the tools looked at can be stepped through on the scratch board too.
- **Pattern search** (4.11.2, in part): the motif detectors run along each tool line (`motifsAlong`), and `analyse` flags an "only move" when the second line is 1.5 pawns or more worse.
- **The mock** calls tools only when a question asks it to (`[mock:tool]`, `[mock:loop]`, `[mock:bad-tool]`), so the other tests don't change.
- **Tests:**
  - unit `tools.test`: the catalogue; hostile arguments; each tool against a fake engine.
  - unit `server/tools.test`:
    - messages with tool turns: accepted when complete, refused when calls are unknown, unanswered or oversized;
    - tools only from the catalogue;
    - the provider shapes, and tool calls read back from Anthropic and chat-completions streams;
    - the mock.
  - `api.test`: tool calls in the done line; unknown tools refused.
  - e2e `tools.spec` (5): a tool call with evidence; a model that never stops is stopped after 4 rounds; hostile arguments refused with a reason; no tools in a game with flags only; the fallback when a provider refuses tools.

### Deviations

- **The contract fixtures for tool calls are written by hand,** from the providers' documented stream shapes, not recorded. Recording makes paid calls (`scripts/record-ai-fixtures.mjs`), so it's left for when you want it.
- **The prompt says when to use tools,** and the coach rules gained one line. No eval has been run with tools yet, since that makes paid calls.

### Insights

- **Running the loop in the page kept the gateway stateless.** It only translates shapes. Each round is one ordinary request, counted against the rate limit and budgets like any other, so a runaway model costs at most five requests per question.
## 2026-10-22 — Fix: an annotations test depended on which lines Stockfish found

TODO items: fix for 4.7.

- **The bug:** the e2e test for lines in an answer expected "1. e4 e5 2. Nf3" to read as one line. That needs Stockfish's lines to contain it, and they did on a laptop with four threads but not on CI with one, so the test failed in CI after #34 merged.
- **The fix:** the test puts a fixed analysis for the start position into the page before asking. Every other annotations test was already independent of the engine.
- **Insight:** a test that relies on the answer check relies on the engine, so it needs fixed engine lines. Making the depth the same isn't enough.

---

## 2026-10-22 — The board speaks: lines, marks, a scratch board and "what if"

TODO items: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7 (milestone 4, part 1).

### Implementation notes

- **The schema** (`site/src/annotations.js`, pure):
  - Annotations are arrows (a move for the side to move, or a threat: a move for the other side), squares, ghost pieces (`wN` on d5: where a piece belongs), labels (one or two characters) and lines (moves played one after the other from a position).
  - `checkAnnotation` checks each against the position before anything is drawn. Squares and pieces must exist, arrows must be legal moves for the right side, and a ghost needs a piece of that kind on the board and a square not taken by its own side.
- **Two sources:**
  - **Lines read from an answer:** `linesInAnswer` takes `checkAnswer`'s moves. A run of moves separated only by move numbers becomes a line, up to the first wrong move. It starts where the answer's previous line ended ("3... g6, and if 4. Qf3 then Nf6") or else in the position or the one before.
  - **Marks the coach adds:** a block opened with three backticks and `board`, one mark per line: `arrow e2 e4`, `threat d8 h4`, `square f7`, `ghost wN d5`, `label d5 !`. It's a plain line format, not JSON, so small models get it right more often. `parseBoardBlock` reads it strictly, keeps at most 8, and takes it off the text, also while the answer streams. The coach rules describe it.
- **Drawing** (`index.html`):
  - The marks that fit are drawn while the board shows the answer's position, and a button shows them again. Those that don't fit are counted in a note under the answer: "One board mark didn't fit the position and was left out."
  - Ghost pieces and labels use chessground's piece and label shapes. A red `threat` brush is added.
  - A move that belongs to a line previews the position before it on hover or focus. A click or Enter opens the line on the **scratch board**: a bar under the board with the numbered moves, back and forward (also the arrow keys), Stockfish's view of the position shown, "Ask the coach about this line" and "Back to the game".
- **What if** (4.5): "Try a move" opens the scratch board at the current position.
  - The player plays moves on it; a move continues from the move shown and drops what came after. Stockfish evaluates each position.
  - The coach can be asked about the line: it gets the line, the position after it and Stockfish's view there. The line and Stockfish's continuation count as backed in the answer check.
- **The game is never touched.** Anything that moves the game closes the scratch board: a move, navigation or a load (the game's id, cursor and length are kept with it). Playing on it, and its engine view, are allowed only where the engine's view is shown anyway (analysis, a finished game, Full engine help). In a game with less help, a line from an answer can be stepped through but not played on, and without evaluations.
- **Chat context** (4.6): the context already had the position, the game so far and the last eight turns, coach comments included. It now also has the aspects the player picked and, when there is one, the scratch line.
- **Tests:**
  - unit `annotations.test`: each kind against legal and illegal positions; threats; lines in SAN and UCI; the block's parsing, limit and streaming; hostile blocks (HTML, scripts, junk) draw nothing; lines in an answer, continued across prose and cut at a wrong move.
  - e2e `annotations.spec` (6 tests):
    - preview and stepping with the game unchanged;
    - marks checked, drawn and counted;
    - hostile marks run and draw nothing;
    - what-if with Stockfish and the coach's context;
    - no what-if in a game with flags only;
    - the scratch board closes when the game moves.

### Deviations

- **Lines come from the answer's text,** not from a separate field of the model's output. The text is what the player reads, and `checkAnswer` already checks it. The model's own marks use the block. Tool calls replace it in part 2 (4.10, 4.11).
- **The answer check stays strict:** a move the engine's lines don't back ends a line there, and the rest isn't drawn.

### Insights

- **The scratch board is the preview grown up.** The hover preview of game references (4.12.6) became a board state that `syncBoard` checks first. It closes by itself when the game's id, cursor or length change, so no code path that moves the game needs to know about it.
- **A short line format beats JSON for model marks.** It's easier to read strictly, a broken line costs one mark rather than the block, and it survives streaming.

---

## 2026-10-22 — Settings behind a gear: a modal overlay

TODO items: 4.12.1.

### Implementation notes

- **The gear** in the header opens a native `<dialog>` with `showModal()`. The browser makes the page behind it inert, closes the dialog on Escape and gives focus back to the gear. The close button and a click on the backdrop close it too: a click whose target is the dialog itself, outside `.settings-body`.
- **What moved in:**
  - General: the language (from the header) and the player's level (from the Game tab).
  - Coach: how the coach works (from the Coach tab), and the AI provider, models, local-only mode, connection test and usage (the former "Coach settings" box).
  - Engine: the analysis depth and where it runs (from the Game tab).

  Opening the dialog refreshes the gateway's status and usage, as opening the old box did.
- **What stayed in the tabs**, because it belongs to their task:
  - Game: the new game's colour, start, strength, style, clock and live help, the help level being part of a game's setup and changed during it.
  - Coach: the aspects a comment covers, the interesting moves with their line count and window, and the challenge results, now under their own heading.
- **Layout:** the dialog is at most 560 px wide, 16 px from the edges on a phone, with a sticky title bar and scrolling contents.
- **Tests:**
  - e2e `settings.spec`:
    - open and close by Escape, button and backdrop, with focus back on the gear;
    - Tab never reaches the page behind;
    - the controls live in the dialog and not in the tabs, and the settings persist after a reload;
    - no sideways scrolling at 360 px.
  - The tests and scripts that used the moved controls open the dialog first (`openSettings` and `closeSettings` in the fixtures; the eval runner and the flipbook tour click the gear). German has the new strings.

### Deviations

- **Live help stays on the Game tab.** It's part of setting up a game, and players change it during one. The plan had grouped it with the settings.
- **"Focus stays inside" is the browser's modal behaviour.** Tab moves through the dialog and then into the browser's own toolbar, never to the page behind. The test checks exactly that, rather than a hand-made focus trap.

---

## 2026-10-22 — Fix: a merge ran the boot twice; the language switch keeps the game

TODO items: fix for 1.15 and 10.8.1.

### Implementation notes

- **The bug:** merging the languages (#28) and the kept game (#31) left both versions of the boot code at the end of the page script. `start()` then ran a second time with no data and started a new game, so on main a reload lost the game again. No test caught it before merging, because each PR passed alone; the keep-game tests fail on the merged main.
- **The fix:** the old boot lines are gone, and the debug hook (`window.__kibitz`) is set once, with the language fields.
- **The language switch** no longer saves a running game to the library and asks first. The game now survives the reload (1.15), so the switch keeps the snapshot and reloads, and the game goes on in the new language. A duplicated, unticked TODO 1.15 line from the same merge is removed.
- **CI on main** was red from #30 on, for a second reason: on CI, Stockfish runs with one thread, so the engine's name shows without "· N threads", and the German test found that bare name untranslated. The engine's name is data now (`translate="no"`), and only "threads" is translated.
- **Tests:** the keep-game tests pass again on main. e2e `i18n.spec`: switching the language in a running game keeps the game going, and the engine's name is marked as data.

### Insights

- **Two PRs that each pass can still break main together.** CI runs on main after every merge and showed it, red after #30 and #31. Check that run before starting new work.
- **A test that only passes on one machine** depends on that machine, here the number of CPU threads. The German check now ignores the engine's name.

---

## 2026-10-22 — The game on the board survives a reload

TODO items: 1.15.

### Implementation notes

- **Before:** inside the Claude artifact, the host's snapshot (`window.claude.hot`) brought the game back after a reload. The local app (`just serve`) has no host, so every reload started a new game, and a running game was lost unless it had been saved to the library.
- **Now:** the snapshot the host takes (`snapshot()`: PGN, comments, game id, cursor, mode, colour, orientation, Elo, style, start ply, clock times) goes to `localStorage` under `kibitz.current` when there's no host.
  - It's written 400 ms after any change (`renderAll` and `renderMoves` schedule it, so every move, take-back, load and setting counts), and at once when the page is hidden or goes away (`pagehide`, `visibilitychange`).
  - `boot()` reads it back through the same `start()` the host uses. So a running game resumes with its clock, Stockfish moves if it was to move, and a loaded game comes back in analysis at the same move.
- **Details:**
  - An untouched start position isn't kept, so a new visit starts a new game as before.
  - The clock doesn't run while the page is closed.
  - With two tabs open, the last change wins.
  - A failed write (storage full) is announced once, instead of losing the game silently.
- **Tests:** e2e `keep-game.spec`: a reload in the middle of a game, which goes on afterwards; a timed game keeps its times; a snapshot saved with Stockfish to move makes it move; a loaded game comes back at the same move; an untouched start isn't kept.

### Deviations

- **A finished game also comes back after a reload,** in analysis, as inside the artifact. It's already in the library, and showing it again is what the host does too. The plan had said to clear the snapshot when a game ends.

### Insights

- **The artifact's snapshot was already the right format.** The work was to write it locally and read it back through the same `start()`, so both hosts restore a game the same way.
## 2026-10-21 — Paid runs ask first: `just eval` and `just flipbook`

TODO items: none (tooling). It goes with 2.11, the budgets for paid models.

### Implementation notes

- **The problem:** the eval and flipbook scripts call the AI provider in `.env` with its keys, a call per position or step. Earlier today, model variables set in the shell (Opus for the coach and the judge) cost about $2 that no one had agreed to, and 20 of those calls graded error messages.
- **The guard** (`site/scripts/paid.mjs`): once the gateway is up, and before the first call, both scripts print who answers, with which models (from the gateway's status, or the judge's config) and about how many calls.
  - With a paid provider (Anthropic, OpenAI, Mistral) as coach or judge, they stop there and send nothing. `--yes` (`just eval … yes=1`, `just flipbook … yes=1`) runs them.
  - Ollama, the in-browser model and the mock run without asking.
- **Stop at the first error:** the eval already stopped at a coach error; now a judge error stops it too. The flipbook stops at the first answer that is an error, so a bad key or a used-up budget costs one call.
- **Docs:** the examples in the justfile and in `site/eval/README.md` no longer suggest Opus. They use the models in `.env` and show the `yes=1` step.
- **Tests:** unit `paid.test`: what needs `--yes`, and the plan text. Both scripts were run against Anthropic without `--yes`: they printed the plan and sent nothing. The mock flipbook and the eval e2e test run as before.
## 2026-10-21 — Fix: a rejected request says why; no key fragments in the log

TODO items: fix for 2.x (the AI gateway's errors).

### Implementation notes

- **The bug:** with Ollama and a model pulled by an older Ollama (`deepseek-R1:latest`), the coach said "The coach couldn't answer just now", and Test connection said "Failed: The AI provider returned an error". Ollama's own reason, `"deepseek-R1:latest" does not support chat`, was dropped: every status the gateway didn't know (here 400) became the generic `provider_error`.
- **The fix:**
  - A rejected request (400) becomes `provider_rejected`, with the provider's reason in the message: "The AI provider rejected the request: …". The page shows that message in the chat and in Test connection.
  - `providerReason()` gives the provider's words as one short line, and replaces anything that looks like a key (`sk-…`, even masked) with "[key]".
  - The gateway's error log now uses it too. Before, a wrong OpenAI key put "sk-proj-***…sU5G" into the server log, against the rule that keys stay out of logs.
- **Tests:**
  - unit `ai.test`: a 400 with a reason maps to `provider_rejected` with that reason, and to `provider_error` without one; key fragments are cut and the length is capped.
  - e2e `coach.spec`: a rejected request shows its reason in the chat.

### Insights

- **The same model fails differently depending on the request.** Ollama answers the old model with 404 "not found" through the SDK's streaming request, but with 400 "does not support chat" through a plain one. Both now say what's wrong. The cure is `ollama pull deepseek-r1` again, or another model from `ollama list`.
## 2026-10-21 — Languages: English and German

TODO items: 10.8.1 (10.8 started).

### Implementation notes

- **The approach:** English stays the source, and a language is a dictionary from English text to its translation (`site/src/i18n.js`, `i18n-de.js`).
  - The page translates what it shows as it appears: the markup once at load, then every text node and every title, placeholder and aria-label added later, through a MutationObserver.
  - Code that builds text needed almost no change, and neither did the pure modules (`knowledge.js`, `tutor.js`, `modes.js`) whose sentences the page shows.
- **Templates:** a key is exact text or a template with `{placeholders}` ("{n} moves ready. …"). The parts are translated again, so sentences built from smaller pieces come out whole. Two extensions cover German grammar:
  - `{p|the *}` looks the part up inside a phrase, so "the knight" becomes "den Springer" and "knight move" becomes "Springerzug";
  - keys starting with "@" only translate parts, never whole text, so a loose connector like "{a} and {b}" can't half-translate an unknown sentence.
- **What stays as it is:** text inside `translate="no"`, which covers:
  - the board, the coach's answers (already German) and PGN comments;
  - player names, book titles and authors, opening names (eco.json is English), and model ids.

  Elements marked `data-raw` keep their attributes too, such as an opening name as a title. Text built from translated parts with numbers in German format (the token counts) is marked the same way.
- **The coach:** the prompts stay in English, which every model follows best, and a rule asks for the answer in German, using "du" and English move letters (`coachRules`). Comments are cached per language. The few moves an answer still writes with German letters (Sf3, Dxd5) become SAN before they're checked and shown (`germanSanToSan`), and so do moves typed that way. Game references in German answers link too ("die Opernpartie", "Morphy gegen den Herzog").
- **The switch:** a select in the header. The choice is saved and the page reloads. Without a saved choice, the browser's language decides.
  - Inside the Claude artifact, the host's snapshot brings the game back.
  - The local app can't resume a running game yet (new TODO 1.15). So the switch asks first, and saves the game in progress to the library as unfinished.
- **Tests:**
  - unit `i18n.test`:
    - the translator, German move letters and German speech;
    - the dictionary covers every text and attribute in the markup and every label the modules show;
    - each template's placeholders match its key;
    - the coach rule and the cache key.
  - e2e `i18n.spec`:
    - the switch, and a German move typed;
    - the coach asked for German, its German letters read as moves, a German game name linked;
    - every tab with a loaded game: with `?debug`, the page records each text it showed without a translation, and that list must be empty;
    - and back to English.

### Deviations

- **Moves keep the English letters,** as on Lichess, rather than K, D, T, L, S. German letters are read, not shown. Showing them, or figurines, as a setting is 10.8.2.
- **Opening names and the classics' PGN comments stay English** (10.8.3), as do book titles, which are published names.
- **The tutor eval set is English only** (10.8.4).

### Insights

- **Translating in the DOM beats rewriting every string.** The page builds its text in about 200 places, many of them sentences put together from module output. Matching the finished text against templates kept those places unchanged and made German a single file to review.
- **A debug list of untranslated text is the test.** Crawling the page in English with `?debug` gave the complete inventory to translate. The same list in German, empty, is the e2e check, and it found everything the first dictionary missed: titles echoed back by the observer, nodes replaced in the same tick, and opening names used as titles.
- **Grammar needs a little more than templates.** German case ("den Springer") and compounds ("Läuferzug") are handled by phrase lookups. Sentences joined with "; " are translated part by part.
## 2026-10-21 — Fix: the coach's context line with "Eval + mistakes"

TODO items: fix for 1.14.

### Implementation notes

- **The bug:** with the help level "Eval + mistakes", the eval bar showed the position after the player's move, but the context line above the chat said "eval hidden while you play". The line only knew two cases, the engine shown or not, and so contradicted the setting.
- **The fix:** one function, `evalNode()`, now decides which position's evaluation the player may see, for both the bar and the line. With "Eval + mistakes" the line says "eval after your first move" until the first move, and then something like "eval after your move 1. e4: +0.30 d14". With Off and Flag mistakes it still says the evaluation is hidden.
- **Test:** an e2e regression test in `play.spec` covers the line before and after the first move, and after switching to Flag mistakes.

### Insights

- **The bar and the text should be computed by the same function.** 1.14 added the new level to the bar's logic but not to the line that describes the bar.

---

## 2026-10-21 — Answers: wrong moves underlined, game references linked to the game

TODO items: 4.12.5, 4.12.6.

### Implementation notes

- **Wrong moves** (`.san.invalid`) are underlined in red (a 2px border in `--blunder`) instead of struck through, so the move can still be read. The note under the answer still counts them.
- **Game references:**
  - `classics.js` has a name list for each classic: its title ("the Opera Game", "Game of the Century", "Rubinstein's Immortal") or the players as a pairing ("Réti–Tartakower", "Anderssen vs. Kieseritzky").
  - `findGameRefs(text)` returns the matches in text order, without overlaps.
  - `keyPosition(Chess, id)` replays the game to its key moment and returns the FEN, the last move and a label such as "10. Nxb5".
- **In the page:**
  - `renderRich` turns each reference into a button styled as a link.
  - Hovering or focusing it shows the key position on the board, with a dashed frame and a caption. The game on the board isn't touched, and anything that redraws the board (`syncBoard`) ends the preview.
  - A click opens the game at that moment through `openGame`, which asks before leaving a running game.
- **Tests:**
  - unit `classics.test`: titles and pairings are found, while openings and names alone are not ("Philidor Defence", "Lucena and Philidor section", "Morphy's style"); every key position matches the library's position at that ply.
  - e2e `modes.spec`: hovering shows and ends the preview without changing the game, and a click opens the Opera Game at 10. Nxb5.
  - e2e `tutor.spec`: a wrong move is underlined, not struck through.

### Deviations

- **"Links to the original" means the game in our own collection, not an external site.** The link always leads to a game record we've checked with chess.js, and the page never builds a URL from model output. External sources (Wikipedia, a game database) could be added per classic as fixed links later.
- **Only the 13 built-in classics are recognised.** Games in the player's library or imported studies aren't, because their names (player pairings, events) are too ambiguous to match safely in free text.

### Insights

- **A name only links when it means one game.** "Philidor" alone is also an opening and "Lucena" a person, so they need "position" or "study" after them. For the same reason, "Rubinstein's Immortal" must not also match "Immortal Game".
- **The preview is a cheap version of ROAD's scratch board.** It borrows the board for as long as the pointer stays on the link. A variation stepper (4.3) can grow from the same `previewPosition` and `syncBoard` handover.

---

## 2026-10-21 — Tutor eval set: reference positions, scored by key points, move checks and an LLM judge

TODO items: 3.8; closes 2.16.2 (choosing the in-browser model).

### Implementation notes

- **The set** (`site/eval/positions.mjs`): ten positions, each with a quick-question chip and two to four key points. Every key point is one or more case-insensitive patterns, and all of them must match. The positions:
  - tactics: the Opera Game's Nxb5, the Qh5 threat on f7, the Qg5 double attack, the Elephant Trap, a back-rank mate;
  - plans: the d5 break in Steinitz–von Bardeleben, the Sicilian after 3. d4;
  - endgames: the opposition, Lucena, Philidor.

  We checked the key moves with Stockfish 19 at depth 18, so the key points agree with what the engine shows the coach.
- **The runner** (`site/scripts/eval.mjs`, `just eval ai=… judge=… model=…`):
  - serves the app with the chosen provider (or the in-browser model) and drives it headlessly with Playwright;
  - loads each position, waits for the analysis and asks through the chip, so the model gets exactly the prompt a player's question produces;
  - writes `docs/eval/<provider>-<model>.md` and `.json`, and regenerates the comparison table in `docs/eval/README.md`.

  The helpers for driving the coach moved from `flipbook.mjs` to `scripts/coach-page.mjs` and are shared.
- **Scoring** (`site/eval/score.mjs`, pure):
  - the share of key points hit;
  - the move check, using the app's own `checkAnswer` (TODO 3.4): it loses a third for each wrong move;
  - an optional LLM judge, which grades accuracy, insight, clarity and level from 1 to 5. The judge sees the coach's context (with Stockfish's lines as the truth), the question, the answer and the key points. The answer sits between data markers. The judge runs in Node, so keys never reach the page.

  The overall score is the mean of what was measured.
- **Errors aren't answers.** The app now marks a coach bubble that holds an error with `data-error="<code>"`, and the runner reads that code:
  - after a provider's rate limit, it waits a minute and retries, up to three times;
  - any other error stops the run without writing a report.
- **Tests:**
  - unit `eval.test`: every position sets up legally, the patterns compile, and the scoring and summary work;
  - e2e `eval.spec`: every position runs through the app with the mock provider. A provider error comes back as an error, not as an answer to score.

### Results (judge: Claude Opus 5.5)

| Coach | Overall | Key points | Judge |
|---|---|---|---|
| Claude Opus 5.5 | 95% | 97% | 88% |
| Claude Haiku 5.5 | 79% | 76% | 64% |
| Qwen2.5 1.5B, in the browser | 50% | 38% | 11% |
| Qwen2.5 0.5B, in the browser | 42% | 23% | 3% |

Not one of the four runs named a move that chess.js or the engine lines contradicted, except one in the Haiku run.

### Deviations

- OpenAI and Mistral have no results yet. The OpenAI key in `.env` was refused (401), and Mistral rate-limited every request. Those first runs were scored as if the error messages were answers, which is how we found the error handling was missing. We deleted those reports. Re-run them once the keys work: `just eval openai judge=anthropic`.
- The runner doesn't record token usage. A full run with the judge costs ten calls to the coach and ten to the judge.

### Insights

- **The engine grounding works, but explaining is the hard part.** Even the 0.5B model rarely names a wrong move, because it copies Stockfish's lines. What the small models can't do is say *why*, and the judge scores insight lowest.
- **2.16.2:** the 1.5B model stays the default in the browser, being clearly better than 0.5B. It's a fallback for offline and private use, not a substitute for a cloud model. A 3–4B model is worth evaluating once WebGPU memory allows.
- **Haiku misses endgame theory.** It didn't mention the opposition in the king-and-pawn position, and the judge confirmed it. The retrieved classics (3.2.5) include the endgame studies, but no king-and-pawn opposition example yet, so that's where to add one.
- **Key points have to follow the engine, not the textbook.**
  - In the Lucena position, Opus followed Stockfish's line, 1. Rb1 and 2. Rd1+, then the king walks out, and never built the textbook bridge on the fourth rank. Its answer is correct, but it misses that key point.
  - A key point that the engine's line doesn't need measures book knowledge, not coaching. That's why the judge, with Stockfish's lines as the truth, stays part of the score.
  - Matching by regex is cheap but coarse, so each report keeps the judge's notes beside it.

---

## 2026-10-21 — Classic games for the coach: a first collection, retrieved by theme

TODO items: 3.2.5 (and 3.2); started 7.3 and 7.4.

### Implementation notes

- **The collection.** `classics.js` is pure data and retrieval, like `knowledge.js`. It holds:
  - nine games: the Opera, Immortal and Evergreen games, the Game of the Century, Réti–Tartakower, Légal's mate, Lasker–Thomas, Rotlewi–Rubinstein and Steinitz–von Bardeleben;
  - four studies: Réti's king march, Saavedra, Lucena and Philidor.

  Each has tags from the `TAG_LABELS` vocabulary, a one-line lesson, the ply of its key moment, and comments we wrote ourselves. The two games that were hard-coded as library examples are now the first two entries.
- **Retrieval** (`retrieveClassics`) scores each game by the weights of the position's features that match its tags, so the opening family and the motifs in the best move count most. This complements `similarPositions`, which only finds the same position or pawn structure, and which a classic rarely shares with the player's game.
- **Where it shows:**
  - The coach's context lists up to two classics on the position's themes. The "Similar games" aspect now asks about them too.
  - The Reading tab gains "Classic games on these themes", with an Open button that loads the game at its key moment.
  - The library gets a Classics filter. "All" shows the player's own games, and the classics only while the library is empty or during a search, so 13 built-in entries don't bury the player's games.
- **Tests:**
  - unit `classics.test`: every score loads in chess.js with every move legal; games ending in "#" are really mate, and the mated side lost; key moments lie within the game; tags are known; the famous finishes are in place; retrieval ranks by theme.
  - e2e `modes.spec`: a Caro-Kann finds Réti–Tartakower in the Reading tab, which opens at 9. Qd8+; the coach's context lists classics; the library filters work. The smoke and regression tests now expect 13 built-in games in an empty library.

### Deviations

- **The scores were written from memory.** chess.js can prove every move legal and every final mate real, but not that a game was played exactly so. The collection is small and limited to the most-published games. A larger one needs sources and licences per item (7.1).

### Insights

- **Position matching rarely finds a classic.** An exact position or pawn structure is a strong signal, but too rare to catch most games; tags by theme and opening family find a classic for most positions.

---

## 2026-10-21 — Explanation modes: commentary, challenges, interesting moves

TODO items: 3.9 (3.9.1–3.9.5).

### Implementation notes

- **Modes** (`tutor.js`). "How the coach works" in the Coach tab has five modes:
  - Only when asked (3.9.1);
  - After my mistakes;
  - After my moves;
  - Commentary on every move (3.9.2);
  - Challenge me (3.9.3).

  `shouldComment` lets commentary cover both sides' moves, including a loaded game's as you step through it. In a game the comment still gets only the view the help setting allows (`engineView`), and with help off there is no commentary. Comments use the quick model and the comment cache (3.7).
- **Interesting moves** (`modes.js interestingMoves`, 3.9.4):
  - Two settings: the analyst's line count (3–5, MultiPV) and a window of 0.5, 1 or 2 pawns from the best move.
  - Lines within the window are described from the board and the engine's own line:
    - **sacrifice:** material given up within four plies, or a piece offered that the line takes;
    - **trap:** a piece left to be taken that the engine's line doesn't take, counted net of what the move itself captured and of recaptures;
    - **different plan:** another piece, on another wing, than the best move;
    - **quiet move:** shown only when the best move is forcing.
  - The Coach tab lists the best move and the picks, with rank, evaluation and the gap to the best. Hovering one draws it on the board.
  - The coach's context gets the same picks (`interestingLines`), and a quick chip, "Other good moves", asks about them.
  - All of this only when the evaluation may be shown.
  - The analysis cache now re-runs a position when it holds fewer lines than the setting asks for.
- **Challenges** (`modes.js makeChallenge`, `checkChallenge`):
  - **Best move:** any move within 30 cp counts; only mating moves count when the best one mates.
  - **The better of two:** the best move against one at least 80 cp worse, shown as option chips.
  - **The threat:** the position with the other side to move (`flipSide`; not when in check). It needs a concrete threat: a mate, or two pawns of material won along the opponent's line.
  - **Answering:** chips, or typed into the composer through the typed-move parser, so "ra8" and "0-0" work. Anything that isn't a legal move leaves the challenge open. "Show me" reveals the answer.
  - **What follows:** only after the engine's verdict does the coach explain, if a model is set up. Challenges work without one too.
  - **Where:** in challenge mode the coach asks after each move in analysis, and in a game with Full engine help after Stockfish's reply. The "Challenge me" chip asks at any time.
  - **Progress:** results per theme (the motif of the answer move, else "calculation") are kept in the browser (`recordResult`) and shown in the Coach tab.
- **Tests:**
  - unit `modes.test`: tags on fixed lines, the window, Black's scores, each challenge kind and its checks, flipped positions, progress;
  - `tutor.test`: commentary;
  - e2e `modes.spec`: commentary on a loaded game, the interesting-moves list and the line setting, a challenge answered by chip, by typing and with an illegal move, and challenge mode asking by itself.

### Deviations

- **Challenges stay out of games** unless help is Full engine. Asking for the best move or the threat would otherwise hand out engine help the player switched off.
- **"Trap" is a heuristic.** It marks a piece offered that the engine's own line doesn't take: what looks free to a human, not proven to lose for whoever takes it.

### Insights

- **The first threat test was wrong.** It judged a threat by how much the opponent's evaluation improves if they could move now. When the side to move has mate in one, every opponent move looks like a huge "threat". A threat has to be concrete: a mate, or material won along the opponent's line.
- **A trade isn't a sacrifice.** Material has to be counted across the whole exchange: Bxf6 Qxf6 is even, while Nxb5 cxb5 Bxb5+ leaves a knight for two pawns.
- **Evaluations need a side.** "+4.81" for a threat confused even me. Challenge evaluations now always say for whom ("it would give Black +4.70").

---

## 2026-10-21 — Usage and budgets per user for paid models; tokens and cost on every answer

TODO items: 2.11 (budgets and display per user; still open: a per-user rate limit, accounts, persistence).

### Implementation notes

- **Users without accounts.** The gateway gives each browser a random `kibitz_uid` cookie (128 bits, `HttpOnly`, `SameSite=Strict`, path `/api/`) on its first API request, and counts by it (`api.mjs userOf()`).
- **`userLedger()`** (`usage.mjs`) keeps each user's day: requests, tokens in and out, and the cost from `AI_PRICES`.
  - **Limits for paid models only:** `AI_TOKEN_BUDGET_PER_USER_PER_DAY` and `AI_COST_BUDGET_PER_USER_PER_DAY` (US dollars).
  - "Paid" means a provider that isn't local. Ollama, the in-browser model and the mock are counted but never limited.
  - **A spent budget** returns 429 `budget_exceeded`, with a message the dialogue shows as is: what was used, that it resets at midnight, and that local models still work.
  - Users roll over at midnight, and at most 10,000 are kept, the oldest dropped first.
- **The server-wide ledger** (`AI_TOKEN_BUDGET_PER_DAY`) still counts everything and caps the total.
- **API:**
  - `/status` gains `user` and `paid`.
  - The stream's `done` line carries `usage` with the request's `cost`, and the user's totals.
  - `/structured` and `/test` return the same.
- **Page:**
  - Under each coach answer and comment: "720 + 29 tokens · $0.0026".
  - Under the composer: "You today: 2 answers, 1,531 tokens, about $0.0053", plus what's left of the budgets when the provider is paid.
  - The coach settings show the server's day and the user's.
- **Tests:**
  - Unit (`usage.test`): `costOf`, per-user totals, both budgets, unpriced models, the day rollover, the cap on users.
  - API (`api.test`): the cookie, per-user budgets enforced for a paid provider and not for a local one, the cost budget.
  - e2e (`coach.spec`): the note under each answer, the running total, and a spent budget's message.

### Deviations

- **No per-user rate limit yet.** The per-minute limit is still server-wide.
- **Soft per-user budgets.** Until there are accounts, clearing the cookie starts a new day; the server-wide budget is the hard cap.
- **Usage lives in memory,** like the server ledger, so a restart resets it.

### Insights

- **A comment can hide part of a config line.** Adding `AI_PRICES` to the one-line env object in `playwright.config.mjs` with a trailing `//` comment silently commented out the blanked API keys after it. The test server then saw a key from the shell. A test caught it, because a provider button was enabled that should have been disabled. No real request went out, since the provider stayed `mock`. The fix is an inline `/* */` comment, checked by loading the config.

---

## 2026-10-21 — Help level "Eval + mistakes"; the hidden eval bar no longer leaks its score

TODO items: 1.14 (added).

### Implementation notes

- **A fourth help level.** The order is now Off, Flag mistakes, **Eval + mistakes** (`help: 'eval'`), Full engine.
  - Mistakes are flagged, as with Flag mistakes.
  - The eval bar shows the position after the player's last move (`lastOwnMove()`). Its tooltip reads "Stockfish after your move 1. e4: +0.3".
  - The best-move arrow stays hidden.
  - `engineView` maps the level to `'past'`, so the coach sees what it sees with Flag mistakes.
- **The bar holds through Stockfish's reply.** It shows the position after your move until you move again, and live analysis of later positions is ignored. If it followed the board, a sudden jump after the reply would tell you the engine had blundered and a tactic was waiting.
- **Fix:** while the evaluation was hidden, the bar's tooltip still showed the score ("Stockfish: +0.29"). It now reads "Engine evaluation: hidden while you play".
- **Tests:**
  - e2e in `play.spec`: the bar is hidden before your first move, then shows "after your move 1. e4" once Stockfish has replied, with no best-move arrow.
  - e2e regression: the hidden bar's tooltip has no score.
  - Unit test in `tutor.test`: `engineView` with `'eval'`.
  - Both e2e tests fail on the previous build; the tooltip test receives "Stockfish: +0.29".

### Insights

- **Hiding has to cover every surface.** The bar's height was hidden, but its tooltip, added when the bar got too narrow for a number, still showed the score.

---

## 2026-10-21 — Flipbook: the Opera Game, explained by Claude; the chat knows the review

TODO items: none (docs). It adds to 4.6, the chat's context: the review's findings go into it.

### Implementation notes

- **The tour** (`site/flipbook/tour.mjs`) is now one story: Morphy's Opera Game, in 11 steps.
  1. The coach explains the plan after 9. Bg5.
  2. It proposes its own move for Black, and compares it honestly with the engine's lines.
  3. It explains the 10. Nxb5 sacrifice, then why taking the knight still loses.
  4. The review shows the evaluation graph and the turning points.
  5. The coach reads the graph, explains the 9… b5 turning point, and writes the summary and a study plan.
  6. You play 10. Nxb5 yourself against Stockfish, and the coach comments.
- **The runner** (`site/scripts/flipbook.mjs`):
  - New acts: `ply`, `askBy`, `capture`, `hover` and `move … comment`.
  - The README quotes every answer under its screenshot, with wrong moves struck through, and counts the moves the engine backs, the legal moves it doesn't list, and the wrong ones.
  - `--ai anthropic` (or another provider) picks the provider, with its key from `.env`. Model variables set in the shell take precedence over `.env`. The README names the model for each task.
- **Rendering:** with Claude Opus 5.5 for every task: `ANTHROPIC_MODEL=claude-opus-5-5 ANTHROPIC_MODEL_QUICK=claude-opus-5-5 ANTHROPIC_MODEL_REVIEW=claude-opus-5-5 just flipbook anthropic`. One run takes about 3 minutes and 11 requests.
- **The chat knows the review.** After a review, `contextFor()` adds `reviewFacts()`:
  - the accuracies and counts;
  - the evaluation after every move (what the player sees as the graph);
  - the turning points, with the better move and its line.

  `turningPoints()` is shared with the summary prompt.
- **The answer check** knows the same facts. `checkAnswer` takes `extra` lines in SAN, and after a review `checkFor` passes the turning points' better lines and counts the game's moves to the end.

### Deviations

- The flipbook is no longer a tour of every tab. The settings, the phone layout and dark mode are left out, so that it can show what the model adds.

### Insights

- **The first render exposed a gap.** Asked to read the evaluation graph, Claude answered that it couldn't, because the chat never received the review's findings. Only the summary prompt had them.
- **Then the check went wrong.** Once the findings were in the chat's context, the check struck through correct moves: the turning points' better lines (from other positions), and game moves after the position on the board. Context and check have to grow together.
- **The model matters.** With `claude-haiku-5-5`, the default, the answers were thinner and sometimes misleading ("Black's queen is gone" for a queen trade). With Opus, the coach proposed 9… h6 as its own idea, found the catch itself (the queen on f6 no longer guards b7), and said it couldn't evaluate the move. The check marked its untested line "Bxf6 Qxf6" as not one of the engine's.
- **What the coach sees in a game matters too.** With help on "Flag mistakes", the comment on 10. Nxb5 said it "won a pawn": true from what the coach was shown, but misleading. The last step uses "Full engine".
- **Comments stream without the Stop button,** so the runner also waits until the answer's text stops changing.

---

## 2026-10-21 — Flipbook: a happy path through the app in screenshots

TODO items: none (tooling for the docs, modelled on the demo flipbooks of the OrgFab workbench).

### Implementation notes

- `just flipbook` builds the site, then runs `site/scripts/flipbook.mjs`. The runner:
  - serves `site/dist` with the gateway on port 8797;
  - drives the page in a headless Chrome through Playwright;
  - writes one whole-page screenshot per step and a `README.md` into `docs/flipbook/`.
- `site/flipbook/tour.mjs` is the single source of truth: 15 steps, each with a title, a caption and declarative acts (`tab`, `click`, `fill`, `range`, `move`, `ask`, `confirm`, `waitFor`, `wait`, `scroll`, `viewport`, `scheme`, `js`).
- The path:
  1. a game against Stockfish at 1200, with "Flag mistakes";
  2. a hint;
  3. a quick question and a typed question to the coach;
  4. resignation, with the game saved;
  5. the Opera Game loaded for analysis at 10. Nxb5;
  6. the review and the coach's summary;
  7. the library, the reading list and the coach settings;
  8. a phone width and dark mode.
- `move` acts take a list of moves and type the first legal one, because Stockfish's replies vary between runs. `ask` clicks the quick-question chip with that label, or else types the question, and waits until the answer has finished streaming.
- The coach uses the provider in `.env` by default, like `just serve`. `just flipbook mock` blanks the keys and uses the mock provider. The README states which provider answered.
- Uncaught page errors and CSP violations fail the run, as in the e2e tests.

### Deviations

- The OrgFab flipbooks keep their capture tooling in a separate npm package. Here it reuses `@playwright/test` from `site/`, so no new dependency is needed.

### Insights

- Screenshots of the viewport cut off the move list and flags under the board, so the runner takes whole pages.
- The toast lasts 2.2 s. A step that triggers one waits for it to fade before its screenshot, so it doesn't cover the controls.
- The tour's selectors (`#coachChips`, `#chat`, `#coachInput`, the tabs) work with both layouts, the chat in the Coach tab and the dialogue beside the board (4.9.2). The tour produced all 15 steps on each.
## 2026-10-21 — PDFs of the Markdown documents

TODO items: none (tooling for the docs, adapted from the OrgFab repo's `just pdf` and `just pdfs`).

### Implementation notes

- `just pdf FILE` turns one Markdown file into an A4 PDF next to it, keeping the full name (`docs/ARCH.md` → `docs/ARCH.md.pdf`):
  - pandoc writes a standalone HTML page, with images embedded and math as MathML;
  - headless Chrome prints that page to PDF.
- `just pdfs [PATHS]` does it for every Markdown file that git tracks or would track. It skips `CLAUDE.md`, which only points at AGENTS.md, and `.github/`.
- The typography is in `docs/pdf/style.css`: a serif body, sans headings and tables, Menlo for code. Task lists (TODO.md) get checkboxes. Screenshots scale to the column, and in print to the page height.
- Documents with ```` ```mermaid ```` blocks (ARCH.md) also get `docs/pdf/mermaid.html`. pandoc downloads Mermaid 11.4.1 from jsDelivr and embeds it, and Chrome draws the diagrams before printing.
- Builds are incremental. `.pdfstamps/` keeps a hash of the source and build inputs, and of the PDF produced, so unchanged files are skipped. A second `just pdfs` skipped all 9 documents.
- `*.md.pdf` and `.pdfstamps/` are ignored by git.
- `CHROME=/path/to/chrome` picks another browser; the default is the macOS Chrome.

### Deviations

- The OrgFab version also renders its own specification languages (L3, L4) and their syntax highlighting. Kibitz has neither, so that part is left out. Mermaid support is new.
- Input is GitHub-flavoured Markdown (`-f gfm+tex_math_dollars`), so task lists and tables come out as on GitHub.

### Insights

- pandoc writes a Mermaid block as `<pre class="mermaid"><code>…</code></pre>`. Mermaid reads the `<pre>`'s markup, so the script first replaces it with its plain text.
- Building a document with diagrams needs the network once per build, for the Mermaid download. Without diagrams, building needs no network.

---

## 2026-10-21 — The dialogue beside the board

TODO items: 4.9.2 done; 4.9.3 partly.

### Implementation notes

- **The dialogue moved out of the Coach tab** to the top of the right-hand column. It holds:
  - the context line;
  - the in-browser model box;
  - the chat;
  - the Comment button with the quick chips;
  - the input.

  It is visible whichever tab is open. On wide screens it is exactly as tall as the board column from its top to the "You" row: a `ResizeObserver` on the board sets `--board-h`. On a phone it comes after the board and the move list, at most 75% of the screen high.
- **The tab panels below fold away** with a toggle at the start of the tab bar. The choice is remembered, and clicking any tab opens them again. The toggle is not a tab: the tab code now selects `[role="tab"]`, and the toggle's `aria-controls` lists the panels.
- **The Coach tab keeps the coach's settings:** the aspects, when to comment by itself, the provider.
- **What the dialogue replaces:** the comment box under the board and the dot on the Coach tab (from the tutor work) are gone. Automatic comments appear in the dialogue, which is always in view. Asking the coach no longer switches tabs.
- **Tests:**
  - `layout.spec` (3): beside the board and level with it across tabs and window sizes; folding, remembered over a reload, any tab reopens; the phone layout without sideways scrolling.
  - The tutor test now finds automatic comments in the dialogue.

### Deviations

- **No drawer on phones.** The dialogue simply follows the board. A drawer would cover the board, which is what the player is looking at.

### Insights

- **Tests that click below the fold need the board scrolled back into view.** The Game panel now sits under the dialogue, so tests that pick an option there scroll the page. chessground forgets its cached board position on the scroll event, which only fires on the next frame. A click right after scrolling went to the old coordinates and was lost: flaky, 2 of 3 runs. `move()` in the fixtures now scrolls the board into view and waits two frames. People can't click within a frame, so the page itself is fine.

---

## 2026-10-21 — Offline mode: a small model in the browser

TODO items: 2.16.0, 2.16.1, 2.16.3–2.16.6 done; 2.16.2 partly (model choice with the eval set, 3.8).

### Implementation notes

- **`just offline`:**
  - `scripts/fetch-model.mjs` downloads the chosen model once into `site/models/` (git-ignored) and checks its size and SHA-256 against the catalog in `server/models.mjs`. A marker file records the passing check, so later runs and server starts don't hash a gigabyte again.
  - It then serves with `AI_PROVIDER=browser`, `AI_LOCAL_ONLY=1`, no `.env` (`--env=`), `--models site/models` and `--offline`.
  - `just serve` also passes `--models`, so a downloaded model shows up there as "In browser".
- **Catalog:** two models, both Apache-2.0 and pinned by size and SHA-256 from the Hugging Face metadata:
  - Qwen2.5 1.5B Instruct Q4_K_M (1.12 GB), the default;
  - Qwen2.5 0.5B Instruct Q4_K_M (0.49 GB): `just offline qwen2.5-0.5b`.
- **Server:**
  - The gateway has a `browser` provider. It's local, so local-only mode allows it and falls back to it after Ollama.
  - The gateway never runs it: a request to it there fails with `in_browser`.
  - `/api/ai/status` tells the page where the weights are (`browser: {url, name, bytes}`).
  - `serve.mjs --models DIR` serves only the catalog's `.gguf` files, with an ETag, never a listing.
  - `--offline` drops the Google Fonts links from the page, and the CSP then allows no other host at all.
- **Runtime (`src/browser-llm.js`):** wllama 3.8.1 (MIT, llama.cpp) runs the GGUF model on WebGPU, or in multi-threaded WebAssembly on the CPU, inside its own worker. The build copies `wllama.js` and `wllama.wasm` into `dist/`, and the page imports them only when the model is first needed. `createBrowserModel()`:
  - loads on first use, with progress;
  - streams answers, cancels through the abort signal, and turns a JSON schema into `response_format`;
  - runs one request at a time;
  - joins consecutive messages of one role, for the chat template;
  - unloads after ten idle minutes;
  - refuses to load when `navigator.deviceMemory` says the model won't fit.
- **Page:**
  - **Coach settings:** "In browser" is a provider like the others. A box above the chat shows the model, its size and state, with Load and Unload. Nothing loads until the player presses Load; the consent is remembered.
  - **Routing (2.16.5):** a setting sends only quick requests (chips and coach comments) to the in-browser model, everything else to the gateway.
  - **Connection test:** for the in-browser model it runs in the page.
- **Stockfish and the model share the CPU (2.16.4).** While the model generates on the CPU, the analyst gets fewer threads (`Engine.limitThreads`, applied between searches, never during one). On WebGPU it keeps them all.
- **Tests:**
  - Unit tests:
    - `browser-llm` (11): loading once, streaming, cancelling, one request at a time, idle unload, threads, memory check, storage fallback;
    - `models` (3): catalog, download check, servable files;
    - `serve` (2): offline page and CSP, model files only;
    - the `browser` provider in `ai.test`;
    - `Engine.limitThreads`.
  - Playwright `offline.spec` (3), with a fake `wllama.js`: consent, loading, an answer from the page with no request to the server, the connection test, unload; routing; local-only.
  - `offline-live.spec` runs the real model only with `KIBITZ_LIVE_MODEL=1`. It passed with both models. Each loaded and answered on WebGPU, and the page made no http(s) request to another host.

### Deviations

- **wllama only, not WebLLM first (2.16.1).** wllama has run on WebGPU since v3, with WebAssembly as its own fallback. One MIT dependency with one wasm file covers both paths and loads any GGUF file from our server. WebLLM would need its own compiled model libraries and a second runtime. Chrome's built-in model is still open.
- **Not in our Worker.** wllama starts its own worker (from a blob URL, allowed by `worker-src blob:`), so the page-side provider doesn't need one.
- **Model chosen before the eval set exists.** Qwen2.5 is well known, Apache-2.0, has no "thinking" mode to switch off, and has official GGUF files. 3.8 should decide between it and newer small models. Adding one is a catalog entry.

### Insights

- **The browser's storage quota is the real limit, not memory.** wllama always downloads into the browser's private storage (OPFS), even with `useCache: false`. A 1.1 GB model failed in the test browser with "exceed its storage quota", as it would in a private window. The page now checks `navigator.storage.estimate()` first: when the model doesn't fit, or caching fails on the quota, it fetches the file itself and hands it to wllama in memory. The 0.5 GB model fit either way, which is why only the default model showed the problem.
- **Quality follows size.** On the same coach prompt:
  - the 0.5B model suggested "developing the rook on h8" in the starting position;
  - the 1.5B model said to develop pieces and control the centre.

  The answer check (3.4) marks wrong moves either way. A small model is fine for putting the engine's facts into words, not for chess judgement.
- **Speed on WebGPU (Apple silicon, Chrome):** a full coach answer to a 2,950-character prompt took about 4 s with the 0.5B model.
- **A test that waits for the "thinking" style to go reads a half-streamed answer.** It disappears with the first chunk; the Stop button only disappears at the end.

---

## 2026-10-21 — Tutor commentary: aspects, templates, checked answers, when to comment, cache

TODO items: 3.2.1–3.2.4, 3.3, 3.4, 3.6, 3.7 done; 3.2.5 partly.

### Implementation notes

- **`site/src/tutor.js`** (new, pure, unit-tested) holds the tutor logic. The page only wires it up.
- **Aspects and templates (3.2, 3.3):**
  - The five aspects are Last move, What's next, Keep in mind, Good habits and Similar games. Each has its own instruction.
  - `commentRequest()` asks for them in a fixed order, under a word limit.
  - `COACH_RULES`, the shared rules that used to be the page's `RULES`, now also say that every move or line must come from the engine lines or the game, and that unbacked moves are marked for the player.
  - The Coach tab has an aspect picker and a "Comment on this position" button. The choice is saved with the other settings.
- **"Keep in mind" data:** `safetyNotes()` lists, straight from the board:
  - pieces attacked and not defended;
  - pieces attacked by something cheaper;
  - loose pieces (no defender);
  - castled kings with fewer than two shield pawns.

  These go into every coach context as "Keep in mind (from the board)".
- **No spoilers mid-game (3.6):** `engineView()` decides what the coach may see.
  - **'all':** analysis, a finished game, or help "Full".
  - **'past'** (help "Flag mistakes"): how the player's own moves rated and what was better then, but not Stockfish's view of the current position.
  - **'none'** (help "Off"): no engine data at all.

  `contextFor(i, { view })` follows it, for every coach request, including typed questions. The aspects that need the engine's view of the position (What's next) are left out mid-game, and the picker says so.
- **When to comment (3.6):** the choices are "Only when asked" (the default), "After my mistakes" and "After every move".
  - `shouldComment()` allows comments only on the player's own moves, which are marked `byUser` when played on the board. Loaded games are never commented on by themselves. With help Off, the coach never comments by itself.
  - Each move is commented on at most once.
  - An automatic comment shows under the board, as well as in the chat, and the Coach tab gets a dot.
- **Checked answers (3.4):** `checkAnswer()` sorts every move-like token:
  - **in Stockfish's lines:** for this position or the one before;
  - **a game move;**
  - **legal but unchecked:** legal here or one move earlier, but in no engine line;
  - **invalid:** none of these;
  - **a square:** "the knight on f3" names a square, not a move.

  It also checks two kinds of claims:
  - Moves separated only by spaces and move numbers are read as a line. That line must be a contiguous run of an engine line or of the game, or the moves after the matching part are invalid.
  - "Bishop on b5"-style claims are checked against the board now and one move before.

  The chat and the comments strike through invalid moves, grey out unchecked ones (a tooltip gives the reason), and add a note when something is wrong.
- **Cache (3.7):** `commentKey()` combines the EPD, the move that led to the position, the aspects, the engine view, the level and the model. A 100-entry LRU keeps the comments in local storage, so they survive a reload. A repeat shows "(saved)" and costs nothing. Comments use the quick model.
- **Tests:**
  - 15 unit tests: aspects, views, templates, when to comment, safety notes, the answer check (including sentence breaks and squares), the cache.
  - 4 Playwright tests: the picker and the cache across a reload; a faked answer with an illegal move and a wrong piece claim; automatic comments without spoilers; silence with help Off.

### Deviations

- **Flagged, not dropped (3.4).** Removing text from an answer would change what it says. Marking it and telling the player keeps the coach honest, and the player can still read the rest.
- **The review summary isn't checked.** It talks about many positions at once, so a check against one position's lines would mark correct moves. It still gets the shared rules.
- **3.2.5 uses the player's library.** The classic games collection (7.3) doesn't exist yet. The Similar games aspect uses the similar positions already retrieved from the player's library and the built-in examples.
- **No threat search.** "What's next" uses the engine's top lines and the motif detectors. A separate null-move search for threats is part of the engine tools (4.11).

### Insights

- **A full stop looks like a move number.** The first version read "Start with e4. Qh5 wins" as the line 1. e4 Qh5 and flagged it. Only whitespace and real move numbers ("2.", "12...") join moves into a line now.
- **The checker needs the same tokens as the renderer.** Bare squares stay in its output with status "square", so the page can match each mark to the move it renders, in order.

---

## 2026-10-21 — CI: secret scan permissions

TODO items: 0.8 (fix).

### Implementation notes

- The first CI run (PR #11) failed the secret scan with a 403 before scanning anything. On a pull request, gitleaks-action lists the PR's commits through the GitHub API, and the workflow token was limited to `contents: read`. The `secrets` job now also has `pull-requests: read`, and PR comments are off (`GITLEAKS_ENABLE_COMMENTS: false`), so the token stays read-only. A finding still fails the job.

### Insights

- CI ran only on the PR into `main`. The stacked PRs #2–#10 (based on feature branches) never created a workflow run.

---

## 2026-10-20 — Eval bar: narrower, and it turns with the board

TODO items: none (a fix from use; the bar came with the prototype, 1.5).

### Implementation notes

- The bar is 8px wide instead of 30px (`.boardwrap` in `site/src/index.html`).
- With the board flipped, White's part grows from the top, so it's always on White's side. `syncBoard()` sets the `flipped` class from `S.orientation`, the same place the orientation goes to chessground, so every way of turning the board (the flip button, starting a game as Black, loading a game) updates the bar.
- Regression test in `tests/e2e/regressions.spec.mjs`: the bar is at most 10px wide, and at 50% the white part touches the bottom end, then the top end after a flip, then the bottom again. Both checks fail on the old code.

### Deviations

- The score label inside the bar is gone: a number doesn't fit in 8px. The score stays in the bar's tooltip and in the Coach tab's context line ("eval +0.3 d14").

---

## 2026-10-20 — AI provider layer: interface, structured output, models, limits, settings, contract tests

TODO items: 2.2, 2.7, 2.10, 2.14 done; 2.11 and 2.15 partly.

### Implementation notes

- **Provider interface (2.2):** every provider has `chat(messages, {model, system, maxTokens, schema, signal})`, an async generator of text chunks.
  - It returns `{truncated, usage}`. Anthropic's usage includes cached input; OpenAI and Ollama are asked for a usage chunk (`stream_options`); Mistral sends one unasked.
  - `complete()` collects a whole reply.
  - `embed(texts)` covers OpenAI, Mistral and Ollama, configured by `EMBEDDING_PROVIDER` and `EMBEDDING_MODEL` with that provider's key and Ollama host allowlist. It sends one plain POST to `/embeddings` and keeps the vectors in input order. The default models are text-embedding-3-small and mistral-embed; Ollama needs one set.
- **Structured output (2.7):** `POST /api/ai/structured {messages, format}` takes a named format (only `annotations` so far) and returns `{data, truncated, usage, mode}`.
  - The annotation schema has a short text, up to 8 arrows (from, to, kind) and up to 16 highlighted squares.
  - Anthropic gets `output_config.format` (json_schema). OpenAI, Mistral and Ollama get `response_format` (json_schema, strict).
  - Keywords that strict modes reject (lengths, patterns, item counts) are left out of what the provider sees and enforced by our own validator (`server/schema.mjs`).
  - If the provider rejects the format (400/422) or the reply doesn't validate, the request is retried once with the schema in the instructions, and the JSON is parsed out of the text (code fences, surrounding prose).
- **Models per task (2.10):** `quick` (the quick-question chips), `chat` (typed questions, flags) and `review` (game summary, study plan).
  - `<PROVIDER>_MODEL_QUICK` and `_MODEL_REVIEW` fall back to `<PROVIDER>_MODEL`.
  - The page names the task in each request. Unknown tasks are refused, and the artifact host's `sample()` doesn't get the option.
- **Limits (2.11):** `server/usage.mjs` counts requests and tokens per day.
  - `AI_TOKEN_BUDGET_PER_DAY` refuses requests with `budget_exceeded` (429) once it's used up.
  - `AI_PRICES` gives per-model prices for a cost estimate. Models without a price are counted in tokens only, and a day with no priced model shows no cost rather than $0.
  - The status endpoint reports today's usage.
- **Settings (2.14):** a "Coach settings" panel in the Coach tab, shown only with the local gateway.
  - You can switch among the providers `.env` sets up; unavailable ones are disabled and say why.
  - It shows the model per task.
  - Local-only mode is enforced on the server: only Ollama or the mock, with Ollama taking over if it's set up. `AI_LOCAL_ONLY` makes it the default.
  - "Test connection" sends a 256-token request and reports provider, model and time.
  - It shows today's usage.
  - `POST /api/ai/config` and `/api/ai/test` have the same origin, host and content-type checks as the other routes. Changes last until the server restarts.
- **Contract tests (2.15):** the real Anthropic and OpenAI SDK clients get a `fetch` that replays `server/fixtures/*.json`, so the tests cover the SSE wire format, the SDKs' parsing and our adapters together. They check the requests we send too.
  - `scripts/record-ai-fixtures.mjs <provider>` records real responses: two small requests per provider, keeping only status, content type and body. Headers are dropped because they carry account ids; the request isn't kept because it carries the key.
  - The Claude chat and annotation fixtures are recorded: 73 and 943 tokens on claude-haiku-5-5.
  - OpenAI, Mistral, Ollama and the error responses are hand-written from the documented format, and marked so in the file.
  - `server/live.test.mjs` runs a chat and an annotation request per provider, only with `KIBITZ_LIVE_AI=1` (`npm run test:live`).
- The Playwright server now blanks the provider keys it inherits from the shell, so no test can reach a real provider. One key in the shell environment was visible to the test server before this; no test used it.

### Deviations

- **No `stream` flag on `chat()`:** it always streams, and `complete()` collects the reply when a caller wants it whole.
- **Structured output uses JSON-schema output, not tool calling**, on every provider. It's the same mechanism everywhere, and no tool is involved.
- **Formats are named on the server.** The page can't send its own schema, which keeps model output bounded to what the server validates.
- **No built-in price list.** Prices change and I couldn't verify current ones, so cost needs `AI_PRICES`.
- **Usage, the budget and settings changes live in memory** and reset when the server restarts.
- **2.11 per-user limits and 2.9's per-user key store** wait for accounts (10.1).
- **2.15 stays open** until OpenAI, Mistral and Ollama fixtures are recorded.

### Insights

- **Claude's structured output accepts the stripped annotation schema natively.** The recorded reply validated first time, so the fallback is for the OpenAI-compatible servers whose models can't do JSON schema.
- **Strict JSON-schema modes reject some constraints.** Two layers keep it portable: what the provider sees, and what we enforce.
- **Replaying at the `fetch` level catches more than fake clients.** It covers the SDKs' own stream parsing and error classes; the fake-client unit tests stay for edge cases that are hard to record.

## 2026-10-20 — Milestone 1: play against the engine

TODO items: 1.3, 1.4 (partly), 1.6, 1.7, 1.8, 1.9, 1.11, 1.12; 6.8 added.

### Implementation notes

- **`site/src/play.js`** holds the playing rules as pure functions, unit-tested in Node:
  - `gameEnd`: checkmate, stalemate, threefold repetition, insufficient material, fifty-move rule.
  - `timeoutEnd`: a timeout loses, unless the other side has no mating material.
  - Clocks.
  - The opponent's search settings, and `pickWeak` for the weakened mode below 1320.
  - `acceptsDraw`.
  - `checkStart` and `fixCastling` for start positions.

  The inline code they replace in `index.html` is gone.
- **Clock (1.6):** time controls 3+2, 5+3, 10+5, 15+10 and 30+20, with Fischer increment.
  - White's first move isn't timed: it starts Black's clock.
  - Every move stores both clocks, so a take-back restores them.
  - Stockfish thinks within its own time: a thirtieth of what's left plus three quarters of the increment, never more than untimed.
  - A 100 ms tick checks for flag fall. The PGN gets `TimeControl`, and `Termination "time forfeit"` after a timeout.
- **Draw offers (1.7):** an "Offer draw" button. Stockfish evaluates the position at depth 12–16 and accepts if it is at least a pawn worse, or after move 30 when the evaluation is within 0.3. After a refusal the next offer has to wait 5 moves.
- **Start positions (1.8):** the Game tab has "Start from", with three options:
  - the standard position;
  - an opening, searched by name or ECO code in `openings.json`, which the build writes from the Lichess data (3,865 lines, 366 KB, loaded only when needed);
  - a FEN, checked before the game starts and explained when it fails: invalid, side not to move in check, game already over.

  The opening's moves are set up as the first moves of the game; take-backs and draw offers count from there. Stockfish moves first if it is to move.
- **NAGs (1.9):** chess.js parses NAGs but doesn't expose them, so `site/src/pgn.js` reads them from the movetext.
  - It reads both suffixes (`!?`) and `$n`, and skips variations, comments, escape lines and headers.
  - The move list shows the glyphs when there is no engine verdict for the move.
  - Export writes `$n`, including the engine's verdicts (`$6`, `$2`, `$4`) when annotating; it used to append `?!` to the SAN.
- **Keyboard and screen readers (1.11):**
  - A move box under the board takes SAN, loose SAN (`nf3`, `Bf7` for `Bxf7+`, `0-0`) and coordinates (`e2e4`, `e7e8q`). Ambiguous or illegal input is explained, never guessed.
  - Every move is announced in a polite live region ("You played knight f3.", "Stockfish played e takes d5, check."), and so is navigation through the moves.
- **Tests (1.12):**
  - Rule edge cases: threefold with changed castling rights, the fifty-move boundary, insufficient material, en passant timing, castling through check, under-promotion.
  - Playwright: a full game from a position played by typed moves to checkmate, then saved and reviewed; the clock with a faked timer, ending in a loss on time; draw offers declined and accepted; opening and FEN starts; a NAG round trip.
- **Multi-threaded Stockfish (1.3):**
  - Every response now sends `Cross-Origin-Embedder-Policy: require-corp`, plus `Cross-Origin-Resource-Policy: same-origin` for our own files. Together with COOP, this makes the page cross-origin isolated.
  - When it is isolated, the analyst runs the lite multi-threaded build (`sf-mt.js`/`.wasm`, 1.7 MB) with up to 4 threads (cores − 1), and the engine status shows the thread count.
  - The opponent stays on one thread, so its strength matches the calibration.
  - Without isolation (e.g. an artifact host that drops COEP), or if the threaded build fails, the single-threaded build starts as before.
- **Analysis searches are capped at 5 s** (`go depth N movetime 5000`). A capped entry remembers the depth it was asked for (`capDepth`), so the position isn't searched again on every visit.
- **Calibration (1.4, partly):** `site/scripts/calibrate.mjs` plays a round robin between the weakened levels below 1320 and Stockfish's UCI_Elo 1320 anchor.
  - It runs the lite single-threaded engine in child processes and uses the page's own search settings (`opponentSearch`, `pickWeak`).
  - Openings and colours alternate, the random numbers are seeded, and games over 300 plies count as draws.
  - It fits ratings by maximum likelihood with the anchor fixed. Three runs of 360–420 games took 11–13 minutes each on 6 cores.

  | Setting | Run 1 (old table) | Run 3 (new table) |
  |---|---|---|
  | 600 | 469 | 557 |
  | 800 | 773 | 874 |
  | 1000 | 1298 | 977 |
  | 1100 | – | 1201 |
  | 1200 | 1536 | 1141 |
  | 1300 | 1655 | 1369 |

  The new table in `play.js` uses search depth 1 up to 1100 and depth 3 above, never 5. It was interpolated from runs 1 and 2.

### Deviations

- **1.4 stays open.** Below 1320 the levels are now aligned with Stockfish's UCI_Elo scale. That scale is calibrated against engine rating lists, not human ratings, and the 1320+ levels run at our short think times with the lite network. Tying the slider to human ratings needs results from real players, e.g. from the weakness tracking in 9.2.
- **1.8:** starting from a curriculum position moved to 6.8, because there is no curriculum yet. `newGame` already starts from any FEN or move list.
- **Draw offers only go one way:** Stockfish never offers a draw itself.
- **Timeout draws use a simplified rule:** a lone king, or a king and one minor piece against a lone king, can't mate. FIDE asks whether any legal sequence mates, which is rarely different in practice.
- **No `[%clk]` comments in the PGN**, only the `TimeControl` tag.

### Insights

- **Search depth dominates the weakened mode.** Depth 1 → 3 → 5 changed strength by hundreds of Elo, far more than the "keep the best move" chance. The old table's depth 5 from 1100 up made 1300 stronger than 1320. Calibrate whenever these knobs change: the script takes about 12 minutes.
- **The calibration's noise is about ±70 Elo per level** at 120 games. 1100 came out above 1200 in run 3, although 1200 searches at the same depth and keeps the best move more often. More games would narrow this; the ordering is right in expectation.
- **MultiPV can explode in won positions.** On a mate in one whose alternatives lose, MultiPV 3 at depth 16 took 8 s single-threaded and over 30 s with 4 threads; with MultiPV 1 it takes 0.3 s. The time cap bounds it. On normal positions, 4 threads reach depth 16 about 30–45% faster.
- **chess.js keeps castling rights without a rook** and then generates O-O-O in `4k3/8/8/8/8/8/8/4K2R w KQkq`. Every pasted FEN now goes through `fixCastling`.
- **chess.js parses NAGs but drops them**, so `pgn.js` re-reads the movetext. Its ply count is tested against chess.js's history so the two can't drift apart.

## 2026-10-20 — Foundation: tooling, CI, licence

TODO items: 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 0.10. Milestone 0 is complete.

### Implementation notes

- **Node:** `.nvmrc` pins Node 24, the current LTS; `engines` asks for `>=24`. CI reads `.nvmrc`.
- **Types (0.4):** JS with JSDoc, checked by `tsc --checkJs` (TypeScript 7) through `site/tsconfig.json` and `npm run typecheck`. It covers `src/*.js`, `server/` and `scripts/`, not tests. Non-strict for now. Seven findings were fixed with inline JSDoc types; all were inference gaps (destructured options with `= {}` defaults, a mixed-type rules table), not bugs.
- **Lint (0.5):** ESLint 10 with the recommended rules, in `site/eslint.config.mjs`. `eslint-plugin-html` lints the module script inside `index.html`, which holds most of the page's code. Four findings were fixed: two unused variables and a needless escape in `knowledge.js`, plus an intended control-character regex in `prompt.js`, now marked with a reasoned disable comment. `npm run check` runs lint and types, and so does `just check`.
- **Knowledge tests (0.7):** `tests/knowledge.test.mjs` printed results; `tests/unit/knowledge.test.mjs` now asserts them in 14 tests covering EPD and pawn signatures, material, opening families, features for the Najdorf, IQP, Carlsbad, Lucena and opposite-bishop positions, book retrieval (ranking, chapter pointers, the user's own books), motifs (mate, back-rank, Greek gift, fork, pin, sacrifice, quiet moves, bad input), similar positions (exact, then structure), and the engine maths. The tests pass the opening name directly, so they no longer need `dist/eco.json`. Unit tests: 72.
- **CI (0.8):** `.github/workflows/ci.yml` runs on every PR and on `main`, in three jobs:
  - lint, types, build, unit tests and `npm audit --audit-level=high`;
  - the Playwright tests in Playwright's Chromium, uploading traces on failure;
  - gitleaks over the full history.

  `codeql.yml` runs CodeQL (JavaScript and Actions, `security-extended`) on PRs, on `main` and weekly. Every action is pinned to a commit SHA, picked from releases at least two weeks old, and the workflow token is read-only.
- **PR template (0.9):** `.github/pull_request_template.md` asks for the TODO number and has three checklists: tests, TODO/DONE and dependency licences, and the security rules from AGENTS.md.
- **Licence (0.10):** `LICENSE` holds the GPL-3.0 text, and `package.json` says `GPL-3.0-or-later`. `THIRD_PARTY_NOTICES.md` lists the following, with chess.js's BSD notice in full:
  - what ships in `dist/`: Stockfish.js, chessground, the cburnett pieces, chess.js and the Lichess opening data;
  - what the page loads: Google Fonts;
  - what the server uses: the Anthropic and OpenAI SDKs.

  The build copies both into `dist/` (`LICENSE.txt` so it is served as text).
- **`.editorconfig`** matches the existing style: UTF-8, LF, 2 spaces, tabs in the ECO data.

### Deviations

- **No npm workspaces (0.3).** Splitting `site/` into `client`, `server` and `shared` would move every file and the build paths, for no gain yet: the server doesn't import `knowledge.js`, and when it needs to, a relative import works. One project keeps one lockfile and one install. Revisit when the server needs its own deployable package (TODO 12).
- **No Prettier (0.5).** The code is written densely on purpose: one-line guards and short bodies on one line. Prettier at 120 columns turned the 2,136 lines in `src/` into 5,142 and touched nearly every line. ESLint checks correctness; `.editorconfig` covers whitespace.
- **CodeQL is skipped while the repo is private.** Code scanning on private repos needs GitHub Advanced Security. The job has `if: !github.event.repository.private`, so it starts working once the repo is public. Secret scanning uses gitleaks instead of GitHub's own, for the same reason; gitleaks-action is free for personal accounts.
- **E2E in CI uses Playwright's Chromium**, set with `PW_CHANNEL=chromium`. Locally the tests still use the installed Chrome.

### Insights

- **Most of the code sits outside `tsc`'s reach.** The inline module script in `index.html` holds most of the logic and isn't type-checked, only linted. Moving logic out into `src/*.js` modules, as was done for `engine.js`, `store.js`, `prompt.js` and `style.js`, brings it under both checks and unit tests.
- **Before the CI secret scan, the history was checked for key-like strings** (`sk-ant-…`, `sk-…`, `*_API_KEY=<value>`) and `.env` was confirmed never committed. Nothing was found.
- **Pinning actions to SHAs** blocks a moved tag from changing CI, the usual supply-chain hole in GitHub Actions. Updates need a bump: Dependabot for actions comes with TODO 11.5.

## 2026-10-20 — Stockfish playing style

TODO items: 1.13 (added).

### Implementation notes

- The Game tab has a **Stockfish style** choice next to the existing Elo slider (600–2800): Solid, Balanced (default), Active, Aggressive, Reckless. Both are saved with the other settings.
- The style shows next to Stockfish's name ("≈1400 · aggressive"). It goes into the coach's context and into saved games, and survives a restore.
- `site/src/style.js`:
  - `aggressionScore()` rates a move for the side playing it. Checks, captures, sacrifices, tactics (from `moveMotifs`), pieces heading for the enemy king and pawn storms score up; retreats score down.
  - `pickStyled()` chooses among Stockfish's candidate lines. Only moves within the style's window of the move Stockfish would play are allowed: Solid 0.2, Active 0.25, Aggressive 0.5, Reckless 1.2 pawns. The style's weight decides among them; Solid prefers the lowest score.
- With a style other than Balanced, the opponent search asks for 4 lines (MultiPV 4) instead of 1.
- Tests: 8 unit tests on a fixed Italian Game position, and 4 Playwright tests. The Playwright tests check that both settings persist, that the UCI commands sent to the worker ask for 4 lines only when a style is set, and that Stockfish replies below 1320 Elo.

### Deviations

- **Style isn't a Stockfish option.** Stockfish 19's UCI options were checked directly: Skill Level, UCI_LimitStrength and UCI_Elo (minimum 1320), with no Contempt or aggressiveness setting. So style is a choice among Stockfish's candidate moves, made after the strength limit.
- **Choice groups wrap on narrow screens.** `.choice` now wraps and draws dividers as 1 px gaps, so five buttons fit a phone. Desktop looks the same as before (`width: fit-content`).

### Insights

- **Strength first, then style.** The window is measured from the move Stockfish would play under its Elo limit, not from the best move. So a style changes how Stockfish plays, not how strong it is, and a forced mate is never given up: a mate outranks any centipawn line by far more than any window.
- **Stockfish already searches several lines when strength-limited.** With `Skill Level` or `UCI_LimitStrength` on, it searches at least 4 lines internally to choose its weaker move. So the move it plays is normally among the reported lines, and asking for 4 costs little extra.
- **The aggression score is a heuristic, not tuned on real games.** It works on the test positions, and Reckless does choose sacrifices. Whether players feel the difference is worth checking during the Elo calibration (TODO 1.4).

## 2026-10-20 — Fixes from the code review: bugs and security

TODO items: 0.6, 8.7, 11.3.1 done; 1.12, 2.1, 10.5 partly.

### Implementation notes

The 2026-10-20 review of `site/src` found 25 issues. Each fixed bug now has a Playwright regression test that fails on the pre-fix page; this was checked by running the tests against a build of the last commit (`E2E_DIST`).

**Bugs fixed:**
- **Review crashed when the game changed mid-run.** It snapshots the position FENs, stops with a message when the game changes, and resets its UI in `finally`. It never classifies or saves the wrong game.
- **A failed or crashed engine froze the game.** The Engine moved to `src/engine.js`. A failed start or crash rejects every waiting job, and later jobs fail at once. The engine reply, hint, analysis and coach all recover, and the status shows the failure.
- **Full browser storage still said "Saved".** `src/store.js` reports failure; library writes are undone and reported.
- **The engine could play for the user.** This happened after a quick take-back, and a stale reply could also clear a newer reply's `thinking` flag. Replies now check the turn and carry a token.
- **The coach could use a game the user had left.** It checks the game generation and FEN after its analysis; the prompt is built inside `try`. It also has its own analysis tag, so moving around the board doesn't cancel it.
- **The hint could draw on the wrong position.** It now checks the position before drawing, and has its own analysis tag.
- **Restoring a game could lose it or stall it.** A failed PGN restore now says so and starts a new game; the Elo is restored, and if Stockfish was to move, it moves.
- **Saves during library loading could wipe the local library.** Library writes now wait for loading to finish.
- **Silent failures:** a failed opening-table load, losing the cloud library, and failed reference saves or deletes are now reported.
- **Smaller fixes:**
  - Restored mate scores come back as mates instead of +20.
  - A draw (0) was treated as "not over".
  - Move labels for games that start from a FEN with Black to move were wrong.
  - Named constants for the opening and book ply limits.

**Security fixes:**
- **Prompt injection (LLM01).** PGN headers and comments, and the player's own references, go into prompts only through `quote()` (`src/prompt.js`). It produces one line in «guillemets», with control characters and inner guillemets removed and the length capped. The coach's rules say quoted text is data.
- **Static server hardening.**
  - A hash-based Content Security Policy for HTML: inline scripts by hash only, no plugins, no framing, `base-uri 'none'`, and `connect-src 'self'`.
  - `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy` and `Permissions-Policy` on every response.
  - Dot-paths such as `/.env` are never served.
  - Header logic lives in `server/static.mjs`, with tests.

**Performance and accessibility:**
- PGN import saves in one write and re-indexes once; the position cache is keyed by game and pruned.
- The Reading and Library panes render only while visible.
- Tabs follow the ARIA tabs pattern (`tabpanel`, `aria-controls`, arrow keys, Home and End). Focus stays in the move list across re-renders. The chat is marked busy while streaming, so screen readers announce the answer once.

**Tests:**
- 50 `node:test` unit tests. New ones cover the engine queue with a fake worker, storage, prompt quoting and security headers.
- 12 Playwright tests in the installed Chrome, replacing `tests/e2e.py`. Every one also fails on uncaught errors and CSP violations.

### Deviations

- **Not fixed:**
  - Keyboard move entry (TODO 1.11).
  - PGN comments are still keyed by position, so repeated positions share one comment.
  - `renderAll` still recomputes more than it needs to (only the hidden panes are skipped).
  - Most of the inline script is still one module; only the engine, storage and prompt helpers moved out.
- **`RULES` stays a user turn,** so the page keeps working with the artifact's `sample()`, which has no system role. The quoting carries the protection.
- **COEP is not sent,** because it would need CORP headers on every resource; it's only needed for multi-threaded Stockfish (TODO 1.3).

### Insights

- **chessground ignores untrusted (synthetic) mouse events** unless `trustAllEvents` is set. UI races are better reproduced with Playwright's fake clock (`page.clock`): it froze the 60 ms before the engine's reply, so the take-back race failed reliably on the old code.
- **The mock provider made the prompt-injection test cheap:** the test intercepts the request to `/api/ai/sample` and checks exactly what the model would receive.
- **A file-writing tool turned the escapes ` `/` ` into the literal characters.** Inside a regex literal those are line terminators, which broke parsing. Keep such escapes ASCII and check with `node --check`.

## 2026-10-20 — One app folder: `site/`

TODO items: 0.2 (decided: merge), 0.11.

### Implementation notes

- `claude/` became `site/` (git rename, history kept), and `server/` and `scripts/serve.mjs` moved into it. One `site/package.json` now holds the chess libraries and the AI SDKs. `npm test` runs the gateway tests and the knowledge check; `npm run serve` uses the Node server with the gateway instead of Python.
- `site/src/index.html` got the gateway client from `codex/index.html` (`localSample()`, the coach-off notice, two error messages). The built `site/dist/_test.html` matches the old `codex/index.html` except for the host's base `<style>` and the `just serve` wording.
- The justfile is down to `serve`, `test`, `e2e`, `build`, `build-eco` and `clean`, with `KIBITZ_PORT`/`KIBITZ_HOST`. `.env` stays at the repo root; the server finds it with `--env`.
- `.gitignore` uses `**/tests/out/`, so e2e screenshots under `site/` are ignored.
- `codex/README.md` (notes from the ChatGPT chat) moved to `docs/codex-notes.md`.

### Deviations

- **No `client`/`server`/`shared` workspaces (TODO 0.3).** One npm project is enough while the client has no build beyond copying files. 0.3 stays open for when that changes.
- **The old `codex/` copy and the root `package.json` are left on disk** for the user to delete. The tool's permission rules blocked the deletion, and `site/` replaces both.

### Insights

- `codex/` never held a separate implementation. Apart from the gateway client added on 2026-10-20, it was `claude/`'s build output, byte for byte. Committing build output as a "variant" made one codebase look like two; a real comparison would need both agents to work from the same task description.
- `codex/index.html` had been saved from the artifact host, so it carried the host's base CSS. The page's own CSS already covers what matters locally (`[hidden]`, `box-sizing`), so the build doesn't need it.

## 2026-10-20 — AI gateway, wired into `codex/`

TODO items: 2.3, 2.4, 2.5, 2.6, 2.8, 2.12, 2.13 done; 2.1, 2.9, 2.11 partly.

### Implementation notes

- `server/ai.mjs`: settings from env, one adapter per provider, request validation, error mapping and a rate limiter. Claude goes through `@anthropic-ai/sdk`; OpenAI, Mistral and Ollama share one adapter on the `openai` SDK, since all three serve the chat-completions protocol. `AI_PROVIDER=mock` streams canned replies for offline work.
- `server/api.mjs`: `GET /api/ai/status` and `POST /api/ai/sample`, which streams NDJSON lines (`{"text"}`, then `{"done","truncated"}` or `{"error"}`). Mounted by `scripts/serve.mjs --api`, which loads `.env` at startup; `just codex` uses it.
- `codex/index.html`: outside an artifact, `use('sample')` now returns a function with the same signature as the artifact's `sample()` that calls the gateway, so the coach chat, review summary and study plan work unchanged. When the gateway reports the provider unavailable, the coach notice gives the reason (e.g. which key is missing).
- Defaults are the small models: `claude-haiku-5-5`, `gpt-6-luna`, `mistral-small-latest`, with `ANTHROPIC_EFFORT=medium`. Larger Claude models also get the server-side refusal fallback; Haiku has none.
- Tests: 31 `node:test` cases in `server/` (fake SDK clients, no network). Also checked in headless Chrome over CDP: a question typed into the coach gets a streamed reply with `mock`, Opus 5.5 and Haiku 5.5. The coach-off notice shows the reason.

### Deviations

- **NDJSON over `fetch` instead of SSE (2.8).** `EventSource` can't POST a body, and a JSON-lines stream over `fetch` gives cancellation through `AbortController` for free.
- **Only `codex/` uses the gateway.** `claude/` is unchanged, and its `just claude` server doesn't load the keys.
- **Not done yet:** CSP/COOP/COEP headers (2.1), per-user key store (2.9), token budgets and cost display (2.11), structured output for board annotations (2.7).

### Insights

- **The gateway is a spending proxy, so it needs browser-side guards even on localhost.**
  - Any website can POST to `127.0.0.1`, which is why the gateway requires JSON and checks `Origin`.
  - DNS rebinding can make a page from another site look local. Requiring `Host` to be `localhost` or an IP literal blocks that, because rebinding only works under a host name.
  - Both are covered by tests (OWASP A01, LLM10).
- **Live checks found account problems, not code problems.** The OpenAI key was rejected (401). The Mistral key was refused `mistral-large-latest` by subscription tier (403), then rate-limited (429). A 403 doesn't necessarily mean a bad key, so `auth_failed` now says "check the key and that your plan includes the model".
- **Haiku 5.5 gave coaching as good as Opus 5.5 on a simple question**, at a fraction of the cost. The engine supplies the hard part. This supports small models by default; worth confirming on harder positions with the tutor eval set (3.8).
- **Newer Node treats `node --test <dir>` arguments as file patterns,** so the test script needs a glob.

## 2026-10-20 — AI provider settings

TODO items: groundwork for 2.3–2.6, 2.11, 2.12 and 8.3.

### Implementation notes

- `.env.example` (committed) is the template; `.env` (git-ignored, mode 600) holds the real keys. Settings: `AI_PROVIDER`, plus a key, model and optional base URL for Anthropic, OpenAI, Mistral and Ollama; an Ollama host allowlist; an embeddings provider and model; output, timeout and rate limits.
- Nothing reads the file yet. The Node server should load it (e.g. `node --env-file=.env`). The `justfile` deliberately doesn't load it, so keys never reach the static dev servers.

### Deviations

- TODO 8.3 assumed embeddings come from the selected chat provider. Anthropic has no embeddings API, so embeddings now have their own provider setting.

### Insights

- Model IDs move fast. Between planning and this entry, OpenAI's docs moved the flagship from GPT-5.6 to `gpt-6-astra`, and Mistral's `-latest` aliases are repointed regularly. Keep model IDs in config, never in code, and have the connection test (TODO 2.14) report which model actually answered.

## 2026-10-20 — Local dev server and justfile

TODO items: none directly; dev tooling that later supports 1.3 and 2.1.

### Implementation notes

- `justfile` at the repo root: `just claude`, `just codex`, `just both`, plus `build`, `test`, `e2e <variant>` and `clean`.
- `scripts/serve.mjs`: a dependency-free Node static server used by the `just` recipes. It sends `charset=utf-8` on every text type, serves only files inside the chosen folder (symlinks included), answers only GET and HEAD, and binds to `127.0.0.1` by default. An `--index` option lets `/` on `claude/dist` serve `_test.html`.

### Deviations

- Local serving moved from `python3 -m http.server` to Node for the `just` recipes, in line with the Node stack. `npm run serve` in `claude/` still uses Python.

### Insights

- Python's `http.server` sends `text/html` without a charset. `claude/dist/index.html` is the bare artifact body with no `<meta charset>`, so Chrome decoded it as Windows-1252 and every `≈`, `…` and `·` came out garbled. `/_test.html` and `codex/` were fine because they declare their charset. Any server we ship should set the charset in the header and not rely on the markup.
- Having our own server makes it easy to add COOP/COEP later, which multi-threaded Stockfish needs (TODO 1.3).

## 2026-10-20 — Planning baseline

TODO items: 5.1 (already done); plan, AGENTS.md and CLAUDE.md created.

### Implementation notes

The starting point is a working prototype that runs as a Claude artifact. `claude/` holds its source (npm build into `dist/`); `codex/` is a flat, prebuilt copy. What the prototype already has, marked *(prototype)* in TODO.md:

- Play against Stockfish 19 (WASM, with blob-URL and asm.js fallbacks), with strength set by `UCI_Elo` and a weakened mode below 1320
- A separate full-strength analyst engine (MultiPV 3); engine jobs queued and cancelled by tag
- Lichess-style move classes based on win-% drop, an accuracy score, and an eval graph in the post-game review
- Pure chess knowledge in `knowledge.js`: position features, motif detection, a book catalog with theme retrieval, and similar-position search by EPD and pawn structure
- Coach chat, a review summary and a study plan, all through the Claude artifact runtime (`window.claude.use('sample')`)
- Games library (artifact `db`, falling back to `localStorage`), PGN import and export
- Opening names from the Lichess chess-openings dataset (CC0)
- Mobile layout and dark mode

### Deviations

- **The AI layer moves to a Node server.** The prototype calls Claude only, through the artifact runtime. Supporting several providers means API keys have to live on a server, so TODO milestone 2 adds a Node gateway. The artifact runtime becomes one optional deployment target rather than the base.
- **The scope goes beyond the brief.** Milestones 9 to 12 and the items tagged *(added)* were proposed during planning. Typical examples: output validation, eval sets, the SSRF guard, spaced repetition and accessibility.

### Insights

- `codex/` started as a byte-identical copy of the `claude/` build output: same app code and `knowledge.js`, with chessground CSS inlined. Any difference between the two from here on is new work.
- Multi-threaded Stockfish needs `SharedArrayBuffer`, which needs cross-origin isolation (COOP/COEP headers). That constrains server headers and any third-party embeds, so it should be settled early (TODO 1.3, 2.1).
- Imported PGN comments already flow into the coach prompt. That is an indirect prompt-injection path (TODO 8.7, 11.3.1).
- A user-configurable Ollama base URL lets the server be pointed at internal addresses (SSRF), so it needs an allowlist (TODO 2.12).
- `knowledge.test.mjs` prints results but asserts nothing, so it can't catch regressions (TODO 0.7).
- `.gitignore` patterns containing a slash are anchored to the repo root: `tests/out/` stopped matching after the move to `claude/` (TODO 0.11).
