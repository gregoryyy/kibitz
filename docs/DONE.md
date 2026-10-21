# DONE

Progress log for [TODO.md](TODO.md), newest first. Each entry gives the date, the TODO items covered, and then:
- **Implementation notes:** what was built, and where.
- **Deviations:** what differs from the plan, and why.
- **Insights:** what we learned that matters for later work.

---

## 2026-10-21 — CI: secret scan permissions

TODO items: 0.8 (fix).

### Implementation notes

- The first CI run (PR #11) failed the secret scan with a 403 before scanning anything. On a pull request, gitleaks-action lists the PR's commits through the GitHub API, and the workflow token was limited to `contents: read`. The `secrets` job now also has `pull-requests: read`, and PR comments are off (`GITLEAKS_ENABLE_COMMENTS: false`), so the token stays read-only. A finding still fails the job.

### Insights

- CI ran only on the PR into `main`. The stacked PRs #2–#10 (based on feature branches) never created a workflow run.

---

## 2026-10-20 — Eval bar: narrower, and it turns with the board

TODO items: none (a fix from use; the bar came with the prototype, 1.5).

### Implementation notes

- The bar is 8px wide instead of 30px (`.boardwrap` in `site/src/index.html`).
- With the board flipped, White's part grows from the top, so it's always on White's side. `syncBoard()` sets the `flipped` class from `S.orientation`, the same place the orientation goes to chessground, so every way of turning the board (the flip button, starting a game as Black, loading a game) updates the bar.
- Regression test in `tests/e2e/regressions.spec.mjs`: the bar is at most 10px wide, and at 50% the white part touches the bottom end, then the top end after a flip, then the bottom again. Both checks fail on the old code.

### Deviations

- The score label inside the bar is gone: a number doesn't fit in 8px. The score stays in the bar's tooltip and in the Coach tab's context line ("eval +0.3 d14").

---

## 2026-10-20 — AI provider layer: interface, structured output, models, limits, settings, contract tests

TODO items: 2.2, 2.7, 2.10, 2.14 done; 2.11 and 2.15 partly.

### Implementation notes

- **Provider interface (2.2):** every provider has `chat(messages, {model, system, maxTokens, schema, signal})`, an async generator of text chunks.
  - It returns `{truncated, usage}`. Anthropic's usage includes cached input; OpenAI and Ollama are asked for a usage chunk (`stream_options`); Mistral sends one unasked.
  - `complete()` collects a whole reply.
  - `embed(texts)` covers OpenAI, Mistral and Ollama, configured by `EMBEDDING_PROVIDER` and `EMBEDDING_MODEL` with that provider's key and Ollama host allowlist. It sends one plain POST to `/embeddings` and keeps the vectors in input order. The default models are text-embedding-3-small and mistral-embed; Ollama needs one set.
- **Structured output (2.7):** `POST /api/ai/structured {messages, format}` takes a named format (only `annotations` so far) and returns `{data, truncated, usage, mode}`.
  - The annotation schema has a short text, up to 8 arrows (from, to, kind) and up to 16 highlighted squares.
  - Anthropic gets `output_config.format` (json_schema). OpenAI, Mistral and Ollama get `response_format` (json_schema, strict).
  - Keywords that strict modes reject (lengths, patterns, item counts) are left out of what the provider sees and enforced by our own validator (`server/schema.mjs`).
  - If the provider rejects the format (400/422) or the reply doesn't validate, the request is retried once with the schema in the instructions, and the JSON is parsed out of the text (code fences, surrounding prose).
- **Models per task (2.10):** `quick` (the quick-question chips), `chat` (typed questions, flags) and `review` (game summary, study plan).
  - `<PROVIDER>_MODEL_QUICK` and `_MODEL_REVIEW` fall back to `<PROVIDER>_MODEL`.
  - The page names the task in each request. Unknown tasks are refused, and the artifact host's `sample()` doesn't get the option.
- **Limits (2.11):** `server/usage.mjs` counts requests and tokens per day.
  - `AI_TOKEN_BUDGET_PER_DAY` refuses requests with `budget_exceeded` (429) once it's used up.
  - `AI_PRICES` gives per-model prices for a cost estimate. Models without a price are counted in tokens only, and a day with no priced model shows no cost rather than $0.
  - The status endpoint reports today's usage.
- **Settings (2.14):** a "Coach settings" panel in the Coach tab, shown only with the local gateway.
  - You can switch among the providers `.env` sets up; unavailable ones are disabled and say why.
  - It shows the model per task.
  - Local-only mode is enforced on the server: only Ollama or the mock, with Ollama taking over if it's set up. `AI_LOCAL_ONLY` makes it the default.
  - "Test connection" sends a 256-token request and reports provider, model and time.
  - It shows today's usage.
  - `POST /api/ai/config` and `/api/ai/test` have the same origin, host and content-type checks as the other routes. Changes last until the server restarts.
- **Contract tests (2.15):** the real Anthropic and OpenAI SDK clients get a `fetch` that replays `server/fixtures/*.json`, so the tests cover the SSE wire format, the SDKs' parsing and our adapters together. They check the requests we send too.
  - `scripts/record-ai-fixtures.mjs <provider>` records real responses: two small requests per provider, keeping only status, content type and body. Headers are dropped because they carry account ids; the request isn't kept because it carries the key.
  - The Claude chat and annotation fixtures are recorded: 73 and 943 tokens on claude-haiku-5-5.
  - OpenAI, Mistral, Ollama and the error responses are hand-written from the documented format, and marked so in the file.
  - `server/live.test.mjs` runs a chat and an annotation request per provider, only with `KIBITZ_LIVE_AI=1` (`npm run test:live`).
- The Playwright server now blanks the provider keys it inherits from the shell, so no test can reach a real provider. One key in the shell environment was visible to the test server before this; no test used it.

### Deviations

- **No `stream` flag on `chat()`:** it always streams, and `complete()` collects the reply when a caller wants it whole.
- **Structured output uses JSON-schema output, not tool calling**, on every provider. It's the same mechanism everywhere, and no tool is involved.
- **Formats are named on the server.** The page can't send its own schema, which keeps model output bounded to what the server validates.
- **No built-in price list.** Prices change and I couldn't verify current ones, so cost needs `AI_PRICES`.
- **Usage, the budget and settings changes live in memory** and reset when the server restarts.
- **2.11 per-user limits and 2.9's per-user key store** wait for accounts (10.1).
- **2.15 stays open** until OpenAI, Mistral and Ollama fixtures are recorded.

### Insights

- **Claude's structured output accepts the stripped annotation schema natively.** The recorded reply validated first time, so the fallback is for the OpenAI-compatible servers whose models can't do JSON schema.
- **Strict JSON-schema modes reject some constraints.** Two layers keep it portable: what the provider sees, and what we enforce.
- **Replaying at the `fetch` level catches more than fake clients.** It covers the SDKs' own stream parsing and error classes; the fake-client unit tests stay for edge cases that are hard to record.

## 2026-10-20 — Milestone 1: play against the engine

TODO items: 1.3, 1.4 (partly), 1.6, 1.7, 1.8, 1.9, 1.11, 1.12; 6.8 added.

### Implementation notes

- **`site/src/play.js`** holds the playing rules as pure functions, unit-tested in Node:
  - `gameEnd`: checkmate, stalemate, threefold repetition, insufficient material, fifty-move rule.
  - `timeoutEnd`: a timeout loses, unless the other side has no mating material.
  - Clocks.
  - The opponent's search settings, and `pickWeak` for the weakened mode below 1320.
  - `acceptsDraw`.
  - `checkStart` and `fixCastling` for start positions.

  The inline code they replace in `index.html` is gone.
- **Clock (1.6):** time controls 3+2, 5+3, 10+5, 15+10 and 30+20, with Fischer increment.
  - White's first move isn't timed: it starts Black's clock.
  - Every move stores both clocks, so a take-back restores them.
  - Stockfish thinks within its own time: a thirtieth of what's left plus three quarters of the increment, never more than untimed.
  - A 100 ms tick checks for flag fall. The PGN gets `TimeControl`, and `Termination "time forfeit"` after a timeout.
- **Draw offers (1.7):** an "Offer draw" button. Stockfish evaluates the position at depth 12–16 and accepts if it is at least a pawn worse, or after move 30 when the evaluation is within 0.3. After a refusal the next offer has to wait 5 moves.
- **Start positions (1.8):** the Game tab has "Start from", with three options:
  - the standard position;
  - an opening, searched by name or ECO code in `openings.json`, which the build writes from the Lichess data (3,865 lines, 366 KB, loaded only when needed);
  - a FEN, checked before the game starts and explained when it fails: invalid, side not to move in check, game already over.

  The opening's moves are set up as the first moves of the game; take-backs and draw offers count from there. Stockfish moves first if it is to move.
- **NAGs (1.9):** chess.js parses NAGs but doesn't expose them, so `site/src/pgn.js` reads them from the movetext.
  - It reads both suffixes (`!?`) and `$n`, and skips variations, comments, escape lines and headers.
  - The move list shows the glyphs when there is no engine verdict for the move.
  - Export writes `$n`, including the engine's verdicts (`$6`, `$2`, `$4`) when annotating; it used to append `?!` to the SAN.
- **Keyboard and screen readers (1.11):**
  - A move box under the board takes SAN, loose SAN (`nf3`, `Bf7` for `Bxf7+`, `0-0`) and coordinates (`e2e4`, `e7e8q`). Ambiguous or illegal input is explained, never guessed.
  - Every move is announced in a polite live region ("You played knight f3.", "Stockfish played e takes d5, check."), and so is navigation through the moves.
- **Tests (1.12):**
  - Rule edge cases: threefold with changed castling rights, the fifty-move boundary, insufficient material, en passant timing, castling through check, under-promotion.
  - Playwright: a full game from a position played by typed moves to checkmate, then saved and reviewed; the clock with a faked timer, ending in a loss on time; draw offers declined and accepted; opening and FEN starts; a NAG round trip.
- **Multi-threaded Stockfish (1.3):**
  - Every response now sends `Cross-Origin-Embedder-Policy: require-corp`, plus `Cross-Origin-Resource-Policy: same-origin` for our own files. Together with COOP, this makes the page cross-origin isolated.
  - When it is isolated, the analyst runs the lite multi-threaded build (`sf-mt.js`/`.wasm`, 1.7 MB) with up to 4 threads (cores − 1), and the engine status shows the thread count.
  - The opponent stays on one thread, so its strength matches the calibration.
  - Without isolation (e.g. an artifact host that drops COEP), or if the threaded build fails, the single-threaded build starts as before.
- **Analysis searches are capped at 5 s** (`go depth N movetime 5000`). A capped entry remembers the depth it was asked for (`capDepth`), so the position isn't searched again on every visit.
- **Calibration (1.4, partly):** `site/scripts/calibrate.mjs` plays a round robin between the weakened levels below 1320 and Stockfish's UCI_Elo 1320 anchor.
  - It runs the lite single-threaded engine in child processes and uses the page's own search settings (`opponentSearch`, `pickWeak`).
  - Openings and colours alternate, the random numbers are seeded, and games over 300 plies count as draws.
  - It fits ratings by maximum likelihood with the anchor fixed. Three runs of 360–420 games took 11–13 minutes each on 6 cores.

  | Setting | Run 1 (old table) | Run 3 (new table) |
  |---|---|---|
  | 600 | 469 | 557 |
  | 800 | 773 | 874 |
  | 1000 | 1298 | 977 |
  | 1100 | – | 1201 |
  | 1200 | 1536 | 1141 |
  | 1300 | 1655 | 1369 |

  The new table in `play.js` uses search depth 1 up to 1100 and depth 3 above, never 5. It was interpolated from runs 1 and 2.

### Deviations

- **1.4 stays open.** Below 1320 the levels are now aligned with Stockfish's UCI_Elo scale. That scale is calibrated against engine rating lists, not human ratings, and the 1320+ levels run at our short think times with the lite network. Tying the slider to human ratings needs results from real players, e.g. from the weakness tracking in 9.2.
- **1.8:** starting from a curriculum position moved to 6.8, because there is no curriculum yet. `newGame` already starts from any FEN or move list.
- **Draw offers only go one way:** Stockfish never offers a draw itself.
- **Timeout draws use a simplified rule:** a lone king, or a king and one minor piece against a lone king, can't mate. FIDE asks whether any legal sequence mates, which is rarely different in practice.
- **No `[%clk]` comments in the PGN**, only the `TimeControl` tag.

### Insights

- **Search depth dominates the weakened mode.** Depth 1 → 3 → 5 changed strength by hundreds of Elo, far more than the "keep the best move" chance. The old table's depth 5 from 1100 up made 1300 stronger than 1320. Calibrate whenever these knobs change: the script takes about 12 minutes.
- **The calibration's noise is about ±70 Elo per level** at 120 games. 1100 came out above 1200 in run 3, although 1200 searches at the same depth and keeps the best move more often. More games would narrow this; the ordering is right in expectation.
- **MultiPV can explode in won positions.** On a mate in one whose alternatives lose, MultiPV 3 at depth 16 took 8 s single-threaded and over 30 s with 4 threads; with MultiPV 1 it takes 0.3 s. The time cap bounds it. On normal positions, 4 threads reach depth 16 about 30–45% faster.
- **chess.js keeps castling rights without a rook** and then generates O-O-O in `4k3/8/8/8/8/8/8/4K2R w KQkq`. Every pasted FEN now goes through `fixCastling`.
- **chess.js parses NAGs but drops them**, so `pgn.js` re-reads the movetext. Its ply count is tested against chess.js's history so the two can't drift apart.

## 2026-10-20 — Foundation: tooling, CI, licence

TODO items: 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 0.10. Milestone 0 is complete.

### Implementation notes

- **Node:** `.nvmrc` pins Node 24, the current LTS; `engines` asks for `>=24`. CI reads `.nvmrc`.
- **Types (0.4):** JS with JSDoc, checked by `tsc --checkJs` (TypeScript 7) through `site/tsconfig.json` and `npm run typecheck`. It covers `src/*.js`, `server/` and `scripts/`, not tests. Non-strict for now. Seven findings were fixed with inline JSDoc types; all were inference gaps (destructured options with `= {}` defaults, a mixed-type rules table), not bugs.
- **Lint (0.5):** ESLint 10 with the recommended rules, in `site/eslint.config.mjs`. `eslint-plugin-html` lints the module script inside `index.html`, which holds most of the page's code. Four findings were fixed: two unused variables and a needless escape in `knowledge.js`, plus an intended control-character regex in `prompt.js`, now marked with a reasoned disable comment. `npm run check` runs lint and types, and so does `just check`.
- **Knowledge tests (0.7):** `tests/knowledge.test.mjs` printed results; `tests/unit/knowledge.test.mjs` now asserts them in 14 tests covering EPD and pawn signatures, material, opening families, features for the Najdorf, IQP, Carlsbad, Lucena and opposite-bishop positions, book retrieval (ranking, chapter pointers, the user's own books), motifs (mate, back-rank, Greek gift, fork, pin, sacrifice, quiet moves, bad input), similar positions (exact, then structure), and the engine maths. The tests pass the opening name directly, so they no longer need `dist/eco.json`. Unit tests: 72.
- **CI (0.8):** `.github/workflows/ci.yml` runs on every PR and on `main`, in three jobs:
  - lint, types, build, unit tests and `npm audit --audit-level=high`;
  - the Playwright tests in Playwright's Chromium, uploading traces on failure;
  - gitleaks over the full history.

  `codeql.yml` runs CodeQL (JavaScript and Actions, `security-extended`) on PRs, on `main` and weekly. Every action is pinned to a commit SHA, picked from releases at least two weeks old, and the workflow token is read-only.
- **PR template (0.9):** `.github/pull_request_template.md` asks for the TODO number and has three checklists: tests, TODO/DONE and dependency licences, and the security rules from AGENTS.md.
- **Licence (0.10):** `LICENSE` holds the GPL-3.0 text, and `package.json` says `GPL-3.0-or-later`. `THIRD_PARTY_NOTICES.md` lists the following, with chess.js's BSD notice in full:
  - what ships in `dist/`: Stockfish.js, chessground, the cburnett pieces, chess.js and the Lichess opening data;
  - what the page loads: Google Fonts;
  - what the server uses: the Anthropic and OpenAI SDKs.

  The build copies both into `dist/` (`LICENSE.txt` so it is served as text).
- **`.editorconfig`** matches the existing style: UTF-8, LF, 2 spaces, tabs in the ECO data.

### Deviations

- **No npm workspaces (0.3).** Splitting `site/` into `client`, `server` and `shared` would move every file and the build paths, for no gain yet: the server doesn't import `knowledge.js`, and when it needs to, a relative import works. One project keeps one lockfile and one install. Revisit when the server needs its own deployable package (TODO 12).
- **No Prettier (0.5).** The code is written densely on purpose: one-line guards and short bodies on one line. Prettier at 120 columns turned the 2,136 lines in `src/` into 5,142 and touched nearly every line. ESLint checks correctness; `.editorconfig` covers whitespace.
- **CodeQL is skipped while the repo is private.** Code scanning on private repos needs GitHub Advanced Security. The job has `if: !github.event.repository.private`, so it starts working once the repo is public. Secret scanning uses gitleaks instead of GitHub's own, for the same reason; gitleaks-action is free for personal accounts.
- **E2E in CI uses Playwright's Chromium**, set with `PW_CHANNEL=chromium`. Locally the tests still use the installed Chrome.

### Insights

- **Most of the code sits outside `tsc`'s reach.** The inline module script in `index.html` holds most of the logic and isn't type-checked, only linted. Moving logic out into `src/*.js` modules, as was done for `engine.js`, `store.js`, `prompt.js` and `style.js`, brings it under both checks and unit tests.
- **Before the CI secret scan, the history was checked for key-like strings** (`sk-ant-…`, `sk-…`, `*_API_KEY=<value>`) and `.env` was confirmed never committed. Nothing was found.
- **Pinning actions to SHAs** blocks a moved tag from changing CI, the usual supply-chain hole in GitHub Actions. Updates need a bump: Dependabot for actions comes with TODO 11.5.

## 2026-10-20 — Stockfish playing style

TODO items: 1.13 (added).

### Implementation notes

- The Game tab has a **Stockfish style** choice next to the existing Elo slider (600–2800): Solid, Balanced (default), Active, Aggressive, Reckless. Both are saved with the other settings.
- The style shows next to Stockfish's name ("≈1400 · aggressive"). It goes into the coach's context and into saved games, and survives a restore.
- `site/src/style.js`:
  - `aggressionScore()` rates a move for the side playing it. Checks, captures, sacrifices, tactics (from `moveMotifs`), pieces heading for the enemy king and pawn storms score up; retreats score down.
  - `pickStyled()` chooses among Stockfish's candidate lines. Only moves within the style's window of the move Stockfish would play are allowed: Solid 0.2, Active 0.25, Aggressive 0.5, Reckless 1.2 pawns. The style's weight decides among them; Solid prefers the lowest score.
- With a style other than Balanced, the opponent search asks for 4 lines (MultiPV 4) instead of 1.
- Tests: 8 unit tests on a fixed Italian Game position, and 4 Playwright tests. The Playwright tests check that both settings persist, that the UCI commands sent to the worker ask for 4 lines only when a style is set, and that Stockfish replies below 1320 Elo.

### Deviations

- **Style isn't a Stockfish option.** Stockfish 19's UCI options were checked directly: Skill Level, UCI_LimitStrength and UCI_Elo (minimum 1320), with no Contempt or aggressiveness setting. So style is a choice among Stockfish's candidate moves, made after the strength limit.
- **Choice groups wrap on narrow screens.** `.choice` now wraps and draws dividers as 1 px gaps, so five buttons fit a phone. Desktop looks the same as before (`width: fit-content`).

### Insights

- **Strength first, then style.** The window is measured from the move Stockfish would play under its Elo limit, not from the best move. So a style changes how Stockfish plays, not how strong it is, and a forced mate is never given up: a mate outranks any centipawn line by far more than any window.
- **Stockfish already searches several lines when strength-limited.** With `Skill Level` or `UCI_LimitStrength` on, it searches at least 4 lines internally to choose its weaker move. So the move it plays is normally among the reported lines, and asking for 4 costs little extra.
- **The aggression score is a heuristic, not tuned on real games.** It works on the test positions, and Reckless does choose sacrifices. Whether players feel the difference is worth checking during the Elo calibration (TODO 1.4).

## 2026-10-20 — Fixes from the code review: bugs and security

TODO items: 0.6, 8.7, 11.3.1 done; 1.12, 2.1, 10.5 partly.

### Implementation notes

The 2026-10-20 review of `site/src` found 25 issues. Each fixed bug now has a Playwright regression test that fails on the pre-fix page; this was checked by running the tests against a build of the last commit (`E2E_DIST`).

**Bugs fixed:**
- **Review crashed when the game changed mid-run.** It snapshots the position FENs, stops with a message when the game changes, and resets its UI in `finally`. It never classifies or saves the wrong game.
- **A failed or crashed engine froze the game.** The Engine moved to `src/engine.js`. A failed start or crash rejects every waiting job, and later jobs fail at once. The engine reply, hint, analysis and coach all recover, and the status shows the failure.
- **Full browser storage still said "Saved".** `src/store.js` reports failure; library writes are undone and reported.
- **The engine could play for the user.** This happened after a quick take-back, and a stale reply could also clear a newer reply's `thinking` flag. Replies now check the turn and carry a token.
- **The coach could use a game the user had left.** It checks the game generation and FEN after its analysis; the prompt is built inside `try`. It also has its own analysis tag, so moving around the board doesn't cancel it.
- **The hint could draw on the wrong position.** It now checks the position before drawing, and has its own analysis tag.
- **Restoring a game could lose it or stall it.** A failed PGN restore now says so and starts a new game; the Elo is restored, and if Stockfish was to move, it moves.
- **Saves during library loading could wipe the local library.** Library writes now wait for loading to finish.
- **Silent failures:** a failed opening-table load, losing the cloud library, and failed reference saves or deletes are now reported.
- **Smaller fixes:**
  - Restored mate scores come back as mates instead of +20.
  - A draw (0) was treated as "not over".
  - Move labels for games that start from a FEN with Black to move were wrong.
  - Named constants for the opening and book ply limits.

**Security fixes:**
- **Prompt injection (LLM01).** PGN headers and comments, and the player's own references, go into prompts only through `quote()` (`src/prompt.js`). It produces one line in «guillemets», with control characters and inner guillemets removed and the length capped. The coach's rules say quoted text is data.
- **Static server hardening.**
  - A hash-based Content Security Policy for HTML: inline scripts by hash only, no plugins, no framing, `base-uri 'none'`, and `connect-src 'self'`.
  - `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy` and `Permissions-Policy` on every response.
  - Dot-paths such as `/.env` are never served.
  - Header logic lives in `server/static.mjs`, with tests.

**Performance and accessibility:**
- PGN import saves in one write and re-indexes once; the position cache is keyed by game and pruned.
- The Reading and Library panes render only while visible.
- Tabs follow the ARIA tabs pattern (`tabpanel`, `aria-controls`, arrow keys, Home and End). Focus stays in the move list across re-renders. The chat is marked busy while streaming, so screen readers announce the answer once.

**Tests:**
- 50 `node:test` unit tests. New ones cover the engine queue with a fake worker, storage, prompt quoting and security headers.
- 12 Playwright tests in the installed Chrome, replacing `tests/e2e.py`. Every one also fails on uncaught errors and CSP violations.

### Deviations

- **Not fixed:**
  - Keyboard move entry (TODO 1.11).
  - PGN comments are still keyed by position, so repeated positions share one comment.
  - `renderAll` still recomputes more than it needs to (only the hidden panes are skipped).
  - Most of the inline script is still one module; only the engine, storage and prompt helpers moved out.
- **`RULES` stays a user turn,** so the page keeps working with the artifact's `sample()`, which has no system role. The quoting carries the protection.
- **COEP is not sent,** because it would need CORP headers on every resource; it's only needed for multi-threaded Stockfish (TODO 1.3).

### Insights

- **chessground ignores untrusted (synthetic) mouse events** unless `trustAllEvents` is set. UI races are better reproduced with Playwright's fake clock (`page.clock`): it froze the 60 ms before the engine's reply, so the take-back race failed reliably on the old code.
- **The mock provider made the prompt-injection test cheap:** the test intercepts the request to `/api/ai/sample` and checks exactly what the model would receive.
- **A file-writing tool turned the escapes ` `/` ` into the literal characters.** Inside a regex literal those are line terminators, which broke parsing. Keep such escapes ASCII and check with `node --check`.

## 2026-10-20 — One app folder: `site/`

TODO items: 0.2 (decided: merge), 0.11.

### Implementation notes

- `claude/` became `site/` (git rename, history kept), and `server/` and `scripts/serve.mjs` moved into it. One `site/package.json` now holds the chess libraries and the AI SDKs. `npm test` runs the gateway tests and the knowledge check; `npm run serve` uses the Node server with the gateway instead of Python.
- `site/src/index.html` got the gateway client from `codex/index.html` (`localSample()`, the coach-off notice, two error messages). The built `site/dist/_test.html` matches the old `codex/index.html` except for the host's base `<style>` and the `just serve` wording.
- The justfile is down to `serve`, `test`, `e2e`, `build`, `build-eco` and `clean`, with `KIBITZ_PORT`/`KIBITZ_HOST`. `.env` stays at the repo root; the server finds it with `--env`.
- `.gitignore` uses `**/tests/out/`, so e2e screenshots under `site/` are ignored.
- `codex/README.md` (notes from the ChatGPT chat) moved to `docs/codex-notes.md`.

### Deviations

- **No `client`/`server`/`shared` workspaces (TODO 0.3).** One npm project is enough while the client has no build beyond copying files. 0.3 stays open for when that changes.
- **The old `codex/` copy and the root `package.json` are left on disk** for the user to delete. The tool's permission rules blocked the deletion, and `site/` replaces both.

### Insights

- `codex/` never held a separate implementation. Apart from the gateway client added on 2026-10-20, it was `claude/`'s build output, byte for byte. Committing build output as a "variant" made one codebase look like two; a real comparison would need both agents to work from the same task description.
- `codex/index.html` had been saved from the artifact host, so it carried the host's base CSS. The page's own CSS already covers what matters locally (`[hidden]`, `box-sizing`), so the build doesn't need it.

## 2026-10-20 — AI gateway, wired into `codex/`

TODO items: 2.3, 2.4, 2.5, 2.6, 2.8, 2.12, 2.13 done; 2.1, 2.9, 2.11 partly.

### Implementation notes

- `server/ai.mjs`: settings from env, one adapter per provider, request validation, error mapping and a rate limiter. Claude goes through `@anthropic-ai/sdk`; OpenAI, Mistral and Ollama share one adapter on the `openai` SDK, since all three serve the chat-completions protocol. `AI_PROVIDER=mock` streams canned replies for offline work.
- `server/api.mjs`: `GET /api/ai/status` and `POST /api/ai/sample`, which streams NDJSON lines (`{"text"}`, then `{"done","truncated"}` or `{"error"}`). Mounted by `scripts/serve.mjs --api`, which loads `.env` at startup; `just codex` uses it.
- `codex/index.html`: outside an artifact, `use('sample')` now returns a function with the same signature as the artifact's `sample()` that calls the gateway, so the coach chat, review summary and study plan work unchanged. When the gateway reports the provider unavailable, the coach notice gives the reason (e.g. which key is missing).
- Defaults are the small models: `claude-haiku-5-5`, `gpt-6-luna`, `mistral-small-latest`, with `ANTHROPIC_EFFORT=medium`. Larger Claude models also get the server-side refusal fallback; Haiku has none.
- Tests: 31 `node:test` cases in `server/` (fake SDK clients, no network). Also checked in headless Chrome over CDP: a question typed into the coach gets a streamed reply with `mock`, Opus 5.5 and Haiku 5.5. The coach-off notice shows the reason.

### Deviations

- **NDJSON over `fetch` instead of SSE (2.8).** `EventSource` can't POST a body, and a JSON-lines stream over `fetch` gives cancellation through `AbortController` for free.
- **Only `codex/` uses the gateway.** `claude/` is unchanged, and its `just claude` server doesn't load the keys.
- **Not done yet:** CSP/COOP/COEP headers (2.1), per-user key store (2.9), token budgets and cost display (2.11), structured output for board annotations (2.7).

### Insights

- **The gateway is a spending proxy, so it needs browser-side guards even on localhost.**
  - Any website can POST to `127.0.0.1`, which is why the gateway requires JSON and checks `Origin`.
  - DNS rebinding can make a page from another site look local. Requiring `Host` to be `localhost` or an IP literal blocks that, because rebinding only works under a host name.
  - Both are covered by tests (OWASP A01, LLM10).
- **Live checks found account problems, not code problems.** The OpenAI key was rejected (401). The Mistral key was refused `mistral-large-latest` by subscription tier (403), then rate-limited (429). A 403 doesn't necessarily mean a bad key, so `auth_failed` now says "check the key and that your plan includes the model".
- **Haiku 5.5 gave coaching as good as Opus 5.5 on a simple question**, at a fraction of the cost. The engine supplies the hard part. This supports small models by default; worth confirming on harder positions with the tutor eval set (3.8).
- **Newer Node treats `node --test <dir>` arguments as file patterns,** so the test script needs a glob.

## 2026-10-20 — AI provider settings

TODO items: groundwork for 2.3–2.6, 2.11, 2.12 and 8.3.

### Implementation notes

- `.env.example` (committed) is the template; `.env` (git-ignored, mode 600) holds the real keys. Settings: `AI_PROVIDER`, plus a key, model and optional base URL for Anthropic, OpenAI, Mistral and Ollama; an Ollama host allowlist; an embeddings provider and model; output, timeout and rate limits.
- Nothing reads the file yet. The Node server should load it (e.g. `node --env-file=.env`). The `justfile` deliberately doesn't load it, so keys never reach the static dev servers.

### Deviations

- TODO 8.3 assumed embeddings come from the selected chat provider. Anthropic has no embeddings API, so embeddings now have their own provider setting.

### Insights

- Model IDs move fast. Between planning and this entry, OpenAI's docs moved the flagship from GPT-5.6 to `gpt-6-astra`, and Mistral's `-latest` aliases are repointed regularly. Keep model IDs in config, never in code, and have the connection test (TODO 2.14) report which model actually answered.

## 2026-10-20 — Local dev server and justfile

TODO items: none directly; dev tooling that later supports 1.3 and 2.1.

### Implementation notes

- `justfile` at the repo root: `just claude`, `just codex`, `just both`, plus `build`, `test`, `e2e <variant>` and `clean`.
- `scripts/serve.mjs`: a dependency-free Node static server used by the `just` recipes. It sends `charset=utf-8` on every text type, serves only files inside the chosen folder (symlinks included), answers only GET and HEAD, and binds to `127.0.0.1` by default. An `--index` option lets `/` on `claude/dist` serve `_test.html`.

### Deviations

- Local serving moved from `python3 -m http.server` to Node for the `just` recipes, in line with the Node stack. `npm run serve` in `claude/` still uses Python.

### Insights

- Python's `http.server` sends `text/html` without a charset. `claude/dist/index.html` is the bare artifact body with no `<meta charset>`, so Chrome decoded it as Windows-1252 and every `≈`, `…` and `·` came out garbled. `/_test.html` and `codex/` were fine because they declare their charset. Any server we ship should set the charset in the header and not rely on the markup.
- Having our own server makes it easy to add COOP/COEP later, which multi-threaded Stockfish needs (TODO 1.3).

## 2026-10-20 — Planning baseline

TODO items: 5.1 (already done); plan, AGENTS.md and CLAUDE.md created.

### Implementation notes

The starting point is a working prototype that runs as a Claude artifact. `claude/` holds its source (npm build into `dist/`); `codex/` is a flat, prebuilt copy. What the prototype already has, marked *(prototype)* in TODO.md:

- Play against Stockfish 19 (WASM, with blob-URL and asm.js fallbacks), with strength set by `UCI_Elo` and a weakened mode below 1320
- A separate full-strength analyst engine (MultiPV 3); engine jobs queued and cancelled by tag
- Lichess-style move classes based on win-% drop, an accuracy score, and an eval graph in the post-game review
- Pure chess knowledge in `knowledge.js`: position features, motif detection, a book catalog with theme retrieval, and similar-position search by EPD and pawn structure
- Coach chat, a review summary and a study plan, all through the Claude artifact runtime (`window.claude.use('sample')`)
- Games library (artifact `db`, falling back to `localStorage`), PGN import and export
- Opening names from the Lichess chess-openings dataset (CC0)
- Mobile layout and dark mode

### Deviations

- **The AI layer moves to a Node server.** The prototype calls Claude only, through the artifact runtime. Supporting several providers means API keys have to live on a server, so TODO milestone 2 adds a Node gateway. The artifact runtime becomes one optional deployment target rather than the base.
- **The scope goes beyond the brief.** Milestones 9 to 12 and the items tagged *(added)* were proposed during planning. Typical examples: output validation, eval sets, the SSRF guard, spaced repetition and accessibility.

### Insights

- `codex/` started as a byte-identical copy of the `claude/` build output: same app code and `knowledge.js`, with chessground CSS inlined. Any difference between the two from here on is new work.
- Multi-threaded Stockfish needs `SharedArrayBuffer`, which needs cross-origin isolation (COOP/COEP headers). That constrains server headers and any third-party embeds, so it should be settled early (TODO 1.3, 2.1).
- Imported PGN comments already flow into the coach prompt. That is an indirect prompt-injection path (TODO 8.7, 11.3.1).
- A user-configurable Ollama base URL lets the server be pointed at internal addresses (SSRF), so it needs an allowlist (TODO 2.12).
- `knowledge.test.mjs` prints results but asserts nothing, so it can't catch regressions (TODO 0.7).
- `.gitignore` patterns containing a slash are anchored to the repo root: `tests/out/` stopped matching after the move to `claude/` (TODO 0.11).
