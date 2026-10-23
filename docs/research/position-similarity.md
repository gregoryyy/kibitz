# Chess position similarity by aspect

Research date: **2026-10-23**. Companion to [ROAD 10](../ROAD.md#10-position-similarity-by-aspect); informs TODO 8.1, 8.4, 8.5 and 8.8. Application audit: **`0176c62`**. This note proposes research and evaluation, not a selected metric, implementation or reproduced benchmark. The broader retrieval studies are in [research PR #41](https://github.com/gregoryyy/kibitz/pull/41).

## Similar in what respect?

Use a family of comparisons conditioned on the question. Two positions can share a pawn skeleton but demand different tactics; two very different boards can teach the same combination. The desired relationship is “relevant example for this aspect”, not necessarily “fewest pieces moved”.

| Aspect | Features to emphasise | Important counterexample |
| --- | --- | --- |
| Opening / transposition | Exact position, side to move, castling/en-passant rights; stored opening continuations. | Same opening name with a materially different position. |
| Pawn structure / plans | Pawn placement and chains, majorities, open files, weak squares and available breaks. | Same pawns but a tactic refutes the proposed plan. |
| Tactics / calculation | Verified motifs, forcing events, piece roles, solution branches and outcome. | Similar-looking fork with a pinned or capturable attacker. |
| King safety | Checks, attack/defence relations, king shelter, open lines and available defenders. | Many attackers with no effective entry or forcing continuation. |
| Piece activity | Mobility, controlled squares, attack/defence edges and functional roles. | Equal relationship counts involving entirely different targets. |
| Endgame technique | Material class, pawn placement, king activity, side to move and relevant draw state. | A visually close position across a winning/drawing boundary. |

These are candidate research profiles, not existing settings. The [current tutor aspects](../../site/src/tutor.js) (`last`, `next`, `mind`, `habits`, `games`) organise commentary. A profile such as “pawn structure” cuts across them; do not assume one checkbox uniquely specifies a metric.

For `last`, the retrieval query may need the before-position, move and after-position: an identical board can arise through a different last move. `next` can emphasise checked opportunities and plans; `mind` can emphasise weaknesses and control. `habits` also concerns the learner's thinking process, which a board-only distance cannot express. `games` needs a stated reason for similarity rather than a single implicit profile.

## What exists in Kibitz

[knowledge.js](../../site/src/knowledge.js) supplies `epd()`, `pawnSignature()`, `positionFeatures()`, `buildPositionIndex()` and `similarPositions()`. Retrieval first returns exact EPD matches, then exact pawn-signature matches from indexed positions at ply 12 or later, with at most one structural result per source game. It is a bucket lookup, without a graded distance or an aspect parameter. Exact matches and the pawn fallback are already labelled differently.

The module's material/structure features and motif candidates offer a starting vocabulary. [tools.js](../../site/src/tools.js) adds bounded engine checks for tactics. Some features are heuristic or incomplete; neither their absence nor an exhausted search budget establishes that a concept is absent. Feature verification and availability must travel with a future similarity record.

## Prior research and what transfers

### Chess-specific retrieval

[Ganguly, Leveling and Jones, SIGIR 2014, *Retrieval of Similar Chess Positions*](https://doras.dcu.ie/20378/1/ganguly-sigir2014.pdf), encode board placement, piece reachability and attack/defence connectivity as indexed terms. This enables approximate query-by-example retrieval without requiring identical boards. Their work is a direct precedent for a transparent, non-neural baseline. The authors' benchmark and weights are evidence about that task, not established defaults for Kibitz's lessons or user games.

[Bizjak and Guid, Information Society 2020, *Towards Automatic Recognition of Similar Chess Motifs*](https://is.ijs.si/wp-content/uploads/2020/08/IS2020_submit.pdf), add pawn structures and dynamic solution features, including checks, captures, sacrifices, mating pieces and move-sequence information. Their tactical study includes paired full and simplified exercises. This supports comparing solution structure as well as static appearance, but also makes puzzle-family leakage a concern when designing a new evaluation. Their commercial exercise source is not a dataset to copy into Kibitz.

[Guid, Bizjak, Guid and Krivec, *Reverse-engineering expert similarity judgments: evidence from chess tactics*](https://link.springer.com/article/10.1186/s41235-026-00755-5), published **21 October 2026**, report that solution-level features explained expert tactical similarity judgements much better than static appearance. The published abstract describes 2,866 labels from one primary annotator and validation with two additional titled players. This is particularly relevant new evidence, but scoped to tactical puzzles and those judgements. Only the accessible abstract/metadata were reviewed here; it does not establish a universal metric for openings or strategic plans.

### Conditional metric learning

[Veit, Belongie and Karaletsos, CVPR 2017, *Conditional Similarity Networks*](https://arxiv.org/abs/1603.07810), learn an embedding with masks that select/reweight dimensions for different notions of similarity. Their experiments concern images, not chess. The transferable mechanism is conditioning the representation on the comparison being requested; its chess usefulness remains an experiment.

[Weinberger and Saul, JMLR 2009, *Distance Metric Learning for Large Margin Nearest Neighbor Classification*](https://jmlr.csail.mit.edu/beta/papers/v10/weinberger09a.html), learn a Mahalanobis distance from labelled examples. This offers a simpler learned-distance baseline before training a new encoder. Kibitz would still need labels aligned to its aspects; a broad “endgame” class does not identify which endgames teach the same technique.

### Chess-aware embeddings

[Feng et al., NeurIPS 2023, *ChessGPT*](https://arxiv.org/abs/2306.09200), introduce ChessCLIP alongside ChessGPT. The authors' [ChessCLIP model card](https://huggingface.co/Waterhorse/ChessCLIP) aligns **board/action** representations with text. Its sample inference uses action information, so a fair comparison must specify whether a query contains a position alone or a known move/solution. It is not automatically a drop-in FEN-only distance, and learned alignment does not validate a continuation.

[Hull's ChessLM project (2025 technical report and author repository)](https://github.com/bluehood/Encoder-ChessLM) provides position embeddings trained with masked-piece and move-difference objectives, and a similarity-search example. The author explicitly cautions that structural neighbours may have very different evaluations and that dynamic factors can be underweighted. Treat this as an exploratory baseline, not a peer-reviewed demonstration of aspect-specific retrieval quality.

These sources motivate comparisons, not a winner. Their datasets, inputs and similarity judgements differ; their reported results have not been reproduced here.

## Candidate transparent distances

Start with independently inspectable feature groups:

| Group | Candidate comparison | What must remain explicit |
| --- | --- | --- |
| Exact state | Equality on a canonical position key. | Store full FEN/history context as well; EPD omits counters and repetition history. |
| Material | Normalised absolute differences in per-colour piece counts. | Same total material value can hide different piece classes. |
| Pawn placement | Hamming or Jaccard distance over colour-specific pawn-square sets. | Define the empty/empty case; keep colours and direction meaningful. |
| Pawn structure | Distances over chains, islands, passed/isolated/doubled pawns, majorities and files. | Coarse feature equality can conceal decisive placement differences. |
| Piece placement / mobility | Piece-square planes, control maps or bounded same-type piece assignments. | A geometric displacement cost is not a legal move distance. |
| Relations / roles | Labelled attack/defence edge overlap, motifs and role features. | Define geometric versus legal relations, pins and x-rays. |
| Dynamic continuation | Checks/captures/promotions, verified motifs and role/event sequences. | Use comparable engine budgets and distinguish missing evidence from negative evidence. |
| Learned representation | Normalised embedding distance, optionally conditioned on aspect. | Record encoder/version, inputs, normalisation and training/evaluation split. |

For pawn placement, a square-set distance is a cheap baseline. An optional assignment/transport comparison could make nearby pawn shifts less costly than unrelated structures, with explicit penalties for unmatched pawns. That is a proposed heuristic; it must not imply that pawns can legally move backward or between arbitrary files.

For relations, [ROAD 9's four corner counts](../ROAD.md#9-piece-power-attacks-and-defence-in-four-corners) are a compact summary of graph degrees. Retain the underlying typed edges for retrieval: who attacks/defends whom, their roles, and the relevant squares. Equal counts do not imply equivalent relationships. An overloaded defender depends on its obligations, not just its number of outgoing defence edges.

For tactics, compare a checked event/role pattern rather than raw SAN strings. Literal move notation varies with square and move order; a single PV also misses other reasonable defences. Compare bounded verified continuations and record the horizon. An unconfirmed motif must not become confirmed because it resembles a labelled example.

Engine score proximity can be a filter or supplementary feature. It is a poor standalone definition: many unrelated positions are approximately equal. Keep mate scores and centipawns distinct and use a consistent score perspective; do not equate similar scores with the same plan.

## A possible aspect-conditioned score

For validated positions `q` and `p`, aspect `a`, normalised component distances `d_g` and fixed non-negative aspect weights `w[a,g]`, a first experiment is:

```text
D_a(q,p) = sum_g(w[a,g] * d_g(q,p)) / sum_g(w[a,g])
S_a(q,p) = 1 - D_a(q,p)
```

Require a non-zero weight sum and component distances in `[0,1]`. Version the feature definitions, scales and profiles. Begin with interpretable presets such as pawn-heavy, tactic-heavy and endgame-heavy; tune on labelled development queries rather than declaring arbitrary weights optimal. `S_a` is a ranking score, not a probability that advice transfers.

Apply ownership, help-level and task-specific eligibility filters separately from the score. Retrieve a union of candidates from the relevant indexes, then rerank; taking only the current exact-pawn bucket would prevent a tactic-oriented metric from finding different-looking positions. Return exact matches separately, retain diverse game occurrences and allow “no sufficiently relevant example”.

### A metric or a relevance function?

A mathematical metric needs non-negativity, symmetry, identity of indiscernibles and the triangle inequality. A weighted sum of fixed component metrics after lossy feature projections is generally only a **pseudometric on full positions**: distinct boards may have distance zero because the selected features coincide. That can be appropriate for “same pawn structure”.

Query-dependent weights, pair-specific missing-feature renormalisation, learned pairwise scoring and asymmetric teaching relevance need not preserve metric properties. A simple `1 - cosine` distance also does not generally satisfy the triangle inequality. Use appropriate distances, such as Euclidean distance on normalised vectors, if an index or experiment requires those properties.

For learned representations, compare a shared encoder plus an aspect-specific mask/projection with separate encoders. A triplet `(q, relevant, less_relevant, aspect)` can express that the preferred neighbour changes with aspect. This is a proposed training design inspired by conditional similarity learning, not a claim that the image model already solves chess retrieval.

Missing analysis should produce a disclosed incomplete score or an unranked candidate, under a defined policy. Do not silently treat “not computed” as zero distance or “no tactic”. Keep confidence/coverage separate from similarity.

## Position normalisation and context

- A visual board flip changes presentation, not chess identity or the metric.
- Colour-relative roles can help compare the learner's side with an analogous opponent-side position. Record the transformation and show the original source; exact transposition retrieval must retain actual colours, side to move and rights.
- Do not assume arbitrary board rotations or reflections preserve chess semantics. Pawn direction, castling, en passant and move mapping need explicit handling. Test any permitted transformation and label it as an analogy.
- A board key is insufficient for every endgame or continuation claim. Retain full FEN, game occurrence and available repetition history; disclose what the engine/tablebase check actually considered.
- If several aspects are requested, offer a documented mixture or separate result groups. An unlabelled global score can hide that an excellent pawn match is a poor tactical match.

## How to evaluate it

Create query/candidate judgements **per aspect**, with graded relevance and a short reason. Collect pairwise or triplet preferences from several chess-aware annotators and, separately, learners. Measure agreement rather than assuming experts and beginners use the same criterion.

Include deliberately difficult pairs:

- same pawns, different tactic;
- different appearance, same checked combination;
- same attack/defence counts, different targets or overloaded defenders;
- same engine score, different plan;
- an exact transposition versus a near match with different rights;
- an endgame near a draw boundary, including relevant counter/history differences;
- empty pawn sets, promotions and missing engine evidence.

Split training/tuning/test queries by source game, puzzle family and near-duplicate/transposition groups. Avoid treating adjacent plies or a simplified puzzle and its original as independent training and test examples. Use permitted, reproducible sources; the older papers' evaluation collections are not automatically redistributable.

Compare: current exact/pawn buckets; material/pawn distances; symbolic relations and motifs; aspect-weighted features; a chess-aware embedding; and a conditional learned scorer. Report nDCG@k, precision/recall@k, triplet preference accuracy, no-answer behaviour, source diversity and latency/storage by aspect. Inspect regressions as well as averages. Separate search-parameter tuning from the final held-out comparison.

For any claimed metric properties, check them analytically where possible and with counterexample tests. For teaching usefulness, test whether the retrieved example helps a learner solve a new position. Human-rated relevance, engine correctness and learning gains are different outcomes.

## Proposed next steps

1. Agree on aspect definitions and label a small evaluation set before choosing weights.
2. Implement pure feature comparisons with explained match reasons, using current retrieval as the baseline.
3. Add relation/dynamic features with explicit verification status; measure how rankings change by aspect.
4. Compare learned embeddings and conditional masks only after the transparent baseline is established.
5. Connect successful retrieval to cited games/lessons; reanalyse advice in the current position before displaying it.

No similarity function should transfer a historical move directly to a new board. The neurosymbolic use is to retrieve a relevant analogy through explicit features or learned representations, verify its chess implications, then let the model explain the connection and its limits.
