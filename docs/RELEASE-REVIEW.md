# Local release review packet

Prepared on 2026-10-25 for TODO 11.6. **The release gate remains open.**
This packet collects evidence and decisions for a local single-user release;
it does not approve a release, accept risks or assign a published version.
The package value `0.1.0` is still the unreleased development baseline.

## Source and prerequisites

The preparation starts at `209e458ec8283ae86ea86a3600632a1de663298c`.
At this review, `origin/main` is `42761c3` (through PR #117). These prerequisite
PRs are open and must merge through passing CI before selecting the release
candidate and running its final checks:

| PR | Result supplied |
| --- | --- |
| [118](https://github.com/gregoryyy/kibitz/pull/118) | Automated dependency/secret/code/passive scans and retained evidence |
| [119](https://github.com/gregoryyy/kibitz/pull/119) | Version policy and Unreleased changelog |
| [120](https://github.com/gregoryyy/kibitz/pull/120) | Local image, private volume and persistence checks |
| [121](https://github.com/gregoryyy/kibitz/pull/121) | Supported Luna Chat Completions tool mode |
| [122](https://github.com/gregoryyy/kibitz/pull/122) | User/provider/native-Ollama guides |
| [123](https://github.com/gregoryyy/kibitz/pull/123) | Local fonts and trusted stylesheet hashes |
| [124](https://github.com/gregoryyy/kibitz/pull/124) | Minimal runtime and exact-image advisory verification |

The tested scope is [local, single-user operation](DEPLOYMENT.md), either native
Node or the loopback-published container. It includes cookie-separated private
storage, optional external providers and optional browser inference. It supplies
no hosted accounts, network deployment, model-quality certification or registry
publication. The [Primer motivation](../README.md) and
[retrieval/literature comparison](research/position-retrieval-comparison.md) describe experiments,
not evidence that arbitrary generated chess explanations are correct.

## Evidence available before the release candidate

| Review/check | Recorded result | Boundary |
| --- | --- | --- |
| [OWASP application review](OWASP-TOP10.md) | Ten categories mapped to code, tests and finding dispositions | Source/test review, not certification; re-review changes at the candidate |
| [OWASP LLM 2025 review and 2026 crosswalk](OWASP-LLM.md) | Deterministic prompt/tool/privacy/output/resource boundaries have regression evidence | Model identity and unrestricted claim verification remain partial |
| [ASVS 5.0.0 L1](ASVS-L1.md) | All 70 requirements recorded: 28 scoped verifications, 30 justified absences, ten deviations, two open | Record validation does not execute tests or establish compliance |
| Unit/server suite at `92ccc07` | 690 pass, one opt-in live skip | Mock/fake providers; later entrypoint regression also passes independently |
| Checker regression after main reconciliation | Eight groups pass in each prerequisite branch; unguarded stdin import reproduces failure | CLI/import behavior only; no application/scanner policy change |
| [Passive web baseline](WEB-ASSETS.md) | [Run 40158959465](https://github.com/gregoryyy/kibitz/actions/runs/40158959465), source `00e7d16`, merge `9c8d6843`: zero high/medium, two informational types | Seven required routes, sixty enabled passive rules; comments and grouping-cookie information retained |
| [Exact packaged-image scan](IMAGE-ADVISORIES.md) | [Run 40166278799](https://github.com/gregoryyy/kibitz/actions/runs/40166278799), source `92ccc07`, merge `da379a15`: zero high/critical, 23 medium/eight low | Fresh hashed DB, fourteen OS/sixteen library versions, independently verified image/config/rootfs/source identities |
| Actual container tests in that run | Four pass: boundaries, Stockfish/mock UI, restart isolation and previous-packaging volume compatibility | Both packaging recipes use the current app/schema; not historical schema-migration evidence |
| CodeQL | At the current main snapshot, no open high alerts; medium alerts 20/21/23 remain. PR #124 races 25/26 are fixed without dismissal | Passing PR check does not remove retained medium findings or replace a release-commit scan |

Implementation and exact sanitized identities are in
[DONE](DONE.md), [web evidence](security/2026-10-25-web-assets.json) and
[image evidence](security/2026-10-25-image-advisories.json).
Current prerequisite CI is rerunning after main reconciliation. These historical
results must not be relabeled as tests of a future release revision.

## Required dispositions

Owner disposition is **pending** for every deviation below. Acceptance would
record a deployment-specific exception, not turn an unsatisfied ASVS requirement
into a verification. The full notes and evidence remain in the
[versioned assessment](asvs-l1.json).

| ASVS requirement(s) | Unresolved condition | Decision/evidence needed |
| --- | --- | --- |
| 3.3.1, 3.4.1 | Local HTTP grouping cookies have no Secure flag or secure prefix; no HSTS | Confirm supported transport and cookie/data compatibility; assess TLS separately before network use |
| 7.2.1, 7.4.1, 8.2.1 | Grouping tokens are not authenticated identities, revocable sessions or account permissions | Explicitly retain local trusted-client scope or implement/review a different deployment |
| 12.2.1, 12.2.2 | Local HTTP/private test certificates and operator-selected endpoint transports | Review the actual deployment and endpoints; no operator secrets/configuration were inspected |
| 13.4.1 | Packaged process excludes Git; native checkout process can read its checkout metadata | Choose supported release execution modes and disposition the native-process deviation |
| 14.2.1 | Explicit Lichess navigation puts the selected FEN in URL/history | Review documented private-position disclosure |
| 14.3.1 | Browser data intentionally survives page close; no authenticated-session lifecycle | Review persistence/erasure expectations and export/backup limits |
| 12.1.1 — open | No actual release TLS-version/endpoint inventory | Supply deployment evidence; local TLS fixtures alone do not satisfy this |
| 15.2.1 — open | Broader component advisory/age coverage and lower-finding exposure triage are incomplete | Review build stages, Actions, Node/WASM internals and model provenance alongside dated runtime/npm evidence |

The 31 runtime package findings retain individual first-reported dates and
[review/remediation targets](security/2026-10-25-image-advisories.json): medium
review by 2026-11-01/remediation by 2026-11-24; low review by
2026-11-24/remediation by 2027-01-23. Their current disposition is pending, with
no blanket reachability exclusion, suppression or risk acceptance. Apply the
[maintenance policy](MAINTENANCE.md), including its overdue/release rule.
CodeQL 20/21 are intentional operator capture writes; 23 reflects supported
local HTTP cookies. Their documented contexts still need release disposition.
The [initial runtime exposure review](security/2026-10-25-runtime-triage.md)
checks all 25 distinct CVEs against vendor records and the supplied configuration.
It records CPU/function/service prerequisites, the resolver configuration concern
and native-linkage/range gaps. All raw findings and owner dispositions remain open.
The [compiled-component/package evidence](COMPONENT-PROVENANCE.md) additionally
records verified registry signatures and exact upstream source candidates, while
keeping the binary compilation link unverified. New packaged Node/asset capture
is pending actual Linux artifact review; native smoke output is not substituted.

## Candidate work and external inputs

Before approval, select a version and exact merged source, update the changelog
and package/lock metadata using [the release procedure](RELEASING.md), then run
lint/JSDoc, build, the complete unit/browser suites and every security workflow.
Retain actual run/merge/image/DB/report identities and artifacts before expiry.
Re-review every changed OWASP/LLM/ASVS control and record owner dispositions,
component triage/deadlines, licences/notices, data compatibility and supported
platforms in the release PR. An open high finding or an overdue item blocks it.

The following TODO items require separate evidence or decisions; none is silently
closed by this packet:

- **1.4:** human game results for strength calibration.
- **2.15 / 10.8.4.3:** working provider credentials/quota/model availability and a
  fresh approved live-call plan for recorded fixtures/comparable German trials.
  Previous paid approvals are not reused.
- **10.2:** hosted authentication remains deferred by the local deployment choice.
- **11.3.3:** mutable cloud/Ollama/Chrome identities and incomplete upstream
  provenance require model-specific review; labels alone cannot pin them.
- **11.3.9:** arbitrary chess prose is not exhaustively verified. Recognized
  lines/pieces/motifs, regex cue counts and zero detected problems cannot establish
  the promised general guarantee. Changing that requirement needs an explicit
  scope decision; implementing broader deterministic checks needs its own plan.
- **11.6:** prerequisites, actual candidate checks and the dispositions above are
  outstanding. Only a passing, approved release PR and explicit publication
  authorization can lead to a tag/assets; this preparation does neither.
