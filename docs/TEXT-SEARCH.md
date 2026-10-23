# Local study-text search

TODO **8.3.1** provides a lexical baseline over actual source passages. In **Library → Search study text**, enter keywords, choose personal/classic annotations or authored study notes, and select a text language. Results show a literal excerpt, full passage and source/licence assertion. **Open annotated position** opens the precise source occurrence, including a study's initial note or a later arrival at a repeated board. Opening another game during play keeps the existing confirmation and return path.

Search works without an AI provider. All text and queries stay in the browser. Restricted live-help settings hide and clear results, even when the Library tab is closed; Full engine help or analysis permits searching. Static source text is not checked advice for the position on the board. This slice does not add retrieved passages to model prompts or resolve model-generated citations; those remain 8.6.

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

The index is derived memory, not a second persistence format. Text rendering uses DOM text nodes, including imported titles/comments; no source text becomes HTML. Search makes no model calls, embedding requests or prompt changes.

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

## Remaining work

TODO 8.3.2 connects the existing separately configured embedding-provider helpers to passage ingestion/search. That needs source/owner boundaries before provider calls, local-only enforcement, provider/model/version/dimension records, controlled reindex/deletion and a measured comparison. This PR intentionally performs no automatic embedding requests. Hybrid/reranked retrieval remains 8.4; model-requested retrieval and validated answer citations remain 8.6. SQLite/IndexedDB persistence and a larger sourced corpus remain 7.6/7.3.
