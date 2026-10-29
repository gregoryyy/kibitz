# Source-aware library records

[Data controls](../guide/readme.md#data-export-and-deletion) export complete browser/selected-cookie server records and provide separate confirmed erasure. Server erasure atomically removes that owner's games/references while retaining an advanced revision to reject older pending writes. It does not erase other owners or the separate browser library.

TODO 7.1 establishes the records needed for RAG. `site/src/library/library.js` compiles a saved PGN into a versioned source, game document, shared positions, game occurrences, annotations and an optional study/problem record. Exact-position/pawn retrieval consumes these records, measured by the [position benchmark](retrieval.md#position-retrieval-evaluation) (8.8). [Passage search](retrieval.md#study-text-search) (8.3) indexes original comments with these same locators, using local keywords or optional explicit embeddings. [Coach citations](retrieval.md#retrieved-coach-passages-and-citations) (8.6) use them to open exact source occurrences; citation identity does not verify a prose claim.

## Records and identities

| Record | Identity | Contents and provenance |
| --- | --- | --- |
| Source | `source:<collection>:<encoded local game id>` | Origin, optional title/author/URL and separately supplied score/annotation licences. |
| Game document | `game:<collection>:<encoded local game id>` | Existing local ID, source ID, kind, title, score licence and SHA-256 revision of its stored PGN text. |
| Position | `position:<encoded EPD>` | Shared position key, including side to move and castling/legal en-passant rights, without counters; derived material/placement signatures and piece-square features accompany it. Provenance is reached through occurrences; one source's licence is not attached to every game sharing that board. |
| Occurrence | `<document id>@<revision>/ply/<index>` | Full FEN, relative ply, move label, SAN/UCI, position ID, derived signatures/pattern records, source ID and score licence. Ply zero is the starting position. |
| Annotation | `<occurrence id>/comment/<ordinal>` or `/nags` | Original comment text or numeric annotation glyphs, source ID, annotation licence and an explicit unverified status. |
| Study/problem | `problem:<collection>:<encoded local game id>@<revision>` | Custom-start study's initial occurrence, source ID, score licence, stated result and recorded UCI line. General imports have legal-replay-only status. Curated records can additionally bind the exact source/FEN/branch to saved tablebase evidence and actual mate-in-one proof, as described below. |

`collection` is `classic` or `library`. This prevents a built-in and a user game with equal local IDs from colliding. User records remain within the selected browser/account/cookie-owned server boundary; these identifiers do not replace ownership checks.

Logical game/source IDs survive source-metadata corrections. Occurrence/annotation IDs bind to a particular source revision, so editing the PGN changes them even if an update timestamp stays the same. Equal positions can retain their common position ID across revisions and games. Import deduplication (7.2) uses the conservative source-document identity below; shared positions or an equal mainline alone do not merge sources.

## Material and piece placement

TODO 8.1 adds `chess/signatures.js`. `boardSignatures(fen)` accepts a FEN/EPD from the rules layer, checks its encoding and produces `counts-squares-v1` facts. The source compiler already validates the starting position and replays every move with chess.js. Each shared position and full-FEN occurrence carries its derived `signatures`; imported signature/position claims never supply these facts. These are derived data, without a persistent record/schema migration.

| Field | Meaning |
| --- | --- |
| `counts` | Per-colour counts of pawns, knights, bishops, rooks, queens and kings. Same scalar material value can represent different piece classes. Captures/promotions change counts; castling changes occupied squares while preserving material. |
| `material` | A versioned canonical key, White then Black, using piece-count order `p,n,b,r,q,k`, including zeros. |
| `pieces` | Sorted colour/type/square terms such as `wNf3` or `bPd5`; every term names an occupied source square. |
| `placement` | A versioned key over the complete sorted term set. Equal placement can still differ in turn, castling/en-passant rights or counters; exact identity remains EPD, and occurrences retain full FENs. |

`buildPositionIndex()` now populates `byMaterial`, `byPlacement` and `byPieceSquare` beside the existing exact/pawn buckets. New buckets recompute geometry from the actual FEN/EPD rather than trusting supplied feature fields. Invalid encodings do not enter these buckets. All source occurrences remain distinct, including repeated boards, revisions and equal local IDs in different collections. Keys encode board facts, not ownership, rights to text or move strength; callers use the current owner's source-aware index.

`positionFeatureMatches(index, fen, options)` offers bounded structural predicates:

```js
// Either side's exact piece classes/counts, keeping each source occurrence.
positionFeatureMatches(index, fen, { by: 'material', collection: 'library', limit: 6 });
// Equal occupied piece squares, with original source state still available on p.fen.
positionFeatureMatches(index, fen, { by: 'placement', documentId, limit: 6 });
// All selected query pieces must occur on the same squares in the source.
positionFeatureMatches(index, fen, { by: 'pieces', pieces: ['wNf3', 'bPd5'], limit: 6 });
```

The default is a material lookup. Collection/document filters are literal; result limits are 1–20. Selected piece terms must be unique, bounded and present in the query position. Results retain `g`/`p` with full source/revision identity, an explicit structural `kind` and matched material/placement/piece facts, in index order. A piece subset can match a source with additional material; full placement equality has its own query mode. No piece mirroring, colour swapping, geometric distance, learned weight or confidence score is introduced.

This completes feature indexing and typed lookups. Existing exact/pawn retrieval and hybrid ranking keep their prior behavior; selecting material/placement similarity profiles remains the separate [aspect-similarity research](../research/position-similarity.md). Geometry does not verify a source annotation, transfer a move to another board or prove an endgame outcome. The full FEN, legal source line and existing engine/tablebase checks remain authoritative for those tasks. The debug `positionIndex()` getter exposes the actual current index for inspection; deletion/replacement rebuilds all feature buckets under the existing library-generation guard.

## Position and move pattern tags

TODO 8.2 adds `library/patterns.js` and the separate `pattern-browser.js` UI. After full legal mainline replay, every source occurrence, including ply zero, carries `patterns`: version `detectors-v1`, known tag, position/move role, evidence class, detector reason/weight and a revision-bound pattern ID. The record points to its occurrence and exact start/end occurrences, full branch FENs, UCI moves and source move labels. A move pattern belongs to the occurrence **after its first move**; a combination additionally retains the recorded reply/follow-up, up to three plies. The original score, source/rights and annotation locations remain on the enclosing source snapshot.

| Evidence class | Meaning |
| --- | --- |
| `heuristic` | A position theme from `positionFeatures()`, such as IQP, Carlsbad or rook ending. Phase/structure/plan labels remain detector heuristics. |
| `candidate` | A geometric move or concrete-line pattern from `moveMotifs()`/`lineMotifs()`. This can describe an unsound move or a cooperative recorded reply. No best defence, forced payoff or favourable evaluation is established. |
| `rules` | The replayed move actually delivers checkmate or promotes a pawn, checked by chess.js. A promotion fact does not certify the choice or result; related back-rank/king-attack labels remain candidates. |

Early plies from the complete standard initial FEN receive an opening-phase heuristic, including the untouched starting board. Custom-start counters and PGN opening names do not establish a known opening, and no opening-family label is inferred from a supplied header. These source-context labels do not change the existing hybrid retrieval phase policy. Tags remain occurrence-specific: a repeated EPD can have different contextual phase labels later in its source. Missing tags mean not detected, not proven absent; this reuses the existing detector coverage rather than diagnosing every tactical/strategic concept.

`buildPatternIndex()` consumes compiled occurrences, retaining repeated occurrences and collection/document identity. `patternMatches(index, {tag, role, status, collection, documentId, limit})` filters exact known tag IDs with optional role/evidence/source predicates, returning at most 20 occurrences in index order. It supplies no relevance probability or automatic chess advice. The app builds this index from the compiler's records, ignoring raw game `tags`/`patterns`/`positions`, comments, glyphs and source-verification assertions. General study solutions and annotations retain their separate unverified status.

In **Library → Search detected patterns**, choose a tag, source collection and evidence class. Each result names its evidence class and recorded move sequence. **Open source position** navigates to that exact source occurrence through the existing active-game confirmation/return path. Search runs locally without a provider, engine search, source fetch, upload or persistent migration. The catalogue Theme filter continues to mean supplied catalogue metadata. Pattern search is hidden under restricted live help; held actions recheck game/library generation, current source revision, filters and policy. Deletion, replacement and storage/owner changes clear/rebuild the index under the existing generation guard. `?debug` exposes the actual current `patternIndex()`.

## Catalogue search

TODO 7.5 (`library/search.js`) shares a deterministic metadata matcher between the Library controls and the coach's `search_library` tool. Search words and fields combine with AND; word order is irrelevant, and matching ignores case/Unicode combining accents while keeping punctuation literal. Free text covers title (including a localized built-in title), both players, opening/ECO, recorded date/result, and theme IDs/English/localized labels. This is metadata retrieval, separate from [passage search](retrieval.md#study-text-search), with no model, embedding request, remote source fetch or storage write.

| Filter | Meaning |
| --- | --- |
| Player | Search words in either White or Black's recorded name. |
| Opening or ECO | Search words in the opening name/code. The deepest matching EPD among the first 40 legally replayed plies supplies a catalogue label; custom-start studies are not classified from their final position. Supplied PGN/legacy labels remain a fallback. |
| From / to year | Inclusive recorded year, from 1 to 9999. Partial month/day values can retain a known four-digit year; unknown/malformed years do not enter a range. Invalid/reversed filter bounds show an error and return no records. These dates are source metadata, not historical authentication. |
| Recorded result | Absolute White win (`1-0`), draw (`1/2-1/2`), Black win (`0-1`), or unfinished/unknown (`*`). |
| Theme | Recorded catalogue tags. A known theme ID matches tag membership exactly; English/localized label words are also searchable. Tags confer no engine-verification or performance certificate. |

For example, Player **Morphy**, years **1858–1858**, result **White wins** and theme **Pin** find the Opera Game. Category filters remain in effect; an active search in All includes classics even beside personal games. Clearing search keeps the chosen category and returns focus to the text field. Accessible labels, result/error status, invalid-year indication and English/German phone layouts accompany the controls. Searches are page-local and are not saved across reloads.

Legal PGN headers supply canonical player/date/result metadata; flat fields remain available for legacy/unreadable records, which are kept without a rewrite. PGN parsing is cached by collection/local ID and exact PGN text, bounded to 200,000 characters and 4,000 plies. Search fields are bounded to 200 characters; no user text becomes a regular expression. Source/account changes invalidate the ordinary catalogue caches; ECO readiness updates retained cards without replacing open source forms or their unsaved edits/focus. Browse controls never alter the game on the board.

The coach tool adds `player`, `opening`, integer `yearFrom`/`yearTo`, `theme` and absolute `score` filters. Existing `color` and `result` mean the player's own colour and win/loss/draw, independently of `score`. Arguments are validated before matching. At most eight hits are returned, newest known recorded date first, with bounded quoted metadata and no PGN/comments. Explicitly asking the coach to search still uses its normal provider/tool flow; local browsing needs no provider.

## Import deduplication

`src/library/import.js` derives an in-memory exact key from a legally replayed PGN, its full starting FEN, parsed headers/mainline, original annotation/variation tokens and normalized source/licence assertions. It ignores whitespace outside source strings/comments, mainline move-number spacing, header order and line-ending convention. Comments retain their content, glyphs and RAVs retain their tokens, and headers retain explicit/duplicate tag content as well as their parsed values. Different player/event/result fields, comments, branches, full-FEN counters or rights remain different documents. Entry origin, generated local ID and timestamps do not change content identity. This is conservative document matching, not fuzzy game identification; equivalent chess lines with differently expressed source content can remain separate.

Only the importing user's library and earlier records in the batch participate; built-ins stay separate. Existing IDs, PGN bytes, metadata and revisions are never rewritten. Legacy records can match without migration. Invalid PGN, malformed/future provenance or content that cannot safely receive a key cannot suppress an incoming valid document. Existing duplicates are not deleted retrospectively.

The bounded splitter recognizes top-level header/movetext boundaries, including adjacent/headerless games, without splitting tag-like text inside comments/variations. Imports accept at most 500 games and 5 million characters; each game retains the 200,000-character/4,000-ply limits. Added, duplicate, unreadable and failed-save counts stay separate. A failed/unreadable batch remains for retry, and a newly typed batch is never cleared by an older completion. Overlapping imports are disabled. After asynchronous validation, deduplication rechecks current library records immediately before writing. Duplicate-only batches make no storage write/index rebuild. Failed local writes roll back as before. Account writes remember each acknowledged import until its snapshot arrives, so partial-save retries do not create extra documents during that delay. This is scoped to the current client/account view, not a cross-device database uniqueness transaction.

## Source assertions

Each persisted flat game can carry this optional envelope:

```json
{
  "provenance": {
    "version": 1,
    "origin": "imported",
    "source": {
      "title": "My annotated workbook",
      "author": "An editor",
      "url": "https://example.org/workbook"
    },
    "rights": {
      "score": "CC0-1.0",
      "annotations": "Personal notes"
    }
  }
}
```

Origins are `imported`, `played`, `board`, `builtin` and `legacy`. `board` describes a newly saved analysis board, without asserting who authored its score. Source titles are bounded to 240 characters, authors and licence statements to 160, and URLs to 2,048. URLs must be HTTP(S), without embedded credentials. Import/indexing never fetches them. The fields record supplied attribution/licence statements; they do not verify rights or grant permission for redistribution or provider ingestion. Empty strings mean not supplied. Game age, a PGN `Site` header and an `Annotator` header do not supply a licence.

The packaged catalogue has 21 games and twelve problems/studies. Each game identifies the published score version used: twelve complete Capablanca book scores carry the source's public-domain-in-the-USA statement, while nine earlier versions retain fixed Wikipedia revisions and CC BY-SA 4.0 move-data rights. Project-authored notes declare `GPL-3.0-or-later` separately; no third-party prose annotations are included. The [game source manifest/audit](../../site/data/classics/README.md) binds 1,355 legal plies to those records and makes historical/teaching distinctions explicit. It does not claim to authenticate every first publication or prove a resignation result.

The [problem/study manifest](../../site/data/problems/README.md) records published Réti/Saavedra diagrams under CC BY-SA 4.0, authored Lucena/Philidor variants with separate method references, and eight original curriculum exercises under the project licence. Diagram cells, source revisions, explicit unknown dates for the variants and source/annotation rights stay distinct. No first-publication claim follows from a conventional name.

## Curated problem evidence

The general compiler continues to produce `legal-replay-only` problem records. The app's library snapshot composition separately calls `library/problems.js` for known curated definitions in the `classic` collection. It binds the logical document, full initial FEN including counters, UCI branch, result and source/score rights before checking saved Syzygy data. Four mate-in-one records additionally prove actual checkmate. Their `problem.verification` becomes `tablebase-branch`, with outcome/date/root URL and separate mate facts. This applies to the recorded branch, without asserting unique best play, other future continuations or learner success. Annotation verification stays `unverified`.

Imported records cannot opt in through an ID, matching board or extra metadata: the collection boundary and exact definition binding are explicit. Changing a counter/line/source/result invalidates the certificate. Caller-facing problem metadata is detached from the trusted registry. All 48 worked plies audit against 50 saved numerical snapshots offline; the explicit developer refresh queries only 22 fixed published-study FENs. Runtime browsing makes no tablebase/source request. **Problems** filters the twelve curated records even with a personal library, and **Open** starts at the diagram. Move navigation exposes the recorded example; no completion is written to lesson progress.

## Annotation and study locations

Every mainline occurrence retains the full FEN and the move number from that game, including a custom FEN starting with Black. Repeated boards share a position but keep separate occurrences and comments. Comment locators use UTF-16 string indices with an exclusive end into the stored PGN document, excluding the comment's braces or semicolon. Slicing the document at that range reproduces the stored comment text. Numeric glyphs retain their occurrence and values; their text-range locator is null.

Comments before the first move attach to ply zero. Custom-start positions, including position-only imports, participate in retrieval from that root. Standard-start game roots remain omitted from similar-position results to avoid returning every game for the initial board. General study lines are replayed with chess.js and labelled `legal-replay-only`; curated branch evidence is a separate composition step above. Source comments and NAGs remain `unverified` in either case.

The index covers the mainline. RAV comments are excluded from its passages; variations remain in the stored source PGN. Current-game export still exports the board's mainline. Import through a textarea uses the text received from the browser, including its normal line-ending handling; locators refer to that stored document rather than byte offsets in an external file.

The board's comment map now uses full FENs too, preserving initial notes and comments at repeated positions on opening/saving. Export can still read old EPD-keyed snapshot comments; an old map cannot recover distinctions it previously discarded.

## Persistence and lifecycle

Existing `kibitz.games` arrays and hosted per-user game documents keep their IDs and fields. Legacy records without an envelope are interpreted in memory as unknown-source legacy records; reading them does not rewrite storage. An explicit save can add the version-one envelope. Invalid or unknown-version provenance remains untouched, is omitted from the position index and cannot be overwritten by a source edit or game save. A valid score can still be opened. Malformed PGN is kept but not indexed or opened as a valid game.

The Library import form accepts optional source fields for its batch. Each user game offers **Source and licences** for correction; built-in metadata is read-only. Source editing preserves the PGN. Browser writes affect only the changed games/books collection and publish the new index after storage succeeds. A failed save restores the previous in-memory record and keeps the source fields for retry. Hosted writes retain the existing per-document acknowledgement/snapshot behaviour.

Compiled snapshots are derived data, not a second persistent copy of the library. The cache keys on the exact PGN, provenance and kind, not timestamps. SHA-256 uses Web Crypto in the browser/Node. While replacements are compiled, the previous position index is cleared; a library generation guard prevents late work from restoring changed/deleted records. Source-edit actions recheck their target record before writing. Source fields reach coach retrieval context through bounded `quote()` data and are rendered as text; only validated source URLs become links.

The source-record and import slices add no provider calls, dependency, external corpus or engine evaluation. The optional SQLite/IndexedDB storage boundary (7.6) is described below. Labelled position retrieval benchmarks followed in [8.8](retrieval.md#position-retrieval-evaluation), with local lexical passage search and optional scoped memory-only embeddings in [8.3](retrieval.md#study-text-search), and bounded coach retrieval with source citation checks in [8.6](retrieval.md#retrieved-coach-passages-and-citations).

## Server library and browser cache

TODO 7.6 adds optional persistence through `serve.mjs --library FILE`, independently of the AI gateway. The default browser library remains in `localStorage`, and the hosted artifact retains its per-user account backend. **Use server library** explicitly selects a separate games/reference collection; switching never uploads or migrates the existing browser records. The selected destination is remembered per browser. The board, current-game snapshot, lessons and repertoire data retain their existing storage paths.

`server/library-store.mjs` uses Node's bundled [SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), with no new npm dependency. Schema version one contains an `owners` table (hashed scope and revision) and `records` (scope, collection, stable local ID, original JSON), keyed by owner/collection/ID. Original PGN bytes, provenance and unknown record fields survive reads/restarts. Derived source/position/passage indexes rebuild in memory. Unknown database schemas are rejected without migration or deletion. SQL statements use bound parameters, and each read has a consistent transaction; mutations use `BEGIN IMMEDIATE`, optimistic owner revisions and all-or-nothing commits. An outdated revision returns 409, preserving records and client edits until an explicit refresh.

`library-files.mjs` creates new databases with mode 0600 and parent directories with 0700, outside the static root, including canonical parent-symlink checks. Existing files must already be private regular files; symlinks/public-readable files are rejected without chmod or content changes. The ignored `.kibitz-data/` directory is the documented destination. SQLite uses WAL, full synchronous commits and a one-second busy timeout. `:memory:` is available for temporary tests. The CLI mounts these routes before the AI gateway's broader `/api/` handler, and can serve the library without an AI provider or environment file.

| Route | Behavior |
| --- | --- |
| `GET /api/library/status` | Reports availability and an existing cookie's opaque scope; creates no cookie or record. This is the initial browser availability probe. |
| `GET /api/library/records` | Explicitly connects. A missing/malformed library cookie receives a new random 256-bit capability; the response contains schema version, hashed scope, owner revision, games and references. |
| `POST /api/library/records` | Applies a bounded `{scope, revision, changes}` batch. `scope` is a precondition; the cookie alone selects the SQL owner. Changes address `games` or `books`, a stable ID and either a record or `null` for deletion. |

The dedicated `kibitz_library` cookie is HttpOnly and SameSite=Strict, scoped to the library routes, with Secure on a native TLS connection. The server stores/returns its SHA-256-derived scope rather than the capability. Host/Origin/Fetch-Site checks reject cross-origin access; writes require JSON. Responses use no-store/Vary: Cookie, static error messages and no source/cookie/body logging. Fresh writes validate full PGNs/provenance and reference fields; opaque legacy reads do not gain a proof certificate. Limits are 500 changes, 1,000 records per owner, one MB per record, ten MB per request and twenty MB of stored record JSON; UTF-8 bytes matter. A separate global library limit permits 120 writes per minute. This is anonymous cookie-scoped local-server storage; deployment and authenticated accounts remain 10.1–10.2. Clearing the cookie starts another library without deleting the prior owner's records.

`library/server-session.js` serializes client mutation plans against the latest acknowledgement, checking source generation, scope and record identity before/after asynchronous work. It sends the expected owner revision and rechecks import deduplication inside the queue. Unchanged records retain object identities across acknowledgements, preserving unrelated source-form drafts. Conflicts keep the existing view/edit with an explicit refresh instruction. A lost response leaves an uncertain acknowledgement: refresh retrieves what actually committed, then retry can skip a duplicate without another write. A changed/missing cookie session clears the private server snapshot. Held source/delete controls, delayed account callbacks and old responses cannot update a different selected library. Owned copies remain deletable regardless of their example-kind metadata. Reference forms retain text entered while a prior save was pending, and a successful save names its actual destination.

`library/cache.js` keeps version-one snapshots in the origin's `kibitz-library` IndexedDB database, keyed by verified server scope. Cache records contain their own format version, snapshot and timestamp, with shared count/ID/UTF-8 limits in `storage.js`. A cache write captures its snapshot before awaiting connection and resolves only on transaction completion. Aborts preserve the previous entry; unknown layouts, future database versions and future envelope versions are preserved. Version changes close old connections, and an unavailable/blocked opening times out without blocking the server save indefinitely. This follows IndexedDB's [transaction lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#adding_retrieving_and_removing_data): request success can still precede an abort.

SQLite acknowledgement is the save result. If the optional cache write fails, the UI still reports the successful server save and separately reports cache unavailability. Cached fallback is read-only and requires a verified cookie scope; a fresh load with no identity verification cannot show a previous owner's cached records. There is no offline write queue or automatic conflict merge. Explicit refresh can replace a changed source form, so edits are retained on failure while the user reviews the conflict. Full offline page loading remains the PWA milestone (10.7).

## Checks

Unit scenarios cover stable/scoped/revision IDs, old/future/malformed provenance, independent licences, repeated positions, original comment ranges, nested variations, custom Black starts, position-only studies, all built-ins and hostile prompt text. Browser scenarios cover import/reload, exact annotation navigation and opening/saving, source edits, write failure/retry, future metadata preservation, study roots, delayed work after deletion and German phone layout. Provider requests in tests use the mock gateway.

Storage checks additionally cover real SQLite restart/owner isolation, stale revisions, transactional quota rollback, private paths, standalone/gateway CLI modes, HTTP origin/cookie/UTF-8 validation, shared snapshot bounds, serialized client plans and stale-generation cancellation. Real IndexedDB browser cases cover native aborts after request success, scope separation, future formats and version changes. Server UI cases cover explicit selection/no upload, reload, verified cache isolation, cache failure after commit, lost acknowledgements/deduplication, source conflicts, held controls, late account callbacks, reference edits and German phone layout.
