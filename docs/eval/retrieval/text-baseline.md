# Lexical passage retrieval baseline

TODO 8.3.1. Suite 1; retriever `local-bm25-v1`.

159 passages: 45 original PGN comments and 114 authored guide sections. 28 manually labelled queries.

Corpus SHA-256: `fdc2addafd0b1275ff93f821c54737847af4706cb194686ee12cd96ffac734f0`.
Case SHA-256: `10d0afe264f20aa26ca22112224bb87562cc1300f0852feac1cb9977fbebf1c5`.

Reproduce: `just retrieval-eval --mode text`. No provider, engine search, saved user data or network is used.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 20 | 8 | 0.900 | 0.808 | 0.900 | 0.900 | 0.250 |
| All | 3 | 20 | 8 | 0.400 | 0.950 | 0.917 | 0.925 | 0.250 |
| All | 6 | 20 | 8 | 0.200 | 0.950 | 0.917 | 0.925 | 0.250 |
| annotation | 1 | 9 | 0 | 1.000 | 0.944 | 1.000 | 1.000 | — |
| annotation | 3 | 9 | 0 | 0.370 | 1.000 | 1.000 | 1.000 | — |
| annotation | 6 | 9 | 0 | 0.185 | 1.000 | 1.000 | 1.000 | — |
| guide | 1 | 9 | 0 | 1.000 | 0.852 | 1.000 | 1.000 | — |
| guide | 3 | 9 | 0 | 0.481 | 1.000 | 1.000 | 1.000 | — |
| guide | 6 | 9 | 0 | 0.241 | 1.000 | 1.000 | 1.000 | — |
| paraphrase | 1 | 2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| paraphrase | 3 | 2 | 0 | 0.167 | 0.500 | 0.167 | 0.250 | — |
| paraphrase | 6 | 2 | 0 | 0.083 | 0.500 | 0.167 | 0.250 | — |
| no-answer | 1 | 0 | 8 | — | — | — | — | 0.250 |
| no-answer | 3 | 0 | 8 | — | — | — | — | 0.250 |
| no-answer | 6 | 0 | 8 | — | — | — | — | 0.250 |
| en | 1 | 14 | 6 | 0.929 | 0.845 | 0.929 | 0.929 | 0.333 |
| en | 3 | 14 | 6 | 0.405 | 1.000 | 0.952 | 0.964 | 0.333 |
| en | 6 | 14 | 6 | 0.202 | 1.000 | 0.952 | 0.964 | 0.333 |
| de | 1 | 6 | 2 | 0.833 | 0.722 | 0.833 | 0.833 | 0.000 |
| de | 3 | 6 | 2 | 0.389 | 0.833 | 0.833 | 0.833 | 0.000 |
| de | 6 | 6 | 2 | 0.194 | 0.833 | 0.833 | 0.833 | 0.000 |

## mate-san-en

en; annotation. Keywords: Qxf7.

Expected:

- `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/11/comment/1/text/0-51` — The Opera note explicitly names Qxf7.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:ex-opera / ply 11 |

## mate-san-de

de; annotation. Keywords: Dxf7.

Expected:

- `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/11/comment/1/text/0-51` — German queen notation should find the English SAN in an imported note.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:ex-opera / ply 11 |

## lucena-bridge

en; annotation. Keywords: bridge fourth rank.

Expected:

- `game:classic:st-lucena@f913c66dda81db9413b19ff4306c2dc6cfaebf8891f166dec1ba59c98a83eb14/ply/3/comment/1/text/0-62` — The Lucena note describes blocking checks on the fourth rank.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-lucena / ply 3 |
| 2 | classic:st-philidor / ply 1 |

## philidor-sixth

en; annotation. Keywords: sixth rank.

Expected:

- `game:classic:st-philidor@f8d83d553b01fb01858a368fe57d834a0f2cf90178d454247baa48e9256ff882/ply/1/comment/0/text/0-67` — The Philidor defence note names the sixth rank.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-philidor / ply 1 |
| 2 | classic:st-lucena / ply 3 |

## saavedra-stalemate

en; annotation. Keywords: Saavedra stalemate.

Expected:

- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/10/comment/0/text/0-50` — Both notes discuss the stalemate idea, at different plies.
- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/11/comment/1/text/0-53` — Both notes discuss the stalemate idea, at different plies.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-saavedra / ply 11 |
| 2 | classic:st-saavedra / ply 10 |

## second-note

en; annotation. Keywords: second arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5/comment/1/text/0-48` — The second note is a separate passage despite equal board EPDs.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 5 |
| 2 | library:repeat / ply 1 |

## first-note

en; annotation. Keywords: first arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/1/comment/0/text/0-34` — The first arrival must retain its own passage.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 1 |
| 2 | library:repeat / ply 5 |

## en-passant-note

en; annotation. Keywords: en passant d6.

Expected:

- `game:library:en-passant@641e90f32d6bbff0483fc05b22dbb42f2cd5e6f6815f45098776e0c3dbfc6793/ply/0/comment/0/text/0-35` — An initial-position comment can be retrieved.

| Rank | Passage location |
| ---: | --- |
| 1 | library:en-passant / ply 0 |

## castling-note

en; annotation. Keywords: castling rights.

Expected:

- `game:library:castling@d28665e0ca7f8e40ebf23cbfc5669c20b9a1df809b9d61b43c1c733f08510ff4/ply/0/comment/0/text/0-39` — The source comment names castling rights.

| Rank | Passage location |
| ---: | --- |
| 1 | library:castling / ply 0 |

## iqp-en

en; guide. Keywords: blockade attacking pieces.

Expected:

- `guide:iqp:en@4ad5c25c4e467fea3fb4a3ed99317e9bcab6b0cedf2a9418791e7ba0ca875fbd/plans/text/0-133` — The authored IQP plan describes blockade and reducing attacking pieces.

| Rank | Passage location |
| ---: | --- |
| 1 | iqp / en / plans |
| 2 | kid / en / idea |
| 3 | ruy-lopez / en / plans |
| 4 | french / en / plans |
| 5 | maroczy / en / plans |
| 6 | open-games / en / plans |

## iqp-de

de; guide. Keywords: Isolani blockieren.

Expected:

- `guide:iqp:de@aa145f1481c215bc882159a9aeedff72e536c7b9582338669f76ce3635422339/plans/text/0-165` — The German IQP plan contains both concepts.

| Rank | Passage location |
| ---: | --- |
| 1 | iqp / de / plans |

## carlsbad-en

en; guide. Keywords: minority attack queenside.

Expected:

- `guide:carlsbad:en@34a2655e2cecf04cb400e9c20c6f2ab8395b216572aeb0c2c948aa81d6791e30/plans/text/0-153` — The Carlsbad plan explicitly describes a minority attack.

| Rank | Passage location |
| ---: | --- |
| 1 | carlsbad / en / plans |
| 2 | slav / en / structure |
| 3 | carlsbad / en / structure |
| 4 | sicilian / en / plans |
| 5 | kid-chain / en / plans |

## carlsbad-de

de; guide. Keywords: Minoritätsangriff Damenflügel.

Expected:

- `guide:carlsbad:de@d432f103e0d2b9360675c84bb1f63f7f84eef117f2c670024b7f66689174824a/plans/text/0-187` — The same authored plan is searchable in German.

| Rank | Passage location |
| ---: | --- |
| 1 | carlsbad / de / plans |
| 2 | slav / de / structure |

## sicilian-exchange

en; guide. Keywords: c-pawn d-pawn Sicilian.

Expected:

- `guide:sicilian:en@cc465ec9471023229a4f8525d6a19569fe158686aa9e0fd93029556630980fd5/structure/text/0-130` — This section states which central pawns an open Sicilian trades.

| Rank | Passage location |
| ---: | --- |
| 1 | sicilian / en / structure |
| 2 | caro-kann / en / idea |
| 3 | hanging-pawns / en / structure |
| 4 | hanging-pawns / en / idea |
| 5 | slav / en / idea |
| 6 | iqp / en / idea |

## french-base

de; guide. Keywords: Kettenbasis Bauernhebel.

Expected:

- `guide:french-chain:de@595754de3837a498dabe69c550377fa93ab791fe644871c21c26cb26b9b1935b/plans/text/0-193` — The locked French plan names the chain base and pawn break.

| Rank | Passage location |
| ---: | --- |
| 1 | french-chain / de / plans |

## hanging-support

en; guide. Keywords: neighbouring b e pawn support.

Expected:

- `guide:hanging-pawns:en@4519269ead3ce31c9eefaf11990800ff4c94db6dbd2075706642980351675a80/idea/text/0-78` — The definition identifies the missing neighbouring support pawns.

| Rank | Passage location |
| ---: | --- |
| 1 | hanging-pawns / en / idea |
| 2 | slav / en / idea |
| 3 | french / en / idea |
| 4 | slav / en / plans |
| 5 | kid / en / structure |
| 6 | d-pawn / en / structure |

## maroczy-en

en; guide. Keywords: Maroczy.

Expected:

- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/idea/text/0-82` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/plans/text/0-129` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/structure/text/0-85` — An accent-insensitive title lookup retrieves all three guide sections.

| Rank | Passage location |
| ---: | --- |
| 1 | maroczy / en / structure |
| 2 | maroczy / en / idea |
| 3 | maroczy / en / plans |

## maroczy-de

de; guide. Keywords: Maroczy.

Expected:

- `guide:maroczy:de@330f6f0b4b97a8f583b01742486ad993ee8849ccc7acd7af6a3ecdc6037aa041/idea/text/0-105` — The German guide title also has the accent.
- `guide:maroczy:de@330f6f0b4b97a8f583b01742486ad993ee8849ccc7acd7af6a3ecdc6037aa041/plans/text/0-156` — The German guide title also has the accent.
- `guide:maroczy:de@330f6f0b4b97a8f583b01742486ad993ee8849ccc7acd7af6a3ecdc6037aa041/structure/text/0-89` — The German guide title also has the accent.

| Rank | Passage location |
| ---: | --- |
| 1 | maroczy / de / structure |
| 2 | maroczy / de / idea |
| 3 | maroczy / de / plans |

## bridge-paraphrase

en; paraphrase. Keywords: How can I shelter the king from rook checks in a winning rook ending?.

Expected:

- `game:classic:st-lucena@f913c66dda81db9413b19ff4306c2dc6cfaebf8891f166dec1ba59c98a83eb14/ply/3/comment/1/text/0-62` — Building the Lucena bridge shelters the king from checks; the question avoids the source wording.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-philidor / ply 1 |
| 2 | classic:st-philidor / ply 3 |
| 3 | classic:st-lucena / ply 3 |
| 4 | library:en-passant / ply 0 |
| 5 | classic:cl-century / ply 34 |
| 6 | classic:cl-rotlewi-rubinstein / ply 40 |

## iqp-paraphrase

de; paraphrase. Keywords: Wie stoppt man einen freistehenden Zentralbauern durch Figuren?.

Expected:

- `guide:iqp:de@aa145f1481c215bc882159a9aeedff72e536c7b9582338669f76ce3635422339/plans/text/0-165` — The isolated-pawn plan explains blockading with pieces using different wording.

| Rank | Passage location |
| ---: | --- |
| 1 | nimzo / de / idea |
| 2 | iqp / de / idea |
| 3 | ruy-lopez / de / plans |
| 4 | d-pawn / de / plans |
| 5 | maroczy / de / plans |
| 6 | ruy-lopez / de / structure |

## no-quantum-en

en; no-answer. Keywords: quantum tunnelling.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## no-quantum-de

de; no-answer. Keywords: Quantenverschränkung.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## wrong-language

en; no-answer. Keywords: Isolani.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## wrong-collection

en; no-answer. Keywords: Qxf7.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## wrong-kind

en; no-answer. Keywords: Lucena.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## stopwords-only

de; no-answer. Keywords: the und für.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## unsupported-quantum-knight

en; no-answer. Keywords: quantum knight teleportation.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 1 |
| 2 | classic:ex-opera / ply 31 |
| 3 | classic:ex-opera / ply 23 |
| 4 | classic:cl-legal / ply 9 |
| 5 | classic:ex-immortal / ply 43 |
| 6 | classic:cl-evergreen / ply 37 |

## unsupported-proof

en; no-answer. Keywords: Syzygy proof rook draw.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-reti / ply 7 |
| 2 | classic:ex-opera / ply 23 |
| 3 | classic:cl-steinitz-bardeleben / ply 43 |
| 4 | classic:st-lucena / ply 3 |
| 5 | classic:st-saavedra / ply 13 |
| 6 | classic:st-saavedra / ply 11 |
