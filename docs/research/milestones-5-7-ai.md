# AI in milestones 5–7, and how Kibitz uses Stockfish

Audit date: **2026-10-23**, repository **`0176c62`**. This is a design analysis of [TODO 5–8](../TODO.md), with proposed behaviour explicitly distinguished from existing code.

## The division of work

All three milestones have useful AI applications, but their foundations are ordinary data structures and chess rules. The neurosymbolic mechanism is the connection between a language model's flexible interpretation/explanation and explicit positions, concepts, search results and constraints. Adding an AI-written paragraph to a database does not, by itself, make the database a reasoning system.

Recommended flow:

1. Turn the user's question into a bounded task, preserving the current position, game and help setting.
2. Retrieve source records and compute chess facts through typed tools.
3. Check legal moves, line support, source IDs and the relevance of the retrieved example to this position.
4. Ask the model to explain those facts at the learner's level, with references.
5. Validate structured output and citations before offering board actions; discard stale asynchronous results.

The existing [coach tools](../../site/src/tools.js), [prompt quoting](../../site/src/prompt.js) and board validation provide parts of that boundary. Prose about a long-term plan still needs evidence and careful wording even when all displayed moves are legal.

## Milestone 5: opening library

| Use case | Useful AI role | Explicit chess/data mechanism |
| --- | --- | --- |
| 5.2 Explorer: “What do people play here?” | Explain differences between retrieved continuations. | Query moves from this position in a specified corpus; show counts and sample sizes. |
| 5.3 Repertoire: “I want a quieter position.” | Interpret preferences and explain suitable choices. | Offer legal stored candidates, compare engine lines and let the player choose what to save. |
| 5.4 Drill: “Why did I forget this move?” | Give a graded hint or explain the recurring misconception. | Schedule reviews and score recall with deterministic rules; distinguish repertoire recall from sound chess alternatives. |
| 5.5 Plans: “Why Bg5 before e3?” | Connect source explanations, pawn structure and checked alternatives into a short lesson. | Retrieve the relevant opening passage/position; compare concrete continuations and identify the actual structural features. |
| 5.6 Named continuations and transpositions | Answer follow-up questions about the displayed options. | Match positions, follow legal edges and apply the live-help policy before exposing moves. |

Example: “Why is the minority attack relevant in this Carlsbad position?” should retrieve a lesson and annotated examples, verify that the structure is actually present, and compare an appropriate plan with an alternative. The model explains the connection. A shared opening name alone is insufficient evidence that the plan works here.

Opening popularity, score in a historical sample and engine quality are different quantities. A move with a high sample win rate may reflect player strength or selection effects. Display the corpus and filters; do not turn those counts into an engine evaluation. Repetition scheduling needs no language model. A stored repertoire may deliberately select one move among several sound moves.

**Current state:** 5.1 is implemented. [The ECO builder](../../site/scripts/build-eco.mjs) produces position names and named SAN lines from the bundled opening data. That data is not a frequency/win-rate explorer. The move graph, repertoire workflow and lesson passages above remain proposed work.

## Milestone 6: curriculum

| Use case | Useful AI role | Explicit chess/data mechanism |
| --- | --- | --- |
| 6.1–6.3 Concept lessons | Rephrase an authored explanation; contrast a fork, pin or weak square with a nearby counterexample. | Store lesson objectives and prerequisites; compute board features and verify tactical candidates. |
| 6.4 Endgames | Explain an exact result through a human-sized plan and legal examples. | Check terminal rules and, where supported, tablebase WDL/DTZ with the relevant draw-rule state. |
| 6.5–6.6 Puzzle play | Give hints in stages and respond to the student's reason for choosing a move. | Parse the source solution, test the starting position and accept independently verified alternatives under an explicit grading policy. |
| 6.7 Personalisation | Summarise recurring difficulties and choose the wording or next example. | Track attempts by theme, difficulty and hint use; use a transparent selection/scheduling policy. |
| 6.8 Play the position out | Explain the consequences of the student's choices after the permitted attempt. | Start a legal game from the lesson state; let Stockfish play and measure it. |

Example: for a claimed fork, the detector first identifies the geometry, then a best-reply search checks whether the fork wins anything. The learner can receive “look for a move attacking two targets” before the exact move. A knight attacking two pieces can be pinned or capturable; a geometric label alone must not mark the answer correct.

An exercise has at least two different answers: an accepted **move/line**, and an accepted **explanation**. Check the move with rules/search or an applicable tablebase. For an explanation, use an authored concept rubric and human-reviewed examples; an LLM judge may assist but should not silently determine chess truth. State whether the exercise expects a unique move, any winning move, or the move in a particular repertoire. Recheck apparent alternative solutions rather than treating the imported PV as the only legal answer.

For proposed generated exercises, keep candidate generation separate from publication. Validate legality, theme, difficulty and alternative moves; retain the source position and engine/version/budget used. Short search cannot certify a strategically unique solution. User-facing wording should reflect uncertainty or defer to an authored exercise.

**Current state:** [knowledge.js](../../site/src/knowledge.js) provides pure features and motif candidates; [tools.js](../../site/src/tools.js) adds bounded engine checks. Existing coach challenges record some theme progress. Those pieces support the curriculum, but do not implement the lesson catalogue, full lesson player or Syzygy integration. Syzygy's WDL/DTZ semantics and limitations are described in the [python-chess documentation](https://python-chess.readthedocs.io/en/latest/syzygy.html); that is a reference, not a proposal to add Python to Kibitz.

## Milestone 7: reference library

| Use case | Useful AI role | Explicit chess/data mechanism |
| --- | --- | --- |
| 7.1–7.4 Ingestion and annotation | Propose themes or summarise a permitted annotation. | Parse PGN, validate moves, deduplicate and retain source, author and licence. Keep proposed tags distinct from verified facts. |
| 7.5 Natural-language search | Translate “my losses with Black in isolated-pawn endings” into bounded filters and concept queries. | Execute a typed read-only search over authorised records; combine exact filters with structural/text retrieval. |
| 7.5 Cross-game study | Explain what retrieved examples have in common and where they differ. | Return actual game occurrences and moves, with exact-versus-analogous match labels. |
| 7.6–7.7 Personal library | Explain patterns in the player's own games and suggest a lesson. | Store games reliably, enforce ownership and compute statistics independently of the model. |

The model should not parse PGN instead of chess.js, invent missing source licences, determine identity through embedding similarity, or generate arbitrary SQL for execution. Natural-language intent can map to a small typed query schema; the application owns SQL, parameter binding and access control.

**Current state:** [classics.js](../../site/src/classics.js) contains nine games and four studies with original notes. [chat.js](../../site/src/chat.js) searches a bounded set of library metadata. The own-game prototype exists. The complete provenance model, deduplication, SQLite/IndexedDB design and passage search remain on the plan.

## Stockfish: two whole engines, no standalone internal evaluator

**Yes, Stockfish is used outside the live opponent. No, Kibitz currently does not extract a Stockfish sub-library for that work.**

[index.html](../../site/src/index.html) constructs `opponent` and `analyst` as separate instances of the same [Engine wrapper](../../site/src/engine.js):

| Instance | Current jobs |
| --- | --- |
| `opponent` | Choose the next game move, with the configured strength/style. |
| `analyst` | Live analysis, hints, mistake ratings, game review, scratch-board analysis, challenges and coach engine tools. |

The analyst can use multiple threads when browser isolation permits. Its independent queue and settings let it analyse without making the opponent play a move. Both instances run a complete engine through UCI messages: set options, set a FEN, search and parse scores/PVs.

[build.mjs](../../site/scripts/build.mjs) copies Stockfish 19 Lite single-thread and multi-thread WASM builds plus the asm.js fallback from the installed `stockfish` package (19.0.1 at this audit). The [maintainer repository](https://github.com/nmrugg/stockfish.js) documents the engine packaging. Lite is a smaller-network engine variant; it is not a JavaScript API to selected evaluator components.

### What runs where

| Mechanism | Used today? | Boundary |
| --- | --- | --- |
| NNUE position evaluation | Yes, internally during Stockfish search. | Kibitz does not call the neural network directly. |
| Engine search, scores and principal variations | Yes. | UCI through the whole engine. |
| Legal moves, PGN/FEN, attack queries and game rules | Yes. | chess.js, rather than Stockfish's internal move generator. |
| Material, pawn features, tactical candidates | Yes. | Kibitz's pure `knowledge.js`, with confirmation in `tools.js`. |
| Static `eval` trace, neural activations or concept vectors | No. | No wrapper call or exported representation pipeline. |
| Syzygy probing / `UCI_ShowWDL` | No. | Planned endgame checks; neither is wired into the current wrapper. |
| UCI `searchmoves` | No. | `try_move` applies a legal move and analyses the resulting position instead. |

Stockfish itself already combines neural evaluation with explicit search. The [NNUE technical documentation](https://official-stockfish.github.io/docs/nnue-pytorch-wiki/docs/nnue.html) describes efficient incremental neural evaluation; it should not be presented as purely symbolic or as an exact oracle for arbitrary positions. The distinction useful to Kibitz is **explicit rules/search/evidence versus unconstrained language generation**.

Two limitations matter when building on the current integration:

- Engine requests use a FEN; they do not transmit the preceding game moves. EPD caches deliberately omit move counters. Exact position matching is useful for opening transpositions, but repetition and fifty-move adjudication can require history/clock state beyond that key.
- A legal engine PV and a finite-depth evaluation support a bounded claim. They do not prove that a verbal explanation is the causal reason for a move, that a plan always wins, or that every good alternative was found.

### Could an internal component help later?

There are three different experiments, none implemented here:

1. **Expose a static evaluator:** obtain a score/features without a full search for fast annotation or a custom explanation tree. Stockfish's upstream [UCI source](https://github.com/official-stockfish/Stockfish/blob/master/src/uci.cpp) includes a debugging `eval` command; this is not the same as a stable browser-facing evaluator ABI. Test the exact pinned WASM build before relying on its output. A static score needs tactical checking.
2. **Use learned representations:** train a concept probe or chess-text retriever against engine representations. This needs model access, data and validation; UCI PV text does not expose those hidden states.
3. **Use an exact endgame component:** add eligible Syzygy probes for exercises. This requires a separate data/access design and draw-rule handling; installing a neural evaluator would not supply tablebases.

A concrete research example is the October 2026 [Queen preprint, Appendix D](https://arxiv.org/html/2610.03695v1): its alternative annotation pipeline scores a custom tree with Stockfish's neural evaluator, then checks lines with a separate search. This demonstrates a possible separation, not an API currently available in Kibitz. The [games review](neurosymbolic-games.md) covers the broader approach.

## Suggested delivery order

1. Establish source/licence IDs and game-position occurrences (7.1), while preserving the existing library.
2. Build the opening move graph and named-continuation panel (5.2/5.6), with transposition and help-setting tests.
3. Add an authored slice of lessons (6.1/6.6) and a lexical passage index (8.3), using those source IDs.
4. Evaluate structural + lexical + dense retrieval and citation support (8.4/8.6/8.8).
5. Add broader graph synthesis or engine-representation experiments only when a measured gap justifies them.

This order is a recommendation about dependencies, not a replacement or completion of the milestone checklist.
