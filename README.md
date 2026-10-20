# Kibitz

A browser chess trainer: play against Stockfish 19, see your mistakes flagged as you play, review finished games, keep a games library and get reading suggestions that match the position on the board. Stockfish does all the calculation, locally in Web Workers. An AI model only explains the engine's output.

The repo holds two variants of the app, developed side by side for comparison:

| Folder | Variant | Build step |
|---|---|---|
| [`claude/`](claude/) | Source project (npm). `src/` builds into `dist/`. | Yes |
| [`codex/`](codex/) | Prebuilt bundle, served as is. | No |

Both started from the same code. Where the project is heading is in [TODO.md](docs/TODO.md), progress is logged in [DONE.md](docs/DONE.md), and the working rules for coding agents and contributors are in [AGENTS.md](AGENTS.md).

## Prerequisites

- **Node.js** with npm: current LTS recommended (tested with Node 25). Builds `claude/` and runs the local server behind `just`.
- **Python 3**: for `npm run serve` and the end-to-end test.
- A recent desktop or mobile browser with WebAssembly support. Older browsers fall back to the slower asm.js engine.

The pages load ES modules and Web Workers, so they must be served over HTTP. Opening `index.html` straight from disk (`file://`) won't work.

## Quick start with `just`

With [just](https://github.com/casey/just) installed (`brew install just`), run these from the repo root:

```bash
just claude          # install if needed, build, serve claude/ on http://127.0.0.1:8765/
just codex           # serve codex/ with the AI coach on http://127.0.0.1:8766/ (see "AI coach")
just both            # serve both side by side; Ctrl-C stops both
just test            # unit tests: AI gateway and knowledge module (builds first)
just e2e codex       # Playwright run against a running variant (claude or codex)
just                 # list all recipes
```

The recipes use [`scripts/serve.mjs`](scripts/serve.mjs), a small dependency-free Node server that sends UTF-8 charset headers. Servers bind to `127.0.0.1` only. Override with `CLAUDE_PORT`, `CODEX_PORT` or `KIBITZ_HOST`, e.g. `CODEX_PORT=9000 just codex`. The sections below show the same steps without `just`.

## `claude/` variant

```bash
cd claude
npm install          # chess.js, chessground, stockfish
npm run build        # writes dist/
npm run serve        # builds, then serves dist/ on port 8765
```

Open <http://localhost:8765/_test.html>.

- `dist/index.html` is the page body as published to a Claude artifact; `dist/_test.html` is the same page wrapped in a full HTML document for local use. With `npm run serve` (or any plain static server), open `/_test.html`, not `/`. `index.html` has no `<meta charset>`, so the browser decodes it as Windows-1252 and every `≈`, `…` and `·` comes out garbled.
- The first build also generates `dist/eco.json` from `data/eco/*.tsv`. Run `npm run build:eco` to rebuild it after changing the opening data.
- Edit files in `src/`. `dist/` is regenerated on every build and isn't committed.

## `codex/` variant

No install or build step; serve the folder directly:

```bash
npm install                                        # once: SDKs for the AI gateway
node scripts/serve.mjs codex --api --port 8766     # or: just codex
```

Open <http://localhost:8766/>. Any static server works too (e.g. `cd codex && python3 -m http.server 8766`), but then there is no AI gateway and the coach stays off.

The vendored engine and libraries (`sf.js`, `sf.wasm`, `sf-asm.js`, `chess.js`, `chessground.js`) and the opening table (`eco.json`) are checked in alongside the page.

Ports 8765 and 8766 are only a convention, so both variants can run at the same time.

## AI coach

The coach chat, game-review summary and study plan need a language model. Without one, both variants still give you the full engine features: play, hints, move ratings, analysis, review, library and reading suggestions.

- **Published as a Claude artifact:** the page uses the model the artifact provides through `window.claude`.
- **`codex/` run locally with `just codex`:** the page talks to a local AI gateway (`server/`, mounted by `scripts/serve.mjs --api`). The gateway calls Claude, OpenAI, Mistral or a local Ollama model, and keeps the API keys on the server.
- **`claude/` run locally:** no coach yet; the gateway isn't wired into its page.

To set up the gateway:

```bash
cp .env.example .env   # then set AI_PROVIDER and that provider's key and model
just codex             # prints "AI coach: <provider> / <model>", or why the coach is off
```

`.env` is git-ignored and read once at startup, so restart the server after changing it. `AI_PROVIDER=mock` gives canned replies without any API calls, which is handy for UI work. The gateway only accepts requests from its own page: other websites, and attackers using a look-alike host name to get the browser to treat their page as local, are refused. It also limits requests per minute (`AI_RATE_LIMIT_PER_MINUTE`).

Add `?debug` to the URL to get `window.__kibitz = { S, contextFor, ANA }` in the browser console.

## Tests

```bash
npm test             # AI gateway (server/): config, providers, validation, HTTP guards; no network calls

cd claude
npm run build        # the unit check needs dist/eco.json
npm test             # knowledge module: features, motifs, book retrieval
```

`npm test` currently prints its results rather than asserting them. Turning it into real assertions is TODO 0.7.

End-to-end (Playwright, Chromium):

```bash
pip install playwright && python3 -m playwright install chromium

# with a variant's server running in another terminal:
cd claude && npm run test:e2e                                       # claude/ on :8765
KIBITZ_URL=http://localhost:8766/ python3 claude/tests/e2e.py       # codex/ on :8766, run from the repo root
```

The e2e run plays a short game, runs a review, opens the library and checks a phone-width dark-mode layout. It saves screenshots to `claude/tests/out/` and prints any browser console errors. Set `CHROME_PATH` to use a specific Chrome or Chromium binary.

## Licences

Stockfish and chessground are GPL-3.0, so distributing this app means distributing it under GPL-3.0 terms. chess.js is BSD-2-Clause, and the opening names come from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
