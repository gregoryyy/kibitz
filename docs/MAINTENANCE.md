# Component maintenance policy

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
within these targets. [Automated scans](SECURITY-SCANS.md) and
[exact-image evidence](IMAGE-ADVISORIES.md) supply dated snapshots, including
individual lower-finding targets. Broader component coverage and exposure triage
remain in the [release review](RELEASE-REVIEW.md); a snapshot does not establish
continuing compliance with this policy.
