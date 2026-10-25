# Protected cookies and existing data

TODO 11.4.2.1 / ASVS 3.3.1 established protected grouping cookies. The experimental
[operator-session milestone](SESSIONS.md) now replaces their assertion with
backend-issued authentication for HTTPS gateway and library access. Native TLS
is required; forwarding headers cannot select authentication or transport.

## Names and paths

| Purpose | HTTPS name | Path | Status |
| --- | --- | --- | --- |
| Backend-issued session | `__Host-kibitz_session` | `/` | Required for API access |
| Prior usage grouping | `__Secure-kibitz_uid` | `/api/` | Migration input only |
| Prior private-library grouping | `__Secure-kibitz_library` | `/api/library/` | Migration input only |
| Original usage/library grouping | `kibitz_uid`, `kibitz_library` | Respective paths above | Migration input only |

The new session uses Secure, HttpOnly, SameSite=Strict, no Domain and a twelve-hour
maximum age, enforced again by the backend. The `__Host-` prefix requires Path=/
and prevents domain/path cookie shadowing in conforming browsers. The prior
`__Secure-` grouping values retained their original paths and one-year age; they
no longer authenticate. JavaScript cannot read HttpOnly cookies. Cookies ignore
ports; use the dedicated application hostname and a separate profile for unrelated
local applications. See the [cookie specification](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-__host-prefix).

## Authenticated upgrade

1. Stop the app and close its tabs. Keep consistent backups of the operator JSON,
   current private SQLite directory including WAL files, and original browser
   profile. JSON browser/library exports omit HttpOnly identity cookies.
2. Export browser-local collections and the selected server library as appropriate.
   Scheme/hostname/port changes create separate localStorage, IndexedDB and
   service-worker origins. This migration does not move those browser stores.
3. Initialize the private operator file once and configure `--operator` and
   `--sessions` as described in [session setup](SESSIONS.md). Start with trusted
   [native HTTPS](TLS.md). At the **original hostname/profile**, open Settings or
   Your data, enter the operator key and keep the existing-collection checkbox on.
   API status/records calls made before proof now return 401; they cannot migrate
   or create a production identity.
4. After successful proof, the server binds the exact original usage/library
   identifiers to the operator and a new random session. It expires the two unprefixed names and retains the protected grouping cookies
   at their canonical paths as one-year, proof-authorized collection locators.
   They cannot grant API access, including after the session cookie expires. The usage/library schema stays version one;
   hashes, records, revisions and counters stay unchanged. Verify these before
   making new writes. Only the separate session registry is new.

A valid protected grouping value takes priority over an original value. Duplicate
or malformed selected grouping values fail with 400; a different registered
operator's collection fails with 409. Failure does not change cookies or records.
Noncanonical old paths/domains are not guessed or swept. Restore the intended
profile/setup rather than clearing cookies and silently creating another owner.
After sign-in, changing raw grouping values cannot change the backend claims.
Fresh proof can recover an expired session's stored collection while its browser
cookie and registry binding are retained; expiry still denies API access.

The HSTS default `https://kibitz.test:8765/` does **not** inherit IP/localhost
cookies. For old-profile recovery/export use the original URL/profile and
trusted TLS with `--legacy-origin`, plus the same operator proof. That recovery
mode has no HSTS and is outside final deployment. Explicitly import exports at
the new origin and verify contents; no raw-token export endpoint, automatic
cross-host transfer or secret-in-URL handoff exists. Keep both profiles and current
databases; old-group counters remain associated with the original identities.

## Rollback and development

Earlier builds do not understand the new session. Stop the app, export new work,
keep a consistent **current** database backup, and restore the saved pre-upgrade
browser profile rather than mixing cookies. An earlier trusted HTTPS build can
read its original version-one usage/library databases using that original profile.
Do not replace current databases with an old snapshot or discard the session
registry/operator file. Earlier builds retain their authentication limitations;
this is a recovery route, not final-release security approval. Cached HSTS at the
new hostname survives changes of build/port; keep trusted HTTPS there.

The earlier tested HTTPS baseline is
[`26ccec25801f4e6840882625a1f940302f17a2b5`](https://github.com/gregoryyy/kibitz/commit/26ccec25801f4e6840882625a1f940302f17a2b5)
(PR #139). `server/cookie-migration.test.mjs` can replay that CLI via
`KIBITZ_COOKIE_ROLLBACK_SCRIPT=/absolute/baseline/site/scripts/serve.mjs`.
Current tests require proof for migration, retain writes/counters through restart
and test rejection of ambiguous identities without cookie mutation.

Explicit `--http-dev` uses `kibitz_dev_uid`/`kibitz_dev_library`, ignores production
namespaces and cannot combine with TLS. It has no operator authentication and is
for synthetic data/mock providers in separate profiles/databases. It is not final
deployment. Operator eval/flipbook paid inference retains its separate approval.

Logout/revocation, explicit function permissions and authenticated client cleanup
remain TODO 11.4.2.4/11.4.2.5/11.4.2.11. Backend issuance does not close those gates.
