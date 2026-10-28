# AGENTS.md

Kibitz is a neurosymbolic chess coach in the browser. Stockfish (WASM) plays and measures; an AI provider (OpenAI, Mistral, Claude or Ollama) explains. The plan is in [TODO.md](docs/TODO.md), ideas beyond it are in [ROAD.md](docs/ROAD.md), and progress is logged in [DONE.md](docs/DONE.md).

## Layout

Everything for the app is in `site/`, a single npm project. The architecture is explained in `docs/ARCH.md`; design notes are in `site/README.md`.
- `site/src/`: the page (`index.html`, written as a Claude artifact body) and ES modules grouped under `chess/`, `coach/`, `curriculum/`, `library/`, `openings/`, `player/` and `platform/`. The build preserves these directories in `site/dist/`; never edit `dist/`.
- `site/server/`: the AI gateway and optional private SQLite library. `site/scripts/serve.mjs --api` mounts the gateway and loads `.env`; independent `--library FILE` enables server storage outside the static tree. Private `.kibitz-data/` files stay out of Git.
- `site/tests/`, `site/server/*.test.mjs`: tests.
- `utils/`: repository utilities, including PDF styles and Mermaid support in `utils/pdf/`.
- `docs/`: only `TODO.md`, `DONE.md`, `ROAD.md` and `ARCH.md` at the top. Everything else is lowercase, in `docs/guide/` (users and operators), `docs/design/`, `docs/security/`, `docs/releases/`, `docs/incidents/`, `docs/eval/`, `docs/research/`, `docs/primer/` or `docs/flipbook/`. A new feature or TODO item gets a section in an existing file and a DONE entry, not a new file.

## Stack

Node (current LTS) and WebAssembly. Browser code is plain ES modules with chessground, chess.js and Stockfish in Web Workers; server code runs on Node. Add a dependency only when it earns its place, and only if its licence is GPL-3.0 compatible.

## Process

- The repo lives on GitHub. Never commit to `main`. Work on a feature branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`), open a PR (the template has the checklist), and merge only through the PR once CI passes.
- Keep one TODO item per branch where practical, and reference its number (e.g. `TODO 2.3`) in the PR.
- In the same PR, tick the item in TODO.md and add a DONE.md entry with implementation notes, deviations and insights.

## Tests

- Every feature ships with tests: `node:test` for logic, Playwright for UI.
- `just check` (or `npm run check` in `site/`) runs ESLint and `tsc --checkJs`; it must pass. Types are JSDoc, not TypeScript.
- Tests use the mock AI provider; live provider tests run only when an env flag is set.
- `just test` (or `npm test` in `site/`) runs the unit tests, after a build. For the AI gateway, use fake SDK clients or `AI_PROVIDER=mock`; never call a real provider in tests.
- `just e2e` (or `npm run test:e2e` in `site/`) for the Playwright tests in `site/tests/e2e/`. A bug fix comes with a regression test there that fails on the old code.

## Security

- Before every release, run the OWASP Top 10, OWASP Top 10 for LLM Applications and ASVS checks (TODO 11) and record the results in the release PR.
- API keys stay on the server, never in the browser, the repo, logs or prompts.
- Model output, imported PGN and library text are untrusted. Never render them as HTML, and check every move and square with chess.js before showing it.
- Imported or user-written text (PGN headers and comments, the player's references and notes) goes into prompts only through `quote()` from `site/src/coach/prompt.js`.
- Async work (engine, coach, review) must check that the game is still the one it started for (`S.gen`, or the position's FEN) before applying results.

## Chess logic

- The engine calculates and the model explains. Any line the model mentions must match an engine line.
- Evaluations are stored from White's point of view, keyed by EPD (FEN without move counters).
- `knowledge.js` stays pure (no DOM, no globals) so it runs in both the browser and Node.
