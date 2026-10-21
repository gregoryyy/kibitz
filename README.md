# Kibitz: Neurosymbolic Chess Coach

Stockfish plays and measures; a language model explains.

In the browser, play against Stockfish 19 (from 600 Elo up, in five playing styles, with or without a clock, from the start, an opening or any position), see your mistakes flagged as you play, review finished games, keep a games library and get reading suggestions that match the position on the board. Stockfish does all the calculation, locally in Web Workers. An AI model (Claude, OpenAI, Mistral or a local Ollama model) only explains the engine's output.

The app lives in [`site/`](site/): page source, build scripts, opening data, the local server with its AI gateway, and tests. Design notes are in [site/README.md](site/README.md). Where the project is heading is in [TODO.md](docs/TODO.md), progress is logged in [DONE.md](docs/DONE.md), and the working rules for coding agents and contributors are in [AGENTS.md](AGENTS.md).

## Prerequisites

- **Node.js 24 LTS or newer** with npm (`.nvmrc` pins 24; tested with Node 25).
- **Google Chrome**, for the end-to-end tests (Playwright drives the installed browser).
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
just check             # ESLint and the type check (tsc --checkJs)
just e2e               # Playwright end-to-end tests (starts its own server with the mock AI provider)
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

The gateway only accepts requests from its own page: other websites, and attackers using a look-alike host name to get the browser to treat their page as local, are refused. It also limits requests per minute (`AI_RATE_LIMIT_PER_MINUTE`) and, optionally, tokens per day (`AI_TOKEN_BUDGET_PER_DAY`).

**Coach settings** (in the Coach tab, when running locally):
- Switch between the providers your `.env` sets up.
- See the model each task uses (`<PROVIDER>_MODEL_QUICK`, `_MODEL_REVIEW`).
- Turn on local-only mode, so only Ollama is used (`AI_LOCAL_ONLY` makes it the default).
- Test the connection.
- See today's requests and tokens, with a cost estimate if you set `AI_PRICES`.

Changes there last until the server restarts; keys never reach the page.

Add `?debug` to the URL to get `window.__kibitz = { S, contextFor, ANA }` in the browser console.

## Tests

```bash
just check             # or, in site/: npm run check
just test              # or, in site/: npm run build && npm test
just e2e               # or, in site/: npm run test:e2e
```

- **`npm test`** runs the unit tests (`node:test`, no network calls). They cover the AI gateway (config, providers, validation, HTTP guards, security headers) and the page modules (engine queue with a fake worker, storage, prompt quoting, playing style, and the knowledge module's features, motifs, retrieval and scoring).
- **`npm run test:e2e`** builds the site and runs Playwright in your installed Google Chrome. It starts its own server on port 8799 with `AI_PROVIDER=mock` and no `.env`, so no keys and no real provider are involved.
  - The smoke tests play and review a game, use the library, reading and coach tabs, check the security headers and the phone layout.
  - The regression tests reproduce each bug fixed after the code review.
  - Every test also fails on uncaught page errors and Content Security Policy violations.
  - Reports and traces of failed tests go to `site/tests/out/` (git-ignored).
- **Live tests** (`KIBITZ_LIVE_AI=1 npm run test:live` in `site/`) send a few small requests to the providers in `.env`; they never run otherwise. `node scripts/record-ai-fixtures.mjs <provider>` records fresh responses for the contract tests.
- **`npm run check`** runs ESLint (including the script inside `index.html`) and `tsc --checkJs` over `src/`, `server/` and `scripts/`.
- **CI** (`.github/workflows/`) runs all of the above on every PR, plus `npm audit`, a gitleaks secret scan and, once the repo is public, CodeQL.
  - To use Playwright's bundled Chromium instead of Chrome, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

## Licence

Kibitz is GPL-3.0-or-later ([LICENSE](LICENSE)), as Stockfish and chessground require. The third-party components and their licences are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); chess.js is BSD-2-Clause, and the opening names come from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
