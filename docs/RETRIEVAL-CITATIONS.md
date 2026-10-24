# Retrieved coach passages and citations

TODO **8.6** adds local passage retrieval to position questions, general chat and tutor comments. Relevant game comments and authored study notes can accompany a coach request. **Passages supplied to the coach** shows the actual excerpts and source/licence assertions. Inline source citations open the exact annotated game occurrence; a study-note citation expands the supplied text. Leaving a running game needs confirmation and preserves **Return to my game**. Dialogue remains visible after navigation.

## Retrieval and context

[`retrieveContext()`](../site/src/retrieval-context.js) uses the production [hybrid retriever](HYBRID-SEARCH.md) with its local BM25, exact/nonempty-pawn and feature-tag channels. It runs without dense candidates, an embedding request or fuzzy pawn expansion. Library search controls do not configure this separate coach lookup. Annotation language is unknown/searchable; authored guides follow the interface language. General chat uses the question without the active board; position chat also supplies the visible main/scratch FEN. Tutor queries combine selected aspects, detected themes and a small plan/structure fallback.

The canonical account-local corpus is prepared before retrieval. At most three distinct annotation/guide sections are retained from twenty ranked candidates, with up to 900 characters from each passage. Overlapping chunks of one annotation do not consume multiple slots. The prompt includes the quoted title, source, author, supplied licence and excerpt; historical source FEN/ply and match class remain distinct from the current board. Imported data always passes through `quote()` and cannot declare its own citation target. No new corpus, dependencies, gateway route or `llmkit` code is added.

Asking the configured coach sends this bounded context through the existing task/provider route, including local-only and in-browser routing. It does not create an embedding upload. The composer discloses that relevant comments/notes can accompany a question. Automatic comments use the same policy and context limits.

## Citation identity and navigation

Each bundle has a SHA-256 identity over its selected records, query, board, language and account scope. A short digest namespace plus a 1–3 item ordinal forms an opaque `[S…]` token. It is stable for identical context, including after reload, and changes with source revisions or scope. Tokens contain no SAN, so they do not acquire accidental move links.

The renderer resolves only tokens supplied with that answer, using a captured local map, and displays compact numbered links such as **[1]**. Unknown well-formed tokens stay text with an unavailable-citation notice; they cannot select a game, URL or arbitrary source ID. The displayed source title is literal data, as are all excerpts and model output. A valid citation identifies a supplied passage; it does **not** establish that the adjacent claim follows from it.

Before navigation, the application resolves the full passage against the current canonical index, revision and occurrence. chess.js replays the source PGN and checks the full destination FEN. A repeated EPD can therefore open ply five rather than ply one; a FEN-root annotation opens its original root, preserving side and move counters. Confirmation rechecks the source and the live board before applying a load. No saved source is edited.

## Policy, state and limitations

- Restricted live help (`Off`, `Flag mistakes`, `Eval + mistakes`) supplies no passages, including in General chess. It also revokes existing source actions and removes source excerpts from the dialogue. The former uncited similar-position comment block is replaced by this guarded path.
- Source/account/help/provider changes cancel pending work and revoke source actions. Source/account changes discard model-turn history; help/provider changes discard it when passages were supplied. Restricted-only dialogue, such as an engine-access explanation before upgrading to Full help, remains usable. New requests cannot silently reuse an old account's source-bearing dialogue.
- Chat streaming and final results check game generation, source policy and the visible FEN. Tutor comments retain their explicit captured node/scratch context. Successful board tools prepare a fresh bundle before the next model turn; an account/source change during a tool cancels the run.
- Tutor cache keys include the bundle identity. Identical requests restore matching citations; changed source context cannot bind old cached prose to new sources. Persisted cache values remain strings under the existing bounded LRU.
- Source moves never enter `AnswerEvidence` or become Stockfish evidence. Engine-backed claims, played moves, legal-but-unchecked moves and unsupported moves keep their existing checks. Reading a historical statement does not verify a current-position plan.
- Ranking can return merely related text. No semantic entailment validator, calibrated abstention, evidence-quality benchmark or learner-benefit claim is added. The prompt asks the coach to cite supported claims and acknowledge missing support; compliance still depends on the model. Model-requested passage search, dense tutor retrieval and fuzzy tutor analogies remain future extensions.

Unit tests cover canonical repeated occurrences, detached/stable identities, foreign tokens, quoting, excerpt/count limits, language, deduplication, revisions, empty results and restricted lookup. Browser tests cover chat/tutor citations and cache reloads, unknown tokens, source deletion and held actions, help restrictions, stale main/scratch boards, live confirmation/return, FEN roots, board-tool refresh and German phone layout. These are mock-provider workflow checks, separate from the [retrieval relevance benchmarks](RETRIEVAL-EVAL.md).
