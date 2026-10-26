# Native filesystem isolation (experimental)

TODO **11.4.2.9 / 11.4.2.9.1** and ASVS **13.4.1** are technically verified
at `5c83b328103dc65057affde9b333f22d7afdafde` for the owner-selected native
**macOS and Linux** platforms and the source-free image. The owner confirmed
this native scope on 2026-10-25. This does not grant final-release clearance
or change the selected native Node HTTPS target. Public certificate trust
remains open; the owner has no dedicated public domain available.

The existing [HTTPS command](TLS.md#start-with-an-existing-certificate-and-private-key),
`just serve` and offline recipes retain their arguments and private data paths.
Final TLS startup now passes through a local bootstrap before opening databases,
loading provider SDKs or listening. The bootstrap validates the TLS pair,
operator and policy, discovers the checkout's metadata, prepares private state
directories and starts the application under OS filesystem restrictions.
It does not expose an HTTP endpoint. Do not run the application as root.

## What the application can access

The application reads its `site/` runtime (including installed dependencies and
built assets), selected model/public roots, Node executable/system libraries,
selected identity/env/extra-CA files and the permission-policy directory.
Runtime/public/model/configuration paths are read-only. It can write only the
selected SQLite parent directories, which must already be private or are
created with mode `0700`; existing directories must belong to its user and have
no group/other access. The existing private-file, TLS, owner and HTTP checks
remain in force. Builds must stop the server before replacing runtime files.

Keep policy/identities in their own private directory. The standard layout
works without moving existing data:

```text
.kibitz-data/
  tls/                 # read-only inside the application; offline operator writes
    key.pem
    cert.pem
    operator.json
    permissions.json
  sessions.sqlite      # private writable data; existing paths and schemas retained
  usage.sqlite
  library.sqlite
```

A database inside the policy directory is refused. The policy's **directory**
is exposed read-only, so offline atomic replacement or deletion is visible to
live permission checks. Binding only the original file inode would retain stale
grants after replacement on Linux. Key/identity rotation still requires the
normal server restart. A policy directory containing the checkout or its Git
metadata is refused; move the policy into a dedicated private child directory.
The app never edits the operator's identities, policy or `.env`.

The bootstrap discovers `.git`, `.hg` and `.svn` in selected-path ancestry,
including Git worktree pointers, common directories and chained object
alternates. Read/write grants cannot overlap discovered metadata. In the
application, OS restrictions deny the original Git paths, aliases to them and
native SQLite access; hiding dot paths in HTTP is a separate existing check.
The operator retains normal access to Git outside the application.

An inherited read-only descriptor proves that a private canary exists. Before
opening storage/listening, the application must fail to access that canary by
pathname and fail to read the discovered metadata. Missing/invalid proof or
readable metadata stops startup with `ERR_KIBITZ_ISOLATION`. These probes verify
the applied restrictions; the proof format itself does not create isolation.
The descriptor is closed before application work. The bootstrap forwards
termination to the child, and loss of the bootstrap's IPC connection stops it.
OS loader diagnostics are replaced with a fixed error instead of logging paths.

## Platform prerequisites and limits

On **macOS**, the bootstrap uses the OS `/usr/bin/sandbox-exec` filesystem
policy. It denies reads outside selected roots and writes outside private state,
with overriding read-only runtime/configuration and metadata-denial rules.
The root directory itself may be listed for executable loading; that literal
grant does not expose descendant contents. This is an experimental use of the
platform helper, not a promise that all future macOS releases retain it.
An absent/rejected helper or failed proof stops final startup.

On **Linux**, install the distribution's `bubblewrap` package separately.
The application never invokes a package manager or changes host policy.
[bubblewrap](https://github.com/containers/bubblewrap#sandboxing) constructs an
empty mount namespace with explicit read-only/read-write bindings, separate
user/PID/IPC/UTS namespaces, no retained capabilities and a new session.
Networking remains available for the loopback listener and permitted HTTPS
providers. Only isolated `/proc`, minimal `/dev` and required library aliases
are added; host processes, home trees and the original checkout metadata are
not mounted. The regular-file canary descriptor conveys no directory handle.
The package is an external system tool under LGPL-2.0-or-later, not vendored or
added to npm dependencies.

The kernel and local AppArmor policy must permit this unprivileged invocation.
Use the distribution's supported configuration; **do not disable host AppArmor
or user-namespace protections globally**. A missing helper or refused namespace
has no unrestricted final-mode fallback. The existing [image](CONTAINER.md)
remains another execution mode while a native installation is being prepared;
it does not replace the native release requirement.

**Windows is outside the owner-selected native release scope.** Its native OS
adapter is not implemented or verified, and final startup refuses unsupported
isolation rather than running an unrestricted app. Expanding native platform
support requires a separate implementation and verification.
Explicit `--http-dev` and TLS `--legacy-origin` recovery remain outside final
scope and do not establish this control.

These are filesystem restrictions, not a new network-policy or hosted-account
system. The OS, bootstrap, runtime files, configured directory writers and
operator remain trusted. Do not deliberately expose metadata via hard links,
extra mounts or an altered runtime. Node's own [permission model](https://nodejs.org/docs/latest-v24.x/api/permissions.html)
explicitly is not a security boundary against malicious code; it is not used
as a substitute for the OS policy. Tests include native SQLite access rather
than relying only on JavaScript file wrappers.

## Image and verification

The existing strict build context and explicit runtime copies still exclude
Git/private/development files. The source-free image build emits its own
`.kibitz-image.json` marker after checking source-control ancestry; that marker
is copied only by the Dockerfile. Do not create/copy it into a native checkout.
The image verifies its marker and absence of readable ancestry metadata before
storage/listening, without nesting bubblewrap inside the container. Existing
UID 1000, read-only root, dropped capabilities, private volume and read-only
identity mount remain required. The marker is a trusted build artifact, not an
HTTP or environment flag to opt out of native isolation.

Tests use temporary synthetic certificates/data and mock providers:

```sh
node --test site/tests/unit/native-isolation.test.mjs site/server/deployment.test.mjs
cd site
npx playwright test tests/e2e/native-isolation.spec.mjs
```

The CLI/browser preload probes the actual listener process, not the unrestricted
bootstrap, and opens metadata descriptors without reading/logging their contents.
The same test can target the preceding server via
`KIBITZ_ISOLATION_SERVER_SCRIPT`; an unrestricted process reports readable
metadata and fails. Separate tests cover SQLite/symlink denial, permitted state,
read-only identities/runtime, malformed proof, live atomic permission updates,
HTTP hidden paths, real TLS/session/engine/mock-coach use and packaged exclusion.
Native macOS and Linux/image CI results must be retained in the experimental PR;
fixture identities are never actual deployment/public-trust evidence.

Reviewed-source evidence: [Linux unit/build/check/audit](https://github.com/gregoryyy/kibitz/actions/runs/40230610253/job/121281453825),
[dedicated macOS isolation](https://github.com/gregoryyy/kibitz/actions/runs/40230610253/job/121281453639),
[actual image/browser/persistence](https://github.com/gregoryyy/kibitz/actions/runs/40230610251/job/121281310717)
and [CodeQL analysis](https://github.com/gregoryyy/kibitz/actions/runs/40230610379/job/121281311041)
pass, with zero open PR CodeQL alerts. The image passes all five cases after
correcting only its synthetic identity-directory mount. Local final mock-only
unit coverage is 815 passes/one opt-in live skip; all 16 affected browser cases
pass and the actual previous server fails the process-metadata regression.
Full application browser CI and subsequent assessment-head CI are separate
checks; their live status is recorded in experimental PR #150.
