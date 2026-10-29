# Curated problems and studies

The Library's **Problems** filter contains twelve positions: four mates in one and eight studies/reflections. Eight exercises reuse the project's authored curriculum material; Réti and Saavedra retain published diagram sources, and Lucena/Philidor are explicitly authored teaching variants. The complete reference catalogue has **21 games and twelve problems/studies**, or 33 records.

Each card shows an English/German question. **Open** starts at the full-FEN diagram; the normal move list/Previous/Next controls expose its worked line. Viewing or exploring a problem does not record a lesson solve. The collection is available locally without a model or runtime source request. During a running game, the existing departure confirmation and return path apply.

| Position | Kind | Recorded outcome, from White's perspective |
| --- | --- | --- |
| Queen mate, White / Black | Two mates in one | White win / Black win |
| Rook mate, White / Black | Two mates in one | White win / Black win |
| Supported promotion | Study/reflection | White win |
| Rook pawn in the corner | Study/reflection | Draw |
| Opposition, White / Black to move | Two studies/reflections | Draw / White win |
| Réti's king march | Published study | Draw |
| Saavedra underpromotion | Published study | White win |
| Lucena bridge | Authored conventional variant | White win |
| Philidor defence | Authored conventional variant | Draw |

## Sources and rights

`study-sources.json` retains fixed Wikipedia revisions, retrieval dates, fetched-HTML digests and the exact 64 diagram cells for Réti and Saavedra. Those diagram/score facts retain **CC BY-SA 4.0**, credited to Wikipedia contributors; revision links provide contributor histories. No third-party prose annotations are copied. Counters are the explicit teaching start, not a recovered historical game clock. The diagram cells independently reconstruct the shipped piece placement and side to move.

The two conventional Lucena/Philidor setups differ from the cited articles' diagrams. They retain the project's **GPL-3.0-or-later** score/note assertion as authored teaching variants, with separate method-reference links and an unknown publication date. The name Lucena does not establish a publication in 1497. The eight additional exercises identify their stable curriculum lesson/exercise IDs and an immutable source-code revision; their source and notes are original GPL-3.0-or-later material. The [shipped notices](../../../NOTICE) retain the separate rights and credits.

## What is checked

Run from `site/`:

```sh
node scripts/check-problems.mjs
```

The default audit is offline and read-only. It checks all twelve source bindings and **48 worked plies** against **50 saved Syzygy snapshots**: 28 shared curriculum records and 22 records for the fixed Réti/Saavedra diagrams and branches. `library/problems.js` binds evidence to the curated collection/document, exact full FEN, recorded UCI line, result and source/score rights. It checks ordinary WDL preservation along the branch; uncertain/cursed/blessed categories do not become ordinary wins. Full counters matter, and DTZ is not DTM. Mate-in-one entries additionally establish actual checkmate with chess.js, including a legal recorded mating move.

This checks the recorded branch, rather than a unique best move, all future replies or a learner's performance. Prose annotations stay unverified. Reflection questions and rubrics remain authored guidance. Imported PGNs retain the general library's legal-replay-only status, even if they copy a curated ID, board, line or extra evidence fields. Arbitrary legal alternatives receive no new certificate from this collection.

`library/problem-tablebases.js` stores numerical facts only, with query URLs, retrieval dates and SHA-256 digests of `JSON.stringify(result)`. No remote SAN or prose becomes teaching text. Explicit development refresh:

```sh
node scripts/check-problems.mjs --refresh
```

This requests only the 22 fixed Réti/Saavedra FENs, serially, validates responses and the entire collection before atomically replacing that file, and never reads account/browser games. The 28 shared records have their existing separate `check-endgames.mjs --refresh` command. Nothing refreshes in the browser or implicitly during tests; refresh tests use fake clients.
