# DONE

Progress log for [TODO.md](TODO.md), newest first. Each entry gives the date, the TODO items covered, and then:
- **Implementation notes:** what was built, and where.
- **Deviations:** what differs from the plan, and why.
- **Insights:** what we learned that matters for later work.

---

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
