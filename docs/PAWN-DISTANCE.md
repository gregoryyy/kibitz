# Fuzzy pawn-structure distance

TODO **8.5** adds an optional graded pawn relation to [Combined passage search](HYBRID-SEARCH.md). Enable **Favor the current board**, then **Include similar pawn structures** and explicitly search. The new option permits at least **75% colour-specific pawn-square overlap**. It defaults off; ordinary Combined search retains exact pawn placement.

**Why this result** distinguishes **Similar pawn structure** from an exact board or identical pawns. It shows shared square counts and separate lists of squares present only on the current board or in the source, using white/black pawn symbols. These lists do not pair pawns into a move sequence. The source still opens at its exact legally replayed occurrence, including a custom-start root.

## Definition and scope

[`pawn-distance.js`](../site/src/pawn-distance.js) decodes a checked board's existing `pawnSignature()` into a set such as `{w:d4, b:e6}`. Colour and square are literal: no colour swap, board reflection or rotation is applied. The geometry decoder validates eight ranks and bounded square counts; full board legality belongs to the existing chess.js source/query checks.

For sets A and B, version **`pawn-square-jaccard-v1`** uses:

```text
shared = |A ∩ B|
total  = |A ∪ B|
distance = (total - shared) / total
```

Empty/empty has distance zero; empty/nonempty has distance one. Zero identifies identical pawn features, not identical full positions. The source/query board relation separately requires nonempty pawns for analogies, so two different pawnless boards never acquire a pawn-match boost. Exact EPDs remain exact matches, including turn, castling and legal en-passant rights.

The runtime option uses maximum distance **0.25**, an explicit conservative heuristic chosen before the fixture comparison, not a tuned relevance threshold. The pure `maxPawnDistance` argument accepts finite values from zero to one; zero is the default. Examples:

| Change between two 16-pawn placements | Shared / union | Distance |
| --- | ---: | ---: |
| Same pawn squares | 16 / 16 | 0 |
| One pawn absent in the source | 15 / 16 | 0.0625 |
| One pawn on a different square | 15 / 17 | 0.1176 |
| Two pawns on different squares | 14 / 18 | 0.2222 |
| Three pawns on different squares | 13 / 19 | 0.3158 |

A distant relocation and a one-square advance have the same cost if both replace one colour/square token. Captures and advances are not equally costly under this formula. In sparse endings a one-square advance of the only pawn has no shared squares and distance one. This cheap overlap measure therefore does not capture pawn travel, opposition, passed-pawn timing, legal reachability or tactical suitability. It is a distance on the pawn feature sets and only a pseudometric on complete positions.

## Hybrid integration and state

Legal source profiles cache detached pawn-square sets. The position channel orders exact boards first, then compatible pawn analogies by increasing distance and stable passage ID, within its twenty-candidate budget. A fuzzy relation requires matching turn, check state and phase. Overall hybrid ranking still combines all channels and its term/exact-board reranker; closest pawn distance is not a guarantee of first place in the final list. A text result may remain relevant without a matching pawn relation.

The existing source/language/collection filters apply before matching. Imported prose and claimed tags cannot change pawn geometry. The optional every-term requirement still applies to fuzzy candidates. `HYBRID_POLICY` advances to `rrf-board-terms-v2` and records the pawn metric version; embedding input/version/dimensions are unchanged. Earlier recorded hybrid reports retain their original policy version.

Changing the fuzzy option cancels pending results and held source actions while retaining otherwise valid source vectors. Main/scratch-board changes recheck the captured FEN and intent; source/account/policy changes retain stricter index invalidation. Toggling the option sends no replacement query, and FENs/features stay local. No new provider, dependency, model call, persistent index or tutor prompt data is added.

This consumer is Combined Library passage search. The older Reading/coach `similarPositions()` prototype continues to use exact pawn buckets; the remaining position-index work is tracked in 8.1. Material/placement features, richer motif indexing and cited tutor retrieval remain 8.1/8.2/8.6.

## Reproducible spatial benchmark

```sh
just retrieval-eval --mode pawns
just retrieval-eval --mode pawns --out docs/eval/retrieval/pawn-distance
```

The [Markdown report](eval/retrieval/pawn-distance.md) and [JSON](eval/retrieval/pawn-distance.json) use ten original, chess.js-replayed source diagrams and eight manually labelled spatial queries: five answerable and three no-answer. Source rights and exact occurrence/PGN locators follow the existing library model. There is no provider, network, Stockfish search, `.env` loading or saved player data.

Both variants use the production hybrid source/profile path, the same source/query hashes and the same turn/check/phase/nonempty-pawn checks. Dense candidates are absent, the query has no fixture-text matches, and only results with a board relation are scored. The comparison isolates the position component rather than evaluating full hybrid text relevance. Gold selectors and case IDs never reach the adapter.

| Method | Precision@1 | Recall@3 | MRR@3 | No-answer false positives |
| --- | ---: | ---: | ---: | ---: |
| Exact pawn placement | 0.400 | 0.250 | 0.400 | 0.000 |
| Jaccard distance ≤ 0.25 | 0.800 | 0.750 | 0.800 | 0.000 |

The sparse one-pawn neighbour is deliberately labelled useful and remains missed. The suite is small, constructed and shares diagram families; the gains do not establish general retrieval quality, transferable advice or teaching benefit. Source-family splits and chess-aware labels are needed before choosing a better metric or cutoff. Assignment/transport costs could address geometric displacement, but require their own definition and evaluation.

Unit checks include independent set/bit arithmetic, symmetry and triangle bounds over an enumerated feature universe, colour/direction preservation, empty sets, exact cutoff boundaries, sparse misses, legal-board compatibility and source scope. Browser checks isolate fuzzy candidates using orthogonal fake embeddings, then exercise exact source navigation, cancellation/held actions, restricted help, deletion, scratch changes and German phone explanations. Existing position/text/dense/hybrid baselines remain recorded separately.
