# Third-party notices

Kibitz is licensed under the GNU General Public License, version 3 or (at your option) any later version; see [LICENSE](LICENSE). It includes or loads the components below. The build copies this file and `LICENSE` (as `LICENSE.txt`) into `site/dist/`, so they ship with the page.

## Shipped with the page (`site/dist/`)

| Component | Version | Licence | Files in `dist/` |
|---|---|---|---|
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (Stockfish 19), (c) Chess.com, LLC; based on [Stockfish](https://github.com/official-stockfish/Stockfish) by T. Romstad, M. Costalba, J. Kiiski, G. Linscott and other contributors | 19.0.1 | GPL-3.0 | `sf.js`, `sf.wasm`, `sf-asm.js` |
| [chessground](https://github.com/lichess-org/chessground), Lichess team | 10.4.2, locally adapted 2026-10-25 | GPL-3.0-or-later | `chessground.js`, CSS inlined into `index.html` |
| cburnett chess pieces, Colin M.L. Burnett, bundled with chessground | | GPL-2.0-or-later | CSS inlined into `index.html` |
| [chess.js](https://github.com/jhlywa/chess.js), Jeff Hlywa | 1.4.0 | BSD-2-Clause (text below) | `chess.js` |
| [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | | CC0-1.0 | `eco.json`, built from `site/data/eco/` |
| [Lichess puzzle database](https://database.lichess.org/#puzzles), 64-row starter subset retrieved 2026-10-24 | | CC0-1.0 | `curriculum/puzzle-data.js`, built from the recorded CSV/manifest in `site/data/puzzles/` |
| [wllama](https://github.com/ngxson/wllama), Xuan-Son Nguyen and contributors; includes [llama.cpp](https://github.com/ggml-org/llama.cpp) (MIT, The ggml authors) | 3.8.1 | MIT | `wllama.js`, `wllama.wasm` |
| Bricolage Grotesque (2022 project authors), Instrument Sans (2022 project authors), JetBrains Mono (2020 project authors), from [Google Fonts](https://github.com/google/fonts) | Source revision `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0` | SIL Open Font License 1.1, complete per-family notices retained | `fonts/*.ttf`, `fonts/*-OFL.txt`, `fonts/manifest.json` |

The page also ships numerical outcomes for 28 fixed endgame teaching positions, computed by the [Lichess Syzygy tablebase service](https://github.com/lichess-org/lila-tablebase) using Ronald de Man's Syzygy tables. `site/src/curriculum/tablebase-snapshots.js` records the exact query URL, retrieval time and digest of each saved result. These are computed chess facts; no tablebase files or server implementation are bundled. The teaching prose is original Kibitz material under the project licence. Refreshing the records is an explicit development command; the browser makes no tablebase requests.

The classic-game collection also ships twelve complete game scores from José Raúl Capablanca's *Chess Fundamentals* (1921), [Project Gutenberg ebook 33870](https://www.gutenberg.org/ebooks/33870), identified there as public domain in the USA. Nine earlier game-score records use fixed Wikipedia revisions credited to **Wikipedia contributors**, retaining [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); their revision links provide access to contributor histories. Changes: move notation normalized; third-party prose, variations and judgement glyphs omitted. These score records retain their stated source rights separately from original Kibitz teaching notes under GPL-3.0-or-later. Per-game attribution, revision/page URLs and retrieval evidence are in [the source manifest documentation](site/data/classics/README.md), `library/classic-sources.js` and `library/capablanca.js`. The runtime metadata and this notice ship with the page. No GPL-3.0-or-later relicensing of the CC BY-SA score data is asserted. The frozen original retrieval fixtures use the same earlier scores and original Kibitz notes; their historical metadata is retained for reproducible measurements.

The problems collection retains the published Réti/Saavedra diagram/score facts under CC BY-SA 4.0, credited to Wikipedia contributors with fixed revision links and diagram records in [the source manifest](site/data/problems/README.md). No source prose is included. Lucena/Philidor setups are identified as authored teaching variants under the project licence, with separate method references. Eight additional exercises reuse original Kibitz curriculum material. The collection adds numerical Syzygy facts for 22 fixed published-study FENs in `library/problem-tablebases.js`, alongside 28 shared curriculum records; query/date/digest metadata accompanies each. These are computed chess facts, not bundled tablebase files. No current player position is sent to a tablebase service; explicit refresh targets only the fixed source diagrams/branches.

Chessground's SVG color-scheme declaration is moved from its fixed inline style
attribute into the trusted page stylesheet for Kibitz's CSP. The reproducible
transformation is in [the build script](site/scripts/build.mjs), with the CSS in
`site/src/index.html`; all other upstream bundle bytes are retained. The build
rejects an unexpected bundle instead of silently skipping this adaptation.

## Loaded by the page, not shipped

- The in-browser model's weights, which `just offline` downloads from Hugging Face into `site/models/` and the local server hands to the page: [Qwen2.5 1.5B Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF) or [Qwen2.5 0.5B Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF), Alibaba Cloud (Qwen team), Apache-2.0. They're not in the repo.

## Used by the server (`site/server/`, installed from npm, not shipped to browsers)

| Component | Licence |
|---|---|
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | MIT |
| [openai](https://github.com/openai/openai-node) (OpenAI, Mistral and Ollama) | Apache-2.0 |
| [parse5](https://github.com/inikulin/parse5), 8.0.1, Ivan Nikulin and contributors — parses build-owned HTML for CSP script hashes | MIT |
| [entities](https://github.com/fb55/entities), 8.1.0, Felix Böhm and contributors — parse5's character decoder, pinned transitively in the lockfile | BSD-2-Clause |

The parser and decoder stay in server-side `node_modules/`; their licence files remain with the installed packages. They are not browser modules or model dependencies.

Development tools (Playwright, ESLint, TypeScript and their dependencies) are not shipped; their licences are in `site/node_modules/`.

Container CI additionally runs the official [Trivy](https://github.com/aquasecurity/trivy) 0.76.1 scanner (Apache-2.0), pinned by manifest digest. It is a separate build/review tool, not part of the distributed app image. Its public advisory database is refreshed and its timestamp/digest recorded for each image check; [coverage and limits](docs/IMAGE-ADVISORIES.md) distinguish it from a complete release review.

The candidate runtime uses [Google Distroless Node.js 24 on Debian 13](https://github.com/GoogleContainerTools/distroless/tree/main/nodejs), pinned by manifest digest. Distroless tooling is Apache-2.0; Node and Debian components retain their own upstream licences/notices in the base image. CI verifies the publisher with [Cosign](https://github.com/sigstore/cosign) 3.1.4 (Apache-2.0), installed by a pinned [cosign-installer](https://github.com/sigstore/cosign-installer) action (Apache-2.0). These verification tools are not distributed in the app image.

## chess.js licence

```
Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```
