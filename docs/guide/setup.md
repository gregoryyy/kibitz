# Running Kibitz locally

Deployment, coach providers, privacy, limits, the container, HTTPS and server logs for the local single-user app. Playing and studying are in the [user guide](readme.md).

## Deployment decision: local single-user app

Decision for TODO 10.1, confirmed by the project owner on 2026-10-24: **target a local single-user application**. One operator runs the Node server and opens Kibitz in a browser on that machine. The engine and retrieval stay in the browser. Browser storage remains the default; a private SQLite server library is optional. The existing `serve.mjs` default binds to `127.0.0.1`, with same-origin/host checks around the APIs.

This deployment can still use a cloud AI provider chosen by the operator. “Local app” describes where the application runs; `AI_LOCAL_ONLY`, Ollama and the in-browser model provide the separate offline/local-inference options. Provider data sharing and explicit opt-in remain TODO 10.4.

### Supported operation

Build and run from the repository:

```sh
just serve
# Optional private, persistent library:
cd site
node scripts/serve.mjs dist --api --library ../.kibitz-data/library.sqlite
```

The server reads operator-supplied keys from the root `.env`; keys remain outside browser storage, exports, logs and prompts. Server-env key management satisfies TODO 2.9's supported local path. An encrypted store for separate account-owned keys belongs to a future hosted deployment.

The optional library's anonymous HttpOnly cookie separates browser collections, without providing a sign-in or cross-device account. Clearing the cookie loses that browser's route to the previous server collection. Browser profiles, progress, repertoires and practice schedules stay local to the browser. The operator is responsible for local files and backups. Explicit export/deletion is tracked in TODO 10.3.

The owner selected native Node HTTPS with operator-supplied certificates for the
final local-app transport. `serve.mjs --tls-key FILE --tls-cert FILE` now starts
that listener; [TLS setup and data-transition limits](#native-https-for-the-local-app) describe private
identity files, normal browser trust and the remaining ASVS work. Both options
are required; an invalid pair exits without an HTTP fallback. HTTP remains the
RC/development default when neither option is supplied.

Both APIs issue new cookies with `Secure` on the actual TLS socket. Forwarding
headers do not control the flag. Existing valid cookies retain their identity
without being reissued; preserve private-library/profile backups before changing
origin, and do not clear an ownership cookie as a migration strategy. Cookie
prefix/migration work remains TODO 11.4.2.1. These flags preserve local grouping
and do not establish authenticated accounts or a trusted reverse-proxy deployment.

The existing `--host` option can change the listener for deliberate development/packaging use. Binding to a LAN/public address does not add accounts, transport security or authorization. A public/shared service is outside this deployment decision. A local machine's users, browser profiles and anonymous cookie scopes are not a hosted tenant-security boundary.

Default HTTP/AI logs use fixed categories and omit raw URLs, cookies, prompts and provider messages. See [local monitoring and retention](#local-server-logs-and-monitoring) for status checks, error events and private log files.

### Public files and filesystem ownership

The server serves regular files from canonical public directories. A root selected
through a symlink is resolved at startup; symlinked assets or child directories are
refused, including aliases within the public tree. Keep private databases, env files
and backups outside both static and model roots. Model routes remain restricted to
catalogue filenames; a catalogue name does not authorize an alias to another file.

The [shared reader](../../site/server/public-files.mjs) checks the opened file's type and
identity after opening, before using that descriptor for response metadata and bytes. No-follow/nonblocking
open flags apply where the platform supplies them; descriptor identity checks also
reject a changed leaf. Atomic replacement/unlink after validation cannot redirect
an active response. Streams stop at the captured size and detect truncation; HTML
CSP hashes and content length are computed from the actual descriptor-read body.
See Node's [file/stream API](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandlecreatereadstreamoptions)
for descriptor lifetime semantics.

Public roots and their parent directories must remain writable only by the trusted
operator/build process. These controls do not sandbox a malicious filesystem owner,
lock in-place writes, prevent hard links to private files, or rehash model weights on
every request. Stop the server during builds or publish regular assets atomically;
do not rebuild its served `dist/` during an active browser run. The existing model
marker is an availability check, not ongoing integrity verification.

### CSP and trusted HTML

The [web-asset policy](../security/supply-chain.md#browser-styles-and-bundled-fonts) hashes actual trusted style blocks as well as scripts, blocks style attributes and bundles the original fonts with pinned bytes/licences. Both normal and offline pages restrict font/style resources to the same origin. Dynamic board/viewport geometry uses existing trusted CSSOM property updates.

Install production Node dependencies with `npm ci` in `site/`, including the pinned
parse5 parser used by static serving. The parser and its decoder run on the server;
they are not added to the browser bundle. Missing dependencies fail startup with a
fixed installation hint and an allowlisted error code.

The CSP hashes are selected from parsed HTML/SVG script nodes in the same trusted
HTML body that is sent. Actual `src`/SVG `href` attributes exclude external bodies;
comments, raw text, templates, noscript content, non-script data blocks and unfinished tags do not grant
inline-script hashes. Browser-normalized line endings/character references feed the
hash, and duplicate hashes are removed. Recognized JavaScript types, modules and CSP-controlled import maps/speculation rules retain their hashes. Module/worker/WebAssembly and offline host
restrictions retain their existing policy.

This generates a policy for operator-owned build files. Passing model/user HTML to
`cspFor()` would authorize supplied inline script bodies; parsing does not make that
input safe. Keep imported games, notes and model responses in literal text/rendering
paths, and keep public build files under the operator's control. See the
[HTML parsing standard](https://html.spec.whatwg.org/multipage/parsing.html) and
[parser API](https://parse5.js.org/functions/parse5.parse.html).

### Consequences for the plan

- TODO 10.2 hosted authentication is deferred. Passkeys/OAuth, account sessions, tenant isolation, account-based budgets and encrypted per-user provider keys are prerequisites for any later hosted service.
- [Usage limits](#local-usage-limits) persist server/cookie counters and minute allowances across restarts in the standard serve recipes. Cookies supply local grouping, not authenticated quotas; completed-usage admission thresholds are not hard billing caps.
- Data export/deletion covers the standalone browser and explicitly selected local-server library. External artifact hosts retain control of their account data.
- Security verification targets the chosen local deployment (ASVS L1 in TODO 11.4), with applicable provider/prompt/import checks. This decision does not mark those checks complete.
- Packaging, privacy/consent, accessibility, offline use, localization and operations remain actionable. Containers must retain local-only defaults unless an operator intentionally changes them.

### Existing alternate runtimes

The Claude artifact adapter remains an existing host-managed integration. The fully offline browser-model path remains supported. Neither changes the selected release target or supplies a self-hosted multi-user account implementation.

A future hosted proposal must explicitly revisit this decision, threat model, authentication, tenant isolation, provider-key ownership, retention/deletion, persistent budgets, HTTPS and ASVS level before it can claim support.

## Coach providers and local Ollama

This guide configures the standalone [local single-user app](#deployment-decision-local-single-user-app). Start with the [user guide](readme.md); [`.env.example`](../../.env.example) is the complete configuration reference. The instructions below are setup steps, not evidence that an account/model has been tested live. External console instructions were checked against the linked primary documentation on 2026-10-25.

### Configure a provider

If the root `.env` does not already exist, copy `.env.example` to `.env`. Edit the file locally, selecting one `AI_PROVIDER` and filling only the credentials/model settings you intend to use. Keep it private and outside Git; never paste keys into coach chat, browser settings, screenshots or issue reports. Existing shell environment values take precedence over values loaded from the file.

| Provider | Root `.env` settings | Obtain access |
| --- | --- | --- |
| Claude | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-5-5`, `ANTHROPIC_EFFORT=medium` | Create a personal API key for local development in the [Claude Console](https://platform.claude.com/docs/en/get-api-key), selecting a workspace-scoped key. |
| OpenAI | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna` | Create an API project key through the [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart). Check that this API project has access to the selected model. |
| Mistral | `AI_PROVIDER=mistral`, `MISTRAL_API_KEY`, `MISTRAL_MODEL=mistral-small-latest` | Activate Studio and create a key using [Mistral's setup instructions](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key). Check your account's quota, plan and rate limits. |
| Ollama | `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL` | Use an installed local model as described below; no cloud API key is needed for this path. |
| In browser | Use `just offline` or `just offline-chrome` | Explicit model loading/download is separate; see [offline choices](readme.md#offline-app). |
| Mock | `AI_PROVIDER=mock` | Deterministic development replies, with no model service. |

The gateway's default endpoints are the official Claude, OpenAI and Mistral APIs. Optional `<PROVIDER>_BASE_URL` overrides change the actual destination; do not use an untrusted proxy with a provider key. Ollama additionally requires its hostname in `OLLAMA_ALLOWED_HOSTS`. Provider labels alone do not prove where data goes.

Run `just serve`, or `npm --prefix site run serve`, from the repository root. Stop/restart after configuration edits; the server loads the root `.env` once. In **Settings → Coach**, select the configured provider, grant its **coach** permission through **Provider permissions**, then deliberately choose **Test connection**. This sends a small real request and can incur API charges. A successful test checks that reply, not explanation quality, every task or all tool/structured-output features.

### Task models, sharing and spending

`<PROVIDER>_MODEL` controls chat. `_MODEL_QUICK` controls quick chips/automatic comments and `_MODEL_REVIEW` controls review summaries/study plans; missing overrides fall back to the chat model. Settings displays the chosen task models. Provider/local-only changes there last until server restart. The optional quick-in-browser route needs its own explicit Load.

Kibitz uses OpenAI Chat Completions. For the exact selected `gpt-6-luna` model it sends `reasoning_effort: none`, as required for its [documented function-calling protocol](https://developers.openai.com/api/docs/models/gpt-6-luna). Other model IDs and compatible providers receive no added reasoning field. A mutable model alias can change behind an unchanged name; configuring a revision label does not verify weights or quality.

Coach and embedding permissions are separate, initially off choices. Summaries, automatic comments, connection tests and tool follow-ups can all make provider requests. Keep **How the coach works → Only when asked** for manual use. Embeddings stay optional: leave `EMBEDDING_MODEL` empty to retain local keyword/board search, or configure a suitable embedding model and deliberately build/search after granting that provider's embedding permission. The chat model is not automatically an embedding model. See [embedding configuration and revision limits](../design/retrieval.md#gateway-and-configuration).

Use `AI_RATE_LIMIT_PER_MINUTE` and the per-user setting for request admission, plus token/cost thresholds if desired. Dollar estimates require operator-supplied `AI_PRICES`; unknown prices remain unknown. Completed-usage thresholds can overshoot and are **not hard billing caps**. Tool rounds and format/server-side fallbacks can add calls even though automatic SDK retries are disabled. Configure financial controls in the provider account as appropriate. [Usage accounting](#local-usage-limits) describes exact scopes, deadlines, resets and cancellation limits.

### Self-host with native Ollama

Keep Kibitz and Ollama on the same machine for the straightforward loopback setup. Install Ollama from its [official quickstart](https://docs.ollama.com/quickstart). Run its application/service; if you manage it in a terminal and no instance is already running, use:

```sh
OLLAMA_NO_CLOUD=1 ollama serve
```

Ollama normally listens on `127.0.0.1:11434`. Its [FAQ](https://docs.ollama.com/faq) describes cloud disabling and service-specific environment configuration. Set `OLLAMA_NO_CLOUD=1` on the **Ollama process**, restarting it if necessary; placing it only in Kibitz's `.env` does not reconfigure an already running service. Preserve loopback binding. Kibitz's `AI_LOCAL_ONLY=1` restricts provider routing, while Ollama itself controls whether a model is remote/cloud.

List installed models without generating a reply:

```sh
ollama ls
```

Choose the exact installed local model tag. If none fits your needs, choose and download a model separately using Ollama's [CLI reference](https://docs.ollama.com/cli), checking its licence, storage/RAM needs and tool support first. A pull transfers weights and can be large; this guide does not run or prescribe a download. Models without native tool support can still explain supplied engine context, but connection success does not establish tool capability or chess reliability.

Set the root `.env` values, replacing the placeholder with your installed tag:

```dotenv
AI_PROVIDER=ollama
AI_LOCAL_ONLY=1
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_ALLOWED_HOSTS=127.0.0.1,localhost
OLLAMA_MODEL=your-installed-model:tag
EMBEDDING_MODEL=
```

Build and run from the repository root:

```sh
npm --prefix site run build
node site/scripts/serve.mjs site/dist --api --env .env --usage .kibitz-data/usage.sqlite --offline --index _test.html
```

This explicit `--offline` invocation preserves the offline page path and removes legacy external font links if present. The current app already bundles its fonts and uses the same strict same-origin style/font policy in either mode. Coaching still needs the local Node gateway and Ollama process. The browser is served at `http://127.0.0.1:8765/`. Grant **Ollama → coach** permission, then press **Test connection** when ready to load/run the selected model. Local models still use memory and computation. No Ollama CORS wildcard is needed: the browser calls Kibitz's same-origin gateway, and Node contacts Ollama.

For an optional persistent server library, add `--library .kibitz-data/library.sqlite` to that server command, then explicitly select it in Library. Keep private databases outside `site/dist/` and any served model root. The usage and library databases are separate; cookie-based collections do not provide accounts or cross-device sync. Follow [data controls](readme.md#data-export-and-deletion) and [backup guidance](#local-docker-package) for the applicable deployment.

The supplied Docker package has its own loopback. Host `127.0.0.1:11434` is not the host's Ollama service from inside a bridge container. The [container guide](#local-docker-package) documents explicit runtime configuration; use the native Node path above for same-machine Ollama without changing network exposure. A LAN/public bind is not a supported shared-user deployment.

### Troubleshooting

| Problem | Check |
| --- | --- |
| Provider not offered | Correct `AI_PROVIDER`, required key/model and restart; inspect the fixed startup/status reason. An installed browser model requires its separate runtime setup. |
| Permission required | Grant the exact provider/purpose. Coach permission does not authorize embeddings, and a key alone grants neither. |
| API authentication/model rejection | Verify the private key, API project/workspace, quota and exact model ID in that provider's console. The app intentionally does not reflect raw provider error bodies. |
| Ollama unavailable/model missing | Check the local service and `ollama ls`, the configured tag/base URL and exact hostname allowlist. Do not widen its listener to fix a tag or stopped service. |
| Timeout | Allow model warm-up on your machine or choose a suitable installed model. `AI_TIMEOUT_MS` defaults to 60 seconds and caps at 15 minutes. A cancelled/timed-out paid request may already be billable. |
| Tool or structured reply unsupported | Check the selected task model's capabilities. The fallback may explain existing context; it does not make unavailable engine tool evidence exist. |
| Usage/cost seems absent | Confirm persistent usage storage, configured prices and provider-reported usage. Browser inference bypasses gateway counters; local/mock work is excluded from paid-user totals. |

Use [fixed-category logs and no-inference health checks](#local-server-logs-and-monitoring) for local diagnostics. Do not share actual `.env` contents, browser cookies or prompt/response payloads with a bug report. Existing [recorded evaluations](../eval/readme.md) have provider-specific evidence limits and are not implied by this setup guide.

## Provider privacy and opt-in

The selected deployment is a [local single-user app](#deployment-decision-local-single-user-app). **Settings → Coach → Provider permissions** explains sharing and provides separate, initially off permissions for coach requests and passage/query embeddings for Claude/Anthropic, OpenAI, Mistral and Ollama. The operator configures keys, models and supported endpoints; entering a key does not grant browser permission to send data.

### What goes where

| Activity | Possible content | Destination and explicit action |
| --- | --- | --- |
| Coach chat, tutor, game summary or study plan | Question/conversation; permitted game, FEN and move history; engine scores/lines and tool results; selected retrieved comments/references; profile level, reported rating and goals | The selected configured provider through the local gateway, after its coach permission. Tool follow-up turns use the same permission. |
| Connection test | Fixed “OK” request, model/API metadata and usage | The selected provider, after its coach/test permission. |
| Semantic index build | Only the source/language-filtered passages selected for that index | The separately configured embedding provider, after its embedding permission and a Build click. |
| Semantic query | The written query | The same embedding provider, after permission and an explicit search. |
| Rules, Stockfish, lessons, keyword search and ordinary library browsing | No model request | Browser/local assets; no model-provider permission required. |
| In-browser model | Coach context processed on this device | Explicit loading consent applies. Default wllama weights come from the local server; the optional Chrome backend requires a Load click per session and Chrome manages its own model download/storage. [Runtime and erasure limits](readme.md#optional-chrome-built-in-coach). |
| Mock provider | Test/development requests | The local deterministic mock; no external model service. |

Coach data follows live-help policy. Imported/user text still enters prompts through `quote()` and validated context; consent does not weaken move/source/tool checks. Lesson reflection drafts are not automatically sent to a model. Vectors stay in browser memory and clear on source/account/policy changes.

OpenAI/Mistral-compatible endpoints and the allowlisted Ollama endpoint can be operator-configured. The provider name alone does not identify every possible host. Ask the operator about the actual destination, account and retention settings before granting permission. The page exposes no keys/private endpoint URLs. This notice describes application transfers, without provider-retention or regulatory-compliance guarantees.

The page bundles its original fonts locally and permits only same-origin font/style assets, in normal and offline serving. It sends no Google Fonts requests. [Font provenance and CSS policy](../security/supply-chain.md#browser-styles-and-bundled-fonts) describe the pinned assets and retained licences. The local-model selector restricts model-provider routing; it does not change a configured Ollama endpoint or itself enable offline server mode.

### Choices and revocation

`kibitz.providerConsent` is a bounded v1 browser record of exact provider/purpose pairs and a revision, without prompts, keys or answers. Grants require a successful save. Future/corrupt formats remain intact/read-only and closed to network-provider sharing. Browser erasure clears these choices.

A failed revocation immediately denies that provider/purpose in this tab, with a distinct retry control. The page warns that other tabs/reloads may retain the old grant until revocation saves. Sequential stale-tab edits cannot silently restore another tab's choices; simultaneous localStorage writers still lack a transaction.

Before a network call, the transport rereads permission. Changes abort this tab's pending coach/embedding transports, clear reusable conversation/semantic state and fence late results. Other tabs reload through storage events and reread before new work. Already accepted calls may still finish at the provider. Revocation cannot recall transmitted data or erase provider copies. [Data controls](readme.md#data-export-and-deletion) handle local saved data; external retention/deletion belongs to that service/operator.

The in-browser model and mock work without a network-provider grant. Quick requests can use the separately consented browser model while a network coach is blocked.

### Gateway and direct clients

The gateway requires exact `X-Kibitz-Consent: v1:<provider>:<purpose>` before sample, structured, connection-test or embedding work. Purposes are `coach` and `embeddings`. It checks actual routing: another provider's header or coach permission cannot authorize embeddings. Denials precede SDK calls and spending/rate-budget admission.

The browser adds the header only for an acknowledged grant. Direct API operators must deliberately include it to opt in. This is a local-client attestation, **not authentication, a signed consent receipt or a tenant boundary**. Origin/host/JSON checks, key ownership, budgets and validation remain separate. Hosted accounts/artifact runtimes need their own contract; these standalone controls do not impersonate the host.

The standard local server also retains [operational usage counters](#local-usage-limits) in a separate private SQLite file: current-day numeric totals, recent request-admission timestamps and hashed anonymous cookie IDs. It stores no prompt/response text, raw cookie or API key there. Browser/library erasure leaves these limits intact; the operator manages their documented retention and deliberate reset.

## Local usage limits

TODO 2.11 targets the selected local single-user app. The gateway groups browsers by the random HttpOnly `kibitz_uid` cookie. This is usage grouping, without sign-in or authenticated quotas: clearing or replacing the cookie starts another user. Hosted account budgets remain deferred with TODO 10.2.

New usage cookies include HttpOnly, SameSite=Strict and the `/api/` path. Direct native TLS also adds Secure; local HTTP and spoofed forwarding headers do not. Existing valid IDs are reused without reissuing a cookie. The library has a separate cookie/path with the same transport policy. See the [deployment boundary](#deployment-decision-local-single-user-app).

`just serve`, `just offline` and `npm run serve` select the gitignored private `.kibitz-data/usage.sqlite`. Counters survive a server restart. For a direct invocation, opt in explicitly:

```sh
node site/scripts/serve.mjs site/dist --api --env .env --usage .kibitz-data/usage.sqlite --index _test.html
```

Direct `serve.mjs --api` without `--usage`, evaluation tools and automated tests use `:memory:`; restarting those intentionally resets accounting. Startup states whether counters are persistent or in memory. `--usage` has no effect without `--api`.

| Operator setting | Scope |
| --- | --- |
| `AI_RATE_LIMIT_PER_MINUTE` | Shared gateway requests in a rolling minute; default 20. |
| `AI_RATE_LIMIT_PER_USER_PER_MINUTE` | Requests for one cookie in that same minute; default 20. |
| `AI_TOKEN_BUDGET_PER_DAY` | Completed input/output tokens for the server; 0 means unlimited. |
| `AI_TOKEN_BUDGET_PER_USER_PER_DAY` | Completed paid-cloud tokens per cookie; 0 means unlimited. |
| `AI_COST_BUDGET_PER_USER_PER_DAY` | Estimated paid-cloud dollars per cookie; 0 means unlimited. |
| `AI_PRICES` | Operator-supplied input/output prices per million tokens, keyed by model. |
| `AI_TIMEOUT_MS` | Total chat/embedding SDK-operation deadline, including body consumption/parsing; default 60 seconds, maximum 15 minutes. |

Connection tests, streamed/structured coach turns, tool follow-up turns and embeddings share both rate allowances. A refusal returns `rate_limited`/HTTP 429 and does not invoke a provider. Failed accepted calls still consume their admission slot. Host/origin/content/consent and embedding-input checks precede admission. Numeric daily counters and minute slots reset at the server's **local midnight**, and minute slots also expire after 60 seconds. Changing the system clock/time zone can move that boundary.

Daily paid-user thresholds exclude Ollama/mock. The server token threshold and gateway rates still apply to them. The in-browser model bypasses the gateway and is not counted here. Unknown model prices produce unpriced-token counts and no invented dollar charge; configure token limits as well as dollar limits. Costs are estimates based on configured prices, rather than provider invoices.

### Provider response bounds

The OpenAI gateway uses Chat Completions. For the exact selected model `gpt-6-luna`, it sends `reasoning_effort: none` on every turn, including connection tests, structured replies and tool continuations. This follows the model's [documented function-calling requirement](https://developers.openai.com/api/docs/models/gpt-6-luna). The choice follows the actual per-task model; other model IDs and Mistral/Ollama receive no added reasoning parameter. This transport setting is not evidence of live model availability or chess-answer quality.

Each network-provider chat or embedding operation has one independent deadline covering headers, response consumption, SDK iteration/parsing and final decoded results. Positive `AI_TIMEOUT_MS` values round up to milliseconds and cap at fifteen minutes; invalid/nonpositive configuration uses the existing sixty-second default. Connection tests have the same bounds and now propagate browser disconnects. Caller cancellation and deadline failure abort transport, cancel active readers and prevent late results from being applied; monotonic deadline checks also reject results after synchronous work delays timer delivery. JavaScript cannot preempt a synchronous parser mid-instruction.

The fixed response-body cap is **8 MiB per operation**, measured after HTTP decompression and including SSE framing, invisible fields, tool arguments and error bodies. Decoded coaching text plus tool/result metadata has a smaller **128 KiB cumulative cap** before forwarding to the page. Decoded embedding JSON has an 8 MiB cap to allow vector batches. Injected test clients obey the decoded limits too. Ollama embedding inspection and vector response share one operation's clock/body counter, so failed inspection cannot proceed to text upload. These are per-call limits, not global memory reservations or spending caps.

Gateway-created SDK clients disable automatic SDK retries/backoff. A connection or provider failure is returned for an explicit later retry; SDK debug loggers are silenced so configured vendor debug modes cannot bypass category-only app events. Existing native/JSON fallback, model-tool rounds and Anthropic server-side refusal fallback remain separate behavior: structured output can still make two bounded calls, while a response-limit/timeout failure does not trigger a format retry. Fixture capture keeps its own tighter limits.

Timeouts return `timeout` (HTTP 504); body/result overflow returns `response_too_large` (HTTP 502). Streamed coach responses may already have HTTP 200 and end with an error frame; the page replaces the partial answer with a fixed translated hint. Disconnected work is `cancelled` and emits no AI-failure event. Failed/incomplete work keeps its rate-admission slot but supplies no completed-usage entry; the provider may already have performed/billed work. Aborting a socket cannot recall a provider's accepted work or guarantee its usage report. Daily thresholds retain the limits below.

### Admission thresholds and durability

Budget checks compare completed usage before accepting another request. The final request can cross a threshold; concurrent requests, format/tool/server-side fallbacks, incomplete provider usage and a process crash during generation can exceed or under-report it. These are **not hard billing caps or token reservations**. Configure provider-side spending limits when a hard financial limit is required. A provider switch while a response is pending retains the request's original paid/local classification.

Admission commits server/user minute slots before inference. Completion commits both daily ledgers in one SQLite transaction, with WAL and synchronous FULL. Separate server processes using the same file see committed counters. Private-storage, schema and capacity failures refuse operation without silently resetting or falling back to memory. A failure while recording already completed inference cannot undo provider work. At most 10,000 current-day user scopes are accepted; capacity exhaustion preserves existing budgets and rejects another scope.

### Stored data and lifecycle

The private file contains current-day numeric totals (requests, tokens, estimated costs, unpriced/paid tokens), recent admission timestamps and SHA-256 hashes of cookie IDs. It contains no raw cookies, prompts, answers, game scores, notes, API keys or model IDs. The library and usage databases are separate, versioned schemas. Unknown schemas/data remain intact and fail closed.

New directories use mode 0700 and files 0600. Paths inside either served root (static files and any separate `--models` directory), including parent symlink aliases, public-readable files and final symlinks are refused. An explicit model directory must already exist; invalid/missing model roots fail startup before database files or their parents are created. The same path policy protects library databases. SQLite sidecars remain operator-managed private files. Paths are operator-selected and never supplied by HTTP callers.

Only current-day counters are consulted. The next successful accounting write prunes older-day rows; a stopped/unused server can retain its previous day until used again. Expired minute timestamps are removed when the corresponding scope next receives an accepted request; they remain bounded by its minute allowance. SQLite free pages, WAL files and backups can retain older bytes. No forensic-erasure guarantee is made.

Browser/game-library export and erasure deliberately leave these operational counters in place. Their purpose and retention are separate from saved chess material. The operator can inspect the private database with SQLite tools. To erase/reset it deliberately, stop **every** server using it, remove the usage database and its `-wal`/`-shm` sidecars, then restart; this resets all local budgets and rates. Do not remove the separate library database unless its chess data should also be erased. Backups need the operator's own retention/deletion policy.

## Local Docker package

TODO 12.2 packages the Node gateway, optional private library and built browser app.
It preserves the [local single-user scope](#deployment-decision-local-single-user-app). The image is built from
this checkout; no registry publication or release is performed by the workflow.
The actual [minimal-runtime Linux run](https://github.com/gregoryyy/kibitz/actions/runs/40166278799)
passes four image/browser/restart/previous-packaging compatibility cases at source
`92ccc07`, alongside publisher-signature and raw advisory verification.
[Current evidence](../security/2026-10-25-image-advisories.json) records exact identities.
The [earlier packaging evidence](../security/2026-10-25-container.json) remains historical.

The [image advisory check](../security/supply-chain.md#packaged-image-advisory-evidence) adds a pinned scanner and fresh
database to the same CI-built image, retaining raw findings and failing on
high/critical results or incomplete package evidence. Actual verification has zero
high/critical runtime findings; 23 medium and eight low remain for triage.

Use Docker Engine 28 or newer and the Compose plugin. The explicit loopback mapping
follows [Docker's port-publishing behavior](https://docs.docker.com/engine/network/port-publishing/).
The server listens on the container interface so the bridge mapping can reach it;
the supplied host mapping is `127.0.0.1:8765`, preserving local browser access.

From the repository root:

```sh
docker compose --env-file /dev/null up --build -d
```

Open `http://127.0.0.1:8765/`. The supplied
[Compose configuration](../../compose.yaml) uses the **mock coach** and a named private
data volume. This is a reproducible local starting point with no provider keys or
inference cost. `--env-file /dev/null` prevents implicit Compose loading of an
operator `.env`; the app's default command also uses `--env=`. Real provider setup
requires explicit runtime configuration and the app's separate sharing permission.
The original fonts are [bundled locally](../security/supply-chain.md#browser-styles-and-bundled-fonts); normal and offline pages use the same strict font/style policy.

The minimal runtime uses explicit UID/GID `1000:1000`, preserving the previous named user's file ownership, with a read-only root
filesystem, `/tmp` tmpfs, dropped capabilities, no new privileges and Docker init.
The static health check reads only the public manifest: it tests serving, rather
than provider/model readiness, and creates no usage cookie or inference request.

```sh
docker compose --env-file /dev/null logs --tail 50 kibitz
docker compose --env-file /dev/null stop kibitz
docker compose --env-file /dev/null start kibitz
```

Private SQLite usage and library files live in `/data`, outside the served `dist/`.
The named volume survives container recreation and ordinary `docker compose down`.
Browser history, preferences and browser-local libraries remain in the browser;
enabling server storage does not automatically upload them. Use the app's
[export/erasure controls](readme.md#data-export-and-deletion) for the appropriate storage scope. Deleting the
Docker volume deletes its private server data; it is not an upgrade step.

For a filesystem backup, stop the service, copy the whole private directory, then
start it again. Keep the database files and any SQLite WAL companions together:

```sh
docker compose --env-file /dev/null stop kibitz
docker compose --env-file /dev/null cp kibitz:/data ./kibitz-data-backup
docker compose --env-file /dev/null start kibitz
```

The [Compose copy command](https://docs.docker.com/reference/cli/docker/compose/cp/)
copies private data to the selected local directory; keep that copy private and
outside Git/public hosting. Restore requires the same whole-directory consistency,
UID 1000 ownership and restrictive permissions. Automatic migrations, backup
encryption and restore testing are not supplied by this packaging change.

To use a plain Docker command instead:

```sh
docker build --tag kibitz:local .
docker volume create kibitz-data
docker run --detach --name kibitz --init --read-only --cap-drop ALL \
  --security-opt no-new-privileges --tmpfs /tmp:mode=1777 \
  --publish 127.0.0.1:8765:8765 \
  --mount type=volume,src=kibitz-data,dst=/data kibitz:local
```

[Runtime environment options](https://docs.docker.com/reference/cli/docker/container/run/)
can supply the provider/model configuration, for example an explicit
`--env-file /absolute/path/to/docker-provider.env`. Use Docker's env-file syntax
(literal values, without surrounding shell quotes); this is runtime input, never
a build argument or a file copied into the image. Select `AI_PROVIDER` explicitly
to replace the mock default, follow [.env.example](../../.env.example), and grant the
chosen provider permission in Settings before sharing chess text. The container
has its own loopback: a native Ollama service at host `127.0.0.1:11434` is not that
address inside a bridge container. Use a deliberately reachable private endpoint
or the [native Node/Ollama setup](#self-host-with-native-ollama).

GGUF models and operator files are not included. A model directory can be mounted
read-only outside `dist/` and explicitly selected with the existing CLI options;
the fixed catalogue/verification and explicit browser Load still apply. Chrome's
optional built-in model remains browser-managed. Packaging starts no model download.

The [Dockerfile](../../Dockerfile) uses the official
[Node 24 image](https://github.com/nodejs/docker-node/blob/main/README.md), pinned to
manifest `sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`.
Separate build and production-dependency stages use that image and the existing
lockfile with install scripts disabled. The runtime uses the publisher-verified
Distroless Node 24/Debian 13 manifest recorded in [image advisory evidence](../security/supply-chain.md#packaged-image-advisory-evidence).
It includes the app's declared production
dependencies, built WASM/client assets and licence notices. It omits development
dependencies, build scripts, tests and checkout metadata. Shared pure source
modules remain outside the public tree because the server imports them.
[The build-context allowlist](../../.dockerignore) excludes operator environment,
private data, Git metadata, local builds and downloaded models.

The [read-token container workflow](../../.github/workflows/container.yml) builds a
local image, validates Compose without an env file, installs a test browser and
runs four actual image cases: process/filesystem boundaries, real Stockfish/mock
coach UI, private volume/cookie isolation across restart, and reopening a volume
from the previous packaging recipe. Both recipes use the current app/schema;
the fourth case checks packaging compatibility. A synthetic private
file in the allowed server source tree tests the env exclusion. It records image
ID/source revision and the Debian package inventory for thirty days; failure
traces last seven days. It never logs into a registry, pushes an image or uses
provider credentials. Run the explicit tests after building the named test image:

```sh
docker build --file site/tests/fixtures/previous-runtime.Dockerfile --tag kibitz:previous-runtime .
docker build --tag kibitz:container-test .
cd site
npx playwright test --config playwright.container.config.mjs
```

Ordinary unit/e2e commands do not start Docker. The local Docker daemon was
unavailable during preparation; actual image verification ran in Linux CI.
Compose validation, context exclusion, UID/permissions, packaged engine/coach,
cookie isolation, private data/usage restart and static health all pass there.
The current retained inventory covers fourteen OS package versions; the earlier
Bookworm packaging had 88 entries. The first restart test used an
old ephemeral host port; the corrected test re-reads Docker's mapping while
keeping its cookie contexts and persistence assertions. The supplied Compose
recipe uses a fixed host port.
Other architectures and image vulnerability/advisory coverage require their own
evidence. The metadata inventory is not an advisory clearance or release approval.
Local HTTP, cookie prefixes/HSTS, account/session limits and other
[ASVS deviations](../security/asvs.md) remain. Excluding Git in a packaged process does not
change a native checkout's process access. The CSS/font findings were addressed
in [11.5.1](../security/supply-chain.md#browser-styles-and-bundled-fonts); component coverage and LLM identity/prose limits remain open.

## Native HTTPS for the local app

The owner selected native Node HTTPS with operator-supplied certificates on
2026-10-25. This completes the listener prerequisite **TODO 11.4.2.7.1**.
The twelve [ASVS remediation items](../TODO.md) remain open: HTTPS support alone
does not supply cookie migration, authentication, HSTS, final endpoint inventory
or public-certificate evidence, and does not close the final-release gate.

### Start with an existing certificate and private key

From the repository root, after building:

```sh
npm --prefix site run build
node site/scripts/serve.mjs site/dist --api --env .env \
  --index _test.html --host 127.0.0.1 --port 8765 \
  --usage .kibitz-data/usage.sqlite --library .kibitz-data/library.sqlite \
  --tls-key .kibitz-data/tls/key.pem --tls-cert .kibitz-data/tls/cert.pem
```

Supply both files before running this command. The server neither generates
certificates nor installs a certificate authority or changes a system/browser
trust store. The unencrypted PEM private key and PEM certificate/chain must be
matching, readable regular files outside **both** the static and optional model
directories. Each is limited to one MiB, including actual bytes read; empty
files, leaf symlinks and multiply linked files are refused. Parent aliases are
resolved before the public-directory exclusion check. Parent directories and
their writers remain trusted; this does not sandbox a malicious filesystem owner.

On POSIX systems the private key must have no group/other permissions, normally
mode `0600`; the process user must be able to read it. Copy managed/symlinked
identities into operator-owned regular files outside public roots when needed.
The loader checks the opened descriptor's type/permissions and bounds its read;
it does not change file permissions, fetch identities or print key/certificate
contents, filenames or raw OpenSSL errors. Invalid or incomplete TLS options
exit before private database creation and do not open an HTTP fallback listener.

Open the printed **`https://127.0.0.1:8765/`** URL. The certificate must match that
IP address; use `--host localhost` and its printed URL only with a matching DNS
identity. The browser must trust the issuer through the operator's normal trust
configuration. Supported API Host values remain localhost/IP literals; a new
custom DNS hostname needs the separate rebinding/hostname review. Do not bypass
certificate warnings or disable certificate verification to operate the app.

The server uses Node's
[`https.createServer()`](https://github.com/nodejs/node/blob/v24.22.1/doc/api/https.md#httpscreateserveroptions-requestlistener)
and sets the [TLS minimum](https://github.com/nodejs/node/blob/v24.22.1/doc/api/tls.md#tlscreatesecurecontextoptions)
to 1.2; native clients test both TLS 1.2 and 1.3 and reject older negotiation.
This is configuration/test evidence, not an inventory of the operator's actual
providers or proof of public certificate trust. Certificate chain, hostname,
expiry, renewal and actual endpoint verification retain their ASVS TODOs.
Identities are loaded at startup: stop/restart with the replacement pair after
renewal; no automatic reload or renewal service is provided.

### Existing data and RC compatibility

HTTP and HTTPS are different browser origins. Changing scheme/hostname/port can
change access to localStorage, IndexedDB and service-worker caches. Before
changing the URL, export browser data and the selected server library and keep
an appropriate browser-profile/private-SQLite backup as described in
[data lifecycle](readme.md#data-export-and-deletion) and [container operation](#local-docker-package).
This listener feature performs no browser-origin, cookie or database migration.

New grouping cookies issued on the real TLS socket have Secure; forwarding
headers cannot select that flag. Existing valid cookies retain their token and
are not automatically reissued with a new name/flag. Secure prefixes and a
data-preserving migration are still **TODO 11.4.2.1**, and issued/revocable
operator sessions remain **11.4.2.3–11.4.2.5**. These cookies are not authentication.

With neither TLS option supplied, the existing HTTP RC/development behavior
remains. Supplying even one option explicitly selects TLS validation; a partial,
empty or invalid pair never silently chooses HTTP. Default/final-deployment
enforcement and external-service transport policy remain **11.4.2.7**.
The owner requires all twelve ASVS conditions fixed and verified before the
first final release; the RC's HTTP exception is not final-release acceptance.

### Container use and verification

The packaged CLI accepts the same options. Mount both regular files outside
`/app/site/dist` and any model root, read-only, and ensure the non-root runtime
UID/GID `1000:1000` can read the private key with owner-only permissions. Do not
copy identities into the image/build context. Keep loopback-only port publishing.
The current HTTP Compose recipe remains an RC recipe; it does not enable TLS
by loading a host `.env` or infer an operator's certificate locations.

When overriding the container command for HTTPS, also set
`KIBITZ_HEALTH_HTTPS=1`. If the issuer is outside Node's default trust store, set
`KIBITZ_HEALTH_CA` to a read-only mounted **public CA certificate** file trusted
for this probe; this setting does not change provider or browser trust. The
fixed probe uses `https://127.0.0.1:8765/manifest.webmanifest` and normal
chain/hostname validation with a four-second total deadline, no redirects and
no private key, cookie, provider request or model load. The certificate must
therefore include `127.0.0.1` in its subject alternative names. Without the TLS
flag the existing HTTP probe remains; invalid trust settings fail the probe.
A running TLS listener does not make an HTTP health check succeed.
The explicit image test mounts synthetic identities
read-only, runs the app as UID 1000 and checks an HTTPS health probe; its fixture
CA is trusted only for that probe. This is not an operator-deployment certificate.

Reproduce native checks after a build:

```sh
cd site
npm run check
node --test server/tls.test.mjs
npx playwright test tests/e2e/native-https.spec.mjs tests/e2e/cookie-transport.spec.mjs
```

The tests generate short-lived identities in temporary private directories.
Native clients validate the exact fixture CA and hostname and reject untrusted
chains/wrong names/older protocols; plaintext cannot reach the TLS application.
The browser test alone allows its generated test certificate, exercises the
real built board/Stockfish/mock coach/private library and retains the normal CSP
checks. No operator identity, trust-store installation, inference or model
download is used. The separate Linux image workflow runs the packaged TLS case;
ordinary native tests do not start Docker.

## Local server logs and monitoring

This guide covers TODO 12.3 for the [local single-user deployment](#deployment-decision-local-single-user-app).
The Node HTTP server emits one JSON line per completed or disconnected request.
Application events contain fixed categories, numbers and booleans:

| Event | Fields beyond the UTC `at` timestamp | Meaning |
| --- | --- | --- |
| `http` | `method`, `route`, `status`, `complete`, `ms` | Response status and elapsed milliseconds, capped at one day. A disconnect before completion has status `0` and `complete: false`. |
| `ai_error` | `action`, `provider`, `code`, `status` | Sample, structured, connection-test or embedding failure. Status is the exception's numeric HTTP status, or `0` if absent/invalid. Cancelled work emits no AI error. |
| `ai_config` | `provider`, `available`, `localOnly` | Initial gateway configuration or a successful settings change. Availability means configured, without testing connectivity. |
| `file_error` | `resource`, `code` | Static/model I/O failure using fixed categories, without a path or raw exception. Missing/denied files use HTTP 404 without a separate fault event. |
| `server_error` | `code`, `hint` | Startup/listener failure with an allowlisted system code and a fixed operator hint. |

Methods, providers, actions, routes and codes use closed vocabularies; unknown values
become `OTHER`/`other`. Routes distinguish known AI endpoints, `library`, `model`,
`api.other`, `static` and `invalid`. Personal library IDs and file/model names never
become categories. Recognized HTTP statuses are integers from 100 through 599.
See [field construction](../../site/server/logging.mjs).

These events omit request URLs, paths, queries, IPs, cookies, request/response bodies,
prompts, answers, tokens identifying a browser, model IDs, endpoint overrides and raw
SDK messages/stacks. Redacting key-shaped strings alone would still permit reflected
personal text. Provider HTTP 400 errors now return fixed public hints for recognized
tool/chat/format/schema/context failures, or a generic rejection. Raw provider prose,
model IDs, endpoints and reflected credentials are not copied into those page-facing
messages. Tool capability handling uses the same explicit support classifier. Other
model output and operator/runtime diagnostics retain their separate trust boundaries.
Production gateway SDK loggers are silenced even when vendor debug environment
settings are inherited; application events remain the diagnostic interface.

Startup also prints fixed readiness/usage/offline messages. Loopback startup reports
its local URL and actual port; other bindings report only the port and “configured
interface”. Directory paths, arbitrary hostnames and model names are omitted. There
is no verbose mode that restores request/provider payload logging. Node/runtime
warnings, OS diagnostics and operator utilities (benchmarks, fixture capture and the
flipbook) have their own output; the HTTP event contract does not cover those tools.
Static/model reads now share descriptor validation, bounded streams and handled failures
(11.2.5). Other scanner contexts and post-merge verification remain tracked in
[#99](https://github.com/gregoryyy/kibitz/issues/99).

### Running and retaining logs

`just serve` shows events in the terminal. If retaining them, create a private local
directory outside all served roots and restrict the file to the operator. For example,
from the repository root, after `just build`:

```sh
umask 077
mkdir -p .kibitz-data
chmod 700 .kibitz-data
node site/scripts/serve.mjs site/dist --api --env .env --index _test.html \
  --usage .kibitz-data/usage.sqlite > .kibitz-data/runtime.log 2>&1
```

Logs are neither persisted nor rotated by the application. The operator controls
retention and should rotate/remove saved logs between runs as needed; a redirected
file can grow without a bound on total requests. Browser/server library erasure does
not delete operational logs or copies. Do not add a proxy/access logger that saves raw
URLs or cookies when preserving this policy.

### Checking the local server

For a no-inference liveness check, use:

```sh
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8765/
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8765/api/ai/status
```

The first checks static serving; the second checks the enabled gateway handler.
Neither verifies model/provider connectivity. Inspect Settings for actual configured
models and availability. The connection-test button makes a model request and may
cost money; do not use `/api/ai/test` as an automatic health probe.

To inspect application events in a saved log without printing other diagnostics:

```sh
node --input-type=module -e '
import fs from "node:fs";
for (const line of fs.readFileSync(".kibitz-data/runtime.log", "utf8").split("\n")) {
  try {
    const e = JSON.parse(line);
    if (e.event === "ai_error" || e.event === "file_error" || e.event === "server_error" ||
        (e.event === "http" && (!e.complete || e.status >= 400))) console.log(JSON.stringify(e));
  } catch {}
}'
```

Inspect `file_error` for disk/resource faults or a file truncated during transfer. A
failed stream is terminated, while an HTML read failure before headers returns 500.
Descriptors close after completion, HEAD, empty files, errors and disconnects.

Watch repeated `auth_failed`/`model_not_found` failures for configuration problems,
`rate_limited`/`budget_exceeded` for admission limits, `timeout`/`provider_error`
for unavailable services, and `response_too_large` for exceeded response bounds.
See [total deadlines, byte caps and accounting limits](#provider-response-bounds).
A streamed answer may have HTTP status 200 and still emit
an `ai_error`, so inspect both event types. HTTP disconnects alone do not establish an
attack. There are no hosted dashboards, automatic paging or user-level audit trails;
monitoring in this deployment is operator-run. Review CI/security findings separately
before any release.

### Regression evidence

[Unit/server cases](../../site/server/logging.test.mjs) use fake SDK clients that reflect
synthetic prompt, answer, cookie and key markers on all four AI routes, including a
late stream failure, provider changes during a request and hostile code/status fields.
[Real-CLI Playwright cases](../../site/tests/e2e/private-logs.spec.mjs) check URL/query/control
markers, malformed request targets and startup path failures against actual stdout
and stderr. These are regression evidence for covered paths, not a release audit or
a guarantee about external runtime diagnostics.
