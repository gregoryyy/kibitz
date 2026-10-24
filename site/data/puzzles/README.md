# Lichess puzzle starter data

`lichess-starter.csv` contains the first 64 unchanged data rows from the public [Lichess puzzle export](https://database.lichess.org/#puzzles), retrieved on 2026-10-24. Lichess releases the database under CC0-1.0. This small prefix demonstrates the source pipeline; it is not a representative sample or a measured curriculum. The project’s teaching notes remain GPL-3.0-or-later.

`lichess-starter.json` records the export URL, retrieval time, ETag, Last-Modified value, selection, row count and SHA-256 of the exact saved CSV. Only 32,384 compressed bytes were read to obtain the prefix; the complete export is not bundled. The remote URL changes over time. Offline regeneration uses the checked-in CSV, not a claim that the current remote export is identical.

From `site/`:

```sh
node scripts/import-puzzles.mjs          # regenerate src/curriculum/puzzle-data.js offline
node scripts/import-puzzles.mjs --check  # verify digests, chess rules and exact generated output
```

A replacement subset can use `--input path.csv --manifest path.json --output src/curriculum/puzzle-data.js`. Supply the same manifest schema with its own retrieval/selection facts and CSV digest. Inputs are limited to 1 MB and 1,000 puzzles. No download runs implicitly. Changes to the starter collection should update documented/tested counts and receive content review.

The importer accepts the current eleven-column CSV and the earlier ten-column format without `DailyDate`. It checks quoting, columns, IDs, numeric ranges, bounded themes/opening tags, safe Lichess game URLs, legal starting diagrams and complete UCI replay. Duplicate IDs, invalid data, stale castling rights and moves after game end fail closed. IDs keep source case; curriculum IDs encode that case without collisions.

The source FEN is **before** the opponent’s first recorded move. The importer applies that move, preserves the source FEN/setup SAN, then exposes the learner’s full FEN and remaining solution. En passant, castling, promotions and move counters follow chess.js. Mate themes require a terminal checkmate for the learner; legal replay does not independently establish other source strength or theme claims, or reject alternative solutions.

The catalogue groups ratings at ≤1200, ≤1800, ≤2300 and above for navigation. These are editorial bands, not playing Elo or empirically calibrated teaching levels. Original source themes remain visible; a conservative mapping adds known Kibitz filters without claiming motif detection. The current four groups contain 20, 27, 13 and 4 puzzles. The lesson player (6.6) provides worked examples, authored hints and recorded-line recall with automatic recorded opponent replies. Any actual mating move is accepted; other legal choices outside the source line receive no independent strength verdict.
