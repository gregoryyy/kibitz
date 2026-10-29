# Supply chain and scans

Automated scans, advisories for the packaged image, component provenance, the maintenance policy and the web-asset fixes.

## Automated security evidence

TODO 11.5 extends the existing PR checks for the local single-user deployment.
These jobs provide repeatable evidence; they do not approve a release or replace
the [application](owasp-top10.md), [LLM](owasp-llm.md), [ASVS](asvs.md) or
[maintenance](#component-maintenance-policy) reviews.

| Check | Trigger and scope | Evidence and failure behavior |
| --- | --- | --- |
| Dependabot version PRs | Weekly npm `/site` and GitHub Actions `/`, after its configuration reaches main | At most five open version PRs per ecosystem, seven-day cooldown; reviewed through normal CI, with no automatic merge |
| npm audit | Every PR/main CI and security-baseline run | High/critical findings or audit failures fail the job; baseline retains full JSON, including lower severities |
| CodeQL security-extended | PR/main and weekly, for this public repository | JavaScript and Actions analysis, separate GitHub code-scanning findings; feature checks do not dismiss historical alerts |
| Gitleaks | PR/main CI, checkout includes history | Findings fail the job; no automatic PR comments or write token |
| CSP/headers | Each security-baseline job against its own real CLI server | Required HTML isolation/CSP boundaries, limited script sources/hashes, SVG charset and seven expected 200 routes; missing/weakened boundaries fail |
| ZAP passive baseline | PR/main, weekly and manual Security baseline workflow | Pinned scanner, one-minute traditional spider, five-minute scanner startup/passive wait, ten-minute process bound; full reports retained, high findings or incomplete evidence fail |
| Component inventory | Same security-baseline workflow | Lockfile CycloneDX SBOM, npm advisory report, exact commit/Node version/lock digest/scanner image, header and route evidence |

[Dependabot configuration](../../.github/dependabot.yml) groups all CodeQL action
steps into one version update: `init` and `analyze` share configuration and must
use the same commit. A unit regression checks that invariant. The configuration uses the
[official options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
Version updates need the configuration on the default branch; writing it on a PR
does not prove the updater has run. Repository inspection on 2026-10-25 found
GitHub-native vulnerability alerts, automatic security updates and secret/push
scanning disabled. This PR does not change those repository settings. Gitleaks and
npm audit are the implemented independent checks; do not label them as enabled
GitHub-native features. Review any update before running/merging it.

Run `npm run build` then `npm run security:scan` in `site/` on a Linux host with
Docker. The script starts a fresh loopback server on an ephemeral port with
`--env=`, a memory library, mock AI/embeddings and a small explicit environment.
It never uses the operator's server, `.env`, provider credentials, library or models.
There is no target option. `--headers-only` runs the staging/header checks locally
without Docker and is explicitly partial evidence, not a ZAP run.

The [workflow](../../.github/workflows/security-baseline.yml) gives the scan only a
read token. Docker receives only the synthetic report directory, with host
networking to reach this staging server; the ZAP listener and API allowlist are
restricted to loopback. It is not mounted on the checkout,
operator configuration or Docker socket. The versioned official
[ZAP 2.17.0 image](https://github.com/zaproxy/zaproxy/releases/tag/v2.17.0) is pinned to
`sha256:5ccfff9a411743ab2615136a2edd7416bec9ce41572fa94e935df38c14adb2b6`.
`-silent` disables add-on updates, preserving the image's rule set. The pinned
[baseline implementation](https://github.com/zaproxy/zaproxy/blob/v2.17.0/docker/zap-baseline.py)
documents that behavior; upgrading requires review of the image and rule changes.
The image's built-in UID 1000 retains access to its own home/browser-helper cache.
Its primary group matches the runner and the report directory is mode 0770; a
group-writable umask allows CI to collect and remove generated evidence without
running the scanner as root or making the directory world-writable.

The hook replaces the pinned launcher's initial wildcard listener with loopback,
checking its expected argument structure before starting ZAP. The pinned network
add-on takes the first host option, so appending an override is insufficient.
The API allowlist checks both peer address and Host header: it permits only the
loopback address and the Python client's exact virtual API name `zap`.
Five Python regression tests exercise replacement, option preservation, source
drift rejection, read-only seeding and the actual URL-method coverage interface
and API-address rejection without needing ZAP on the host. No rule options are rewritten.

The [baseline](https://www.zaproxy.org/docs/docker/baseline-scan/) uses passive
analysis rather than an active attack scan. Its
[hook](https://www.zaproxy.org/docs/docker/scan-hooks/) seeds only GET routes for
the app, data page, SVG, AI/embedding status and empty library status/records. It
records visited paths, enabled passive rules and the remaining passive queue.
It does not suppress alerts or call inference/write routes. The runner rejects
missing seeds, empty rule evidence, pending passive work, malformed/wrong-version
reports and reports for another origin. Scanner exit errors and missing reports
cannot reuse stale prior output. High-risk alerts fail even if ZAP's default
disposition calls them WARN. Lower findings remain in reports for explicit review;
none is accepted or manually dismissed by this workflow. No application-specific
rule/path exclusions or progress suppressions are added. The official baseline's
built-in internal/example-rule exclusions remain; the separate high-risk check
uses the full raw JSON report, including informational entries.

Artifacts under ignored `site/tests/out/security/` include startup logs, `scan-summary.json`,
`headers.json`, `scan-coverage.json`, `zap.json`, `zap.html`, `npm-audit.json` and
`npm-sbom.json`. CI retains JSON/HTML for thirty days on success or failure. Use
the [npm SBOM command](https://docs.npmjs.com/cli/v11/commands/npm-sbom/) to reproduce
the lockfile inventory. Archive the exact run and release commit in the release
PR before artifacts expire. Treat scanner HTML as a report to inspect, not content
to embed in the application.

The actual [2026-10-25 CI baseline](https://github.com/gregoryyy/kibitz/actions/runs/40151516551)
passed at source `45ff4b9`, scanning merge `45df8e87bef8c2cf1ef6437d1d91007d579c7182`
with Node 24.21.0. All seven required routes were present among sixteen URLs /
fifteen distinct paths; sixty passive rules were enabled and the remaining queue
was zero. The startup log confirms a `127.0.0.1` listener. npm audit found zero
advisories and the SBOM has 128 components. The independently rechecked raw report
has zero high findings, two medium types and three informational types.
[Evidence metadata and raw-report digest](2026-10-25-baseline.json) retain
the exact run/source/image/lock identities without committing ephemeral cookies
or response bodies. Initial startup failures remain recorded in DONE and their
CI artifacts; they are not counted as successful scans.

| Finding | Disposition |
| --- | --- |
| Medium 10055-6, authored `style-src unsafe-inline` on two HTML pages | Historical finding; absent in the actual 11.5.1 rerun after trusted style hashes and blocked attributes |
| Medium 90003, missing SRI on the Google Fonts stylesheet | Historical finding; absent in the actual 11.5.1 rerun after original fonts are bundled and external links removed |
| Informational 90011-2, header `utf-8` versus wrapper meta `utf8` | Historical finding; absent in the actual 11.5.1 rerun after canonical wrapper spelling |
| Informational 10027, six source-comment instances | Reviewed public authored comments, including words SELECT/USER; no operator payload was staged |
| Informational 10112, two cookie response instances | Expected opaque usage/library groups; session-management deviations remain documented in ASVS |

This completes the automation/evidence milestone, not remediation of every
finding or release approval. The local headers-only preflight passed; the local
Docker availability probe stalled and was stopped. Actual ZAP evidence comes
from Linux CI, not a claimed local scan or an operator service.

The checked-in policy tests deliberately fail weakened headers, high alerts,
unknown reports, missing coverage and child-process deadlines. Existing browser
CSP-violation tests remain separate. A traditional spider does not exercise every
JavaScript interaction, model/tool response, authenticated flow or imported PGN.
The [web-asset follow-up](#browser-styles-and-bundled-fonts) documents local fonts and hashed styles.
Its actual run `40158959465` at source `00e7d16`/merge `9c8d684` has zero high or
medium findings; six public-comment instances and three grouping-cookie responses
remain informational. The independently checked raw report covers all seven required
routes, fifteen paths and sixty enabled rules, with an empty queue and verified
loopback listener. [Sanitized metadata](2026-10-25-web-assets.json) retains
the exact identities/digest, and no finding/rule/path is suppressed. Worker blobs/WASM, local
HTTP/HSTS/cookie deviations, mutable model identities and unrestricted chess prose
remain review concerns. The SBOM/audit snapshot is not a complete dated advisory
assessment for Node, Actions, WASM internals, cloud models or future container
components; ASVS v5.0.0-15.2.1 remains open.

The post-merge main CodeQL snapshot at `71a863d` records only open medium alerts
20/21 (explicit bounded capture paths) and 23 (local HTTP grouping cookie).
No high alert remains in that snapshot; this does not settle lower findings or
other scanners. Keep the release gate independent and rerun against the release
commit after all required merges.

The separate [packaged-image advisory check](#packaged-image-advisory-evidence) targets the exact
CI-built/tested container archive with a pinned scanner, fresh recorded database,
OS/production-package coverage and high/critical gate. It retains all raw findings;
its actual Linux verification passes with no high/critical runtime findings and
31 retained medium/low package findings for triage. This complements npm/ZAP evidence rather
than extending either scanner's coverage to opaque WASM/model internals.

## Packaged image advisory evidence

TODO 11.6.1 supplies dated advisory evidence for the exact local image tested by
[container CI](../../.github/workflows/container.yml). The parent release gate stays
open. The [maintenance policy](#component-maintenance-policy) still requires component-specific
triage, deadlines and release review; a scanner result is one input.

### Scope and source

The image is built by the existing deny-by-default Docker context and passes the
actual browser/private-file/restart cases before scanning. The check compares its
image ID and source label with the recorded inventory and CI checkout revision,
and records the actual packaged Node version. It exports that image to a temporary
Docker archive; the scanner receives a read-only archive rather than a daemon
socket. No registry push, operator environment, private library, API call or model
download is involved.

The official [Trivy 0.76.1 release](https://github.com/aquasecurity/trivy/releases/tag/v0.76.1)
was published on 2026-10-21. The scanner uses the independently hashed manifest
`ghcr.io/aquasecurity/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
The official [archive scan interface](https://trivy.dev/docs/latest/target/container_image/#tar-files)
supports this exported-image boundary. The [JSON report schema](https://raw.githubusercontent.com/aquasecurity/trivy/v0.76.1/pkg/types/report.go)
supplies image, source, scanner, package and vulnerability identities.

The scanner runs as the Linux runner's non-root UID/GID with a read-only root,
dropped capabilities, no new privileges, bounded memory/CPU/PIDs/tmpfs and an
eight-minute scanner/ten-minute child deadline. Its only writable mount holds
synthetic evidence/cache. Cleanup removes its uniquely named container and private
archive/cache. Explicit configuration/ignore-file selection avoids ambient policy;
telemetry/version checks and dependency-identification API calls are disabled.
The scanner still downloads its public advisory database.

### Initial findings and minimal runtime

The first actual [Linux run](https://github.com/gregoryyy/kibitz/actions/runs/40160064985)
completed scanning but failed verification. Its raw report contains 244 package
findings: 61 high, one critical, 96 medium, 84 low and two unknown. They remain
retained, without a claim that every source-package advisory is reachable through
the app. The runtime actually reports Node 24.22.1; the earlier 24.21.0 staging
version described the CI host, not that packaged binary. CI now pins 24.22.1 rather
than a major-only selector, following the [Node security release](https://nodejs.org/en/blog/release/v24.22.1).

Actual evidence also exposed two validator assumptions: Trivy's `ImageID` is the
archive's config digest, while the modern Docker daemon can report an image/index
digest; Debian inventory reports split epoch, version and release. The corrected
check independently hashes the archive config member, checks its source and
ordered rootfs layers against daemon inspection and raw scanner metadata, and
reconstructs complete Debian versions. It retains both identities and the archive
digest. These corrections preserve exact coverage and the high/critical gate.

The runtime is the official
`gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325b7ec4af55462cb0b424a53b452a5b4a894ffe841fcf1048d216fb9f8`.
It retains Node/shared libraries while removing unnecessary shell, npm/corepack
and OS utility packages from the distributed runtime. Build stages retain the
original pinned Node/npm image. [Distroless documents](https://github.com/GoogleContainerTools/distroless)
its minimal contents, vector entrypoints and publisher signature policy. CI uses
pinned Cosign 3.1.4/installer commit to verify that exact manifest against Google's
documented issuer and publisher identity before building.

Explicit UID/GID 1000 and private data modes preserve previous volume ownership.
A fourth actual container case creates a library and usage record under the
frozen previous packaging recipe, then opens the same volume/cookie scope under
the minimal runtime and checks independent-client isolation. Both images use the current
app/data schema: this is packaging compatibility, not a historical schema-migration
guarantee. The actual execution, signature and advisory results are recorded below.

### Database and failure policy

Each run starts with an empty cache and selects the official
`ghcr.io/aquasecurity/trivy-db:2` repository, following [database configuration](https://trivy.dev/docs/latest/configuration/db/).
The database tag must refresh to acquire current advisories; it is not a frozen
clearance. Evidence records its schema, updated/downloaded/next-update timestamps
and the SHA-256 of the actual database file. Missing/expired metadata, an update
older than 24 hours, a download/scan older than 30 minutes or a clock more than
five minutes ahead fails verification. The 24-hour freshness bound is this
project's scan-input policy, separate from the maintenance remediation clock.

The raw JSON must identify the exact image/source/scanner, supported Debian 13
OS and current scan time. Package coverage must include every version in the
separately captured Debian inventory (read by Node from dpkg status/status.d without a package-manager executable) and every declared production npm dependency.
Wrong/missing inventories or malformed reports fail, rather than become empty
clean results. An explicitly end-of-life OS fails too.

All statuses and severities remain in the raw report and summary. No severity
filter, ignore-unfixed/status option, VEX exception or custom ignore file is used.
Modified/suppressed findings fail verification. **Any high or critical finding
fails the CI check**, including one without a known fix. Unknown/low/medium
findings remain visible for triage and the maintenance deadlines; passing this
gate does not accept their risk. Severity follows Trivy's default vendor-aware
selection and is not a complete reachability analysis.

### Retained evidence and limits

The existing container artifact retains image/source IDs, independently derived
archive config/rootfs metadata, OS inventory and the
advisory raw report, database metadata/digest and summary for thirty days on
success or failure. The summary records scan completion separately from policy
success, plus actual Node version and raw report/archive digests. Database bytes,
Docker archive, daemon credentials and operator data are not uploaded. Failed
operations remain incomplete and cannot be treated as successful scans.

The tool inventories detected runtime packages; build-stage images and CI tools
have separate advisory scope. It cannot prove that every embedded C/C++
or WASM component, Node binary dependency, GitHub Action, font parser, browser,
cloud/Ollama/Chrome model or undocumented upstream fork has advisory coverage.
Checking installed npm versions does not establish the exact llama.cpp revision
inside a distributed WASM. Those provenance/coverage questions and owner
dispositions remain in ASVS 15.2.1 and TODO 11.3/11.6. A clean report is neither a
zero-vulnerability guarantee nor release approval.

The final actual [Linux run](https://github.com/gregoryyy/kibitz/actions/runs/40166278799)
passes at source `92ccc07`, scanned merge `da379a15`. Independent artifact review
recomputes the archive config digest, compares source/rootfs identities and exact
package versions, verifies report digest and re-runs the raw gate. The publisher
signature names the exact pinned runtime manifest. All four image/browser/restart/
cross-packaging cases pass. Node is 24.22.1; fourteen OS and sixteen library versions
are covered. There are **zero high/critical findings**, with 23 medium and eight low
retained. [Sanitized evidence and triage targets](2026-10-25-image-advisories.json)
record source/image/config/report/archive/DB/signature identities and each lower
finding. Exposure triage is pending, without owner risk acceptance. Medium review
targets are 2026-11-01 and remediation targets 2026-11-24; low targets are
2026-11-24/2027-01-23, following the project's first-reported policy.

The candidate's two CodeQL file-read races are corrected using no-follow open,
descriptor validation and actual bounded reads. Real filesystem replacement,
symlink, growth and close tests pass; latest PR instances 25/26 are fixed with no
dismissal. Source CI passes lint/unit/audit, CodeQL, secret and passive-baseline
checks; the full browser job remains pending at evidence recording.

This completes the image-evidence/remediation subtask. No local Docker success is
claimed: actual image execution came from Linux CI. Release verification
must be repeated at the actual merged candidate, with review of retained findings,
maintenance age, OWASP/LLM/ASVS controls and the remaining documented deviations.

The [compiled-component follow-up](#compiled-component-and-package-provenance-evidence) adds actual Node
component/ABI versions and seven browser JS/WASM byte identities. Its successful
Linux run at source `5764f74` retains the same 31 medium/low findings and original
targets, with four passing cases and independently rechecked image/package data.
It does not extend package advisories into complete native/WASM coverage.

## Compiled component and package provenance evidence

This supplements [exact-image advisories](#packaged-image-advisory-evidence) for TODO 11.6 and
the still-open ASVS 15.2.1/LLM supply-chain review. Package inventory, binary
identity, source provenance and advisory coverage establish different facts.
None is a substitute for the others or release approval.

### Packaged runtime and browser bytes

The container workflow now prepares `runtime-components.json` from the same local
image used by the browser/persistence tests and advisory scan. It records the
actual Node version, platform, CPU architecture and
[`process.versions`](https://nodejs.org/docs/latest-v24.x/api/process.html#processversions)
map, including dependency/ABI versions exposed by that executable. It also hashes
the seven distributed Stockfish/wllama JS/WASM assets and records their sizes.
Missing assets fail capture. The existing image/source/config/rootfs records bind
the separate inventory to its image.

Capture starts a network-disabled, read-only container and reads fixed public
asset names. It records neither environment variables nor diagnostic reports,
operator paths, private storage, model weights or provider responses. The explicit
JSON artifact joins the existing thirty-day inventory retention. Initial actual
Linux capture succeeds at `0936467`, but that run's browser check fails twice on
module loads aborted by Chromium with `ERR_NETWORK_CHANGED`; its advisory scan
does not run. The [corrected actual run](https://github.com/gregoryyy/kibitz/actions/runs/40169822979)
passes all four container cases and the advisory gate at source `5764f74`, merge
`07079b6`. [Retained component evidence](2026-10-25-compiled-components.json)
records exact image/config/report/inventory/DB identities and the captured map.
Independent review rechecks config/rootfs/source, the raw advisory gate and exact
package coverage, and compares all seven asset hashes/sizes with the tested local
build. The 23 medium/eight low findings are identical to the prior report; their
original targets and pending dispositions remain unchanged. The local
command smoke test used macOS Node and is not packaged-runtime evidence.

This version map is not a complete binary SBOM, proof of static/dynamic linkage,
compiler/source attestation or advisory scan of every embedded component. A shared
OS library and Node's version of a similarly named component can differ. The byte
hashes identify shipped assets without proving which source produced them.
The actual map includes 29 version/ABI entries, including empty optional entries.
For example, Node reports OpenSSL `3.5.9` and zlib `1.3.2.1-motley-285e94b`, while
the OS inventory separately records `libssl3t64` `3.5.7-1~deb13u3` and `zlib1g`
`1:1.3.dfsg+really1.3.1-1+b1`. Neither version list establishes native linkage.

### Pinned npm metadata

The [dated record](2026-10-25-package-provenance.json) retains two package
identities, lockfile SHA-256, exact SHA-512 integrities, registry URLs and replayable
public signatures/keys. Both package integrities match the repository lockfile;
all four returned registry signatures verify, and a changed signed payload fails.
Verification uses the official registry's current nonexpired keys and
[npm's documented name/version/integrity payload](https://docs.npmjs.com/about-registry-signatures/).
The keys and signatures are public verification material, not API credentials.

This checks registry signatures over `name@version:integrity`. It does not sign
`gitHead`, attest a publisher's build or independently re-download/extract the
tarball. Normal locked `npm ci` supplies its separate tarball-integrity check.
Neither pinned package advertises a provenance attestation in the inspected
version metadata. No package install script, model download or inference is run
by this review.

### Source candidates and unresolved compilation link

| Package | Observed source evidence | Limit |
| --- | --- | --- |
| wllama 3.8.1 | npm reports commit `b68fd6427063266176bb0054befe9ff70b3258f1`; official [release tag](https://github.com/ngxson/wllama/releases/tag/3.8.1) resolves to `7ed17361caf221a84aa1e80ca85a3d6324f3af85`. Both exact trees declare llama.cpp gitlink `46ca246de9bb1c35269722a6240d37d9dfd79cad`. | Tag and npm source commits differ. The shared gitlink is source-candidate evidence, not proof that the npm WASM was compiled from it. |
| Stockfish.js 19.0.1 | Official [v19.0.1 tree](https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6) resolves to `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`; package/version and delivered bytes have their own pins. | Registry metadata supplies no `gitHead` or advertised build attestation. The tag alone cannot prove corresponding binary compilation. |

wllama's [exact npm-reported source declaration](https://raw.githubusercontent.com/ngxson/wllama/b68fd6427063266176bb0054befe9ff70b3258f1/.gitmodules)
names the original llama.cpp repository. Its gitlink resolves to the exact
[upstream commit](https://github.com/ggml-org/llama.cpp/commit/46ca246de9bb1c35269722a6240d37d9dfd79cad).
These links make upstream inspection possible without guessing a current branch.
The npm-reported commit is unsigned registry metadata; the registry signature
verified above covers only the package identity/integrity payload.

### Browser-model source revisions

The two catalogue GGUF downloads now select full official Qwen commits. On
2026-10-25, exact-revision API metadata and raw Git LFS pointer text matched the
existing file sizes and SHA-256 pins. The pointer text also reproduces the Git
blob IDs reported by those exact trees. The
[retained record](2026-10-25-browser-models.json) contains the pointers,
revision URLs and hashes of the observed model-card/licence metadata:

| Model | Official repository revision | Existing weights |
| --- | --- | --- |
| Qwen2.5 1.5B Instruct Q4_K_M | [`91cad51170dc346986eccefdc2dd33a9da36ead9`](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/91cad51170dc346986eccefdc2dd33a9da36ead9) | 1,117,320,736 bytes; unchanged SHA-256 |
| Qwen2.5 0.5B Instruct Q4_K_M | [`9217f5db79a29953eb74d5343926648285ec7e67`](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/tree/9217f5db79a29953eb74d5343926648285ec7e67) | 491,400,032 bytes; unchanged SHA-256 |

Hugging Face [documents selecting a full commit](https://huggingface.co/docs/huggingface_hub/guides/download#from-specific-version)
for a particular file revision. The runtime download still verifies the complete
weight response independently. This review fetched only small metadata, licence,
model-card and pointer text; it did not download or independently rehash weights.
API responses include mutable service metadata even at a fixed repository
revision; their recorded response hashes identify this observation, not an
immutable API representation. Offline tests replay the retained pointers and
check catalogue agreement. The actual-CLI regression intercepts every fetch with
tiny synthetic bytes while preserving the production source locators.

The model cards declare the respective Qwen instruct base models and Apache-2.0
licences. Those are publisher statements, not independent training/quantization
lineage, signed build attestations, model-safety or chess-quality evidence. A
revision pin does not promise permanent hosting. The
[upgrade procedure](../guide/readme.md#model-weight-downloads) keeps source, bytes,
licence and compatibility review together; cloud/Ollama/Chrome identities and
TODO 11.3.3 remain open.

### Release follow-up

The [dated Action record](2026-10-25-action-advisories.json) independently
resolves all six direct wrapper pins to their official version tags, including
CodeQL's annotated tag. A paginated
[official advisory API query](https://docs.github.com/en/rest/security-advisories/global-advisories#list-global-security-advisories)
returns no matching reviewed, non-withdrawn advisories for those six exact
versions. It excludes unreviewed reports/malware and does not establish complete
coverage, review wrapper code, or inventory bundled dependencies, downloaded tools,
runner runtimes or hosted-platform changes. No pin, token, repository setting or
alert disposition was changed by this read-only review.

Review actual Linux version/hash output against the image and package pins before
using it. Check vendor advisories for those component versions and assess bundled
build flags/backports/call paths; broad package matching alone cannot establish
native reachability. Obtain reliable build/source linkage where absent or record
the remaining gap explicitly. Build stages, GitHub Actions and browser/model
runtime changes retain their separate advisory/age and licence review.

The [release packet](../releases/readme.md#local-release-review-packet) keeps ASVS 15.2.1 and TODO 11.3.3 open.
Mutable cloud IDs, Ollama tags, Chrome-managed updates and model-training provenance
are not fixed by these package or byte records. No release, finding suppression,
owner exception, provider test or teaching-quality claim follows from this work.

## Component maintenance policy

This policy defines project review/remediation targets for TODO 11.4 and ASVS
v5.0.0-15.1.1. It is not a staffed response-time or availability promise.
Start the remediation clock when a relevant advisory is first reported to the project.
Record the component/version, advisory, exposure, first-known date, owner, deadline
and outcome in an issue or maintenance PR. Assess application reachability and
deployment context; scanner severity alone does not settle exposure.

| Risk after triage | Review target | Remediation target |
| --- | --- | --- |
| Critical, or active exploitation affecting this deployment | Within 24 hours | Patch, remove or disable affected functionality within 72 hours |
| High | Within 2 days | Within 7 days |
| Medium | Within 7 days | Within 30 days |
| Low | Within 30 days | Within 90 days |

Review dependencies and upstream advisories at least every 30 days, including
production/development npm packages, GitHub Actions, Node, bundled WASM/engine and
browser-model libraries. Container/base-image components join this inventory when
packaging exists. Cloud/Ollama/Chrome model identity changes need their separate
LLM supply-chain review; an npm lockfile does not pin those models.

Keep direct versions and the lockfile pinned. Review update diffs, licence compatibility,
changelog and relevant tests before merging through a PR. Run lint/types, build,
unit tests, appropriate browser regressions and dependency/secret/code scans.
Do not automatically execute or merge an unreviewed dependency update.

An overdue item or an unresolved exploitable high/critical finding blocks a release.
If an exception is needed for another risk level, require explicit owner approval in
the release/maintenance PR with scope, mitigation, revised deadline and review date.
An exception must remain visible; do not dismiss an alert merely to make a check green.

The current ASVS review does not establish that the whole component inventory is
within these targets. [Automated scans](#automated-security-evidence) and
[exact-image evidence](#packaged-image-advisory-evidence) supply dated snapshots, including
individual lower-finding targets. Broader component coverage and exposure triage
remain in the [release review](../releases/readme.md#local-release-review-packet); a snapshot does not establish
continuing compliance with this policy.

## Browser styles and bundled fonts

TODO 11.5.1 addresses the web-asset findings retained by the first [passive baseline](#automated-security-evidence): broad inline-CSS authority, an external stylesheet without SRI, and inconsistent charset spelling. It preserves the original typefaces and the app's self-contained artifact body.

### Policy boundary

The [static policy](../../site/server/static.mjs) parses the trusted, descriptor-read HTML with parse5. Complete active HTML/SVG script and style nodes receive separate SHA-256 hashes over browser-normalized text. Comments, raw-text lookalikes, template contents, unsupported type blocks and unfinished tags grant no hashes. Only script nodes use script-type/src semantics; CSS hashes never become script permissions.

`style-src` permits same-origin assets and the exact trusted stylesheet hashes. `style-src-attr 'none'` blocks style attributes; there is no `unsafe-inline` or `unsafe-hashes`. Authored layout choices use CSS classes. Existing JavaScript/CSSOM properties still update trusted board geometry, evaluation/progress bars and viewport variables. The browser regression verifies both blocked injection and working property updates. [CSP Level 3](https://www.w3.org/TR/CSP3/) defines these style-element/attribute boundaries.

This is policy generation for operator-owned build files, not sanitization of user HTML. Every supplied active style/script can receive authority, so the whole input must remain trusted. Imported notes, model text and PGNs continue through literal renderers and quoted prompts. Hashes allow matching bodies; they do not make a same-origin asset store safe against a malicious operator. The existing worker `blob:` and WebAssembly permissions remain necessary and independently reviewed.

Online and offline pages now both restrict fonts/styles to the same origin. The legacy offline transform still removes old Google Fonts link markup from trusted custom pages. The full local document uses canonical `<meta charset="utf-8">`, agreeing with the HTTP header. No scanner rule or path is suppressed to obtain these changes.

### Font provenance and distribution

The original normal variable fonts are bundled unchanged from the official [Google Fonts repository](https://github.com/google/fonts/tree/e7db6ca603fd4862010383ff17ffd6cc4ffac1c0), retrieved on 2026-10-25:

| Family | Local bytes | Upstream authors/licence |
| --- | ---: | --- |
| Bricolage Grotesque | 408,496 | 2022 Bricolage Grotesque Project Authors; [complete SIL OFL notice](../../site/src/fonts/bricolagegrotesque-OFL.txt) |
| Instrument Sans | 194,336 | 2022 Instrument Sans Project Authors; [complete SIL OFL notice](../../site/src/fonts/instrumentsans-OFL.txt) |
| JetBrains Mono | 187,208 | 2020 JetBrains Mono Project Authors; [complete SIL OFL notice](../../site/src/fonts/jetbrainsmono-OFL.txt) |

The [manifest](../../site/src/fonts/manifest.json) records exact upstream paths/revision, byte counts and SHA-256 for fonts and licences. [Build verification](../../site/scripts/build-fonts.mjs) checks the complete selected inventory before copying; altered bytes or invalid filenames fail the build. There is no automatic fetch/update or font package dependency. Updates need a deliberate source/licence/hash review and another browser/offline check.

The build ships fonts, full licences and the manifest under `dist/fonts/`, with `font/ttf` serving. Public offline bundles hash/cache these files too, adding 790,040 font bytes plus notices/metadata. Font family names remain unchanged; browser/system fallbacks still handle unsupported glyphs or load failures. Local rendering and device rasterization can differ from Google Fonts' former browser-specific subsets. No remote font CSS or connection metadata is sent from the current page, and there is no external stylesheet SRI boundary left. The [third-party notices](../../THIRD_PARTY_NOTICES.md) retain the upstream attribution rather than relicensing the fonts as GPL.

### Verification scope

Unit tests cover parsed CSS hash selection and separation, retained font/licence bytes in the built offline inventory, failed publication for corrupted assets, and negative header-policy cases. Chrome regressions cover real policy enforcement, normal module/worker execution, local font loading, German phone layout and no external requests. Existing app/offline scenarios check the broader interaction boundaries. These tests do not substitute for a passive scan or general CSS/HTML sanitizer.

The actual isolated [ZAP rerun](https://github.com/gregoryyy/kibitz/actions/runs/40158959465) at source `00e7d16`, scanned merge `9c8d684`, passes. Independently inspected raw JSON has zero high or medium findings: the CSS, external-stylesheet SRI and charset types are absent. Two informational types remain (six authored source-comment instances and three grouping-cookie responses). All seven required routes appear in fifteen visited paths; sixty passive rules remain enabled, with no pending queue or custom suppressions. The startup log verifies the literal loopback listener. [Sanitized metadata and report digest](2026-10-25-web-assets.json) preserve identities without cookies or response bodies. npm audit remains zero with 128 SBOM components.

This completes TODO 11.5.1. Earlier reports remain historical evidence, including their lower-severity findings. Release approval, local HTTP/account deviations, component-advisory gaps, mutable model identities and unrestricted chess-claim verification remain separate.

### Chessground 10.4.2 compatibility follow-up

The dependency update in PR #129 adds a fixed `style="color-scheme:light only"`
to every SVG overlay. The strict `style-src-attr 'none'` policy correctly blocks
those attributes; actual container runs for #130/#134 fail their CSP assertions.
The local build adaptation in `site/scripts/build.mjs` removes that one fixed
attribute declaration from the pinned bundle and keeps its appearance through
`.cg-wrap cg-container > svg` in the trusted page stylesheet. It accepts only
10.4.2 with exactly one expected declaration; an upgrade requires reviewing the
adaptation. Other upstream bundle bytes and all CSP restrictions are retained.

Playwright checks all four overlay layers, arrows, both board orientations and
light/dark themes, including actual computed styles and absence of CSP events.
The old build fails with blocked attributes and a `normal` computed scheme.
The third-party notice identifies the local modification and its reproducible
source. This compatibility fix does not close broader provenance/release gates.
