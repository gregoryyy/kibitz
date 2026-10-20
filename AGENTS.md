# AGENTS.md

Kibitz is a browser chess trainer. Stockfish (WASM) calculates; an AI provider (OpenAI, Mistral, Claude or Ollama) explains. The plan is in [TODO.md](docs/TODO.md) and progress is logged in [DONE.md](docs/DONE.md).

## Layout

Everything for the app is in `site/`, a single npm project. Design notes are in `site/README.md`.
- `site/src/`: the page (`index.html`, written as a Claude artifact body) and `knowledge.js`. These build into `site/dist/`; never edit `dist/`.
- `site/server/`: the AI gateway. `site/scripts/serve.mjs --api` mounts it and loads `.env` from the repo root.
- `site/tests/`, `site/server/*.test.mjs`: tests.

## Stack

Node (current LTS) and WebAssembly. Browser code is plain ES modules with chessground, chess.js and Stockfish in Web Workers; server code runs on Node. Add a dependency only when it earns its place, and only if its licence is GPL-3.0 compatible.

## Process

- The repo lives on GitHub. Never commit to `main`. Work on a feature branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`), open a PR, and merge only through the PR once CI passes.
- Keep one TODO item per branch where practical, and reference its number (e.g. `TODO 2.3`) in the PR.
- In the same PR, tick the item in TODO.md and add a DONE.md entry with implementation notes, deviations and insights.

## Tests

- Every feature ships with tests: `node:test` for logic, Playwright for UI.
- Tests use the mock AI provider; live provider tests run only when an env flag is set.
- `just test` (or `npm test` in `site/`) runs everything, after a build. For the AI gateway, use fake SDK clients or `AI_PROVIDER=mock`; never call a real provider in tests.
- `just serve`, then `just e2e` for the Playwright run.

## Security

- Before every release, run the OWASP Top 10, OWASP Top 10 for LLM Applications and ASVS checks (TODO 11) and record the results in the release PR.
- API keys stay on the server, never in the browser, the repo, logs or prompts.
- Model output, imported PGN and library text are untrusted. Never render them as HTML, and check every move and square with chess.js before showing it.

## Chess logic

- The engine calculates and the model explains. Any line the model mentions must match an engine line.
- Evaluations are stored from White's point of view, keyed by EPD (FEN without move counters).
- `knowledge.js` stays pure (no DOM, no globals) so it runs in both the browser and Node.
