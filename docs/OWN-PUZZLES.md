# Exercises from your own mistakes

TODO 9.3 adds **Review → Practise your own mistakes**. Choose a position from a compatible review of your own played games, then find a stronger move than the one recorded. Preparation and grading use the local Stockfish worker and chess.js. The independent board leaves the main game, clock, source records, lesson results and repertoire intact.

This is a move-quality exercise rather than recall of a single historical line. Any legal alternative can qualify. Hints first name the origin square and then the reference move. Reveal exposes the checked example with a separate result; it does not receive independent-solve credit. Attempts and help are session-local in this milestone. Durable scheduling follows in 9.4.

## Candidates and fresh checking

`player/mistake-puzzles.js` selects up to 50 measured mistakes/blunders from the selected library's own played/reviewed games. Source-aware legal reports must bind the start, complete mainline and player side, as described in [review evidence](REVIEWS.md). Source prose, NAGs, legacy classes, studies and unsupported reports do not supply candidates. Quiet errors can participate without a confirmed tactical motif.

Opening an exercise rechecks its source and lazily searches the root, reference-move child and originally played child. Searches request depth 14, one PV and the app's five-second search cap. Nonterminal evidence requires an exact, finite, bounded score, a legal canonical UCI PV and at least depth six **on that line**. A deeper sibling PV cannot qualify a shallow first line. Terminal outcomes use rules facts instead of invented engine continuations.

The current reference must improve on the original move by at least 100 centipawns, or improve the outcome to a winning mate. If the original move is now the reference or the old error no longer meets that gap, the exercise is declined. Missing/shallow/invalid evidence remains unavailable for retry. Preparation does not automatically sweep the whole deck or call a model/provider.

## Answer criterion

Every answer passes the same rules-only input/promotion checks as the authored lesson player. Typed SAN, coordinates and German letters are supported; promotion without a piece asks for an explicit choice. Actual immediate checkmate succeeds by chess rules, including a mate different from the engine's reference.

The reference move and original move retain their qualified child results for that exercise. Other legal answers receive a fresh child search under the same requested depth/cap. A score within **50 centipawns** of the reference, from the learner's side, meets the engine target. Scores use raw centipawns rather than the display/classification clamp. Winning-mate alternatives qualify as winning mates without a fastest/unique-move claim. A centipawn score does not substitute for a winning-mate target.

The requested depth is shared, while achieved depth can vary under the cap. This is a bounded-search grade, not perfect play, calibrated difficulty or a theoretical endgame certificate. No missing evidence is graded as an incorrect attempt. A below-target legal choice counts separately from hints, reveal and rules-proven mate.

These are **FEN diagram exercises**, with full side/rights/counters but without pre-diagram repetition claims. The exercise's own rules state remains authoritative. They do not resume the complete historical repetition state or transfer a source line directly into a live game.

## Identity and lifetime

The candidate key includes the verified selected-library owner scope, logical document, ply, full FEN and actual move. A SHA-256 ID and a revision containing the checked target/policy support subsequent scheduling; source comments and interface language do not define chess-task identity. Current source revision/object identity still fences navigation and active work. Keys are identifiers rather than an access grant.

`player/puzzle-player.js` captures the source, library context and main-game generation before asynchronous work. Source replacement/deletion, library/owner changes, a new game or restricted live help cancel the session and its dedicated practice searches. Held promotion/answer/source controls cannot grade or open a replacement context. Unchanged background renders retain the typed draft. Leaving a panel does not redirect the exercise's moves to the main board.

**Open source position** uses the existing active-game confirmation/return path. Practice itself writes no game/library data and triggers no coach request. The source title and moves render as literal text. A separate keyboard boundary prevents focused practice/lesson boards from navigating or flipping the main board.

The shared `chess/evidence.js` and `chess/practice.js` helpers retain rules/history and per-line engine evidence checks, input parsing, explicit promotion and destinations. Authored lesson goals keep their original rules/recall/self-assessment behavior. Tests inject engine responses for alternatives/failures and also exercise the real WASM mate path. The `?debug` controller getter permits that injection without adding product controls.
