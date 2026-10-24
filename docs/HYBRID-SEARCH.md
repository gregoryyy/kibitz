# Hybrid passage retrieval

TODO **8.4** combines the existing [passage retrievers](TEXT-SEARCH.md) with explicit board context. In **Library → Search study text**, select **Combined**, build the selected source/language index and press **Search combined**. Default **Keywords** remains local and unchanged. Combined search uses the separately configured embedding service under the same explicit-ingestion, local-only, budget and model-identity rules as **By meaning**.

Two independent options express intent:

- **Favor the current board** adds exact-position, pawn and shared-feature signals for the visible game or scratch position. The FEN/features stay local; embedding queries contain only the entered text.
- **Require every search term** keeps only passages whose title/body contains all normalised non-stopword query terms. This supports exact lookups and empty results. It can reject useful paraphrases and does not establish semantic support or chess correctness.

TODO **8.5** adds **Include similar pawn structures**, enabled with board relevance. It permits at least 75% colour-specific pawn-square overlap and shows unmatched squares. It defaults off; [metric and spatial benchmark](PAWN-DISTANCE.md) record the definition and sparse-position limitations.

Results distinguish complete term coverage from merely related text. **Why this result** shows which paths found the passage, any exact/pawn relation and shared feature labels. The existing literal text, source/licence and exact annotated-position navigation remain available. No result is added to a tutor prompt by this feature.

## Candidate channels and reranking

[`hybrid-search.js`](../site/src/library/hybrid-search.js) is pure JavaScript with an injected chess.js constructor. A detached source index combines the existing BM25 index with cached legal-board profiles. Source/language/collection filters apply before every candidate channel and its statistics. Each channel contributes at most twenty candidates:

| Channel | Signal and boundary |
| --- | --- |
| Keywords | Existing title/body BM25, including German move-letter aliases. No positive score means no lexical candidate. |
| Meaning | Cosine-ranked vectors from the current selected source index and identical embedding identity/dimensions. Returned IDs must belong to the eligible local corpus. |
| Position | Exact EPD, including turn/castling/legal en-passant rights; otherwise nonempty pawn placement with matching turn, check state and phase. Default distance is zero; 8.5 optionally permits Jaccard distance up to 0.25 and orders this channel by increasing distance. Pawnless positions do not gain a pawn-analogy signal. |
| Feature tags | Jaccard overlap of current position-feature tags. Annotation tags come from legal FENs; an authored guide contributes its known catalogue concept. Generic phase/king-activity tags are omitted. An annotation with incompatible turn/check/phase receives no tag boost. |

Imported titles, prose and claimed theme metadata cannot create board facts. Feature detection remains heuristic; no Stockfish search or tactical verification occurs here. Guides remain general background without an invented FEN. Source check/phase compatibility limits a board boost, not all text retrieval: an incompatible historical board can still be a relevant text result, without a matching-board badge.

Candidates merge by revision-bound passage ID. Reciprocal Rank Fusion sums `1 / (60 + rank)` for each channel containing a passage. The fixed constant follows the published [RRF baseline](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf); it was not tuned on Kibitz's labels and is not a claim of an optimal chess setting. Raw BM25, cosine and tag scores are never added. The four bounded lists yield at most eighty distinct candidates.

The deterministic reranker orders full literal term matches first, then exact-board matches, then fused rank score and stable passage ID. Text intent can therefore outrank an unrelated exact board. An enabled every-term constraint removes incomplete matches before the final result limit. It operates on the bounded candidate union; an empty result is not an exhaustive proof that no source passage contains the terms. The interface returns at most eight passages; the pure API permits twenty. Cosine positivity, fusion agreement, exact board identity and complete term coverage are all retrieval signals, not evidence that a source answers the question.

## State and source boundaries

The hybrid source index and vectors are derived memory, with no new persistence or server cache. Sources still compile through the legal, revision-bound library snapshots. A provider result cannot replace the canonical source title, locator, occurrence, licence or text by supplying different metadata under a known ID. Unknown, stale, duplicate, nonfinite or out-of-scope dense candidates are refused.

Changing the board-relevance/term options cancels results but retains otherwise valid source vectors. Stepping the main or scratch board invalidates pending work and held result actions when board relevance is active, even without changing the game generation. The query captures its visible board and intent before awaiting an embedding. Source/account/method/language/local-only/help changes retain the existing stricter invalidation rules; source and policy changes erase vectors. No option change, board step or typing automatically sends a replacement query.

The hybrid path reuses the stateless embedding endpoint and its destination review. Keys remain on the gateway. It adds no new provider, generative prompt, external source, dependency or `llmkit` code. Sources and snippets remain DOM text nodes; source navigation replays the PGN and rechecks current game, source revision, selection and board intent.

## Measured comparison

The root utility supports an explicit provider run:

```sh
EMBEDDING_PROVIDER=ollama EMBEDDING_MODEL=bge-m3:latest \
  EMBEDDING_REVISION=<installed-model-digest> \
  node utils/retrieval-eval.mjs --mode hybrid --out docs/eval/retrieval/hybrid-bge-m3
```

No `.env` or saved player data is loaded. Cloud evaluation additionally requires `--allow-cloud`; automated tests use fake/mock clients only. The runner uses one ingestion and reuses query embeddings across method ablations. Adapters receive the literal question, explicit board/term options and source scope, never gold judgements or case IDs.

The [recorded local bge-m3 report](eval/retrieval/hybrid-bge-m3.md) and [JSON](eval/retrieval/hybrid-bge-m3.json) use the same 159 authored passages and 28 text queries as the previous lexical/dense reports. The manual run used the already installed F16/1024-dimensional model, its recorded supplied digest, Ollama 0.40.7 and Apple M1 Pro Metal. The isolated daemon had cloud use and model pruning disabled; no model was downloaded. Boardless text cases exercise the two text channels and term reranking:

| Method | Precision@1 | Recall@3 | MRR@3 | Labelled no-answer false positives |
| --- | ---: | ---: | ---: | ---: |
| BM25 | 0.900 | 0.950 | 0.917 | 0.250 |
| Dense | 0.950 | 1.000 | 0.975 | 1.000 |
| Hybrid | 0.900 | 0.950 | 0.925 | 0.875 |
| Hybrid, every term required | 0.850 | 0.850 | 0.850 | 0.000 |

Hybrid is **not a uniform improvement**. It loses some paraphrase recall compared with dense alone. The optional literal filter rejects all eight labelled no-answer cases, while dropping three of twenty answerable queries. The unchanged lexical gold has the previously documented Isolani/language ambiguity; these are metrics against fixed development labels, not a general semantic-error estimate. The default remains Keywords, and every-term filtering is an explicit choice.

A separate ten-query board/intent suite covers repeated first/second notes, QGD transposition, quiet/checked IQP positions, castling rights, legal en passant, excluded sources and unsupported/empty intent. Both BM25 and hybrid reach precision@1/recall@3 of 1.000 with the **same explicit term constraints**, and reject its three no-answer requests. This small, straightforward set demonstrates no ranking advantage; it is a reproducible workflow baseline. Its labels and aggregates are separate from the twenty-eight text queries. Independent geometry, source and browser tests exercise board/tag discrimination and asynchronous state boundaries.

## Limits and follow-up

This implements bounded fusion and deterministic reranking, without a learned cross-encoder or model-specific relevance threshold. Calibrated semantic abstention needs separately reviewed intent/support labels, source-family splits and held-out evaluation. The literal filter is not a substitute, and no similarity score is shown as confidence.

Material/piece-placement signatures remain 8.1 and richer per-position/move motif tags remain 8.2. [Cited coach context](RETRIEVAL-CITATIONS.md) followed in 8.6, using the local keyword/board/tag channels without automatic embedding uploads. Optional [fuzzy pawn distance](PAWN-DISTANCE.md) followed in 8.5; the recorded 8.4 comparison retains its original policy. Current board features can select an analogy; engine evidence must still check any advice in the current position. Larger licensed corpora, persistence and source deduplication remain milestone 7.
