# Kibitz Chess Coach

Play Stockfish 19 in the browser, get your mistakes flagged as you play, ask Claude to explain positions, review finished games, keep a games library, and get reading suggestions matched to the position on the board.

Stockfish does all the calculation, locally in a Web Worker. Claude only explains: it receives the engine's lines and is told not to invent variations.

Claude url: https://claude.ai/chat/a529eba0-1588-46b2-ab42-b4f792b1d68d?artifact=9e603ff0-6c50-46b6-a1b1-80ec8e86fa65&org=02556618-dd82-41b1-950b-71fe78412f63

ChatGPT url: https://chatgpt.com/g/g-p-69a21eed60a8819192ac813ccef2b58f-chess/c/6ad712be-e674-83ed-afa7-fda0dfc3a14e

## Quick start

```bash
npm install
npm run serve            # builds dist/ and serves it with the AI gateway at http://127.0.0.1:8765/
npm test                 # AI gateway tests, then feature detection + retrieval checks (Node)
npm run test:e2e         # Playwright end-to-end tests in the installed Chrome (own server, mock AI provider)
```

## Layout

```
src/index.html        The page: CSS, markup and the app module in one file.
                      Written as an artifact body (no <html>/<head>); the build wraps it for local use.
                      /*CG_BASE*/ and /*CG_PIECES*/ are replaced with chessground's CSS at build time.
src/knowledge.js      Pure functions, no DOM:
                        positionFeatures()   opening family, pawn structures, endgame type, passed pawns…
                        moveMotifs()         fork, pin, discovered attack, mate, sacrifice, Greek gift…
                        LITERATURE           book catalog (metadata + theme tags, no book text)
                        retrieveLiterature() ranks books by theme overlap and player level
                        buildPositionIndex() / similarPositions()   "seen before" search over the library
                        winPct / classify / moveAccuracy             Lichess-style move scoring
                        parseInfo()          UCI info-line parser
src/engine.js         Engine: Stockfish worker with fallbacks, job queue, cancel by tag; rejects all jobs if it dies
src/store.js          localStorage wrapper whose set() reports failure (e.g. quota exceeded)
src/prompt.js         quote(): imported/user text goes into prompts as one-line «quoted» data
src/style.js          Stockfish's playing style (Solid … Reckless): picks among near-best candidate moves
src/play.js           Game-end rules, timeouts, clocks, the opponent's search, the weakened mode below 1320
                      Elo (calibrated), draw offers, start-position checks
src/pgn.js            NAGs: reads them from PGN movetext (chess.js drops them), glyphs for display
src/notation.js       Typed moves (SAN or coordinates) and moves in words for screen readers
data/eco/*.tsv        Lichess chess-openings dataset (CC0). Built into dist/eco.json keyed by position,
                      and dist/openings.json (every named line with its moves, for "start from an opening").
scripts/build.mjs     Copies vendored libraries, builds eco.json, inlines CSS → dist/
scripts/build-eco.mjs Opening table builder
scripts/calibrate.mjs Self-play round robin that measures the weakened levels against Stockfish's UCI_Elo
scripts/serve.mjs     Local static server (UTF-8, security headers, no dotfiles); --api mounts the AI gateway, loads ../.env
server/ai.mjs         AI gateway core: config from env, provider adapters (Anthropic SDK; openai SDK for
                      OpenAI, Mistral, Ollama), validation, error mapping, rate limit, mock provider
server/api.mjs        GET /api/ai/status, POST /api/ai/sample (NDJSON stream); Host/Origin/size guards
server/static.mjs     Security headers and the hash-based Content Security Policy for served pages
tests/unit/           node:test for engine.js, store.js, prompt.js, style.js, knowledge.js; server/*.test.mjs for the gateway
tests/e2e/            Playwright: smoke (main flows), regressions (one test per fixed bug), preferences (Elo, style),
                      play (full game, typed moves, clock, draw offers, start positions, NAGs)
eslint.config.mjs     ESLint (recommended rules; eslint-plugin-html lints the script in index.html)
tsconfig.json         tsc --checkJs over src/, server/, scripts/ (JSDoc types, no emit)
```

## How the main pieces work

**Engine.** Two Stockfish workers: `opponent` (strength-limited with `UCI_Elo` from 1320 up; below that, Skill Level 0 plus a shallow multi-PV search with random picks) and `analyst` (full strength, MultiPV 3). The `Engine` class queues jobs and cancels by tag (`live`, `review`, `move`). It tries the WASM build, then a blob-URL worker, then the pure asm.js build.

**Scoring.** Evaluations are stored from White's point of view per position (`ANA`, keyed by FEN without move counters). A move is classified by the mover's win-percentage drop: <5 good, <10 inaccuracy, <20 mistake, otherwise blunder. Engine's top choice is "best"; positions in the ECO table within 30 plies are "book".

**Similar positions.** Every library game is replayed and indexed two ways: exact position (transpositions included) and pawn-structure signature (pawns only, from ply 12). Comments in imported PGNs are attached to their positions and passed to the coach. Matching is exact; fuzzy pawn-structure distance and theme-tag ranking are the obvious next steps.

**Coach prompt.** `contextFor(i)` assembles: player level, moves so far, FEN + ASCII board, Stockfish lines in SAN, motifs, last-move rating and the engine's alternative, detected themes, retrieved books, and similar library positions. `RULES` holds the standing instructions.

## Claude platform APIs (artifact runtime)

The page runs as a Claude artifact and uses `window.claude.use(name)`:

| Capability | Used for | Outside the artifact |
|---|---|---|
| `sample`    | Coach chat, review summary, study plan | Local AI gateway (`server/`); coach hidden if it's unavailable |
| `db` + `user` | Library at `data/users/<id>/kibitz/{games,books}` (private per user) | Falls back to `localStorage` |
| `downloads` | Save .pgn files | Falls back to copying the PGN |

Published with `capabilities: {sample: {}, db: {}, user: {}, downloads: true}`; vendored files are published alongside the page (`sf.wasm` as `application/wasm`), and so are `eco.json` and `openings.json`.

Outside an artifact, `use('sample')` returns `localSample()`, a function with the same signature that streams from the local AI gateway (`/api/ai/sample`). The prompts and `contextFor()` are unchanged. The library still falls back to `localStorage`; a server-side store is planned (TODO 7.6).

Open `_test.html?debug` to get `window.__kibitz = { S, contextFor, ANA }` in the console.

## Licences

GPL-3.0-or-later; see [LICENSE](../LICENSE) and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The build copies both into `dist/`.

- Stockfish.js (Stockfish 19): GPL-3.0
- chessground: GPL-3.0-or-later
- chess.js: BSD-2-Clause
- Opening names: lichess-org/chess-openings, CC0

## Ideas queued

- Fuzzy pawn-structure similarity (square-difference distance) and theme-tag ranking in `similarPositions`
- Model tiers per call: quick tier for chips, default for chat, complex for the review summary
- Puzzles generated from your own blunders
- Clock / time controls
