# Data export and deletion

**Settings → Export or erase your data** opens a separate page. The game, clock, engine and app autosave do not run there. Exports download JSON files; they do not upload data or call an AI provider. Export before deletion if you want to keep a copy. Close other Kibitz tabs before erasing data, because their in-memory games or drafts can be saved again later.

## Browser data

**Download browser data** exports the raw `kibitz.*` localStorage values, with a versioned file envelope and export timestamp. This includes browser games/references, the saved game in progress, settings, profile/goals, repertoire reviews, lesson progress, practice schedules, challenge totals and cached tutor answers. Unknown/future values and original PGN text remain unchanged as raw strings. The page does not collect other origin-storage keys, cookies or `.env` files. Unsaved drafts and transient dialogue/session state are not saved by the export.

The JSON format is `kibitz-browser-data`, version 1, with `entries: [[key, rawValue], …]`. It is a portable record of saved values, without an automatic restore/import operation in this milestone. Game PGN import/export remains available in Library.

**Erase browser data…** displays an explicit confirmation. It removes the Kibitz localStorage namespace and the `kibitz-library` IndexedDB cache, including caches for previously selected server owners on this device. Deleting that whole named cache is intentional even for a future cache schema. It also unregisters this app's service worker and removes its public offline bundles, waiting for acknowledgement before erasing saved browser keys. Server records and their HttpOnly ownership cookie remain, so the server-library controls can still reach that collection. Unrelated site storage and downloaded model weights are not removed.

A preview captures the current keys/values. The operation refuses changed data before deletion and again after waiting for cache deletion. Individual key removals are not a transaction: a storage/cache failure or concurrent writer can leave partial erasure. The page reports incomplete erasure and offers another explicit attempt. Success waits for native IndexedDB deletion and verifies that no Kibitz localStorage entries remain; the separate page does not then recreate app settings or a current-game snapshot. Exports/previews are bounded to 256 keys and 32 million characters; exceeding those limits preserves data and requires using browser site-data tools for whole-site erasure.

## Optional server library

**Check server library** explicitly reads the cookie-owned collection through the existing same-origin API. It can establish an empty anonymous library if no cookie exists. It shows game/reference counts, without displaying untrusted contents as HTML. **Download server library** re-reads the current snapshot and requires the same owner scope before preparing `kibitz-server-library` version-1 JSON. The file retains record metadata, source PGNs, references and its library revision. A changed owner or unavailable/oversized response prevents the export.

**Erase server library…** requires a separate confirmation tied to the inspected scope/revision. `POST /api/library/erase` accepts only `{scope, revision, confirm: true}`. Same-origin/host checks, JSON/size/rate limits and the HttpOnly cookie select the owner; a body scope is only a precondition. A changed cookie or newer revision refuses the old confirmation. An atomic SQLite transaction removes that owner's games/references and advances its revision. Other owners and browser-local records remain unchanged.

The advanced owner revision remains as a tombstone. Older in-flight writes cannot recreate erased records with the previous revision, including after a server restart. After an acknowledged erase, the page removes only that owner's IndexedDB snapshot. A cache failure is reported separately from a successful server transaction. A lost/malformed server acknowledgement does not claim erasure: check the library again before another confirmation. SQLite is authoritative; a cached-only library is never presented as an acknowledged erase.

## Copies outside these controls

The application does not claim forensic disk erasure, deletion from backups, deletion in other browser profiles/devices or removal of conversations already retained by a model provider. SQLite can retain data in database/WAL files or operator backups; the operator must handle those files and their retention. The revision tombstone contains an opaque owner identifier and revision, without game/reference contents. Server `.env` keys and downloaded model files are operator-managed and are excluded.

These controls cover the standalone browser/optional Node-server library. An external Claude artifact's account library remains managed by its host; this page does not impersonate its account/authentication or delete provider histories. Any later hosted-account deployment must add its own account-wide export/deletion contract. The privacy notice and per-provider opt-in are tracked separately in TODO 10.4.

## Operational usage counters

The standard local serve recipes keep a separate private `.kibitz-data/usage.sqlite` for current-day request/token/cost counters and recent admission timestamps, grouped by hashed anonymous cookie IDs. Browser and library export/erase controls leave these operational limits intact. [Usage storage and lifecycle](USAGE.md) describe retention, private paths, operator inspection/reset, SQLite remnants and the absence of prompts, answers, raw cookies or keys.

The experimental [operator session registry](SESSIONS.md) is private operational
identity data. It contains grouping identifiers for authenticated recovery; browser
export/erase does not remove it or revoke sessions. Keep the operator JSON, registry,
current usage/library files and profile together in private backups. [Backend revocation](SESSION-TERMINATION.md) is separate from erasure; complete
authenticated client cleanup remains a release TODO.

[Operator function grants](PERMISSIONS.md) independently control server read, write
and erase. Permission denial or unverifiable policy cannot use a cached private
library as fallback. Complete authenticated client cleanup remains a separate gate.

The experimental [library-cache session boundary](CLIENT-DATA-LIFECYCLE.md) also
clears the derived server-library cache on explicit sign-out attempts, before
fresh sign-in and after observed identity/permission failure. Offline logout
can clear this local copy without confirming backend revocation. Blocked cleanup
is reported and requires retry. Server records and browser-only saved collections
remain; the wider authenticated DOM/memory/storage lifecycle is still open.

The shared session boundary extends this to mediated gateway/data-page 401s,
observed absolute expiry and cross-tab replacement/termination. A small nonsecret
local session marker remembers an acknowledged local sign-out across reloads; it
contains no session identifier, token, proof, PGN or answer. Export retains it as owned metadata, and
whole-browser erasure deliberately resets it while keeping the current backend
session/server records usable. Failed marker persistence is reported separately
and cannot promise durable termination; wider private DOM/worker/autosave cleanup
remains open. See the [lifecycle scope and recovery contract](CLIENT-DATA-LIFECYCLE.md).
