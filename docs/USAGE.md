# Local usage limits

TODO 2.11 targets the local single-user app. HTTPS gateway access now requires an
experimental [backend-issued operator session](SESSIONS.md). Its registered claims
select the usage group; invented session tokens or raw grouping assertions fail.
Protected HttpOnly `__Secure-kibitz_uid` locators at `/api/` preserve the same group
only after fresh operator proof during migration/recovery. The library has its own
separate locator. Explicit HTTP development uses synthetic `kibitz_dev_*` groups
without authentication and stays outside final deployment.

Limits remain per collection/group, not hosted account budgets. An authenticated
operator can explicitly create another collection; this does not evade shared
server allowances. Same-host migration preserves existing counters, while a new
`.test` hostname creates separate browser cookies/storage/groups. Original counters
remain in SQLite and can be inspected through proof-authorized trusted-TLS
legacy-origin recovery with the original profile. See [migration](COOKIE-MIGRATION.md).

`just serve`, `just offline` and `npm run serve` select the gitignored private `.kibitz-data/usage.sqlite`. Counters survive a server restart. For a direct invocation, opt in explicitly:

```sh
node site/scripts/serve.mjs site/dist --api --env .env --operator .kibitz-data/tls/operator.json --permissions .kibitz-data/tls/permissions.json --sessions .kibitz-data/sessions.sqlite --tls-key .kibitz-data/tls/key.pem --tls-cert .kibitz-data/tls/cert.pem --usage .kibitz-data/usage.sqlite --index _test.html
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

## Provider response bounds

The OpenAI gateway uses Chat Completions. For the exact selected model `gpt-6-luna`, it sends `reasoning_effort: none` on every turn, including connection tests, structured replies and tool continuations. This follows the model's [documented function-calling requirement](https://developers.openai.com/api/docs/models/gpt-6-luna). The choice follows the actual per-task model; other model IDs and Mistral/Ollama receive no added reasoning parameter. This transport setting is not evidence of live model availability or chess-answer quality.

Each network-provider chat or embedding operation has one independent deadline covering headers, response consumption, SDK iteration/parsing and final decoded results. Positive `AI_TIMEOUT_MS` values round up to milliseconds and cap at fifteen minutes; invalid/nonpositive configuration uses the existing sixty-second default. Connection tests have the same bounds and now propagate browser disconnects. Caller cancellation and deadline failure abort transport, cancel active readers and prevent late results from being applied; monotonic deadline checks also reject results after synchronous work delays timer delivery. JavaScript cannot preempt a synchronous parser mid-instruction.

The fixed response-body cap is **8 MiB per operation**, measured after HTTP decompression and including SSE framing, invisible fields, tool arguments and error bodies. Decoded coaching text plus tool/result metadata has a smaller **128 KiB cumulative cap** before forwarding to the page. Decoded embedding JSON has an 8 MiB cap to allow vector batches. Injected test clients obey the decoded limits too. Ollama embedding inspection and vector response share one operation's clock/body counter, so failed inspection cannot proceed to text upload. These are per-call limits, not global memory reservations or spending caps.

Gateway-created SDK clients disable automatic SDK retries/backoff. A connection or provider failure is returned for an explicit later retry; SDK debug loggers are silenced so configured vendor debug modes cannot bypass category-only app events. Existing native/JSON fallback, model-tool rounds and Anthropic server-side refusal fallback remain separate behavior: structured output can still make two bounded calls, while a response-limit/timeout failure does not trigger a format retry. Fixture capture keeps its own tighter limits.

Timeouts return `timeout` (HTTP 504); body/result overflow returns `response_too_large` (HTTP 502). Streamed coach responses may already have HTTP 200 and end with an error frame; the page replaces the partial answer with a fixed translated hint. Disconnected work is `cancelled` and emits no AI-failure event. Failed/incomplete work keeps its rate-admission slot but supplies no completed-usage entry; the provider may already have performed/billed work. Aborting a socket cannot recall a provider's accepted work or guarantee its usage report. Daily thresholds retain the limits below.

## Admission thresholds and durability

Budget checks compare completed usage before accepting another request. The final request can cross a threshold; concurrent requests, format/tool/server-side fallbacks, incomplete provider usage and a process crash during generation can exceed or under-report it. These are **not hard billing caps or token reservations**. Configure provider-side spending limits when a hard financial limit is required. A provider switch while a response is pending retains the request's original paid/local classification.

Admission commits server/user minute slots before inference. Completion commits both daily ledgers in one SQLite transaction, with WAL and synchronous FULL. Separate server processes using the same file see committed counters. Private-storage, schema and capacity failures refuse operation without silently resetting or falling back to memory. A failure while recording already completed inference cannot undo provider work. At most 10,000 current-day user scopes are accepted; capacity exhaustion preserves existing budgets and rejects another scope.

## Stored data and lifecycle

The private file contains current-day numeric totals (requests, tokens, estimated costs, unpriced/paid tokens), recent admission timestamps and SHA-256 hashes of cookie IDs. It contains no raw cookies, prompts, answers, game scores, notes, API keys or model IDs. The library and usage databases are separate, versioned schemas. The separate
[session registry](SESSIONS.md) does contain private raw grouping locators for
proof-authorized recovery; it needs its own private backup/retention handling. Unknown schemas/data remain intact and fail closed.

New directories use mode 0700 and files 0600. Paths inside either served root (static files and any separate `--models` directory), including parent symlink aliases, public-readable files and final symlinks are refused. An explicit model directory must already exist; invalid/missing model roots fail startup before database files or their parents are created. The same path policy protects library databases. SQLite sidecars remain operator-managed private files. Paths are operator-selected and never supplied by HTTP callers.

Only current-day counters are consulted. The next successful accounting write prunes older-day rows; a stopped/unused server can retain its previous day until used again. Expired minute timestamps are removed when the corresponding scope next receives an accepted request; they remain bounded by its minute allowance. SQLite free pages, WAL files and backups can retain older bytes. No forensic-erasure guarantee is made.

Browser/game-library export and erasure deliberately leave these operational counters in place. Their purpose and retention are separate from saved chess material. The operator can inspect the private database with SQLite tools. To erase/reset it deliberately, stop **every** server using it, remove the usage database and its `-wal`/`-shm` sidecars, then restart; this resets all local budgets and rates. Do not remove the separate library database unless its chess data should also be erased. Backups need the operator's own retention/deletion policy.

[Protected-cookie migration](COOKIE-MIGRATION.md) preserves the exact usage ID,
so existing hashes, current-day counters and rate admissions survive the rename.
Explicit HTTP development uses `kibitz_dev_uid`, separate from production
identities; use a separate development database too. These cookies are still
local grouping rather than authenticated operator sessions.
