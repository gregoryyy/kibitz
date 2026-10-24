# Study-text search

TODO **8.3.1** provides a lexical baseline over actual source passages. In **Library → Search study text**, enter keywords, choose personal/classic annotations or authored study notes, and select a text language. Results show a literal excerpt, full passage and source/licence assertion. **Open annotated position** opens the precise source occurrence, including a study's initial note or a later arrival at a repeated board. Opening another game during play keeps the existing confirmation and return path.

Default **Keywords** search works without an AI provider; its text and queries stay in the browser. TODO **8.3.2** adds optional **By meaning** search through explicit embedding requests, described below. Restricted live-help settings hide and clear results and vectors, even when the Library tab is closed; Full engine help or analysis permits searching. Static source text is not checked advice for the position on the board. Library searches do not themselves add passages to model prompts. The separate [coach retrieval/citation path](RETRIEVAL-CITATIONS.md), added in 8.6, uses local keyword/board lookup when asking the coach.

TODO **8.4** adds [Combined search](HYBRID-SEARCH.md): rank fusion, optional current-board signals, visible match reasons and a literal every-term constraint. It reuses the same explicit embedding actions and source/policy boundaries. Its measured comparison records both ranking regressions and stricter-filter recall losses.

## Passages and source identity

[`text-search.js`](../site/src/text-search.js) compiles two source types:

- A mainline PGN comment comes from a legal [`library.js`](../site/src/library.js) snapshot. It retains the SHA-256 PGN revision, source/document/annotation/occurrence IDs, full FEN, relative ply, collection and independently supplied annotation licence. NAGs and RAV comments are excluded. Initial comments are searchable even when the standard-start root is omitted from position-similarity retrieval.
- An original authored guide comes from [`authoredGuideTexts()`](../site/src/opening-guides.js) in English/German. Idea, plans and structure are separate passages. SHA-256 of the full language-specific guide versions all its sections. Locators identify the field and exact UTF-16 range. Guides declare the project licence and general-background status; they have no artificial board FEN or engine verification.

Long fields split into overlapping source substrings, at most 1,600 UTF-16 units with a target overlap of 160. Splitting prefers whitespace; exceptionally long unbroken tokens can split. Surrogate pairs remain intact. Annotation chunk locators address the original stored PGN; guide locators address the original section. IDs include revision, parent annotation/section and chunk range. Excerpts are also literal substrings centred on a matching term.

No external book passages, Primer/app-help text, new corpus licences or dependencies were added. Historical score rights remain separate from the project's authored annotations. A blank imported licence stays unknown; searching personal text locally does not establish redistribution or provider-ingestion permission.

## Lexical ranking and scope

`buildTextIndex()` creates an in-memory inverted index over passage title and body. Imported title metadata is bounded to 240 characters before indexing, preventing a large PGN header from being repeated in every passage. `searchText()` uses Okapi BM25 with k1=1.5 and b=0.75. Ties sort by stable passage ID; zero-score candidates never fill a result list. The interface shows at most eight results; the API bounds queries to 500 characters/64 distinct terms and results to twenty.

Tokenization retains Unicode words, ECO codes, castling and SAN tokens. Search spelling ignores case/diacritics and folds ß to ss. English/German stopwords add no signal. Uppercase German piece letters map to English SAN (`Dxf7` → `Qxf7`, `Sf3` → `Nf3`); lowercase pawn captures remain distinct. Check/mate suffixes do not prevent a move-name lookup. Stored text, source ranges and displayed notation are unchanged. There is no stemming, translation or semantic paraphrase model.

Language, source kind and collection filters apply before term/document statistics and scoring. Guides have explicit language tags. Imported annotations remain language-undetermined and are included for either interface language; language is not guessed from a name or move notation. The language filter is therefore strict for guides, not a claim that personal notes have been translated. All indexed personal records come from the currently loaded account/browser library.

Rebuilds immediately clear old annotation passages and results. The existing library generation guard rejects late source compilation after edits/deletions. Compiled authored guides are loaded lazily on the first applicable search and reused locally; their completion combines with the current library's notes. Source drafts remain outside the search renderer. Navigation rechecks help permission, game/library generation, query/source selection, source revision and current record before acting, including after a leave-game confirmation. chess.js replays the source game before loading it.

The lexical index is derived memory, not a second persistence format. Text rendering uses DOM text nodes, including imported titles/comments; no source text becomes HTML. Keyword search makes no model calls, embedding requests or prompt changes.

## Explicit semantic search

In **Library → Search study text**, choose a source/language and **By meaning**. The page fetches the embedding service's safe status and displays its provider/model. **Build semantic index** sends only that selection's title/body passages, in batches of sixteen, with a maximum of 512 passages. After building, enter a query and press **Search by meaning**. Selecting the method, changing filters and typing never upload passages or queries. Cancel/Clear aborts pending work and erases vectors. Keyword search remains the default.

`DenseSession` in [`dense-search.js`](../site/src/dense-search.js) takes a detached source snapshot and publishes an index only after every batch succeeds. It normalises finite, nonzero vectors and ranks by cosine similarity with stable passage-ID ties. Results use the same literal excerpts, source/licence display and exact occurrence navigation as keywords. Positive cosine is a ranking rule, **not a calibrated relevance threshold**; a hit may be unrelated, as the benchmark shows. The UI does not present similarity as chess strength or confidence.

Vectors live only in browser memory. Source edits/deletion, library/account selection, method/source/language changes and help/local-only policy changes cancel work and drop the index, even while Library is closed. Changing the game cancels pending actions/results while retaining a valid unchanged-source index. Typing cancels an old query without automatically replacing it. Generation checks reject late responses even when a provider ignores abort. Reloading requires rebuilding; no server vector cache, saved embedding index or background ingestion exists.

Each index records configured provider/model, optional operator-supplied revision, provider-reported model, observed dimension, `title-text-v1` input version, opaque endpoint/configuration fingerprint and opaque cookie scope. Batch/query metadata must match; dimension or reported-model drift rejects results. A changed service/scope requires reviewing the destination and another explicit build. **EMBEDDING_REVISION is an assertion supplied by the operator**, not a verified model-weight digest. Mutable model aliases can change without a detectable name/dimension change; use immutable model versions where possible and rebuild after changing weights. Unknown revisions are displayed as unknown.

### Gateway and configuration

The stateless [`embeddings.mjs`](../site/server/embeddings.mjs) helper exposes GET/POST `/api/ai/embeddings`. GET returns safe configuration; POST accepts only `{texts, fingerprint, scope}` and returns vectors/metadata/usage. Existing Host, Origin, JSON and body bounds apply. The cookie scope partitions requests and cache identities; **it is not account authentication**. Library/account ownership and source filtering happen in the page before transport. This endpoint cannot look up any player's saved library. It does not log or persist text/vectors, and exposes no credentials or endpoint URL.

Configure `.env` and restart the server:

```dotenv
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=bge-m3:latest
EMBEDDING_REVISION=
```

OpenAI and Mistral reuse that named provider's key/base URL independently of the chat provider. Local-only mode refuses cloud embeddings rather than silently redirecting them to the chat model. Ollama uses its allowlisted host; before sending text, `/api/show` must identify a local GGUF/Safetensors embedding model with an architecture and embedding capability. Remote/cloud aliases and unknown/older metadata fail closed. Turning local-only on aborts admitted cloud embedding work; late vectors are refused.

Embedding calls share the gateway's server token budget, paid-provider user budgets and rate limiter. One active request per cookie and four overall bound concurrent work. Configure `AI_PRICES` for the embedding model to estimate costs; missing prices remain unknown. Missing provider usage is conservatively counted as UTF-8 input bytes plus one per text and marked estimated. Large builds may hit the shared per-minute limit and require retrying; no partial index is published. Completed provider work is counted even if the caller cancels or policy changes before delivery.

The client requests float vectors and validates one indexed result per input, uniform dimensions and finite nonzero coordinates. Indexed embedding responses, float encoding and usage fields are documented by [OpenAI](https://developers.openai.com/api/reference/resources/embeddings/methods/create) and [Mistral](https://docs.mistral.ai/api/endpoint/embeddings). Literal title/body strings are embedding inputs, not generative prompts. They receive no instructions and are not wrapped in `quote()`; any future use in tutor prompts still requires `quote()` and citation validation. Explicit provider ingestion does not establish rights to redistribute imported annotations.

## Measured baseline

Use the root utility:

```sh
just retrieval-eval --mode text
just retrieval-eval --mode text --json
just retrieval-eval --mode text --out docs/eval/retrieval/text-baseline
```

The default mode remains the [position benchmark](RETRIEVAL-EVAL.md). Text mode reuses that fixed corpus's **45 comments** and adds **114 sections from 38 language-specific guides**: 159 passages. Twenty-eight manual queries contain twenty answerable cases and eight no-answer cases. Gold selectors name an annotation's collection/game/ply or a guide's language/section, independently of the ranked result. Scope and source existence are validated before scoring.

The [recorded report](eval/retrieval/text-baseline.md) and [JSON](eval/retrieval/text-baseline.json) include source locations, input hashes and precision/recall/MRR/nDCG at 1/3/6. The [8.8 metric definitions](RETRIEVAL-EVAL.md#metrics) also apply here. Unit tests check independent BM25 arithmetic, source ranges, filtering, ID/revision stability and report reproduction. Browser scenarios check import/navigation/reload, provider-free use, literal hostile text, source drafts, delayed indexing/deletion, stale actions, help policy and German phone layout.

Initial precision@1 is **0.900**, recall@3 **0.950**, and MRR@3 **0.917**. All eighteen direct keyword cases put a relevant passage first. Both paraphrases miss at rank one; the Lucena bridge appears at rank three, while the German isolated-pawn paraphrase finds no relevant passage. Two of eight no-answer cases return ordinary chess passages sharing words with an unsupported request, a **0.250 false-positive rate**. Matching “rook” and “draw” does not supply a Syzygy proof.

These are small authored development cases, not a held-out generalisation estimate or chess/answer-quality measurement. They make lexical limitations visible before comparing embeddings. Corpus or label changes require manual relevance review, suite-version updates and regenerated reports. Passage rankings cannot be compared numerically with the position benchmark as if the two suites had the same queries or relevance unit.

## Measured dense comparison

`--mode dense` runs the same authored corpus, query filters, gold judgements and scoring through production `DenseSession` and the separately configured embedder. Alternate adapters receive no gold labels, case IDs or evaluation groups; returned IDs must resolve to the permitted corpus, and canonical source references are restored before scoring. The runner never reads a saved player library or auto-loads `.env`. Cloud providers additionally require `--allow-cloud`; tests use mock/fake clients only.

```sh
EMBEDDING_PROVIDER=ollama EMBEDDING_MODEL=bge-m3:latest \
  EMBEDDING_REVISION=<installed-model-digest> \
  node utils/retrieval-eval.mjs --mode dense --out docs/eval/retrieval/dense-bge-m3
```

On 2026-10-23, a manual local run used the already-installed **bge-m3**, Ollama 0.40.7 on Apple M1 Pro Metal, F16, 1024 dimensions. An isolated daemon on port 11435 had cloud use and model pruning disabled; no weights were downloaded. The [Markdown report](eval/retrieval/dense-bge-m3.md) and [JSON](eval/retrieval/dense-bge-m3.json) record the full supplied model digest and the same corpus/case hashes as BM25. Endpoints contribute to the opaque fingerprint; hardware/provider revisions may affect numerical results.

| Measure | BM25 | bge-m3 cosine |
| --- | ---: | ---: |
| Precision@1, 20 answerable queries | 0.900 | 0.950 |
| Recall@3, 20 answerable queries | 0.950 | 1.000 |
| MRR@3, 20 answerable queries | 0.917 | 0.975 |
| No-answer false positives, 8 queries | 0.250 | 1.000 |

Both paraphrases now retrieve a relevant passage within three results; one ranks first. However, **all eight queries labelled no-answer return hits**, including unsupported quantum requests and requests without a supporting passage in the selected scope. Dense retrieval respects those source filters but can rank unrelated passages inside the allowed scope. The unchanged lexical gold also has an intent limitation: `wrong-language` labels German “Isolani” unanswerable in English guides, although the English isolated-pawn passage can be semantically useful. The reported 1.000 is therefore a false-positive rate against these fixed labels, not a universal semantic-error estimate. Review intent/relevance labels separately before calibrating abstention; the off-topic quantum and unsupported-proof cases remain unsupported. Improved recall does not justify feeding the top hit to the coach as evidence. These twenty-eight authored development queries are too small for a general quality claim; the subsequent [hybrid comparison](HYBRID-SEARCH.md) records fusion/filter tradeoffs and separate board/intent labels, with calibrated semantic abstention still unestablished.

Unit tests cover independent cosine geometry, vector/identity validation, filtering before ingestion, bounded atomic builds, cancellation/deletion, fake provider contracts, cookie isolation, local-only transitions, budgets and report/reference validation. Browser regressions cover explicit uploads, paraphrase navigation at repeated positions, source/language changes, reload, stale/deleted work, provider/dimension changes, closed-tab policy changes and German phone controls.

## Remaining work

[Hybrid/reranked retrieval](HYBRID-SEARCH.md) followed in 8.4, including optional exact/pawn/feature-tag signals and literal term filtering. Model-specific relevance calibration and semantic support/abstention still need separately reviewed labels and held-out evaluation. [Bounded coach retrieval and answer citation identity checks](RETRIEVAL-CITATIONS.md) followed in 8.6. Model-requested passage search remains a future extension. SQLite/IndexedDB persistence and a larger sourced corpus remain 7.6/7.3. No dependency or code was imported from `llmkit`; it remains inspiration only.
