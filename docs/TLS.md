# Native HTTPS for the local app

The owner selected native Node HTTPS with operator-supplied certificates on
2026-10-25. This completes the listener prerequisite **TODO 11.4.2.7.1**.
[Protected cookies and migration](COOKIE-MIGRATION.md) implement **11.4.2.1**.
The isolated-host HSTS policy implements **11.4.2.2**.
Backend-issued [operator sessions](SESSIONS.md) address **11.4.2.3**.
[Backend session termination](SESSION-TERMINATION.md) addresses **11.4.2.4**.
[Explicit function grants](PERMISSIONS.md) address **11.4.2.5**.
The [transport inventory](TLS-INVENTORY.md) records partial direct public-host evidence;
its parent TODO 11.4.2.6 remains open. The remaining seven ASVS fixes include external endpoint
transport policy, actual TLS inventory and public-certificate evidence. This
does not close the final-release gate.

## Start with an existing certificate and private key

From the repository root, after building:

```sh
npm --prefix site run build
node site/scripts/serve.mjs site/dist --api --env .env \
  --index _test.html --host 127.0.0.1 --port 8765 \
  --usage .kibitz-data/usage.sqlite --library .kibitz-data/library.sqlite \
  --operator .kibitz-data/tls/operator.json --permissions .kibitz-data/tls/permissions.json --sessions .kibitz-data/sessions.sqlite --tls-key .kibitz-data/tls/key.pem --tls-cert .kibitz-data/tls/cert.pem
```

First initialize the private [operator identity](SESSIONS.md) once and create its
[explicit permission policy](PERMISSIONS.md), then supply
both TLS files before running this command. The server neither generates
certificates nor installs a certificate authority or changes a system/browser
trust store. The unencrypted PEM private key and PEM certificate/chain must be
matching, readable regular files outside **both** the static and optional model
directories. Each is limited to one MiB, including actual bytes read; empty
files, leaf symlinks and multiply linked files are refused. Parent aliases are
resolved before the public-directory exclusion check. Parent directories and
their writers remain trusted; this does not sandbox a malicious filesystem owner.

On POSIX systems the private key must have no group/other permissions, normally
mode `0600`; the process user must be able to read it. Copy managed/symlinked
identities into operator-owned regular files outside public roots when needed.
The loader checks the opened descriptor's type/permissions and bounds its read;
it does not change file permissions, fetch identities or print key/certificate
contents, filenames or raw OpenSSL errors. Invalid or incomplete TLS options
exit before private database creation and do not open an HTTP fallback listener.

Open the printed **`https://kibitz.test:8765/`** URL. Configure the operator's
local resolver/hosts file to map the dedicated name to loopback, for example:

```text
127.0.0.1 kibitz.test
```

The app does not modify hosts files or system/browser trust. The certificate
must contain the exact **DNS SAN `kibitz.test`**; wildcard or Common Name-only
identities are refused before storage/listening. Include **IP SAN `127.0.0.1`**
when using the packaged health probe. Trust the issuer through the operator's
normal local trust configuration. Never bypass certificate warnings to operate
the app. `--host` controls the listening interface, normally `127.0.0.1`;
`--app-host study.kibitz.test` instead selects a different dedicated canonical
lowercase `.test` name with its own matching SAN and loopback mapping. Bare
`test`, localhost/IP names, public domains, schemes and ports are refused by
that option.

The reserved [.test namespace](https://www.rfc-editor.org/rfc/rfc6761.html#section-6.2)
needs explicit local resolution; it does not automatically resolve like
`.localhost`. Chromium's [transport-security implementation](https://github.com/chromium/chromium/blob/main/net/http/transport_security_state.cc)
ignores HSTS for `*.localhost`, so that namespace cannot supply this browser
policy. Use a name dedicated to this app; another app on another port of the
same hostname would share the browser's host-wide HSTS state.

## Optional local development certificate

For experimental local testing, [mkcert](https://github.com/FiloSottile/mkcert)
creates a local CA and a matching X.509 TLS identity. If “SSH tools” means
`ssh-keygen`, its [SSH certificates](https://man.openbsd.org/ssh-keygen#CERTIFICATES)
use a different format; they cannot be supplied as the HTTPS certificate.
The mkcert project explicitly scopes its tool to development. A locally trusted
CA does **not** satisfy the current ASVS 12.2.2 public-certificate requirement;
that final-release gate remains unresolved.

The following commands are for the operator to run from the repository root,
with mkcert already installed. `mkcert -install` creates/trusts a local CA in the
supported local trust stores; it may request OS authentication. The application
and inventory probe never execute that command or modify browser/system trust.
These are initial setup commands: use them only when the named identity files
are absent, rather than overwriting an existing deployed pair.

```sh
umask 077
mkdir -p .kibitz-data/tls
chmod 700 .kibitz-data/tls
mkcert -install
mkcert -cert-file .kibitz-data/tls/cert.pem \
  -key-file .kibitz-data/tls/key.pem kibitz.test 127.0.0.1
chmod 600 .kibitz-data/tls/key.pem
cp "$(mkcert -CAROOT)/rootCA.pem" .kibitz-data/tls/ca.pem
```

Only `rootCA.pem` is the public trust certificate. Keep `rootCA-key.pem` in
mkcert's private CA directory: do not copy it into this project, the image or a
container mount. Keep the server key private and outside served directories.
Add the loopback hosts mapping described above and restart the browser if its
trust store requires it. The app still needs its separately initialized
[operator identity](SESSIONS.md) and [permission policy](PERMISSIONS.md).

After starting native HTTPS, inspect the real endpoint without disabling trust:

```sh
node site/scripts/tls-inventory.mjs \
  --endpoint local-app=https://kibitz.test:8765 \
  --ca .kibitz-data/tls/ca.pem > local-tls-observations.json
```

This command is available with the [experimental inventory](TLS-INVENTORY.md).
It checks direct Node TLS, not browser trust or public-CA eligibility. The
explicit CA affects this probe only; it does not broaden trust for provider
connections. For Docker, mount the public `ca.pem` with the identity as described
below and give the application UID access only to the server key, never the CA
signing key.

## Isolated application HSTS

Every application response for the configured hostname receives
**`Strict-Transport-Security: max-age=31536000`** before static/model/API routing,
including HEAD, streams and normal 4xx/5xx error responses. There is no
`includeSubDomains` or preload directive. Forwarding headers cannot select the
host or disable HSTS; native TLS, a valid Host authority and the configured
hostname control it. API Origin checks still compare the full native scheme
and browser authority, including its published port. Docker may map the listener
to another host port without changing hostname isolation.

IP/localhost aliases cannot serve the app, APIs or models, create cookies or
redirect to another hostname. Their sole exception is GET/HEAD of the exact
static `/manifest.webmanifest` health resource, without cookies or HSTS.
Malformed HTTP parser input closes the connection without an HTTP response;
it cannot establish an application authority. Unrelated hosts receive no HSTS.

As specified by [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797.html#section-8.3),
the policy is host-wide across ports, and a non-default explicit port is kept
when HTTP is upgraded to HTTPS. Clients learn it only after a valid, trusted
HTTPS response. Start with the printed HTTPS URL; there is no plaintext redirect
listener and no first-visit HTTP protection before the policy is learned. IP
literals cannot serve as HSTS identities. Certificate/chain/hostname errors must
be repaired rather than bypassed after HSTS is cached.

The server uses Node's
[`https.createServer()`](https://github.com/nodejs/node/blob/v24.22.1/doc/api/https.md#httpscreateserveroptions-requestlistener)
and sets the [TLS minimum](https://github.com/nodejs/node/blob/v24.22.1/doc/api/tls.md#tlscreatesecurecontextoptions)
to 1.2; native clients test both TLS 1.2 and 1.3 and reject older negotiation.
This is configuration/test evidence, not an inventory of the operator's actual
providers or proof of public certificate trust. Certificate chain, hostname,
expiry, renewal and actual endpoint verification retain their ASVS TODOs.
Identities are loaded at startup: stop/restart with the replacement pair after
renewal; no automatic reload or renewal service is provided.

## Existing data and RC compatibility

HTTP and HTTPS are different browser origins. Changing scheme/hostname/port can
change access to localStorage, IndexedDB and service-worker caches. Before
changing the URL, export browser data and the selected server library and keep
an appropriate browser-profile/private-SQLite backup as described in
[data lifecycle](DATA.md) and [container operation](CONTAINER.md).
[Cookie migration and rollback](COOKIE-MIGRATION.md) preserve the exact legacy
identity tokens, private-library ownership and usage counters on HTTPS **at the
same original hostname**. The new `.test` hostname does not inherit those cookies. Back up
the browser profile as well as databases before upgrading; ordinary JSON browser
exports omit HttpOnly cookies. Existing groups are adopted only after operator proof; the new backend-issued
session supplies authentication. Backend [termination](SESSION-TERMINATION.md) and
[function permissions](PERMISSIONS.md) are verified separately.

For recovery/export at the original IP/localhost origin, explicitly add
**`--legacy-origin`** with a valid TLS pair and use the saved original profile and
URL. This recovery mode has no HSTS and cannot combine with `--app-host` or
`--http-dev`; it is not the supported final deployment. It preserves original
cookie ownership after operator sign-in and lets the operator verify/export old data before an explicit
import at the new origin. New-origin grouping IDs and their counters are separate;
the original owner/counters remain in current SQLite files and the old profile.
No raw-token export, automatic cross-host transfer or secret-in-URL handoff exists.
Keep current databases and both profiles; do not overwrite post-transition writes
with a pre-transition database snapshot. The [migration guide](COOKIE-MIGRATION.md)
details the boundary.

To roll back, export new-origin work, stop the server and keep a consistent
**current** database/profile backup. A previous build must continue trusted HTTPS
at its supported original origin with its saved profile; changing builds/ports or
stopping the app does not remove cached HSTS for `kibitz.test`. Do not fall back
to HTTP or remove browser trust checks. Renewal uses the same hostname/SAN and
trusted issuer; replace the pair and restart before expiration. No automatic
policy-clearing or certificate-renewal service is provided.

The standard serve recipes and container command require the TLS pair. A
cookie-bearing CLI without TLS refuses startup before private storage creation;
API constructors also refuse plaintext by default. Pure static serving can use
HTTP. Controlled development/test tools explicitly select **`--http-dev`**, using
separate development identities that cannot migrate production cookies. Combining
that flag with TLS options is refused. External-service [transport enforcement](TLS-POLICY.md) is implemented under
**11.4.2.7** and verified separately from this listener prerequisite. Actual
endpoint inventory and public trust retain their own gates.

## Container use and verification

The packaged CLI accepts the same options. Mount both regular files outside
`/app/site/dist` and any model root, read-only, and ensure the non-root runtime
UID/GID `1000:1000` can read the private key with owner-only permissions. Do not
copy identities into the image/build context. Keep loopback-only port publishing.
The default image command uses `/tls/key.pem` and `/tls/cert.pem` and sets
`KIBITZ_HEALTH_HTTPS=1`. Compose mounts
`${KIBITZ_TLS_DIRECTORY:-./.kibitz-data/tls}` read-only at `/tls`; supply the files
before launch. Its explicit public `/tls/ca.pem` health trust file must contain
the intended issuer certificate. No host `.env` is loaded implicitly.

If the issuer is outside Node's default trust store, set
`KIBITZ_HEALTH_CA` to a read-only mounted **public CA certificate** file trusted
for this probe; this setting does not change provider or browser trust. The
fixed probe uses `https://127.0.0.1:8765/manifest.webmanifest` and normal
chain/hostname validation with a four-second total deadline, no redirects and
no private key, cookie, provider request or model load. The certificate must
therefore include `127.0.0.1` in its subject alternative names. Explicit
development image tests select `--http-dev` and
`KIBITZ_HEALTH_HTTPS=0` together; invalid trust settings fail the probe.
A running TLS listener does not make an HTTP health check succeed.
The explicit image test mounts synthetic identities
read-only, runs the app as UID 1000 and checks an HTTPS health probe; its fixture
CA is trusted only for that probe. This is not an operator-deployment certificate.

Reproduce native checks after a build:

```sh
cd site
npm run check
node --test server/tls.test.mjs server/transport.test.mjs server/hsts.test.mjs
npx playwright test tests/e2e/hsts.spec.mjs tests/e2e/native-https.spec.mjs tests/e2e/cookie-transport.spec.mjs tests/e2e/secure-cookie-migration.spec.mjs
```

The tests generate short-lived identities in temporary private directories.
Native clients validate the exact fixture CA and hostname and reject untrusted
chains/wrong names/older protocols; plaintext cannot reach the TLS application.
The browser test alone allows its generated test certificate, exercises the
real built board/Stockfish/mock coach/private library and retains the normal CSP
checks. No operator identity, trust-store installation, inference or model
download is used. The separate Linux image workflow runs the packaged TLS case;
ordinary native tests do not start Docker.

HSTS client verification additionally needs an installed curl build with the
`HSTS` feature (`curl --version`). The test trusts only its generated CA, rejects
a wrong CA, persists a private temporary policy cache and verifies a real HTTP
upgrade on the same port with no redirect or verification bypass. Browser tests
use a test-only loopback resolver and allow only their generated identity errors;
they verify delivery, app/engine/mock coach/library behavior and error headers,
not real operator browser trust or browser HSTS-cache acceptance. Actual endpoint
trust/inventory evidence remains in TODO 11.4.2.6/11.4.2.8.
