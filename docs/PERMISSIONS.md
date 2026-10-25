# Local operator function permissions (experimental)

TODO 11.4.2.5 / ASVS 8.2.1 adds explicit backend authorization to
[issued sessions](SESSIONS.md) and [termination](SESSION-TERMINATION.md).
Authentication, function grants, collection ownership, native Origin checks and
provider sharing consent are independent checks. Hosted accounts remain deferred.

## Create an operator-bound policy

Keep the existing operator identity and databases. Do not regenerate a key or clear
cookies to add permissions. With the existing private operator JSON, create a
new private policy explicitly:

```sh
node site/scripts/permissions.mjs .kibitz-data/tls/operator.json .kibitz-data/tls/permissions.json --all
```

`--all` explicitly selects all documented functions for this local operator. For
read-only status/library access, replace it with `ai:read library:read`. `--none`
creates an empty policy: login/status/logout still work, while every protected
function is denied. Omitting the selection is an error. The command writes a new
mode-0600 policy, never overwrites a file and never prints a key, operator ID or
private path. Setup copies the correct operator ID; it does not rotate credentials.

Native TLS gateway/library startup now requires `--permissions FILE` alongside
`--operator` and `--sessions`. Standard recipes select
`.kibitz-data/tls/permissions.json`; the default image reads `/tls/permissions.json`
from its existing read-only TLS/operator directory mount. Supply the file before
starting the container, readable by UID 1000. A missing, public, permissive,
symlinked, multiply linked, malformed, oversized or different-operator policy stops
startup before private database creation. Its bounded descriptor read uses the
same private-file boundary as the operator JSON, outside static and model roots.

The policy is JSON with exactly `version` (1), `operator` (the setup's operator
ID) and `allow` (an array of explicit names below). An empty array is valid;
unknown names, duplicates, wildcards and extra fields are rejected. Only the
trusted filesystem operator can edit it. There is no browser endpoint to change
server grants, and no grant is accepted from a cookie, body, query or consent header.
Keep the policy private and backed up with the identity/current databases/profile.

## Function rules

| Grant | Protected method and route | Additional rule |
| --- | --- | --- |
| `ai:read` | GET `/api/ai/status` | Returns status/configuration/usage; no inference |
| `ai:coach` | POST `/api/ai/sample`, `/api/ai/structured` | Applicable provider sharing consent still required |
| `ai:configure` | POST `/api/ai/config` | Changes provider/local-only configuration and returns updated status |
| `ai:test` | POST `/api/ai/test` | Can invoke a provider; separate consent/budgets/paid-call approval still apply |
| `ai:embed` | GET/POST `/api/ai/embeddings` | POST also requires embedding consent, current scope/fingerprint and budgets |
| `library:read` | GET `/api/library/status`, `/api/library/records` | Only the verified session's collection |
| `library:write` | POST `/api/library/records` | Also requires `library:read`, same collection scope and current revision |
| `library:erase` | POST `/api/library/erase` | Also requires `library:read`, same scope/revision and explicit confirmation |

A write/erase grant without read does not enable that function. Function responses
include their own result (for example configure returns updated status and a write
returns its acknowledged snapshot); grants are function-level, not field-level
redaction. Client-selected scope or record IDs cannot switch the server-held
collection or adopt another registered operator's collection. Unmapped protected
routes/methods deny by default. Login, a limited authentication-status probe,
logout and public static/health resources do not acquire these data/inference
grants. Already downloaded public browser assets/local browser-only actions are
outside the Node gateway's authorization boundary.

## Live changes and failure behavior

The backend rereads and validates the bounded policy for each function check and
again at protected asynchronous output/mutation boundaries. Existing sessions use
the current policy, not a browser-supplied or session-cached grant list. No restart
or reauthentication is required to change grants. Apply updates as trusted,
private regular-file replacements retaining the same operator binding; avoid
in-place partial edits during work. Invalid intermediate files fail closed.

Denied functions return 403 `permission_denied` before provider admission or
private data actions. Unverifiable policy returns 503 `permission_unavailable`
with a fixed message and no raw path/configuration. Held responses observe policy
revocation through the session guard and bounded polling, aborting existing SDK
controllers; late output/mutation checks still apply to uncancellable work.
Previously emitted data, committed actions or provider-accepted work cannot be
recalled; completed accepted usage retains its existing accounting rules.

Include `ai:read` for the browser’s provider controls so destination/model details
are available; direct-client function grants remain independent. Settings lists
confirmed enabled functions and disables denied provider/test
controls. Your data allows read/export without erase when only read is granted.
These UI hints do not enforce authority: direct requests are checked identically.
An explicit denied or unverifiable library permission response clears the current
snapshot and cannot fall back to a cached private collection. General authenticated
DOM/memory/storage/offline/multi-tab cleanup remains TODO 11.4.2.11; this does not
claim complete erasure of all previously obtained data or downloads.

Explicit `--http-dev` retains synthetic test/development grouping and an explicit
authorization bypass outside final deployment. It requires separate mock-only
profiles/databases. Standalone TLS API constructors without a trusted session
permission guard fail closed; isolated legacy transport fixtures inject their
mock authorizer deliberately. These do not supply final-deployment authorization.

## Verification

Policy tests cover operator binding, immutable grants, missing/unknown/duplicate
rules, private bounded loading and explicit no-overwrite setup. Actual CLI tests
exercise every protected method/route with empty and independent grant policies,
read prerequisites, unchanged denied usage/private data, client-claim rejection,
unknown functions, collection isolation and invalid-policy startup ordering.
Existing tests also reject another operator's issued token/collection with full
grants. A held fake-provider test verifies live revocation without logging out
the session. Browser tests cover deny-all, German mobile read-only controls and
live updates; previous-source regressions use the actual pre-permissions server.
The default Linux image test supplies the private policy and changes it through
a separate offline operator process to verify read-only operation, denied
connection-test/embedding/erase functions and independent logout/recovery. Its actual CI result
must be reviewed separately from native/focused browser results.
