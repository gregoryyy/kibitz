# Hybrid passage retrieval comparison

TODO 8.4. Authored development evaluation; no held-out quality or calibrated abstention claim.

Provider: ollama; configured/reported model: bge-m3:latest / bge-m3:latest; dimensions: 1024; supplied revision: 7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab.

Four eligible candidate channels use reciprocal ranks with constant 60 and twenty candidates per channel. Full term matches and exact board matches then rerank the fused candidates. Raw cosine/BM25 scores are not added. No chess advice or semantic support is verified.

The optional all-terms filter is literal title/body coverage. It can reject paraphrases and is not a calibrated semantic abstention rule. Shared lexical gold still has the documented Isolani/language ambiguity; labels were not changed to favour a method.

| Suite | Method | P@1 | Recall@3 | MRR@3 | No-answer false positives |
| --- | --- | ---: | ---: | ---: | ---: |
| 28 text queries | BM25 | 0.900 | 0.950 | 0.917 | 0.250 |
| 28 text queries | Dense | 0.950 | 1.000 | 0.975 | 1.000 |
| 28 text queries | Hybrid | 0.900 | 0.950 | 0.925 | 0.875 |
| 28 text queries | Hybrid, every term | 0.850 | 0.850 | 0.850 | 0.000 |
| 10 board/intent queries | BM25, same term constraints | 1.000 | 1.000 | 1.000 | 0.000 |
| 10 board/intent queries | Hybrid | 1.000 | 1.000 | 1.000 | 0.000 |

The ten board/intent cases use separate labels and an explicit FEN; do not compare their aggregates as if they were the same queries as the text suite. Source filters, exact occurrences and dynamic compatibility are also checked independently in unit/browser tests.

## Broad hybrid: unchanged text cases

# Hybrid passage retrieval

TODO 8.4. Suite 1; retriever `hybrid-rrf-rerank-v1`.

159 passages: 45 original PGN comments and 114 authored guide sections. 28 manually labelled queries.

Corpus SHA-256: `fdc2addafd0b1275ff93f821c54737847af4706cb194686ee12cd96ffac734f0`.
Case SHA-256: `10d0afe264f20aa26ca22112224bb87562cc1300f0852feac1cb9977fbebf1c5`.

The parent hybrid report records the explicitly configured embedding run used for these details.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 20 | 8 | 0.900 | 0.808 | 0.900 | 0.900 | 0.875 |
| All | 3 | 20 | 8 | 0.400 | 0.950 | 0.925 | 0.932 | 0.875 |
| All | 6 | 20 | 8 | 0.208 | 1.000 | 0.938 | 0.953 | 0.875 |
| annotation | 1 | 9 | 0 | 1.000 | 0.944 | 1.000 | 1.000 | — |
| annotation | 3 | 9 | 0 | 0.370 | 1.000 | 1.000 | 1.000 | — |
| annotation | 6 | 9 | 0 | 0.185 | 1.000 | 1.000 | 1.000 | — |
| guide | 1 | 9 | 0 | 1.000 | 0.852 | 1.000 | 1.000 | — |
| guide | 3 | 9 | 0 | 0.481 | 1.000 | 1.000 | 1.000 | — |
| guide | 6 | 9 | 0 | 0.241 | 1.000 | 1.000 | 1.000 | — |
| paraphrase | 1 | 2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| paraphrase | 3 | 2 | 0 | 0.167 | 0.500 | 0.250 | 0.315 | — |
| paraphrase | 6 | 2 | 0 | 0.167 | 1.000 | 0.375 | 0.531 | — |
| no-answer | 1 | 0 | 8 | — | — | — | — | 0.875 |
| no-answer | 3 | 0 | 8 | — | — | — | — | 0.875 |
| no-answer | 6 | 0 | 8 | — | — | — | — | 0.875 |
| en | 1 | 14 | 6 | 0.929 | 0.845 | 0.929 | 0.929 | 1.000 |
| en | 3 | 14 | 6 | 0.405 | 1.000 | 0.964 | 0.974 | 1.000 |
| en | 6 | 14 | 6 | 0.202 | 1.000 | 0.964 | 0.974 | 1.000 |
| de | 1 | 6 | 2 | 0.833 | 0.722 | 0.833 | 0.833 | 0.500 |
| de | 3 | 6 | 2 | 0.389 | 0.833 | 0.833 | 0.833 | 0.500 |
| de | 6 | 6 | 2 | 0.222 | 1.000 | 0.875 | 0.905 | 0.500 |

## mate-san-en

en; annotation. Keywords: Qxf7.

Expected:

- `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/11/comment/1/text/0-51` — The Opera note explicitly names Qxf7.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:ex-opera / ply 11 |
| 2 | classic:st-saavedra / ply 10 |
| 3 | classic:ex-opera / ply 13 |
| 4 | classic:ex-opera / ply 31 |
| 5 | library:iqp-f1 / ply 12 |
| 6 | classic:ex-opera / ply 23 |

## mate-san-de

de; annotation. Keywords: Dxf7.

Expected:

- `game:classic:ex-opera@43dafffaf4b0889d414501892d09c35efdb13f4f5df6a463521f5a20def5335e/ply/11/comment/1/text/0-51` — German queen notation should find the English SAN in an imported note.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:ex-opera / ply 11 |
| 2 | classic:ex-opera / ply 13 |
| 3 | classic:st-saavedra / ply 10 |
| 4 | library:en-passant / ply 0 |
| 5 | classic:ex-opera / ply 31 |
| 6 | classic:ex-opera / ply 23 |

## lucena-bridge

en; annotation. Keywords: bridge fourth rank.

Expected:

- `game:classic:st-lucena@f913c66dda81db9413b19ff4306c2dc6cfaebf8891f166dec1ba59c98a83eb14/ply/3/comment/1/text/0-62` — The Lucena note describes blocking checks on the fourth rank.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-lucena / ply 3 |
| 2 | classic:st-philidor / ply 1 |
| 3 | library:repeat / ply 1 |
| 4 | library:repeat / ply 5 |
| 5 | classic:st-saavedra / ply 10 |
| 6 | classic:st-lucena / ply 1 |

## philidor-sixth

en; annotation. Keywords: sixth rank.

Expected:

- `game:classic:st-philidor@f8d83d553b01fb01858a368fe57d834a0f2cf90178d454247baa48e9256ff882/ply/1/comment/0/text/0-67` — The Philidor defence note names the sixth rank.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-philidor / ply 1 |
| 2 | classic:st-lucena / ply 3 |
| 3 | library:repeat / ply 1 |
| 4 | library:en-passant / ply 0 |
| 5 | library:repeat / ply 5 |
| 6 | classic:cl-evergreen / ply 43 |

## saavedra-stalemate

en; annotation. Keywords: Saavedra stalemate.

Expected:

- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/10/comment/0/text/0-50` — Both notes discuss the stalemate idea, at different plies.
- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/11/comment/1/text/0-53` — Both notes discuss the stalemate idea, at different plies.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-saavedra / ply 10 |
| 2 | classic:st-saavedra / ply 11 |
| 3 | classic:st-philidor / ply 1 |
| 4 | classic:cl-steinitz-bardeleben / ply 11 |
| 5 | classic:cl-reti-tartakower / ply 15 |
| 6 | library:castling / ply 0 |

## second-note

en; annotation. Keywords: second arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5/comment/1/text/0-48` — The second note is a separate passage despite equal board EPDs.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 5 |
| 2 | library:repeat / ply 1 |
| 3 | library:qgd-a / ply 8 |
| 4 | library:en-passant / ply 0 |
| 5 | library:qgd-b / ply 8 |
| 6 | library:castling / ply 0 |

## first-note

en; annotation. Keywords: first arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/1/comment/0/text/0-34` — The first arrival must retain its own passage.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 1 |
| 2 | library:repeat / ply 5 |
| 3 | library:en-passant / ply 0 |
| 4 | library:qgd-a / ply 8 |
| 5 | library:qgd-b / ply 8 |
| 6 | library:iqp-f1 / ply 12 |

## en-passant-note

en; annotation. Keywords: en passant d6.

Expected:

- `game:library:en-passant@641e90f32d6bbff0483fc05b22dbb42f2cd5e6f6815f45098776e0c3dbfc6793/ply/0/comment/0/text/0-35` — An initial-position comment can be retrieved.

| Rank | Passage location |
| ---: | --- |
| 1 | library:en-passant / ply 0 |
| 2 | library:repeat / ply 5 |
| 3 | library:repeat / ply 1 |
| 4 | library:qgd-b / ply 8 |
| 5 | library:iqp-e1 / ply 12 |
| 6 | library:iqp-f1 / ply 12 |

## castling-note

en; annotation. Keywords: castling rights.

Expected:

- `game:library:castling@d28665e0ca7f8e40ebf23cbfc5669c20b9a1df809b9d61b43c1c733f08510ff4/ply/0/comment/0/text/0-39` — The source comment names castling rights.

| Rank | Passage location |
| ---: | --- |
| 1 | library:castling / ply 0 |
| 2 | library:repeat / ply 1 |
| 3 | library:en-passant / ply 0 |
| 4 | library:qgd-b / ply 8 |
| 5 | library:iqp-check / ply 12 |
| 6 | library:repeat / ply 5 |

## iqp-en

en; guide. Keywords: blockade attacking pieces.

Expected:

- `guide:iqp:en@4ad5c25c4e467fea3fb4a3ed99317e9bcab6b0cedf2a9418791e7ba0ca875fbd/plans/text/0-133` — The authored IQP plan describes blockade and reducing attacking pieces.

| Rank | Passage location |
| ---: | --- |
| 1 | iqp / en / plans |
| 2 | kid / en / idea |
| 3 | carlsbad / en / plans |
| 4 | open-games / en / plans |
| 5 | maroczy / en / plans |
| 6 | french / en / plans |

## iqp-de

de; guide. Keywords: Isolani blockieren.

Expected:

- `guide:iqp:de@aa145f1481c215bc882159a9aeedff72e536c7b9582338669f76ce3635422339/plans/text/0-165` — The German IQP plan contains both concepts.

| Rank | Passage location |
| ---: | --- |
| 1 | iqp / de / plans |
| 2 | caro-kann / de / structure |
| 3 | maroczy / de / structure |
| 4 | stonewall / de / plans |
| 5 | iqp / de / structure |
| 6 | iqp / de / idea |

## carlsbad-en

en; guide. Keywords: minority attack queenside.

Expected:

- `guide:carlsbad:en@34a2655e2cecf04cb400e9c20c6f2ab8395b216572aeb0c2c948aa81d6791e30/plans/text/0-153` — The Carlsbad plan explicitly describes a minority attack.

| Rank | Passage location |
| ---: | --- |
| 1 | carlsbad / en / plans |
| 2 | carlsbad / en / structure |
| 3 | kid-chain / en / plans |
| 4 | sicilian / en / plans |
| 5 | slav / en / structure |
| 6 | queens-gambit / en / idea |

## carlsbad-de

de; guide. Keywords: Minoritätsangriff Damenflügel.

Expected:

- `guide:carlsbad:de@d432f103e0d2b9360675c84bb1f63f7f84eef117f2c670024b7f66689174824a/plans/text/0-187` — The same authored plan is searchable in German.

| Rank | Passage location |
| ---: | --- |
| 1 | carlsbad / de / plans |
| 2 | slav / de / structure |
| 3 | kid-chain / de / plans |
| 4 | queens-gambit / de / idea |
| 5 | sicilian / de / idea |
| 6 | queens-gambit / de / plans |

## sicilian-exchange

en; guide. Keywords: c-pawn d-pawn Sicilian.

Expected:

- `guide:sicilian:en@cc465ec9471023229a4f8525d6a19569fe158686aa9e0fd93029556630980fd5/structure/text/0-130` — This section states which central pawns an open Sicilian trades.

| Rank | Passage location |
| ---: | --- |
| 1 | sicilian / en / structure |
| 2 | caro-kann / en / idea |
| 3 | hanging-pawns / en / idea |
| 4 | slav / en / idea |
| 5 | hanging-pawns / en / structure |
| 6 | iqp / en / idea |

## french-base

de; guide. Keywords: Kettenbasis Bauernhebel.

Expected:

- `guide:french-chain:de@595754de3837a498dabe69c550377fa93ab791fe644871c21c26cb26b9b1935b/plans/text/0-193` — The locked French plan names the chain base and pawn break.

| Rank | Passage location |
| ---: | --- |
| 1 | french-chain / de / plans |
| 2 | d-pawn / de / idea |
| 3 | carlsbad / de / plans |
| 4 | carlsbad / de / idea |
| 5 | queens-gambit / de / plans |
| 6 | carlsbad / de / structure |

## hanging-support

en; guide. Keywords: neighbouring b e pawn support.

Expected:

- `guide:hanging-pawns:en@4519269ead3ce31c9eefaf11990800ff4c94db6dbd2075706642980351675a80/idea/text/0-78` — The definition identifies the missing neighbouring support pawns.

| Rank | Passage location |
| ---: | --- |
| 1 | hanging-pawns / en / idea |
| 2 | french / en / idea |
| 3 | slav / en / idea |
| 4 | french / en / structure |
| 5 | d-pawn / en / idea |
| 6 | d-pawn / en / structure |

## maroczy-en

en; guide. Keywords: Maroczy.

Expected:

- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/idea/text/0-82` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/plans/text/0-129` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/structure/text/0-85` — An accent-insensitive title lookup retrieves all three guide sections.

| Rank | Passage location |
| ---: | --- |
| 1 | maroczy / en / plans |
| 2 | maroczy / en / structure |
| 3 | maroczy / en / idea |
| 4 | french / en / plans |
| 5 | french-chain / en / idea |
| 6 | sicilian / en / idea |

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
| 4 | caro-kann / de / idea |
| 5 | slav / de / idea |
| 6 | french / de / idea |

## bridge-paraphrase

en; paraphrase. Keywords: How can I shelter the king from rook checks in a winning rook ending?.

Expected:

- `game:classic:st-lucena@f913c66dda81db9413b19ff4306c2dc6cfaebf8891f166dec1ba59c98a83eb14/ply/3/comment/1/text/0-62` — Building the Lucena bridge shelters the king from checks; the question avoids the source wording.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-philidor / ply 1 |
| 2 | classic:st-lucena / ply 3 |
| 3 | classic:cl-steinitz-bardeleben / ply 43 |
| 4 | classic:st-philidor / ply 3 |
| 5 | classic:ex-opera / ply 23 |
| 6 | classic:st-saavedra / ply 11 |

## iqp-paraphrase

de; paraphrase. Keywords: Wie stoppt man einen freistehenden Zentralbauern durch Figuren?.

Expected:

- `guide:iqp:de@aa145f1481c215bc882159a9aeedff72e536c7b9582338669f76ce3635422339/plans/text/0-165` — The isolated-pawn plan explains blockading with pieces using different wording.

| Rank | Passage location |
| ---: | --- |
| 1 | d-pawn / de / plans |
| 2 | french-chain / de / plans |
| 3 | kid / de / idea |
| 4 | iqp / de / plans |
| 5 | italian / de / structure |
| 6 | queens-gambit / de / plans |

## no-quantum-en

en; no-answer. Keywords: quantum tunnelling.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:ex-opera / ply 11 |
| 2 | classic:cl-reti-tartakower / ply 19 |
| 3 | classic:ex-opera / ply 13 |
| 4 | classic:cl-evergreen / ply 43 |
| 5 | classic:cl-rotlewi-rubinstein / ply 44 |
| 6 | library:repeat / ply 1 |

## no-quantum-de

de; no-answer. Keywords: Quantenverschränkung.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | caro-kann / de / structure |
| 2 | iqp / de / structure |
| 3 | maroczy / de / structure |
| 4 | french-chain / de / plans |
| 5 | iqp / de / plans |
| 6 | french / de / structure |

## wrong-language

en; no-answer. Keywords: Isolani.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | iqp / en / plans |
| 2 | caro-kann / en / structure |
| 3 | italian / en / plans |
| 4 | sicilian / en / idea |
| 5 | iqp / en / structure |
| 6 | english / en / structure |

## wrong-collection

en; no-answer. Keywords: Qxf7.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | library:iqp-f1 / ply 12 |
| 2 | library:qgd-b / ply 8 |
| 3 | library:repeat / ply 1 |
| 4 | library:iqp-e1 / ply 12 |
| 5 | library:qgd-a / ply 8 |
| 6 | library:en-passant / ply 0 |

## wrong-kind

en; no-answer. Keywords: Lucena.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | sicilian / en / idea |
| 2 | ruy-lopez / en / plans |
| 3 | ruy-lopez / en / idea |
| 4 | ruy-lopez / en / structure |
| 5 | french-chain / en / idea |
| 6 | kid-chain / en / plans |

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
| 3 | classic:cl-legal / ply 9 |
| 4 | classic:cl-evergreen / ply 37 |
| 5 | classic:ex-immortal / ply 43 |
| 6 | classic:ex-opera / ply 23 |

## unsupported-proof

en; no-answer. Keywords: Syzygy proof rook draw.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-lucena / ply 3 |
| 2 | classic:st-saavedra / ply 11 |
| 3 | classic:cl-steinitz-bardeleben / ply 43 |
| 4 | classic:st-saavedra / ply 13 |
| 5 | classic:ex-opera / ply 23 |
| 6 | classic:st-reti / ply 7 |

## Every-term ablation: unchanged text cases

# Hybrid passage retrieval

TODO 8.4. Suite 1; retriever `hybrid-all-terms-v1`.

159 passages: 45 original PGN comments and 114 authored guide sections. 28 manually labelled queries.

Corpus SHA-256: `fdc2addafd0b1275ff93f821c54737847af4706cb194686ee12cd96ffac734f0`.
Case SHA-256: `10d0afe264f20aa26ca22112224bb87562cc1300f0852feac1cb9977fbebf1c5`.

The parent hybrid report records the explicitly configured embedding run used for these details.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 20 | 8 | 0.850 | 0.783 | 0.850 | 0.850 | 0.000 |
| All | 3 | 20 | 8 | 0.350 | 0.850 | 0.850 | 0.850 | 0.000 |
| All | 6 | 20 | 8 | 0.175 | 0.850 | 0.850 | 0.850 | 0.000 |
| annotation | 1 | 9 | 0 | 0.889 | 0.889 | 0.889 | 0.889 | — |
| annotation | 3 | 9 | 0 | 0.296 | 0.889 | 0.889 | 0.889 | — |
| annotation | 6 | 9 | 0 | 0.148 | 0.889 | 0.889 | 0.889 | — |
| guide | 1 | 9 | 0 | 1.000 | 0.852 | 1.000 | 1.000 | — |
| guide | 3 | 9 | 0 | 0.481 | 1.000 | 1.000 | 1.000 | — |
| guide | 6 | 9 | 0 | 0.241 | 1.000 | 1.000 | 1.000 | — |
| paraphrase | 1 | 2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| paraphrase | 3 | 2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| paraphrase | 6 | 2 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | — |
| no-answer | 1 | 0 | 8 | — | — | — | — | 0.000 |
| no-answer | 3 | 0 | 8 | — | — | — | — | 0.000 |
| no-answer | 6 | 0 | 8 | — | — | — | — | 0.000 |
| en | 1 | 14 | 6 | 0.857 | 0.810 | 0.857 | 0.857 | 0.000 |
| en | 3 | 14 | 6 | 0.333 | 0.857 | 0.857 | 0.857 | 0.000 |
| en | 6 | 14 | 6 | 0.167 | 0.857 | 0.857 | 0.857 | 0.000 |
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

## philidor-sixth

en; annotation. Keywords: sixth rank.

Expected:

- `game:classic:st-philidor@f8d83d553b01fb01858a368fe57d834a0f2cf90178d454247baa48e9256ff882/ply/1/comment/0/text/0-67` — The Philidor defence note names the sixth rank.

| Rank | Passage location |
| ---: | --- |
| 1 | classic:st-philidor / ply 1 |

## saavedra-stalemate

en; annotation. Keywords: Saavedra stalemate.

Expected:

- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/10/comment/0/text/0-50` — Both notes discuss the stalemate idea, at different plies.
- `game:classic:st-saavedra@e3493a8cc86a2943a9beec12a74a7c725ca9135801bea39d872715cca1177cc1/ply/11/comment/1/text/0-53` — Both notes discuss the stalemate idea, at different plies.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## second-note

en; annotation. Keywords: second arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5/comment/1/text/0-48` — The second note is a separate passage despite equal board EPDs.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 5 |

## first-note

en; annotation. Keywords: first arrival.

Expected:

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/1/comment/0/text/0-34` — The first arrival must retain its own passage.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 1 |

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

## carlsbad-de

de; guide. Keywords: Minoritätsangriff Damenflügel.

Expected:

- `guide:carlsbad:de@d432f103e0d2b9360675c84bb1f63f7f84eef117f2c670024b7f66689174824a/plans/text/0-187` — The same authored plan is searchable in German.

| Rank | Passage location |
| ---: | --- |
| 1 | carlsbad / de / plans |

## sicilian-exchange

en; guide. Keywords: c-pawn d-pawn Sicilian.

Expected:

- `guide:sicilian:en@cc465ec9471023229a4f8525d6a19569fe158686aa9e0fd93029556630980fd5/structure/text/0-130` — This section states which central pawns an open Sicilian trades.

| Rank | Passage location |
| ---: | --- |
| 1 | sicilian / en / structure |

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

## maroczy-en

en; guide. Keywords: Maroczy.

Expected:

- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/idea/text/0-82` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/plans/text/0-129` — An accent-insensitive title lookup retrieves all three guide sections.
- `guide:maroczy:en@c29b6972324f48f4c7b3f100ef1f134c5ad906b4ded991d81fbbdff49a9bfe81/structure/text/0-85` — An accent-insensitive title lookup retrieves all three guide sections.

| Rank | Passage location |
| ---: | --- |
| 1 | maroczy / en / plans |
| 2 | maroczy / en / structure |
| 3 | maroczy / en / idea |

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
| — | Empty |

## iqp-paraphrase

de; paraphrase. Keywords: Wie stoppt man einen freistehenden Zentralbauern durch Figuren?.

Expected:

- `guide:iqp:de@aa145f1481c215bc882159a9aeedff72e536c7b9582338669f76ce3635422339/plans/text/0-165` — The isolated-pawn plan explains blockading with pieces using different wording.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

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
| — | Empty |

## unsupported-proof

en; no-answer. Keywords: Syzygy proof rook draw.

Expected:

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## Board and intent cases

# Hybrid passage retrieval

TODO 8.4. Suite 1; retriever `hybrid-rrf-rerank-v1`.

159 passages: 45 original PGN comments and 114 authored guide sections. 10 manually labelled queries.

Corpus SHA-256: `fdc2addafd0b1275ff93f821c54737847af4706cb194686ee12cd96ffac734f0`.
Case SHA-256: `f74dd2f37ce5ce42c5ec0f6830dcafc672068db36097d498724b237632851585`.

The parent hybrid report records the explicitly configured embedding run used for these details.

Precision uses k even for short lists. Relevance metrics average answerable queries only; no-answer false positives use a separate denominator. Gold is passage-level. This authored development suite does not measure semantic understanding, chess accuracy, answer faithfulness or generalisation.

| Slice | k | Answerable | No answer | Precision@k | Recall@k | MRR@k | nDCG@k | No-answer false positives |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All | 1 | 7 | 3 | 1.000 | 0.857 | 1.000 | 1.000 | 0.000 |
| All | 3 | 7 | 3 | 0.429 | 1.000 | 1.000 | 1.000 | 0.000 |
| All | 6 | 7 | 3 | 0.214 | 1.000 | 1.000 | 1.000 | 0.000 |
| occurrence | 1 | 2 | 0 | 1.000 | 1.000 | 1.000 | 1.000 | — |
| occurrence | 3 | 2 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| occurrence | 6 | 2 | 0 | 0.167 | 1.000 | 1.000 | 1.000 | — |
| exact | 1 | 4 | 0 | 1.000 | 0.875 | 1.000 | 1.000 | — |
| exact | 3 | 4 | 0 | 0.417 | 1.000 | 1.000 | 1.000 | — |
| exact | 6 | 4 | 0 | 0.208 | 1.000 | 1.000 | 1.000 | — |
| analogy | 1 | 1 | 0 | 1.000 | 0.500 | 1.000 | 1.000 | — |
| analogy | 3 | 1 | 0 | 0.667 | 1.000 | 1.000 | 1.000 | — |
| analogy | 6 | 1 | 0 | 0.333 | 1.000 | 1.000 | 1.000 | — |
| no-answer | 1 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 3 | 0 | 3 | — | — | — | — | 0.000 |
| no-answer | 6 | 0 | 3 | — | — | — | — | 0.000 |
| en | 1 | 7 | 3 | 1.000 | 0.857 | 1.000 | 1.000 | 0.000 |
| en | 3 | 7 | 3 | 0.429 | 1.000 | 1.000 | 1.000 | 0.000 |
| en | 6 | 7 | 3 | 0.214 | 1.000 | 1.000 | 1.000 | 0.000 |

## repeated-first

en; occurrence. Keywords: first arrival.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3`. All terms required: false.

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/1/comment/0/text/0-34` — Literal first-arrival intent distinguishes equal boards; the exact board must not override the note.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 1 |
| 2 | library:repeat / ply 5 |
| 3 | library:en-passant / ply 0 |
| 4 | library:qgd-a / ply 8 |
| 5 | library:qgd-b / ply 8 |
| 6 | library:iqp-f1 / ply 12 |

## repeated-second

en; occurrence. Keywords: second arrival.

Expected:

Query FEN: `rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 5 3`. All terms required: false.

- `game:library:repeat@b22daa2c53f3c23917a268b75f1e38a00ef089d0e92faa0d34c6f0b6a08630a9/ply/5/comment/1/text/0-48` — The second occurrence has its own note and exact navigation target.

| Rank | Passage location |
| ---: | --- |
| 1 | library:repeat / ply 5 |
| 2 | library:repeat / ply 1 |
| 3 | library:qgd-a / ply 8 |
| 4 | library:en-passant / ply 0 |
| 5 | library:qgd-b / ply 8 |
| 6 | library:castling / ply 0 |

## qgd-transposition

en; exact. Keywords: QGD transposition.

Expected:

Query FEN: `rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5`. All terms required: false.

- `game:library:qgd-a@db8e8e56f128a22f89e848d5ced04b1b0dae856dc0381f0896e14606113eadf0/ply/8/comment/0/text/0-54` — Both original notes describe the exact QGD transposition.
- `game:library:qgd-b@b2bd38777818097ac77e98d4f8834f905a220e5998a8778b4a427cfd3ca6fcd3/ply/8/comment/0/text/0-42` — Both original notes describe the exact QGD transposition.

| Rank | Passage location |
| ---: | --- |
| 1 | library:qgd-b / ply 8 |
| 2 | library:qgd-a / ply 8 |
| 3 | library:en-passant / ply 0 |
| 4 | library:repeat / ply 1 |
| 5 | library:repeat / ply 5 |
| 6 | library:iqp-check / ply 12 |

## quiet-iqp

en; analogy. Keywords: IQP middlegame.

Expected:

Query FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 12 26`. All terms required: false.

- `game:library:iqp-f1@c1043a8c03fc9b0defd9259e98447e6607285503d51d6b4d27666ee091247fe7/ply/12/comment/0/text/0-61` — The two quiet IQP notes fit the quiet board; the checked note is a distractor.
- `game:library:iqp-e1@5a9e57595953f22326418f4abb2b3f768baaa4ff53f5c7cdcfe0cd3570848482/ply/12/comment/0/text/0-61` — The two quiet IQP notes fit the quiet board; the checked note is a distractor.

| Rank | Passage location |
| ---: | --- |
| 1 | library:iqp-f1 / ply 12 |
| 2 | library:iqp-e1 / ply 12 |
| 3 | library:iqp-check / ply 12 |
| 4 | library:repeat / ply 1 |
| 5 | library:en-passant / ply 0 |
| 6 | library:repeat / ply 5 |

## checked-iqp

en; exact. Keywords: in check.

Expected:

Query FEN: `r2qr1k1/ppp2ppp/2n5/7n/3P4/2N2N2/PP3PPP/R2QK2R w - - 12 26`. All terms required: false.

- `game:library:iqp-check@ae98a5549dd54b1e00136180b621d4597e68e399de42a16b24483c88e3967fe3/ply/12/comment/0/text/0-63` — The exact checked board explains why a general quiet plan cannot answer the check.

| Rank | Passage location |
| ---: | --- |
| 1 | library:iqp-check / ply 12 |
| 2 | library:iqp-e1 / ply 12 |
| 3 | library:iqp-f1 / ply 12 |
| 4 | library:en-passant / ply 0 |
| 5 | library:repeat / ply 1 |
| 6 | library:repeat / ply 5 |

## castling-rights

en; exact. Keywords: castling rights.

Expected:

Query FEN: `r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10`. All terms required: false.

- `game:library:castling@d28665e0ca7f8e40ebf23cbfc5669c20b9a1df809b9d61b43c1c733f08510ff4/ply/0/comment/0/text/0-39` — The root note and complete EPD retain castling rights.

| Rank | Passage location |
| ---: | --- |
| 1 | library:castling / ply 0 |
| 2 | library:repeat / ply 1 |
| 3 | library:en-passant / ply 0 |
| 4 | library:qgd-b / ply 8 |
| 5 | library:iqp-check / ply 12 |
| 6 | library:repeat / ply 5 |

## ep-root

en; exact. Keywords: en passant d6.

Expected:

Query FEN: `4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 22`. All terms required: false.

- `game:library:en-passant@641e90f32d6bbff0483fc05b22dbb42f2cd5e6f6815f45098776e0c3dbfc6793/ply/0/comment/0/text/0-35` — A custom-start note has the exact legal en-passant board.

| Rank | Passage location |
| ---: | --- |
| 1 | library:en-passant / ply 0 |
| 2 | library:repeat / ply 5 |
| 3 | library:repeat / ply 1 |
| 4 | library:qgd-b / ply 8 |
| 5 | library:iqp-e1 / ply 12 |
| 6 | library:iqp-f1 / ply 12 |

## unsupported-with-board

en; no-answer. Keywords: quantum knight teleportation.

Expected:

Query FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 12 26`. All terms required: true.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## excluded-source

en; no-answer. Keywords: Dxf7.

Expected:

Query FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 12 26`. All terms required: true.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |

## empty-intent

en; no-answer. Keywords: the und für.

Expected:

Query FEN: `r2q1rk1/ppp2ppp/2n2n2/8/3P4/2N2N2/PP3PPP/R2Q1RK1 w - - 12 26`. All terms required: false.

No relevant passage in the permitted scope.

| Rank | Passage location |
| ---: | --- |
| — | Empty |
