# Local Docker package

TODO 12.2 packages the Node gateway, optional private library and built browser app.
It preserves the [local single-user scope](DEPLOYMENT.md). The image is built from
this checkout; no registry publication or release is performed by the workflow.
The actual [minimal-runtime Linux run](https://github.com/gregoryyy/kibitz/actions/runs/40166278799)
passes four image/browser/restart/previous-packaging compatibility cases at source
`92ccc07`, alongside publisher-signature and raw advisory verification.
[Current evidence](security/2026-10-25-image-advisories.json) records exact identities.
The [earlier packaging evidence](security/2026-10-25-container.json) remains historical.

The [image advisory check](IMAGE-ADVISORIES.md) adds a pinned scanner and fresh
database to the same CI-built image, retaining raw findings and failing on
high/critical results or incomplete package evidence. Actual verification has zero
high/critical runtime findings; 23 medium and eight low remain for triage.

Use Docker Engine 28 or newer and the Compose plugin. The explicit loopback mapping
follows [Docker's port-publishing behavior](https://docs.docker.com/engine/network/port-publishing/).
The server listens on the container interface so the bridge mapping can reach it;
the supplied host mapping is `127.0.0.1:8765`, preserving local browser access.

First supply trusted native TLS files and a public issuer CA as described in
[TLS setup](TLS.md). The default command requires `/tls/key.pem` and
`/tls/cert.pem`; Compose mounts `.kibitz-data/tls` read-only there (override with
`KIBITZ_TLS_DIRECTORY`). Files must be readable by UID 1000, with owner-only key
permissions; keep them outside the build context/public directories. The health
probe uses verified HTTPS and Compose explicitly supplies `/tls/ca.pem` as its
public issuer trust file. It does not install trust in a browser or provider.

From the repository root:

```sh
docker compose --env-file /dev/null up --build -d
```

Open `https://127.0.0.1:8765/`. The supplied
[Compose configuration](../compose.yaml) uses the **mock coach** and a named private
data volume. This is a reproducible local starting point with no provider keys or
inference cost. `--env-file /dev/null` prevents implicit Compose loading of an
operator `.env`; the app's default command also uses `--env=`. Real provider setup
requires explicit runtime configuration and the app's separate sharing permission.
The original fonts are [bundled locally](WEB-ASSETS.md); normal and offline pages use the same strict font/style policy.

The minimal runtime uses explicit UID/GID `1000:1000`, preserving the previous named user's file ownership, with a read-only root
filesystem, `/tmp` tmpfs, dropped capabilities, no new privileges and Docker init.
The static health check reads only the public manifest: it tests serving, rather
than provider/model readiness, and creates no usage cookie or inference request.

```sh
docker compose --env-file /dev/null logs --tail 50 kibitz
docker compose --env-file /dev/null stop kibitz
docker compose --env-file /dev/null start kibitz
```

Private SQLite usage and library files live in `/data`, outside the served `dist/`.
The named volume survives container recreation and ordinary `docker compose down`.
Browser history, preferences and browser-local libraries remain in the browser;
enabling server storage does not automatically upload them. Use the app's
[export/erasure controls](DATA.md) for the appropriate storage scope. Deleting the
Docker volume deletes its private server data; it is not an upgrade step.

For a filesystem backup, stop the service, copy the whole private directory, then
start it again. Keep the database files and any SQLite WAL companions together:

```sh
docker compose --env-file /dev/null stop kibitz
docker compose --env-file /dev/null cp kibitz:/data ./kibitz-data-backup
docker compose --env-file /dev/null start kibitz
```

The [Compose copy command](https://docs.docker.com/reference/cli/docker/compose/cp/)
copies private data to the selected local directory; keep that copy private and
outside Git/public hosting. Restore requires the same whole-directory consistency,
UID 1000 ownership and restrictive permissions. Automatic migrations, backup
encryption and restore testing are not supplied by this packaging change.

To use a plain Docker command instead:

```sh
docker build --tag kibitz:local .
docker volume create kibitz-data
docker run --detach --name kibitz --init --read-only --cap-drop ALL \
  --security-opt no-new-privileges --tmpfs /tmp:mode=1777 \
  --publish 127.0.0.1:8765:8765 \
  --mount type=volume,src=kibitz-data,dst=/data \
  --mount type=bind,src="$PWD/.kibitz-data/tls",dst=/tls,readonly \
  --env KIBITZ_HEALTH_CA=/tls/ca.pem kibitz:local
```

[Runtime environment options](https://docs.docker.com/reference/cli/docker/container/run/)
can supply the provider/model configuration, for example an explicit
`--env-file /absolute/path/to/docker-provider.env`. Use Docker's env-file syntax
(literal values, without surrounding shell quotes); this is runtime input, never
a build argument or a file copied into the image. Select `AI_PROVIDER` explicitly
to replace the mock default, follow [.env.example](../.env.example), and grant the
chosen provider permission in Settings before sharing chess text. The container
has its own loopback: a native Ollama service at host `127.0.0.1:11434` is not that
address inside a bridge container. Use a deliberately reachable private endpoint
or the [native Node/Ollama setup](PROVIDERS.md#self-host-with-native-ollama).

GGUF models and operator files are not included. A model directory can be mounted
read-only outside `dist/` and explicitly selected with the existing CLI options;
the fixed catalogue/verification and explicit browser Load still apply. Chrome's
optional built-in model remains browser-managed. Packaging starts no model download.

The [Dockerfile](../Dockerfile) uses the official
[Node 24 image](https://github.com/nodejs/docker-node/blob/main/README.md), pinned to
manifest `sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205`.
Separate build and production-dependency stages use that image and the existing
lockfile with install scripts disabled. The runtime uses the publisher-verified
Distroless Node 24/Debian 13 manifest recorded in [image advisory evidence](IMAGE-ADVISORIES.md).
It includes the app's declared production
dependencies, built WASM/client assets and licence notices. It omits development
dependencies, build scripts, tests and checkout metadata. Shared pure source
modules remain outside the public tree because the server imports them.
[The build-context allowlist](../.dockerignore) excludes operator environment,
private data, Git metadata, local builds and downloaded models.

The [read-token container workflow](../.github/workflows/container.yml) builds a
local image, validates Compose without an env file, installs a test browser and
runs five actual image cases: process/filesystem boundaries, real Stockfish/mock
coach UI, private volume/cookie isolation across restart, and reopening a volume
from the previous packaging recipe. Both recipes use the current app/schema;
the fourth case checks packaging compatibility. Those four controlled compatibility
cases explicitly select HTTP development mode and distinct development cookies.
The fifth runs the default TLS image command using read-only synthetic identities,
checks protected cookies, actual browser serving and verified HTTPS health.
[Cookie migration and rollback](COOKIE-MIGRATION.md) cover the separate legacy
identity/database transition. A synthetic private
file in the allowed server source tree tests the env exclusion. It records image
ID/source revision and the Debian package inventory for thirty days; failure
traces last seven days. It never logs into a registry, pushes an image or uses
provider credentials. Run the explicit tests after building the named test image:

```sh
docker build --file site/tests/fixtures/previous-runtime.Dockerfile --tag kibitz:previous-runtime .
docker build --tag kibitz:container-test .
cd site
npx playwright test --config playwright.container.config.mjs
```

Ordinary unit/e2e commands do not start Docker. The local Docker daemon was
unavailable during preparation; actual image verification ran in Linux CI.
Compose validation, context exclusion, UID/permissions, packaged engine/coach,
cookie isolation, private data/usage restart and static health all pass there.
The current retained inventory covers fourteen OS package versions; the earlier
Bookworm packaging had 88 entries. The first restart test used an
old ephemeral host port; the corrected test re-reads Docker's mapping while
keeping its cookie contexts and persistence assertions. The supplied Compose
recipe uses a fixed host port.
Other architectures and image vulnerability/advisory coverage require their own
evidence. The metadata inventory is not an advisory clearance or release approval.
HSTS, account/session limits and other
[ASVS deviations](ASVS.md) remain. Excluding Git in a packaged process does not
change a native checkout's process access. The CSS/font findings were addressed
in [11.5.1](WEB-ASSETS.md); component coverage and LLM identity/prose limits remain open.
