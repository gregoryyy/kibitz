# Automated security evidence

TODO 11.5 extends the existing PR checks for the local single-user deployment.
These jobs provide repeatable evidence; they do not approve a release or replace
the [application](OWASP-TOP10.md), [LLM](OWASP-LLM.md), [ASVS](ASVS.md) or
[maintenance](MAINTENANCE.md) reviews.

| Check | Trigger and scope | Evidence and failure behavior |
| --- | --- | --- |
| Dependabot version PRs | Weekly npm `/site` and GitHub Actions `/`, after its configuration reaches main | At most five open version PRs per ecosystem, seven-day cooldown; reviewed through normal CI, with no automatic merge |
| npm audit | Every PR/main CI and security-baseline run | High/critical findings or audit failures fail the job; baseline retains full JSON, including lower severities |
| CodeQL security-extended | PR/main and weekly, for this public repository | JavaScript and Actions analysis, separate GitHub code-scanning findings; feature checks do not dismiss historical alerts |
| Gitleaks | PR/main CI, checkout includes history | Findings fail the job; no automatic PR comments or write token |
| CSP/headers | Each security-baseline job against its own real CLI server | Required HTML isolation/CSP boundaries, limited script sources/hashes, SVG charset and seven expected 200 routes; missing/weakened boundaries fail |
| ZAP passive baseline | PR/main, weekly and manual Security baseline workflow | Pinned scanner, one-minute traditional spider, five-minute scanner startup/passive wait, ten-minute process bound; full reports retained, high findings or incomplete evidence fail |
| Component inventory | Same security-baseline workflow | Lockfile CycloneDX SBOM, npm advisory report, exact commit/Node version/lock digest/scanner image, header and route evidence |

[Dependabot configuration](../.github/dependabot.yml) uses the
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

The [workflow](../.github/workflows/security-baseline.yml) gives the scan only a
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
[Evidence metadata and raw-report digest](security/2026-10-25-baseline.json) retain
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
The [web-asset follow-up](WEB-ASSETS.md) documents local fonts and hashed styles.
Its actual run `40158959465` at source `00e7d16`/merge `9c8d684` has zero high or
medium findings; six public-comment instances and three grouping-cookie responses
remain informational. The independently checked raw report covers all seven required
routes, fifteen paths and sixty enabled rules, with an empty queue and verified
loopback listener. [Sanitized metadata](security/2026-10-25-web-assets.json) retains
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
