# ASVS review

TODO 11.4 uses **OWASP ASVS 5.0.0, Level 1**, for the confirmed
[local single-user deployment](DEPLOYMENT.md). This is a source-and-test review,
not an independent assessment, certificate, hosted-account review or release approval.
It covers application code at the revision recorded in [asvs-l1.json](asvs-l1.json).
The technical assessment does not attest provider infrastructure or make live
inference calls. A separate [TLS inventory](TLS-INVENTORY.md) now
retains dated credential-free public-host handshakes; it does not close the
actual deployment/SDK/browser transport controls. Reassess this scope before exposing the server to a network.

The [readable checklist](ASVS-L1.md) contains all **70 L1 requirements** from the
[official versioned CSV](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv).
The source contains 345 requirements across all levels. V16 and V17 have no L1
requirements; their absence does not mean logging or WebRTC was independently certified.
Each ID links to its official chapter. The source SHA-256 is
`98c8fe911b9edb403af8ee05d3ce8201ecac2659e313b053890a62847cdcf680`.
OWASP's standard is [CC BY-SA 4.0](https://github.com/OWASP/ASVS/blob/v5.0.0/LICENSE.md).
The application notes and short topic labels are this project's assessment;
consult OWASP for normative requirement wording.

`verified` means the cited application behavior was reviewed with code/tests or
documentation appropriate to that requirement. It is bounded by the stated scope.
`not-applicable` requires an individual reason that the functionality is absent.
`deviation` means implemented behavior differs from the requirement, including a
deliberate local-deployment choice. `open` means verification or implementation
is incomplete. Deviations remain unsatisfied requirements; no risk acceptance by
the owner is implied by writing them down.

Run `npm run check:asvs` in `site/` to check the pinned ID set, source metadata,
dispositions, existing repository evidence and generated-document freshness.
After editing the JSON, use `npm run check:asvs -- --write` and review the diff.
The offline checker does not execute cited tests, detect vulnerabilities or establish
that an assessment is true. Its negative tests protect coverage and rendering;
the normal unit and browser suites provide behavioral evidence separately.

The review leaves these findings visible:

The [encrypted transport policy](TLS-POLICY.md) now verifies 11.4.2.7 at the
recorded source with local SDK/native/browser and actual Linux image evidence.
Operator/provider/CDN protocol inventory and public trust remain open.

- TODO 11.4.1 is addressed at the recorded revision: AI gateway writes compare
  scheme and host against the native socket, ignore forwarding headers and reject
  non-HTTP(S) Origins. Direct local clients without Origin still work. SVG now
  declares UTF-8. Real HTTP/TLS and CLI/browser regressions cover both changes.
  The prior revision accepted synthetic same-host HTTPS/FTP Origins over HTTP;
  the new regressions fail against that actual source and its SVG header.
  These probes establish policy consistency, not a demonstrated browser CSRF
  exploit: JSON/non-safelisted headers and absent CORS approval were already
  separate defenses. Remaining deployment and verification gaps follow below.
- Local HTTP does not meet the transport, cookie-prefix and HSTS requirements.
  That was the RC baseline: protected-cookie migration (11.4.2.1) and an isolated
  HTTPS/HSTS hostname (11.4.2.2) now address those two controls in the current
  source. Explicit development/recovery modes stay outside final deployment.
  Actual provider/endpoint transport and trust inventories retain their TODOs.
- Experimental [operator sessions](SESSIONS.md) now verify every supported TLS
  gateway/library session at the backend, with fresh proof for migration and an
  atomic previous-token replacement on reauthentication. Adding sign-in changes
  applicability: 6.1.1, 6.3.1, 6.3.2 and 7.2.4 are now verified instead of absent.
  The matrix also updates the password-scope reasons: this app accepts a generated
  256-bit installation machine key, without human account-password workflows.
  The reviewed source has **39 verified, 26 not applicable, three deviations and
  two open controls**. [Backend logout/termination](SESSION-TERMINATION.md) now
  addresses 7.4.1 with copied-token/restart and in-flight/cross-process evidence.
  [Explicit function permissions](PERMISSIONS.md) now address 8.2.1 with native,
  browser and actual-image grant/denial evidence. Complete authenticated client/offline
  cleanup remains unsatisfied. Backend termination does not claim client-data erasure.

- [Native filesystem isolation](NATIVE-ISOLATION.md) now addresses 13.4.1 for
  the owner-selected macOS/Linux final modes and the source-free image. OS
  restrictions deny original worktree/common/alternate metadata before application
  storage/listening, separately from HTTP dot-path denial. Actual Linux/macOS
  process/SQLite/policy tests and source-pinned image/TLS/browser evidence pass.
  The trusted bootstrap/operator retains Git access outside the application.
  Development/recovery and future platform/mount/runtime changes require their
  own scope and verification; this is not release clearance.
- Explicit Lichess navigation puts the selected FEN in the external URL/history.
  API credentials, cookies and prompt bodies are not put there, but a private chess
  position can still be sensitive. See [privacy guidance](PRIVACY.md).
- Component update timeframes are documented in [MAINTENANCE.md](MAINTENANCE.md).
  Automated evidence includes lockfile/image inventories and
  [actual Node components, browser asset hashes and bounded package/Action provenance](COMPONENT-PROVENANCE.md); complete
  advisory/age verification against those timeframes remains in release review
  TODO 11.6. A zero npm audit result alone cannot establish it.

The input rules are documented in [VALIDATION.md](VALIDATION.md). Authorization
scope remains the trusted local operator, same-origin browser and cookie-separated
library; provider consent is a privacy control, not account authentication.
Keep the [OWASP application](OWASP-TOP10.md), [LLM](OWASP-LLM.md), automated-scan
and release gates separate. In particular, unrestricted chess prose and mutable
model identities remain open under TODO 11.3.

The owner allows the ten deviations and two open controls temporarily in
PR #133's local release candidate, with the existing dated follow-up. Every one
must be fixed and verified before the first final (non-prerelease) release.
[TODO 11.4.2.1–11.4.2.12](TODO.md) assigns an individual remediation and acceptance
criteria to each control; `followUp` in [asvs-l1.json](asvs-l1.json) identifies
the exact item. RC approval does not change technical status or close a TODO.
The release procedure must check implementations and evidence, as well as the
updated statuses, before final-release approval. Existing earlier deadlines
continue to apply.

For a release, re-review every changed control against the release commit, rerun
its cited tests and automated scans, record results and unresolved requirements
in the release PR, and obtain explicit owner disposition of deviations. For a
standard upgrade, review the official version and complete ID diff before updating
the checker baseline and source hash together; never silently refresh a live URL.

## Cookie remediation after the RC baseline

[TODO 11.4.2.1](TODO.md) implements protected HTTPS names, exact-token migration,
profile rollback and explicit development-only HTTP namespaces. The current
3.3.1 source/test assessment is updated in the checklist; historical RC reports
and their raw findings retain their original revision/status. This is not a
dismissal of default-branch CodeQL alerts. Cookie identity continuity is scoped
to the original hostname; the isolated HSTS origin has its own browser
storage/groups and requires explicit export/import plus saved-profile recovery.
The other ten tracked ASVS fixes and the final-release gate remain open.


## Isolated-host HSTS remediation

[TODO 11.4.2.2](TODO.md) implements an isolated `.test` application authority,
exact-SAN validation and one-year HSTS before application routing. The assessment
reviews implementation/test source **`42e6ecd5761f012d9f89c15c8386113e9a01124d`**.
Its [actual Linux image job](https://github.com/gregoryyy/kibitz/actions/runs/40205550605/job/121205581181)
passes the five image/browser/persistence cases, including the default TLS
command, mapped application authority, protected cookies, HSTS on API/error
responses, read-only identity files, UID 1000 and verified static HTTPS health.
All eleven focused HSTS/transport groups, fourteen focused browser cases,
727 unit/server cases (one opt-in live skip), build and record/lint/type checks
also pass. CodeQL/alert gate, ZAP/CSP/inventory, audit and secrets pass at that
source; the separate full application browser job remains source-specific in
the PR and is not replaced by the focused result.

The HSTS status changes from deviation to verified; all other technical statuses
are preserved: **30 verified, 30 not applicable, eight deviations, two open**.
Original RC evidence/dates remain historical. The [TLS guide](TLS.md) explains
why Chromium's localhost exemption requires another namespace, normal certificate
trust, host-wide lifetime across ports and explicit original-origin recovery.
An independent curl test validates actual caching/upgrades with the exact fixture
CA and rejects a wrong CA; browser fixtures verify headers/functionality using
test-only trust/resolution exceptions, not operator browser policy acceptance.
Actual endpoint/public-trust evidence remains 11.4.2.6/11.4.2.8. This is not
final-release approval or a dismissal of any remaining findings.
