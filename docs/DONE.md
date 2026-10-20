# DONE

Progress log for [TODO.md](TODO.md), newest first. Each entry gives the date, the TODO items covered, and then:
- **Implementation notes:** what was built, and where.
- **Deviations:** what differs from the plan, and why.
- **Insights:** what we learned that matters for later work.

---

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
