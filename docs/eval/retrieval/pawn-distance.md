# Fuzzy pawn-structure distance comparison

TODO 8.5. Reproduce: `just retrieval-eval --mode pawns`. Offline; no model, network, engine search or saved library.

Metric: pawn-square-jaccard-v1; maximum distance 0.25. Colours and squares are literal; no mirroring, geometric move cost or advice-transfer probability.

Ten original source diagrams and eight manually labelled spatial queries. This isolates production board-relation candidates, not full hybrid text relevance. Turn/check/phase compatibility and nonempty pawns apply in both variants. The fixed cutoff is an inspectable heuristic, not a tuned relevance threshold.

| Method | P@1 | Recall@3 | MRR@3 | No-answer false positives |
| --- | ---: | ---: | ---: | ---: |
| Exact pawn placement | 0.400 | 0.250 | 0.400 | 0.000 |
| Jaccard ≤ 0.25 | 0.800 | 0.750 | 0.800 | 0.000 |

The one-pawn advance is a labelled useful spatial neighbour that this metric misses: its pawn squares are disjoint, giving distance one. The suite is small and deliberately constructed; broader retrieval gains, tactical suitability and teaching value remain unestablished.

## Fuzzy results

# Pawn-structure retrieval

TODO 8.5. Suite 1; retriever `pawn-jaccard-v1`.

10 passages: 10 original PGN comments and 0 authored guide sections. 8 manually labelled queries.

Corpus SHA-256: `231502b14a40b89b9a8a0e0408b4f8b92ec116255740bab280af004fb9290d3f`.
Case SHA-256: `43472da7c646ce19a635d369f454337a2f8a8d9fdfe826af4d0801a3972eb125`.

Offline pawn-structure comparison; no provider, saved library, engine search or network.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 5 | 3 | 0.800 | 0.650 | 0.800 | 0.800 | 0.000 |
| All | 3 | 5 | 3 | 0.400 | 0.750 | 0.800 | 0.800 | 0.000 |
| All | 6 | 5 | 3 | 0.233 | 0.800 | 0.800 | 0.800 | 0.000 |
| overlap | 1 | 1 | 0 | 1.000 | 0.250 | 1.000 | 1.000 | — |
| overlap | 3 | 1 | 0 | 1.000 | 0.750 | 1.000 | 1.000 | — |
| overlap | 6 | 1 | 0 | 0.667 | 1.000 | 1.000 | 1.000 | — |
| turn | 1 | 1 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| turn | 3 | 1 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| turn | 6 | 1 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| check | 1 | 1 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| check | 3 | 1 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| check | 6 | 1 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| boundary | 1 | 1 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| boundary | 3 | 1 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| boundary | 6 | 1 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| sparse | 1 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| sparse | 3 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| sparse | 6 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| no-answer | 1 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 3 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 6 | 0 | 3 | — | — | — | — | 0.000 |
| en | 1 | 5 | 3 | 0.800 | 0.650 | 0.800 | 0.800 | 0.000 |
| en | 3 | 5 | 3 | 0.400 | 0.750 | 0.800 | 0.800 | 0.000 |
| en | 6 | 5 | 3 | 0.233 | 0.800 | 0.800 | 0.800 | 0.000 |

## Lexical comparison

Same corpus, queries, scope filters and gold judgements. Cosine similarity above zero is a ranking rule, not a calibrated relevance threshold.

The shared gold has a lexical-intent limitation: wrong-language treats the German term Isolani as unanswerable in English guides, although an English isolated-pawn passage can be a useful semantic match. Keep this case for baseline comparability; review intent and label semantic relevance separately before calibrating abstention. Off-topic quantum and unsupported-proof cases still have no supporting passage.

| k | Retriever | Precision | Recall | MRR | nDCG | No-answer false positives |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Dense | 0.800 | 0.650 | 0.800 | 0.800 | 0.000 |
| 1 | BM25 | 0.400 | 0.250 | 0.400 | 0.400 | 0.000 |
| 3 | Dense | 0.400 | 0.750 | 0.800 | 0.800 | 0.000 |
| 3 | BM25 | 0.133 | 0.250 | 0.400 | 0.294 | 0.000 |
| 6 | Dense | 0.233 | 0.800 | 0.800 | 0.800 | 0.000 |
| 6 | BM25 | 0.067 | 0.250 | 0.400 | 0.278 | 0.000 |

## dense-structure

en; overlap. Keywords: analogy.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. All terms required: false.

- `game:library:same@a3fc7ba65abb7ae0004248908a93addabb5b7f87927454ac7c6b429d7e9a07f8/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:missing-one@1e784c2aca62a710fa6639d424e60117ff03421b0f3027151a051e6b88c508e8/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:advance-one@46876e0bd709fde79596c3d99f2f6d8930c6b07bcc82161e8e9fe4fcd41acc55/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:advance-two@b50d2931b3cc37a0f0b72eefa58e10f1be773d3f9d25ba2b0f2bfbbd63773a8b/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.

| Rank | Passage location |
| ---: | --- |
| 1 | library:same / ply 0 |
| 2 | library:missing-one / ply 0 |
| 3 | library:advance-one / ply 0 |
| 4 | library:advance-two / ply 0 |

## black-turn

en; turn. Keywords: analogy.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1`. All terms required: false.

- `game:library:black@379ab1812c1701e73d0f9b9ebca078c49fe06e5ff34fddfc887b22cae7adde8c/ply/0/comment/0/text/0-22` — Only the black-to-move source is dynamically compatible.

| Rank | Passage location |
| ---: | --- |
| 1 | library:black / ply 0 |

## in-check

en; check. Keywords: analogy.

Expected:

Query FEN: `r1bqkbnr/pppppppp/8/8/8/3n4/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. All terms required: false.

- `game:library:checked@acdd3471f0c2b00efb1c1f74c24c130fded88d796e1662aca6a367732fac50cc/ply/0/comment/0/text/0-22` — An exact checked diagram is relevant; quiet structures cannot substitute for it.

| Rank | Passage location |
| ---: | --- |
| 1 | library:checked / ply 0 |

## quarter-boundary

en; boundary. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1`. All terms required: false.

- `game:library:boundary@82dc82a45b6cb249f7f0a6c13152fad342009f137b948c01f4f93c3413bce889/ply/0/comment/0/text/0-22` — Three of four pawn squares remain; one missing pawn is a useful spatial analogy.

| Rank | Passage location |
| ---: | --- |
| 1 | library:boundary / ply 0 |

## single-pawn-shift

en; sparse. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/5P2/8/4K3 w - - 0 1`. All terms required: false.

- `game:library:single@d5b114cf2a1cce77428dbc717c3a30241ef6ef114d86fffcee432e3f26f5427e/ply/0/comment/0/text/0-22` — A one-square advance in a one-pawn diagram is spatially nearby, although square-set overlap will miss it. No plan transfer is asserted.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## pawnless

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `7k/8/8/8/8/8/8/K7 w - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## unrelated

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `4k3/8/p7/8/8/4PPPP/8/4K3 w - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## wrong-turn-boundary

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/8/PPPP4/4K3 b - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## Exact-only results

# Pawn-structure retrieval

TODO 8.5. Suite 1; retriever `pawn-exact-only-v1`.

10 passages: 10 original PGN comments and 0 authored guide sections. 8 manually labelled queries.

Corpus SHA-256: `231502b14a40b89b9a8a0e0408b4f8b92ec116255740bab280af004fb9290d3f`.
Case SHA-256: `43472da7c646ce19a635d369f454337a2f8a8d9fdfe826af4d0801a3972eb125`.

Offline pawn-structure comparison; no provider, saved library, engine search or network.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 5 | 3 | 0.400 | 0.250 | 0.400 | 0.400 | 0.000 |
| All | 3 | 5 | 3 | 0.133 | 0.250 | 0.400 | 0.294 | 0.000 |
| All | 6 | 5 | 3 | 0.067 | 0.250 | 0.400 | 0.278 | 0.000 |
| overlap | 1 | 1 | 0 | 1.000 | 0.250 | 1.000 | 1.000 | — |
| overlap | 3 | 1 | 0 | 0.333 | 0.250 | 1.000 | 0.469 | — |
| overlap | 6 | 1 | 0 | 0.167 | 0.250 | 1.000 | 0.390 | — |
| turn | 1 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| turn | 3 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| turn | 6 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| check | 1 | 1 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| check | 3 | 1 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| check | 6 | 1 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| boundary | 1 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| boundary | 3 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| boundary | 6 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| sparse | 1 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| sparse | 3 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| sparse | 6 | 1 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| no-answer | 1 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 3 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 6 | 0 | 3 | — | — | — | — | 0.000 |
| en | 1 | 5 | 3 | 0.400 | 0.250 | 0.400 | 0.400 | 0.000 |
| en | 3 | 5 | 3 | 0.133 | 0.250 | 0.400 | 0.294 | 0.000 |
| en | 6 | 5 | 3 | 0.067 | 0.250 | 0.400 | 0.278 | 0.000 |

## dense-structure

en; overlap. Keywords: analogy.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. All terms required: false.

- `game:library:same@a3fc7ba65abb7ae0004248908a93addabb5b7f87927454ac7c6b429d7e9a07f8/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:missing-one@1e784c2aca62a710fa6639d424e60117ff03421b0f3027151a051e6b88c508e8/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:advance-one@46876e0bd709fde79596c3d99f2f6d8930c6b07bcc82161e8e9fe4fcd41acc55/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.
- `game:library:advance-two@b50d2931b3cc37a0f0b72eefa58e10f1be773d3f9d25ba2b0f2bfbbd63773a8b/ply/0/comment/0/text/0-22` — Exact structure, one missing pawn and one/two advanced pawns are useful spatial references; the three-advance diagram is a distractor.

| Rank | Passage location |
| ---: | --- |
| 1 | library:same / ply 0 |

## black-turn

en; turn. Keywords: analogy.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1`. All terms required: false.

- `game:library:black@379ab1812c1701e73d0f9b9ebca078c49fe06e5ff34fddfc887b22cae7adde8c/ply/0/comment/0/text/0-22` — Only the black-to-move source is dynamically compatible.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## in-check

en; check. Keywords: analogy.

Expected:

Query FEN: `r1bqkbnr/pppppppp/8/8/8/3n4/PPPPPPPP/RNBQKBNR w KQkq - 0 1`. All terms required: false.

- `game:library:checked@acdd3471f0c2b00efb1c1f74c24c130fded88d796e1662aca6a367732fac50cc/ply/0/comment/0/text/0-22` — An exact checked diagram is relevant; quiet structures cannot substitute for it.

| Rank | Passage location |
| ---: | --- |
| 1 | library:checked / ply 0 |

## quarter-boundary

en; boundary. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1`. All terms required: false.

- `game:library:boundary@82dc82a45b6cb249f7f0a6c13152fad342009f137b948c01f4f93c3413bce889/ply/0/comment/0/text/0-22` — Three of four pawn squares remain; one missing pawn is a useful spatial analogy.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## single-pawn-shift

en; sparse. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/5P2/8/4K3 w - - 0 1`. All terms required: false.

- `game:library:single@d5b114cf2a1cce77428dbc717c3a30241ef6ef114d86fffcee432e3f26f5427e/ply/0/comment/0/text/0-22` — A one-square advance in a one-pawn diagram is spatially nearby, although square-set overlap will miss it. No plan transfer is asserted.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## pawnless

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `7k/8/8/8/8/8/8/K7 w - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## unrelated

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `4k3/8/p7/8/8/4PPPP/8/4K3 w - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## wrong-turn-boundary

en; no-answer. Keywords: analogy.

Expected:

Query FEN: `4k3/8/8/8/8/8/PPPP4/4K3 b - - 0 1`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |
