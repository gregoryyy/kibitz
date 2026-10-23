# Position retrieval evaluation

TODO 8.8 establishes a repeatable offline baseline for the existing `similarPositions()` retriever. The [recorded report](eval/retrieval/baseline.md) and [JSON results](eval/retrieval/baseline.json) measure relevance before text indexing and hybrid ranking. The [tutor-answer evaluation](../site/eval/README.md) measures a different stage.

TODO 8.3.1 subsequently adds the separate [lexical passage benchmark](TEXT-SEARCH.md#measured-baseline), selected with `just retrieval-eval --mode text`. Its source passages, query set and relevance unit differ from the position suite; the default position baseline remains unchanged.

Explicit `--mode dense` and `--mode hybrid` comparisons followed in 8.3.2/8.4. They call the configured embedding provider on authored data, require `--allow-cloud` for cloud providers and never load `.env` or saved player data. The [hybrid report](HYBRID-SEARCH.md#measured-comparison) separates unchanged text queries, an every-term ablation and ten board/intent cases.

TODO 8.5 adds an offline `--mode pawns` [spatial benchmark](PAWN-DISTANCE.md#reproducible-spatial-benchmark) with ten original diagrams/eight separate queries. It compares the production exact/fuzzy position component, including an intentional sparse false negative; its corpus, labels and relevance task are separate from this original position suite.

## Running

From the repository root, with the site's npm dependencies installed:

```sh
just retrieval-eval
just retrieval-eval --json
just retrieval-eval --out docs/eval/retrieval/baseline
```

The first two print to stdout. `--out` explicitly writes `<stem>.md` and `<stem>.json`, creating their parent directory. Alternatively use `npm --prefix site run eval:retrieval`, or `node utils/retrieval-eval.mjs`. Output paths are relative to the caller's working directory. The utility also runs from outside the checkout using its absolute path. It needs no build, browser, Stockfish search, model, network, `.env` or saved user library.

The root `utils/` command calls app-specific code in `site/eval/retrieval/`, covered by the site's lint/type checks. There is no dependency on, import from, or change to `llmkit`; its independent test-oracle approach was inspiration.

## Corpus and judgements

[corpus.mjs](../site/eval/retrieval/corpus.mjs) contains thirteen packaged classics/studies and eight original test scores: two transposing QGD routes, repeated knight arrivals, three IQP examples, castling rights and legal en passant. That is **21 documents, 481 indexed occurrences and 45 annotations**. Sources retain the [library model's](LIBRARY.md) separate score/annotation licence assertions. Fixtures declare the project's licence; historical score rights remain not supplied. No third-party passages were added.

[cases.mjs](../site/eval/retrieval/cases.mjs) defines **24 manually labelled queries** in English/German: eighteen answerable and six no-answer cases. Labels name a collection, game ID and relative ply, or a whole document for general analogies. Each positive has a reason and grade: 2 for directly relevant, 1 for a useful analogy. Unlisted candidates are non-relevant to that request. An identical-board request rejects pawn-only analogies; a request for the second note rejects the first occurrence and another game's matching board.

An IQP distractor shares the pawn signature but leaves White in check, making it unsuitable for a quiet-plan request. Steinitz–von Bardeleben remains a positive analogy: it is an actual classic with the same pawns, different pieces, and a later rook move to e1. These labels concern reference relevance, without claiming an engine proves any plan or move best.

The compiler replays every score with chess.js and resolves manual selectors to revision-bound document/occurrence IDs. Duplicate query/document IDs, invalid positions, stale/missing/excluded gold selectors, inconsistent no-answer labels and duplicate/invalid grades fail validation. Exact/transposition/occurrence positives must share the query EPD. Corpus and case SHA-256 values identify the ordered inputs; source revisions bind references to their PGN. Insertion order matters because the baseline uses it for ties.

## Metrics

The runner requests six production candidates once per query, then scores prefixes at **k = 1, 3 and 6**:

| Metric | Definition |
| --- | --- |
| Precision@k | Distinct relevant references in the first k slots, divided by k, even for short lists. |
| Recall@k | Distinct relevant references found, divided by all positives for that query. |
| MRR@k | Reciprocal rank of the first relevant reference, or zero if none occurs in the prefix. |
| nDCG@k | Gain `(2^grade - 1) / log2(rank + 1)`, divided by the ideal positive ordering at that cutoff. |
| No-answer false-positive rate | Fraction of no-answer queries returning any candidate; lower is better. |

Relevance metrics are macro means over answerable queries. No-answer cases have null relevance metrics and a separate denominator, preventing empty cases from inflating precision. Duplicates consume ranks but receive credit once. Document-level queries project occurrences to their document before scoring. Unknown, excluded or inconsistent returned occurrence references fail the run.

Reports contain per-query FENs, judgements, ranked source/occurrence and annotation IDs, match kinds, metrics, and summaries by class/language. No timings or timestamps enter these deterministic reports. Unit tests compare the recorded baseline: changing the corpus, labels or retrieval requires reviewing and regenerating it. Known weaknesses remain visible rather than being hidden behind an all-green quality threshold.

## Initial findings

The baseline has **precision@1 0.833, recall@3 0.861 and MRR@3 0.852** across answerable cases. All twelve exact/transposition cases put a relevant result first. Occurrence-specific cases fail at rank one: shared early boards in other games precede the requested repetition-game notes, and the second note follows the first. IQP queries retrieve useful analogies but place the directly matching rook placement below broader examples and also return the checked distractor.

Four of six no-answer requests receive results: **false-positive rate 0.667**. Pawn-only analogies appear for exact-only requests, including pawnless rook positions. This records the lack of query-intent filtering; retrieval behaviour is unchanged by this slice.

Precision falls at larger k when only one reference is relevant, so read it alongside recall/ranking metrics. English/German slices contain different case mixes; paired queries have equal rankings because the current retriever ignores their text. This does not establish multilingual understanding.

## Extending the benchmark

Add original or appropriately sourced fixtures and manually reviewed labels, increment `SUITE_VERSION`, and regenerate reports. When expanding the corpus, review all candidates for new positives: labels are exhaustive only for their recorded corpus and request. Changed PGN alters revision IDs even if game ID and ply stay the same.

`runRetrievalBenchmark({ name, retrieve })` accepts future retrieval adapters over the same snapshots and candidate IDs. An adapter receives question text, language, FEN, relevance unit and current-game exclusion. Gold judgements, query IDs and evaluation groups—including the no-answer label—are withheld. It returns ordered occurrence records, which the scorer projects to the relevance unit. Passage retrieval will need an annotation/passage unit and text-specific cases.

This small authored development suite is not a held-out generalisation estimate. The [lexical/dense passage baselines](TEXT-SEARCH.md) and [hybrid comparison](HYBRID-SEARCH.md) followed in 8.3/8.4. Source/account/filter/deletion boundaries have unit/browser tests; larger update/deletion benchmarks, graph synthesis, semantic support/abstention and latency/cost studies remain later work. Chess correctness and teaching quality need separate checks.
