# Protected cookies and existing data

TODO 11.4.2.1 / ASVS 5.0.0 3.3.1. The standard native and packaged app now
requires [operator-supplied HTTPS](TLS.md) before opening cookie-bearing APIs.
`--api` or `--library` without TLS exits before creating databases or listening.
The API constructors also refuse plaintext by default; forwarding headers cannot
change the native socket's transport or cookie policy.

## Names and paths

| Purpose | HTTPS name | Path | Previous name |
| --- | --- | --- | --- |
| Usage grouping | `__Secure-kibitz_uid` | `/api/` | `kibitz_uid` |
| Private library ownership | `__Secure-kibitz_library` | `/api/library/` | `kibitz_library` |

Both cookies use `Secure`, `HttpOnly`, `SameSite=Strict`, a one-year maximum age
and no Domain attribute. Their independent random values and exact paths are
preserved. The [HTTP working group's cookie specification, work in progress](https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-the-__secure-prefix)
defines `__Secure-` as requiring Secure and secure issuance; `__Host-` additionally
requires Path=/, which would widen these existing API paths. Cookies ignore ports:
use a dedicated browser profile when running unrelated local apps on the same host.

These are still opaque local grouping identifiers, not authenticated sessions or
an account boundary. Issued-session verification, revocation and permissions
remain TODO 11.4.2.3–11.4.2.5. Browser JavaScript cannot read these HttpOnly values.

## Upgrade

1. Stop the server and close the app before making a consistent private backup
   of the browser profile and whole SQLite directory, including any WAL files.
   Keep backups outside public roots and Git. Browser JSON exports do not contain
   cookies; a library export alone does not preserve its ownership cookie.
2. Export browser-local data and the selected server library through the
   [data controls](DATA.md). HTTP/HTTPS and changes of hostname or port create
   distinct browser storage origins. This cookie migration does not move
   localStorage, IndexedDB, drafts, service workers or offline caches across origins.
3. Start the upgraded app with a trusted certificate at the intended hostname.
   On HTTPS, each existing valid legacy cookie is reissued under its protected
   name with **the identical opaque value**. The legacy cookie is expired only
   at its original canonical path. Existing usage hashes, library owner keys,
   revision numbers and SQLite schema version 1 are unchanged. A status request
   can upgrade an existing library identity; it does not create a new one.
4. Verify the expected server collection and usage before making changes. A
   missing library cookie creates a separate collection only when records are
   explicitly loaded. Clearing cookies is not an upgrade or recovery strategy.

An existing valid protected cookie takes priority over a conflicting legacy
cookie. Duplicate or malformed protected cookies, or ambiguous/malformed legacy
cookies without a valid protected identity, receive HTTP 400 without issuing,
replacing or deleting an identity. No private records are touched. Stop and
recover the intended profile from the backup rather than guessing which owner to
use. The server cannot recover a lost token from a database hash. Noncanonical
legacy paths/domains are not guessed or swept; supported old releases used the
paths in the table.

## Rollback

The tested HTTPS rollback baseline is commit
[`26ccec25801f4e6840882625a1f940302f17a2b5`](https://github.com/gregoryyy/kibitz/commit/26ccec25801f4e6840882625a1f940302f17a2b5)
(PR #139, before protected names). It reads the same version-one databases and
legacy tokens. It needs a trusted native HTTPS identity too.

Stop the upgraded server and close the browser. Export any new browser-local
work first. Back up the **current** private database directory, then restore the
complete pre-upgrade browser profile/cookie jar and launch that HTTPS baseline
against the current databases. Restore a profile, rather than merging old and new
cookies. Retaining the current databases preserves writes made after the upgrade;
restoring an older database snapshot would lose those writes. Check the library
and usage after rollback. The old baseline retains the former cookie limitation;
this is recovery, not a final-release deployment or a security clearance.

No database downgrade, token rewrite or cookie-secret export endpoint is needed.
A fresh pre-upgrade profile backup is necessary for this rollback route. Moving
back to an earlier plaintext build or another origin needs its own compatibility
review and is not covered by this proof.

## Explicit development exception

`--http-dev` permits controlled HTTP tests and local development. It cannot be
combined with TLS options. These cookies are named `kibitz_dev_uid` and
`kibitz_dev_library`, use the same respective paths/HttpOnly/SameSite/age, and
have no Secure flag. This mode ignores both production namespaces; HTTPS ignores
the development namespace. It cannot migrate or access a production collection
by presenting its old or protected cookie. This separation does not make HTTP
suitable for real private or paid use. Use synthetic data, mock providers and a
separate development browser profile/database directory.

The test server, passive staging scan and operator eval/flipbook runners select
this exception explicitly. They are not final deployment recipes. Cloud inference
in the operator tools still requires the existing explicit paid-call approval.
For a mock-only development server from `site/`:

```sh
AI_PROVIDER=mock npm run build
AI_PROVIDER=mock node scripts/serve.mjs dist --api --env= --http-dev --index _test.html
```

## Verification

```sh
cd site
npm run build
npm run check
node --test server/cookies.test.mjs server/cookie-migration.test.mjs server/cookie-transport.test.mjs
npx playwright test tests/e2e/secure-cookie-migration.spec.mjs tests/e2e/cookie-transport.spec.mjs tests/e2e/native-https.spec.mjs
```

The synthetic persistence test covers exact-token upgrade, existing records and
counters, revision continuity, post-upgrade writes, independent owners, restart,
legacy-profile recovery and unchanged database schema. To replay recovery using
the actual baseline CLI rather than the current CLI, install that baseline's
Node dependencies in a separate checkout and run the same test with
`KIBITZ_COOKIE_ROLLBACK_SCRIPT=/absolute/baseline/site/scripts/serve.mjs`.
This was verified against the commit above: both retained records, revision 2,
and both user/server request counts of 2 survived rollback. No real data,
operator certificates, paid inference or model download was used.

The two browser regression cases fail on that baseline: it keeps legacy names
and selects the first ambiguous cookie. The fixed browser cases verify protected
issuance, legacy deletion, HttpOnly/Secure/SameSite attributes, exact paths,
preserved data/counters, profile recovery and rejection without cookie mutation.
The container workflow separately verifies the default TLS image command,
read-only identities, UID 1000 and verified HTTPS health checking. Its result
must be read from the current PR's actual Linux run, not inferred from native tests.
