# Retrieval

How Kibitz finds study text and similar positions, how retrieved passages reach the coach, and how retrieval is evaluated.

## Study-text search

TODO **8.3.1** provides a lexical baseline over actual source passages. In **Library → Search study text**, enter keywords, choose personal/classic annotations or authored study notes, and select a text language. Results show a literal excerpt, full passage and source/licence assertion. **Open annotated position** opens the precise source occurrence, including a study's initial note or a later arrival at a repeated board. Opening another game during play keeps the existing confirmation and return path.

Default **Keywords** search works without an AI provider; its text and queries stay in the browser. TODO **8.3.2** adds optional **By meaning** search through explicit embedding requests, described below. Restricted live-help settings hide and clear results and vectors, even when the Library tab is closed; Full engine help or analysis permits searching. Static source text is not checked advice for the position on the board. Library searches do not themselves add passages to model prompts. The separate [coach retrieval/citation path](#retrieved-coach-passages-and-citations), added in 8.6, uses local keyword/board lookup when asking the coach.

TODO **8.4** adds [Combined search](#hybrid-passage-retrieval): rank fusion, optional current-board signals, visible match reasons and a literal every-term constraint. It reuses the same explicit embedding actions and source/policy boundaries. Its measured comparison records both ranking regressions and stricter-filter recall losses.

### Passages and source identity

[`text-search.js`](../../site/src/library/text-search.js) compiles two source types:

- A mainline PGN comment comes from a legal [`library.js`](../../site/src/library/library.js) snapshot. It retains the SHA-256 PGN revision, source/document/annotation/occurrence IDs, full FEN, relative ply, collection and independently supplied annotation licence. NAGs and RAV comments are excluded. Initial comments are searchable even when the standard-start root is omitted from position-similarity retrieval.
- An original authored guide comes from [`authoredGuideTexts()`](../../site/src/openings/opening-guides.js) in English/German. Idea, plans and structure are separate passages. SHA-256 of the full language-specific guide versions all its sections. Locators identify the field and exact UTF-16 range. Guides declare the project licence and general-background status; they have no artificial board FEN or engine verification.

Long fields split into overlapping source substrings, at most 1,600 UTF-16 units with a target overlap of 160. Splitting prefers whitespace; exceptionally long unbroken tokens can split. Surrogate pairs remain intact. Annotation chunk locators address the original stored PGN; guide locators address the original section. IDs include revision, parent annotation/section and chunk range. Excerpts are also literal substrings centred on a matching term.

No external book passages, Primer/app-help text, new corpus licences or dependencies were added. Historical score rights remain separate from the project's authored annotations. A blank imported licence stays unknown; searching personal text locally does not establish redistribution or provider-ingestion permission.

### Lexical ranking and scope

`buildTextIndex()` creates an in-memory inverted index over passage title and body. Imported title metadata is bounded to 240 characters before indexing, preventing a large PGN header from being repeated in every passage. `searchText()` uses Okapi BM25 with k1=1.5 and b=0.75. Ties sort by stable passage ID; zero-score candidates never fill a result list. The interface shows at most eight results; the API bounds queries to 500 characters/64 distinct terms and results to twenty.

Tokenization retains Unicode words, ECO codes, castling and SAN tokens. Search spelling ignores case/diacritics and folds ß to ss. English/German stopwords add no signal. Uppercase German piece letters map to English SAN (`Dxf7` → `Qxf7`, `Sf3` → `Nf3`); lowercase pawn captures remain distinct. Check/mate suffixes do not prevent a move-name lookup. Stored text, source ranges and displayed notation are unchanged. There is no stemming, translation or semantic paraphrase model.

Language, source kind and collection filters apply before term/document statistics and scoring. Guides have explicit language tags. Imported annotations remain language-undetermined and are included for either interface language; language is not guessed from a name or move notation. The language filter is therefore strict for guides, not a claim that personal notes have been translated. All indexed personal records come from the currently loaded account/browser library.

Rebuilds immediately clear old annotation passages and results. The existing library generation guard rejects late source compilation after edits/deletions. Compiled authored guides are loaded lazily on the first applicable search and reused locally; their completion combines with the current library's notes. Source drafts remain outside the search renderer. Navigation rechecks help permission, game/library generation, query/source selection, source revision and current record before acting, including after a leave-game confirmation. chess.js replays the source game before loading it.

The lexical index is derived memory, not a second persistence format. Text rendering uses DOM text nodes, including imported titles/comments; no source text becomes HTML. Keyword search makes no model calls, embedding requests or prompt changes.

### Explicit semantic search

In **Library → Search study text**, choose a source/language and **By meaning**. The page fetches the embedding service's safe status and displays its provider/model. **Build semantic index** sends only that selection's title/body passages, in batches of sixteen, with a maximum of 512 passages. After building, enter a query and press **Search by meaning**. Selecting the method, changing filters and typing never upload passages or queries. Cancel/Clear aborts pending work and erases vectors. Keyword search remains the default.

`DenseSession` in [`dense-search.js`](../../site/src/library/dense-search.js) takes a detached source snapshot and publishes an index only after every batch succeeds. It normalises finite, nonzero vectors and ranks by cosine similarity with stable passage-ID ties. Results use the same literal excerpts, source/licence display and exact occurrence navigation as keywords. Positive cosine is a ranking rule, **not a calibrated relevance threshold**; a hit may be unrelated, as the benchmark shows. The UI does not present similarity as chess strength or confidence.

Vectors live only in browser memory. Source edits/deletion, library/account selection, method/source/language changes and help/local-only policy changes cancel work and drop the index, even while Library is closed. Changing the game cancels pending actions/results while retaining a valid unchanged-source index. Typing cancels an old query without automatically replacing it. Generation checks reject late responses even when a provider ignores abort. Reloading requires rebuilding; no server vector cache, saved embedding index or background ingestion exists.

Each index records configured provider/model, optional operator-supplied revision, provider-reported model, observed dimension, `title-text-v1` input version, opaque endpoint/configuration fingerprint and opaque cookie scope. Batch/query metadata must match; dimension or reported-model drift rejects results. A changed service/scope requires reviewing the destination and another explicit build. **EMBEDDING_REVISION is an assertion supplied by the operator**, not a verified model-weight digest. Mutable model aliases can change without a detectable name/dimension change; use immutable model versions where possible and rebuild after changing weights. Unknown revisions are displayed as unknown.

#### Gateway and configuration

The stateless [`embeddings.mjs`](../../site/server/embeddings.mjs) helper exposes GET/POST `/api/ai/embeddings`. GET returns safe configuration; POST accepts only `{texts, fingerprint, scope}` and returns vectors/metadata/usage. Existing Host, Origin, JSON and body bounds apply. The cookie scope partitions requests and cache identities; **it is not account authentication**. Library/account ownership and source filtering happen in the page before transport. This endpoint cannot look up any player's saved library. It does not log or persist text/vectors, and exposes no credentials or endpoint URL.

Configure `.env` and restart the server:

```dotenv
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=bge-m3:latest
EMBEDDING_REVISION=
```

OpenAI and Mistral reuse that named provider's key/base URL independently of the chat provider. Local-only mode refuses cloud embeddings rather than silently redirecting them to the chat model. Ollama uses its allowlisted host; before sending text, `/api/show` must identify a local GGUF/Safetensors embedding model with an architecture and embedding capability. Remote/cloud aliases and unknown/older metadata fail closed. Turning local-only on aborts admitted cloud embedding work; late vectors are refused.

Embedding calls share the gateway's server token budget, paid-provider user budgets and rate limiter. One active request per cookie and four overall bound concurrent work. Configure `AI_PRICES` for the embedding model to estimate costs; missing prices remain unknown. Missing provider usage is conservatively counted as UTF-8 input bytes plus one per text and marked estimated. Large builds may hit the shared per-minute limit and require retrying; no partial index is published. Completed provider work is counted even if the caller cancels or policy changes before delivery.

The client requests float vectors and validates one indexed result per input, uniform dimensions and finite nonzero coordinates. Indexed embedding responses, float encoding and usage fields are documented by [OpenAI](https://developers.openai.com/api/reference/resources/embeddings/methods/create) and [Mistral](https://docs.mistral.ai/api/endpoint/embeddings). Literal title/body strings are embedding inputs, not generative prompts. They receive no instructions and are not wrapped in `quote()`; any future use in tutor prompts still requires `quote()` and citation validation. Explicit provider ingestion does not establish rights to redistribute imported annotations.

### Measured baseline

Use the root utility:

```sh
just retrieval-eval --mode text
just retrieval-eval --mode text --json
just retrieval-eval --mode text --out docs/eval/retrieval/text-baseline
```

The default mode remains the [position benchmark](#position-retrieval-evaluation). Text mode reuses that fixed corpus's **45 comments** and adds **114 sections from 38 language-specific guides**: 159 passages. Twenty-eight manual queries contain twenty answerable cases and eight no-answer cases. Gold selectors name an annotation's collection/game/ply or a guide's language/section, independently of the ranked result. Scope and source existence are validated before scoring.

The [recorded report](../eval/retrieval/text-baseline.md) and [JSON](../eval/retrieval/text-baseline.json) include source locations, input hashes and precision/recall/MRR/nDCG at 1/3/6. The [8.8 metric definitions](#metrics) also apply here. Unit tests check independent BM25 arithmetic, source ranges, filtering, ID/revision stability and report reproduction. Browser scenarios check import/navigation/reload, provider-free use, literal hostile text, source drafts, delayed indexing/deletion, stale actions, help policy and German phone layout.

Initial precision@1 is **0.900**, recall@3 **0.950**, and MRR@3 **0.917**. All eighteen direct keyword cases put a relevant passage first. Both paraphrases miss at rank one; the Lucena bridge appears at rank three, while the German isolated-pawn paraphrase finds no relevant passage. Two of eight no-answer cases return ordinary chess passages sharing words with an unsupported request, a **0.250 false-positive rate**. Matching “rook” and “draw” does not supply a Syzygy proof.

These are small authored development cases, not a held-out generalisation estimate or chess/answer-quality measurement. They make lexical limitations visible before comparing embeddings. Corpus or label changes require manual relevance review, suite-version updates and regenerated reports. Passage rankings cannot be compared numerically with the position benchmark as if the two suites had the same queries or relevance unit.

### Measured dense comparison

`--mode dense` runs the same authored corpus, query filters, gold judgements and scoring through production `DenseSession` and the separately configured embedder. Alternate adapters receive no gold labels, case IDs or evaluation groups; returned IDs must resolve to the permitted corpus, and canonical source references are restored before scoring. The runner never reads a saved player library or auto-loads `.env`. Cloud providers additionally require `--allow-cloud`; tests use mock/fake clients only.

```sh
EMBEDDING_PROVIDER=ollama EMBEDDING_MODEL=bge-m3:latest \
  EMBEDDING_REVISION=<installed-model-digest> \
  node utils/retrieval-eval.mjs --mode dense --out docs/eval/retrieval/dense-bge-m3
```

On 2026-10-23, a manual local run used the already-installed **bge-m3**, Ollama 0.40.7 on Apple M1 Pro Metal, F16, 1024 dimensions. An isolated daemon on port 11435 had cloud use and model pruning disabled; no weights were downloaded. The [Markdown report](../eval/retrieval/dense-bge-m3.md) and [JSON](../eval/retrieval/dense-bge-m3.json) record the full supplied model digest and the same corpus/case hashes as BM25. Endpoints contribute to the opaque fingerprint; hardware/provider revisions may affect numerical results.

| Measure | BM25 | bge-m3 cosine |
| --- | ---: | ---: |
| Precision@1, 20 answerable queries | 0.900 | 0.950 |
| Recall@3, 20 answerable queries | 0.950 | 1.000 |
| MRR@3, 20 answerable queries | 0.917 | 0.975 |
| No-answer false positives, 8 queries | 0.250 | 1.000 |

Both paraphrases now retrieve a relevant passage within three results; one ranks first. However, **all eight queries labelled no-answer return hits**, including unsupported quantum requests and requests without a supporting passage in the selected scope. Dense retrieval respects those source filters but can rank unrelated passages inside the allowed scope. The unchanged lexical gold also has an intent limitation: `wrong-language` labels German “Isolani” unanswerable in English guides, although the English isolated-pawn passage can be semantically useful. The reported 1.000 is therefore a false-positive rate against these fixed labels, not a universal semantic-error estimate. Review intent/relevance labels separately before calibrating abstention; the off-topic quantum and unsupported-proof cases remain unsupported. Improved recall does not justify feeding the top hit to the coach as evidence. These twenty-eight authored development queries are too small for a general quality claim; the subsequent [hybrid comparison](#hybrid-passage-retrieval) records fusion/filter tradeoffs and separate board/intent labels, with calibrated semantic abstention still unestablished.

Unit tests cover independent cosine geometry, vector/identity validation, filtering before ingestion, bounded atomic builds, cancellation/deletion, fake provider contracts, cookie isolation, local-only transitions, budgets and report/reference validation. Browser regressions cover explicit uploads, paraphrase navigation at repeated positions, source/language changes, reload, stale/deleted work, provider/dimension changes, closed-tab policy changes and German phone controls.

### Remaining work

[Hybrid/reranked retrieval](#hybrid-passage-retrieval) followed in 8.4, including optional exact/pawn/feature-tag signals and literal term filtering. Model-specific relevance calibration and semantic support/abstention still need separately reviewed labels and held-out evaluation. [Bounded coach retrieval and answer citation identity checks](#retrieved-coach-passages-and-citations) followed in 8.6. Model-requested passage search remains a future extension. SQLite/IndexedDB persistence and a larger sourced corpus remain 7.6/7.3. No dependency or code was imported from `llmkit`; it remains inspiration only.

## Hybrid passage retrieval

TODO **8.4** combines the existing [passage retrievers](#study-text-search) with explicit board context. In **Library → Search study text**, select **Combined**, build the selected source/language index and press **Search combined**. Default **Keywords** remains local and unchanged. Combined search uses the separately configured embedding service under the same explicit-ingestion, local-only, budget and model-identity rules as **By meaning**.

Two independent options express intent:

- **Favor the current board** adds exact-position, pawn and shared-feature signals for the visible game or scratch position. The FEN/features stay local; embedding queries contain only the entered text.
- **Require every search term** keeps only passages whose title/body contains all normalised non-stopword query terms. This supports exact lookups and empty results. It can reject useful paraphrases and does not establish semantic support or chess correctness.

TODO **8.5** adds **Include similar pawn structures**, enabled with board relevance. It permits at least 75% colour-specific pawn-square overlap and shows unmatched squares. It defaults off; [metric and spatial benchmark](#fuzzy-pawn-structure-distance) record the definition and sparse-position limitations.

Results distinguish complete term coverage from merely related text. **Why this result** shows which paths found the passage, any exact/pawn relation and shared feature labels. The existing literal text, source/licence and exact annotated-position navigation remain available. No result is added to a tutor prompt by this feature.

### Candidate channels and reranking

[`hybrid-search.js`](../../site/src/library/hybrid-search.js) is pure JavaScript with an injected chess.js constructor. A detached source index combines the existing BM25 index with cached legal-board profiles. Source/language/collection filters apply before every candidate channel and its statistics. Each channel contributes at most twenty candidates:

| Channel | Signal and boundary |
| --- | --- |
| Keywords | Existing title/body BM25, including German move-letter aliases. No positive score means no lexical candidate. |
| Meaning | Cosine-ranked vectors from the current selected source index and identical embedding identity/dimensions. Returned IDs must belong to the eligible local corpus. |
| Position | Exact EPD, including turn/castling/legal en-passant rights; otherwise nonempty pawn placement with matching turn, check state and phase. Default distance is zero; 8.5 optionally permits Jaccard distance up to 0.25 and orders this channel by increasing distance. Pawnless positions do not gain a pawn-analogy signal. |
| Feature tags | Jaccard overlap of current position-feature tags. Annotation tags come from legal FENs; an authored guide contributes its known catalogue concept. Generic phase/king-activity tags are omitted. An annotation with incompatible turn/check/phase receives no tag boost. |

Imported titles, prose and claimed theme metadata cannot create board facts. Feature detection remains heuristic; no Stockfish search or tactical verification occurs here. Guides remain general background without an invented FEN. Source check/phase compatibility limits a board boost, not all text retrieval: an incompatible historical board can still be a relevant text result, without a matching-board badge.

Candidates merge by revision-bound passage ID. Reciprocal Rank Fusion sums `1 / (60 + rank)` for each channel containing a passage. The fixed constant follows the published [RRF baseline](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf); it was not tuned on Kibitz's labels and is not a claim of an optimal chess setting. Raw BM25, cosine and tag scores are never added. The four bounded lists yield at most eighty distinct candidates.

The deterministic reranker orders full literal term matches first, then exact-board matches, then fused rank score and stable passage ID. Text intent can therefore outrank an unrelated exact board. An enabled every-term constraint removes incomplete matches before the final result limit. It operates on the bounded candidate union; an empty result is not an exhaustive proof that no source passage contains the terms. The interface returns at most eight passages; the pure API permits twenty. Cosine positivity, fusion agreement, exact board identity and complete term coverage are all retrieval signals, not evidence that a source answers the question.

### State and source boundaries

The hybrid source index and vectors are derived memory, with no new persistence or server cache. Sources still compile through the legal, revision-bound library snapshots. A provider result cannot replace the canonical source title, locator, occurrence, licence or text by supplying different metadata under a known ID. Unknown, stale, duplicate, nonfinite or out-of-scope dense candidates are refused.

Changing the board-relevance/term options cancels results but retains otherwise valid source vectors. Stepping the main or scratch board invalidates pending work and held result actions when board relevance is active, even without changing the game generation. The query captures its visible board and intent before awaiting an embedding. Source/account/method/language/local-only/help changes retain the existing stricter invalidation rules; source and policy changes erase vectors. No option change, board step or typing automatically sends a replacement query.

The hybrid path reuses the stateless embedding endpoint and its destination review. Keys remain on the gateway. It adds no new provider, generative prompt, external source, dependency or `llmkit` code. Sources and snippets remain DOM text nodes; source navigation replays the PGN and rechecks current game, source revision, selection and board intent.

### Measured comparison

The root utility supports an explicit provider run:

```sh
EMBEDDING_PROVIDER=ollama EMBEDDING_MODEL=bge-m3:latest \
  EMBEDDING_REVISION=<installed-model-digest> \
  node utils/retrieval-eval.mjs --mode hybrid --out docs/eval/retrieval/hybrid-bge-m3
```

No `.env` or saved player data is loaded. Cloud evaluation additionally requires `--allow-cloud`; automated tests use fake/mock clients only. The runner uses one ingestion and reuses query embeddings across method ablations. Adapters receive the literal question, explicit board/term options and source scope, never gold judgements or case IDs.

The [recorded local bge-m3 report](../eval/retrieval/hybrid-bge-m3.md) and [JSON](../eval/retrieval/hybrid-bge-m3.json) use the same 159 authored passages and 28 text queries as the previous lexical/dense reports. The manual run used the already installed F16/1024-dimensional model, its recorded supplied digest, Ollama 0.40.7 and Apple M1 Pro Metal. The isolated daemon had cloud use and model pruning disabled; no model was downloaded. Boardless text cases exercise the two text channels and term reranking:

| Method | Precision@1 | Recall@3 | MRR@3 | Labelled no-answer false positives |
| --- | ---: | ---: | ---: | ---: |
| BM25 | 0.900 | 0.950 | 0.917 | 0.250 |
| Dense | 0.950 | 1.000 | 0.975 | 1.000 |
| Hybrid | 0.900 | 0.950 | 0.925 | 0.875 |
| Hybrid, every term required | 0.850 | 0.850 | 0.850 | 0.000 |

Hybrid is **not a uniform improvement**. It loses some paraphrase recall compared with dense alone. The optional literal filter rejects all eight labelled no-answer cases, while dropping three of twenty answerable queries. The unchanged lexical gold has the previously documented Isolani/language ambiguity; these are metrics against fixed development labels, not a general semantic-error estimate. The default remains Keywords, and every-term filtering is an explicit choice.

A separate ten-query board/intent suite covers repeated first/second notes, QGD transposition, quiet/checked IQP positions, castling rights, legal en passant, excluded sources and unsupported/empty intent. Both BM25 and hybrid reach precision@1/recall@3 of 1.000 with the **same explicit term constraints**, and reject its three no-answer requests. This small, straightforward set demonstrates no ranking advantage; it is a reproducible workflow baseline. Its labels and aggregates are separate from the twenty-eight text queries. Independent geometry, source and browser tests exercise board/tag discrimination and asynchronous state boundaries.

### Limits and follow-up

This implements bounded fusion and deterministic reranking, without a learned cross-encoder or model-specific relevance threshold. Calibrated semantic abstention needs separately reviewed intent/support labels, source-family splits and held-out evaluation. The literal filter is not a substitute, and no similarity score is shown as confidence.

Material/piece-placement signatures remain 8.1 and richer per-position/move motif tags remain 8.2. [Cited coach context](#retrieved-coach-passages-and-citations) followed in 8.6, using the local keyword/board/tag channels without automatic embedding uploads. Optional [fuzzy pawn distance](#fuzzy-pawn-structure-distance) followed in 8.5; the recorded 8.4 comparison retains its original policy. Current board features can select an analogy; engine evidence must still check any advice in the current position. Larger licensed corpora, persistence and source deduplication remain milestone 7.

## Fuzzy pawn-structure distance

TODO **8.5** adds an optional graded pawn relation to [Combined passage search](#hybrid-passage-retrieval). Enable **Favor the current board**, then **Include similar pawn structures** and explicitly search. The new option permits at least **75% colour-specific pawn-square overlap**. It defaults off; ordinary Combined search retains exact pawn placement.

**Why this result** distinguishes **Similar pawn structure** from an exact board or identical pawns. It shows shared square counts and separate lists of squares present only on the current board or in the source, using white/black pawn symbols. These lists do not pair pawns into a move sequence. The source still opens at its exact legally replayed occurrence, including a custom-start root.

### Definition and scope

[`pawn-distance.js`](../../site/src/library/pawn-distance.js) decodes a checked board's existing `pawnSignature()` into a set such as `{w:d4, b:e6}`. Colour and square are literal: no colour swap, board reflection or rotation is applied. The geometry decoder validates eight ranks and bounded square counts; full board legality belongs to the existing chess.js source/query checks.

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

### Hybrid integration and state

Legal source profiles cache detached pawn-square sets. The position channel orders exact boards first, then compatible pawn analogies by increasing distance and stable passage ID, within its twenty-candidate budget. A fuzzy relation requires matching turn, check state and phase. Overall hybrid ranking still combines all channels and its term/exact-board reranker; closest pawn distance is not a guarantee of first place in the final list. A text result may remain relevant without a matching pawn relation.

The existing source/language/collection filters apply before matching. Imported prose and claimed tags cannot change pawn geometry. The optional every-term requirement still applies to fuzzy candidates. `HYBRID_POLICY` advances to `rrf-board-terms-v2` and records the pawn metric version; embedding input/version/dimensions are unchanged. Earlier recorded hybrid reports retain their original policy version.

Changing the fuzzy option cancels pending results and held source actions while retaining otherwise valid source vectors. Main/scratch-board changes recheck the captured FEN and intent; source/account/policy changes retain stricter index invalidation. Toggling the option sends no replacement query, and FENs/features stay local. No new provider, dependency, model call, persistent index or tutor prompt data is added.

This consumer is Combined Library passage search. The older Reading `similarPositions()` prototype continues to use exact pawn buckets. [Cited tutor/chat retrieval](#retrieved-coach-passages-and-citations), added in 8.6, uses local keyword/exact-pawn/tag channels without fuzzy expansion. Remaining position-index/material/placement features and richer motif indexing are tracked in 8.1/8.2.

### Reproducible spatial benchmark

```sh
just retrieval-eval --mode pawns
just retrieval-eval --mode pawns --out docs/eval/retrieval/pawn-distance
```

The [Markdown report](../eval/retrieval/pawn-distance.md) and [JSON](../eval/retrieval/pawn-distance.json) use ten original, chess.js-replayed source diagrams and eight manually labelled spatial queries: five answerable and three no-answer. Source rights and exact occurrence/PGN locators follow the existing library model. There is no provider, network, Stockfish search, `.env` loading or saved player data.

Both variants use the production hybrid source/profile path, the same source/query hashes and the same turn/check/phase/nonempty-pawn checks. Dense candidates are absent, the query has no fixture-text matches, and only results with a board relation are scored. The comparison isolates the position component rather than evaluating full hybrid text relevance. Gold selectors and case IDs never reach the adapter.

| Method | Precision@1 | Recall@3 | MRR@3 | No-answer false positives |
| --- | ---: | ---: | ---: | ---: |
| Exact pawn placement | 0.400 | 0.250 | 0.400 | 0.000 |
| Jaccard distance ≤ 0.25 | 0.800 | 0.750 | 0.800 | 0.000 |

The sparse one-pawn neighbour is deliberately labelled useful and remains missed. The suite is small, constructed and shares diagram families; the gains do not establish general retrieval quality, transferable advice or teaching benefit. Source-family splits and chess-aware labels are needed before choosing a better metric or cutoff. Assignment/transport costs could address geometric displacement, but require their own definition and evaluation.

Unit checks include independent set/bit arithmetic, symmetry and triangle bounds over an enumerated feature universe, colour/direction preservation, empty sets, exact cutoff boundaries, sparse misses, legal-board compatibility and source scope. Browser checks isolate fuzzy candidates using orthogonal fake embeddings, then exercise exact source navigation, cancellation/held actions, restricted help, deletion, scratch changes and German phone explanations. Existing position/text/dense/hybrid baselines remain recorded separately.

## Retrieved coach passages and citations

TODO **8.6** adds local passage retrieval to position questions, general chat and tutor comments. Relevant game comments and authored study notes can accompany a coach request. **Passages supplied to the coach** shows the actual excerpts and source/licence assertions. Inline source citations open the exact annotated game occurrence; a study-note citation expands the supplied text. Leaving a running game needs confirmation and preserves **Return to my game**. Dialogue remains visible after navigation.

### Retrieval and context

[`retrieveContext()`](../../site/src/coach/retrieval-context.js) uses the production [hybrid retriever](#hybrid-passage-retrieval) with its local BM25, exact/nonempty-pawn and feature-tag channels. It runs without dense candidates, an embedding request or fuzzy pawn expansion. Library search controls do not configure this separate coach lookup. Annotation language is unknown/searchable; authored guides follow the interface language. General chat uses the question without the active board; position chat also supplies the visible main/scratch FEN. Tutor queries combine selected aspects, detected themes and a small plan/structure fallback.

The canonical account-local corpus is prepared before retrieval. At most three distinct annotation/guide sections are retained from twenty ranked candidates, with up to 900 characters from each passage. Overlapping chunks of one annotation do not consume multiple slots. The prompt includes the quoted title, source, author, supplied licence and excerpt; historical source FEN/ply and match class remain distinct from the current board. Imported data always passes through `quote()` and cannot declare its own citation target. No new corpus, dependencies, gateway route or `llmkit` code is added.

Asking the configured coach sends this bounded context through the existing task/provider route, including local-only and in-browser routing. It does not create an embedding upload. The composer discloses that relevant comments/notes can accompany a question. Automatic comments use the same policy and context limits.

### Citation identity and navigation

Each bundle has a SHA-256 identity over its selected records, query, board, language and account scope. A short digest namespace plus a 1–3 item ordinal forms an opaque `[S…]` token. It is stable for identical context, including after reload, and changes with source revisions or scope. Tokens contain no SAN, so they do not acquire accidental move links.

The renderer resolves only tokens supplied with that answer, using a captured local map, and displays compact numbered links such as **[1]**. Unknown well-formed tokens stay text with an unavailable-citation notice; they cannot select a game, URL or arbitrary source ID. The displayed source title is literal data, as are all excerpts and model output. A valid citation identifies a supplied passage; it does **not** establish that the adjacent claim follows from it.

Before navigation, the application resolves the full passage against the current canonical index, revision and occurrence. chess.js replays the source PGN and checks the full destination FEN. A repeated EPD can therefore open ply five rather than ply one; a FEN-root annotation opens its original root, preserving side and move counters. Confirmation rechecks the source and the live board before applying a load. No saved source is edited.

### Policy, state and limitations

- Restricted live help (`Off`, `Flag mistakes`, `Eval + mistakes`) supplies no passages, including in General chess. It also revokes existing source actions and removes source excerpts from the dialogue. The former uncited similar-position comment block is replaced by this guarded path.
- Source/account/help/provider changes cancel pending work and revoke source actions. Source/account changes discard model-turn history; help/provider changes discard it when passages were supplied. Restricted-only dialogue, such as an engine-access explanation before upgrading to Full help, remains usable. New requests cannot silently reuse an old account's source-bearing dialogue.
- Chat streaming and final results check game generation, source policy and the visible FEN. Tutor comments retain their explicit captured node/scratch context. Successful board tools prepare a fresh bundle before the next model turn; an account/source change during a tool cancels the run.
- Tutor cache keys include the bundle identity. Identical requests restore matching citations; changed source context cannot bind old cached prose to new sources. Persisted cache values remain strings under the existing bounded LRU.
- Source moves never enter `AnswerEvidence` or become Stockfish evidence. Engine-backed claims, played moves, legal-but-unchecked moves and unsupported moves keep their existing checks. Reading a historical statement does not verify a current-position plan.
- Ranking can return merely related text. No semantic entailment validator, calibrated abstention, evidence-quality benchmark or learner-benefit claim is added. The prompt asks the coach to cite supported claims and acknowledge missing support; compliance still depends on the model. Model-requested passage search, dense tutor retrieval and fuzzy tutor analogies remain future extensions.

Unit tests cover canonical repeated occurrences, detached/stable identities, foreign tokens, quoting, excerpt/count limits, language, deduplication, revisions, empty results and restricted lookup. Browser tests cover chat/tutor citations and cache reloads, unknown tokens, source deletion and held actions, help restrictions, stale main/scratch boards, live confirmation/return, FEN roots, board-tool refresh and German phone layout. These are mock-provider workflow checks, separate from the [retrieval relevance benchmarks](#position-retrieval-evaluation).

## Position retrieval evaluation

TODO 8.8 establishes a repeatable offline baseline for the existing `similarPositions()` retriever. The [recorded report](../eval/retrieval/baseline.md) and [JSON results](../eval/retrieval/baseline.json) measure relevance before text indexing and hybrid ranking. The [tutor-answer evaluation](../../site/eval/README.md) measures a different stage.

TODO 8.3.1 subsequently adds the separate [lexical passage benchmark](#measured-baseline), selected with `just retrieval-eval --mode text`. Its source passages, query set and relevance unit differ from the position suite; the default position baseline remains unchanged.

Explicit `--mode dense` and `--mode hybrid` comparisons followed in 8.3.2/8.4. They call the configured embedding provider on authored data, require `--allow-cloud` for cloud providers and never load `.env` or saved player data. The [hybrid report](#measured-comparison) separates unchanged text queries, an every-term ablation and ten board/intent cases.

TODO 8.5 adds an offline `--mode pawns` [spatial benchmark](#reproducible-spatial-benchmark) with ten original diagrams/eight separate queries. It compares the production exact/fuzzy position component, including an intentional sparse false negative; its corpus, labels and relevance task are separate from this original position suite.

The [literature algorithm comparison](../research/position-retrieval-comparison.md) maps current position/pawn, predicate, pattern and hybrid retrieval to relational BM25, solution-aware tactical retrieval and learned alternatives. It distinguishes these recorded development results from published experiments and defines inputs, grouping and metrics for a future shared-corpus comparison; those literature algorithms have not been benchmarked here.

### Running

From the repository root, with the site's npm dependencies installed:

```sh
just retrieval-eval
just retrieval-eval --json
just retrieval-eval --out docs/eval/retrieval/baseline
```

The first two print to stdout. `--out` explicitly writes `<stem>.md` and `<stem>.json`, creating their parent directory. Alternatively use `npm --prefix site run eval:retrieval`, or `node utils/retrieval-eval.mjs`. Output paths are relative to the caller's working directory. The utility also runs from outside the checkout using its absolute path. It needs no build, browser, Stockfish search, model, network, `.env` or saved user library.

The root `utils/` command calls app-specific code in `site/eval/retrieval/`, covered by the site's lint/type checks. There is no dependency on, import from, or change to `llmkit`; its independent test-oracle approach was inspiration.

### Corpus and judgements

[corpus.mjs](../../site/eval/retrieval/corpus.mjs) contains a fixed snapshot of the original thirteen classics/studies and eight original test scores: two transposing QGD routes, repeated knight arrivals, three IQP examples, castling rights and legal en passant. That is **21 documents, 481 indexed occurrences and 45 annotations**. [classics-fixture.mjs](../../site/eval/retrieval/classics-fixture.mjs) freezes the original records at `b1c4782`, so production catalogue expansion and historical-note corrections in TODO 7.3 do not alter the measured corpus or published hashes. Sources retain the [library model's](library.md) separate score/annotation assertions as recorded for that benchmark: fixtures declare the project's licence, while original historical score rights were not supplied. Current production source records are documented separately in [the classic-score manifest](../../site/data/classics/README.md). No third-party prose passages were added.

[cases.mjs](../../site/eval/retrieval/cases.mjs) defines **24 manually labelled queries** in English/German: eighteen answerable and six no-answer cases. Labels name a collection, game ID and relative ply, or a whole document for general analogies. Each positive has a reason and grade: 2 for directly relevant, 1 for a useful analogy. Unlisted candidates are non-relevant to that request. An identical-board request rejects pawn-only analogies; a request for the second note rejects the first occurrence and another game's matching board.

An IQP distractor shares the pawn signature but leaves White in check, making it unsuitable for a quiet-plan request. Steinitz–von Bardeleben remains a positive analogy: it is an actual classic with the same pawns, different pieces, and a later rook move to e1. These labels concern reference relevance, without claiming an engine proves any plan or move best.

The compiler replays every score with chess.js and resolves manual selectors to revision-bound document/occurrence IDs. Duplicate query/document IDs, invalid positions, stale/missing/excluded gold selectors, inconsistent no-answer labels and duplicate/invalid grades fail validation. Exact/transposition/occurrence positives must share the query EPD. Corpus and case SHA-256 values identify the ordered inputs; source revisions bind references to their PGN. Insertion order matters because the baseline uses it for ties.

### Metrics

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

### Initial findings

The baseline has **precision@1 0.833, recall@3 0.861 and MRR@3 0.852** across answerable cases. All twelve exact/transposition cases put a relevant result first. Occurrence-specific cases fail at rank one: shared early boards in other games precede the requested repetition-game notes, and the second note follows the first. IQP queries retrieve useful analogies but place the directly matching rook placement below broader examples and also return the checked distractor.

Four of six no-answer requests receive results: **false-positive rate 0.667**. Pawn-only analogies appear for exact-only requests, including pawnless rook positions. This records the lack of query-intent filtering; retrieval behaviour is unchanged by this slice.

Precision falls at larger k when only one reference is relevant, so read it alongside recall/ranking metrics. English/German slices contain different case mixes; paired queries have equal rankings because the current retriever ignores their text. This does not establish multilingual understanding.

### Extending the benchmark

Add original or appropriately sourced fixtures and manually reviewed labels, increment `SUITE_VERSION`, and regenerate reports. When expanding the corpus, review all candidates for new positives: labels are exhaustive only for their recorded corpus and request. Changed PGN alters revision IDs even if game ID and ply stay the same.

`runRetrievalBenchmark({ name, retrieve })` accepts future retrieval adapters over the same snapshots and candidate IDs. An adapter receives question text, language, FEN, relevance unit and current-game exclusion. Gold judgements, query IDs and evaluation groups—including the no-answer label—are withheld. It returns ordered occurrence records, which the scorer projects to the relevance unit. Passage retrieval will need an annotation/passage unit and text-specific cases.

This small authored development suite is not a held-out generalisation estimate. The [lexical/dense passage baselines](#study-text-search) and [hybrid comparison](#hybrid-passage-retrieval) followed in 8.3/8.4. Source/account/filter/deletion boundaries have unit/browser tests; larger update/deletion benchmarks, graph synthesis, semantic support/abstention and latency/cost studies remain later work. Chess correctness and teaching quality need separate checks.
