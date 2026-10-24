# Position retrieval baseline

TODO 8.8. Suite 1; retriever `exact-epd+pawns-v1`.

Corpus: 21 documents, 481 indexed occurrences, 45 annotations. Queries: 24.

Corpus SHA-256: `60270e385e1cfce8ad4d8bfad84d097115ce949b01ddad21ad61c5dc08dadd07`.
Case SHA-256: `bb0e9647bc0dce940b63af8ff89b19bf947abe6bbbe3bfecdf2fdc7762ed3235`.

Reproduce from the repository root: `just retrieval-eval`. No provider, engine, network, credentials or saved user data is used.

Precision divides by k, including short lists. Recall, MRR and graded nDCG are macro means over answerable queries; no-answer queries have their own false-positive rate. Duplicate IDs consume ranks and earn credit once. Grade 2 is directly relevant; grade 1 is a useful analogy.

These are retrieval relevance judgements, not engine verification, citation entailment or teaching-quality scores. English/German pairs test the same positions; the current retriever ignores their text. This small authored development suite is not a held-out generalisation estimate.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 18 | 6 | 0.833 | 0.648 | 0.833 | 0.759 | 0.667 |
| All | 3 | 18 | 6 | 0.444 | 0.861 | 0.852 | 0.823 | 0.667 |
| All | 6 | 18 | 6 | 0.250 | 1.000 | 0.880 | 0.886 | 0.667 |
| exact | 1 | 8 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| exact | 3 | 8 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| exact | 6 | 8 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| transposition | 1 | 4 | 0 | 1.000 | 0.625 | 1.000 | 1.000 | — |
| transposition | 3 | 4 | 0 | 0.583 | 1.000 | 1.000 | 1.000 | — |
| transposition | 6 | 4 | 0 | 0.292 | 1.000 | 1.000 | 1.000 | — |
| occurrence | 1 | 3 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| occurrence | 3 | 3 | 0 | 0.111 | 0.167 | 0.111 | 0.102 | — |
| occurrence | 6 | 3 | 0 | 0.222 | 1.000 | 0.278 | 0.477 | — |
| structure | 1 | 3 | 0 | 1.000 | 0.389 | 1.000 | 0.556 | — |
| structure | 3 | 3 | 0 | 0.889 | 1.000 | 1.000 | 0.839 | — |
| structure | 6 | 3 | 0 | 0.444 | 1.000 | 1.000 | 0.839 | — |
| no-answer | 1 | 0 | 6 | — | — | — | — | 0.667 |
| no-answer | 3 | 0 | 6 | — | — | — | — | 0.667 |
| no-answer | 6 | 0 | 6 | — | — | — | — | 0.667 |
| en | 1 | 11 | 3 | 0.818 | 0.621 | 0.818 | 0.758 | 1.000 |
| en | 3 | 11 | 3 | 0.455 | 0.864 | 0.848 | 0.824 | 1.000 |
| en | 6 | 11 | 3 | 0.258 | 1.000 | 0.871 | 0.887 | 1.000 |
| de | 1 | 7 | 3 | 0.857 | 0.690 | 0.857 | 0.762 | 0.333 |
| de | 3 | 7 | 3 | 0.429 | 0.857 | 0.857 | 0.823 | 0.333 |
| de | 6 | 7 | 3 | 0.238 | 1.000 | 0.893 | 0.884 | 0.333 |

## opera-en

en; exact; relevance unit: occurrence.

Find this Opera Game position after 10. Nxb5.

FEN: `rn2kb1r/p3qppp/2p2n2/1N2p1B1/2B1P3/1Q6/PPP2PPP/R3K2R b KQkq - 0 10`.

Expected:

- Grade 2: `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/19` — The position after Morphy’s 10. Nxb5.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:ex-opera / ply 19 | same position |

## opera-de

de; exact; relevance unit: occurrence.

Finde diese Stellung der Opernpartie nach 10. Sxb5.

FEN: `rn2kb1r/p3qppp/2p2n2/1N2p1B1/2B1P3/1Q6/PPP2PPP/R3K2R b KQkq - 0 10`.

Expected:

- Grade 2: `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/19` — The position after Morphy’s 10. Nxb5.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:ex-opera / ply 19 | same position |

## opera-counters

en; exact; relevance unit: occurrence.

Find the same position, ignoring move counters.

FEN: `rn2kb1r/p3qppp/2p2n2/1N2p1B1/2B1P3/1Q6/PPP2PPP/R3K2R b KQkq - 17 42`.

Expected:

- Grade 2: `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/19` — The position after Morphy’s 10. Nxb5.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:ex-opera / ply 19 | same position |

## lucena-root

en; exact; relevance unit: occurrence.

Find the starting diagram of the Lucena study.

FEN: `1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1`.

Expected:

- Grade 2: `game:classic:st-lucena@f913c66dda81db9413b19ff4306c2dc6cfaebf8891f166dec1ba59c98a83eb14/ply/0` — Custom-start study root.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:st-lucena / ply 0 | same position |

## philidor-black

de; exact; relevance unit: occurrence.

Finde die Philidor-Ausgangsstellung mit Schwarz am Zug.

FEN: `4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1`.

Expected:

- Grade 2: `game:classic:st-philidor@f8d83d553b01fb01858a368fe57d834a0f2cf90178d454247baa48e9256ff882/ply/0` — Black-to-move study root.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:st-philidor / ply 0 | same position |

## saavedra-root

en; exact; relevance unit: occurrence.

Find the Saavedra starting diagram.

FEN: `8/8/1KP5/3r4/8/8/8/k7 w - - 0 1`.

Expected:

- Grade 2: `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/0` — The exact source diagram.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:st-saavedra / ply 0 | same position |

## castling-rights

en; exact; relevance unit: occurrence.

Find this position with all four castling rights.

FEN: `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10`.

Expected:

- Grade 2: `game:library:castling@d28665e0ca7f8e40ebf23cbfc5669c20b9a1df809b9d61b43c1c733f08510ff4/ply/0` — Board, side and castling rights agree.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:castling / ply 0 | same position |
| 2 | classic:st-saavedra / ply 12 | same pawn structure |

## en-passant-right

de; exact; relevance unit: occurrence.

Finde diese Stellung mit möglichem en passant auf d6.

FEN: `4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22`.

Expected:

- Grade 2: `game:library:en-passant@641e90f32d6bbff0483fc05b22dbb42f2cd5e6f6815f45098776e0c3dbfc6793/ply/0` — The legal en-passant right is part of position identity.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:en-passant / ply 0 | same position |

## qgd-en

en; transposition; relevance unit: occurrence.

Find both games that reach this QGD position.

FEN: `rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5`.

Expected:

- Grade 2: `game:library:qgd-a@db8e8e56f128a22f89e848d5ced04b1b0dae856dc0381f0896e14606113eadf0/ply/8` — The first move order reaches this exact board.
- Grade 2: `game:library:qgd-b@b2bd38777818097ac77e98d4f8834f905a220e5998a8778b4a427cfd3ca6fcd3/ply/8` — The second move order transposes to it.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:qgd-a / ply 8 | same position |
| 2 | library:qgd-b / ply 8 | same position |

## qgd-de

de; transposition; relevance unit: occurrence.

Finde beide Zugfolgen, die diese Stellung erreichen.

FEN: `rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5`.

Expected:

- Grade 2: `game:library:qgd-a@db8e8e56f128a22f89e848d5ced04b1b0dae856dc0381f0896e14606113eadf0/ply/8` — The first move order reaches this exact board.
- Grade 2: `game:library:qgd-b@b2bd38777818097ac77e98d4f8834f905a220e5998a8778b4a427cfd3ca6fcd3/ply/8` — The second move order transposes to it.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:qgd-a / ply 8 | same position |
| 2 | library:qgd-b / ply 8 | same position |

## qgd-counters

en; transposition; relevance unit: occurrence.

Find this transposition with different move counters.

FEN: `rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 9 23`.

Expected:

- Grade 2: `game:library:qgd-a@db8e8e56f128a22f89e848d5ced04b1b0dae856dc0381f0896e14606113eadf0/ply/8` — The first move order reaches this exact board.
- Grade 2: `game:library:qgd-b@b2bd38777818097ac77e98d4f8834f905a220e5998a8778b4a427cfd3ca6fcd3/ply/8` — The second move order transposes to it.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:qgd-a / ply 8 | same position |
| 2 | library:qgd-b / ply 8 | same position |

## qgd-exclude-current

de; transposition; relevance unit: occurrence.

Zeige die andere Partie, nicht die gerade geöffnete.

FEN: `rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5`.

Expected:

- Grade 2: `game:library:qgd-b@b2bd38777818097ac77e98d4f8834f905a220e5998a8778b4a427cfd3ca6fcd3/ply/8` — The second move order transposes to it.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | library:qgd-b / ply 8 | same position |

## repeat-both

en; occurrence; relevance unit: occurrence.

Find both arrivals at this board in the repetition game.

FEN: `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3`.

Expected:

- Grade 2: `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/1` — First occurrence of the board.
- Grade 2: `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5` — Second occurrence of the same board.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-century / ply 1 | same position |
| 2 | library:qgd-b / ply 1 | same position |
| 3 | library:repeat / ply 1 | same position |
| 4 | library:repeat / ply 5 | same position |

## repeat-second-en

en; occurrence; relevance unit: occurrence.

Find the note at the second arrival, after 3. Nf3, not 1. Nf3.

FEN: `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3`.

Expected:

- Grade 2: `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5` — Second occurrence of the same board.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-century / ply 1 | same position |
| 2 | library:qgd-b / ply 1 | same position |
| 3 | library:repeat / ply 1 | same position |
| 4 | library:repeat / ply 5 | same position |

## repeat-second-de

de; occurrence; relevance unit: occurrence.

Finde die Notiz nach 3. Sf3, beim zweiten Auftreten.

FEN: `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3`.

Expected:

- Grade 2: `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5` — Second occurrence of the same board.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-century / ply 1 | same position |
| 2 | library:qgd-b / ply 1 | same position |
| 3 | library:repeat / ply 1 | same position |
| 4 | library:repeat / ply 5 | same position |

## iqp-plan-en

en; structure; relevance unit: document.

Find IQP middlegame examples for White with a rook on e1 and no immediate check.

FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25`.

Expected:

- Grade 2: `game:library:iqp-e1` — Same IQP, rook on e1, no immediate check.
- Grade 1: `game:library:iqp-f1` — Useful IQP analogy, but the rook is still on f1.
- Grade 1: `game:classic:cl-steinitz-bardeleben` — A real IQP example; White later places the rook on e1, with a different piece configuration.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-steinitz-bardeleben / ply 16 | same pawn structure |
| 2 | library:iqp-f1 / ply 12 | same pawn structure |
| 3 | library:iqp-e1 / ply 12 | same pawn structure |
| 4 | library:iqp-check / ply 12 | same pawn structure |

## iqp-plan-de

de; structure; relevance unit: document.

Finde Isolani-Beispiele für Weiß mit Turm auf e1 ohne unmittelbares Schach.

FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25`.

Expected:

- Grade 2: `game:library:iqp-e1` — Same IQP, rook on e1, no immediate check.
- Grade 1: `game:library:iqp-f1` — Useful IQP analogy, but the rook is still on f1.
- Grade 1: `game:classic:cl-steinitz-bardeleben` — A real IQP example; White later places the rook on e1, with a different piece configuration.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-steinitz-bardeleben / ply 16 | same pawn structure |
| 2 | library:iqp-f1 / ply 12 | same pawn structure |
| 3 | library:iqp-e1 / ply 12 | same pawn structure |
| 4 | library:iqp-check / ply 12 | same pawn structure |

## iqp-exclude-current

en; structure; relevance unit: document.

Find another quiet IQP example outside my current game.

FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25`.

Expected:

- Grade 1: `game:library:iqp-f1` — Useful IQP analogy, but the rook is still on f1.
- Grade 1: `game:classic:cl-steinitz-bardeleben` — A real IQP example; White later places the rook on e1, with a different piece configuration.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-steinitz-bardeleben / ply 16 | same pawn structure |
| 2 | library:iqp-f1 / ply 12 | same pawn structure |
| 3 | library:iqp-check / ply 12 | same pawn structure |

## missing-exact-iqp

en; no-answer; relevance unit: occurrence.

Find an identical position, not a pawn-structure analogy.

FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-steinitz-bardeleben / ply 16 | same pawn structure |
| 2 | library:iqp-f1 / ply 12 | same pawn structure |
| 3 | library:iqp-e1 / ply 12 | same pawn structure |
| 4 | library:iqp-check / ply 12 | same pawn structure |

## missing-exact-iqp-de

de; no-answer; relevance unit: occurrence.

Finde exakt diese Stellung, kein Beispiel mit nur gleicher Bauernstruktur.

FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2QR2K w - - 0 25`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:cl-steinitz-bardeleben / ply 16 | same pawn structure |
| 2 | library:iqp-f1 / ply 12 | same pawn structure |
| 3 | library:iqp-e1 / ply 12 | same pawn structure |
| 4 | library:iqp-check / ply 12 | same pawn structure |

## missing-castling-rights

en; no-answer; relevance unit: occurrence.

Find this exact diagram with castling rights removed.

FEN: `r3k2r/8/8/8/8/8/8/R3K2R w - - 0 10`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:st-saavedra / ply 12 | same pawn structure |

## missing-en-passant

de; no-answer; relevance unit: occurrence.

Finde dieselbe Stellung ohne en-passant-Recht.

FEN: `4k3/8/8/3pP3/8/8/8/4K3 w - - 0 22`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| — | Empty | — |

## missing-side

en; no-answer; relevance unit: occurrence.

Find this exact rook position with Black to move.

FEN: `r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 10`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| 1 | classic:st-saavedra / ply 12 | same pawn structure |

## excluded-only-match

de; no-answer; relevance unit: occurrence.

Finde diese Studie außerhalb der gerade geöffneten Saavedra-Studie.

FEN: `8/8/1KP5/3r4/8/8/8/k7 w - - 0 1`.

Expected:

No relevant result in this corpus.

| Rank | Source occurrence | Match |
| ---: | --- | --- |
| — | Empty | — |
