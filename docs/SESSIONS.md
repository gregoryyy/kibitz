# Local operator sessions (experimental)

TODO 11.4.2.3 implements backend-issued sessions for the local single-user app.
Hosted accounts remain deferred. TLS, origin checks, provider sharing consent and
function permissions are separate boundaries. [Backend logout/termination](SESSION-TERMINATION.md) implements 11.4.2.4; authenticated
client-data cleanup remains TODO 11.4.2.11; this is not final-release approval.

## Setup and sign-in

With Node 24.22.1 or later, initialize a new private identity once:

```sh
node site/scripts/operator.mjs .kibitz-data/tls/operator.json
```

The setup command creates a mode-0600 JSON file and never overwrites an existing
identity or prints its secret. Keep the file outside Git and every public static
or model directory. Its `id` identifies this installation's operator; its `secret`
is the operator key. Read the key privately in an editor and enter it in
**Settings → Local server sign-in**, or on **Your data**. Do not put it in URLs,
command-line arguments, provider settings, shared screenshots or support logs.
The form clears its password immediately on submission and page departure; it
does not save it in browser storage. Provider sharing permission is still required
independently, and signing in never runs a paid connection test.

Native TLS API/library serving requires the identity, registry and private
[permission policy](PERMISSIONS.md):

```text
--operator .kibitz-data/tls/operator.json --permissions .kibitz-data/tls/permissions.json --sessions .kibitz-data/sessions.sqlite
```

The standard `just serve`/npm recipes supply those paths. The default container
reads `/tls/operator.json` from the same read-only, UID-1000-readable mount as its
TLS identity, and writes `/data/sessions.sqlite` in its private data volume. Supply
the operator and permission files alongside the certificate and key before starting either mode.
Missing, public, oversized, symlinked or non-private operator files stop startup
before database creation. No identity is silently generated at server startup.
A static-only HTTPS server does not need an operator identity.

## Issuance and verification

The same-origin JSON POST `/api/library/session` accepts only `secret` and boolean
`migrate`. Its library path receives both old canonical grouping cookies. Native
TLS/Host/Origin checks, a 4-KiB body limit, five-second body deadline and ten
attempts per minute bound proof handling. This fixed per-process limiter has no
account-disable/lockout state: its shared window resets after sixty seconds (and
process restart), including after failed attempts. Foreign-origin requests are
rejected before counting; a hostile local process can still deny service and is
inside the trusted-machine boundary. No adaptive risk service or hosted account
lockout is claimed. Forwarding headers cannot authorize it.
The response sends a fresh random 256-bit `__Host-kibitz_session` cookie, with
Path=/, Secure, HttpOnly, SameSite=Strict and a twelve-hour maximum age. No token
or key appears in the JSON response. GET `/api/session/status` exposes only the
required/authenticated flags and authenticated expiry, never private identities.

Every HTTPS gateway and library function verifies that token against the backend
registry before using its server-held usage/library claims. Token shape alone,
raw grouping cookies and client-supplied scope values grant no access. Missing,
unknown, duplicate, expired or different-operator sessions fail closed. Registered
sessions survive process restart; credential changes invalidate the old credential
epoch. Direct API constructors also reject TLS unless a trusted identity resolver
is supplied. Explicit `--http-dev` retains synthetic, separate grouping cookies
and no operator authentication; use mock providers and separate databases there.

The version-one SQLite registry stores a SHA-256 session-token verifier, operator
ID, credential epoch, expiry and the original collection/usage identifiers needed
for existing schema hashes. **It contains private raw grouping identifiers**, even
though it never stores the operator key or raw session token. It must receive the
same private path, backup and filesystem protection as the other private databases.
Ownership bindings hash each grouping identifier and prevent reassignment to a
different operator. Issuance/binding is one transaction. A failed migration does
not claim a partial collection. The registry is bounded to 1,000 retained session records
and 2,000 ownership bindings; exhaustion refuses issuance without evicting data
or identities. Issuance prunes expired session rows; ownership bindings and protected locators
remain for proof-authorized recovery. Logout deletes the presented session row.
Client-data lifecycle remains a separate milestone.

This design follows OWASP's [session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
on unpredictable issued identifiers, backend validation, cookie transport and
keeping credentials out of browser web storage. These tests assess this app,
not the operator's machine or an independent certification.

## Existing collections, expiry and recovery

Keep **Keep this browser’s existing server collection** selected. Only after
successful operator proof does the server adopt valid original/protected grouping
values, retaining exact usage hashes, library owners, revisions and counters.
It expires the two unprefixed names at their canonical paths and retains protected
one-year grouping cookies solely as proof-authorized collection locators. They
cannot grant API access, but preserve collection continuity after the session
cookie expires or is removed. Changing old cookies
after sign-in cannot change the session's server-held collection. Ambiguous
migration cookies or a collection bound to another operator are refused without
cookie changes. Restore the intended private setup/profile rather than guessing.

Reauthentication issues a new token and invalidates the previous presented token
in the same registry transaction; a failure rolls that change back. It cannot
revoke another operator’s token. An existing retained session row or protected locators let fresh proof recover
the same collection after expiry or a key change preserving the operator `id`. The old token remains
unusable for API access. Unchecking migration explicitly creates a new collection;
it does not recover the previous one. Losing both the original browser profile
and its retained registry binding cannot be repaired by guessing database hashes.
Do not delete the registry or regenerate the operator identity as routine repair.

Back up the operator file, current private SQLite directory (including WAL files)
and original browser profile consistently while the app is stopped. Keep exports
as well. Restoring an older data snapshot loses later writes. A `.test` hostname
does not inherit an IP/localhost profile's cookies: use trusted TLS with
`--legacy-origin`, the original profile and operator proof for export, then import
explicitly at the new origin. See [cookie migration](COOKIE-MIGRATION.md).
Earlier builds do not understand the session registry: rollback needs the saved
pre-upgrade profile and **current** original usage/library databases, and retains
that build's authentication limitations. Keep trusted HTTPS and the HSTS hostname
requirements throughout; rollback is recovery, not a supported final deployment.

## Verification

`server/sessions.test.mjs`, `server/session-api.test.mjs` and the existing
cookie-migration/native-TLS/HSTS tests cover issued lookup, forgery, duplicate
cookies, operator separation/rotation, backend expiry, transaction rollback,
restart, bounded setup/storage and preserved legacy records/counters. The
`operator-session`, native HTTPS, migration and HSTS Playwright suites exercise
the real built form, board, mock gateway and library, including German mobile
sign-in, secret clearing, response bounds and overlapping probe handling.
The container workflow exercises the default image command with a private
operator file. Read its actual CI result before claiming packaged verification.
