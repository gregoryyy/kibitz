# Source-aware library records

TODO 7.1 establishes the records needed for RAG. `site/src/library/library.js` compiles a saved PGN into a versioned source, game document, shared positions, game occurrences, annotations and an optional study/problem record. Exact-position/pawn retrieval consumes these records, measured by the [position benchmark](RETRIEVAL-EVAL.md) (8.8). [Passage search](TEXT-SEARCH.md) (8.3) indexes original comments with these same locators, using local keywords or optional explicit embeddings. [Coach citations](RETRIEVAL-CITATIONS.md) (8.6) use them to open exact source occurrences; citation identity does not verify a prose claim.

## Records and identities

| Record | Identity | Contents and provenance |
| --- | --- | --- |
| Source | `source:<collection>:<encoded local game id>` | Origin, optional title/author/URL and separately supplied score/annotation licences. |
| Game document | `game:<collection>:<encoded local game id>` | Existing local ID, source ID, kind, title, score licence and SHA-256 revision of its stored PGN text. |
| Position | `position:<encoded EPD>` | Shared position key, including side to move and castling/legal en-passant rights, without counters. Provenance is reached through occurrences; one source's licence is not attached to every game sharing that board. |
| Occurrence | `<document id>@<revision>/ply/<index>` | Full FEN, relative ply, move label, SAN/UCI, position ID, source ID and score licence. Ply zero is the starting position. |
| Annotation | `<occurrence id>/comment/<ordinal>` or `/nags` | Original comment text or numeric annotation glyphs, source ID, annotation licence and an explicit unverified status. |
| Study/problem | `problem:<collection>:<encoded local game id>@<revision>` | Custom-start study's initial occurrence, source ID, score licence, stated result and recorded UCI line. Legality replay is checked; neither a forced solution nor the result is established. |

`collection` is `classic` or `library`. This prevents a built-in and a user game with equal local IDs from colliding. User records remain within the existing account or browser storage boundary; these identifiers do not replace ownership checks when server storage is introduced.

Logical game/source IDs survive source-metadata corrections. Occurrence/annotation IDs bind to a particular source revision, so editing the PGN changes them even if an update timestamp stays the same. Equal positions can retain their common position ID across revisions and games. Import deduplication (7.2) uses the conservative source-document identity below; shared positions or an equal mainline alone do not merge sources.

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

The packaged catalogue has 21 games and four studies. Each game identifies the published score version used: twelve complete Capablanca book scores carry the source's public-domain-in-the-USA statement, while nine earlier versions retain fixed Wikipedia revisions and CC BY-SA 4.0 move-data rights. Project-authored notes declare `GPL-3.0-or-later` separately; no third-party prose annotations are included. The [source manifest/audit](../site/data/classics/README.md) binds 1,355 legal plies to those records and makes historical/teaching distinctions explicit. It does not claim to authenticate every first publication or prove a resignation result. Study source verification remains 7.4; their metadata continues to identify the packaged collection without inventing original rights.

## Annotation and study locations

Every mainline occurrence retains the full FEN and the move number from that game, including a custom FEN starting with Black. Repeated boards share a position but keep separate occurrences and comments. Comment locators use UTF-16 string indices with an exclusive end into the stored PGN document, excluding the comment's braces or semicolon. Slicing the document at that range reproduces the stored comment text. Numeric glyphs retain their occurrence and values; their text-range locator is null.

Comments before the first move attach to ply zero. Custom-start positions, including position-only imports, participate in retrieval from that root. Standard-start game roots remain omitted from similar-position results to avoid returning every game for the initial board. Recorded study lines are replayed with chess.js and labelled `legal-replay-only`; source comments and NAGs remain `unverified`.

The index covers the mainline. RAV comments are excluded from its passages; variations remain in the stored source PGN. Current-game export still exports the board's mainline. Import through a textarea uses the text received from the browser, including its normal line-ending handling; locators refer to that stored document rather than byte offsets in an external file.

The board's comment map now uses full FENs too, preserving initial notes and comments at repeated positions on opening/saving. Export can still read old EPD-keyed snapshot comments; an old map cannot recover distinctions it previously discarded.

## Persistence and lifecycle

Existing `kibitz.games` arrays and hosted per-user game documents keep their IDs and fields. Legacy records without an envelope are interpreted in memory as unknown-source legacy records; reading them does not rewrite storage. An explicit save can add the version-one envelope. Invalid or unknown-version provenance remains untouched, is omitted from the position index and cannot be overwritten by a source edit or game save. A valid score can still be opened. Malformed PGN is kept but not indexed or opened as a valid game.

The Library import form accepts optional source fields for its batch. Each user game offers **Source and licences** for correction; built-in metadata is read-only. Source editing preserves the PGN. Browser writes affect only the changed games/books collection and publish the new index after storage succeeds. A failed save restores the previous in-memory record and keeps the source fields for retry. Hosted writes retain the existing per-document acknowledgement/snapshot behaviour.

Compiled snapshots are derived data, not a second persistent copy of the library. The cache keys on the exact PGN, provenance and kind, not timestamps. SHA-256 uses Web Crypto in the browser/Node. While replacements are compiled, the previous position index is cleared; a library generation guard prevents late work from restoring changed/deleted records. Source-edit actions recheck their target record before writing. Source fields reach coach retrieval context through bounded `quote()` data and are rendered as text; only validated source URLs become links.

The source-record and import slices add no provider calls, dependency, external corpus, engine evaluation or storage service. SQLite/IndexedDB remains 7.6. Labelled position retrieval benchmarks followed in [8.8](RETRIEVAL-EVAL.md), with local lexical passage search and optional scoped memory-only embeddings in [8.3](TEXT-SEARCH.md), and bounded coach retrieval with source citation checks in [8.6](RETRIEVAL-CITATIONS.md).

## Checks

Unit scenarios cover stable/scoped/revision IDs, old/future/malformed provenance, independent licences, repeated positions, original comment ranges, nested variations, custom Black starts, position-only studies, all built-ins and hostile prompt text. Browser scenarios cover import/reload, exact annotation navigation and opening/saving, source edits, write failure/retry, future metadata preservation, study roots, delayed work after deletion and German phone layout. Provider requests in tests use the mock gateway.
