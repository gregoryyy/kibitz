# Authenticated client-data lifecycle (experimental)

TODO 11.4.2.11 / ASVS 14.3.1 remains **open**. This document separates the first
implemented library-cache boundary (11.4.2.11.1) and shared session boundary
(11.4.2.11.2) from the remaining release work.
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
now a shared expiry/invalidation boundary as described below.

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

## Shared session boundary

`site/src/platform/client-session.js` now mediates local gateway and library
transports in the app and data page. Before the first protected request, it
verifies `api/session/status`. That bounded, non-cacheable status and a successful
sign-in include a `clientId`: a domain-separated SHA-256 change detector derived
from the backend token. It is distinct from the registry verifier, grants no
permission and cannot be substituted for a token. The HttpOnly token and operator
proof are never exposed through this metadata. Upgrade the server and browser
assets together; a required-session response lacking this metadata fails closed.

A 401 from any mediated gateway, embedding or data/library request ends the local
client boundary even if its error body is malformed. Abort pending transports,
cancel unread/streaming bodies, fence responses across the whole body, withdraw
the library and cancel the app's reusable coaching/search work. A function-specific
403 is not an installation-wide logout; explicit permissions retain their own
backend and library checks. An ordinary outage does not turn into a new
identity or extend the observed expiry.

Track the backend's absolute expiry with wall-clock and elapsed-time checks. Keep
the earliest elapsed deadline for repeated observations of the same client ID,
so a clock rollback does not extend it while elapsed time advances. Expiry can
clear the library without contacting the server. Check again before protected
work, on visibility/pageshow/online events and with a 30-second visible-document
status poll. Suspended documents run checks when the browser resumes; this is
not an assertion that browser timers execute during system suspension. Backend
expiry/revocation checks remain authoritative independently of the client clock.
The [High Resolution Time draft](https://www.w3.org/TR/hr-time-3/) describes the
distinction between wall-clock adjustments and monotonically increasing time.

A same-origin BroadcastChannel and the storage event invalidate other live app
and data-page clients. Broadcast only a version, event type and random nonce.
The small `kibitz.sessionBoundary` marker contains a version, random nonce and a
blocked-or-active marker; it contains no session identifier, token,
proof, prompt, PGN or provider answer. Recheck it before protected work to catch
missed events. A changed client ID or marker invalidates the existing client;
passive status probes cannot adopt it. A retained marker also guards cached browser-coach
fallback before online status verification, including when all session APIs are
unreachable after reload. Only fresh proof plus acknowledged cleanup
can activate that ended client. After an acknowledged marker write, an offline
sign-out also remains locally ended across reloads, even if its backend cookie is
still valid. A later termination conservatively blocks all cookies until another explicit
fresh proof completes.

Marker commits use an exclusive same-origin [Web Lock](https://www.w3.org/TR/web-locks/),
with a three-second limit for waiting to acquire it. After cleanup, a sign-in
captures its client generation and persisted marker nonce before sending proof.
Check both under the lock before activation, so a delayed response cannot overwrite
a newer termination, even if its cross-tab event has not arrived. Hold no lock
across the proof request. Whole-browser erasure uses the same lock. Required-session
activation fails closed if Web Locks/storage coordination is missing or refused;
ordinary HTTP development does not need this authenticated boundary.

If local marker persistence or cache deletion fails, do not acknowledge complete
local termination or activate a fresh sign-in. Distinguish pending cleanup from
failed cleanup and show separate storage/cache messages. Fix storage/close blocking
tabs and retry. An unacknowledged failed marker write cannot promise durable
termination across destruction of the client; the live client remains blocked.
This does not claim backend revocation while offline.

Browser export includes the owned marker as raw local metadata. Deliberate whole
browser erasure resets it, while retaining the existing contract that the current
backend session/server records remain usable. The data page acknowledges that
explicit reset in its in-memory boundary so its next visibility/status check
does not immediately recreate browser keys. Whole-browser erasure is distinct
from signing out; other live tabs receive invalidation. HTTP development and the
artifact host retain their separate non-final scopes.

## Verification

- `site/tests/unit/client-session.test.mjs` and
  `site/server/session-api.test.mjs`: expiry/clock/reload and marker handling,
  stream cancellation, cross-tab signalling, nonauthorizing backend metadata and
  preservation of ordinary development and deliberate browser-erasure behavior.
- `site/tests/e2e/client-session-lifecycle.spec.mjs`: actual gateway/data-page 401,
  offline expiry, cross-tab sign-out/reload/fresh proof, marker-storage failure and
  native browser erasure without recreated keys, blocked offline browser-coach
  fallback, a held actual fresh-proof response after a newer termination, and
  an actual held Web Lock with bounded refusal and recovery before proof dispatch.
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

The original expiry regression fails against its preceding build by showing a
cached snapshot after the authoritative 401. The shared-boundary gateway-401
regression fails against the preceding build by retaining its private library
card while only the gateway reports authentication failure. Focused local results
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

The shared boundary now propagates mediated transport failures and observed
expiry/replacement across live clients. Full client termination/BFCache cleanup
and private data already copied into a tab's board, DOM, drafts or workers remain
open. Application startup still restores existing browser autosave before complete
private-data ownership/migration is implemented.
Deleting a cache causes owned connections to close, but does not erase data
already copied into another tab's DOM/RAM. Backend logout cannot recall provider
requests or external exports. The remaining work must preserve independently
saved browser collections and authoritative server recovery, fence late work,
and test failure/recovery before ASVS 14.3.1 can become verified. The native
release targets selected by the owner are macOS and Linux; hosted accounts remain
outside the current local single-user scope.
