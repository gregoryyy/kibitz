# ASVS review

TODO 11.4 uses **OWASP ASVS 5.0.0, Level 1**, for the confirmed
[local single-user deployment](DEPLOYMENT.md). This is a source-and-test review,
not an independent assessment, certificate, hosted-account review or release approval.
It covers application code at the revision recorded in [asvs-l1.json](asvs-l1.json).
It does not inspect an operator's environment, attest provider infrastructure or
make live provider calls. Reassess this scope before exposing the server to a network.

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
  Native TLS sets Secure, but current cookie names lack a secure prefix even there.
  Do not silently add HSTS for localhost or rename private-library cookies without
  considering other local apps and existing data. Revisit with TODO 12.2 packaging.
- Cookie values group usage and private-library data; they do not authenticate a
  person. Backend format/scope checks do not provide issued-session registration,
  revocation, logout or account lifecycle. Browser expiration is not server revocation.
- Static serving denies Git paths; the [tested package](CONTAINER.md) also excludes
  checkout metadata from the app process. The native Node process in a checkout
  can still read `.git`, so the overall supported local scope retains a deviation.
  ASVS requires both external and application-process exclusion. Release scope
  and owner disposition remain explicit rather than assuming packaging fixes a checkout.
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

For a release, re-review every changed control against the release commit, rerun
its cited tests and automated scans, record results and unresolved requirements
in the release PR, and obtain explicit owner disposition of deviations. For a
standard upgrade, review the official version and complete ID diff before updating
the checker baseline and source hash together; never silently refresh a live URL.
