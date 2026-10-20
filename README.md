# Kibitz

A browser chess trainer: play against Stockfish 19, see your mistakes flagged as you play, review finished games, keep a games library and get reading suggestions that match the position on the board. Stockfish does all the calculation, locally in Web Workers. An AI model (Claude, OpenAI, Mistral or a local Ollama model) only explains the engine's output.

The app lives in [`site/`](site/): page source, build scripts, opening data, the local server with its AI gateway, and tests. Design notes are in [site/README.md](site/README.md). Where the project is heading is in [TODO.md](docs/TODO.md), progress is logged in [DONE.md](docs/DONE.md), and the working rules for coding agents and contributors are in [AGENTS.md](AGENTS.md).

## Prerequisites

- **Node.js 22 or newer** with npm (tested with Node 25).
- **Python 3**, only for the end-to-end test.
- **[just](https://github.com/casey/just)** (`brew install just`) is optional; every recipe has a plain npm equivalent below.
- A recent desktop or mobile browser with WebAssembly support. Older browsers fall back to the slower asm.js engine.

The page loads ES modules and Web Workers, so it must be served over HTTP. Opening `index.html` straight from disk (`file://`) won't work.

## Quick start

```bash
cp .env.example .env   # then set AI_PROVIDER and that provider's key and model
just serve             # install if needed, build, serve on http://127.0.0.1:8765/
```

On start the server prints `AI coach: <provider> / <model>`, or why the coach is off. Other recipes:

```bash
just test              # unit tests (builds first)
just e2e               # Playwright run against a server started with `just serve`
just build             # build only; `just build-eco` also rebuilds the opening table
just                   # list all recipes
```

The server binds to `127.0.0.1` only. Change the port or address with `KIBITZ_PORT` and `KIBITZ_HOST`, e.g. `KIBITZ_PORT=9000 just serve`.

Without `just`:

```bash
cd site
npm install
npm run serve          # builds, then serves dist/ with the AI gateway on port 8765
```

- `dist/index.html` is the page body as published to a Claude artifact. `dist/_test.html` is the same page wrapped in a full HTML document; the server shows it at `/`.
- The first build also generates `dist/eco.json` from `data/eco/*.tsv`. Run `npm run build:eco` to rebuild it after changing the opening data.
- Edit files in `site/src/`. `dist/` is regenerated on every build and isn't committed.
- Plain static servers (e.g. `python3 -m http.server`) work for the engine features, but they have no AI gateway, and they send no charset. Open `/_test.html` with them, not `/`: `index.html` has no `<meta charset>`, so the browser decodes it as Windows-1252 and every `≈`, `…` and `·` comes out garbled.

## AI coach

The coach chat, game-review summary and study plan need a language model. Without one, the page still gives you the full engine features: play, hints, move ratings, analysis, review, library and reading suggestions.

- **Run locally:** the page talks to the AI gateway in `site/server/`, which `site/scripts/serve.mjs --api` mounts. The gateway reads `.env`, calls the chosen provider, and keeps the API keys on the server.
- **Published as a Claude artifact:** the page uses the model the artifact provides through `window.claude`.

`.env` is git-ignored and read once at startup, so restart the server after changing it. The defaults are small, fast models (`claude-haiku-5-5`, `gpt-6-luna`, `mistral-small-latest`). `AI_PROVIDER=mock` gives canned replies without any API calls, which is handy for UI work.

The gateway only accepts requests from its own page: other websites, and attackers using a look-alike host name to get the browser to treat their page as local, are refused. It also limits requests per minute (`AI_RATE_LIMIT_PER_MINUTE`).

Add `?debug` to the URL to get `window.__kibitz = { S, contextFor, ANA }` in the browser console.

## Tests

```bash
cd site
npm run build          # the knowledge check needs dist/eco.json
npm test               # AI gateway: config, providers, validation, HTTP guards (no network calls),
                       # then the knowledge module: features, motifs, book retrieval
```

The knowledge check currently prints its results rather than asserting them. Turning it into real assertions is TODO 0.7.

End-to-end (Playwright, Chromium):

```bash
pip install playwright && python3 -m playwright install chromium
just serve             # in one terminal
just e2e               # in another
```

The e2e run plays a short game, runs a review, opens the library and checks a phone-width dark-mode layout. It saves screenshots to `site/tests/out/` (git-ignored) and prints any browser console errors. Set `CHROME_PATH` to use a specific Chrome or Chromium binary.

## Licences

Stockfish and chessground are GPL-3.0, so distributing this app means distributing it under GPL-3.0 terms. chess.js is BSD-2-Clause, and the opening names come from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
