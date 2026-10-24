# German opening labels and built-in comments

The German interface displays German opening labels above the score, in named continuations/study notes, opening selection, Reading chips and library opening metadata. All 141 family prefixes in the current 3,865-row CC0 catalogue have explicit project-authored labels. Common variation terms have curated translations; named variations use German structural terms. Personal names and uncommon nicknames retain their catalogue spelling. These are Kibitz labels rather than an authoritative German naming standard.

For example, `Sicilian Defense: Najdorf Variation, English Attack` displays as `Sizilianische Verteidigung: Najdorf-Variante, Englischer Angriff`, and `Benko Gambit Accepted` becomes `Angenommenes Wolga-Gambit`. Important label tooltips retain the original name. Opening selection and coach lookup accept original names, German names and ECO codes; matching is literal, accent-insensitive and requires every query term. Library opening filters also accept both labels.

Canonical names, ECO codes, stored opening selections, PGN Opening headers, move sequences and engine-feature recognition retain the original catalogue data. Unknown/custom labels and oversized strings remain literal instead of being guessed. The label layer does not change move legality, transposition matching, source identity or live-help permissions. [Upstream catalogue documentation](https://github.com/lichess-org/chess-openings) describes its English names, structured variation labels and CC0 dedication.

## Authored PGN comments

In the German interface, `classicGames({ language: 'de' })` constructs the 33 built-in games/problems with German versions of all 63 distinct authored comments (64 occurrences). This includes the Opera/Immortal games, the sourced Capablanca scores and the curated studies/problems. The default constructor remains English, byte-for-byte, without mutating the source records. No provider is called to translate comments.

These are translations of Kibitz's original notes, with the same GPL annotation rights. Published scores, headers, sources and legal lines remain intact; move tokens inside PGN retain standard English SAN. Revised German documents get their own content hashes and exact comment locators. German comments therefore work in local search and quoted coach retrieval, and can be exported as the selected built-in record. All annotations remain unverified prose. Saved tablebase evidence still covers only the same exact recorded positions/branches, never the translation's wording or a copied import.

Imported/user-written comments and existing saved copies retain their original text, even when identical to an English built-in note. A restored game also keeps its saved comments when the interface language changes; reopen the built-in record to select its other language. This avoids rewriting a player's saved source material. Original English retrieval benchmarks keep their frozen default corpus; German annotation ranking has not gained a new benchmark claim.

## Verification

Tests audit every family prefix and catalogue label, original/German search aliases, bounded hostile/unknown labels and every authored-comment translation. Both language versions replay all 1,403 built-in plies to the same positions with identical headers/source rights. German passage locators address the actual revised PGN, and all twelve curated problem branches retain their checked outcomes while imports gain no certificate. Browser tests cover labels, saved canonical selections, engine context, precise annotation navigation, imported-text isolation, library filters, original-name tooltips and German phone layout. Existing localization and opening-navigation regressions remain in use.
