# Deployment decision: local single-user app

Decision for TODO 10.1, confirmed by the project owner on 2026-10-24: **target a local single-user application**. One operator runs the Node server and opens Kibitz in a browser on that machine. The engine and retrieval stay in the browser. Browser storage remains the default; a private SQLite server library is optional. The existing `serve.mjs` default binds to `127.0.0.1`, with same-origin/host checks around the APIs.

This deployment can still use a cloud AI provider chosen by the operator. “Local app” describes where the application runs; `AI_LOCAL_ONLY`, Ollama and the in-browser model provide the separate offline/local-inference options. Provider data sharing and explicit opt-in remain TODO 10.4.

## Supported operation

Supply trusted operator certificates as described in [TLS setup](TLS.md), then build and run from the repository:

```sh
just serve
# Optional private, persistent library:
cd site
node scripts/serve.mjs dist --api --env ../.env --library ../.kibitz-data/library.sqlite \
  --tls-key ../.kibitz-data/tls/key.pem --tls-cert ../.kibitz-data/tls/cert.pem
```

The server reads operator-supplied keys from the root `.env`; keys remain outside browser storage, exports, logs and prompts. Server-env key management satisfies TODO 2.9's supported local path. An encrypted store for separate account-owned keys belongs to a future hosted deployment.

The optional library's anonymous HttpOnly cookie separates browser collections, without providing a sign-in or cross-device account. Clearing the cookie loses that browser's route to the previous server collection. Browser profiles, progress, repertoires and practice schedules stay local to the browser. The operator is responsible for local files and backups. Explicit export/deletion is tracked in TODO 10.3.

The owner selected native Node HTTPS with operator-supplied certificates for the
final local-app transport. `serve.mjs --tls-key FILE --tls-cert FILE` now starts
that listener; [TLS setup and data-transition limits](TLS.md) describe private
identity files, normal browser trust and the remaining ASVS work. Both options
are required; an invalid pair exits without an HTTP fallback. Cookie-bearing
operation without TLS is refused before private database creation. Controlled
HTTP development requires `--http-dev` and uses separate development cookies.

Both APIs use `__Secure-` cookie names, Secure/HttpOnly/SameSite=Strict and their
existing separate API paths on the actual TLS socket. Forwarding headers do not
control this policy. [Migration and rollback](COOKIE-MIGRATION.md) retain exact
legacy tokens, library owner keys and usage counters, without changing SQLite
schemas. Preserve profile/private-database backups before changing origin.
This closes cookie remediation 11.4.2.1, while authentication, revocation,
permissions and the other final-release requirements remain open.

The existing `--host` option can change the listener for deliberate development/packaging use. Binding to a LAN/public address does not add accounts, transport security or authorization. A public/shared service is outside this deployment decision. A local machine's users, browser profiles and anonymous cookie scopes are not a hosted tenant-security boundary.

Default HTTP/AI logs use fixed categories and omit raw URLs, cookies, prompts and provider messages. See [local monitoring and retention](OPERATIONS.md) for status checks, error events and private log files.

## Public files and filesystem ownership

The server serves regular files from canonical public directories. A root selected
through a symlink is resolved at startup; symlinked assets or child directories are
refused, including aliases within the public tree. Keep private databases, env files
and backups outside both static and model roots. Model routes remain restricted to
catalogue filenames; a catalogue name does not authorize an alias to another file.

The [shared reader](../site/server/public-files.mjs) checks the opened file's type and
identity after opening, before using that descriptor for response metadata and bytes. No-follow/nonblocking
open flags apply where the platform supplies them; descriptor identity checks also
reject a changed leaf. Atomic replacement/unlink after validation cannot redirect
an active response. Streams stop at the captured size and detect truncation; HTML
CSP hashes and content length are computed from the actual descriptor-read body.
See Node's [file/stream API](https://nodejs.org/docs/latest-v24.x/api/fs.html#filehandlecreatereadstreamoptions)
for descriptor lifetime semantics.

Public roots and their parent directories must remain writable only by the trusted
operator/build process. These controls do not sandbox a malicious filesystem owner,
lock in-place writes, prevent hard links to private files, or rehash model weights on
every request. Stop the server during builds or publish regular assets atomically;
do not rebuild its served `dist/` during an active browser run. The existing model
marker is an availability check, not ongoing integrity verification.

## CSP and trusted HTML

The [web-asset policy](WEB-ASSETS.md) hashes actual trusted style blocks as well as scripts, blocks style attributes and bundles the original fonts with pinned bytes/licences. Both normal and offline pages restrict font/style resources to the same origin. Dynamic board/viewport geometry uses existing trusted CSSOM property updates.

Install production Node dependencies with `npm ci` in `site/`, including the pinned
parse5 parser used by static serving. The parser and its decoder run on the server;
they are not added to the browser bundle. Missing dependencies fail startup with a
fixed installation hint and an allowlisted error code.

The CSP hashes are selected from parsed HTML/SVG script nodes in the same trusted
HTML body that is sent. Actual `src`/SVG `href` attributes exclude external bodies;
comments, raw text, templates, noscript content, non-script data blocks and unfinished tags do not grant
inline-script hashes. Browser-normalized line endings/character references feed the
hash, and duplicate hashes are removed. Recognized JavaScript types, modules and CSP-controlled import maps/speculation rules retain their hashes. Module/worker/WebAssembly and offline host
restrictions retain their existing policy.

This generates a policy for operator-owned build files. Passing model/user HTML to
`cspFor()` would authorize supplied inline script bodies; parsing does not make that
input safe. Keep imported games, notes and model responses in literal text/rendering
paths, and keep public build files under the operator's control. See the
[HTML parsing standard](https://html.spec.whatwg.org/multipage/parsing.html) and
[parser API](https://parse5.js.org/functions/parse5.parse.html).

## Consequences for the plan

- TODO 10.2 hosted authentication is deferred. Passkeys/OAuth, account sessions, tenant isolation, account-based budgets and encrypted per-user provider keys are prerequisites for any later hosted service.
- [Usage limits](USAGE.md) persist server/cookie counters and minute allowances across restarts in the standard serve recipes. Cookies supply local grouping, not authenticated quotas; completed-usage admission thresholds are not hard billing caps.
- Data export/deletion covers the standalone browser and explicitly selected local-server library. External artifact hosts retain control of their account data.
- Security verification targets the chosen local deployment (ASVS L1 in TODO 11.4), with applicable provider/prompt/import checks. This decision does not mark those checks complete.
- Packaging, privacy/consent, accessibility, offline use, localization and operations remain actionable. Containers must retain local-only defaults unless an operator intentionally changes them.

## Existing alternate runtimes

The Claude artifact adapter remains an existing host-managed integration. The fully offline browser-model path remains supported. Neither changes the selected release target or supplies a self-hosted multi-user account implementation.

A future hosted proposal must explicitly revisit this decision, threat model, authentication, tenant isolation, provider-key ownership, retention/deletion, persistent budgets, HTTPS and ASVS level before it can claim support.
