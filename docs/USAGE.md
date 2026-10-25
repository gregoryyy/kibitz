# Local usage limits

TODO 2.11 targets the selected local single-user app. The gateway groups browsers by the random HttpOnly `kibitz_uid` cookie. This is usage grouping, without sign-in or authenticated quotas: clearing or replacing the cookie starts another user. Hosted account budgets remain deferred with TODO 10.2.

New usage cookies include HttpOnly, SameSite=Strict and the `/api/` path. Direct native TLS also adds Secure; local HTTP and spoofed forwarding headers do not. Existing valid IDs are reused without reissuing a cookie. The library has a separate cookie/path with the same transport policy. See the [deployment boundary](DEPLOYMENT.md).

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
| `AI_TIMEOUT_MS` | Existing provider request deadline. |

Connection tests, streamed/structured coach turns, tool follow-up turns and embeddings share both rate allowances. A refusal returns `rate_limited`/HTTP 429 and does not invoke a provider. Failed accepted calls still consume their admission slot. Host/origin/content/consent and embedding-input checks precede admission. Numeric daily counters and minute slots reset at the server's **local midnight**, and minute slots also expire after 60 seconds. Changing the system clock/time zone can move that boundary.

Daily paid-user thresholds exclude Ollama/mock. The server token threshold and gateway rates still apply to them. The in-browser model bypasses the gateway and is not counted here. Unknown model prices produce unpriced-token counts and no invented dollar charge; configure token limits as well as dollar limits. Costs are estimates based on configured prices, rather than provider invoices.

## Admission thresholds and durability

Budget checks compare completed usage before accepting another request. The final request can cross a threshold; concurrent requests, adapter retries/fallbacks, incomplete provider usage and a process crash during generation can exceed or under-report it. These are **not hard billing caps or token reservations**. Configure provider-side spending limits when a hard financial limit is required. A provider switch while a response is pending retains the request's original paid/local classification.

Admission commits server/user minute slots before inference. Completion commits both daily ledgers in one SQLite transaction, with WAL and synchronous FULL. Separate server processes using the same file see committed counters. Private-storage, schema and capacity failures refuse operation without silently resetting or falling back to memory. A failure while recording already completed inference cannot undo provider work. At most 10,000 current-day user scopes are accepted; capacity exhaustion preserves existing budgets and rejects another scope.

## Stored data and lifecycle

The private file contains current-day numeric totals (requests, tokens, estimated costs, unpriced/paid tokens), recent admission timestamps and SHA-256 hashes of cookie IDs. It contains no raw cookies, prompts, answers, game scores, notes, API keys or model IDs. The library and usage databases are separate, versioned schemas. Unknown schemas/data remain intact and fail closed.

New directories use mode 0700 and files 0600. Paths inside either served root (static files and any separate `--models` directory), including parent symlink aliases, public-readable files and final symlinks are refused. An explicit model directory must already exist; invalid/missing model roots fail startup before database files or their parents are created. The same path policy protects library databases. SQLite sidecars remain operator-managed private files. Paths are operator-selected and never supplied by HTTP callers.

Only current-day counters are consulted. The next successful accounting write prunes older-day rows; a stopped/unused server can retain its previous day until used again. Expired minute timestamps are removed when the corresponding scope next receives an accepted request; they remain bounded by its minute allowance. SQLite free pages, WAL files and backups can retain older bytes. No forensic-erasure guarantee is made.

Browser/game-library export and erasure deliberately leave these operational counters in place. Their purpose and retention are separate from saved chess material. The operator can inspect the private database with SQLite tools. To erase/reset it deliberately, stop **every** server using it, remove the usage database and its `-wal`/`-shm` sidecars, then restart; this resets all local budgets and rates. Do not remove the separate library database unless its chess data should also be erased. Backups need the operator's own retention/deletion policy.
