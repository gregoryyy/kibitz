# TODO

Plan for Kibitz, a browser chess trainer. Stockfish (WASM) calculates; a choice of AI providers (OpenAI, Mistral, Claude, Ollama) explains. Progress, deviations and learnings are logged in [DONE.md](DONE.md).

Status: `[ ]` open, `[x]` done. Tags:
- *(prototype)*: a working version exists in `claude/` and `codex/`, but still has to be moved into the target architecture.
- *(added)*: not in the original brief; proposed during planning.

## Target architecture

- **Browser client:** chessground board, chess.js rules, and Stockfish 19 WASM in Web Workers (an opponent and an analyst). Single-threaded by default; multi-threaded when the page is cross-origin isolated.
- **Node server:** serves the app and sets security headers. It also runs the AI gateway (one adapter per provider, keys kept server-side), stores library and user data, and handles RAG retrieval.
- **Shared module:** pure chess knowledge (features, motifs, scoring, retrieval), used by both client and server (today's `knowledge.js`).

---

## 0. Foundation and process

- [ ] 0.1 Create the GitHub repo, push `main`, and protect it (PRs required, CI must pass, no force pushes)
- [x] 0.2 Decide the target layout: evolve `claude/` and `codex/` in parallel, or merge them into one app folder. Record the decision in DONE.md. (Merged into `site/`.)
- [ ] 0.3 Set up npm workspaces (`client`, `server`, `shared`) and pin Node LTS (`.nvmrc`, `engines`)
- [ ] 0.4 Decide on typing: JS + JSDoc checked by `tsc --checkJs`, or TypeScript
- [ ] 0.5 Add linting and formatting (ESLint, Prettier)
- [ ] 0.6 Set up the test harness: `node:test` for unit tests, `@playwright/test` for e2e (port `claude/tests/e2e.py` to JS)
- [ ] 0.7 Turn `knowledge.test.mjs` into real assertions; today it only prints output
- [ ] 0.8 GitHub Actions on every PR: lint, unit, e2e, build, `npm audit`, CodeQL, secret scanning
- [ ] 0.9 PR template with a checklist: tests, TODO/DONE updated, security impact
- [ ] 0.10 Licensing: GPL-3.0 (required by Stockfish and chessground), `LICENSE` file, third-party notices
- [x] 0.11 Fix `.gitignore`: `tests/out/` only matches at the repo root; use `**/tests/out/`

## 1. Play against the engine

- [ ] 1.1 Board UI: legal moves, promotion, flip, coordinates *(prototype)*
- [ ] 1.2 Stockfish 19 WASM worker with blob-URL and asm.js fallbacks *(prototype)*
- [ ] 1.3 Multi-threaded Stockfish when cross-origin isolated (server sends COOP/COEP headers), with a single-threaded fallback
- [ ] 1.4 Strength levels: `UCI_Elo` from 1320 up, a weakened mode below that *(prototype)*; calibrate them against real ratings
- [ ] 1.5 Separate analyst engine (full strength, MultiPV) *(prototype)*
- [ ] 1.6 Time controls and clock *(added)*
- [ ] 1.7 Takeback, hint, resign *(prototype)*; draw offers; every game-end rule (threefold repetition, 50-move rule, insufficient material)
- [ ] 1.8 Start from a FEN, an opening, or a curriculum position
- [ ] 1.9 PGN import and export with comments and NAGs *(prototype)*
- [ ] 1.10 Post-game review: eval graph, move classes, accuracy *(prototype)*
- [ ] 1.11 Keyboard move entry and screen-reader move announcements *(added)*
- [ ] 1.12 Tests: rule edge cases, engine adapter with a fake worker, e2e for a full game

## 2. AI provider layer

- [ ] 2.1 Node server: static hosting, JSON API, security headers (CSP, COOP/COEP, HSTS)
- [ ] 2.2 Provider interface: `chat(messages, {stream, schema, maxTokens, signal})` and `embed(texts)`
- [x] 2.3 OpenAI adapter
- [x] 2.4 Mistral adapter
- [x] 2.5 Claude adapter (Anthropic Messages API)
- [x] 2.6 Ollama adapter (local models, so nothing leaves the machine)
- [ ] 2.7 Structured output for board annotations on every provider (JSON schema or tool calling, plus fallback parsing)
- [x] 2.8 Stream replies to the browser (NDJSON over `fetch`), with cancellation
- [ ] 2.9 Key management: keys come from server env or an encrypted per-user store, and never reach the browser, logs or prompts
- [ ] 2.10 Model choice per task (quick comment, chat, deep review) and per provider *(added)*
- [ ] 2.11 Limits: per-user rate limit, token budget, timeouts, cost display *(added)*
- [x] 2.12 Allowlist for the Ollama base URL (SSRF guard) *(added)*
- [x] 2.13 Mock provider with deterministic fixtures for tests and offline development *(added)*
- [ ] 2.14 Settings UI: provider, model, connection test, local-only mode
- [ ] 2.15 Contract tests per adapter against recorded responses; live smoke tests run only when an env flag is set

## 3. Tutor commentary

- [ ] 3.1 Grounding pipeline: engine lines in SAN, move class, motifs, position features and retrieved references go into the prompt context *(prototype: `contextFor`)*
- [ ] 3.2 Aspect picker:
  - [ ] 3.2.1 Last move: what it did, its rating, the engine's alternative
  - [ ] 3.2.2 Future moves and opportunities: threats, plans, candidate moves
  - [ ] 3.2.3 Things to keep in mind: weaknesses, king safety, loose pieces
  - [ ] 3.2.4 Habits of strong players: blunder check, candidate moves, prophylaxis
  - [ ] 3.2.5 Relevant classic games, taken from the reference library through RAG
- [ ] 3.3 A prompt template per aspect, with shared rules: don't invent variations, back every claim with an engine line
- [ ] 3.4 Validate the output: check every move, square and line against chess.js and the engine's lines, then drop or flag the ones that can't be verified *(added)*
- [ ] 3.5 Adapt to the player's level *(prototype)*
- [ ] 3.6 When to comment: after every move, only after mistakes, or on request; no spoilers mid-game unless help is on
- [ ] 3.7 Cache comments by (EPD, aspect, level, model)
- [ ] 3.8 Tutor eval set: reference positions with the key points a good comment should hit; scored by engine checks plus an LLM judge, run per provider *(added)*

## 4. Chat and board annotations

- [ ] 4.1 Chat panel: history per game and position, streaming, stop button *(prototype)*
- [ ] 4.2 Annotation schema: arrows, square highlights, ghost pieces, labels, move sequences
- [ ] 4.3 Rendering: chessground shapes for arrows and highlights; a ghost-piece layer; a variation stepper that leaves the game untouched
- [ ] 4.4 Check every annotation against the current position before drawing it
- [ ] 4.5 "What if": the user tries a move on a scratch board, the engine evaluates it, the tutor explains
- [ ] 4.6 Chat context: current position, game so far, selected aspects, recent tutor comments
- [ ] 4.7 Tests: schema validation, rendering e2e, malformed and hostile model output

## 5. Opening library

- [x] 5.1 Opening names by position (Lichess chess-openings, CC0), in `claude/data/eco`
- [ ] 5.2 Opening explorer: move tree built from the reference library (check licence and terms before using any external explorer API)
- [ ] 5.3 Repertoire builder: the user picks lines for White and for Black
- [ ] 5.4 Repertoire drill with spaced repetition *(added)*
- [ ] 5.5 Opening explanations: ideas, typical plans, resulting pawn structures

## 6. Tactics and strategy curriculum

- [ ] 6.1 Structure: modules → lessons → exercises, tagged by level
- [ ] 6.2 Tactics: fork, pin, skewer, discovered attack, double check, deflection, decoy, overloading, interference, removing the defender, zwischenzug, back rank, mating patterns
- [ ] 6.3 Strategy: pawn structures (IQP, Carlsbad, hanging pawns, …), weak squares, outposts, good and bad bishops, open files, king safety, piece activity, prophylaxis
- [ ] 6.4 Endgames: basic mates, king and pawn, opposition, Lucena, Philidor; checked against tablebases (Syzygy) *(added)*
- [ ] 6.5 Puzzle source: Lichess puzzle database (CC0), already tagged by theme
- [ ] 6.6 Lesson player: explanation, worked positions, exercises with tutor hints
- [ ] 6.7 Progress per lesson and per theme

## 7. Reference library: games and problems

- [ ] 7.1 Data model: games, positions, problems, annotations, plus source and licence for each item
- [ ] 7.2 PGN import with deduplication *(prototype)*
- [ ] 7.3 Classic games collection: public game scores only, no copyrighted annotations
- [ ] 7.4 Problems and studies collection
- [ ] 7.5 Search by player, opening, year, result, theme
- [ ] 7.6 Storage: SQLite on the server, IndexedDB cache in the browser
- [ ] 7.7 The user's own games *(prototype)*

## 8. RAG on positions and tactical patterns

- [ ] 8.1 Position index: exact EPD and pawn-structure signature *(prototype)*, plus material signature and piece-placement features
- [ ] 8.2 Pattern tags per position and move, from the motif and theme detectors *(prototype)*
- [ ] 8.3 Text index for annotations and lesson text; embeddings from a separately configured provider (OpenAI, Mistral or Ollama; Anthropic has no embeddings API)
- [ ] 8.4 Hybrid retrieval: structural similarity, tag overlap and text embeddings, then re-ranking
- [ ] 8.5 Fuzzy pawn-structure distance
- [ ] 8.6 Retrieved items go into tutor and chat context with citations; the UI opens the cited game at that position
- [ ] 8.7 Treat retrieved text as untrusted: delimit it and never follow instructions inside it (imported PGN comments can carry prompt injection) *(added)*
- [ ] 8.8 Retrieval eval: labelled query positions with expected references; track precision@k *(added)*

## 9. Progress and personalization *(added)*

- [ ] 9.1 User profile: level, rating estimate, goals
- [ ] 9.2 Weakness tracking from game reviews (missed themes, weak game phases)
- [ ] 9.3 Puzzles generated from the user's own mistakes
- [ ] 9.4 Spaced-repetition scheduler for puzzles, openings and lessons
- [ ] 9.5 Study plan suggestions *(prototype)*

## 10. Accounts, privacy and reach *(added)*

- [ ] 10.1 Decide on the deployment mode: single-user local app or hosted multi-user service
- [ ] 10.2 Authentication, if hosted: sessions plus passkeys or OAuth
- [ ] 10.3 Data export and deletion
- [ ] 10.4 Privacy notice: what goes to which AI provider, with opt-in per provider
- [ ] 10.5 Accessibility: keyboard play, colour-blind-safe arrows, reduced motion
- [ ] 10.6 Mobile layout and dark mode *(prototype)*
- [ ] 10.7 Offline use (PWA): engine, library and curriculum work offline; the tutor needs a provider or Ollama
- [ ] 10.8 Internationalization

## 11. Security testing (before every release)

- [ ] 11.1 Threat model covering the data flows: browser ↔ server ↔ providers, PGN imports, RAG store
- [ ] 11.2 OWASP Top 10 (current edition): a checklist mapped to the code, with findings tracked as GitHub issues
- [ ] 11.3 OWASP Top 10 for LLM Applications (2025), with test cases for each item:
  - [ ] 11.3.1 LLM01 Prompt injection: direct (chat) and indirect (PGN comments, library text)
  - [ ] 11.3.2 LLM02 Sensitive information disclosure: API keys, other users' data
  - [ ] 11.3.3 LLM03 Supply chain: pinned packages and model versions
  - [ ] 11.3.4 LLM04 Data and model poisoning: imported games and annotations in the RAG store
  - [ ] 11.3.5 LLM05 Improper output handling: model output never rendered as HTML; annotations validated
  - [ ] 11.3.6 LLM06 Excessive agency: the model can only produce text and annotations, never take actions
  - [ ] 11.3.7 LLM07 System prompt leakage: no secrets in prompts
  - [ ] 11.3.8 LLM08 Vector and embedding weaknesses: users' data kept separate in the RAG store
  - [ ] 11.3.9 LLM09 Misinformation: every chess claim checked against the engine
  - [ ] 11.3.10 LLM10 Unbounded consumption: rate limits and token budgets
- [ ] 11.4 OWASP ASVS: pick a level (L1 for a local app, L2 if hosted with accounts), keep a verification checklist, automate checks where possible
- [ ] 11.5 Automated scans: Dependabot, CodeQL, secret scanning, OWASP ZAP baseline against staging, CSP check
- [ ] 11.6 Release gate: security checklist in the release PR; no open high-severity findings

## 12. Release and operations *(added)*

- [ ] 12.1 Semantic versioning and a changelog
- [ ] 12.2 Packaging: Docker image for the Node server and static client
- [ ] 12.3 Logging and monitoring, with no personal data or prompts in logs by default
- [ ] 12.4 Docs: user guide, provider setup, self-hosting with Ollama
