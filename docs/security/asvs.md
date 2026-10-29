# ASVS review

TODO 11.4 uses **OWASP ASVS 5.0.0, Level 1**, for the confirmed
[local single-user deployment](../guide/setup.md#deployment-decision-local-single-user-app). This is a source-and-test review,
not an independent assessment, certificate, hosted-account review or release approval.
It covers application code at the revision recorded in [asvs-l1.json](asvs-l1.json).
It does not inspect an operator's environment, attest provider infrastructure or
make live provider calls. Reassess this scope before exposing the server to a network.

The [readable checklist](asvs-l1.md) contains all **70 L1 requirements** from the
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
- Static serving denies Git paths; the [tested package](../guide/setup.md#local-docker-package) also excludes
  checkout metadata from the app process. The native Node process in a checkout
  can still read `.git`, so the overall supported local scope retains a deviation.
  ASVS requires both external and application-process exclusion. Release scope
  and owner disposition remain explicit rather than assuming packaging fixes a checkout.
- Explicit Lichess navigation puts the selected FEN in the external URL/history.
  API credentials, cookies and prompt bodies are not put there, but a private chess
  position can still be sensitive. See [privacy guidance](../guide/setup.md#provider-privacy-and-opt-in).
- Component update timeframes are documented in [maintenance policy](supply-chain.md#component-maintenance-policy).
  Automated evidence includes lockfile/image inventories and
  [actual Node components, browser asset hashes and bounded package/Action provenance](supply-chain.md#compiled-component-and-package-provenance-evidence); complete
  advisory/age verification against those timeframes remains in release review
  TODO 11.6. A zero npm audit result alone cannot establish it.

The input rules are documented in [input validation rules](#input-validation-rules). Authorization
scope remains the trusted local operator, same-origin browser and cookie-separated
library; provider consent is a privacy control, not account authentication.
Keep the [OWASP application](owasp-top10.md), [LLM](owasp-llm.md), automated-scan
and release gates separate. In particular, unrestricted chess prose and mutable
model identities remain open under TODO 11.3.

The owner allows the ten deviations and two open controls temporarily in
PR #133's local release candidate, with the existing dated follow-up. Every one
must be fixed and verified before the first final (non-prerelease) release.
[TODO 11.4.2.1–11.4.2.12](../TODO.md) assigns an individual remediation and acceptance
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

## Input validation rules

These rules describe the local application's trust boundaries for ASVS v5.0.0-2.1.1.
The linked source constants remain authoritative. Text length alone does not make
content trustworthy. Model prose and imported text remain data.

| Input | Expected structure and limits | Authority and evidence |
| --- | --- | --- |
| AI requests | JSON body up to 1,000,000 bytes; supported routes/methods, roles and message structure; no client-supplied system policy; configured provider/model and privacy consent | [API](../../site/server/api.mjs), [AI/schema](../../site/server/ai.mjs), [gateway tests](../../site/server/api.test.mjs), [boundary tests](../../site/server/llm-boundaries.test.mjs) |
| Provider response | Per-operation deadline (default 60 s, maximum 15 min); raw HTTP body up to 8 MiB; decoded coaching text/tool metadata up to 128 KiB; annotation schema and bounded tools | [Limits](../../site/server/provider-limits.mjs), [schema](../../site/server/schema.mjs), [tests](../../site/server/provider-limits.test.mjs); schema validity does not establish truthful prose |
| Embeddings | At most 16 texts of 8,000 characters, known embedding identity/dimensions, finite numeric vectors; bounded response and concurrency | [Gateway](../../site/server/embeddings.mjs), [dense rules](../../site/src/library/dense-search.js), [tests](../../site/server/embeddings.test.mjs) |
| Moves, squares and positions | chess.js legality and position checks; engine-produced evidence for recognized lines; bounded tool depth, time, call/round counts | [Tools](../../site/src/coach/tools.js), [evidence](../../site/src/chess/evidence.js), [tests](../../site/tests/unit/tools.test.mjs); browser checks protect local rendering/game state and are not server authorization |
| Pasted PGN | Batch up to 5,000,000 characters and 500 games; each game up to 200,000 characters and 4,000 plies; chess.js parse/position validation; source/provenance binding | [Import](../../site/src/library/import.js), [tests](../../site/tests/unit/pgn-import.test.mjs); there is no general server file-upload endpoint |
| Library records | Known operations/IDs, at most 500 changes, 1,000 records, 1 MiB/record, 10 MiB/batch and 20 MiB/library; UTF-8 byte counts; source title 240, author 160, URL 2,048, licence 160 characters; HTTP(S) source URLs without credentials | [Shared record rules](../../site/src/library/storage.js), [source rules](../../site/src/library/library.js), [server validation](../../site/server/library-api.mjs), [tests](../../site/server/library-api.test.mjs) |
| Library mutations | Current cookie owner, matching revision, transactional limits; server independently recompiles PGN and validates record/book fields; no automatic client-library upload | [API](../../site/server/library-api.mjs), [store](../../site/server/library-store.mjs), [tests](../../site/server/library-store.test.mjs); client validation is for usability |
| Model files and paths | Fixed catalogue filenames, expected byte size and SHA-256; bounded total download deadline; verification before atomic publication; private/no-symlink file boundaries | [Downloader](../../site/scripts/download-model.mjs), [tests](../../site/tests/unit/download-model.test.mjs), [public descriptors](../../site/server/public-files.mjs) |

Reject malformed/security-relevant input before provider calls or persistent writes.
The server owns consent checks, spending/rate admission, record ownership and storage
limits. Client cookies identify opaque local groups rather than signed-in users.
Direct non-browser clients on the trusted machine remain within the operator boundary.
AI writes compare the full Origin against the native socket scheme/host and ignore
forwarding headers. Direct local clients without Origin remain within the operator boundary.

Imported notes, PGN comments and library text reach prompts through
[`quote()`](../../site/src/coach/prompt.js). Safe text rendering, JSON serialization,
URL scheme checks and parameterized SQL apply at their separate output boundaries.
Neither quoting nor schema validation guarantees model obedience or factual accuracy.
