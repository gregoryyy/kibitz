# Retained candidate evidence: 002fd92

These sixteen files were downloaded from completed public GitHub Actions jobs
for source `002fd92dd33e009f86cf8b79008180888a392e0f`, tested PR merge
`117842780fa4391b9643e750b367e3ac8ceeb926`, on 2026-10-25. Files are retained
byte-for-byte so their original SHA-256 values remain useful after CI expiry.
They contain synthetic mock-staging and public component evidence, not operator
configuration or live provider responses.

- `image/`: artifact **12596571229**, named
  `container-metadata-117842780fa4391b9643e750b367e3ac8ceeb926`, from
  [image run 40187595328](https://github.com/gregoryyy/kibitz/actions/runs/40187595328).
  Includes the raw Trivy report, database metadata, exact image config/rootfs,
  OS inventory, runtime/asset identities, publisher verification output and summary.
- `web/`: artifact **12597120863**, named
  `security-baseline-117842780fa4391b9643e750b367e3ac8ceeb926`, from
  [baseline run 40187595333](https://github.com/gregoryyy/kibitz/actions/runs/40187595333).
  Includes the raw ZAP report, coverage, headers, npm audit, lockfile SBOM and
  summary. HTML renderings and verbose scanner logs are not copied.

The [structured review](../../../0.1.0-rc.1-evidence.json) lists each retained
file's SHA-256 and checked results. The [candidate review](../../../0.1.0-rc.1.md)
records scope, exceptions, deadlines and remaining gates. Paths in `rawSha256`
resolve relative to this directory.

Rechecking the image evidence uses `checkImageReport()` in
[image-advisories.mjs](../../../../../site/scripts/image-advisories.mjs), with
the report/database, config digest, rootfs diff IDs, source label, production
dependencies and OS inventory. Use recorded scan creation time for historical
freshness; this does not run a fresh scan. Compare config/report bytes with
their retained hashes independently. `checkZap()` and `checkHeaders()` in
[security-scan.mjs](../../../../../site/scripts/security-scan.mjs) check raw
report/coverage and HTML header policy. The lockfile hash and all distinct locked
package/version pairs were compared with the SBOM; seven runtime asset hashes
and sizes were compared with a fresh build.

CI deleted the exported image archive and database bytes. Their recorded hashes
do not mean this repository retains or independently rehashes those bytes.
Publisher cryptographic verification is the passing CI step; this review checks
the retained digest, issuer and subject. SBOM coverage excludes broader embedded,
native, build-tool and model provenance. Informational and medium/low findings
remain visible. This evidence does not approve a release or cover later source.
