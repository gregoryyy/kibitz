# Published classic-game scores

The shipped catalogue has **21 games and four studies**. This source audit covers the 21 games; study-source work is tracked separately in TODO 7.4. Scores identify the published versions used here, rather than asserting that every familiar historical account or first publication has been authenticated. Kibitz supplies all teaching prose; no third-party prose annotations, variations or judgement glyphs are copied.

Run from `site/`:

```sh
node scripts/check-classics.mjs
```

This is an offline, read-only audit. It checks 1,355 recorded plies against the actual packaged PGNs, source identities, fixed locators, rights assertions and historical/teaching distinctions. It also reconstructs all 980 book plies from their saved descriptive notation, requiring one complete legal branch. The audit establishes source/transcription consistency and move legality. Resignation results remain source reports; it does not prove optimal play or a forced win.

## Capablanca: twelve complete scores

[Chess Fundamentals](https://www.gutenberg.org/ebooks/33870), José Raúl Capablanca, originally published in 1921, provides fourteen illustrative games in Part II. Project Gutenberg identifies its source as public domain in the USA. The [1921 edition scan](https://commons.wikimedia.org/wiki/File:Chess_fundamentals_(IA_chessfundamental00capa).pdf) identifies the original edition; no later editorial prose is used.

`capablanca-scores.json` retains the source URL, catalogue/edition links, retrieval time, fetched HTML digest, game/page locators, descriptive move facts and reconstructed UCI lines. The browser's `library/capablanca.js` contains the normalized legal scores, per-game source details and original Kibitz teaching notes. Each source link opens its page anchor in the published transcription. The supplied score-rights label is **Public domain (USA; 1921 score)**; this records the source's jurisdiction-specific status rather than asserting a worldwide licence.

| Book game | White — Black | Page | Recorded plies |
| --- | --- | ---: | ---: |
| 1 | Marshall — Capablanca, 1909 | 159 | 49 |
| 2 | Rubinstein — Capablanca, 1911 | 163 | 83 |
| 4 | Capablanca — Znosko-Borovsky, 1913 | 174 | 80 |
| 5 | Lasker — Capablanca, 1914 | 181 | 83 |
| 7 | Capablanca — Burn, 1911 | 197 | 91 |
| 8 | Mieses — Capablanca, 1913 | 201 | 88 |
| 9 | Capablanca — Teichmann, 1913 | 209 | 75 |
| 10 | Capablanca — Marshall, 1914 | 215 | 121 |
| 11 | Capablanca — Janowski, 1914 | 221 | 61 |
| 12 | Capablanca — Chajes, 1918 | 225 | 89 |
| 13 | Morrison — Capablanca, 1918 | 231 | 82 |
| 14 | Marshall — Capablanca, 1918 | 238 | 78 |

Games 3 and 6 stop before the played game ended: the author reports later resignation without supplying the remaining moves. They are excluded instead of receiving invented endings. `classics-notation.mjs` handles the bounded descriptive forms used in these tables, including relative ranks, capture types/files, original-side rooks/knights/bishops, disambiguating squares, checks and castling. It searches legal candidates across a complete recorded score, rejects ambiguity and has a state budget. This is a source audit helper, not a general descriptive-notation importer.

## Nine earlier published versions

`historical-scores.json` records a fixed Wikipedia revision, retrieval time and HTML digest for each of the earlier games, plus normalized source move facts and the canonical UCI line. `library/classic-sources.js` exposes its attribution and links. The authors are **Wikipedia contributors**; revision pages provide access to contributor histories. These move records retain [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Changes: notation normalized; source prose, variations and judgement glyphs omitted. Source statements do not independently authenticate every historical attribution.

Two distinctions are shown on the cards, in source details and in the PGN's own notes:

- Réti–Tartakower ended after **10.Bg5+**, with Black resigning. [Edward Winter’s source research](https://www.chesshistory.com/winter/extra/retitartakower.html) identifies the 1910 newspaper publication; its reference is retained separately from the licensed teaching score. **10...Kc7 11.Bd8#** is the published teaching continuation, kept visible as such.
- Légal's familiar seven-move score is a **traditional teaching version**. Its historical date, move order and rook odds are disputed. The app uses the cited version's move order and an unknown date, with the full normal starting army identified as the teaching diagram.

The browser performs no source download. Source/licence fields are literal data and explicit links; they remain distinct from the project's **GPL-3.0-or-later** teaching notes. The [third-party notices](../../../THIRD_PARTY_NOTICES.md) travel with the build. Saved evidence is reviewed in the repository; the audit never refreshes it implicitly. HTML digests identify the fetched source snapshots, while the saved score facts make transcription checks reproducible offline without redistributing article bodies.

The earlier retrieval benchmarks keep their original thirteen-record snapshot in `eval/retrieval/classics-fixture.mjs`. New production games and historical-note corrections do not silently alter those measured corpora or their published hashes.
