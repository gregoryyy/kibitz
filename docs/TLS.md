# Native HTTPS for the local app

The owner selected native Node HTTPS with operator-supplied certificates on
2026-10-25. This completes the listener prerequisite **TODO 11.4.2.7.1**.
[Protected cookies and migration](COOKIE-MIGRATION.md) implement **11.4.2.1**.
The remaining eleven ASVS fixes include authentication, HSTS, external endpoint
transport policy, actual TLS inventory and public-certificate evidence. This
does not close the final-release gate.

## Start with an existing certificate and private key

From the repository root, after building:

```sh
npm --prefix site run build
node site/scripts/serve.mjs site/dist --api --env .env \
  --index _test.html --host 127.0.0.1 --port 8765 \
  --usage .kibitz-data/usage.sqlite --library .kibitz-data/library.sqlite \
  --tls-key .kibitz-data/tls/key.pem --tls-cert .kibitz-data/tls/cert.pem
```

Supply both files before running this command. The server neither generates
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

Open the printed **`https://127.0.0.1:8765/`** URL. The certificate must match that
IP address; use `--host localhost` and its printed URL only with a matching DNS
identity. The browser must trust the issuer through the operator's normal trust
configuration. Supported API Host values remain localhost/IP literals; a new
custom DNS hostname needs the separate rebinding/hostname review. Do not bypass
certificate warnings or disable certificate verification to operate the app.

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
identity tokens, private-library ownership and usage counters on HTTPS. Back up
the browser profile as well as databases before upgrading; ordinary JSON browser
exports omit HttpOnly cookies. The remaining operator-session and permission
requirements are **11.4.2.3–11.4.2.5**. These grouping cookies are not authentication.

The standard serve recipes and container command require the TLS pair. A
cookie-bearing CLI without TLS refuses startup before private storage creation;
API constructors also refuse plaintext by default. Pure static serving can use
HTTP. Controlled development/test tools explicitly select **`--http-dev`**, using
separate development identities that cannot migrate production cookies. Combining
that flag with TLS options is refused. External-service transport enforcement
remains **11.4.2.7**; a native HTTPS listener does not close that parent item.

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
node --test server/tls.test.mjs
npx playwright test tests/e2e/native-https.spec.mjs tests/e2e/cookie-transport.spec.mjs tests/e2e/secure-cookie-migration.spec.mjs
```

The tests generate short-lived identities in temporary private directories.
Native clients validate the exact fixture CA and hostname and reject untrusted
chains/wrong names/older protocols; plaintext cannot reach the TLS application.
The browser test alone allows its generated test certificate, exercises the
real built board/Stockfish/mock coach/private library and retains the normal CSP
checks. No operator identity, trust-store installation, inference or model
download is used. The separate Linux image workflow runs the packaged TLS case;
ordinary native tests do not start Docker.
