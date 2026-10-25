# Kibitz: Neurosymbolic Chess Coach

Stockfish plays and measures; a language model explains.

In the browser, play against Stockfish 19 (from 600 Elo up, in five playing styles, with or without a clock, from the start, an opening or any position), see your mistakes flagged as you play, review finished games, keep a games library and get reading suggestions that match the position on the board. Stockfish does all the calculation, locally in Web Workers. An AI model (Claude, OpenAI, Mistral, a local Ollama model, or a small model running in the browser) only explains the engine's output.

One of the main motivations for Kibitz is to experiment with combining large language models (LLMs) and symbolic solvers, using chess as a concrete example. The accompanying paper, *A Gentle Primer on Neurosymbolic AI: Building a Chess Tutor* ([read online](docs/primer/Primer_v01.md), [PDF](docs/primer/Primer_v01.pdf)), is intended for people learning about LLMs and the additional concepts of search, grounding, tool use and agents. It explains each concept through its application in Kibitz.

The app lives in [`site/`](site/): page source, build scripts, opening data, the local server with its AI gateway, and tests. Design notes are in [site/README.md](site/README.md). Where the project is heading is in [TODO.md](docs/TODO.md), longer-term ideas are in [ROAD.md](docs/ROAD.md), progress is logged in [DONE.md](docs/DONE.md), and the working rules for coding agents and contributors are in [AGENTS.md](AGENTS.md).

[Changelog](CHANGELOG.md) records notable changes. The [version policy](docs/RELEASING.md) follows Semantic Versioning; this branch prepares the unpublished draft candidate [`0.1.0-rc.1`](docs/releases/0.1.0-rc.1.md), with release checks and approval still pending.

The [local Docker package](docs/CONTAINER.md) provides a mock-default recipe with private persistent storage and explicit loopback publishing, verified with real image/browser/restart tests in Linux CI.

## Prerequisites

- **Node.js 24.22.1 LTS** with npm, or a newer maintained security-patched release (`.nvmrc` pins the CI runtime).
- **Google Chrome**, for the end-to-end tests (Playwright drives the installed browser).
- **[just](https://github.com/casey/just)** (`brew install just`) is optional; every recipe has a plain npm equivalent below.
- A recent desktop or mobile browser with WebAssembly support. Older browsers fall back to the slower asm.js engine.

The page loads ES modules and Web Workers, so it must be served over HTTP(S). Opening `index.html` straight from disk (`file://`) won't work.

The supported target is a **local single-user app**, served on loopback by default. Cloud AI remains optional; Ollama and the in-browser model offer local inference. [Deployment decision](docs/DEPLOYMENT.md) records the scope and implications for accounts, keys and security.

The [threat model](docs/THREAT-MODEL.md) maps data flows, local trust assumptions, tested controls and remaining security verification work. The [OWASP Top 10 checklist](docs/OWASP-TOP10.md), [LLM review](docs/OWASP-LLM.md) and [ASVS L1 assessment](docs/ASVS.md) record evidence, limits and tracked findings; release verification remains open.

[Automated security checks](docs/SECURITY-SCANS.md) document dependency/code/secret checks and a pinned passive ZAP baseline against an isolated mock-only staging server, including evidence limits and retained reports.

The [flipbook](docs/flipbook/README.md) follows the Opera Game into source search, opening repertoires, lessons and local practice, including German phone views.

The [user guide](docs/GUIDE.md) walks through playing, analysis, reviews, practice, source search and data controls. [Provider setup and native Ollama](docs/PROVIDERS.md) covers API access, task models, explicit sharing, spending limits and a local offline-serving recipe.

## Quick start

```bash
cp .env.example .env   # then set AI_PROVIDER and that provider's key and model
just serve             # build, then HTTPS at https://127.0.0.1:8765/ (supply TLS files first)
```

Before using a network provider, open **Settings → Coach → Provider permissions** and explicitly allow coach requests or embeddings for that provider. Keys alone do not enable sharing. [Privacy and data flows](docs/PRIVACY.md) explain configured endpoints, separate choices and revocation limits.

Before serving, supply your trusted certificate/key pair at `.kibitz-data/tls/`
as described in [native HTTPS setup](docs/TLS.md). Standard recipes require those
files; invalid TLS setup stops startup. [Cookie migration and rollback](docs/COOKIE-MIGRATION.md)
preserve existing server-library ownership and usage counters. HTTP development
requires the explicit `--http-dev` option and separate development identities.

On start the server prints `AI coach: <provider> / <model>`, or why the coach is off. Other recipes:

```bash
just test              # unit tests (builds first)
just check             # ESLint and the type check (tsc --checkJs)
just e2e               # Playwright end-to-end tests (starts its own server with the mock AI provider)
just build             # build only; `just build-eco` also rebuilds the opening table
just pdfs              # a PDF next to every Markdown document (needs pandoc and Chrome); `just pdf FILE` for one
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

The [LLM and symbolic design overview](docs/AI-DESIGN.md) maps the mechanisms across the features. [ARCH.md](docs/ARCH.md) gives the implementation details.

[Research notes](docs/research/README.md) cover AI use cases in milestones 5–7, the current Stockfish integration, text/structured/graph RAG, and neurosymbolic approaches to chess and other games.

The coach chat, game-review summary and study plan need a language model. Without one, the page still gives you the full engine features: play, hints, move ratings, analysis, review, library, opening explorer, repertoire builder and reading suggestions.

Coaching prose is experimental. Kibitz checks recognized moves, selected board claims and captured engine evidence; these checks do not verify every explanation or strategic claim. Expand an answer's evidence cards and check important continuations with Stockfish. The [user guide](docs/GUIDE.md#analyse-and-ask-the-coach) explains the current limits.

The **Openings** tab explores recorded continuations from the classics and your saved/imported games. It shows counts and results for the selected collection, with sample games at each move. Try a continuation on the scratch board and step back to explore another branch. During play it follows the help setting and needs Full engine help.

The same tab lets you build named repertoires for **White or Black**. Enter a PGN mainline or use **Use board line** to capture the game and scratch variation up to the displayed move. Name the line, add notes and save it; reopen it on the scratch board to explore alternatives. Repertoires stay in this browser, separately from your games, and can be copied as PGN. **Review due moves** recalls saved choices on an independent board; [practice scheduling](docs/PRACTICE.md) describes intervals and limits.

**Settings → Player profile** keeps your explanation level, optional self-reported rating/pool/time control and learning goals in this browser. Saved preferences guide coach requests; goals are quoted user data, and the rating is separate from opponent strength. [Profile behavior and limits](docs/PROFILE.md) explain saving, request freshness and the absence of automatic rating inference.

**Review → Review trends** summarizes compatible reviews of your own games in the selected library, with phase coverage and confirmed tactical opportunities. Repeated reviews replace their contribution; geometric candidates and missing evidence do not count as confirmed misses. [Review evidence and limits](docs/REVIEWS.md) explain the historical records and bounded checks.

**Practise your own mistakes** turns compatible reviewed mistakes into independent-board exercises. Stockfish rechecks the reference and original move, then grades any legal answer against a bounded target. Hints, reveal and rules-proven mate stay separate; [exercise scope and grading](docs/OWN-PUZZLES.md) explain the limits.

The **Lessons** tab offers bilingual tactics, strategy, endgames and sourced puzzles, with an isolated exercise board, authored hints and local progress. **Play against Stockfish** takes the displayed lesson position into a normal game as either colour, using your current strength and clock settings; an active game is confirmed and saved first.

**Lessons → Spaced practice** combines due lessons, opening recalls and own-mistake exercises, with local schedules, save retries and separate evidence labels. The [intervals and storage lifecycle](docs/PRACTICE.md) describe the simple practice heuristic and source-revision boundaries.

The **Classics** library includes 21 games with published score sources and separate score/note rights. Twelve complete games from Capablanca's *Chess Fundamentals* expand the collection; historical teaching versions are labelled, and all notes are original Kibitz material. [Source records and offline checks](site/data/classics/README.md) document the games. **Problems** browses twelve sourced mates/studies with bilingual questions, diagram-first opening and checked recorded branches. [Evidence and scope](site/data/problems/README.md) distinguish actual mates, tablebase outcomes and authored reflections.

In **Library**, search words or combine player, opening/ECO, recorded year range, result and theme filters. Names and theme labels support English/German and accent-insensitive matching. Search works locally; the coach's library tool uses the same filters. **Search detected patterns** separately browses computed position themes and recorded move patterns, with explicit heuristic/candidate/rules labels and exact source navigation; [evidence limits](docs/LIBRARY.md#position-and-move-pattern-tags) distinguish geometric candidates from proven chess facts.

An optional [server library](site/README.md#server-library) stores games and references in a private SQLite file, with a scoped IndexedDB browser cache. Choose it explicitly in Library; the existing browser library stays separate and is never uploaded automatically.

**Settings → Export or erase your data** provides separate confirmed controls for saved browser data and this browser's server library. [Data formats and deletion scope](docs/DATA.md) explain retries, caches and copies outside the app.

The chat also accepts local commands without a model: `play e4`, `open the Opera Game`, a pasted FEN or PGN, `go to move 15`, `remove the queens`, and `undo`. Analysis moves and setups use a scratch board. Leaving a running game asks first and offers a way back. Choose **General chess** above the composer for questions without a position; an answer's context button brings its position back onto the board.

- **Run locally:** the page talks to the AI gateway in `site/server/`, which `site/scripts/serve.mjs --api` mounts. The gateway reads `.env`, calls the chosen provider, and keeps the API keys on the server.
- **Published as a Claude artifact:** the page uses the model the artifact provides through `window.claude`.

`.env` is git-ignored and read once at startup, so restart the server after changing it. The defaults are small, fast models (`claude-haiku-5-5`, `gpt-6-luna`, `mistral-small-latest`). `AI_PROVIDER=mock` gives canned replies without any API calls, which is handy for UI work.

The gateway only accepts requests from its own page: other websites, and attackers using a look-alike host name to get the browser to treat their page as local, are refused. It also limits requests per minute (`AI_RATE_LIMIT_PER_MINUTE`) and, optionally, tokens per day for the whole server (`AI_TOKEN_BUDGET_PER_DAY`), and tokens or dollars per user and day on paid models (`AI_TOKEN_BUDGET_PER_USER_PER_DAY`, `AI_COST_BUDGET_PER_USER_PER_DAY`). Each answer shows its tokens and cost, and the dialogue shows what you have used today; costs need prices in `AI_PRICES`.

Default server logs omit URLs, cookies, prompts and raw provider messages; [local monitoring and retention](docs/OPERATIONS.md) explains the event fields and no-inference health checks.

**Coach settings** (in the Coach tab, when running locally):
- Switch between the providers your `.env` sets up.
- See the model each task uses (`<PROVIDER>_MODEL_QUICK`, `_MODEL_REVIEW`).
- Turn on local-only mode, allowing Ollama or the in-browser model (`AI_LOCAL_ONLY` makes it the default). Ollama's own endpoint/model configuration still controls whether its computation is local; see [setup](docs/PROVIDERS.md#self-host-with-native-ollama).
- Test the connection.
- See today's requests and tokens, with a cost estimate if you set `AI_PRICES`.

Changes there last until the server restarts; keys never reach the page.

**Offline mode:** `just offline` runs the coach on a small model inside the browser, so it works without a network, a key or a provider:
- **First run:** it downloads Qwen2.5 1.5B Instruct (about 1.1 GB, Apache-2.0) into `site/models/` and checks its SHA-256. `just offline qwen2.5-0.5b` takes a 0.5 GB model instead, which is faster but weaker.
- **Serving:** it serves without `.env` keys, in local-only mode. The page loads nothing from other hosts; its original fonts are bundled locally.
- **In the page:** the model loads only after you press Load in the Coach tab. It runs on the GPU through WebGPU where the browser has it, otherwise on the CPU in WebAssembly, where Stockfish gives it some of its threads while it answers. It unloads after ten idle minutes.
- **With `just serve`:** a downloaded model also appears as "In browser" in the coach settings. There you can also send only the quick questions and comments to it, and everything else to your provider.

A small model is much weaker than the cloud ones: it puts what Stockfish found into words, and the answer check (TODO 3.4) marks moves it gets wrong.

**Optional Chrome model:** `just offline-chrome` uses supported desktop Chrome's built-in model instead of the GGUF runtime. Press **Load** in the Coach tab to allow Chrome's model download/session; Chrome controls its size, storage and updates. Each reload/unload requires another explicit Load. See [setup, resource and offline limits](docs/OFFLINE.md#optional-chrome-built-in-coach). No API key is needed; the default `just offline` keeps wllama.

Add `?debug` to the URL to get `window.__kibitz` (state, `contextFor`, the analysis cache and more) in the browser console.

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
- **Live tests** (`KIBITZ_LIVE_AI=1 npm run test:live` in `site/`) send a few small requests to the providers in `.env`; they never run otherwise. For contract fixtures, first inspect `node scripts/record-ai-fixtures.mjs <provider> --plan`; recording requires `--yes` and stages successful responses privately for review. See [capture limits and review](docs/AI-FIXTURES.md).
- **`npm run check`** runs ESLint (including the script inside `index.html`) and `tsc --checkJs` over `src/`, `server/` and `scripts/`.
- **CI** (`.github/workflows/`) runs all of the above on every PR, plus `npm audit`, a gitleaks secret scan and, once the repo is public, CodeQL.
  - To use Playwright's bundled Chromium instead of Chrome, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

## Licence

Kibitz is GPL-3.0-or-later ([LICENSE](LICENSE)), as Stockfish and chessground require. The third-party components and their licences are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); chess.js is BSD-2-Clause, and the opening names come from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0).
