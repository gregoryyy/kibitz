# Versioning and releases

TODO 12.1 establishes a version policy and a user-facing
[changelog](../../CHANGELOG.md). Kibitz follows
[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
The package and both root entries in `site/package-lock.json` agree on the
proposed `0.1.0-rc.1` candidate. The earlier `0.1.0` value was an unpublished
development baseline; no release tag exists at this draft's preparation.
The [candidate review](0.1.0-rc.1.md) records the merged original
prerequisites, retained current-source evidence and approved local exceptions.
Final source verification and release approval remain open. Preparation and
integration do not authorize publication.
The [dated local release review packet](#local-release-review-packet) collects prerequisite
evidence, approved scoped exceptions and outstanding follow-up; it is not release approval.

The compatibility scope is the documented CLI/configuration behavior, gateway
and optional library HTTP contracts, versioned data exports and persisted data
lifecycle, and documented offline update behavior. Internal module organization,
DOM selectors and retrieval heuristics can evolve; record user-visible effects
and ranking/quality changes without promising stable internal implementation.
Stored schema and source-revision identifiers remain independently versioned.
A package version bump alone does not migrate data or make old cached models compatible.

Before 1.0, interfaces are under development. This project still uses patch bumps
for compatible fixes and minor bumps for features or incompatible changes. Describe
every breaking change explicitly, including affected storage/export/API versions,
backup/migration steps and recovery limits. For example, a compatible fix after
`0.1.0` is `0.1.1`; an incompatible next development interface is `0.2.0`.
Use a new major version for incompatible public-contract changes once 1.0 is adopted;
compatible features increment minor and compatible fixes increment patch.
Prerelease identifiers such as `0.2.0-rc.1` mark candidates. Build metadata can
identify a build but does not establish release precedence or compatibility.
Never replace the source or assets behind an existing release tag.

Ordinary feature/fix PRs add concise, user-relevant entries under **Unreleased**
when behavior changes. Group entries as Added, Changed, Fixed, Removed or Security
when useful. Describe the effect and material limitation; keep test logs and
implementation detail in DONE. A source reorganization or documentation correction
does not require inventing a release number. Keep all package/lock versions aligned.

Prepare a release in its own branch and PR:

1. Choose the candidate version and exact source scope. Ensure prerequisites are
   merged through their PRs. Keep the root user guide/changelog consistent with
   the actual candidate rather than planned work.
2. In `site/`, update package and lockfile metadata with
   `npm version VERSION --no-git-tag-version --ignore-scripts`. Substitute the
   reviewed version; inspect the resulting manifest/lock diff. Keep `private: true`
   unless a separately reviewed distribution change requires otherwise.
3. Move the relevant Unreleased entries into a dated version section, leave a new
   Unreleased section, and link the version/tag comparison. Document data/export,
   cookie, model and offline-cache compatibility or migration requirements.
   Back up affected local data before an incompatible migration; preserve unknown
   data rather than silently deleting it.
4. Run lint/JSDoc, build, full unit and browser suites for the candidate. Run and
   record [automated security evidence](../security/supply-chain.md#automated-security-evidence),
   [OWASP Top 10](../security/owasp-top10.md), [LLM](../security/owasp-llm.md) and [ASVS](../security/asvs.md) reviews.
   Include exact run/commit identities, unresolved controls/findings and explicit
   owner disposition of deviations. An open high finding blocks release. Retain
   artifacts before their thirty-day expiry; a prior feature's green check is
   not release-commit evidence.
   For the first final (non-prerelease) release, require every ASVS remediation
   item **TODO 11.4.2.1–11.4.2.12** to be implemented and verified, with the
   corresponding assessment updated from its current deviation/open status.
   The temporary exceptions accepted for PR #133's local RC do not authorize
   carrying these conditions into the final release. Check both the TODOs and
   the cited verification; approval or another exception does not count as a fix.
   Existing review/remediation dates still apply, and a planned release cannot
   extend them. This ASVS gate does not silently change other findings' deadlines.
5. Review third-party maintenance deadlines, licences/notices, required source
   availability, packaged components, platform support and documentation. Confirm
   the release's actual deployment/security scope. Confirm the merged container
   and user/provider/Ollama guides match that candidate.
6. Merge only through the approved release PR with passing CI. After explicit
   release authorization, tag its exact merged commit as `vVERSION` and publish
   reviewed release notes/assets. Do not retag a different commit or publish from
   an unmerged feature branch. Correct a released defect with a new version.

Creating this policy completes TODO 12.1. Packaging TODO 12.2 and guides in 12.4
have their separate evidence; the actual release gate in 11.6 still requires
candidate verification and a release decision. Feature and milestone PRs do not
authorize automatic merges or publishing.

## Local release review packet

Prepared on 2026-10-25 for TODO 11.6. **The release gate remains open.**
This packet collects evidence and decisions for a local single-user release;
it does not approve a release, accept risks or assign a published version.
At this packet's initial preparation, `0.1.0` was the unpublished development
baseline. The [draft `0.1.0-rc.1` candidate](0.1.0-rc.1.md) now prepares
version/changelog metadata on main. Its original prerequisites are integrated;
final-head checks, final merged source and release approval remain pending.

### Source and prerequisites

The initial preparation started at `209e458ec8283ae86ea86a3600632a1de663298c`.
The owner has now integrated current main `678866198a19bf89416ddfaf3b1fc31f94d5f819`
into PR #133, producing candidate `002fd92dd33e009f86cf8b79008180888a392e0f`.
The following original prerequisites are merged. The
[candidate review](0.1.0-rc.1.md) separates current evidence, earlier
feature results, this later review update and remaining final-head checks.

| PR | Result supplied | State at follow-up |
| --- | --- | --- |
| [118](https://github.com/gregoryyy/kibitz/pull/118) | Automated dependency/secret/code/passive scans and retained evidence | Merged |
| [119](https://github.com/gregoryyy/kibitz/pull/119) | Version policy and Unreleased changelog | Merged |
| [120](https://github.com/gregoryyy/kibitz/pull/120) | Local image, private volume and persistence checks | Merged |
| [121](https://github.com/gregoryyy/kibitz/pull/121) | Supported Luna Chat Completions tool mode | Merged |
| [122](https://github.com/gregoryyy/kibitz/pull/122) | User/provider/native-Ollama guides | Merged |
| [123](https://github.com/gregoryyy/kibitz/pull/123) | Local fonts and trusted stylesheet hashes | Merged |
| [124](https://github.com/gregoryyy/kibitz/pull/124) | Minimal runtime and exact-image advisory verification | Merged |
| [125](https://github.com/gregoryyy/kibitz/pull/125) | Compiled/package evidence and experimental coaching scope | Merged |
| [132](https://github.com/gregoryyy/kibitz/pull/132) | Pinned browser-model source revisions | Merged |
| [130](https://github.com/gregoryyy/kibitz/pull/130) | Matched CodeQL actions and integrated Chessground CSP compatibility | Merged |

The tested scope is [local, single-user operation](../guide/setup.md#deployment-decision-local-single-user-app), either native
Node or the loopback-published container. It includes cookie-separated private
storage, optional external providers and optional browser inference. It supplies
no hosted accounts, network deployment, model-quality certification or registry
publication. The [Primer motivation](../../README.md) and
[retrieval/literature comparison](../research/position-retrieval-comparison.md) describe experiments,
not evidence that arbitrary generated chess explanations are correct.

### Evidence available before the release candidate

| Review/check | Recorded result | Boundary |
| --- | --- | --- |
| [OWASP application review](../security/owasp-top10.md) | Ten categories mapped to code, tests and finding dispositions | Source/test review, not certification; re-review changes at the candidate |
| [OWASP LLM 2025 review and 2026 crosswalk](../security/owasp-llm.md) | Deterministic prompt/tool/privacy/output/resource boundaries have regression evidence | Model identity and unrestricted claim verification remain partial |
| [ASVS 5.0.0 L1](../security/asvs-l1.md) | All 70 requirements recorded: 28 scoped verifications, 30 justified absences, ten deviations, two open | Record validation does not execute tests or establish compliance |
| Unit/server suite at `92ccc07` | 690 pass, one opt-in live skip | Mock/fake providers; later entrypoint regression also passes independently |
| Checker regression after main reconciliation | Eight groups pass in each prerequisite branch; unguarded stdin import reproduces failure | CLI/import behavior only; no application/scanner policy change |
| [Passive web baseline](../security/supply-chain.md#browser-styles-and-bundled-fonts) | [Run 40158959465](https://github.com/gregoryyy/kibitz/actions/runs/40158959465), source `00e7d16`, merge `9c8d6843`: zero high/medium, two informational types | Seven required routes, sixty enabled passive rules; comments and grouping-cookie information retained |
| [Exact packaged-image scan](../security/supply-chain.md#packaged-image-advisory-evidence) | [Run 40166278799](https://github.com/gregoryyy/kibitz/actions/runs/40166278799), source `92ccc07`, merge `da379a15`: zero high/critical, 23 medium/eight low | Fresh hashed DB, fourteen OS/sixteen library versions, independently verified image/config/rootfs/source identities |
| Actual container tests in that run | Four pass: boundaries, Stockfish/mock UI, restart isolation and previous-packaging volume compatibility | Both packaging recipes use the current app/schema; not historical schema-migration evidence |
| CodeQL | At reviewed main `42761c3`, no open high alerts; medium alerts 20/21/23 remain. PR #124 races 25/26 are fixed without dismissal | Passing PR check does not remove retained medium findings or replace a release-commit scan |

Implementation and exact sanitized identities are in
[DONE](../DONE.md), [web evidence](../security/2026-10-25-web-assets.json) and
[image evidence](../security/2026-10-25-image-advisories.json).
These historical feature results must not be relabeled as candidate checks.
Current source-002fd92 evidence is retained in the
[structured record](0.1.0-rc.1-evidence.json) and
[raw report archive](evidence/0.1.0-rc.1/002fd92/README.md): 699 unit
passes/one skip, passing CodeQL/secret/audit, actual image and passive scans.
The full browser run passes with 423 passes/one skip, completing at 11:46 UTC.
Later documentation and
integration commits require final-head checks; earlier green results do not
replace them.

### Required dispositions

Owner disposition was **approved on 2026-10-25** for local `0.1.0-rc.1`, with
the owner responsible for follow-up. The owner answered “Approve proposed
exceptions” for [PR #133](https://github.com/gregoryyy/kibitz/pull/133).
The [candidate decision table](0.1.0-rc.1.md#owner-dispositions-approved--2026-10-25)
records scope, mitigations and deadlines. These are deployment-specific
exceptions; all ten ASVS deviations and both open requirements remain
unsatisfied in the [versioned assessment](../security/asvs-l1.json).

Local-behavior exceptions and actual endpoint TLS inventory are reviewed by
**2026-11-01**. Component/build/tool/model review is due **2026-11-01**, with a
remediation plan by **2026-11-24**. Re-review before another release or any
deployment/provider/runtime-scope change. No high finding or overdue waiver is
approved; no merging, tagging or publication is authorized by these exceptions.
The table below retains the technical conditions and required follow-up.

**Owner direction on 2026-10-25 adds a final-release condition:** the twelve
ASVS items may retain their temporary approval in PR #133, but must be fixed
and verified before the first final (non-prerelease) release. They are tracked
individually under **TODO 11.4.2.1–11.4.2.12** in [TODO.md](../TODO.md).
The [assessment](../security/asvs-l1.json) links each unsatisfied control to its specific
remediation item. The maintainer owns follow-up; current statuses remain ten
deviations and two open. No checkbox or RC approval establishes remediation.
The original review dates and component-plan/finding deadlines remain in force;
the final-release gate cannot postpone an earlier deadline.

| ASVS requirement(s) | Unresolved condition | Remediation/evidence needed before final release |
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
[review/remediation targets](../security/2026-10-25-image-advisories.json): medium
review by 2026-11-01/remediation by 2026-11-24; low review by
2026-11-24/remediation by 2027-01-23. The owner approved their scoped retention
for this RC, including exposure uncertainties and these original deadlines.
There is no blanket reachability exclusion or suppression. Apply the
[maintenance policy](../security/supply-chain.md#component-maintenance-policy), including its overdue/release rule.
CodeQL 20/21 are intentional operator capture writes; 23 reflects supported
local HTTP cookies. Those documented local contexts have the same approved RC
disposition; the raw alerts remain open.
The [initial runtime exposure review](../security/2026-10-25-runtime-triage.md)
checks all 25 distinct CVEs against vendor records and the supplied configuration.
It records CPU/function/service prerequisites, the resolver configuration concern
and native-linkage/range gaps. All raw findings remain open; owner exceptions do
not establish that their code paths are unreachable or fixed.
The [compiled-component/package evidence](../security/supply-chain.md#compiled-component-and-package-provenance-evidence) additionally
records verified registry signatures and exact upstream source candidates, while
keeping the binary compilation link unverified. Initial Linux Node/asset capture
passed, while its browser check failed twice on network-change-aborted modules.
The [corrected run](https://github.com/gregoryyy/kibitz/actions/runs/40169822979)
passes all four actual cases and the advisory gate at source `5764f74`, merge
`07079b6`; independent review verifies the captured component/image/package/asset
identities. Native smoke output is not substituted for that evidence. Full source
CI passes unit/audit, CodeQL, secret and passive checks; Playwright is still running
at this recording.
All six direct Action pins also match independently resolved official version
tags, with a dated, bounded advisory query. Bundled/downloaded tool dependencies
and hosted runner/platform changes remain separate gaps.

### Candidate work and external inputs

**Owner direction, 2026-10-25:** retain experimental free-form coaching for the
first release candidate and document the open verification limitation. Restricted
fully checked output is not required for that candidate. TODO 11.3.9 remains
unmet, with no claim that general prose is verified; README and the user guide
state the boundary. This decision does not dispose of other security requirements.

Before approval, select a version and exact merged source, update the changelog
and package/lock metadata using [the release procedure](#versioning-and-releases), then run
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
  the promised general guarantee. The owner's candidate scope retains experimental
  prose with this gap documented; broader deterministic verification needs its
  own plan and is not claimed complete.
- **11.6:** original prerequisites and owner dispositions are recorded; current
  source-002fd92 checks pass, while final-head/source evidence remains outstanding.
  Only a passing, approved release PR and explicit publication
  authorization can lead to a tag/assets; this preparation does neither.
