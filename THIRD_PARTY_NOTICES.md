# Third-party notices

Kibitz is licensed under the GNU General Public License, version 3 or (at your option) any later version; see [LICENSE](LICENSE). It includes or loads the components below. The build copies this file and `LICENSE` (as `LICENSE.txt`) into `site/dist/`, so they ship with the page.

## Shipped with the page (`site/dist/`)

| Component | Version | Licence | Files in `dist/` |
|---|---|---|---|
| [Stockfish.js](https://github.com/nmrugg/stockfish.js) (Stockfish 19), (c) Chess.com, LLC; based on [Stockfish](https://github.com/official-stockfish/Stockfish) by T. Romstad, M. Costalba, J. Kiiski, G. Linscott and other contributors | 19.0.1 | GPL-3.0 | `sf.js`, `sf.wasm`, `sf-asm.js` |
| [chessground](https://github.com/lichess-org/chessground), Lichess team | 10.1.1 | GPL-3.0-or-later | `chessground.js`, CSS inlined into `index.html` |
| cburnett chess pieces, Colin M.L. Burnett, bundled with chessground | | GPL-2.0-or-later | CSS inlined into `index.html` |
| [chess.js](https://github.com/jhlywa/chess.js), Jeff Hlywa | 1.4.0 | BSD-2-Clause (text below) | `chess.js` |
| [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | | CC0-1.0 | `eco.json`, built from `site/data/eco/` |

## Loaded by the page, not shipped

- Fonts from Google Fonts: Bricolage Grotesque, Instrument Sans, JetBrains Mono (all SIL Open Font License 1.1).

## Used by the server (`site/server/`, installed from npm, not shipped to browsers)

| Component | Licence |
|---|---|
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | MIT |
| [openai](https://github.com/openai/openai-node) (OpenAI, Mistral and Ollama) | Apache-2.0 |

Development tools (Playwright, ESLint, TypeScript and their dependencies) are not shipped; their licences are in `site/node_modules/`.

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
