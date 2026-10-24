# Provider fixture recording

The contract tests replay JSON files in `site/server/fixtures/` through the real SDKs. They do not call providers. Each file labels its provenance as recorded or hand-written; hand-written examples are not evidence that a configured provider works. TODO 2.15 remains open until OpenAI, Mistral and Ollama have real successful recordings.

The recorder is an operator tool that uses configured credentials and can incur provider charges. From `site/`, inspect a plan before separately authorizing execution:

```sh
node scripts/record-ai-fixtures.mjs anthropic --plan
# After approving this exact provider/model plan and its cost:
node scripts/record-ai-fixtures.mjs anthropic --yes
```

Names must be explicit, unique selections from `anthropic`, `openai`, `mistral`, `ollama`. All selected configurations are checked first. Local-only mode cannot silently substitute another provider. `--yes` is required even for Ollama: an operator-selected model alias may route to a billed service. No command in ordinary tests uses real credentials or delegates to the network.

The default environment file is repository-root `.env`; `--env FILE` resolves relative to `site/`, and `--env=` skips loading a file. Inherited environment variables still apply. The plan prints model IDs, fixed request/token bounds and the exact output directory, without endpoints or credentials. It sends no requests and creates no output directory. SDK loggers are explicitly silenced even if debug logging is inherited; diagnostics use fixed failure categories, never raw SDK messages or response bodies.

## Bounds and publication

Each provider receives at most two HTTP attempts: short chat (400 output tokens) and native structured annotations (1500). There are no SDK retries, redirects, server-side refusal fallbacks, JSON-mode fallbacks, tools, judge or embeddings. An error stops the run, including later cases/providers. These are request/output bounds, not a billing estimate or a hard spending limit.

Each attempt has a one MiB response cap and one total deadline for headers, body collection and SDK parsing: `AI_TIMEOUT_MS`, normally sixty seconds, capped at five minutes. Accept only HTTP 200 event streams, valid UTF-8, an explicit protocol terminator, a nonempty nontruncated completion without tool calls, and schema-valid annotations for the JSON case. A valid stream/schema does not establish chess correctness, answer quality or provider trust.

The default output is the git-ignored, private `.kibitz-data/ai-fixtures/` directory at the repository root. New directories use mode 0700 and files 0600, subject to host filesystem semantics. Each accepted fixture is written to an exclusive temporary file, then atomically replaces its fixed provider/case filename. An existing destination symlink is replaced as an entry; its target is never opened. Handled publication failures remove temporary files and preserve earlier destinations. A successful chat file remains if the later JSON case fails; publication is per file, not a transaction across the run. Abrupt process/host failure may leave a private `.part` file for operator cleanup.

`--out DIR` deliberately selects another operator-owned directory. Repository destinations are restricted to `.kibitz-data/` and `site/server/fixtures/`; filesystem roots, `.git` and `node_modules` are refused, with existing parent aliases resolved before execution. Paths resolve relative to `site/`. Directory/parent writers, hard links and subsequent edits remain operator-trusted; this is not a sandbox against another process with the operator's filesystem privileges.

## Review before committing

Capture keeps only provider/case/model/date/provenance, HTTP status, content type and raw response body. Requests and account headers are omitted. Known configured cloud API key values and common JSON/percent encodings are refused in metadata, raw bytes and decoded completion text, including text split across separate SSE events. Error bodies are canceled without capture. These checks cannot identify every unknown secret, private provider field or encoding.

Review staged JSON locally before copying individual files into `site/server/fixtures/`: check private/account identifiers, unexpected fields, provenance, selected model, valid stream termination and meaningful output. Do not print sensitive raw captures into CI or an issue. Preserve accepted wire bytes; do not call edited/synthetic data a real unmodified recording. Run `node --test server/contract.test.mjs` after reviewing and copying fixtures. The fixture change needs its own approved live plan and PR; improving this tool does not authorize paid recording.

## Scanner context

CodeQL context 9 under [#99](https://github.com/gregoryyy/kibitz/issues/99) follows network data into a file write. This is the tool's intended capture operation: HTTP contents supply JSON data, while the operator selects the directory and a fixed allowlist selects filenames. Contract replay parses the JSON and returns a `Response` to an SDK; it never executes downloaded code. The [query guidance](https://codeql.github.com/codeql-query-help/javascript/js-http-to-file-access/) calls for inspecting this intent. The old recorder nevertheless had real overwrite/error/size/confirmation defects, covered by the new synthetic regressions. No query is disabled or alert manually dismissed; feature/main scan results and remaining #99 dispositions still govern release triage.
