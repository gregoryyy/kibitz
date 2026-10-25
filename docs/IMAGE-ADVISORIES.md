# Packaged image advisory evidence

TODO 11.6.1 supplies dated advisory evidence for the exact local image tested by
[container CI](../.github/workflows/container.yml). The parent release gate stays
open. The [maintenance policy](MAINTENANCE.md) still requires component-specific
triage, deadlines and release review; a scanner result is one input.

## Scope and source

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

## Initial findings and minimal runtime

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

## Database and failure policy

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

## Retained evidence and limits

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
retained. [Sanitized evidence and triage targets](security/2026-10-25-image-advisories.json)
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
