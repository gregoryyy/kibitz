# Backend session termination (experimental)

TODO 11.4.2.4 / ASVS 7.4.1 extends [operator sessions](SESSIONS.md).
**Sign out** in Settings or Your data sends a same-origin JSON POST to
`/api/session/logout`. The backend deletes the presented operator/credential-bound
session row before acknowledging success, then expires the host-only session
cookie at Path=/. A copied token cannot authorize another request, including in
another tab or after a server restart. Invalid, unknown, duplicate or other-owner
tokens cannot terminate someone else's session. Foreign Origin and malformed
requests fail before revocation; there is no GET or plaintext logout fallback.

The response means backend termination was acknowledged. A failed or unavailable
request is shown as unconfirmed, with retry available; closing the page or clearing
a browser cookie is not reported as successful backend logout. The explicit HTTP
development mode has no operator authentication and does not acquire a pretend
logout operation. No paid connection test runs on login/logout.

## Expiry, reauthentication and concurrency

The persisted absolute expiry denies access independently of browser cookie
expiry. Reauthentication replaces the previous operator-owned token atomically.
Neither logout nor expiry changes the original usage/library schema or deletes
private collections. Restart does not resurrect a deleted/expired token; sessions
that have not terminated retain their existing lifetime across restart.

Authenticated requests carry an internal server guard. The gateway/library checks
it after asynchronous body/validation/provider work and before protected output
or mutation. Synchronous output and private mutation boundaries are serialized
against revocation through a short SQLite registry transaction: another native
process cannot acknowledge revocation in the middle of that protected action.
No transaction stays open across an awaited provider operation.

Within a process, logout/reauthentication closes other responses using the old
session immediately. Absolute-expiry timers and a 250-ms registry poll close
held responses, including revocation from another process using the same registry.
Closing them aborts the existing chat/structured/connection-test/embedding
controllers. Every streamed emission and successful JSON response rechecks the
registry; a provider that ignores cancellation still cannot return a late private
result. A library write held in asynchronous validation is rejected before its
mutation after termination. Registry/storage errors fail closed.

Already committed actions, bytes already emitted and work a provider already
accepted cannot be recalled. Completed accepted inference may still be accounted
for after cancellation, as described in [usage accounting](USAGE.md). Polling is
bounded proactive cancellation, not a claim of instantaneous cross-process
transport shutdown. Synchronous JavaScript cannot be interrupted mid-instruction;
protected actions are ordered with revocation rather than undone after commit.
An uncertain write acknowledgement still requires refreshing before retrying.

## Collections and recovery

Logout clears the authentication cookie while keeping the two protected,
HttpOnly collection locators. They grant no API access. Fresh operator proof
can select the same collection/counters after logout or expiry. Deleting all
locators would instead abandon the browser's route to its collection.

Issuance prunes expired session rows inside its transaction to reclaim the bounded
registry. It preserves ownership bindings, private records, counters and locator
cookies. If an old expired session row has been pruned, retained locators plus
fresh proof still recover its collection. A session token alone is not a permanent
collection backup. Keep consistent operator-file/current-database/profile backups
and exports; do not clear the registry or restore stale databases over newer writes.

This milestone establishes backend termination and basic UI acknowledgement.
**Authenticated client-data lifecycle remains TODO 11.4.2.11**: complete cleanup
of DOM, memory, browser storage, offline caches, multi-tab state and recovery is
not claimed here. [Explicit backend function permissions](PERMISSIONS.md) use a separate private
policy and do not replace this termination boundary.
The local single-user scope remains; no hosted accounts or release clearance.

## Verification

`server/session-termination.test.mjs` uses native TLS, fake providers and synthetic
private databases to test copied-token replay/restart, another operator/credential
epoch, expiry before provider admission, held stream/structured/connection-test/
embedding responses, paused private writes, absolute expiry during work and an
actual second CLI process revoking the shared registry. Exact original collection
snapshots, not a different empty collection, prove that held writes did not commit.

The Playwright termination suite exercises built Settings/Your data, another tab,
German mobile controls, cookie scope, proof-authorized recovery and failed-logout
acknowledgement/retry. Existing sign-in/native-TLS/HSTS/migration suites remain
part of validation. The default Linux image case also checks logout and copied
replay; consult its actual PR CI result before claiming packaged verification.
