# Position retrieval compared with the literature

Review date: **2026-10-24**. Implementation audited at **`2933295` on `main`**. This compares the implemented TODO 8.1–8.8 retrieval paths with published methods and identifies experiments that would close specific gaps. Literature algorithms have **not** been run against Kibitz's corpus; published scores below retain their own tasks and denominators.

The earlier [aspect-similarity proposal](position-similarity.md) defines possible research profiles. This document updates the implementation comparison after material/placement indexing, pattern browsing, passage search, hybrid fusion and fuzzy pawn distance shipped. It concerns retrieving examples; selecting a move, checking an explanation and measuring learning are separate tasks.

## Which Kibitz algorithm is being compared?

| Implemented path | Representation and retrieval | Scope and limitation |
| --- | --- | --- |
| Reading / “seen before” | [`similarPositions()`](../../site/src/chess/knowledge.js) looks up EPD strings, then identical pawn-signature buckets. Structural entries start at relative ply 12; at most one structural hit per game survives. | Exact hits precede analogies; ties follow index order. No graded board distance, text intent or turn/check/phase filter on pawn analogies. |
| Material and placement lookup | [`positionFeatureMatches()`](../../site/src/chess/knowledge.js) queries colour-specific material counts, full piece placement, or intersections of occupied piece-square terms. | Bounded predicates retain occurrences; these indexes do not rerank Reading or Combined search. Placement equality omits turn/rights; EPD identity retains them. |
| Pattern browsing | [`patterns.js`](../../site/src/library/patterns.js) indexes detected position, recorded-move and short combination tags after legal replay. | `heuristic`, `candidate` and `rules` evidence remain distinct. This is tag filtering, without graded similarity between solution sequences. |
| Combined Library search | [`hybrid-search.js`](../../site/src/library/hybrid-search.js) fuses keyword, optional dense, board and tag lists: up to twenty candidates per channel, reciprocal-rank constant 60, then complete-term and exact-board reranking. | Board analogies require matching turn, check state and heuristic phase. It returns passages; a passage can enter through text without a compatible board relation. |
| Optional fuzzy board channel | [`pawn-distance.js`](../../site/src/library/pawn-distance.js) uses colour-specific pawn-square Jaccard distance; the UI admits distance ≤ 0.25 when explicitly enabled. | Nonempty pawn sets are required for analogies. Used in Combined search; Reading and automatic cited coach retrieval retain exact-pawn behaviour. |
| Passage embeddings | [`dense-search.js`](../../site/src/library/dense-search.js) ranks explicitly embedded annotation/guide text by cosine similarity, with provider/model/revision/dimension checks. | These are text vectors, not trained board/action embeddings. No board encoder, approximate-nearest-neighbour index or solution encoder is installed. |

EPD equality here means equality of the first four FEN fields, not equality of game history or draw state. Full FEN and occurrence/revision IDs preserve the source arrival and its note. A transposition can share an EPD while two notes remain different retrieval targets. See the [library schema](../design/library.md) and [citation lifecycle](../design/retrieval.md#retrieved-coach-passages-and-citations).

## Algorithm comparison

The mechanisms in the middle column come from the linked primary sources. The final column is our assessment against the code above, not a performance result.

| Literature method | Query, representation and ranking | Relationship to Kibitz |
| --- | --- | --- |
| [Ganguly, Leveling & Jones, SIGIR 2014, *Retrieval of Similar Chess Positions*](https://doras.dcu.ie/20378/1/ganguly-sigir2014.pdf), §§5–6 | FEN query becomes piece-square and attack/defence/X-ray terms. Indexed boards also contain distance-weighted reachable-square terms. Lucene BM25 retrieves 1,000 positions, then retains the best position per game. | A direct symbolic query-by-example baseline to implement. Kibitz's occupied-square predicates supply part of the vocabulary, but neither they nor pawn Jaccard implement this relational expansion/ranking. The paper's game grouping also differs from Kibitz's occurrence-sensitive queries. |
| [Bizjak & Guid, Information Society 2020, *Towards Automatic Recognition of Similar Chess Motifs*](https://is.ijs.si/wp-content/uploads/2020/08/IS2020_submit.pdf), §3 | Starting FEN **and solution moves** become BM25 terms: static placement/connectivity/pawn features plus captures, checks, promotion, sacrifice, mating pieces and consecutive piece-event pairs. | Targets tactical analogy beyond similar appearance. Kibitz's short recorded-line tags provide useful ingredients, but they neither encode complete solutions nor rank solution-event overlap. A supplied solution and a freshly analysed position need separate input/budget conditions. |
| [Guid, Bizjak, Guid & Krivec, 2026, *Reverse-engineering expert similarity judgments*](https://link.springer.com/article/10.1186/s41235-026-00755-5), similarity-search and classification sections | BM25 candidate retrieval precedes supervised pair classification. ExtraTrees uses static/dynamic/theme features and differences; evaluation groups pairs by query. | A possible learned reranker and labelling protocol, not a replacement exact-position index. Kibitz has no trained expert-similarity model. Its tactical results cannot establish opening or strategic-plan similarity. |
| [Costeff & Stiller's CQL, official introduction](https://www.gadycosteff.com/cql/) and [sorting](https://www.gadycosteff.com/cql/sort.html) | Users specify board/move patterns, optional transformations and ordering criteria. | Closest to Kibitz's explicit material/piece/tag predicates, with a much richer query language. CQL supports sorting: the 2014 paper's criticism of its then-current ranking must not be repeated as a current blanket limitation. No CQL integration is present. |
| [Feng et al., NeurIPS 2023, *ChessGPT*, §4.1 and Appendix F.1.1](https://arxiv.org/html/2306.09200v2#S4.SS1) / ChessCLIP | Contrastive alignment of board history plus action with annotation text; board/action and text encoders support cross-modal retrieval. | Unlike generic passage embeddings, it could connect a described concept with a chess trajectory. A FEN-only query is a different input condition; action/history availability must be declared. Not implemented or evaluated here. |
| [Hull's Encoder-ChessLM, author repository](https://github.com/bluehood/Encoder-ChessLM) and [2025 technical report](https://bluehood.github.io/research/benh_Beyond_Evaluation__Learning_Contextual_Chess_Position_Representations_2025.pdf) | Transformer position representations trained with masked-piece and move-difference objectives; an example retrieves embedding neighbours. | A candidate board-vector baseline. The author's qualitative analysis identifies neighbours with large evaluation differences. Structural resemblance therefore needs tactical/draw-boundary counterexamples. This is an exploratory technical report, without a Kibitz comparison. |
| [Veit, Belongie & Karaletsos, CVPR 2017, *Conditional Similarity Networks*](https://arxiv.org/abs/1603.07810) | Learned embedding masks select/reweight dimensions for different similarity notions; demonstrated on images. | A mechanism for the proposed pawn/tactic/endgame profiles. Chess labels and evaluation would be new work; changing tutor checkboxes or using fixed weights does not reproduce the learned method. |

### Pawn overlap and rank fusion are narrower components

For colour/square sets A and B, Kibitz computes `d = 1 − |A ∩ B| / |A ∪ B|`, with empty/empty defined as zero. Replacing one pawn square in a sixteen-pawn position gives `2/17 ≈ 0.118`, whether the displacement is one rank or several. Advancing the only pawn in a sparse ending gives distance one. This follows directly from the implemented formula: it measures overlap, without accounting for distance travelled, legal reachability, piece relationships or the solution. The [pawn-distance specification](../design/retrieval.md#fuzzy-pawn-structure-distance) records the threshold and sparse miss.

[Cormack, Clarke & Büttcher's RRF (SIGIR 2009)](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf) combines ranks using `sum(1 / (k + rank))`; their experiments used `k = 60`. Kibitz adopts that form, then applies its own term/exact-board ordering. RRF combines existing candidates; it cannot recover an example omitted from every channel or create a missing solution-similarity signal. Its final score is not a calibrated relevance probability. The [hybrid comparison](../design/retrieval.md#hybrid-passage-retrieval) measures the resulting tradeoffs locally.

## What the existing numbers establish

### Kibitz results, within each fixed suite

| Recorded task | Method | P@1 | Recall@3 | MRR@3 | No-answer false-positive rate |
| --- | --- | ---: | ---: | ---: | ---: |
| [Position baseline](../eval/retrieval/baseline.md): 21 documents, 481 occurrences; 18 answerable + 6 no-answer queries | Reading exact EPD / identical pawns | 0.833 | 0.861 | 0.852 | 0.667 |
| [Spatial suite](../eval/retrieval/pawn-distance.md): 10 diagrams; 5 answerable + 3 no-answer queries | Exact pawn placement, compatible boards | 0.400 | 0.250 | 0.400 | 0.000 |
| Same spatial corpus, queries and eligibility | Pawn Jaccard ≤ 0.25 | 0.800 | 0.750 | 0.800 | 0.000 |
| [Passage suite](../eval/retrieval/hybrid-bge-m3.md): 159 passages; 20 answerable + 8 no-answer queries | BM25 text | 0.900 | 0.950 | 0.917 | 0.250 |
| Same passage corpus and queries; recorded Ollama bge-m3 run | Dense text | 0.950 | 1.000 | 0.975 | 1.000 |
| Same passage corpus and queries; recorded bge-m3 candidates | Hybrid | 0.900 | 0.950 | 0.925 | 0.875 |

Only rows sharing a task permit a direct within-suite comparison. Position results score source occurrences or documents; passage results score passages. The spatial suite isolates the board component, without dense candidates or matching fixture text. Its exact variant includes compatibility checks absent from the older Reading fallback. It is therefore not the older retriever with only one switch changed. Answerable-query metrics and no-answer rates use separate denominators.

These are small authored development suites, not held-out estimates. The hybrid table preserves the original recorded policy; later fuzzy-pawn support does not retroactively alter that run. Its separate ten board/intent queries are also not a head-to-head test of the literature methods. Higher passage recall alongside more no-answer results does not establish better board similarity, abstention or teaching.

### Literature results, on their own tasks

| Source | Published experiment and result | Comparison limit |
| --- | --- | --- |
| [Ganguly et al. 2014, §7 / Table 3](https://doras.dcu.ie/20378/1/ganguly-sigir2014.pdf) | 25 queries, pooled five-level human judgements. `CombAll`: P@5 **0.4233**, MAP **0.3926**, nDCG@5 **0.4188**, nDCG **0.6922**. | Table 3 assigns 0.4233 to P@5; the abstract calls it MAP. We use the table. Different corpus, labels, grouping and cutoffs prevent comparison with Kibitz's P@1/MRR@3. |
| [Bizjak & Guid 2020, §4.1 / Table 1](https://is.ijs.si/wp-content/uploads/2020/08/IS2020_submit.pdf) | 400 full/simplified puzzle pairs. Matching-pair top-1/top-5: static **0.252/0.370**; dynamic **0.418/0.652**; combined **0.481/0.736**. | Paired-puzzle recovery, with known solutions, differs from general position relevance. Commercial CT-ART material is not imported here; simplified/original pairs require family-aware evaluation. |
| [Guid et al. 2026, classification framework / Table 2](https://link.springer.com/content/pdf/10.1186/s41235-026-00755-5_reference.pdf) | 2,866 labelled pairs from 324 queries; tenfold query-grouped ROC-AUC: static **0.554**, dynamic **0.901**, all features **0.904**. | Pair classification among retrieved tactical candidates, not recall over the full database. Primary annotations come from one player, with two further titled-player checks. Accepted article-in-press published 21 October 2026; no Kibitz replication. |

The 2020 combined-feature result and the 2026 dynamic-feature result address different labels and selection procedures. They do not supply universal weights for every chess aspect. Our inference is narrower: **evaluate solution-aware tactical retrieval separately from pawn/placement resemblance**, and retain exact occurrence retrieval for requests about a specific source note.

## A fair next comparison

Use the [position benchmark adapter](../design/retrieval.md#extending-the-benchmark) for methods returning occurrences; keep passage experiments in the passage harness. A supervised pair classifier additionally needs its own grouped classification evaluation before being assessed as a reranker.

1. **Freeze eligibility and inputs.** Give all position methods the same permitted, legally replayed sources and stable occurrence IDs. Declare whether queries contain only FEN, a played move/history, a supplied solution, or a bounded engine analysis. Use comparable analysis budgets; do not give only one method the gold solution or labels.
2. **Add transparent ablations first.** Compare exact/pawn buckets, pawn Jaccard, occupied-piece terms, then a faithful 2014-style reachability/relation encoding. Preserve distance weights and best-per-game grouping in a reproduction; report occurrence-aware adaptations separately. Add 2020-style solution terms on a tactical suite with available/checked continuations.
3. **Keep candidate generation visible.** For each method, report candidate recall before reranking and final nDCG/MRR. Compare the same candidates when isolating a reranker's effect. Record truncation, source diversity and ties; twenty candidates per channel can hide a relevant result before scoring.
4. **Label similarity by aspect.** Include identical pawns with a refuting tactic, different boards with the same combination, sparse pawn advances, repeated notes, changed rights and endgames across a draw boundary. Collect graded reasons and annotator agreement. Keep absence of analysis distinct from absence of a motif.
5. **Split before tuning.** Group by source game, transposition/near-duplicate family and original/simplified puzzle family. Tune thresholds/weights on development groups; report held-out precision/recall/nDCG, no-answer behaviour, latency and storage by aspect. Classifier AUC and retrieval recall remain separate measurements.

This is a proposed experiment sequence. No external corpus, model weights, provider calls or literature implementations were added. The review checked the 2014 and 2020 methods/results and the accessible 2026 full accepted manuscript; learned-model sources and official CQL/RRF documentation supply the remaining mechanism comparisons. This selective review does not establish a best algorithm or a learning benefit.
