# RAG methods for a chess coach

Research date: **2026-10-23**. Recommendations for [TODO 7–8](../TODO.md), based on the repository at **`0176c62`**. No retrieval experiments or new infrastructure have been implemented by this document.

## What RAG means here

An index is a way to find records. Retrieval-augmented generation adds a second step: retrieved evidence conditions the generated answer. It does not require embeddings, a vector database or a knowledge graph. The original [Lewis et al. RAG paper (2020)](https://arxiv.org/abs/2005.11401) combines a learned retriever with a generator for knowledge-intensive tasks; its training architecture is one implementation, not a requirement to retrain Kibitz's providers.

For this project, distinguish three evidence types:

| Evidence | Example | What it supports |
| --- | --- | --- |
| Source text | An authorised lesson passage about minority attacks. | What that source actually says. |
| Structured record | A game occurrence with FEN, move and annotation. | Identity, provenance and a replayable example. |
| Computed chess evidence | A legal PV, verified motif or applicable tablebase result. | A bounded chess claim about a particular position. |

A passage can be relevant but wrong; a correct engine line can be a poor teaching example. Retrieval and chess validation need separate checks.

### Where the Primer and current code stand

The [Primer](../Primer_v01.pdf) discusses metadata/tag retrieval, exact positions and pawn signatures, then future text and graph methods. [knowledge.js](../../site/src/knowledge.js) currently implements:

- `retrieveLiterature`: weighted book metadata/theme/level matches, without book full text;
- `buildPositionIndex` / `similarPositions`: exact EPD and exact pawn-signature buckets, with limits on structural matches;
- pure features and motif candidates, rather than an embedding model.

[classics.js](../../site/src/classics.js) adds tagged games/studies; [chat.js](../../site/src/chat.js) supports bounded metadata searches. [ai.mjs](../../site/server/ai.mjs) has embedding configuration/client helpers, but there is no embedding ingestion/search route or connected text/vector index in the app. A reading recommendation based on a book's tags must not be presented as a retrieved quotation or passage from the book.

## 1. Establish a proper plain-text baseline

### Ingestion and chunking

Recommended records are **source → document → passage**, each with stable IDs. Keep source URL, author, licence/permission, title, language, edition/version and a content hash. A passage needs a locator (page, section, lesson step or game ply), original text and any associated position IDs.

Chunk at meaningful boundaries: a lesson explanation, an annotated move with its position, or a short worked variation. Keep an explanation together with the FEN it explains. For long prose, use a bounded token window with modest overlap as a tunable baseline; no universal chunk length is assumed. Store headings as metadata/context. Deduplicate overlapping passages and repeated game exports before evaluating retrieval.

PDF extraction needs its own quality check: reading order, diagrams, figurines, move numbers and columns can be lost. Do not infer a board from mangled OCR and label it verified. Validate reconstructed moves against the supplied starting position, preserve the original locator and quarantine extraction failures.

### Lexical, dense and hybrid retrieval

| Method | Why try it | Main limitation |
| --- | --- | --- |
| Metadata filters + lexical/BM25 | Strong baseline for player names, ECO codes, quoted phrases and exact terminology. | Vocabulary mismatch, multilingual paraphrases and implied concepts. |
| Dense passage retrieval | Finds semantically related wording without exact token overlap. | Domain mismatch, model/version costs and plausible but wrong neighbours. |
| Hybrid candidate retrieval | Combines exact terminology with paraphrase coverage. | Requires deduplication, calibration and evaluation rather than an assumed improvement. |
| Cross-encoder reranking | Jointly scores a question and candidate passage after fast retrieval. | Extra inference latency and another model to maintain. |
| Late-interaction retrieval | Retains finer token-level matching than one vector per passage. | More complex indexing/storage; not the first dependency to add. |

[DPR (Karpukhin et al., 2020)](https://arxiv.org/abs/2004.04906) is a dual-encoder passage-retrieval method. [BERT reranking (Nogueira and Cho, 2019)](https://arxiv.org/abs/1901.04085) scores query–passage pairs after retrieval. [ColBERTv2 (Santhanam et al., 2022)](https://arxiv.org/abs/2112.01488) uses compressed token representations and late interaction. These are alternatives to compare, not proof that raw FEN strings form a useful semantic embedding space.

For the planned SQLite storage, [FTS5](https://www.sqlite.org/fts5.html) offers a concrete lexical baseline without a separate search service. Its `bm25()` score sorts with **lower values first**. Test tokenisation for SAN, hyphenated names, German chess terms and punctuation; keep structured fields for ECO, UCI and player IDs instead of expecting tokenisation to preserve them. If using FTS snippets, render text safely: its highlighting markup must not bypass Kibitz's text-only rendering policy.

For hybrid fusion, first apply access/licence filters, retrieve separate candidate lists and merge identical passage IDs. [Reciprocal Rank Fusion (Cormack et al., 2009)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) combines ranks with a sum of `1 / (k + rank)`. Tune the constant and candidate budgets on held-out queries; do not add raw BM25 and cosine scores with incompatible scales. A subsequent reranker can consider source quality, position relevance and teaching level as well as text relevance.

The [BEIR benchmark (Thakur et al., 2021)](https://arxiv.org/abs/2104.08663) found substantial variation across retrieval tasks, with BM25 a robust baseline and more elaborate methods carrying computational tradeoffs. Kibitz needs its own chess queries before selecting a dense model or claiming an improvement.

### Building an answer

Return an evidence packet with passage IDs, short original excerpts, locators, match reasons and linked positions. Keep original excerpts distinct from generated summaries. Include only what fits a deliberate context budget; high similarity is not permission to copy entire books or flood the prompt.

The model may cite only IDs in this packet. Resolve those IDs to stored records, verify that the cited passage supports the associated claim, and let the UI open the game/lesson at the cited occurrence. ID validation prevents invented references; it does not by itself check entailment. If the evidence is insufficient, explain the gap rather than manufacturing a citation.

## 2. Structured RAG: use the chess data directly

Structured retrieval queries fields and relations whose semantics the application controls. A query such as “my last three losses with Black in rook endings” is predominantly a typed filter and feature query. Converting that request into free-form text similarity loses important constraints.

Recommended query routing:

| Question | Primary retrieval path | Optional augmentation |
| --- | --- | --- |
| “Have I reached this exact position?” | Exact position key → game occurrences. | Annotated text at those occurrences. |
| “Show a similar isolated-pawn ending.” | Pawn/material features + phase and side filters. | Theme/text reranking; label the match as analogous. |
| “What does this lesson say about opposition?” | Lesson metadata + lexical/dense passages. | Position examples and endgame checks. |
| “What follows this opening transposition?” | Stored position → legal move edges. | Source explanations and engine comparisons. |
| “Which theme recurs in my losses?” | Owned games → verified features → aggregate counts. | Source-backed explanation and suggested lessons. |

Keep exact identity separate from pedagogical similarity. EPD includes side to move and rights but omits move counters; full draw state can also depend on history. Two boards with the same pawn arrangement may differ decisively in piece placement, king safety or tactics. Store the original FEN/occurrence, and return which features matched rather than calling every neighbour “the same position.”

Proposed retrieval stages for a board question:

1. Validate the board and request; enforce ownership and the help setting.
2. Retrieve exact matches, structural neighbours and relevant concept/text candidates independently.
3. Apply hard constraints such as material class or required motif. Use fuzzy pawn distance only as an explicitly labelled similarity measure; do not silently normalise colours or mirror castling-sensitive positions.
4. Fuse/rerank candidates, retaining diverse source games rather than many plies of one game.
5. Recheck any move/line used as advice against the **current** position. A good move in a similar historical game is not automatically legal or sound here.
6. Generate an answer with evidence IDs; validate citations and board actions.

A typed search tool can express filters and bounded concept expansions. The model should not receive arbitrary SQL execution. Unknown concepts, oversized traversals and fields outside the schema should be rejected or clarified.

## 3. Graph RAG: which graph, for which question?

There are several different graph approaches. They should not be treated as one replacement for passage retrieval.

| Approach | Representation and retrieval | Fit for Kibitz |
| --- | --- | --- |
| Explicit chess graph | Positions, legal recorded moves, game occurrences, lessons and concepts; typed joins/traversals. | Natural first graph for openings, transpositions and theme-to-example navigation. |
| Microsoft GraphRAG | Extract entities/relations from prose, organise communities and generate community reports; local/global query modes. | Potentially useful for broad synthesis across a substantial licensed text corpus. |
| LightRAG | Combines a text-derived graph with vector retrieval and low-/high-level retrieval. | Candidate for relation-aware questions if simpler retrieval misses relevant connections. |
| HippoRAG / HippoRAG 2 | Extracted knowledge graphs and personalised PageRank; the second system strengthens passage integration. | Research candidate for multi-hop associations, with a passage baseline retained. |
| RAPTOR | Hierarchical clustering and generated summaries over passages. | Useful candidate for chapter/course-level questions; this is a summary tree, not an entity knowledge graph. |
| LazyGraphRAG | Defers expensive summarisation, using lighter indexing and query-time work. | A cost/quality comparison to investigate, not a promised drop-in or fixed cost saving. |

Primary sources: [Edge et al., GraphRAG (2024)](https://arxiv.org/abs/2404.16130), [official GraphRAG indexing](https://microsoft.github.io/graphrag/index/overview/) and [query documentation](https://microsoft.github.io/graphrag/query/overview/); [Guo et al., LightRAG (2024)](https://arxiv.org/abs/2410.05779); [Gutiérrez et al., HippoRAG (2024)](https://arxiv.org/abs/2405.14831) and [HippoRAG 2 (2025)](https://arxiv.org/abs/2502.14802); [Sarthi et al., RAPTOR (2024)](https://arxiv.org/abs/2401.18059); [Microsoft Research's LazyGraphRAG post (2024)](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/).

These systems address different retrieval workloads and report their own experiments. GraphRAG's global community summaries target corpus-wide questions, whereas local retrieval targets particular entities and their surrounding evidence. Neither is automatically better for “is Nf3 legal here?” A lazy indexing cost ratio from one evaluation is not a forecast for Kibitz's corpus, provider prices or query volume. The LazyGraphRAG source is a research blog, rather than evidence that every documented GraphRAG installation supplies the same method.

### A proposed chess graph

Use separate position and occurrence records so that transpositions can share a board without erasing game context:

```text
Game --HAS_OCCURRENCE--> Occurrence(game_id, ply, full_fen, history_ref)
Occurrence --AT_POSITION--> Position(epd)
Position --MOVE(uci, corpus_id, counts)--> Position
Occurrence --HAS_MOTIF(status, method, engine_version, budget)--> Concept
Lesson --TEACHES--> Concept
Lesson --HAS_EXAMPLE--> Occurrence
Passage --ABOUT--> Concept / Occurrence
Claim --SUPPORTED_BY--> Passage
```

This is a proposed schema, not existing tables. Keep analysis evidence separately with score perspective, PV, depth, bounds, engine/network version and draw-state assumptions. Store source IDs on both records and derived edges. Distinguish authored, imported, model-proposed and rule/engine-checked relationships; keep confidence and verification status separate.

Moves parsed from games can create exact position edges. Language-model extraction should not decide whether that edge is legal. Extracted prose relationships such as “this lesson illustrates prophylaxis” can be useful suggestions, but need a locator and a different trust status from legal move edges.

A position graph can contain cycles because positions repeat. An explorer often displays a tree-shaped view over that graph. Traverse the **stored corpus** with visited-node, depth and result limits; do not expand the entire legal game space. Corpus move counts need deduplicated game identities and explicit filters.

Start with relational tables and bounded joins/recursive queries in the planned SQLite layer. A graph database is justified by a measured traversal/storage requirement, not by the presence of nodes and edges in this design. Keep private game occurrences scoped before traversal, fusion and summarisation; a shared position must not expose another player's private game.

### When a text graph earns its cost

Compare these queries:

- “Why was this move a mistake?” primarily needs current-position search and a targeted explanation.
- “Find a worked example of an opposite-coloured bishop blockade” benefits from features, concepts and passages.
- “Across these lessons and games, how do blockade, exchanges and minority attacks connect?” may benefit from a curated concept graph or text-derived multi-hop retrieval.
- “What are the recurring strategic themes across this whole course?” may justify hierarchical/community summaries.

For every graph-generated summary, retain supporting passages and allow navigation back to them. A graph path is a retrieval rationale, not a proof that a strategic recommendation is true. Generated nodes/reports can propagate extraction errors and prompt injection just as plain retrieved text can.

## 4. Retrieval control and security

[Self-RAG (Asai et al., 2023/2024)](https://arxiv.org/abs/2310.11511) trains retrieval/reflection tokens; it is not equivalent to asking an ordinary model to critique itself. A useful, simpler Kibitz experiment is a bounded policy: retrieve when the question needs a source, inspect evidence coverage, and allow one targeted expansion before abstaining. Keep costs and round limits explicit.

All imported passages, PGN metadata, graph descriptions and generated summaries remain untrusted. Route them through [quote()](../../site/src/prompt.js), render text rather than HTML, and do not let retrieved instructions change tools, access scope or policy. Validate model-supplied record IDs and moves. Apply generation/FEN guards before asynchronous results reach the board. Retrieval must respect a game's help setting before it returns advice, not merely hide the final panel.

Embedding and reranking requests can send source text to a provider. Preserve local-only settings, account scope and source permissions; record model/version/dimensions so an embedding change triggers a controlled reindex. Support deleting source records and all derived chunks/edges/caches together. Do not send private corpora to a new provider just because it has an embeddings endpoint.

## 5. Evaluation before architecture selection

Build a labelled query set alongside ingestion, with relevant records, acceptable alternatives and explicit no-answer cases. Include English/German wording, opening transpositions, exact-versus-analogous positions, strategic paraphrases, same-pawn/different-tactic traps, bad source text, malformed PGN and access-control boundaries. Split by game/source family where possible, so overlapping chunks or transposed copies do not leak between tuning and evaluation.

| Layer | Proposed measurements |
| --- | --- |
| Retrieval | Precision@k, recall@k, nDCG@k and MRR, reported separately by query type. |
| Structural matching | Exact identity errors, feature mismatch rates, motif precision and missed relevant occurrences. |
| Grounding | Valid citation IDs, passage support, source/position locators and abstention on unsupported questions. |
| Chess output | Legal moves, agreement with supplied engine evidence, tactical refutations and draw-state handling. |
| Teaching | Human-rated clarity and level fit; later, held-out exercise improvement and retention. |
| Operations | p50/p95 latency, index size/build time, tokens/cost per query and update/delete correctness. |

[Ragas (Es et al., 2023)](https://arxiv.org/abs/2309.15217) offers reference-free relevance/faithfulness metrics that can supplement this evaluation. Its model-based judgements do not establish chess correctness or replace human labels and deterministic checks.

Run controlled comparisons: metadata/structural only; BM25; dense only; BM25+dense fusion; hybrid+reranker; typed chess graph expansion; then a selected text-graph or summary-hierarchy method on the subset of questions it targets. Use the same corpus, access filters and comparable latency/token budgets. Report per-class gains and regressions, not just one average. Set acceptance thresholds before choosing a winner.

## Proposed implementation slices

1. **7.1 + 8.8 foundation:** source/licence records, stable occurrence/passage IDs, extraction checks and labelled queries.
2. **8.3 lexical baseline:** annotation/lesson text in FTS, metadata filters, deterministic citation packets.
3. **8.1/8.2/8.4:** feature/tag retrieval, separately configured embeddings and rank fusion; compare with the baseline.
4. **5.2 + 8.6:** legal move graph and cited examples that open at the correct position.
5. **Optional research:** reranking, fuzzy structures and text GraphRAG only for demonstrated retrieval gaps.

Nothing in these slices requires adopting every reviewed framework. The immediate deliverable should be a small, measurable retrieval path that can explain both why a source was selected and what that source actually supports.
