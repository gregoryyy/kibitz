# Research: retrieval and neurosymbolic coaching

Research date: **2026-10-23**. Repository audit: **`0176c62` on `main`**. These notes describe the current implementation separately from proposed work; they do not complete milestones 5–8.

Subsequent implementation: TODO 8.1–8.8 added material/placement predicates, pattern browsing, [lexical/dense passages](../design/retrieval.md#study-text-search), [hybrid fusion](../design/retrieval.md#hybrid-passage-retrieval), [fuzzy pawn distance](../design/retrieval.md#fuzzy-pawn-structure-distance) and [cited coach context](../design/retrieval.md#retrieved-coach-passages-and-citations), with separate position, passage and spatial benchmarks. The [2026-10-24 position retrieval comparison](position-retrieval-comparison.md) maps these paths to literature algorithms and separates recorded Kibitz results from published experiments. Literature implementations and graph-retrieval comparisons remain future work; the original audit below retains its date and proposal scope.

## Reading order

1. [AI use cases in milestones 5–7 and the Stockfish audit](milestones-5-7-ai.md): what the model should do, what rules and search should do, and which engine components Kibitz actually uses.
2. [RAG methods](rag-methods.md): ordinary text indexing, hybrid and structured retrieval, graph approaches, a proposed chess schema and an evaluation plan.
3. [Neurosymbolic chess and other games](neurosymbolic-games.md): research on engine-grounded commentary, neural search, learned concepts and explicit logical systems, with experiments worth trying here.
4. [Position similarity by aspect](position-similarity.md): candidate symbolic/dynamic distances, conditional metric learning and an aspect-specific evaluation plan.
5. [Implemented position retrieval versus literature algorithms](position-retrieval-comparison.md): current bucket/predicate/pattern/hybrid paths versus relational BM25, solution-aware retrieval, expert classifiers, CQL and chess embeddings; measurements, input differences and a fair comparison protocol.

Start with the brief [LLM and symbolic design overview](../design/ai.md) for a feature-level map. Read alongside the [architecture](../ARCH.md), [plan](../TODO.md) and [Primer](../primer/Primer_v01.pdf), whose [editable source](../primer/Primer_v01.md) is also available. The Primer's metadata and position-retrieval discussion is the starting point, rather than evidence that full-text/vector RAG is already implemented.

## Recommendations

- Build the source-aware library model first (7.1), then a legal position/move index for the opening explorer (5.2). Both support lessons and retrieval without a model call.
- Establish a measured text baseline: licensed passages, metadata filters and lexical retrieval; compare dense and hybrid retrieval against it. Retrieve actual passages before claiming passage-level support.
- Use chess structure explicitly: position identity, pawn/material features, move occurrences, verified motifs and lesson concepts. A position graph and a graph extracted from prose serve different queries.
- Let the model explain checked evidence, translate natural-language requests into validated searches, and adapt the wording of lessons. Keep move legality, exercise grading, provenance and scheduling under explicit rules.
- Keep the present Stockfish UCI boundary for production. Separate evaluator exports or learned engine representations are research options with their own build, performance and fidelity questions.
- Add entity/community GraphRAG only if cross-source synthesis queries justify it in a labelled comparison. A graph database and a trained chess language model are not prerequisites for milestones 5–7.

These are engineering recommendations from the audit and literature review, not benchmark results for Kibitz. The proposed experiments have not been run.

## Method and limits

Sources are original papers, author/project repositories and official documentation. The review is selective rather than systematic: abstracts and relevant methods/limitations were checked, with closer reading of engine-grounded commentary and retrieval architectures. Linked preprints and vendor research posts are identified where relevant; reported results are the authors' results, not independently reproduced measurements.

The papers establish possible mechanisms, not a transferable promise about cost, playing strength or teaching quality. Retrieval relevance, chess correctness, explanatory faithfulness and learning outcomes need separate measurements. Finite-depth Stockfish analysis is strong evidence; only applicable rule checks or exact tablebase results warrant stronger claims.

No models, datasets, runtime dependencies or engine components were added by this research. Any later import needs an item-level source/licence decision and the repository's normal security checks.
