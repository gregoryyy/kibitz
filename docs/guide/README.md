# Using Kibitz

Kibitz combines a chess engine with a language model: Stockfish calculates locally, while an optional coach explains the supplied evidence. You can play, analyse, review, study and search without a model. Start with the [illustrated flipbook](../flipbook/README.md) for a nineteen-step tour, or follow the tasks below. The [Primer](../primer/Primer_v01.md) explains the project's experiments with search, grounding, tool use and agents.

## Start on your own machine

Install Node 24.22.1 LTS or a newer maintained, security-patched release and run these commands from the repository root:

```sh
npm --prefix site ci
npm --prefix site run build
AI_PROVIDER=mock node site/scripts/serve.mjs site/dist --api --env= --usage .kibitz-data/usage.sqlite --index _test.html
```

Open `http://127.0.0.1:8765/` in a browser with WebAssembly support. This first run uses canned coach replies, reads no `.env` file and needs no API key or model download. Stockfish still calculates real positions. Keep the terminal running; Control-C stops the server. Opening the HTML file directly from disk does not work.

For actual explanations, follow [provider setup](setup.md#coach-providers-and-local-ollama). Once configured, `just serve` or `npm --prefix site run serve` builds and starts the gateway using the root `.env`. Restart after editing that file. The [Docker recipe](setup.md#local-docker-package) is an alternative mock-default package with private persistent storage. Kibitz targets one local operator; changing its bind address does not add shared accounts or public hosting support.

Open the gear button for **Settings**. Under **General**, choose English or German and independently choose English move notation, German piece letters or figurines. Under **Player profile**, choose the explanation level and optionally save your rating estimate and learning goals. These preferences stay in this browser; the saved profile accompanies later coach questions. They do not change Stockfish's playing strength or measure your ability. See [profile details](#player-profile), [move notation](#move-display) and [keyboard/accessibility controls](#keyboard-play-board-marks-and-motion).

## Play a game

1. Select **Play** and use the **Game** tab to choose your colour, opponent strength/style, starting position and clock.
2. Choose the help level before starting. **Off**, **Flag mistakes** and **Eval + mistakes** restrict analysis while the game is running; **Full engine** permits study tools and lines. Restricted live help also hides opening/source searches and blocks the coach's engine tools.
3. Start the game. Move pieces on the board or type a legal move in the composer, such as `e4` or `play Nf3`. With the keyboard board focused, use arrows to explore, Enter/Space to select a piece and destination, and Escape to cancel.
4. When the game ends, open **Review**. Finished games against Stockfish are saved to the selected library; **Library → Save current game** also saves the displayed game explicitly.

The strength value is a configured opponent setting. Human strength calibration remains incomplete, so it is not a promise of a measured tournament rating. Engine scores are from White's point of view: positive favours White, negative favours Black. Increasing analysis depth takes more time and does not turn a bounded search into a proof.

## Analyse and ask the coach

Select **Analyse**, or open **Game → Load a position or PGN to analyse**, paste a FEN or PGN and load it. **Library → Classics** provides sourced example games. Step through the move list to inspect positions and the evaluation graph. Moving from a past position creates a scratch variation; the original game score remains available. Leaving a running game asks for confirmation and offers a return path.

Choose **Current position** above the composer for board questions, or **General chess** for a discussion without the board context. Quick question chips use the quick model; typed questions use the chat model. **Settings → Coach → How the coach works** controls whether comments are requested manually or after moves. Automatic modes can make more provider calls; start with **Only when asked** when controlling cost matters.

Coaching prose is experimental. For a concrete comparison, ask: “Compare this candidate with the engine's best move and say when evidence is missing.” An allowed tool round runs Stockfish in the browser and returns bounded results to the coach. Expand the answer's evidence/source cards to see what was checked. A continuation should agree with captured engine evidence; recognized legal moves outside that evidence remain unverified, and red underlines identify failed token checks. A matching move or citation does not certify every sentence, strategic claim or explanation. [Design and evidence limits](../design/ai.md) explain this boundary.

## Review and practise

In **Review**, choose **Run review** for engine analysis, then inspect turning points or click the graph to return to a move. **Write summary** and the study-plan action request model explanations separately. Long games, deeper analysis and tool/format follow-ups can increase time and provider usage. Stop an unwanted review before starting another game; late results are fenced to their original game/position.

**Review trends** aggregates compatible reviews of your own games in the selected library. **Practise your own mistakes** opens an independent exercise board and rechecks candidate moves with Stockfish. These are bounded training checks, not a comprehensive diagnosis of your chess. [Review records](#review-trends) and [own-mistake exercises](#exercises-from-your-own-mistakes) describe evidence and grading.

Use **Openings** to explore recorded continuations and their sample games. Counts/results describe the selected collection, not universal opening statistics. Create a repertoire for White or Black, add a PGN mainline or **Use board line**, save notes and copy it as PGN. **Review due moves** recalls your saved choices on a separate board. A recalled move is your repertoire choice, not automatically the engine's best move.

**Lessons** offers bilingual tactics, strategy, endings and sourced problems with authored hints. **Play against Stockfish** continues a lesson position as a normal game. **Spaced practice** combines due lessons, opening recalls and own-mistake exercises; follow any save/retry message before continuing. Schedules and progress stay in this browser. See [practice intervals and limits](#spaced-practice).

## Keep games and find sources

In **Library**, import one or more PGN games or annotated studies. Keep source/author information and score rights separate from annotation rights when known. Unknown rights remain unknown; importing a document does not grant redistribution or cloud-ingestion permission. Export games with **Save .pgn**, **Copy PGN** or **Copy all as PGN**.

Library metadata filters combine player, opening/ECO, recorded year, result and theme. **Search detected patterns** instead searches computed themes and recorded move patterns; its heuristic/candidate/rules labels distinguish possible ideas from actual rule-checked facts. **Search study text → Keywords** searches comments and authored notes locally. **By meaning** and **Combined search** can use a separately configured embedding model: review the destination, grant embedding permission, then explicitly build/search. Typing or choosing a method does not itself upload the library. See [text search](../design/retrieval.md#study-text-search), [combined search](../design/retrieval.md#hybrid-passage-retrieval) and the [comparison with literature algorithms](../research/position-similarity.md).

Reading suggestions and coach citations link to source occurrences. A similar pawn structure or a retrieved passage can suggest an analogy; it does not prove that a source's move works on your board. Open the source position and check the current position with Stockfish. The [retrieval benchmark](../design/retrieval.md#position-retrieval-evaluation) records a small development suite and known ranking limits.

Browser storage is the default. The optional [server library](../../site/README.md#server-library) is a separate, explicitly selected collection, grouped by a browser cookie rather than a signed-in account. Switching storage does not automatically upload existing games or synchronize your profile, repertoire or progress. Clearing that cookie loses the route to its previous server collection.

## Privacy, backups and offline use

Keys remain on the Node server. Before any cloud or Ollama request, grant the selected provider's **coach** permission in **Settings → Coach → Provider permissions**. Embeddings have a separate permission. Questions can include the selected game, engine lines, retrieved passages and saved teaching profile. [Privacy and revocation](setup.md#provider-privacy-and-opt-in) explains what leaves the device and why revocation cannot recall an accepted request.

Use **Settings → General → Export or erase your data** for separate browser and server-library controls. Export before erasing and close other Kibitz tabs. Browser JSON exports preserve saved values but currently have no automatic restore/import; PGN import remains available for games. Browser clearing, another profile or another port can show a different collection. Backups, provider copies, downloaded model weights and operational usage counters have separate lifecycles. See [data formats and deletion scope](#data-export-and-deletion).

For an offline app copy, choose **Settings → Offline app → Prepare or check updates**, wait for confirmation and reload once. Use the same bookmarked address/port. This saves the public app and Stockfish, not private server data or model weights. Browser-local games/lessons remain useful without the Node server; Ollama coaching still needs both Ollama and the Node gateway running. Browser coaching requires separately loaded/cached weights. Follow [offline setup and recovery](#offline-app), and test an offline reload on your own device before relying on it.

## When something fails

| Symptom | Next step |
| --- | --- |
| Coach unavailable or permission required | Check the selected provider and its coach permission; for a browser model, press **Load** explicitly. Engine features remain available. |
| Authentication/model rejection | Check the server `.env`, the exact model ID and your API account's access, then restart. Use the provider console rather than posting keys/log payloads. |
| Connection succeeds but an answer fails | The test checks a small reply, not every model feature. Try a position-sized question, inspect the fixed error hint and consult [provider troubleshooting](setup.md#troubleshooting). |
| Rate or daily budget reached | Wait for the documented reset or have the operator inspect limits. Repeated retries may consume requests; the app's usage thresholds are not hard billing caps. |
| Offline copy is stale/incomplete | Follow the remove/reprepare steps in [offline recovery](#integrity-updates-and-removal); keep exports before clearing browser storage. |
| Library/progress save fails | Keep the visible draft/game, export what you can and use the offered retry. A storage error does not mean the write succeeded. |

The [operations guide](setup.md#local-server-logs-and-monitoring) provides local no-inference health checks and fixed-category logs. [Validation reports](../security/asvs.md#input-validation-rules) distinguish tests, recorded model trials and outstanding human/semantic checks.

## Move display

**Settings → General → Move display** selects English SAN (`Nf3`), German piece letters (`Sf3`) or figurines (`♘f3`). English SAN remains the default, independently of interface language. A successful preference save updates the existing main score, scratch score and recognized move tokens in coach answers immediately, including earlier answers. Reloads and native cross-tab preference changes retain the selection. A failed save keeps the prior setting and displays a message.

German display maps king/queen/rook/bishop/knight to `K/D/T/L/S`; figurines use `♔/♕/♖/♗/♘` for either side. The side to move remains defined by the score and position. Pawn files, captures, disambiguation, checks, mates, castling, move numbers and annotations retain their meaning. Promotion piece letters change too (`bxa1=N+` → `bxa1=S+` or `bxa1=♘+`). Figurine spans carry a spoken move label in the interface language.

Only complete recognized SAN tokens are formatted. Prose, standalone square references and imported comments remain literal text. Existing legal/unsupported/invalid move labels and captured line actions remain attached to their original evidence. A changed display does not upgrade a model claim to a checked move. Other practice widgets and metadata captions keep their existing notation.

The chess records, engine lines, saved answer text, cache keys and PGN use canonical English SAN. Formatting occurs when building or repainting text nodes. The preference does not trigger another model request or change the position. Typed move entry also accepts German piece letters and white/black figurines through legal move resolution; illegal and ambiguous moves keep their existing errors. Canonical SAN and coordinates remain accepted.

Unit tests cover complete tokens, promotion, punctuation, disambiguation, castling, hostile/non-move text, unknown preferences and legal typed aliases. Browser tests cover existing answer/score repainting, NAG/PGN preservation, held line actions, underpromotion input, persistence, failed saves, native cross-tab changes and German phone labels. Glyph appearance depends on the browser's available fonts; the accessible label gives the move in words.

## Keyboard play, board marks and motion

The main board has native keyboard controls in English and German. Tab enters it once; arrow keys explore squares in the displayed orientation. Home/End reaches either end of the current row, and Control+Home/End reaches the displayed corners. Enter or Space selects a movable piece, then a legal destination. Escape clears the selection; Tab leaves the board. The typed-move input remains available below it.

Every square has a piece/square label, including empty squares. Selection and legal destinations have accessible labels; a status region announces selection, cancellation and unavailable moves. A white outline with a black inset marks keyboard focus independently of square colour. The grid is read-only during an opponent turn or at a position without legal moves. Analysis and free scratch play use the same move path as pointer play; clocks, game rules and the existing live-help restrictions still apply. Navigating or replacing the game clears a captured selection. A transient hover preview hides the interactive grid until the real board returns.

Promotion focuses four explicitly named piece buttons. Tab chooses among them, Enter/Space confirms, and Escape cancels. Completion or cancellation restores the previous board focus. A held promotion choice cannot act on a replacement game, including one with the same position. Lesson, opening-drill and own-mistake practice boards keep their existing independent keyboard controls.

Automatic arrows use six distinct line patterns as well as their existing colours: engine move (solid), played move (long dashes), previous alternative (dashes), hint (short dashes), line/coach mark (dash-dot), threat (dots). User-drawn arrows also have patterns. The expandable **Board mark descriptions** below the board lists literal square coordinates, mark meaning, pattern and any validated short label. Circle/square marks and example pieces have text descriptions too; these describe displayed marks rather than certify a coach's chess claim. Restricted live help withholds prior coach marks and their descriptions. Previews hide descriptions that do not belong to the displayed position.

The operating system's reduced-motion preference disables Chessground's actual piece animator and updates while the page is open. The existing CSS preference also suppresses page animations and transitions. No separate application preference is required.

### Verification and limits

Pure tests cover orientation, boundaries, row/corner navigation, piece descriptions, king safety, castling, en passant, promotion destinations, mark patterns and hostile labels. Browser tests exercise native focus/Tab behavior, either colour, game replacement, promotion cancellation/underpromotion, pointer-to-keyboard selection, scratch isolation, preview cleanup, live-help restrictions, the animator and German phone layout.

These changes follow the W3C guidance for [keyboard operation](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [using cues besides colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and [reducing interaction animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Automated Chrome checks and visual inspection do not establish WCAG conformance or replace hands-on testing with screen readers, other browsers and players with different access needs. Keyboard square labels identify actual pieces and legal moves, not engine recommendations.

## German opening labels and built-in comments

The German interface displays German opening labels above the score, in named continuations/study notes, opening selection, Reading chips and library opening metadata. All 141 family prefixes in the current 3,865-row CC0 catalogue have explicit project-authored labels. Common variation terms have curated translations; named variations use German structural terms. Personal names and uncommon nicknames retain their catalogue spelling. These are Kibitz labels rather than an authoritative German naming standard.

For example, `Sicilian Defense: Najdorf Variation, English Attack` displays as `Sizilianische Verteidigung: Najdorf-Variante, Englischer Angriff`, and `Benko Gambit Accepted` becomes `Angenommenes Wolga-Gambit`. Important label tooltips retain the original name. Opening selection and coach lookup accept original names, German names and ECO codes; matching is literal, accent-insensitive and requires every query term. Library opening filters also accept both labels.

Canonical names, ECO codes, stored opening selections, PGN Opening headers, move sequences and engine-feature recognition retain the original catalogue data. Unknown/custom labels and oversized strings remain literal instead of being guessed. The label layer does not change move legality, transposition matching, source identity or live-help permissions. [Upstream catalogue documentation](https://github.com/lichess-org/chess-openings) describes its English names, structured variation labels and CC0 dedication.

### Authored PGN comments

In the German interface, `classicGames({ language: 'de' })` constructs the 33 built-in games/problems with German versions of all 63 distinct authored comments (64 occurrences). This includes the Opera/Immortal games, the sourced Capablanca scores and the curated studies/problems. The default constructor remains English, byte-for-byte, without mutating the source records. No provider is called to translate comments.

These are translations of Kibitz's original notes, with the same GPL annotation rights. Published scores, headers, sources and legal lines remain intact; move tokens inside PGN retain standard English SAN. Revised German documents get their own content hashes and exact comment locators. German comments therefore work in local search and quoted coach retrieval, and can be exported as the selected built-in record. All annotations remain unverified prose. Saved tablebase evidence still covers only the same exact recorded positions/branches, never the translation's wording or a copied import.

Imported/user-written comments and existing saved copies retain their original text, even when identical to an English built-in note. A restored game also keeps its saved comments when the interface language changes; reopen the built-in record to select its other language. This avoids rewriting a player's saved source material. Original English retrieval benchmarks keep their frozen default corpus; German annotation ranking has not gained a new benchmark claim.

### Verification

Tests audit every family prefix and catalogue label, original/German search aliases, bounded hostile/unknown labels and every authored-comment translation. Both language versions replay all 1,403 built-in plies to the same positions with identical headers/source rights. German passage locators address the actual revised PGN, and all twelve curated problem branches retain their checked outcomes while imports gain no certificate. Browser tests cover labels, saved canonical selections, engine context, precise annotation navigation, imported-text isolation, library filters, original-name tooltips and German phone layout. Existing localization and opening-navigation regressions remain in use.

## Player profile

TODO 9.1 adds browser-local teaching preferences under **Settings → Player profile**. Explanation level remains independent of the Stockfish strength slider. An optional rating estimate records the player's own report, its pool and time control. These values are not interchangeable ratings or a measured Kibitz Elo, and no level/rating is inferred from wins, engine accuracy or puzzle completion. Learning goals provide optional teaching context.

Level changes save immediately, preserving the previous settings behavior. Rating/goals drafts save with **Save profile**. **Reload profile** explicitly discards the form draft and reads the current saved profile. The interface supports English/German and phone widths. Saving or viewing a profile makes no provider request, changes no game/clock and adjusts no opponent strength.

### Format and persistence

`player/profile.js` validates the `kibitz.playerProfile` localStorage record:

```json
{
  "version": 1,
  "revision": 1,
  "profile": {
    "level": 2,
    "rating": {
      "value": 1500,
      "pool": "lichess",
      "timeControl": "rapid",
      "basis": "self-reported"
    },
    "goals": "Practise rook endings and avoid hanging pieces."
  }
}
```

Level is 1–4. Rating value is null (unknown) or a whole number from 0–4000; this is an input bound, not a calibration range. Pool is `unspecified`, `fide`, `national`, `lichess`, `chesscom` or `other`; time control is `unspecified`, `classical`, `rapid`, `blitz` or `bullet`. The basis is always `self-reported`. Goals are at most 500 UTF-16 characters, trimmed, well-formed Unicode without NUL. Stored envelopes are bounded to 4,096 characters, with exact known fields and bounded integer revisions. Returned values are detached.

A missing record inherits the legacy explanation level in memory, without an automatic write or inferred rating. Existing profile data takes precedence over the old settings level. Malformed, oversized or future formats remain intact and read-only. A successful single-key write precedes publication to the game/coach; quota/access failures preserve the effective profile and form draft for retry.

Writes reread the saved revision and reject stale sequential-tab edits. Storage events update effective preferences without erasing a dirty form; that draft must reload before it can overwrite a newer profile. This also applies to a level click while a stale rating/goals draft is open. localStorage does not provide a transaction across truly simultaneous writers. These are device/browser preferences, with no library migration, server upload or account sync; changing library storage does not change the profile.

### Coach boundary

Saved level controls explanation style and reference fit. Reported rating and learning goals accompany position chat, general chat, tutor comments, review summaries and study-plan requests. The form names this sharing. No requests are triggered by editing/saving the profile. Goals pass through `quote()` as bounded single-line user data and remain subordinate to app rules and live-help restrictions; they never become HTML or tool arguments. Reported ratings supply no chess evidence.

Profile identity participates in request freshness and tutor-comment cache keys. Changing preferences cancels pending dialogue/tutor work, clears future model dialogue history, and prevents stale review/study-plan responses from applying. The board and running clock remain intact. Previous visible conversations, saved summaries and local comment-cache entries remain historical records; updating the profile does not delete those records. Broader data export/deletion is TODO 10.3.

No automatic ability estimation, cross-pool conversion, weakness diagnosis or measured personalization benefit is claimed. Review-derived tracking and practice scheduling remain 9.2–9.4.

## Review trends

TODO 9.2 adds **Review → Review trends** for the currently selected personal library. It summarizes compatible recorded reviews of the player's own games: measured moves, mistakes/blunders, inaccuracies and average move accuracy by estimated phase, followed by checked tactical opportunities. Saved studies/classics, prose, NAGs and legacy classification arrays do not supply these measurements. No player rating or measured learning gain is inferred.

The table includes sample sizes, and the header shows measured versus total player moves in reviewed games. Missing evidence is unmeasured rather than a successful decision. A missing or unverified motif is not proof of absence. Phase counts reflect board/early-standard-start heuristics, not a diagnosed cause of an error. Opening book labels do not exempt a decision from the numerical comparison; this evidence/coverage policy can differ from the legacy review tiles.

### Capturing analysis

`player/reviews.js` builds version-one `analysisReview` metadata after a complete own-game review, with a full canonical start FEN, exact ordered UCI mainline and player side. Each measured own decision retains White-relative before/after score facts, depth, short legal PV, phase and a separate motif-check result. Nonterminal engine points need depth 6–99, finite bounded integer scores, no bound flag and a nonempty legal PV. Restored depth-zero values do not qualify. Actual terminal outcomes use chess.js rules with complete source history; moves after an automatic terminal state never count as measured decisions.

Classification/accuracy use the existing score/win-percentage functions, from the player's perspective. Reports are capped at 4,000 mainline plies and keep only legal PV prefixes of up to six plies. No source comments, written goals or model answer can create a measurement.

For up to six largest measured mistakes/blunders, the review checks the engine's suggested move and its recorded short continuation with the existing motif verifier. One verifier shares its EPD cache, twelve-extra-search cap and fifteen-second search-admission budget across those checks. It requires the usual score-loss/payoff evidence and engine reply/follow-up agreement for multi-move motifs. Rules-proven mate needs no terminal worker PV. Refuted, missing, shallow or budget-exhausted cases remain separate from confirmations. A geometric fork that loses to a capture cannot become a confirmed missed opportunity.

A confirmed opportunity is a supported alternative to a measured error, not proof that the player failed to recognize a particular pattern. Checks cover a bounded subset, not every possible tactic or strategic plan. Confirmation describes the historical engine search and its horizon; it does not prove perfect play, a unique move or an arbitrarily long forced combination.

### Persistence and source lifecycle

The report travels with the original own-game JSON through the existing browser/account/optional SQLite library stores and their normal acknowledgements/quotas. There is no second global progress store or schema migration. Re-running review replaces the game's report; aggregation deduplicates collection-scoped document IDs. Deletion, source-line replacement and switching library storage/owner remove the corresponding contributions. Comments can change while the exact legal line remains the same.

The reader replays the current legal source and checks report format, side, full FEN/mainline binding, point/PV bounds, phase and motif/continuation geometry. This validates a historical record; it does not cryptographically authenticate a saved score or rerun Stockfish on every library load. Unknown formats stay intact and do not count. Re-reviewing an older game can add compatible metadata; unsupported future formats remain preserved. Unsupported/legacy evidence has an explicit empty state rather than borrowed credit.

Every asynchronous capture checks game generation, the complete FEN sequence, stop state and selected library context before applying a report. Changes cannot write an old report into a new game or storage context. A failed library save leaves the prior acknowledged history intact. The pending report remains part of the current game's in-memory metadata for its normal save path.

### Browsing

The phase table and theme totals use only the selected library's own reviewed games. Up to six sample opportunities show the actual played move and recorded checked SAN continuation. **Open reviewed opportunity** opens the exact source position before the error, using the existing live-game confirmation/return path. Held actions recheck source identity, current library, game generation, visible Review pane and live-help policy. Restricted live help hides trends and continuations.

The English/German interface renders source titles and moves literally; a wide phone table scrolls inside its wrapper. Browsing makes no provider request or fresh engine search, and the trend history is not automatically appended to coach prompts. Engine work happens only during the explicit review. Own-mistake exercises and practice scheduling remain 9.3–9.4.

## Exercises from your own mistakes

TODO 9.3 adds **Review → Practise your own mistakes**. Choose a position from a compatible review of your own played games, then find a stronger move than the one recorded. Preparation and grading use the local Stockfish worker and chess.js. The independent board leaves the main game, clock, source records, lesson results and repertoire intact.

This is a move-quality exercise rather than recall of a single historical line. Any legal alternative can qualify. Hints first name the origin square and then the reference move. Reveal exposes the checked example with a separate result; it does not receive independent-solve credit. [Spaced practice](#spaced-practice) saves completed scheduling receipts with help/miss counters; an unsaved receipt remains visible for retry in the tab.

### Candidates and fresh checking

`player/mistake-puzzles.js` selects up to 50 measured mistakes/blunders from the selected library's own played/reviewed games. Source-aware legal reports must bind the start, complete mainline and player side, as described in [review evidence](#review-trends). Source prose, NAGs, legacy classes, studies and unsupported reports do not supply candidates. Quiet errors can participate without a confirmed tactical motif.

Opening an exercise rechecks its source and lazily searches the root, reference-move child and originally played child. Searches request depth 14, one PV and the app's five-second search cap. Nonterminal evidence requires an exact, finite, bounded score, a legal canonical UCI PV and at least depth six **on that line**. A deeper sibling PV cannot qualify a shallow first line. Terminal outcomes use rules facts instead of invented engine continuations.

The current reference must improve on the original move by at least 100 centipawns, or improve the outcome to a winning mate. If the original move is now the reference or the old error no longer meets that gap, the exercise is declined. Missing/shallow/invalid evidence remains unavailable for retry. Preparation does not automatically sweep the whole deck or call a model/provider.

### Answer criterion

Every answer passes the same rules-only input/promotion checks as the authored lesson player. Typed SAN, coordinates and German letters are supported; promotion without a piece asks for an explicit choice. Actual immediate checkmate succeeds by chess rules, including a mate different from the engine's reference.

The reference move and original move retain their qualified child results for that exercise. Other legal answers receive a fresh child search under the same requested depth/cap. A score within **50 centipawns** of the reference, from the learner's side, meets the engine target. Scores use raw centipawns rather than the display/classification clamp. Winning-mate alternatives qualify as winning mates without a fastest/unique-move claim. A centipawn score does not substitute for a winning-mate target.

The requested depth is shared, while achieved depth can vary under the cap. This is a bounded-search grade, not perfect play, calibrated difficulty or a theoretical endgame certificate. No missing evidence is graded as an incorrect attempt. A below-target legal choice counts separately from hints, reveal and rules-proven mate.

These are **FEN diagram exercises**, with full side/rights/counters but without pre-diagram repetition claims. The exercise's own rules state remains authoritative. They do not resume the complete historical repetition state or transfer a source line directly into a live game.

### Identity and lifetime

The candidate key includes the verified selected-library owner scope, logical document, ply, full FEN and actual move. A SHA-256 ID and a revision containing the checked target/policy support subsequent scheduling; source comments and interface language do not define chess-task identity. Current source revision/object identity still fences navigation and active work. Keys are identifiers rather than an access grant.

`player/puzzle-player.js` captures the source, library context and main-game generation before asynchronous work. Source replacement/deletion, library/owner changes, a new game or restricted live help cancel the session and its dedicated practice searches. Held promotion/answer/source controls cannot grade or open a replacement context. Unchanged background renders retain the typed draft. Leaving a panel does not redirect the exercise's moves to the main board.

**Open source position** uses the existing active-game confirmation/return path. Practice itself writes no game/library data and triggers no coach request. The source title and moves render as literal text. A separate keyboard boundary prevents focused practice/lesson boards from navigating or flipping the main board.

The shared `chess/evidence.js` and `chess/practice.js` helpers retain rules/history and per-line engine evidence checks, input parsing, explicit promotion and destinations. Authored lesson goals keep their original rules/recall/self-assessment behavior. Tests inject engine responses for alternatives/failures and also exercise the real WASM mate path. The `?debug` controller getter permits that injection without adding product controls.

## Spaced practice

TODO 9.4 adds **Lessons → Spaced practice**. It combines authored lessons/sourced curriculum puzzles, saved opening recalls and exercises from the selected library's own-game mistakes. The queue shows the oldest due reviews first, followed by new exercises, up to 20 items. Filters select the practice type and whether to include new exercises. Refresh updates time-dependent due dates; the visible panel also refreshes once a minute.

New lesson exercises follow the profile's explanation-level ceiling. Already scheduled current exercises remain available if the level is lowered. This is a browsing preference, not estimated ability or automatic difficulty calibration. Individual lesson browsing remains available independently.

Each queue action opens its existing independent player. It leaves the main game, clock and library unchanged. Opening recall opens the chosen current repertoire card, and own-game practice searches its current target afresh. Restricted live help hides the queue. Game generation, library scope, source identity, repertoire revision and current panel guards reject held actions. Focused opening/lesson/practice boards do not send navigation or flip keys to the main board.

### Intervals and evidence

All three types use the existing deterministic opening-drill intervals, without another dependency or a fitted memory model:

| Completed result | Next interval |
| --- | --- |
| Miss, reveal or reflection assessed “more practice” | 10 minutes |
| Help used, without a miss/reveal | At least one day; retain an existing longer interval, capped at 180 days |
| Clean completion | One day, then three days, then double the preceding interval, capped at 180 days |

Every opening recall retains its existing saved-choice criterion: a legal alternative outside the repertoire is a recall miss, not a verdict on its chess quality. Lesson mate, recorded-line recall and rubric self-assessment keep their original criteria. Own-game exercises retain the [bounded engine target](#exercises-from-your-own-mistakes), with actual mate distinguished from engine evidence. Unknown engine evidence and illegal input do not produce a completed scheduling receipt. Assistance/reveal affects the interval without becoming independent-solve credit.

The queue names the last evidence class. A self-assessed reflection remains a self-assessment; none of these intervals or counters is a rating, calibrated retention estimate or proof of mastery. Written reflection responses are not stored in the scheduler.

### Current source identity

- Lessons use stable exercise IDs and the exact task revision already used by [lesson progress](../ARCH.md). Changing the diagram, line, prompt or rubric starts a separate schedule while retaining old data.
- Opening reviews keep their existing key: repertoire, side, EPD and sorted accepted choices. Renaming notes does not reset recall; removed positions/changed choices do not borrow old credit.
- Own exercises bind the selected library owner, source occurrence/full FEN/actual move, opaque generated ID and checked engine-target policy revision. The queue uses the latest known target for a surviving current candidate. Opening it always prepares it afresh. A changed freshly checked target starts a separate schedule on completion; an unsupported old mistake cannot receive a new grade.

The own-game queue uses the player's existing bounded candidate deck (up to 50 current mistakes). It does not search every game in the background or certify stored engine targets. Deleting/replacing a source, changing library owners or removing a compatible report removes its queue pointer. Historical schedule entries remain in local storage but are not shown as surviving source exercises.

### Acknowledgement, retries and storage

`player/schedule.js` stores a bounded, versioned `kibitz.practiceSchedule` localStorage envelope for lesson and own-game schedules. `player/schedule-ui.js` renders the combined queue as text. Opening schedules remain in `kibitz.repertoireReviews`, without migration or duplicate writes. Browser-local lesson progress remains in its separate existing store.

A lesson result enters scheduling only after lesson progress acknowledges it. These are two separate localStorage writes, with no cross-key transaction claim. If scheduling then fails, the saved lesson result remains valid and a distinct scheduling receipt waits in the tab. Closing/reloading before that receipt is saved loses the pending scheduling update. The same applies to a failed own-exercise schedule save; its engine/rules result remains visible, alongside a retry control. Pending lesson schedule saves remain visible even when live-help policy hides the queue.

Retry receipts have bounded completion IDs so acknowledged lesson/own results are not counted again within the recent-ID window. Stores reread before a write to preserve sequential tab activity. A late older receipt does not move a newer due date backwards. Storage events refresh displayed schedules; corrupt, oversized or future-format envelopes remain intact and read-only. A failed write publishes no optimistic result. This does not provide a transaction between genuinely simultaneous localStorage writers.

The envelope is bounded to 4,000 lesson/own revision entries, 2,048 recent receipt IDs and eight million characters. Hitting a limit preserves existing data and leaves an unsaved receipt for retry; no history is silently evicted. Dates follow the local system clock. There is no sign-in, cross-device sync, server upload, notification or background provider request. This milestone schedules completed practice from now on; it does not invent historical intervals from old lesson totals.

## Data export and deletion

**Settings → Export or erase your data** opens a separate page. The game, clock, engine and app autosave do not run there. Exports download JSON files; they do not upload data or call an AI provider. Export before deletion if you want to keep a copy. Close other Kibitz tabs before erasing data, because their in-memory games or drafts can be saved again later.

### Browser data

**Download browser data** exports the raw `kibitz.*` localStorage values, with a versioned file envelope and export timestamp. This includes browser games/references, the saved game in progress, settings, profile/goals, repertoire reviews, lesson progress, practice schedules, challenge totals and cached tutor answers. Unknown/future values and original PGN text remain unchanged as raw strings. The page does not collect other origin-storage keys, cookies or `.env` files. Unsaved drafts and transient dialogue/session state are not saved by the export.

The JSON format is `kibitz-browser-data`, version 1, with `entries: [[key, rawValue], …]`. It is a portable record of saved values, without an automatic restore/import operation in this milestone. Game PGN import/export remains available in Library.

**Erase browser data…** displays an explicit confirmation. It removes the Kibitz localStorage namespace and the `kibitz-library` IndexedDB cache, including caches for previously selected server owners on this device. Deleting that whole named cache is intentional even for a future cache schema. It also unregisters this app's service worker and removes its public offline bundles, waiting for acknowledgement before erasing saved browser keys. Server records and their HttpOnly ownership cookie remain, so the server-library controls can still reach that collection. Unrelated site storage and downloaded model weights are not removed.

A preview captures the current keys/values. The operation refuses changed data before deletion and again after waiting for cache deletion. Individual key removals are not a transaction: a storage/cache failure or concurrent writer can leave partial erasure. The page reports incomplete erasure and offers another explicit attempt. Success waits for native IndexedDB deletion and verifies that no Kibitz localStorage entries remain; the separate page does not then recreate app settings or a current-game snapshot. Exports/previews are bounded to 256 keys and 32 million characters; exceeding those limits preserves data and requires using browser site-data tools for whole-site erasure.

### Optional server library

**Check server library** explicitly reads the cookie-owned collection through the existing same-origin API. It can establish an empty anonymous library if no cookie exists. It shows game/reference counts, without displaying untrusted contents as HTML. **Download server library** re-reads the current snapshot and requires the same owner scope before preparing `kibitz-server-library` version-1 JSON. The file retains record metadata, source PGNs, references and its library revision. A changed owner or unavailable/oversized response prevents the export.

**Erase server library…** requires a separate confirmation tied to the inspected scope/revision. `POST /api/library/erase` accepts only `{scope, revision, confirm: true}`. Same-origin/host checks, JSON/size/rate limits and the HttpOnly cookie select the owner; a body scope is only a precondition. A changed cookie or newer revision refuses the old confirmation. An atomic SQLite transaction removes that owner's games/references and advances its revision. Other owners and browser-local records remain unchanged.

The advanced owner revision remains as a tombstone. Older in-flight writes cannot recreate erased records with the previous revision, including after a server restart. After an acknowledged erase, the page removes only that owner's IndexedDB snapshot. A cache failure is reported separately from a successful server transaction. A lost/malformed server acknowledgement does not claim erasure: check the library again before another confirmation. SQLite is authoritative; a cached-only library is never presented as an acknowledged erase.

### Copies outside these controls

The application does not claim forensic disk erasure, deletion from backups, deletion in other browser profiles/devices or removal of conversations already retained by a model provider. SQLite can retain data in database/WAL files or operator backups; the operator must handle those files and their retention. The revision tombstone contains an opaque owner identifier and revision, without game/reference contents. Server `.env` keys and downloaded model files are operator-managed and are excluded.

These controls cover the standalone browser/optional Node-server library. An external Claude artifact's account library remains managed by its host; this page does not impersonate its account/authentication or delete provider histories. Any later hosted-account deployment must add its own account-wide export/deletion contract. The privacy notice and per-provider opt-in are tracked separately in TODO 10.4.

### Operational usage counters

The standard local serve recipes keep a separate private `.kibitz-data/usage.sqlite` for current-day request/token/cost counters and recent admission timestamps, grouped by hashed anonymous cookie IDs. Browser and library export/erase controls leave these operational limits intact. [Usage storage and lifecycle](setup.md#local-usage-limits) describe retention, private paths, operator inspection/reset, SQLite remnants and the absence of prompts, answers, raw cookies or keys.

## Offline app

Start Kibitz normally, open **Settings → Offline app**, then choose **Prepare or check updates**. Keep the page open until preparation is confirmed, then reload once. Bookmark that same address, including its port, or install Kibitz through your browser's app-install menu when offered. The browser can subsequently open that address with the Node server unavailable.

Preparation saves a complete public app bundle: Stockfish workers and WASM, chess rules/board code, opening tables, reference games, curriculum, application modules, bundled fonts/licences, data-management page and model runtime. It does not download model weights, send games to a service or cache API responses. Browser-local saved games, current-game snapshots and practice results retain their existing localStorage lifecycle. Bundled references and lessons are available offline. The private server library still needs a verified server owner; a fresh offline load cannot reveal an earlier cookie owner's cached collection. Select the browser library before relying on it offline.

### Coach choices

- **Ollama:** an internet connection is unnecessary when Ollama and the Kibitz Node gateway are running locally with a downloaded model. The PWA does not replace either process. Provider opt-in still applies, and a configured remote Ollama endpoint still needs that network connection.
- **In browser:** select this provider and explicitly load its model while the server is running. Model loading keeps its existing resource consent and wllama weight cache. Kibitz retains only the selected browser model's bounded local URL/name/size, without network-provider status, usage, credentials or user identity. When the gateway cannot be reached after a reload, this descriptor permits the existing browser-coach path; no network provider is silently substituted. Changing to another provider clears that saved choice when storage permits.

The offline app copy includes wllama's runtime, not its weights. A successful in-memory model load does not prove durable caching: private browsing, quota pressure or storage eviction can leave the weights unavailable after reload. Test a reload without the server on your own device before depending on offline coaching. Missing weights or memory remain visible load errors. Cloud coaching and remote embeddings need their configured services; lexical/board search and authored lessons do not.

### Optional Chrome built-in coach

Run `just offline-chrome`, open the Coach tab in supported desktop Google Chrome, and press **Load**. This recipe serves the offline page with local-only policy and no `.env` keys or GGUF download. Alternatively set `BROWSER_RUNTIME=chrome` in `.env`, start `npm run serve` in `site/`, and select **In browser**. The default `BROWSER_RUNTIME=wllama` and `just offline` retain the pinned GGUF runtime.

The [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) exposes its built-in model to supported windows. Chrome manages its download, storage, hardware/language eligibility and updates; the exact size/version is not pinned by Kibitz. Initial download needs network access. Chrome documents inference as on-device and subsequent use as offline-capable. Its browser-managed downloads are outside the page's same-origin CSP/cache. Check availability on your own device; other browsers' Prompt API implementations are not selected by this backend.

The notice above **Load** explains this download permission. A capability probe never creates a session. A click is required each time the model is loaded, including after reload, explicit **Unload** or ten idle minutes. Remembering the selected runtime does not authorize another download. **Unload** also stops a pending load; late sessions are destroyed. Loading creates an empty session, and each question uses a disposable clone so only the application's supplied messages form its history. Switching away while browser inference is unused unloads it. The existing quick-question routing and page-side connection test work with either runtime; no automatic cloud fallback occurs.

Kibitz bounds Chrome requests to 100,000 input characters, 12,000 output characters and two minutes, with a five-minute loading deadline. Characters here are UTF-16 code units; these are not exact token limits or usage estimates. Context measurement and overflow refusal prevent silently dropping supplied evidence. Native JSON constraints are passed when requested; normal output/move checks still apply. Chrome does not expose a reliable CPU/GPU choice or model-memory estimate, so it checks eligibility itself and Kibitz conservatively reduces analyst threads during inference. The API remains in the window rather than a Worker, as required by its current interface.

The offline descriptor stores only `{runtime: 'chrome', name: 'Chrome built-in model'}` in the existing bounded version-one envelope; it stores neither model weights, API responses nor loading consent. Missing/evicted native weights or unavailable capabilities remain failures until an explicit successful Load. Removing Kibitz's offline copy or erasing its browser data does not remove Chrome-managed model files; Chrome controls that storage. Fake-API unit and browser tests cover the lifecycle, limits, routing, JSON, unsupported devices, offline descriptor and German controls. No real Chrome-model performance, availability or chess-quality result is claimed.

### Model weight downloads

`just offline` downloads the selected catalogue model before building/serving. The Node download command limits the response to the pinned byte count while streaming and checks its exact size and SHA-256 before replacing the final model file. Unique exclusive temporary files keep concurrent downloads separate; handled failures/cancellation remove that run's temporary files and leave earlier weights/markers intact before publication. The byte cap applies per download.

Both Qwen download URLs select full upstream commits rather than `main`. The
[dated source record](../security/2026-10-25-browser-models.json) matches those
revisions' LFS pointers to the existing byte/hash pins and identifies their model
cards and Apache-2.0 licences. The weights and local filenames have not changed,
so already checked files keep their existing fast path. For an upgrade, review
the official repository, full revision, LFS size/hash, model card, licence and
runtime compatibility together in a PR; update the catalogue and evidence, then
run the catalogue/download regressions before making a separate approved weight
download or inference trial. Publisher metadata does not verify training or
quantization lineage, teaching quality or continued upstream availability.

The default total transfer deadline is 30 minutes, covering response headers and body. To allow an hour, run `node site/scripts/fetch-model.mjs --timeout-ms 3600000` from the repository root. The option accepts a positive integer up to 2147483647 milliseconds. Invalid sizes, hashes, failed HTTP responses, stalled transfers and interrupted streams produce a failure rather than publishing unchecked weights. Already checked files retain the existing no-download fast path.

File and marker publication use separate atomic replacements; an interrupted marker update can leave verified weights needing another full check. A process crash can leave `.part-*` files, which are not served as models; remove abandoned partials only when no download is running. The `.sha256` marker is a quick availability check in an operator-controlled directory, not a fresh hash of every served byte. Keep model files/markers trusted; a same-size local edit with an old marker is outside that shortcut's detection. The download/verification command and browser weight cache have separate lifecycles from the public offline app bundle.

### Integrity, updates and removal

The build generates a manifest of every public bundle asset with exact byte count and SHA-256. A module service worker fetches without cookies, rejects redirects/failed responses and verifies each asset before installation can succeed. An incomplete new cache is removed. Once a version controls the page, navigation and bundled assets come from that version; an absent cached file returns a visible failure rather than mixing in a different build. API requests, model weights, non-bundle paths, mutations and other origins bypass this cache.

The first install controls the next navigation. **Prepare or check updates** explicitly checks the worker again; a complete update waits until every tab using the prior version closes. No automatic page reload, forced activation or background game replacement occurs. Activation deletes only obsolete Kibitz bundle caches in the same scope. These lifecycle choices follow the [Service Workers specification](https://www.w3.org/TR/service-workers/). Service workers require a secure context; the supported loopback address qualifies, as does HTTPS.

**Remove offline copy** unregisters this app's worker and removes its public bundle caches. It preserves saved games, other applications' caches and model weights. Reload with the server running before preparing again. **Your data → Erase browser data** also removes the offline app registration/bundles before acknowledging browser erasure. Other open tabs can retain loaded code/data, so close them as the erasure page instructs. Public model weights retain their separate runtime/browser-storage lifecycle.

Browser storage is not a backup and the browser can clear it. Keep exports of games and learning data. A missing or incomplete registered copy is not reported ready: remove it in Settings, reload with the server running, then prepare again. If the page itself can no longer load, remove the service worker/cache through the browser's site controls before reconnecting. Preparation/removal failures remain visible. Browser installation UI, storage quotas and model-cache support vary by platform. Automated Chrome tests cover a real offline engine/reply, local library and lesson use, update waiting, failed-update integrity, cache re-preparation, removal retries and German phone controls; browser-coach fallback uses a fake runtime. No real-model performance or cross-browser guarantee is inferred from those tests.

The offline manifest builder rejects symlink entries and hashes regular assets through the same no-follow file descriptor it checks. The build output remains a trusted operator workspace; this is not isolation against a local process that controls its parent directories.
