# Authenticated client-data lifecycle (experimental)

TODO 11.4.2.11 / ASVS 14.3.1 remains **open**. This document separates the first
implemented library-cache boundary (11.4.2.11.1) from the remaining release work.
Backend [session termination](SESSION-TERMINATION.md), [permissions](PERMISSIONS.md)
and deliberate [data erasure](DATA.md) retain their separate contracts.

## Implemented library-cache boundary

Settings and the data page withdraw their current server-library snapshot and
explicitly delete the named `kibitz-library` IndexedDB database before a fresh
sign-in and on every explicit sign-out attempt. Sign-out begins local cleanup
without waiting for a server response: an offline/failed request can leave the
backend session valid, but does not prevent local cache deletion. The interface
reports backend logout and cache erasure separately. A blocked/failed deletion is
not reported as completed; close other Kibitz tabs and retry the visible sign-out
control. A fresh sign-in is blocked until its cleanup succeeds.

An authoritative `session_expired`, `no_session`, changed owner, denied permission
or unverifiable permission response to the server-library session withdraws the
snapshot and clears all buckets in this derived cache. It cannot use the old
snapshot as an offline fallback. An ordinary network outage retains the existing
read-only fallback contract only after a freshly verified owner scope. There is
no new background expiry timer in this milestone.

`site/src/library/cache.js` cancels pending opens/transactions, closes its
connection and waits for native database deletion. Generation checks run before
and after persistence. Explicit cleanup may erase a future/unknown format of
this known noncanonical cache; normal reads/writes still preserve such formats.
A blocked delete waits at most three seconds before reporting failure. It may
finish later when a blocker closes; callers still need an explicit successful
retry before treating cleanup as acknowledged. Other live owned connections
close on deletion and refuse implicit repopulation until explicitly reset.

`site/src/library/server-session.js` immediately withdraws RAM state and aborts
pending network work on termination. Queued/late responses cannot republish or
save their old snapshot. Reconnect waits for cleanup and remains blocked after
failure until an explicit retry. Switching library views normally remains a
non-erasing operation. The data page separately aborts/fences pending reads, so
a late result cannot restore export/erase controls after sign-out.

This boundary deletes neither authoritative server SQLite records nor canonical
browser-local games, references, settings or progress. Ordinary close/reload is
not a deletion instruction. Existing backend recovery and browser exports remain
available. No production identity, trust, provider or model operation is involved.

## Verification

- `site/tests/unit/library-session.test.mjs`: identity-error classification,
  no fallback, all-bucket erasure, immediate withdrawal, blocked/retried cleanup,
  reconnect gating, queued/late responses, notification reentrancy and view changes.
- `site/tests/e2e/library-cache.spec.mjs`: real IndexedDB transaction completion,
  abort, pending-open cancellation, explicit deletion, external deletion fencing,
  blocked cleanup/retry and preservation of future formats during ordinary use.
- `site/tests/e2e/library-session-boundary.spec.mjs`: real expiry fallback and
  termination during a cache transaction, without resurrection.
- `site/tests/e2e/session-termination.spec.mjs`: actual synthetic HTTPS/backend
  logout and recovery, German mobile data controls, failed/offline logout with
  local erasure, blocked cache deletion/retry and a delayed data-page read.
- Existing `operator-session.spec.mjs` and `library-storage.spec.mjs` retain
  sign-in/privacy, explicit source selection, storage and recovery coverage.

The expiry browser regression must also fail against the preceding build by
showing its cached snapshot after the authoritative 401. Focused local results
and subsequent full CI are recorded in the implementation PR; they are separate
evidence rather than release approval.

## Remaining release work

The parent control requires clearing **all authenticated client data** when the
client or session terminates, including loss of the server connection. The
library-cache boundary alone does not satisfy it. Active board/game state, chat,
undo/return positions, rendered source details, private drafts, worker/model
contexts, reusable derived indexes and browser autosave need a coordinated
ownership/lifecycle boundary. Existing records such as `kibitz.current` need
explicit provenance, backup and migration handling before their retention or
removal policy can change.

Propagation of authentication failure from other clients (such as the gateway or
data-page requests), automatic offline expiry, client termination/BFCache behavior, cross-tab
notification and in-memory data already loaded in other tabs also remain open.
Deleting a cache causes owned connections to close, but does not erase data
already copied into another tab's DOM/RAM. Backend logout cannot recall provider
requests or external exports. The remaining work must preserve independently
saved browser collections and authoritative server recovery, fence late work,
and test failure/recovery before ASVS 14.3.1 can become verified. The native
release targets selected by the owner are macOS and Linux; hosted accounts remain
outside the current local single-user scope.
