# Review trends

TODO 9.2 adds **Review → Review trends** for the currently selected personal library. It summarizes compatible recorded reviews of the player's own games: measured moves, mistakes/blunders, inaccuracies and average move accuracy by estimated phase, followed by checked tactical opportunities. Saved studies/classics, prose, NAGs and legacy classification arrays do not supply these measurements. No player rating or measured learning gain is inferred.

The table includes sample sizes, and the header shows measured versus total player moves in reviewed games. Missing evidence is unmeasured rather than a successful decision. A missing or unverified motif is not proof of absence. Phase counts reflect board/early-standard-start heuristics, not a diagnosed cause of an error. Opening book labels do not exempt a decision from the numerical comparison; this evidence/coverage policy can differ from the legacy review tiles.

## Capturing analysis

`player/reviews.js` builds version-one `analysisReview` metadata after a complete own-game review, with a full canonical start FEN, exact ordered UCI mainline and player side. Each measured own decision retains White-relative before/after score facts, depth, short legal PV, phase and a separate motif-check result. Nonterminal engine points need depth 6–99, finite bounded integer scores, no bound flag and a nonempty legal PV. Restored depth-zero values do not qualify. Actual terminal outcomes use chess.js rules with complete source history; moves after an automatic terminal state never count as measured decisions.

Classification/accuracy use the existing score/win-percentage functions, from the player's perspective. Reports are capped at 4,000 mainline plies and keep only legal PV prefixes of up to six plies. No source comments, written goals or model answer can create a measurement.

For up to six largest measured mistakes/blunders, the review checks the engine's suggested move and its recorded short continuation with the existing motif verifier. One verifier shares its EPD cache, twelve-extra-search cap and fifteen-second search-admission budget across those checks. It requires the usual score-loss/payoff evidence and engine reply/follow-up agreement for multi-move motifs. Rules-proven mate needs no terminal worker PV. Refuted, missing, shallow or budget-exhausted cases remain separate from confirmations. A geometric fork that loses to a capture cannot become a confirmed missed opportunity.

A confirmed opportunity is a supported alternative to a measured error, not proof that the player failed to recognize a particular pattern. Checks cover a bounded subset, not every possible tactic or strategic plan. Confirmation describes the historical engine search and its horizon; it does not prove perfect play, a unique move or an arbitrarily long forced combination.

## Persistence and source lifecycle

The report travels with the original own-game JSON through the existing browser/account/optional SQLite library stores and their normal acknowledgements/quotas. There is no second global progress store or schema migration. Re-running review replaces the game's report; aggregation deduplicates collection-scoped document IDs. Deletion, source-line replacement and switching library storage/owner remove the corresponding contributions. Comments can change while the exact legal line remains the same.

The reader replays the current legal source and checks report format, side, full FEN/mainline binding, point/PV bounds, phase and motif/continuation geometry. This validates a historical record; it does not cryptographically authenticate a saved score or rerun Stockfish on every library load. Unknown formats stay intact and do not count. Re-reviewing an older game can add compatible metadata; unsupported future formats remain preserved. Unsupported/legacy evidence has an explicit empty state rather than borrowed credit.

Every asynchronous capture checks game generation, the complete FEN sequence, stop state and selected library context before applying a report. Changes cannot write an old report into a new game or storage context. A failed library save leaves the prior acknowledged history intact. The pending report remains part of the current game's in-memory metadata for its normal save path.

## Browsing

The phase table and theme totals use only the selected library's own reviewed games. Up to six sample opportunities show the actual played move and recorded checked SAN continuation. **Open reviewed opportunity** opens the exact source position before the error, using the existing live-game confirmation/return path. Held actions recheck source identity, current library, game generation, visible Review pane and live-help policy. Restricted live help hides trends and continuations.

The English/German interface renders source titles and moves literally; a wide phone table scrolls inside its wrapper. Browsing makes no provider request or fresh engine search, and the trend history is not automatically appended to coach prompts. Engine work happens only during the explicit review. Own-mistake exercises and practice scheduling remain 9.3–9.4.
