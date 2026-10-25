# DONE

Progress log for [TODO.md](TODO.md), newest first. Each entry gives the date, the TODO items covered, and then:
- **Implementation notes:** what was built, and where.
- **Deviations:** what differs from the plan, and why.
- **Insights:** what we learned that matters for later work.

---

## 2026-10-25 — Partial TLS transport inventory and reproducible probe (experimental)

TODO item: 11.4.2.6.1, a prerequisite under 11.4.2.6 / ASVS 12.1.1. The parent, encrypted-connectivity and public-trust controls remain open.

### Implementation notes

- Inventory native/browser/container/health, cloud coaching and embeddings, Ollama, same-origin WASM/weights, explicit model provisioning and redirects, browser-managed provisioning and external-navigation/maintainer boundaries. Record source, runtime settings and each missing verification rather than counting fixtures as deployment evidence.
- Add a dependency-free import-safe CLI with all-input validation, explicit credential-free named origins, bounded public trust-bundle reads, at most six parallel sockets, total DNS/handshake deadlines and required peer verification. Record runtime defaults separately from an explicit 1.2–1.3 probe, forced modern/legacy attempts, peer fingerprints/validity and a default trust-set fingerprint. Never send HTTP/application bytes, inference, cookies or downloads; record HTTP without contacting it. Use fixed errors and distinguish client refusal, peer alerts and generic failure. Exit success denotes report generation, not a security pass.
- Retain actual 2026-10-25 Node 24.22.1/OpenSSL 3.5.9 direct handshakes at Anthropic/OpenAI/Mistral defaults and Hugging Face: default and reviewed policy negotiate 1.3, forced 1.2/1.3 work, and local policy refuses legacy attempts. The configured cloud endpoints have no custom base overrides; configured Ollama remains HTTP. Standard operator TLS/identity files are absent. No configuration secrets were retained, trust stores changed or inference performed.
- Tests cover strict/normalized URL rejection without secret echoes, zero plaintext connections, trusted 1.3 preference/forced 1.2, untrusted identities, TLS 1.2-only peers with an explicit peer-version alert, stalled deadlines/socket cleanup and fixed CLI failure diagnostics. Fresh build and lint/type/ASVS checks pass. Full mock-only unit suite: 768 passes, one opt-in live skip. All five new groups pass with temporary loopback TLS servers. The UI is unchanged; full browser/image/security CI will run on the experimental PR. Document operator-run mkcert development setup, matching DNS/IP SANs, public CA probe input and the unresolved public-trust boundary; no certificate/key generation or trust installation was performed.

### Deviations

- This completes only the bounded evidence-collection prerequisite. Actual operator/browser/image/SDK/fetch/redirect transport evidence, configuration enforcement, public trust and renewal remain required. Legacy client refusal cannot establish remote downgrade refusal. All ASVS statuses/counts, RC decisions and original deadlines remain unchanged. No page/UI change or live model call.

### Insights

- Negotiation, trust acceptance, client policy and server downgrade refusal are separate observations. A successful public-origin handshake is useful retained evidence but cannot certify an SDK path, a redirected model transfer or a private local installation.

## 2026-10-25 — Explicit local operator function permissions (experimental)

TODO item: 11.4.2.5 / ASVS 8.2.1. Hosted accounts stay deferred and complete authenticated client-data cleanup remains 11.4.2.11.

### Implementation notes

- Add an explicit private version-one policy bound to the operator ID and offline no-overwrite setup selecting named grants, all or none. Require the file before native TLS API storage/listening; share the bounded descriptor reader with operator setup while preserving its private-root/type/link/permission/size boundary. Standard native/container recipes name the policy in the existing read-only identity mount; keys, sessions and data schemas remain unchanged.
- Map every gateway/library method and route to an explicit function grant, deny unmapped functions, and require read alongside library mutation/erasure grants. Check backend grants independently of authentication, ownership, Origin, provider consent and budgets; browser bodies/queries/cookies cannot add them. Reread validated current policy at dispatch and guarded output/mutation boundaries; polling aborts held responses after revocation without logging out the session. Invalid policy fails closed with fixed bounded errors.
- List confirmed function access in English/German sign-in settings, disable denied provider/test/data-erase controls and explain denied operations. A denied or unverifiable library permission cannot fall back to a cached collection and withdraws the current snapshot; general DOM/memory/storage/offline lifecycle remains separate. Preserve existing profiles/keys/databases for adding a policy and proof-authorized recovery.
- Policy/actual-CLI tests exercise empty and independent grants across every protected function, immutable validation, private setup and startup ordering, unchanged denied counters/records, client-claim rejection, collection/operator boundaries and held-provider revocation. Browser checks cover deny-all, German mobile read-only access and live policy changes; the actual previous CLI supplies the negative regression. Fresh build/check pass. Full mock-only unit suite: 763 passes, one opt-in live skip. All 45 focused browser cases pass, and 14 affected permission/library cases pass again after explicit policy-failure handling. The actual pre-permissions CLI (`aaec4e0`) fails the new browser regression with 200 instead of 403. A concurrent local unit/browser run hit two timing-sensitive failures; both existing groups pass unchanged in isolation (21 groups), and the final full suite passes alone without timeout/assertion changes. The Linux image case now tests a separate offline policy change, continued read access, denied test/embedding/erase and independent logout/recovery; final implementation/test source `7ef846986f98f94c855f9f5b61ac476d0147a77a` passes the actual Linux image run `40217377529` / job `121241356388` (all five cases), both CodeQL gates with no open PR alerts, unit/lint/types/build/audit, ZAP/CSP/inventory and secrets. The actual sharing-attestation constant is used in the strengthened six-group CLI regression set. Full application Playwright remains live. Pin this source, mark only ASVS 8.2.1 technically verified, update related scope notes and tick TODO 11.4.2.5: 37 verified, 26 not applicable, five deviations, two open. Original RC evidence/owner dispositions and all remaining deadlines/gates stay unchanged.

### Deviations

- Local operator-owned policy files only; no hosted roles, browser grant editing, new dependency, paid inference or production-key generation. Explicit synthetic HTTP development stays outside final scope. Public assets/client-only operations are outside backend authorization. Already accepted/emitted work cannot be recalled; current permission checks do not claim retroactive erasure of exports or complete offline client cleanup.

### Insights

- Authentication and provider sharing consent do not establish function authority. A separate private allowlist also permits read-only use without granting inference or erasure. Denial must remain distinct from ordinary service downtime, because generic offline fallback could otherwise reopen a cached private collection after an explicit authorization failure.

## 2026-10-25 — Backend logout and session termination (experimental)

TODO item: 11.4.2.4 / ASVS 7.4.1. Explicit function permissions and complete authenticated client-data lifecycle remain separate final-release gates.

### Implementation notes

- Add native-TLS/same-origin/bounded-JSON logout that deletes the presented operator/credential-bound session before acknowledging success and expires its host cookie. Unknown/duplicate/other-owner sessions cannot delete another session. Replay stays denied across restart; absolute persisted expiry remains independent of browser cookies. Reclaim expired session rows during issuance without changing ownership bindings or existing private data schemas.
- Track authenticated responses, close them on local revocation/reauthentication and observe cross-process revocation through the shared registry. Expiry timers and bounded polling abort existing provider controllers. Recheck asynchronous work before provider output/private mutation; serialize synchronous protected emission/mutation boundaries with durable revocation through short registry transactions, without holding locks across awaited work. Count already completed provider work according to existing usage semantics; do not claim to recall emitted bytes or committed actions.
- Add English/German Sign out controls in Settings/Your data, acknowledgement/retry handling and fresh-proof collection recovery. Keep protected locators as non-authorizing recovery inputs; do not delete the previous collection or treat clearing cookies/closing a page as backend logout. Document registry pruning, concurrency boundaries, backups and remaining client/offline cleanup.
- Native TLS tests cover actual CLI replay/restart and retained records, another operator/epoch, held chat/structured/test/embedding responses, asynchronous library writes, expiry between headers/body and during active work, and actual second-process registry revocation. Browser tests cover Settings, German mobile data controls, another tab, copied tokens, failed logout and recovery. Fresh build/check pass. The full mock-only unit suite passes 751 cases with one opt-in live skip; ten focused native termination groups and thirteen real browser cases pass. The actual pre-termination CLI at `01293e2` fails both the native route regression and the browser logout case: the new logout POST returns 404 instead of 200. All three new browser cases pass again with the explicit response assertion. Implementation/test source `dc3dc1413e27dfc821b1e8169928972f7dd1fec7` passes the actual Linux image run `40212990072` / job `121228036356` (all five cases, including default-command logout/replay/browser denial/recovery), both CodeQL gates with no open PR alerts, unit/lint/types/build/audit, ZAP/CSP/inventory and secrets. Full application Playwright remains live. Pin that source in the assessment, mark only 7.4.1 technically verified and tick TODO 11.4.2.4; update related scope notes. Current matrix: 36 verified, 26 not applicable, six deviations, two open. Historical RC reports/owner dispositions/deadlines remain unchanged.

### Deviations

- Local single-user only, generated identities/fake providers only, no new dependency or paid inference. Complete DOM/memory/storage/cache/offline cleanup and multi-tab lifecycle remain TODO 11.4.2.11; explicit function permissions remain .5. Already accepted provider work may incur usage after cancellation. Current client refresh/disconnect is not advertised as complete erasure.

### Insights

- Closing a browser cookie is insufficient, and cancelling transport alone cannot prevent a provider that ignores cancellation from returning late data. Durable token removal plus guarded output/mutation boundaries address those separately. Keeping collection locators and ownership bindings avoids turning logout/expiry into accidental data loss.

## 2026-10-25 — Backend-issued local operator sessions (experimental)

TODO item: 11.4.2.3 / ASVS 7.2.1. Session termination, explicit function permissions and authenticated client cleanup retain their own final-release gates.

### Implementation notes

- Add explicit private operator setup without overwriting identities or printing keys, and require its bounded, private, regular JSON file plus a separate session database for TLS gateway/library serving. Missing/public/invalid setup stops before databases/listening. Standard native/container commands name the setup and registry; the image reads the operator file from its existing read-only identity mount.
- Verify the key only at a bounded same-origin JSON endpoint. Issue a fresh random 256-bit `__Host-kibitz_session` cookie (Secure/HttpOnly/Strict/Path=/), store its SHA-256 verifier and operator/credential epoch/expiry privately, and resolve all HTTPS gateway/library claims through the registered backend session. Unknown, duplicate, expired, fabricated and other-operator sessions fail before provider/storage actions. Direct TLS API construction fails closed without an injected trusted resolver. Explicit synthetic HTTP development stays outside final scope.
- Adopt exact legacy collection/usage IDs only after operator proof, retaining original schema hashes, records, revisions and counters. Transactional ownership bindings prevent cross-operator reassignment and partial adoption. Protected grouping cookies remain durable **locators**, usable only with fresh proof, to preserve collections after session-cookie expiry; changing them during an authenticated request cannot change backend claims. Expired sessions deny API access; retained bindings allow proof-authorized recovery across restart or credential rotation with the same operator ID. Bound the registry without evicting identities.
- Add Settings/Your-data sign-in with German text, immediate key clearing, no browser key storage, bounded response reading and protection against overlapping status probes. Sign-in refreshes the mock gateway/library without running a connection test or granting provider sharing consent. Update native/container/operations/provider/data architecture and migration/recovery guidance; the registry contains private raw grouping locators and needs consistent backups with operator/profile/current databases.
- Focused native TLS/store/setup/HSTS/migration tests verify backend lookup, defaults that deny TLS access, owner separation, forgery, duplicate tokens, expiry/rotation, transaction rollback, registry limits, private setup, preserved records/counters and restart. Fresh build/check pass. Full mock-only unit suite: 739 passes, one opt-in live skip. All 37 focused browser cases pass, covering the new form plus existing data/settings/privacy/CSP/literal-text and native TLS/cookie/HSTS flows. The actual pre-session HSTS source (`9e77ac4`) fails the new browser regression because unauthenticated gateway status returns 200 instead of 401. Actual Linux image run `40209656993` / job `121217963565` passes all five cases at `4326f4d`, including the default TLS/operator command; lint/types/build/unit/audit, ZAP/CSP/inventory and secrets also pass. Its CodeQL analysis flags two test patterns: fixture-file data sent to the local server and rewriting a file after metadata checks. Repair both without suppression by passing the generated in-memory fixture secret and creating each malformed file exclusively. Repair source `fbaaa4e` passes both CodeQL gates with no open PR alerts, all five Linux image cases, unit/lint/types/build/audit, ZAP/CSP/inventory and secrets. Further scope review adds atomic previous-token invalidation on reauthentication and verifies that the fixed sign-in window recovers without permanent lockout. The final native set passes 28 groups; the full suite passes 741 tests with one opt-in live skip and the ten direct TLS/sign-in browser cases pass again. Final implementation/test source `e544aa6dd907d8beee6ce81bba7145bf24981bd6` passes the actual Linux image run `40210614653` / job `121220842701` (all five cases), unit/lint/types/build/audit, both CodeQL gates with zero open PR alerts, ZAP/CSP/inventory and secrets. Full application Playwright remains live. Pin that source in the assessment and tick TODO 11.4.2.3. Introducing sign-in also makes 6.1.1, 6.3.1, 6.3.2 and 7.2.4 applicable and verified, with reviewed rate/default-credential/rotation evidence; update the remaining password/authorization/lifecycle scope notes without treating machine keys as hosted passwords or closing the other gates. The matrix now records 35 verified, 26 not applicable, seven deviations and two open controls. Historical RC evidence, owner dispositions and deadlines remain unchanged.

### Deviations

- Local single-user only; no hosted account system, production certificates, real provider calls, new dependency or model download. Operator filesystem ownership remains trusted. Logout/revocation/concurrent termination, permission policy, client-memory/offline cleanup and actual endpoint trust/inventory remain open. The registry retains expired recovery records and refuses new issuance at its bound rather than silently dropping collection ownership; lifecycle cleanup belongs to the next milestone.

### Insights

- Cookie syntax and a private storage scope are not proof of an issued session. Conversely, deleting every old locator when adding authentication loses collection continuity after expiry. Keeping non-authorizing locators and requiring fresh operator proof separates recovery from authorization without rewriting existing private data.

## 2026-10-25 — Isolated application HSTS

TODO item: 11.4.2.2 / ASVS 3.4.1. Native implementation and actual packaged verification are complete at source `42e6ecd5761f012d9f89c15c8386113e9a01124d`; current-head CI remains recorded in the PR. The other ten ASVS remediations and final-release gate remain open.

### Implementation notes

- Default native TLS to the dedicated `kibitz.test` application authority, with operator loopback resolution and an exact DNS SAN checked before private storage/listening. Allow another canonical dedicated `.test` name through `--app-host`; reject localhost/IP/public hostnames, wildcard/CN-only identities and incompatible mode combinations. Chromium ignores HSTS on `*.localhost`, so an earlier proposed reserved-localhost name was rejected after checking the browser's transport implementation. No host-file/trust-store changes or identity generation occur in production.
- Set `Strict-Transport-Security: max-age=31536000` before static/model/API routing, including normal success, HEAD, streaming and 4xx/5xx paths. No includeSubDomains/preload directive, forwarded-host/proto trust or plaintext redirect. Preserve browser authority ports through Docker mappings and require native scheme/full-authority agreement for API Origins. An IP/localhost alias serves only exact GET/HEAD `/manifest.webmanifest`, without an identity or HSTS; other aliases cannot open app/API/model routes. Parser failures close without an HTTP response outside hostname policy.
- Keep original profiles usable for trusted-TLS recovery through explicit `--legacy-origin`, with protected-cookie migration and no HSTS. Document that a new hostname has new cookies/storage/groups, not an automatic identity transfer; export/import explicitly and preserve both profiles/current SQLite files. Describe host-wide policy lifetime across ports, trusted renewal/restart, cross-origin collection/counter limits and rollback without plaintext or trust bypass. Update native/container/provider/operations commands and the actual fifth Linux-image case for the final hostname.
- Fresh build and lint/JSDoc/ASVS record checks pass. Full mocked unit/server suite: 727 passes, one opt-in live skip. Eleven focused transport/HSTS groups pass, including exact/custom SAN, aliased/mapped authorities, all routed status classes, real synthetic model and mock-answer streams, an injected filesystem 500, parser close, startup/storage ordering and original-origin recovery. A real curl HSTS client rejects a wrong CA, caches the policy only with its exact generated CA and upgrades HTTP on the same port without redirect or verification bypass.
- All fourteen focused browser cases pass: built board/Stockfish/mock coach/library, application/error/HEAD headers, no alias cookie/app access, existing native HTTPS/cookie migration/CSP/preflight cases. The HSTS regression fails against the actual pre-HSTS cookie CLI on its missing header. Test-only browser resolver/trust exceptions do not prove operator trust or browser HSTS-cache acceptance. Linux packaging, full-app CI and assessment source identities are tracked in the PR; no local Docker result is claimed.
- Actual Linux image job `121205581181` / run `40205550605` passes all five cases at `42e6ecd`, after integrating the exact-event TLS startup correction from #140. CodeQL/alert gate, ZAP/CSP/inventory, unit/lint/types/build/audit and secrets also pass; full application Playwright remains live and is not inferred from focused checks. Tick the HSTS TODO and update only ASVS 3.4.1's technical status, with that source revision and cited evidence: 30 verified/30 not-applicable/eight deviation/two open. Historical RC exceptions, raw reports and other deadlines/statuses are unchanged.

### Deviations

- Local resolver mapping and supplied, normally trusted exact-SAN identities are explicit deployment prerequisites. Tests use temporary synthetic certificates and HSTS-enabled curl; actual operator endpoint/TLS/public-trust inventories remain TODO 11.4.2.6/11.4.2.8. Controlled HTTP development and legacy-origin recovery remain outside supported final deployment. Cross-host cookie/usage identities are not silently transferred, and the old groups remain available with their original profile/current database.
- No new npm dependency, provider call, model download, runtime trust bypass, unrelated localhost-wide policy or RC finding dismissal. Cookie backend verification, termination and permissions remain separate work.

### Insights

- An emitted header is insufficient evidence for a working browser policy: Chromium's localhost exception rules out an apparently convenient hostname. HSTS and cookies also span ports, so isolation belongs to the hostname; comparing Host's published port to the container's internal listener would break valid mappings while adding no authentication.

## 2026-10-25 — Protected cookies with identity-preserving migration

TODO item: 11.4.2.1 / ASVS 3.3.1. The other eleven ASVS remediations and final-release gate remain open.

### Implementation notes

- Added a shared native-socket cookie policy. HTTPS issues `__Secure-kibitz_uid` and `__Secure-kibitz_library` with Secure/HttpOnly/SameSite=Strict, separate existing API paths, no Domain and unchanged token lengths. Valid legacy IDs migrate verbatim and old canonical cookies expire; a valid protected ID takes precedence. Duplicate/malformed secure identities are rejected without replacing/deleting cookies or selecting a different owner. Status can upgrade an existing library identity without creating a new one.
- Required TLS for cookie-bearing CLI operation before database creation; API constructors independently refuse plaintext by default. Controlled HTTP development requires explicit permission and separate `kibitz_dev_*` names, ignoring both production namespaces. TLS and HTTP-development flags cannot be combined. Updated standard native recipes and default image/Compose command to require supplied identities, with read-only mounts and verified HTTPS health; mock fixtures, passive staging and operator eval/flipbook tools select the development exception explicitly.
- Added policy, actual native-TLS persistence/startup and browser migration/ambiguity regressions. Existing library/usage tests retain their isolation assertions under the explicit development namespace. The synthetic migration keeps owner keys, revision and schema version 1, verifies new writes/counters across restart and legacy-profile recovery, and never uploads browser-local data. The two new browser cases fail on the actual prior HTTPS CLI and pass on the fix. Full checks and PR CI retain their own source identities/results.
- Validation: fresh build and lint/JSDoc/ASVS checks pass; full unit/server suite has 715 passes/one opt-in live skip. The focused browser runs pass 17 and 30 cases (45 distinct cases, with both new migration cases run in each); all seven dedicated mock staging routes pass header checks without ZAP/Docker. All 499 local file links in the changed Markdown resolve and whitespace checks pass. Actual full browser/image/ZAP/CodeQL CI remains source-specific and is reported in the PR.
- Full CI at `65c983e` passed 425 browser cases with one opt-in skip and one stale HTTP preflight assertion: foreign-origin OPTIONS now correctly fails the shared identity/origin guard with 403 before dispatch, rather than reaching the former 404. Update that assertion to require the fixed forbidden response, no CORS grant and no identity cookie; separately keep direct-local OPTIONS at 404 with no CORS/cookie. Runtime guards are unchanged. Integrate current main via the HTTPS prerequisite; final-source CI is recorded in the PR.
- The next Linux image run at `f8fb81d` passes four cases but the added TLS case misses engine startup. Its retained trace identifies five exact `net::ERR_NETWORK_CHANGED` module failures. Wire the existing bounded `openContainerApp` recovery into that case, recording CSP/page errors before navigation and checking them afterward. Extend its unit fixture to HTTP, TLS/IP and the planned isolated `.test` published origins; all non-network-change/CSP/page/HTTP failures remain fatal and a second failure is not retried. This changes test startup only, not the app or timeout/acceptance criteria.
- Replayed rollback against actual baseline `26ccec25801f4e6840882625a1f940302f17a2b5`: restored pre-upgrade cookies plus unchanged current SQLite files expose both pre/post-upgrade records, revision 2, and user/server request counts of 2. Documented consistent private profile/database backups, browser-origin boundaries, unsupported path ambiguity and the need to preserve post-upgrade writes. No operator data/certificate, trust-store modification, paid inference or weight download was used.

### Deviations

- The explicit HTTP development exception is retained with isolated names and synthetic/mock test use; it cannot adopt a production identity. The operator tools remain development clients and retain paid-call approval requirements. Browser JSON exports do not back up cookies or move browser storage across origins. Rollback uses a saved full profile and the tested HTTPS baseline, not a cookie-secret API or a database downgrade. No new dependency is added.
- This is the cookie-protection fix, not authenticated sessions, HSTS, external-provider TLS inventory, public trust or release approval. Historical RC raw findings are unchanged. The remaining eleven ASVS fix TODOs stay open with their existing dates; CodeQL default-branch alerts are not manually dismissed.

### Insights

- The cookie name can change without re-keying either private store because ownership and accounting depend on the opaque value. Keeping the value makes recovery verifiable against the previous implementation; rejecting ambiguous identities prevents a convenience fallback from silently presenting an empty collection as lost data.

## 2026-10-25 — Native HTTPS listener prerequisite

TODO item: 11.4.2.7.1; parent 11.4.2.7 and cookie migration 11.4.2.1 remain open.

### Implementation notes

- Added `--tls-key FILE --tls-cert FILE` to the actual CLI, sharing its existing API/static routes through Node HTTPS. The owner selected native TLS with supplied identities. A pair is parsed before private storage/listening; incomplete/invalid options exit with a fixed private diagnostic rather than falling back to HTTP. Supplying neither option preserves the current HTTP RC behavior.
- Added a bounded descriptor reader for PEM identities outside every served root, resolving parent aliases while refusing leaf symlinks, hardlinks, empty/oversized/non-regular files and non-private POSIX key permissions. Node validates that certificate/key match; no identity is fetched/generated, permissions changed, CA installed or raw path/PEM/OpenSSL error logged. The TLS minimum is 1.2; real native clients negotiate 1.2/1.3 and reject older protocols, wrong names and untrusted chains.
- Added six native TLS test groups, three health-probe groups and a real-browser built-app case for HTTPS Stockfish play, mock coaching, private-library writes, Secure issuance, local-only requests and unchanged CSP. Added a fifth explicit image case with read-only synthetic identity mounts, normal UID 1000 and HTTPS health checking. The container's exec-form probe supports an explicit HTTPS flag and bounded public CA file, retaining normal verification, a fixed static-only target and total deadline. The container case runs in Linux CI; no local Docker result is inferred. Documented identity ownership/trust/renewal/restart, health-probe settings and cross-origin data migration limits.
- Full browser CI exposed an incomplete missing-parser fixture: its isolated server copy omitted the newly imported TLS module, failing module loading before the intended missing-parse5 check. Added that module to the fixture while preserving the bounded diagnostic assertions. The previous run had 423 passes/one skip/this one failure; the corrected CSP cases pass locally and final-head CI is recorded separately in the PR.
- Fresh build and lint/JSDoc/ASVS checks pass; the full native suite has 708 passes/one opt-in skip, all nine focused TLS/health groups pass, and the three focused browser cases pass. The prior CLI rejects the new TLS options rather than supplying native HTTPS. No provider call, weight download or operator certificate/configuration was used. CI/image results retain their own source identities in the PR.

### Deviations

- Native HTTPS is a prerequisite for the first cookie remediation; it does not implement secure prefixes or data-preserving migration. All twelve ASVS fix TODOs and their technical statuses stay open/unchanged, including final transport enforcement and actual endpoint/certificate evidence. The existing HTTP RC/development path is retained until the final deployment transition is implemented. No release or merge approval is implied.

### Insights

- A working TLS listener and a secure deployment are different deliverables. Testing the real CLI avoids mistaking a wrapper's HTTPS support for application support, and checking identities before storage creation prevents failed transport setup from leaving new private databases behind.
## 2026-10-25 — Confidence-weighted assurance links and review findings

TODO item: 0.17.

### Implementation notes

- Extend all three graph contracts to version 2 with finite confidence weights, method, policy and rationale for each declared relation type. Extracted structural references retain direct support; unique suffixes and exact-name attribution use explicitly uncalibrated heuristic weights. Confidence does not claim implementation, truth, runtime execution or acceptance.
- Add editable [typed assessments](assure/links.json) and their contract. Multiple relation types can coexist for the same pair; per-type overrides preserve extracted provenance. Initial author hypotheses link the inference utility and its fixtures to this TODO without inventing independent review or test-success evidence.
- Add `utils/assure-infer.mjs`, [findings](assure/findings.json) and a [report](assure/FINDINGS.md). Rules distinguish authored deviations, unresolved/missing trace links, unassessed implementation/verification, competing assessments and bounded possible dependency impact. Each supported finding retains typed paths; path weights use the minimum, alternatives the maximum, without an independence or probability claim.
- Validation passes the full unit/server suite (731 passes, one opt-in live skip), all thirty-one focused assurance cases, four real-browser cases, fresh app build, utility lint and normal lint/JSDoc/ASVS/freshness checks. Browser coverage exercises actual confidence filtering and finding support paths; no provider calls occur.
- Final-head CI `40186985029` exposes an existing check-then-bind race in `site/server/usage-serve.test.mjs`: the child fails with `EADDRINUSE` after releasing its probe port. Use the CLI's existing `--port 0` allocation and reported bound URL in usage/library restart fixtures. A [fault injector](../site/tests/fixtures/reclaim-probe-ports.cjs) takes every released probe port; the old usage fixture fails deterministically while all three corrected restart cases pass. `site/tests/unit/cli-port-allocation.test.mjs` keeps that subprocess regression in the suite. No app/runtime change, retry or relaxed assertion is introduced.
- Expand [the assurance README](assure/README.md) with the three levels, vocabulary, confidence policy, examples, inference semantics and maintenance. Extend the local browser with minimum-confidence filtering, weighted edges, findings search and inspectable support paths. Normal checks regenerate in memory and reject stale graphs or findings.

### Deviations

- The first rules infer evidence gaps and review scope. An absent authored `implements`/`verifies` assessment does not prove absent code/tests; a possible deviation impact is not an observed defect or root cause. Negative findings are scoped to the extracted graph and chosen threshold, with limits reported.
- Weights are transparent initial support conventions, not calibrated probabilities. No LLM or paid service assigns confidence. Combined reflection headings remain separate from recorded deviations unless an analyst explicitly supplies a typed hypothesis.

### Insights

- Confidence belongs to a relation type: the same artifact pair may support both a strong reference link and a weaker implementation interpretation. Repeating evidence must not inflate support, and filtering must use the effective per-type override rather than retaining the stronger original in parallel.
- Missing traceability and recorded deviations are different observations. Keeping their evidence paths and qualifications visible makes later inference reviewable without converting documentation omissions into defect claims.

## 2026-10-25 — Object, PR-section and documentation assurance browser

TODO items: 0.16, 0.16.1–0.16.3.

### Implementation notes

- Add separate [object/PR](assure/objects.json) and [documentation](assure/documents.json) graphs with a shared [typed contract](assure/detail-types.mjs). `utils/assure-detail.mjs` extracts functions, classes, methods and control-flow blocks without executing source; qualified identities, AST selectors, exact text hashes and source ranges support reproducible replay. Direct lexical calls and declared local imported exports retain their resolution evidence.
- Retain public PR bodies, exact head/base commits, observed states and paginated changed-file lists in [a separate metadata snapshot](assure/pull-requests.json). PR description sections connect explicit TODO/file/object references; changed-file membership remains a distinct file-level relation. Explicit refresh is read-only network access; build/check/browser stay offline.
- Add project Markdown heading hierarchy, fenced blocks, inline/reference-style links, local heading targets and external documentation URLs. Source containment locates the original TODO/DONE/insight/deviation nodes; unresolved anchors, historical paths and ambiguous object names remain gaps.
- Local validation: all eight detailed-graph fixtures and the full unit/server suite pass (720 passes, one opt-in live skip); three focused Playwright cases pass with no external requests, page errors or CSP violations. Browser checks cover search, typed filters, replayed source, directions, history, deep links, truncation, text-only hostile labels and source/Host/method confinement. The fixed Cytoscape container rule is supplied by local CSS rather than an injected stylesheet.
- Research [browser foundations](assure/LEVELS.md#browser-foundation-comparison) and choose exact development dependency Cytoscape.js 3.34.4 (MIT), served locally. Build [the small browser](../utils/assure-browser/README.md) under `utils/`: search, directed bounded walks, filters, history/deep links, graph/list navigation and hash-checked source inspection. A fixed-asset loopback server exposes graph IDs rather than arbitrary paths. CI checks all layers and runs focused Playwright coverage before the full app suite.

### Deviations

- These levels add reference precision, not compliance or completion claims. Static calls do not prove runtime execution; dynamic/member calls, re-export chains and unsupported languages remain outside extraction. Exact object mentions require a cited file and unambiguous name in the same authored section/item. PR file membership never becomes an inferred object-level change claim.
- Retained PR descriptions are refreshable snapshots because GitHub does not supply immutable body revisions. Review comments and CI logs are not fetched. Documentation extraction covers common headings and inline/full/collapsed reference links, with unsupported anchors and schemes recorded rather than guessed.

### Insights

- Lexical scope matters: a parameter that shadows a function name must not become a call edge to the containing function. Independent fixtures exposed and corrected that mapping before real data generation.
- A replayable range and content hash let readers inspect exactly what an edge refers to. Keeping PR/file changes separate from section/object mentions preserves that precision when historical descriptions are incomplete.

## 2026-10-25 — Typed file-level assurance lineage

TODO item: 0.15.

### Implementation notes

- Added [the assurance graph](assure/lineage.json), its [typed contract](assure/types.mjs), generated schema/report and a repository-local generator/query command in `utils/assure.mjs`. It inventories tracked artifacts and extracts TODO hierarchy/status, DONE references and individual insight/deviation notes with source locations. Combined headings keep a separate reflection type.
- Link Markdown files and logical items to referenced files; parse literal local JavaScript imports and inline HTML modules without executing them. Preserve ambiguous/missing historical references as explicit unresolved records. Every typed edge has source evidence, and the checker validates endpoint types, ownership, hierarchy and deterministic freshness.
- Add `just assure`, `just assure-build` and `just assure-query`; `just check` and CI include the freshness/integrity check. The normal Node suite includes small independent fixture cases for parsing, provenance, ranges, ambiguity, safety, integrity and stale data. Local validation passes lint/JSDoc/ASVS, a fresh application build and the full unit/server suite (712 passes, one opt-in live skip); all thirteen focused lineage cases and separate utility/contract lint pass. Actual TODO/file queries and deterministic build/check round trips are exercised without provider calls.

- Initial PR CodeQL flags a backtracking Markdown-link regex (27) and ambiguous classifier anchoring (28). A real old-builder probe times out after two seconds on an unterminated link with 28 escaped pairs. Replace link/code-span extraction and report-label stripping with a scanner that advances through characters/runs, and express directory/extension classification as separate tests. A bounded child covers 100,000 escaped pairs plus a large unmatched-bracket input; title/escape/nesting/code-span cases pass. No query, assertion or finding is suppressed. Corrected scan `40181285750` marks both PR findings fixed. After #130 merged, the freshness gate detected the new main artifacts in the tested merge; integrating main and regenerating the graph restores coverage of that source.

### Deviations

- This first graph records file-level references and authored planning status. It does not infer implementation or requirement satisfaction from a DONE reference, conflate preparation with release approval, or repair historical paths by guessing. Runtime/dynamic dependencies, symbols and historical file revisions remain outside scope.
- New/deleted files must be staged before regeneration, keeping untracked/private operator material outside the inventory. The generated report makes missing annotation links and unresolved references visible rather than treating them as verified lineage.

### Insights

- Insights and deviations explain why an artifact and a TODO are connected. Keeping them as addressable nodes preserves that rationale during traversal, including partial implementation and open limitations.
- A source location and an explicit relation type distinguish a reference from a completion claim. The graph should preserve those distinctions even when its endpoint files exist and all structural checks pass.

## 2026-10-25 — Track ASVS fixes required before final release

TODO items: 11.4.2.1–11.4.2.12 (all open); release gate 11.6 remains open.

### Implementation notes

- Added one actionable remediation TODO for each of PR #133's ten ASVS deviations and two open requirements, with control IDs, implementation/verification criteria and maintainer ownership. Linked every unsatisfied assessment record to its exact TODO and regenerated the readable checklist without changing any technical status.
- Recorded the owner's direction that these exceptions may be approved for the local RC, but all twelve conditions must be fixed and verified before the first final release. Updated the candidate review, release packet, ASVS guide and release procedure; RC acceptance or a renewed exception cannot close a remediation item. Existing review dates and component-plan/finding deadlines remain unchanged.
- The session/permission tasks remain within local single-user operation; hosted accounts stay deferred. The plan includes cookie/data migration, hostname/HSTS effects, actual endpoint TLS evidence, process-level checkout isolation and authenticated client-data cleanup rather than treating documentation or a passing scan as their implementation.
- Validation: Node 24.22.1 lint/JSDoc/ASVS checks and all eight existing ASVS regression groups pass. Independent checks confirm twelve unique open control-to-TODO mappings, all 70 statuses unchanged, 372 local Markdown file links resolving and all sixteen retained raw hashes unchanged; whitespace checks pass.

### Deviations

- This change records the requested work and release gate; it does not implement the twelve fixes. All twelve TODOs remain unchecked, and ASVS counts remain 28 verified/30 not-applicable/ten deviation/two open. It does not authorize a merge, final release, paid call or model download.

### Insights

- A temporary RC exception needs a specific remediation target and an explicit final-release boundary. Individual control-to-TODO links make the remaining work reviewable without confusing accepted RC risk with a completed fix.

## 2026-10-25 — Reconcile candidate evidence and approved exceptions

TODO item: 11.6.2; the parent release gate remains open.

### Implementation notes

- Reconciled the candidate/release procedure and OWASP application/LLM reviews with the owner's main integration: source `002fd92`, main `6788661`, tested merge `11784278`; candidate and merge trees match exactly. Original prerequisites, paired CodeQL pins and Chessground CSP compatibility are integrated. Open PDF/assurance PRs remain outside this tested scope.
- Recorded the owner's existing 2026-10-25 approval of local `0.1.0-rc.1` exceptions in the repository review and all twelve affected ASVS records, preserving 28 verified/30 not-applicable/ten deviation/two open. Endpoint/component review remains due 2026-11-01, component remediation plan 2026-11-24, and retained finding deadlines remain unchanged. No new risk acceptance, merging or publication is inferred.
- Retained sixteen raw public CI report/inventory files byte-for-byte with a structured hash/source/job record. Independently checked config/source/rootfs, raw image gate, all fourteen OS/sixteen production-library versions, actual Linux/x64 Node 24.22.1, seven asset hashes against a fresh build, publisher identity fields, ZAP coverage/HTML policy and all 128 distinct locked package/version pairs against SBOM. The image still reports zero high/critical, 23 medium/eight low, matching original findings field-for-field; passive scan has zero high/medium/low and two informational types. The completed source-002fd92 unit job has 699 passes/one opt-in skip; CodeQL analysis 2021957484 has 126 rules/zero results, while default-branch mediums 20/21/23 remain open.
- Reviewed the initial-base delta: dependency/Action updates, guarded fixed SVG transformation and trusted CSS. Updated the Chessground changelog and ASVS output evidence. Source-002fd92 full Playwright passes with 423 passes/one skip at 11:46 UTC; later final-head results retain their separate identities. Local lint/JSDoc/ASVS/build, eight ASVS regression groups, 519 local file links and all sixteen raw hashes pass. No operator configuration, paid call or weight download was used.

### Deviations

- The exported image archive and advisory database were deleted by CI; retained digests are CI records and cannot be independently rehashed. Publisher cryptographic verification is the actual CI step; retained identity fields were checked offline. SBOM equality does not establish broader embedded/build/model coverage. Final-head CI, broader follow-up and explicit release approval remain open; TODO 11.6 is unticked.

### Insights

- A passing job and a retained evidence packet establish different facts. Preserving the raw reports and binding each result to source/merge identities makes review reproducible without resetting findings or asking the owner to approve the same exceptions again.

## 2026-10-25 — Prepare the first local candidate draft

TODO item: 11.6 candidate preparation; the release gate remains open.

### Implementation notes

- Prepared `0.1.0-rc.1` with npm's no-tag/no-script version command, aligning the package and both lockfile roots while retaining `private: true`. The functional base is `be90b0f`; prerequisite PRs remain open, so this is a stacked draft rather than finalized merged-source or release approval.
- Moved the current feature/security/compatibility notes into a dated unpublished candidate section and left a new Unreleased section. Added a candidate review covering actual deployment/platform evidence, unchanged data/cache/model formats, individual pending gates and the owner's experimental-prose scope. No tag, asset or registry image was published.
- Rechecked official OWASP application/LLM references and the ASVS 5.0.0 source checksum. Updated A03/LLM03 for fixed Qwen source revisions and ASVS component evidence at the functional base, keeping counts at 28 scoped verifications, 30 justified absences, ten deviations and two open. Current main `8c82d3c` has three open medium CodeQL alerts (20/21/23), with no open high; no alert disposition changed.
- Node 24.22.1 lint/JSDoc/ASVS and fresh build pass; the complete settled-build unit/server suite passes with 698 passes and one opt-in live skip. Independent manifest/lock comparison confirms only the three version fields changed, and application/server/scripts, Docker/Compose and workflows have no diff from the functional base. All 534 local Markdown link targets resolve and whitespace checks pass. Full candidate browser/security/image CI is still required; no live provider call or weight download is used.

### Deviations

- Candidate metadata can be prepared before prerequisite merges, but source/version finalization, retargeting to main and actual candidate verification remain required by the release procedure. Earlier feature tests/scans retain their own identities. TODO 11.6 is not ticked; component/deployment/finding dispositions and explicit release approval remain pending.

### Insights

- A concrete unpublished candidate makes the version, compatibility effects and remaining decisions reviewable while keeping the final merged-source evidence and publication decision distinct.
## 2026-10-25 — Preserve board style policy after Chessground upgrade

TODO item: 11.5.3.

### Implementation notes

- Actual container runs `40176383203` (#134) and `40176438854` (#130) fail after the main-branch Chessground update (#129): each SVG overlay attempts a fixed inline color-scheme attribute, rejected by the existing strict CSP. This is separate from #130's corrected CodeQL version mismatch.
- Adapt the pinned 10.4.2 bundle during the source build: remove the single known fixed declaration and express it in trusted CSS for Chessground's SVG overlays. Other upstream bytes are unchanged. Reject an unreviewed package version or missing/duplicate declaration so an upgrade cannot silently bypass this adaptation.
- Update the shipped third-party notice from stale 10.1.1 to 10.4.2 and identify the local change and reproducible source. No installed package, lockfile or generated dist file is edited.
- A real-browser regression fails before the fix with eight CSP events, four blocked style attributes and a `normal` computed scheme. The corrected SVG test covers all four layers, arrows, orientation changes and light/dark appearance. Existing hostile-style/attribute injection remains blocked. Local lint/JSDoc/ASVS, a fresh build, the full unit suite (697 passes, one opt-in live skip) and eleven focused browser cases pass, including a real Stockfish game through checkmate, saved review and illegal/out-of-turn move handling.

### Deviations and insights

- Keep this compatibility fix separate from the PDF and CodeQL PRs. Container/whole-suite CI must verify the resulting source; prior green evidence for 10.1.1 does not cover 10.4.2. No CSP relaxation, violation filtering, test retry or provider call is introduced.

## 2026-10-25 — Rebuild PDFs by modification date

TODO item: 0.12.1.

### Implementation notes

- Both `just pdf FILE` and `just pdfs [PATHS]` now skip nonempty PDFs whose modification date is at least as new as the Markdown, print stylesheet, Mermaid include and justfile. Missing/empty PDFs or a newer build input trigger rendering. No content hashes or PDF scans are needed for current output; legacy `.pdfstamps/` files are ignored and remain Git-ignored.
- Preserved filenames with spaces, normal rendering/error behavior and bulk exclusions for root/nested `AGENTS.md`, `CLAUDE.md` and `.github/` templates. Individual agent documents can still be explicitly rendered with `just pdf FILE`.
- Reproduced the old behavior with the actual aggregate recipe and local renderer stubs: a matching content stamp incorrectly skipped a source newer than its PDF. The corrected aggregate rebuilds it, then skips the next run. Missing/empty output, equal timestamps, updated CSS and instruction/template exclusions also pass.
- Integrated compatibility fix #135 after the first actual container run exposed the separate Chessground 10.4.2 style-policy regression from #129. The PR targets main and its new CI tests the combined source; the PDF implementation itself does not change app behavior.
- A dependency-free Node test exercises the Bash timestamp guard with controlled source/rendering/output dates, including spaces and absent inputs. The test runs with the normal unit suite; local lint/JSDoc/ASVS, `just --list`, Bash syntax and whitespace checks pass. A real pandoc/Chrome smoke run renders a valid PDF, and its second bulk run skips it without changing the PDF modification date.

### Deviations

- Modification dates now decide freshness, as requested; touching a source rebuilds it even if its bytes are unchanged. Embedded image timestamps are not tracked: delete the affected PDF after changing only an image, as documented. Tool-version changes are not automatically detected.

### Insights

- A content stamp can override a newer source timestamp. Using the same date guard for single and bulk rendering gives both commands predictable make-style freshness.

## 2026-10-25 — Keep CodeQL action updates together

TODO item: 11.5.2; repair PR #130.

### Implementation notes

- The actual failed CodeQL run `40169734144` loaded configuration from `init` 4.38.2 into `analyze` 4.39.0 and rejected it. Update both to the same full commit, independently resolved from the official annotated 4.39.0 tag.
- Group `github/codeql-action/*` in Dependabot so future updates arrive together. A unit regression checks immutable pins and their equality; it fails on the original PR's split versions. The corrected regression, local lint/JSDoc/ASVS and fresh build pass. The first full run had a 500 ms loopback SDK fixture timeout under load; all eleven focused stream cases then pass unchanged, and the full suite with two concurrent test files passes (698 passes, one opt-in live skip). Actual CI verification is recorded in the PR.
- Merge current main into the existing PR branch without rewriting history, including the container startup recovery already reviewed in #125. The original PR also failed its packaged engine startup check; actual container CI must verify this integrated source. Subsequent actual run `40176438854` exposes the separate Chessground style regression from #129. Integrate compatibility fix #135 into this branch so its own main-targeted CI tests the corrected app; the CodeQL-only source `288e2ab` already passes actual CodeQL run `40176438860`.

### Deviations and insights

- This repairs the existing dependency PR rather than opening another overlapping action upgrade. PR #131's separate initialization bump becomes redundant once #130 merges. No check is suppressed and no application behavior is changed by the action update.

## 2026-10-25 — Pin browser-model source revisions

TODO item: 11.3.3.1 complete; parent supply-chain review remains open.

### Implementation notes

- Replaced both official Qwen GGUF download locators' mutable `main` component with full repository commits. Exact-revision API metadata and raw LFS pointer text match the existing size/SHA-256 pins; replayed Git blob IDs match the metadata. Filenames, weights, markers and default selection are unchanged.
- Retained the two small LFS pointers, source/revision URLs and observed model-card/licence metadata hashes. Checked Apache-2.0 declarations and the cards' respective instruct-base-model names. Documented an upgrade review covering revision, bytes, licence and compatibility together, and added fixed source links to third-party notices.
- Strengthened catalogue tests to require full source commits and replay the retained pointers. The actual download-CLI regression now preserves the production URLs while intercepting every fetch with tiny synthetic bytes; it exercises both catalogue models. The new unit assertions and CLI case fail against the old `main` locators, then the twelve focused model/download unit cases pass after pinning.
- Node 24.22.1 lint/JSDoc/ASVS record checks and build pass. The complete settled-build unit/server suite passes with 698 passes and one opt-in live skip; all four download-CLI Playwright cases pass. All 100 local link targets in changed Markdown files resolve and diff whitespace is clean. No live provider call or actual weight body is used.

### Deviations

- This review reads only public metadata, model-card/licence text and 134/135-byte LFS pointers. It neither downloads weights nor runs inference or a provider. Declared base-model lineage, quantization/training provenance and quality remain unverified; mutable cloud/Ollama/Chrome identities and TODO 11.3.3 stay open. Existing checked caches need no migration or forced download.

### Insights

- A content hash rejects changed upstream weights, while a full source revision also preserves the intended file locator when an upstream branch moves. These establish identity and reproducibility boundaries; neither establishes model truth or teaching quality.

## 2026-10-25 — Local release review preparation

TODO item: 11.6 preparation; the release gate remains open.

### Implementation notes

- Added a dated review packet binding the source/prerequisite PRs to the actual OWASP application/LLM, ASVS, web-baseline, exact-image and test evidence. Separate implementation-source evidence from the future release candidate and its required full checks.
- Listed each of the ten ASVS deviations and both open requirements with the concrete decision or missing evidence. Retained the 31 runtime finding targets and the three current-main CodeQL medium contexts; the API reports no open main highs at `42761c3`. No finding is suppressed, dismissed or accepted on the owner's behalf.
- Recorded the external inputs for human calibration, recorded-provider/German trials, mutable model identities and unrestricted chess-claim verification. Updated release/maintenance guidance to reflect completed packaging/guides while retaining the actual gate.
- Checked official Debian records for all 25 distinct runtime CVEs behind the 31 package findings. Added a conservative exposure review covering actual amd64 identity, container restrictions, narrow function/service prerequisites, resolver configuration and unverified native call chains/ranges. No vendor classification is treated as a fix or owner exception; original deadlines and raw findings remain intact.
- Added a fixed public-asset/Node-component capture to container CI, with explicit artifact retention. The exact command passes a native macOS smoke check for seven assets and 29 component/ABI entries, and fails on a missing asset; actual Linux inventory remains pending. Verified four npm registry signatures for the two pinned WASM packages against current advertised keys, matching lock integrities and rejecting a modified signed payload. Retained replayable public material and exact source candidates, explicitly without compilation attestation or mutable-model identity claims.
- Independently resolved all six direct Action pins against official tags, dereferencing CodeQL's annotated tag. A paginated query finds no matching GitHub-reviewed/non-withdrawn advisories for those exact wrapper versions; it does not clear bundled dependencies, downloaded tools, runner runtimes, unreviewed reports or malware. The dated record preserves that scope, with no pin/token/setting/alert change.
- Actual capture run `40168845693` at source `0936467` records Linux/x64 Node 24.22.1, 29 component/ABI entries and seven asset sizes/hashes matching the previously tested build. Both attempts fail the browser case after Chromium aborts initial modules with `ERR_NETWORK_CHANGED` (27/40 trace errors); the other three cases pass, and advisory scanning does not run. Added one container-only navigation recovery for that exact same-origin script failure. HTTP/page/other-network failures, repeated interruption and missing/violated CSP evidence still fail; six policy groups cover the boundaries. Corrected actual CI remains pending, with no timeout/assertion relaxation or app behavior change.
- Recorded the owner's first-candidate choice to keep experimental free-form coaching with the verification limitation visible in README, user guide and LLM/release review. TODO 11.3.9 remains open; no claim of exhaustive chess-prose verification or disposition of other security requirements follows.
- Corrected actual run `40169822979` passes at source `5764f74`, merge `07079b6`: publisher signature, both builds, all four browser/private-file/restart/compatibility cases and the strict image gate. Independent artifact review rechecks config/rootfs/source and report identity, fresh DB/raw gate, exact fourteen OS/sixteen library versions and all seven asset hashes/sizes. The map has 29 Node component/ABI entries; raw findings match the prior 23 medium/eight low exactly, retaining original deadlines and pending dispositions. Source CI passes unit/audit, CodeQL, secrets and passive checks; full Playwright remains running at this recording. ASVS stays 28 scoped verifications, 30 justified absences, ten deviations and two open.
- Final documentation/evidence validation passes lint/JSDoc/ASVS plus all fourteen checker/recovery regression groups. All 472 local link targets resolve and diff whitespace is clean. Application/server/Docker/package sources are unchanged between `92ccc07` and `5764f74`; the new image evidence is attached to its actual source rather than relabeled as a release candidate. Integrated the user's merges through #122 without file changes.
- Lint/JSDoc/ASVS and build pass; the complete settled-build unit/server suite passes (697 passes, one opt-in live skip), including the six recovery policy groups and eight checker groups. All 118 local link targets resolve and diff whitespace is clean. Supplemental coverage checks reconcile all 25 advisory rows with the 31 unchanged pending raw findings. Offline replay verifies all retained registry signatures and rejects altered payloads; the container workflow parses and retains the new JSON explicitly. Application runtime is unchanged; corrected Linux verification remains pending. The parent's full unit/browser/image results are not relabeled as release-candidate evidence. No paid/provider call, model download, operator configuration inspection, version bump, tag or publication.

### Deviations

- Prerequisites #118–#122 are merged; #123/#124 remain open at recording. Full browser CI is still running. This review preparation leaves the release candidate, TODO 11.6 approval and broader unsatisfied requirements separate; it does not establish ASVS compliance or authorize publishing.

### Insights

- A reviewable release decision needs exact evidence and individual unresolved conditions together. A passing feature check cannot supply an owner's risk disposition or evidence about a later merged revision.

## 2026-10-25 — Verified image advisories and minimal runtime

TODO item: 11.6.1 complete. The parent release gate, lower-finding dispositions and broader ASVS component/advisory requirement remain open.

### Implementation notes

- Added an advisory step to the existing actual container workflow after its browser/private-file/restart cases. It verifies the recorded/local image ID, source label/checkout revision and packaged Node version, then exports that image to a private temporary archive. A fixed official Trivy 0.76.1 multi-platform manifest digest was independently hashed before use; the scanner receives the archive read-only, without a Docker socket or operator/provider credentials.
- The non-root scanner has a read-only root, bounded resources/deadline and one evidence/cache mount. Explicit empty config/ignore-file selection, disabled telemetry/version/dependency API calls, an empty initial cache and a selected official schema-two DB avoid ambient filtering or stale reuse. Record actual DB updated/downloaded/next-update timestamps and database/report/archive digests; reject expired/stale/future metadata, mismatched reports, missing OS or production dependency versions, modified findings and any high/critical result, including unfixed ones. Retain all raw severities/statuses for triage.
- Artifacts retain only image/source/OS text metadata and advisory JSON for thirty days on success/failure. Private archives, cache/database bytes and temporary Docker client configuration are cleaned up; only uniquely owned scanner containers are removed, and cleanup failures cannot yield success. No image is pushed, provider/model is called or operator environment file is read.
- Local preparation: all eight new validator/plan/CLI regression groups pass, as do lint/JSDoc/ASVS checks, build and the complete unit/server suite (682 passes, one opt-in live skip). All 109 local links resolve and diff whitespace is clean. Actual Docker/Trivy execution is reserved for Linux CI; no local image-scan success is claimed.
- First actual run `40160064985` scans source `2fe12ab`/merge `715b120`, then fails on raw findings and validator identity/coverage assumptions. It records 244 package findings (61 high, one critical, 96 medium, 84 low, two unknown). The packaged Node is already 24.22.1; the prior 24.21.0 staging version belonged to the CI host. Corrected that distinction promptly. Raw findings remain retained, with no claim of application reachability or suppression to obtain a pass.
- Corrected identity checks by independently hashing the Docker archive config and checking ordered rootfs layers/source against daemon and scanner metadata; retained the daemon image/index ID separately. Reconstruct Debian epochs/releases before exact inventory comparison. Ten advisory groups pass, including new archive/digest/traversal and Debian-version regressions; three independent status/status.d inventory groups also pass.
- Prepared a pinned official Distroless Node 24/Debian 13 candidate to remove unused shell/npm/corepack/OS tools from the runtime. Preserve explicit UID/GID 1000, private data modes, vector entrypoint/health check and all app/storage semantics. Added pinned Cosign publisher verification and a fourth actual container case reopening a previous-packaging volume with the same cookie/usage and independent-client isolation. Build stages keep the original Node/npm image and their separate advisory scope. Pinned CI/minimum Node to 24.22.1 and downloaded/hash-checked its official macOS runtime into a temporary directory for validation; the system installation is unchanged. Candidate image/signature/raw scan and final local checks remain pending.
- Final local checks on verified Node 24.22.1 pass lint/JSDoc/ASVS, build and the complete unit/server suite (688 passes, one opt-in live skip). Four container definitions load, without claiming local Docker execution; all fourteen advisory/inventory groups pass. All 172 local links resolve and diff whitespace is clean. The new Node floor independently rejects the reviewed vulnerable patch range even if a generic package scan misses the native runtime. Actual candidate verification follows in CI; no high/critical suppression is introduced.

- Candidate run `40165570438` passes publisher verification, both builds, all four actual image/browser/restart/cross-packaging cases and the strict raw advisory gate at source `922bdd9`/merge `3f9fe8f`. Independently inspected report: Node 24.22.1, fourteen OS package versions and sixteen library versions, no high/critical findings; 23 medium and eight low remain retained for triage. This is package-scope evidence, not full release clearance.
- The separate CodeQL check reports two new high file-system races in inventory/report readers (alerts 25/26). Replaced path-stat-then-read with a shared no-follow/nonblocking open, descriptor type/size check and bounded descriptor reads; actual bytes remain capped if the file grows. Added real filesystem replacement/symlink/growth/close regressions. No alert is dismissed or excluded. Retain small independently derived image-config/rootfs evidence so archive identity can be rechecked without uploading the archive. Final source CodeQL and image rerun remain pending.
- Descriptor correction validation passes lint/JSDoc/ASVS and the complete unit/server suite on Node 24.22.1 (690 passes, one opt-in live skip), including all sixteen advisory/inventory regression groups. No app/UI behavior or scanner rule/severity/status is changed.
- Final actual Linux run `40166278799` passes at source `92ccc07`, scanned merge `da379a15`: publisher signature, both image builds, four real container/browser/restart/cross-packaging cases and the strict advisory gate. Independent artifact review recomputes the archive config/report digests and checks source/rootfs identities, fourteen OS package versions, sixteen library versions and fresh database metadata. Node is 24.22.1; zero high/critical, 23 medium and eight low findings. Sanitized evidence retains every lower finding with review/remediation targets; exposure triage and owner acceptance remain pending.
- CodeQL passes on the corrected source. Both PR alert instances (25/26) are fixed without dismissal or exclusion; unit/audit, secret and passive-baseline checks also pass. The complete browser job remains pending at evidence recording. ASVS remains 28 scoped verifications, 30 justified absences, ten deviations and two open; no release-clearance claim follows from the image result.
- Final evidence/document validation passes lint/JSDoc/ASVS and all seven checklist regressions; 322 local link targets resolve and diff whitespace is clean. The subsequent evidence prose does not change the implementation scanned at `92ccc07`.

### Deviations

- This is detected-package advisory evidence, not a complete inventory/advisory claim for embedded Node/C++/WASM internals, Actions, browser/font parsers or model identities. ASVS 15.2.1, owner review of lower findings/deadlines and the actual release gate remain separate. The database freshness window is an input policy, not a remediation SLA or vulnerability guarantee.
- Trivy is an Apache-2.0 CI tool in a separate image; no application dependency or distributed runtime scanner is added. Actual execution comes from Linux CI, with no local Docker success claimed. Medium/low findings remain visible rather than being suppressed or implicitly accepted.

### Insights

- A scanner exit code alone cannot establish what was scanned. Exact image/source identity, fresh database metadata and independently checked package coverage prevent empty, old or partial output from appearing clean.
- A read-only exported archive allows scanning the tested image without granting a third-party tool access to the build daemon or running app/private storage.

## 2026-10-25 — Verified local web assets and stricter stylesheet policy

TODO item: 11.5.1 complete; release verification and informational findings remain separate.

### Implementation notes

- Replaced `style-src unsafe-inline` with separate parsed trusted stylesheet hashes and `style-src-attr 'none'`. Complete HTML/SVG style blocks use browser-normalized text; inert/template/raw-text/unfinished lookalikes and unsupported types grant no hashes. Script hashes and worker/WASM permissions retain their separate boundaries. Replaced eighteen authored style attributes and three dynamic string-style helpers with equivalent classes; trusted CSSOM geometry remains available.
- Bundled the same Bricolage Grotesque, Instrument Sans and JetBrains Mono normal variable fonts from official Google Fonts revision `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`, retaining unchanged bytes, authors and full SIL OFL notices. The manifest records source URLs/sizes/hashes, the build verifies before publication, and offline bundles include the fonts/licences. No npm dependency, model download or automatic font refresh is added. Removed external font links/hosts and canonicalized the wrapper charset.
- Added CSS boundary and negative scan-policy tests, pinned font/offline-inventory/integrity tests, actual CLI/Chrome CSS-injection regression and desktop/German-phone font/layout checks. Full unit/server suite passes (674 passes, one opt-in live skip). Initial browser run passes six cases; the phone case reveals that a language switch legitimately refetches all three local fonts. Its assertion now checks the three exact URL identities and every response rather than one fetch per font; loaded faces, CSP, external-request and layout assertions remain.
- The CSS regression fails against the previous actual backend: the injected inert-template CSS changes the trusted element's colour under its old broad permission. The corrected backend blocks that CSS and a style attribute while allowing the trusted block and property-based geometry. Expanded final browser checks and actual Linux passive baseline are pending; no successful scan is inferred from header/unit tests.
- Final local verification passes all thirty browser cases, including desktop/German-phone fonts, normal play/review, settings, layout/session transitions and all seven actual offline-app/update/erasure cases. Visually inspected both font/layout captures. Final-build CSS/font/integrity/scan-policy tests pass all 22 cases; lint/JSDoc/ASVS checks and seven-route header preflight pass, 335 local links resolve and diff whitespace is clean. Actual Linux raw passive evidence is still pending; no live provider, operator environment or model download was used.
- Actual Linux baseline `40158959465` passes at source `00e7d16`, scanned merge `9c8d6843a0610b04c910f93b07afe00f392d3a1e`. Independently inspected/rechecked raw JSON: zero high/medium findings; the CSS, external-font SRI and charset types are absent. Six public source-comment instances and three grouping-cookie responses remain informational. All seven required routes occur in fifteen visited paths; all sixty passive rules remain enabled and the queue is empty. Actual startup records a literal loopback listener. Retained sanitized source/image/lock/report identities, not cookies or raw response bodies. npm audit is zero, SBOM 128; no scanner rule/path is suppressed.
- Re-reviewed ASVS records at the exact implementation source and added the pinned font inventory to the still-open component-advisory requirement. Counts remain 28 scoped verifications, 30 justified absences, ten deviations and two open; stronger CSS and a clean passive result do not resolve deployment/model/claim/advisory limits. Source CI also passes unit/audit, CodeQL, Gitleaks and actual image/browser/restart tests; the full browser suite remains pending at this recording.
- Final evidence/document checks pass lint/JSDoc/ASVS and seven checklist regression groups; 592 local links resolve across seventeen changed documents and diff whitespace is clean. No runtime change follows source `00e7d16`; the raw scan remains bound to that exact implementation rather than a future release commit.

### Deviations

- Full upstream variable TTF files replace browser-specific remote subsets, adding 790,040 font bytes plus licences/metadata to the public offline bundle. Typeface families remain the same; device rasterization/fallbacks can differ. No external stylesheet remains to require SRI.
- Trusted build HTML can authorize its own active CSS/scripts. This remains an operator-owned-file boundary, not user-HTML sanitization or arbitrary CSS isolation. Existing local HTTP/account, mutable-model and unrestricted-prose limitations stay open.

### Insights

- CSS hashes preserve the self-contained artifact document without granting arbitrary style attributes. Actual browser tests must verify both refusal and the trusted runtime geometry that the board needs.
- Bundling the existing typefaces removes an external stylesheet/privacy boundary while preserving typography offline; explicit byte/licence provenance makes that trade-off reviewable.

## 2026-10-25 — User guide, provider setup and native Ollama operation

TODO item: 12.4, completing the parent documentation milestone after the existing flipbook refresh.

### Implementation notes

- Added a task-oriented user guide covering a mock-first start, interface/profile/notation, play and live-help boundaries, analysis/chat, review and independent practice, repertoires, source search, library ownership, backups/data controls and offline recovery. Linked the illustrated flipbook, Primer and retrieval/literature comparisons alongside detailed existing evidence notes.
- Added provider setup for Claude, OpenAI, Mistral, Ollama, browser and mock; task-specific models, endpoint ownership, separate coach/embedding grants, explicit connection-test costs and accounting limits. Verified primary provider documentation rather than assuming account access, billing or model capability from configured names. The OpenAI section retains the configured Luna model and documents its supported Chat Completions mode.
- Documented native same-machine Ollama with its own cloud mode disabled, exact installed local tags, preserved loopback, no unnecessary browser CORS change and a separate `--offline` Node invocation. Explain that app local-only routing, Ollama remote/model configuration, page offline mode and PWA/model caches have separate effects. The Docker loopback distinction links to this path without adding a network exposure recipe.
- Linked both guides from root/developer READMEs and the container guide. Corrected stale README claims that repertoire drills were only planned and that local-only routing allowed only Ollama.
- Validation: lint/JSDoc/ASVS records and build pass; 195 local link targets resolve and diff whitespace is clean. Actual isolated CLI smoke checks pass for the documented mock start and synthetic Ollama/offline configuration, including public/status responses, absent remote font allowances in offline mode and mode-0600 usage files. No inference request is sent. This prose-only change leaves the parent's tested runtime unchanged (670 unit/server passes, one opt-in live skip and eighteen targeted browser passes); those suites are not claimed as newly rerun for the guide.

### Deviations

- This documentation change neither obtains keys nor runs paid/provider/model-download commands. Setup examples are not new live availability, model-performance or chess-quality evidence. Existing provider-fixture/evaluation, human-calibration and release-gate gaps remain open.
- No hosted accounts, LAN service, automatic JSON restore, model download choice or image publication is introduced. Existing browser exports and server cookie scopes retain their documented limits.

### Insights

- A beginner needs a task path across the feature-specific documents. Keeping the operational instructions separate makes privacy/resource choices visible before a connection test or model load.
- Provider labels, configured model names and successful small replies establish different facts. None alone demonstrates local computation, full tool support or explanation correctness.

## 2026-10-25 — GPT-6 Luna Chat Completions tool mode

TODO item: 2.10.1. Provider setup documentation remains a separate milestone.

### Implementation notes

- The OpenAI adapter sends `reasoning_effort: none` for the exact selected `gpt-6-luna` model, following its official Chat Completions function-calling requirement. Per-task overrides control the setting. Ordinary chat, native structured output, tool-result continuations and the small connection-test reply use the same supported mode. Other OpenAI model IDs, Mistral and Ollama receive no new parameter.
- Three real-SDK tests intercept all transport and cover the rejection policy, per-task/provider matrix, structured response and continuation fields. Two browser regressions launch the actual CLI/SDK with a synthetic endpoint and no operator configuration; one completes a real Stockfish tool round and verifies its evidence, the other checks the settings connection button.
- Validation: lint/JSDoc/ASVS, build and the full unit/server suite pass (670 passes, one opt-in live skip). Both new browser cases and all sixteen existing tool cases pass. The Stockfish browser regression fails against the previous backend with a provider rejection under the synthetic policy, then passes with this correction. No dependency, actual environment file, live provider, paid request or model download is used.

### Deviations

- The provider policy is synthetic and based on the documented contract. This is not a recorded live OpenAI rejection/success, availability check, or benchmark of explanation quality. TODO 2.15 and the missing live-provider comparison evidence remain open.
- The correction retains the configured model and Chat Completions transport. It does not add a general reasoning setting or infer compatible model aliases.

### Insights

- A model default can conflict with a tool protocol even when a plain reply works. Connection checks and follow-up turns need the same model-specific transport policy, and the actual per-task selection must take precedence over the configured chat default.

## 2026-10-25 — Verified local container package and private persistence

TODO item: 12.2 complete for packaging. Image publication, advisory clearance and the actual release gate remain separate.

### Implementation notes

- Added a multi-stage Dockerfile pinned to the independently hashed official Node 24 Bookworm-slim manifest. Build and production dependency stages use the existing npm lockfile with install scripts disabled; the non-root runtime includes the built client/WASM, production dependencies, shared modules and licence notices. Default mock AI and explicit empty env-file selection avoid incidental real inference. No image is published.
- Added a deny-by-default build context and a Compose recipe with explicit loopback publishing, Docker init, read-only root, tmpfs, dropped capabilities and no new privileges. A mode-0700 named volume holds usage/library SQLite outside the static tree. The static-manifest health check uses no provider or grouping cookie. Docker 28+ is documented for the selected loopback mapping behavior.
- Added an explicit read-token Linux container workflow: Compose validation with `/dev/null` env selection, a synthetic excluded env-file sentinel, actual image build, browser install and three actual container tests. Cases cover UID/private-file/dev-dependency/metadata/header boundaries, real Stockfish and mock coaching, and library/usage persistence plus independent cookie scopes across restart. Cleanup is limited to uniquely named test resources and reports real failures. Image identity/revision and Debian component inventory are retained for thirty days, failure traces for seven days.
- Local preparation passes lint/JSDoc/ASVS, build and complete unit/server tests (667 passes, one opt-in live skip); all three container test definitions load, 45 local links resolve and diff whitespace is clean. No Docker execution is claimed locally: the daemon availability probe was unavailable earlier. Actual image verification will run in the draft PR before completion. No operator environment file, private data, real provider or model download is used.
- The first actual Linux build succeeds, and process/private-file/header boundaries plus the real Stockfish/mock-coach browser case pass. The restart case cannot reconnect using its original ephemeral host port. It now re-reads and validates Docker's loopback mapping after restart, preserving the same cookie contexts, and attaches container state/logs on future failures. The fixed-port Compose recipe and all persistence/isolation assertions remain; actual final verification is still pending.
- Actual corrected run `40156389739` passes all three cases (16.2 seconds), including real packaged Stockfish/mock UI, non-root/private-file/dev-dependency/label/header boundaries, same-cookie library and usage recovery, independent cookie isolation and healthy static serving after restart. Source `f9ce54a` builds scanned merge `56f297c3d8dd0c28c11e92105c7a0c6799bc5cf5`; recorded image `sha256:b8f599b9614aefea5dae1e953e82755fc9fdc7e6ad77ae0dc42c997ee7ea3adc` and 88-entry OS inventory digest in sanitized evidence metadata. No operator configuration, private user library, real provider or model is used, and no image is pushed.
- Re-reviewed ASVS metadata at the exact implementation revision. Packaged Git exclusion has actual process evidence while the native checkout remains a deviation. Remaining deployment/TLS/advisory dispositions now reference the still-open release gate rather than imply that completed automation/packaging satisfies those controls. Overall dispositions stay 28 scoped verifications, 30 justified absences, 10 deviations and two open. Regenerated readable evidence and rechecked its structural/document tests.
- Final documentation/evidence validation passes lint/JSDoc/ASVS and all seven checklist regression groups; 261 local links resolve and diff whitespace is clean. Source `f9ce54a` also passes CI unit/audit, CodeQL, Gitleaks and the actual ZAP baseline; the full browser suite is still pending at this recording. Packaging is ready for review, not automatically merged.

### Deviations

- Packaging has no image registry login/push, tag/release publication, hosted authentication, TLS/HSTS or model weights. Other architectures and image advisory coverage need separate evidence. A package inventory alone is not vulnerability clearance or release approval.
- The online page still follows its existing Google Fonts privacy behavior and the asset findings in 11.5.1 remain open. The packaged process excludes Git metadata, while native checkout access remains an ASVS deviation; no global compliance claim is made.

### Insights

- Container bind and host publish addresses serve different boundaries: the bridge needs a reachable container interface while the supplied host mapping remains loopback.
- A named private volume and browser cookie scope must both survive a restart to preserve the intended local collection. Functional persistence, file permissions and independent-client isolation need actual image tests, not Dockerfile assertions alone.

## 2026-10-25 — Semantic versioning policy and unreleased changelog

TODO item: 12.1. Packaging, remaining guides and the actual release gate remain separate.

### Implementation notes

- Added a root user-facing changelog with a clearly Unreleased development baseline, grouped capabilities/fixes and compatibility/quality/security limits. It links detailed DONE history and the current flipbook without inventing a past release date or tag.
- Added a SemVer 2.0 policy with documented compatibility surfaces, deliberate 0.x minor/patch choices, candidate identifiers, independent stored-schema/model/cache revisions, migration/backups, aligned package/lock versions and immutable release tags. The release procedure requires an exact merged commit, reviewed release PR, tests/security evidence and explicit authorization before tagging/publishing.
- Confirmed the existing private package and both lockfile root version fields agree on `0.1.0`; no metadata bump, tag or release is created by this documentation change. README links the changelog and policy.
- Validation: lint/JSDoc, offline ASVS checks, build and complete unit/server suite pass (666 passes, one opt-in live skip during preparation). After merging the completed scan prerequisite, the code/tests/workflows match its verified tree exactly (667 passes, one opt-in live skip); repeated lint/JSDoc/ASVS and seven document-checker tests pass. All 43 local links resolve and package/lock metadata stays aligned. This reversible documentation/process change adds no logic, dependency or UI behavior. No live provider, model download or operator environment read.

### Deviations

- There is no evidence of a historical tagged release, so the changelog starts with Unreleased rather than retrospectively assigning a release. The first real candidate version/date is decided in its release PR.
- This completes versioning/changelog setup, not TODO 11.6 release approval or the packaging/user-guide milestones. Existing ASVS and LLM verification limits remain visible; feature PRs do not authorize automatic merges or releases.

### Insights

- Application versions, persisted schemas, model identity and offline caches have different compatibility boundaries. A SemVer bump cannot substitute for a data migration or source-revision check.
- A changelog explains effects and limits for users; the implementation log and exact CI artifacts provide the separate reviewer evidence.

## 2026-10-25 — Verified automated security baseline and retained findings

TODO item: 11.5 complete for automation/evidence. Web asset follow-up 11.5.1, component advisory-age review and release gates remain open.

### Implementation notes

- Added weekly bounded Dependabot npm/Actions version-PR configuration, with cooldown and no automatic merge. Existing npm audit, CodeQL security-extended and Gitleaks checks remain. Repository metadata shows native GitHub advisory/security-update/secret/push features disabled; this PR does not claim or change those settings.
- Added a read-token PR/main/weekly/manual workflow and isolated staging runner. It launches a fresh actual CLI with empty env-file selection, explicit mock-only environment, memory library and ephemeral loopback port; no target option, operator server/configuration/provider credentials/model or private library is used. CSP/header rules check seven read-only paths. The ZAP hook seeds those paths, records enabled rules/completed passive queue and never suppresses findings.
- Pinned the official ZAP 2.17.0 multi-platform image by independently verified registry manifest SHA-256; disabled add-on updates and active/Ajax scanning. Bounded scanner/child lifetimes, own-container cleanup, stale-output deletion, exact version/origin/coverage validation and a high-alert gate prevent silent clean results after scanner failures. JSON/HTML evidence, SBOM and full npm advisory results are retained on success/failure for thirty days.
- Local validation: lint/JSDoc/build and complete unit/server suite pass (666 passes, one opt-in live skip), including six new negative/policy/deadline groups. Actual headers-only staging passes seven routes. Hook syntax compiles. npm audit reports zero findings and lockfile CycloneDX inventory has 128 components. Actual ZAP execution awaits Linux CI: the local Docker availability probe stalled and was stopped. No local baseline success is claimed.
- The first actual CI run fails before scanner startup because the runner UID cannot write the image's default `zap.out` location. The incomplete summary and failure artifacts are retained. Corrected the container working directory to its own writable report mount, retain startup logs, bind ZAP/API to loopback and avoid redundant removal of an already auto-removed container. Actual baseline verification is still required after this correction.
- The second bounded attempt exposes the browser helper's unwritable `/home/zap` cache under the host UID. Restore the pinned image's built-in UID 1000 with the runner's primary group, mode-0770 synthetic report directory and group-writable umask. This preserves its expected home and lets CI read/clean evidence without root or world-writable artifacts. No rule, alert or failure gate is removed; actual baseline verification remains pending.
- Verified network add-on 0.31.0 takes the first `-host` option, so the appended override was ineffective. The startup hook now replaces the pinned factory's initial wildcard value, aborts on unexpected/duplicate host arguments and preserves other options. Added four Python tests for that policy, fixed read-only seeds, rejected targets and the real `core.urls()` method interface. This changes startup/coverage plumbing only, not passive rules or alert dispositions.
- Retained the superseded user-correction run's actual diagnostics: ZAP started but its wildcard listener accepted IPv6 loopback, rejected by the IPv4 allowlist. The next run confirms a literal `127.0.0.1` listener but the same list also checks API Host headers and rejects the Python client's virtual name `zap`. The hook now allows exactly those two values and refuses drift/duplicate policy arguments; a fifth Python test verifies allowed values and unrelated-host rejection. Actual baseline verification remains pending; no failed attempt is counted as a clean scan.
- User merges through #115 are incorporated without rewriting history. Main CodeQL revision `71a863d` has no open high findings and three open medium alerts (20, 21, 23), none manually dismissed. HTTP hardening PR #117 subsequently passed all CI, including full Playwright.
- Actual verification subsequently passes in run `40151516551` at source `45ff4b9`, scanned merge `45df8e87bef8c2cf1ef6437d1d91007d579c7182`, Node 24.21.0. Independently inspected raw JSON/coverage/startup artifacts: all seven required routes, sixteen URLs/fifteen paths, sixty enabled passive rules, empty passive queue and literal IPv4-loopback listener. Zero high findings; two medium types (inline CSS policy and external font stylesheet SRI) and three informational types (charset alias spelling, public authored comments and grouping-cookie identification). The full findings remain retained; 11.5.1 tracks actionable web-asset work. Stored only sanitized metadata/digests in Git, with no cookies or raw bodies. npm audit is zero and SBOM has 128 components.
- Offline inspection exposed that stdin imports tried to realpath the `-` argv marker. Both pure checker helpers now tolerate stdin/REPL imports; a new child-process regression exercises both without starting a server/scanner. Final lint/JSDoc/build and complete settled-build unit/server verification pass (667 passes, one opt-in live skip), including seven Node policy/negative/deadline/import groups; all five Python launcher/seeding/API tests pass too. All 180 local documentation links resolve and diff whitespace is clean. The separate high-risk check evaluates the raw report, preserving the official baseline's built-in internal/example exclusions without adding custom rule/path suppressions.
- Reconciled PR #118 with `origin/main` through #117, retaining the guarded `isMain()` entrypoint. A dedicated checker regression verifies stdin and eval imports produce no CLI side effects; all eight checker groups and lint/JSDoc/ASVS pass. This resolves the reported merge choice without changing application or scan policy.

### Deviations

- A headers-only run is partial evidence. The actual baseline passes with retained medium/informational findings; it is not a clean-vulnerability claim. The passive spider does not exercise every JavaScript flow or arbitrary model/import behavior. No runtime/UI feature changed and no new npm dependency was introduced.
- SBOM/npm audit does not establish full component advisory-age compliance, hosted/native security feature enablement, ASVS compliance or release approval. Existing local deployment and LLM identity/prose limits remain open.

### Insights

- Default ZAP WARN status is not a risk threshold. Validate every alert's risk independently and require positive route/rule/completion evidence rather than accepting an empty or stale report.
- Pinning the container is insufficient if the baseline updates its add-ons at startup. The versioned source's silent mode preserves the chosen image rule set for reviewed upgrades.

## 2026-10-25 — Native-Origin checks and explicit SVG encoding

TODO item: 11.4.1. Remaining ASVS deployment deviations, TLS/inventory verification and release gates stay open.

### Implementation notes

- AI POST routes now compare the parsed HTTP(S) Origin with the native socket scheme and Host, rejecting wrong schemes and blob/FTP/null/malformed Origins. Forwarded and X-Forwarded-Proto cannot change the comparison. Same-origin browser calls and trusted direct local clients without Origin retain their behavior. The library already had a native full-origin check.
- Static SVG GET/HEAD responses now declare `image/svg+xml; charset=utf-8`; binary media types and nosniff remain. The actual browser document reports SVG/UTF-8.
- Two new server tests cover real HTTP and certificate-validated HTTPS across all five AI write routes, invalid Origins, spoofed forwarding metadata, same-origin acceptance and direct clients. Three new actual-CLI/browser cases verify scheme rejection, normal browser/direct-client/preflight behavior and SVG GET/HEAD/rendering; both existing HTTP/TLS browser cases now exercise automatic browser POST Origins too.
- Validation: lint/JSDoc, build and the full unit/server suite pass (660 passes, one opt-in live skip), followed sequentially by all five focused browser cases on the same settled build. The two regressions fail on actual prior `5407d8a` source/build: a synthetic HTTPS Origin over HTTP receives 200 and SVG lacks charset. No live provider, model download or operator environment file is used. Re-reviewed the two ASVS entries at exact implementation revision `57b7cc1`, regenerated the table (28 scoped verifications, 30 justified absences, 10 deviations, 2 open) and retained the original review's historical counts.

### Deviations

- Synthetic API-client Origins prove consistent server policy; they do not prove a browser CSRF exploit existed. JSON/non-safelisted headers and lack of CORS approval already provided a separate defense.
- This does not add a trusted reverse proxy, CLI TLS mode, cookie-name migration, HSTS, hosted authentication or release approval. Local HTTP and the other ASVS deviations remain explicit.

### Insights

- Scheme is part of an origin. A matching host cannot substitute for it, and client forwarding metadata cannot describe the native transport reliably.
- Header assertions on actual GET/HEAD responses and an SVG browser navigation verify the encoding boundary directly without treating a source constant as a sufficient test.

## 2026-10-25 — Versioned ASVS L1 review and offline evidence checks

TODO item: 11.4 (review/checklist complete, not compliance or release approval). Follow-up 11.4.1 and deployment/inventory deviations remain open.

### Implementation notes

- Selected stable OWASP ASVS 5.0.0 L1 for the confirmed local single-user scope. Recorded all seventy L1 IDs individually in machine-readable JSON and a generated, source-linked table: 26 verified within the stated scope, 30 individually justified not-applicable, 10 deviations and 4 open. Pinned the official CSV URL/SHA-256 and reviewed application revision; all IDs independently compared with its L=1 rows. The source has 345 requirements across all levels; V16/V17 have no L1 entries. Linked the standard's CC BY-SA 4.0 attribution without copying its normative text.
- Added documented validation rules and risk-based third-party remediation/update targets. A full dated component/advisory inventory is still required; a passing npm audit is not presented as proof that all targets are satisfied. Cookie grouping is not authenticated session management, and opaque library isolation is not hosted person authentication.
- Added an offline Node coverage/evidence/document checker and CI command. Seven negative/CLI test groups cover missing/duplicate/wrong-level IDs, source/version/scope drift, invalid methods/statuses/notes/follow-ups, missing or inappropriate evidence, traversal/secret paths and an existing-file symlink escape, literal Markdown rendering, document drift and explicit regeneration. The checker does not execute evidence tests, inspect live infrastructure or certify the assessment's truth.
- Validation: lint/JSDoc, build and the complete unit/server suite pass (658 passes, one opt-in live skip), including all seven new groups. All 237 local links in the new guides/table resolve. No application runtime or page UI changes, no new dependency, no live provider call, model download or operator environment read. PR #115 independently finished all CI checks, including its complete browser suite.

### Deviations

- Actual mock loopback probes accept synthetic same-host HTTP, HTTPS and FTP Origin values on the AI connection-test route because it compares host only. This is policy inconsistency, not a demonstrated browser CSRF exploit: JSON/preflight and absent CORS approval remain separate defenses. SVG responses lack explicit charset. Both are tracked in the next HTTP hardening item, with actual-server/browser regressions required.
- Local HTTP, secure cookie names/HSTS, backend grouping-token revocation, authenticated function permissions, persistent client data, deliberate FEN navigation and checkout Git-metadata access remain visible deviations. Native TLS Secure-cookie tests do not satisfy all cookie requirements. Do not silently rename existing library cookies or set localhost-wide HSTS.
- Deployed TLS versions/certificates and complete component/advisory age evidence are not independently attested. Release security gates, unrestricted chess-prose verification and mutable model identity remain open. Review completion does not accept these risks for the owner.

### Insights

- Structural completeness can be checked offline without claiming security compliance. Keeping dispositions and source-qualified IDs separate prevents a well-formed checklist from becoming an all-clear badge.
- Denying HTTP access to `.git` satisfies only half of the metadata requirement when the application process can still read its checkout. Packaging must address the process boundary too.

## 2026-10-25 — Independent provider operation deadlines and response bounds

TODO item: 11.3.10.1; completes the reviewed local resource controls in 11.3.10. Parent 11.3 remains open for model identity and unrestricted claim verification.

### Implementation notes

- Added per-call `provider-limits.mjs` scopes for gateway-created chat/embedding SDK clients. One independent clock covers headers, streamed/error bodies, SDK iteration/parsing and decoded results: configured positive timeout rounded up, default sixty seconds and maximum fifteen minutes. Monotonic checks reject late results even when synchronous work delays timer delivery. Each operation owns its controller/readers/counters, closes on completion/failure/return and propagates caller abort without aborting the caller's controller.
- Count HTTP body bytes after decompression, including SSE overhead, invisible fields, tool arguments and error bodies, against an 8 MiB cumulative cap. Decoded coaching text plus result/tool metadata has a smaller 128 KiB cap before emission to the browser; embedding JSON retains an 8 MiB allowance. Ollama model inspection and vector retrieval share clock/body limits, preserving refusal before text upload when metadata is unverified. Injected SDK clients still receive independent decoded/time bounds.
- Construct SDK clients per operation, disable automatic SDK retries/backoff and explicitly silence vendor loggers, including inherited debug settings. Existing native/JSON, tool-round and Anthropic server-side refusal fallbacks retain separate bounded calls. Timeout/overflow stop structured work without triggering a format retry. Added fixed `response_too_large` logging/UI mapping and German messages, including the connection-test failure prefix. Connection tests now propagate browser disconnects through their request signal.
- Validation: lint/JSDoc/build pass. The final full unit/server scope passes with bounded concurrency (651 passes, one opt-in live skip), followed sequentially by twelve passing focused CLI/browser cases against the same settled build. Twenty-one new unit/server cases cover raw/decoded limits, UTF-8 counts, stalls, cancellation/late headers, EOF/faults, synchronous-deadline checks, injected SDKs, all four production SDKs over actual loopback HTTP, structured/embedding/metadata paths, concurrent calls and actual gateway disconnect cleanup. Eight new CLI/browser cases cover headers/partial-body stalls, invisible/error/tool/text overflow, German coach/connection-test hints, failed-work accounting and private diagnostics even with SDK debug configured; existing rejection and restart-usage cases pass too. The body-stall browser regression fails on actual prior `3c0bf82` server code: the answer never receives its timeout state within three seconds. No external provider, operator `.env`, model download or paid inference is used.
- Updated environment example, source map, usage/operations guidance, LLM evidence, threat model and TODO. Documentation explicitly separates per-call bounds from token/billing/concurrency reservations and preserves the historical reproduced missing-deadline evidence. Local links and diff whitespace checked; no new dependency.

### Deviations

- Gateway-created SDK clients no longer retry transient errors automatically; callers see a failure sooner and can deliberately retry. Format/tool/server-side fallbacks can still add calls and total time. Already accepted provider work may continue or be billed after abort, and incomplete usage can remain unreported. These controls are not hard financial caps.
- JavaScript cannot preempt a synchronous parser mid-instruction; bytes bound its input, and the deadline is checked before accepting its result. The SDK's own JSON timer can win the race, so tests verify the stable mapped timeout rather than require one internal error class. The settled full verification was repeated after an earlier build/test overlap; final source/build checks have no intervening rebuild.

### Insights

- Limiting only visible text misses oversized SSE framing, tool arguments and error bodies. Limiting only wire bytes can still admit a very large paragraph into browser rendering; the decoded coaching cap addresses that separate boundary.
- A caller's abort signal and a provider operation's lifetime are related but distinct. Per-call state avoids cancellation/counter interference between concurrent requests and keeps late results from escaping cleanup.
- SDK request/header timeouts do not establish a total streamed-body deadline. Actual loopback and old-server regressions distinguish that failure from a synthetic timer-only assertion.

## 2026-10-25 — Keep provider rejection prose out of public errors

TODO item: 11.3.2.1; completes the reviewed local controls in 11.3.2. Parent 11.3 remains open for model identity, unrestricted misinformation and runtime-stream consumption.

### Implementation notes

- Replaced key-prefix redaction/truncation of HTTP 400 provider messages with a closed set of public hints for tool/chat/JSON-format/schema/context failures and a generic rejection. Classification reads at most 8192 input characters and never emits a substring of provider prose. Unknown or empty 400 messages now consistently use `provider_rejected` with fixed guidance; other status/error mappings are preserved.
- Reuse the existing pure tool-support classifier on the server, so a fixed explicit unsupported-tools hint still triggers the intended context-only fallback/capability cache. Invalid schemas, parameters and generic refusals cannot disable tools through an incidental word. Six new German dictionary entries translate the fixed messages. Updated operations, threat model and LLM review dispositions while preserving the original reproduced finding as historical evidence.
- Four new real-SDK/gateway cases cover every adapter and sample/structured/connection-test/embedding paths with reflected non-prefixed dummy credentials, private URLs, user/account markers and controls. Unknown/tool/schema variants retain useful capability behavior without reflecting any private marker into responses or category-only logs. Successful request/context separation remains covered separately. Existing native/fallback structured behavior and failed-call accounting are preserved.
- Validation: lint/JSDoc/build and the complete unit/server suite pass (630 passes, one opt-in live skip) with bounded concurrency, including the final translation dictionary. All sixteen existing tool browser cases pass, as do three new actual-CLI/browser cases for private errors, tool fallback/cache and German hints; the final four selected cases pass after translation/fixture adjustments. The new credential browser regression fails against actual prior `e87364f` server code because the page contains the dummy configured credential. Every SDK fetch is intercepted; no live provider, operator `.env` or model load is involved. Local documentation targets and diff whitespace checked.

### Deviations

- Public rejection details are deliberately fixed hints. A provider's arbitrary diagnostic prose, model ID, URL or reflected user text is no longer forwarded for display; unknown cases ask the operator to check model/request settings. This does not filter arbitrary generated answers or certify upstream confidentiality. Existing retries/JSON fallbacks are unchanged and are not hard spending caps.
- The initial German fixture exposed an unrelated untranslated no-browser-model status. Its advertised browser-model metadata now matches the standard E2E server; no fake model is loaded. The final rejection text itself translates and the fixture reports no interface translation gaps.

### Insights

- Recognized key shapes cannot cover an opaque provider credential or unknown private field. Fixed diagnostic vocabulary removes that reflection channel without needing to know every secret value or encoding.
- Capability detection and public diagnostics can share one conservative policy while returning no provider-controlled text. This preserves the coach's tool fallback instead of treating every request error as lack of tool support.

## 2026-10-25 — LLM security evidence and reproduced open boundaries

TODO item: 11.3.11; implemented/tested local controls mapped for 11.3.1, 11.3.4–8. Parent 11.3 and categories 11.3.2/3/9/10 remain open.

### Implementation notes

- Added `OWASP-LLM.md`, mapping every explicitly planned 2025 category to actual code, adversarial tests, deployment assumptions and remaining limits. Primary OWASP category pages are linked individually. The project repository publishes a 2026 edition; a numbering crosswalk and hidden-context note preserve the planned 2025 IDs without claiming full 2026 certification. Updated TODO and the threat model accordingly.
- Added four gateway/real-SDK tests, one per adapter, with every provider fetch intercepted. Disclosure questions do not add configured server credentials to successful model-context/status/response/log paths; invalid system-role messages are rejected before work, a forged system field cannot override policy, and authentication remains in transport headers. These test application separation rather than pretend a mock model proved prompt secrecy or injection resistance. Clarified the quoting helper's comment: data framing is not a model-behavior guarantee.
- Reproduced three limits without paid inference or operator `.env`: a synthetic 400 through the real SDK reflects a dummy non-prefixed credential into `provider_rejected`; a false three-kings/immune-queen sentence returns zero recognized problems; an actual loopback HTTP stream remains pending at 350 ms with a 100 ms SDK timeout after sending a first chunk. Both stream probes explicitly abort/close their resources. Added actionable follow-ups 11.3.2.1 and 11.3.10.1 rather than closing those categories.
- Validation: lint/JSDoc/build and the complete unit/server scope pass with bounded concurrency (626 passes, one opt-in live skip), including all four new tests. Twenty-eight focused browser cases pass for hostile board output, imported-PGN injection framing, bounded tools, live-game confirmation, consent/revocation, dense/citation scope and stale work, and persistent usage after restart. Existing tests provide additional category evidence, without an exhaustive live-model adversarial evaluation. Local documentation targets and diff whitespace checked. No production runtime behavior changed.
- Recorded the previous recorder PR's actual post-correction CodeQL evidence: source `f8ccd10` yields alert 24 fixed on merge snapshot `9df2f7b`, with the gate passing. Medium capture/cookie findings and historical main-branch triage remain open; no query/test was excluded and no alert state manually changed.

### Deviations

- Review completion does not complete parent 11.3. Existing annotation, tool, vector and usage work made several old TODO notes stale, but configured-credential error leakage, mutable model identity, unrestricted prose and runtime-stream consumption gaps remain explicit. The next fix is the reproduced rejection leak, followed by independent stream bounds.
- No model identity, source digest, legal line, matching citation or regex cue count certifies semantic correctness. Provider-side training/retention, operator filesystem ownership and hosted authentication remain separate trust decisions.

### Insights

- Credential separation on successful model requests does not imply safe provider-error reflection. Prefix redaction misses credentials without that syntax.
- A provider timeout can stop connection/header work while a partially delivered body remains open. A total runtime deadline and response cap need their own implementation and regressions.
- A zero recognized-error count is compatible with entirely false prose. The original “every chess claim” requirement cannot be marked complete from the existing checker or mock tests.

## 2026-10-25 — Bound and privately stage provider fixture recording

TODO item: 11.2.8; capture context 9 under [#99](https://github.com/gregoryyy/kibitz/issues/99). Real missing-provider recordings (2.15) remain open.

### Implementation notes

- Split operator CLI planning from capture/publication logic. Explicit unique provider names and every selected configuration are validated before execution; local-only settings cannot silently substitute another provider. `--plan` and missing `--yes` make no requests or output writes, including for Ollama. `--env=` now skips file loading, and direct entry works through macOS temporary-directory aliases.
- Limit each case to one HTTP attempt, with no redirects, SDK retries, tools, embeddings, JSON fallback or server-side refusal fallback. Added an adapter option for the recorder to disable the latter while retaining existing coaching defaults. Fixed chat/JSON output limits are 400/1500 tokens. A one MiB response cap and total header/body/SDK deadline (configured, capped at five minutes) precede publication.
- Accept only HTTP 200 event streams with valid UTF-8, explicit protocol termination, nonempty nontruncated completion, no tool calls and valid annotation schema for JSON. Error bodies are canceled. Refuse known configured credentials/common encodings in metadata/raw data/decoded text, including split SSE fragments. Explicit no-op SDK loggers prevent inherited debug settings from exposing transport/config/error text; CLI diagnostics use fixed categories.
- Default captures to git-ignored `.kibitz-data/ai-fixtures/`, with private directory/file modes and fixed allowlisted filenames. Exclusive same-directory temporary files are atomically renamed over accepted destinations, replacing a symlink entry without opening its target. Handled failures clean partials and retain earlier destinations. Output selection resolves existing aliases and rejects protected repository/served destinations; operator-owned parents remain trusted. Added a capture/review guide and updated README/source-map/OWASP evidence.
- Validation: build, lint and JSDoc checks pass. The full unit/server scope passes with `node --test --test-concurrency=2` (622 passes, one opt-in live skip). Seven new unit cases cover all four real SDK adapters, exact wire preservation, request/token bounds, stream/HTTP/schema/credential failures, deadlines/cancellation and atomic publication/cleanup. Four real-CLI Playwright cases plus both actual HTTP/TLS browser cases pass. The no-confirmation regression fails on the actual prior `6d37f45` recorder in a disposable copy: it makes two synthetic requests and publishes without `--yes`. All fetches are intercepted; no operator environment file, paid provider or model download is used. Existing real/hand-written fixtures and the published flipbook remain unchanged.
- PR scan follow-up on `645a286`: CodeQL's high alert 24 flags the new test's lstat/read/stat-by-path assertion sequence. The test now opens first with no-follow where supported and checks bytes/permissions through that same descriptor, retaining the target-preservation regression. No test/source exclusion or alert dismissal is used. Medium cookie context 23 is a duplicate of the documented local-HTTP/native-TLS context 4; intentional flipbook data-capture contexts 20/21 also remain open. The initial gate was red; runtime test passes were not a scanner all-clear.

### Deviations

- Capture no longer overwrites tracked fixtures by default. Operators review staged responses for private fields before deliberately copying accepted wire data into the repository. An error stops subsequent cases/providers; earlier successful files remain because publication is per file. Abrupt termination can leave a private partial for operator cleanup.
- This remediates actual recorder defects and reviews the intended network-to-JSON data flow; it does not manually dismiss or suppress CodeQL context 9. Unknown secrets/encodings, provider semantics and operator-controlled filesystem writers are outside the automatic checks. Main-branch scans, other #99 findings and release approval remain open.

### Insights

- A network-to-file alert can point to intended test-data capture and still reveal real implementation defects. Fixed filenames alone do not protect an existing symlink target or prevent a reflected error response from replacing a useful fixture.
- SDK `logger: null` falls back to console in both installed SDKs. Explicit sinks are needed to keep operator-inherited debug settings out of a capture command's diagnostics.

## 2026-10-25 — HTML-aware CSP script selection

TODO item: 11.2.7; contexts 2/3/5 under [#99](https://github.com/gregoryyy/kibitz/issues/99).

### Implementation notes

- Replaced regex script extraction with pinned server-side parse5 8.0.1 and its lockfile-pinned entities 8.1.0 decoder. The respective MIT/BSD-2-Clause licences are recorded in third-party notices; no existing package versions changed and no parser code is bundled into the browser. The dependency earns its place by handling HTML tag/attribute states, namespaces, inert content and text normalization rather than growing a partial sanitizer/lexer.
- Walk parsed HTML/SVG script nodes iteratively; exact src/href attributes exclude external bodies. Comments, raw-text elements, templates/noscript, non-script data blocks and unfinished tags do not grant hashes. Script type selection retains JavaScript MIME essences, module/import-map/speculation-rule keywords and legacy language behavior. Script text uses browser parsing normalization, and a set deduplicates identical hashes. Existing policy directives remain intact. Parser-dependent imports stay inside the CLI startup handler, with a fixed npm-ci hint for missing modules.
- Strengthened intentional unit-fixture checks to exact literal excerpt/CSP-directive values. Their earlier regexes were assertions, not production HTML filters or host validation. Deployment/threat/OWASP notes explicitly state the trusted-input boundary: `cspFor()` authorizes supplied inline code and cannot sanitize model/user HTML.
- Validation: seventeen focused static/hybrid unit cases and four real-CLI browser cases pass, including quoted angles, data-src, closing-tag whitespace, normalized CRLF/SVG text, inert-source injection blocking, artifact module/isolation and a bounded missing-dependency error. Both browser regressions also fail on prior `deddbd6` code: valid variants never set the expected state, and an injected script reusing inert source text actually executes. Lint/JSDoc/build pass; the complete unit/server scope passes with bounded concurrency (615 passes, one optional live skip), and all fifteen focused browser cases pass (four CSP, seven PWA, four app smoke). The locked dependency audit reports zero vulnerabilities. Policies for all four current built HTML pages are byte-for-byte unchanged. Checked 235 local documentation targets and diff whitespace. Mock/synthetic data only; no provider or model requests.

### Deviations

- Static serving now requires the installed parser dependency, including without the optional gateway. The CLI gives a bounded actionable startup error if it is missing. Operator-owned public files remain the trust boundary; parsing is not a sanitizer or a release approval.
- Incorporated the owner's latest merged main changes into the remaining PR chain without rewriting history, preserving the PDF exclusion and retrieval comparison. Other security/scanner/release items remain open.

### Insights

- A commented script example can accidentally receive an executable hash when extraction uses a tag regex. Parsing inert content prevents an attacker from reusing that hash for a later inline script, while actual allowed scripts retain their exact normalized text.
- Matching `data-src` as though it were `src`, or reading a quoted angle as the tag boundary, can also block valid authored scripts. Browser execution and policy-violation checks distinguish those functional defects from a generic scanner label.

## 2026-10-24 — Native TLS protection for newly issued usage cookies

TODO item: 11.2.6; cookie transport context 4 under [#99](https://github.com/gregoryyy/kibitz/issues/99).

### Implementation notes

- The AI gateway now adds `Secure` when issuing a cookie over a native encrypted socket, matching the existing library behavior. Cookie randomness, HttpOnly, SameSite=Strict, expiry, paths and valid-ID reuse are preserved. Untrusted Forwarded/X-Forwarded-Proto headers do not select transport policy.
- Added real HTTP/HTTPS mock gateway/library fixtures with an ephemeral self-signed certificate/key generated by the test host's OpenSSL. Temporary key files are private and removed with the fixture. Two unit cases check actual socket flags, separate cookie scopes, reuse and forged forwarding headers; browser cases check stored cookie flags after actual same-origin fetches. Node clients explicitly trust the generated certificate and retain chain/hostname validation; browser certificate exceptions are confined to the isolated context used for the self-signed fixture.
- Documented the selected loopback HTTP deployment, direct native-TLS handler behavior, existing-cookie reuse and clearing old cookies when deliberately changing transport/policy. The standalone CLI retains its local HTTP listener. Cookie flags do not add hosted authentication, proxy trust or authenticated quotas.
- Validation: lint/JSDoc/build and all 610 unit/server tests pass with one optional live-provider skip. Both actual-browser transport cases pass. The HTTPS browser regression fails on the prior `c0bc621` API because its stored usage cookie has `secure: false`. An additional final default-parallel run had 609 passes and one usage-CLI 20-second startup timeout; that fixture passes in isolation. The complete unchanged unit/server scope then passes with `node --test --test-concurrency=2` (610 passes, one live skip), as do both final browser cases. No test timeout, assertion or production concurrency setting was changed. Local links and diff whitespace checked. All providers are mock; no inference requests or live model downloads.

### Deviations

- Context 4 is handled according to the selected local deployment. Native TLS issuance is fixed; supported loopback HTTP intentionally remains clear-text transport. The historical scanner alert is not dismissed and broader #99/scanner/release gates remain open.

### Insights

- A forwarded scheme header describes a claim, while the native socket describes this connection. Using only the latter keeps cookie issuance consistent with the library's existing policy.
- Reusing a valid cookie preserves its original browser attributes; a policy/transport migration must clear old cookies rather than claim that a response silently upgraded them.

## 2026-10-24 — Validate and serve one open static/model file

TODO item: 11.2.5; file-serving contexts 7/8 under [#99](https://github.com/gregoryyy/kibitz/issues/99), which remains open for other contexts and main-branch scanner verification.

### Implementation notes

- Extracted `server/public-files.mjs` for both static assets and catalogued models. Canonical containment/alias policy, a regular-file entry, no-follow/nonblocking flags where available and descriptor type/identity checks precede serving. Metadata, HTML reads and streaming all use that same descriptor; model routes no longer follow a catalogue-named alias outside their directory.
- Symlinked assets/child directories are refused, including aliases inside the public tree. Explicit root aliases are resolved at startup. HEAD/empty responses, failed validation, read errors and client disconnects release handles. Streams stop at the captured length and abort on truncation; HTML CSP and content length derive from the actual descriptor-read body.
- Follow-up after CodeQL on `31af699`: removed the residual lstat-before-open step (new alert 22). The helper now opens first, checks descriptor type and then canonical path/entry identity before bytes. A ninth unit case refuses and closes a path replaced before identity validation; the post-validation rename test now mutates at the actual final validation boundary. The new scan on source `32758c9` marks high alert 22 fixed. Medium capture-data alerts 20/21 remain open with an explicit [sink/data review](OWASP-TOP10.md#pr-109-follow-up-review); the green CodeQL gate is not a zero-alert result. No alert state was manually changed. Both mock capture/plan CLI cases pass again, including the complete nineteen-step tour in a temporary directory; the paid published capture is unchanged.
- Added fixed `file_error` resource/code events without paths or raw exception prose. An HTML read fault before headers returns a generic 500; stream faults terminate the response while the listener stays healthy. Missing/denied assets remain 404 and intentional disconnects do not become file-fault events.
- Updated deployment/filesystem ownership, operations/log-field guidance, threat/OWASP dispositions and the source map. No-follow flags are additional protection where supported, with descriptor identity checks retained. Public-directory/parent writers, hard links and in-place mutations remain operator-trusted; serving does not lock files or rehash model weights.
- Validation: lint/JSDoc/build and all 608 unit/server tests pass with one optional live-provider skip after the open-first follow-up. Nine new filesystem/HTTP unit cases exercise symlink/FIFO swaps, renamed files, HTML/CSP/static/model identity, HEAD/empty bodies, injected open/read/stream failures, abort cleanup and append/truncate limits. Ten focused real-CLI cases pass (five new plus existing log/private-path protections). All five new CLI cases fail against the actual prior `23ede0f` server: the model alias returns 200, HTML replacement returns the complete synthetic private marker, static/model replacements return its prefix and the read fault resets the connection. A separate unchanged-old-worktree probe confirms the full model-alias response equals the synthetic private file. Seven PWA cases pass, including actual offline Stockfish play. The initial combined browser run had one afterEach provider-reset POST fail with ECONNRESET after routing assertions passed; an isolated fresh run of all three browser-model cases passes. This initial transport failure is retained in the validation record rather than counted as a passing run. Synthetic files and injected I/O only; no real weights or provider calls.

### Deviations

- The HTTP server now refuses internal asset aliases as well as escaping ones, matching the built offline bundle's regular-file policy. Operator-selected root aliases still work. The implementation is not a filesystem sandbox against an operator changing parent directories or content in place.
- File-serving bugs are fixed without dismissing historical CodeQL alerts. Other #99 contexts and LLM/ASVS/scanner/release gates remain open.

### Insights

- A catalogue filename alone does not keep bytes inside a model root. A deterministic old-server probe serves a synthetic private file through such a symlink.
- Checking a path and later reopening it lets two operations observe different files. Owning one validated descriptor also gives a clear lifetime to close on every response/error path; bounded streams prevent a late append from exceeding the advertised length.

## 2026-10-24 — Literal phrase interpolation and anchored opening families

TODO item: 11.2.4; source fixes for CodeQL contexts 16/17 under [#99](https://github.com/gregoryyy/kibitz/issues/99), which remains open for other findings and scanner verification.

### Implementation notes

- Grouped both Slav/Semi-Slav alternatives beneath the opening-name start anchor. A later `Semi-Slav` mention no longer overrides an earlier recognized Queen's Gambit family or creates a Slav family from unknown metadata. Positive canonical Slav names still match.
- Changed phrase interpolation to replace every star through a callback, preserving literal dollar sequences and stars inside the supplied value. Explicit-variable calls use the supplied value when no captured raw value exists; inherited object properties are not treated as supplied placeholders.
- Added unit regressions for names/features, repeated phrase slots, replacement-dollar sequences, markup-like values and explicit variables. Browser cases exercise actual opening-guide selection with synthetic catalogue metadata and the page's translation MutationObserver with a synthetic dictionary extension, verifying visible literal text and absence of inserted markup/execution. They isolate matching behavior without claiming the synthetic names are real chess classifications.
- Validation: lint/JSDoc/build pass; all 599 unit/server tests pass with one optional live-provider skip. Both new browser regressions pass, alongside the two existing language-switch/browser cases. The tests also fail against the preserved prior build for the intended defects. Local documentation links and diff whitespace checked. All providers remain fake/mock; no paid calls or model downloads.

### Deviations

- These changes fix two source bugs rather than resolving all of #99. Other scanner contexts, file races and post-merge main-branch scan evidence remain open. No alerts are dismissed and the release gate remains incomplete.

### Insights

- A replacement-string API interprets dollar sequences even when the surrounding pattern is a literal star. A callback inserts the value unchanged and does not recursively expand stars inside it.
- Phrase interpolation returns plain text. Fixing all slots addresses its semantics; it does not make the helper an HTML sanitizer or establish a cross-site scripting exploit in the original code.

## 2026-10-24 — Private runtime logs and local operator monitoring

TODO items: 12.3 and 11.2.3; finding [#98](https://github.com/gregoryyy/kibitz/issues/98).

### Implementation notes

- Added `server/logging.mjs` to construct JSON events exclusively from fixed vocabularies, numeric status/timing and booleans. Access events classify routes without retaining URLs, library IDs, IPs, cookies or bodies, and record completed/disconnected responses once. Unknown values cannot become arbitrary fields.
- Replaced provider/model/raw SDK error logging with bounded action/provider/code/status events for streaming, structured, connection-test and embedding requests. A late stream failure remains observable even when HTTP status is 200; accepted provider attribution survives settings changes. Configuration logs omit model IDs/reasons. Page-facing bounded provider reasons retain their existing behavior and are explicitly unsuitable for logging.
- Startup/listener diagnostics omit paths, arbitrary hostnames, models and exception prose/stacks, while retaining fixed hints/system codes and compatible readiness lines. Loopback reports its actual port. Malformed URLs are rejected before API routing can reject asynchronously with Node's raw URL input in a default stack.
- Added [operator monitoring and retention](OPERATIONS.md): no-inference liveness checks, error-event inspection, private redirected files and operator-owned rotation. Linked deployment/README guidance and updated threat/OWASP finding dispositions. The runtime neither stores logs nor introduces hosted dashboards or automatic paid probes.
- Validation: lint/JSDoc/build, 597 unit/server passes with one optional live skip, and fourteen focused Playwright passes (two logging CLI, three existing private-path CLI and nine browser privacy cases). Both new CLI cases also fail against the prior `8efbf90` server, reflecting a synthetic private path in logs. Six new unit/server cases cover fake SDK status 400/401/429/500 failures on all four AI routes, post-output failure, in-flight configuration changes, disconnects and hostile code/status fields. Only synthetic markers/fake SDKs are used; no live provider/model requests.

### Deviations

- Monitoring targets the selected local single-user deployment: operator status/event inspection, without an external service or user-identifying audit trail. No verbose payload mode was added. Runtime/OS warnings and operator capture utilities have separate output; static-file race/error paths remain under #99.
- Historical main-branch CodeQL alert 18 is not dismissed by a feature PR. It requires post-merge scan evidence; broader LLM/ASVS/scanner/release gates remain open.

### Insights

- Removing recognized keys from SDK prose does not remove personal data reflected by a provider. Closed-vocabulary fields avoid depending on an incomplete secret detector.
- A streamed HTTP 200 can carry a failed answer. Monitoring needs the bounded AI error event as well as the access status, while a cancelled request can be described without recording who made it.

## 2026-10-24 — Refresh the flipbook with current study flows and fresh coaching

TODO items: 12.4.1; broader 12.4 user/provider/Ollama documentation remains open.

### Implementation notes

- Replaced the eleven-page 2026-10-21 snapshot with [nineteen current screenshots](flipbook/README.md): Opera Game coaching/review, source search, named opening ideas, repertoire editing/recall, a rules-verified lesson, spaced practice and two German phone views. Captured the app at `ea94943`, incorporating the completed Chrome milestone `56fec42`; no screenshots were edited.
- After explicit approval, ran the nine-answer plan once with `claude-haiku-5-5` fixed for quick/chat/review. All nine answers and nineteen steps succeeded on 2026-10-24. No judge or embedding requests were made. Engine-tool follow-ups, format fallbacks and SDK retries can add provider requests; nine answers is not a request-count or billing cap.
- Added `run.json` with actual provider/task-model labels, capture version, viewport/PNG sizes, main-board FENs and prose/check observations. Prose capture excludes source/tool/interface cards. Recorded 141 recognized tokens: 137 matched captured evidence, one was legal outside it and three were flagged. The three flagged strings occur in a piece-description sentence (`Bg5`, `Ra1`, `Rh1`); these counts are not a semantic quality grade or three established bad recommendations. Provider prose remains unchanged.
- Extended the tour and runner with correct commentary controls, focused long-panel captures, full-board framing, engine-depth waits, scoped coaching consent, no-call planning, explicit worktree env/output options, button-answer counting, raw-HTML escaping and staged publication/rollback. Failed generation preserves the previous published directory. Mock CLI tests use temporary destinations outside the protected application tree and attach capture evidence, so the default Playwright command also works. The [capture guide](../site/flipbook/README.md) documents these controls and limits.
- Updated root flipbook navigation and kept the published Primer's original figures/quotes identified as its earlier snapshot. Validation: integrated lint/JSDoc/build and all 591 unit/server tests pass, one live-provider skip; both complete mock/plan browser cases pass. The paid capture also passed page/CSP checks. Verified all nineteen PNG sizes, nine prose records, full-board/phone framing and absence of credential/cookie patterns; inspected desktop, long-panel and German phone images and local links.

### Deviations

- Used the approved Haiku 5.5 routes rather than carrying forward the original Opus snapshot's label or replaying its answers. Mock previews remain outside the published directory; no additional paid rerun was used for visual review or tests.
- The refresh covers the agreed nineteen-step tour. It does not add an unapproved model benchmark or replace the Primer paper's existing example evidence.

### Insights

- Capturing actual coach prose separately from interface/source cards matters for trustworthy quotations. A complete capture still preserves fallible prose: the graph narration describes a queen/pawn-move pattern even though its listed mistakes include bishop/knight moves. Token checks cannot certify that generalization.
- A valid screenshot can still crop the board. Explicit top framing, focused panel captures and recorded image dimensions make the walkthrough readable and reviewable.

## 2026-10-24 — Optional Chrome built-in coach

TODO items: remaining 2.16.1 Chrome runtime; 2.16 completed with documented runtime differences.

### Implementation notes

- Added the injected `coach/chrome-llm.js` Prompt API adapter and explicit `BROWSER_RUNTIME=chrome` configuration. `just offline-chrome` serves with no env keys or GGUF provisioning; default wllama and `just offline` retain pinned same-origin weights. Public status names the native runtime without inventing a URL, size or version.
- A non-downloading capability probe precedes explicit Load-per-session consent. Creation starts within the click gesture; loading timeout, Unload, replacement and late-result guards destroy superseded sessions. Each request clones an empty base and destroys its own history. Queued work, cancellation, idle unloading, context measurement/overflow, input/output character caps and request deadlines have independent coverage. No provider substitution or raw runtime-error reflection occurs.
- Integrated the model notice, load cancellation, connection test, quick-request routing and English/German controls. Chrome remains Window-bound; its opaque CPU/GPU choice conservatively reduces analyst threads. A fixed native descriptor fits the existing bounded offline envelope without saving loading consent or reopening malformed/future records. Browser tests use a real CLI configuration and an injected fake Window API.
- Documented browser-managed downloads/updates/storage, the page-CSP and erasure boundary, unsupported-device failures, character rather than token limits and the absence of real native-model quality measurements. Updated README, architecture, privacy, threat-model flows and TODO.
- Validation: lint/JSDoc checks and build pass; all 588 unit/server tests pass with one optional live-provider skip. The final eleven adapter boundary tests pass separately. All 24 focused Chrome/wllama/privacy/PWA browser cases pass, including actual offline Stockfish use; the five Chrome cases pass again after final boundary guards. German phone screenshot inspected. Documentation links, recipe dry-run and diff checked. No real model downloads or provider calls.

### Deviations

- Chrome manages its model outside Kibitz's pinned catalogue and public offline cache, and its current API is unavailable in Workers. These explicit optional-runtime exceptions replace the earlier unimplemented Chrome note; they do not change wllama's deployment guarantees. Model availability/resource admission belongs to Chrome; character/time limits do not pretend to measure native tokens.

### Insights

- Remembering a backend is different from authorizing a model download. A fresh disposable context per request also prevents browser-maintained history from bypassing the application's own context controls.
- Synchronous creation failures need the same settled-load cleanup as rejected promises, and input limits must include separators inserted while merging turns. Both boundaries have regression assertions.

## 2026-10-24 — Compare position retrieval with literature algorithms

TODO items: documentation follow-up to completed 8.1, 8.2, 8.4, 8.5 and 8.8; no new algorithm milestone completed.

### Implementation notes

- Added [the position retrieval comparison](research/position-retrieval-comparison.md), audited against `2933295`: distinguishes Reading buckets, material/piece predicates, recorded-line pattern browsing, Combined fusion, optional pawn Jaccard and text embeddings. Compares their representations, inputs and gaps with relational BM25, solution-aware tactics, an expert-labelled classifier, CQL, ChessCLIP, ChessLM and conditional similarity learning, using primary sources.
- Separates current within-suite results from literature experiments, including the 2014 paper's abstract/Table 3 MAP discrepancy and the 2026 accepted manuscript's grouped pair-classification task. Documents counterexamples, input/engine-budget parity, candidate recall, occurrence/game grouping, family splits and metrics for a future comparison.
- Updated research navigation and dated implementation caveats, linked architecture/evaluation/TODO, and repaired the RRF author-PDF URL. No published benchmark labels or results changed.
- Validation: reran offline position, pawn and text benchmarks; all three JSON reports exactly match their recorded versions, and all thirteen related unit/CLI cases pass. Checked 135 local documentation links/anchors and the diff; application lint/JSDoc checks passed. No provider calls, literature models or external datasets used.

### Deviations

- This is a sourced algorithm comparison and experiment design, not a reproduction of literature algorithms on Kibitz's corpus. Published metrics with different inputs, labels and denominators are not combined into a performance ranking.

### Insights

- Similarity of pawn squares, source occurrences, explanation passages and tactical solutions are different retrieval objectives. The relevant literature comparison depends on which one the query requests.
## 2026-10-24 — Exclude agent instructions from aggregate PDFs

TODO items: none; requested documentation tooling maintenance.

### Implementation notes

- `just pdfs` excludes `AGENTS.md` alongside `CLAUDE.md`, including nested instruction files and explicit path selections. Individual documents can still be rendered with `just pdf FILE`.
- Validation: exercised the aggregate recipe with a recording `just pdf` stub; regular Markdown remained selected, while root and nested agent instructions and GitHub templates were excluded. Checked the explicit `AGENTS.md` selection and `justfile` parsing.

### Deviations

- No application changes or new dependencies; no TODO milestone applies.

### Insights

- Aggregate document generation can skip agent instructions without disabling explicit single-document conversion.
## 2026-10-24 — Bounded model downloads verified before publication

TODO items: 11.2.2; finding [#97](https://github.com/gregoryyy/kibitz/issues/97).

### Implementation notes

- Extracted the download pipeline into `scripts/download-model.mjs`: a transform enforces the pinned byte count before writing each chunk and hashes the accepted bytes. Exact size/digest checks precede publication. Unique exclusive partial/marker files separate concurrent downloads; handled failures/cancellation close streams and remove that run's temporary files.
- Added a default 30-minute total header/body deadline, external cancellation and validated CLI `--timeout-ms`. The existing checked-file fast path remains. Failed transfers, hashes and truncations preserve earlier final weights/markers; successful publication replaces verified weights and then the marker. Marker writes during download do not follow an old marker symlink.
- Eight unit cases cover invalid descriptors/deadlines, no early replacement during a held transfer, transport/HTTP/body/size/hash failures, stalled headers/body, cancellation before/during transfer, concurrent downloads, publication errors and marker symlinks. Three Playwright CLI cases use a subprocess-only preload that substitutes a tiny catalogue entry and every fetch; production has no fixture mode. The overflow regression fails on the actual old CLI: 65,563 bytes were written for a 27-byte pinned model before verification rejected it.
- Validation: checks/build pass; 575 unit/server cases pass (one opt-in live skip); all three download CLI cases pass, including valid publication/reuse and cleanup of wrong-hash, truncated and stalled responses. No actual model download, provider call or user data is involved. Updated offline instructions and OWASP/threat-model dispositions.

### Deviations

- The deadline covers download headers/body, rather than unrelated local preflight hash checks. File/marker publication consists of two atomic replacements; interruption can leave verified weights requiring another full check. Abrupt crashes can leave unserved unique partials; only handled failures/cancellation promise cleanup.
- The stored hash marker retains its operator-controlled quick-check contract. It is not a fresh digest of every served byte and does not detect every same-size local edit with an old marker. Remaining logging, file-serving/scanner and release findings are separate.

### Insights

- Rejecting an oversized file after it has filled the disk is too late. Enforcing the byte bound before each write and delaying publication until verification gives the integrity check a resource boundary as well as a final yes/no result.

## 2026-10-24 — Private databases excluded from every served root

TODO items: 11.2.1; finding [#96](https://github.com/gregoryyy/kibitz/issues/96).

### Implementation notes

- The shared private-file guard now checks library and usage database paths against both the static root and any separate model directory, resolving directory aliases before creating files or missing parents. Existing private-file modes, final-symlink rejection and string-root callers remain supported; a disk database with no declared public roots is refused.
- The CLI resolves/validates the model directory before initializing either database. `--models` now requires an existing directory, giving path validation a definite public root; the normal download-first offline workflow already creates it. Missing/invalid model roots fail startup without creating private database files or their parent directories.
- Added unit coverage for both roots, parent aliases, absent parents, preservation of existing bytes and valid neighboring private paths. Three real-CLI Playwright cases cover library with/without the AI gateway, usage, real/aliased model roots, missing model directories and valid private storage beside synthetic public weights. The rejection regression fails on the old server because it starts and creates the exposed database.
- Validation: checks/build pass; 567 unit/server cases pass (one opt-in live skip); the three new CLI regressions and all twelve existing library-storage/usage browser cases pass. Fixtures use temporary synthetic files and the mock provider; no actual model, key or personal record is used. Documentation and the threat/OWASP finding disposition reflect the implemented boundary.

### Deviations

- A missing explicit model directory is rejected instead of treating it as an empty served tree. This prevents ambiguous future paths from bypassing database validation. Static/model file-descriptor races, model trust, download bounds and default logging remain separate findings; this does not complete the release gate.

### Insights

- A “private file outside the web root” check must know every tree the process can serve. Resolving public roots before private storage initialization makes that contract testable even when a second route has a strict filename allowlist.

## 2026-10-24 — OWASP Top 10 code mapping and tracked findings

TODO items: 11.2.

### Implementation notes

- Added [the OWASP Top 10:2025 checklist](OWASP-TOP10.md) for the selected local single-user deployment, using the current official edition checked on the review date. All ten categories map concrete source controls and existing tests to explicit remaining risks; review completion is distinguished from release approval.
- Created findings [#96](https://github.com/gregoryyy/kibitz/issues/96) (private databases under a separate model root), [#97](https://github.com/gregoryyy/kibitz/issues/97) (unbounded downloads/publication before verification), [#98](https://github.com/gregoryyy/kibitz/issues/98) (default URL/provider-error logs) and [#99](https://github.com/gregoryyy/kibitz/issues/99) (all eleven open CodeQL alerts with initial source-context triage). No alert was dismissed or assumed exploitable solely from scanner severity.
- Reproduced #96 with a temporary mock server and a synthetic empty usage database named as a catalogue GGUF file in a separate model directory: HTTP 200 returned the SQLite header. No real model/key/personal data/provider request was used; the server and temporary files were cleaned up. Default private paths remain outside served roots.
- Reviewed source snapshot `2203105`, whose checks/build and 566 unit/server passes (one live skip) and five focused mock browser passes are recorded in the preceding entry. This documentation-only milestone adds no runtime changes; local evidence/navigation links and the mapping were checked against the source.

### Deviations

- Findings are tracked rather than presented as fixed. Seven scanner-rated high alerts remain unresolved alongside the other findings. The LLM Top 10, ASVS, automated-scan/baseline and release gates remain open; this checklist is not an exhaustive new browser audit or an all-clear release result.

### Insights

- A security checklist needs a disposition for each observation, including local-only assumptions and queries over trusted HTML/test fixtures. Mapping an alert to its actual sink and recording a synthetic reproduction gives the next fix a testable target without confusing a scanner label with demonstrated impact.

## 2026-10-24 — Approved German provider trials and a prose-capture correction

TODO items: 10.8.4.2; parent 10.8.4 and follow-up 10.8.4.3 remain open.

### Implementation notes

- Ran the approved German matrix sequentially, with the configured Haiku 5.5, GPT-6 Luna, Mistral Small Latest and Ollama DeepSeek-R1 models, ten positions maximum each and no judge. [The result matrix](eval/german-plan.md) separates completed answers from provider errors: Claude answered all ten; OpenAI returned 401/auth_failed; Mistral returned 429/rate_limited on the first position and all three runner retries; Ollama returned 404/model_not_found. No replacement model or download was used. A local Claude gateway-startup retry preceded any paid request.
- Recorded Claude's original ten answers, actual engine contexts, fixed German cues and checks in JSON/Markdown. Original text/scores are preserved exactly; recomputation matches the archived scores and generated report/index. The report has source-commit provenance and an explicit legacy capture warning. No cloud invoice or exact provider-request count is inferred from answer counts.
- The live report exposed source/tool/interface text contaminating cue scores. The extractor now scores only coach prose and counts recognized moves in that prose; new records are labelled `coach-prose-v2`. Legacy/missing capture metadata is labelled `rendered-message-v1`, with a warning in reports and the index. Reports use captured reference cues and link to the correct language's source.
- Validation: checks/build pass; 566 unit/server cases pass (one opt-in live skip); all five benchmark browser cases pass with mocks, including all twenty English/German positions. The new synthetic capture regression fails on the preceding extractor by including source-only bridge/mate cues and passes on the fix. A mock CLI report verifies the new capture metadata without additional paid calls.

### Deviations

- The provider comparison is incomplete: credentials, rate limits and the missing configured Ollama model prevented three providers from answering. Fresh comparable prose-only captures need a new approved plan after those prerequisites are fixed. The parent TODO remains open.
- Claude's retained cue score is not a model-only quality score: Lucena's bridge cue, for example, appeared only in a supplied source. The two automatically flagged move tokens include an impossible capture discussed as such and a piece reference; they are not independently verified recommendations to play illegal moves. There was no semantic judge and no paid rerun to conceal the capture problem.

### Insights

- Grounding material is useful context but must not earn credit for the model explaining it. Separating provider failures, observed checker flags, capture versions and semantic assessment makes the experiment reviewable without turning transport success or a lexical match into a coaching-quality claim.

## 2026-10-24 — Local application threat model

TODO items: 11.1.

### Implementation notes

- Added [the threat model](THREAT-MODEL.md) with an explicit local single-user scope, a data-flow diagram, protected assets, trusted operator files and the separate AI/library cookie boundaries. It maps browser/engine/storage, gateway/providers, imported PGN and retrieval passages, optional embeddings, local model loading, offline bundles, operational counters, exports and fonts.
- Ten attack scenarios link implemented controls to concrete modules/tests and retain their limitations: prompt injection, untrusted output/actions, stale games/owners, retrieval poisoning/disclosure, resource spending, supply-chain/local-file trust, misconfiguration, erasure/consent acknowledgement and logging. Future hosted/runtime changes explicitly require a boundary update.
- Corrected the architecture's overbroad claims about own-page-only access and nothing leaving the machine, and its obsolete planned-evaluation note. Added README/architecture navigation to the model.
- Validation: documentation links checked against the repository; diagram and flow descriptions reviewed against the referenced implementation. Runtime files are unchanged from preparation parent e2b752c, whose checks/build, 566 unit/server cases (one live skip) and all four bilingual mock benchmark cases pass. No live provider or security scan result is inferred from this documentation change.

### Deviations

- This completes the threat-model item rather than the separate OWASP/ASVS/scanning/release gates. Existing code-scanning alerts, model/file handling, log privacy and resource-bound review remain explicit follow-ups under 11.2–11.6/12.3. Cookie grouping and provider consent attestations are not described as hosted authentication.

### Insights

- A legal move, a source hash, a permitted endpoint and a successful feature test establish different facts. Keeping these boundaries explicit prevents a citation or a local deployment label from implying stronger guarantees than the implementation provides.

## 2026-10-24 — Prepare German tutor evaluation and explicit live-run plan

TODO items: 10.8.4.1; live provider matrix 10.8.4.2 remains open.

### Implementation notes

- Added `eval/positions-de.mjs`: the same ten IDs, legal FEN/move sequences and 28 concept counts, with German titles, actual translated UI chips and German lexical cues accepting canonical/German move letters. Detached selections reject unknown languages/IDs. English source data/default behavior remains available.
- The runner supports `--lang`, a no-request `--plan`, dedicated `--out` and server-only `--env` paths for worktrees. Load completion checks game generation instead of English UI text. German filenames end in `-de`; reports capture language, reference positions/cues, actual answer context and language-specific key points. The combined index separates languages and identifies regex scores as cue coverage.
- A fresh benchmark browser grants only its selected coach provider through the existing privacy UI after the paid-run guard permits execution. It loads no personal profile/library, keeps keys server-side and preserves first-error/no-completed-report behavior. Startup timers are cleared, and plans report configured provider/model availability without calling a coach/judge or writing a result.
- Validation: checks/build, all 566 unit/server tests on the integrated milestone base (one live-provider skip), nine focused scoring/paid-plan cases, all four English/German browser benchmark/error cases and a real one-position mock CLI report pass. The browser cases cover all ten positions in each language. All four configured-provider plans were inspected without model requests; Mistral's initial startup timeout passed on retry.

### Deviations

- The [live-run plan](eval/german-plan.md) records model IDs and pending trials separately. No provider result is fabricated from a mock run, English report, configured key or failed connection. The existing paid-run approval requirement remains in effect; 10.8.4 is not marked complete before live trials are recorded.
- Regex cues can match negations and irrelevant mentions. A test explicitly records this limit; translated patterns do not establish semantic correctness or calibrated cross-language rankings. Printed position counts are not hard request/cost caps when agent follow-ups and rate-limit retries occur.

### Insights

- Language-specific quick-question labels and load-success messages belong to the actual UI path. A valid German benchmark must preserve chess positions/concepts while retaining the language and source text used for every reported cue score.

## 2026-10-24 — German opening labels and authored classic-game notes

TODO items: 10.8.3.

### Implementation notes

- Added project-authored German labels for all 141 opening-family prefixes in the 3,865-row catalogue, common variant terminology and literal bounded matching across original/German names and ECO codes. Canonical English names and family IDs stay unchanged in game state, engine features and PGN headers. Proper names and uncommon nicknames keep their spelling; unknown custom text remains literal.
- Opening selection, board labels, continuation/guide controls, Reading and library metadata display the selected language, while searches accept either name. Added a search-only alias without changing stored records or calling a provider.
- Translated all 63 distinct authored classic comments (64 occurrences). The 33 bundled games/problems keep identical legal moves, headers, positions and source/licence metadata; English remains the pure catalogue function's default. German comment PGNs have their own natural source hashes and precise searchable locators. Imported notes and already saved copies keep their original language; recorded problem evidence retains its exact original scope.
- [Translation scope and source identity](GERMAN-STUDY.md) document family coverage, retained names, existing saved copies and the separate unchanged English retrieval benchmark. The app requests the selected language's built-ins without rewriting a personal library.
- Validation: the isolated study build passed checks/build, all 555 unit/server cases (one optional live skip), four new browser scenarios plus localization/opening regressions, and a complete 365-pass browser rerun (one optional live-model skip). After integrating the published usage milestone, combined checks/build, all 563 unit/server cases (one optional live skip) and all 34 relevant study/coach/embedding/data/privacy/usage browser scenarios pass. German phone layout inspected; production audit reports zero vulnerabilities. On the isolated study build, the offline-builder follow-up produces byte-identical worker, offline document and install manifest for the actual tested 98-asset build; its file-handling regression and corrected activation fixture were also verified separately.

### Deviations

- The first full browser run had 364 passes and one initial offline-install assertion timeout. Its 20-second assertion was shorter than the app's existing 120-second installation deadline; the corrected wait passed all seven focused offline cases and the entire subsequent 365-case run. The final dependency update changes build/test handling, with identical generated app bytes as described above.
- German lexical/source-navigation tests do not claim a new retrieval-quality score or prove translated prose/chess claims. The existing frozen English benchmark and canonical chess data remain separate.

### Insights

- A translated annotated PGN is a different source document even when every chess move is unchanged. Its hashes and citation offsets must be generated from the actual language-specific text.

## 2026-10-24 — Persistent local AI usage and per-browser request limits

TODO items: 2.11, scoped by the selected local single-user deployment (10.1).

### Implementation notes

- Added current-day SQLite counters with hashed cookie scopes, bounded minute-admission timestamps, version checks, private file creation and fail-closed storage/capacity errors. Admission persists both rate allowances before provider work; completion records server and user usage in one transaction. Standard serve recipes select gitignored `.kibitz-data/usage.sqlite`; direct CLI/evaluation/test calls remain explicitly ephemeral unless `--usage FILE` is supplied.
- Coach turns, connection tests and embeddings share aggregate and per-cookie rates. Paid classification is captured with the original route across asynchronous work. Consent is rechecked against the actual route after a request body finishes arriving, preventing a provider switch from reusing the preceding route's permission.
- Existing token/cost displays and daily paid/local accounting retain their response shape. Corrupt/future schemas, unsafe paths, write failures and the 10,000-scope capacity limit preserve existing budgets rather than replacing the ledger. No prompt, answer, game, model ID, raw cookie or key enters the database.
- [Usage settings and lifecycle](USAGE.md) document current-day retention, SQLite remnants/backups, operator reset, direct-CLI memory mode and threshold overshoot/incomplete-provider-usage limits. Data/privacy notices explain in English/German that their library/browser export and erasure controls leave operational counters in place.
- Validation: checks/build and all 558 unit/server cases on the isolated notation/offline base (one optional live skip); four new store scenarios, actual CLI restart/privacy checks and three HTTP regressions. All three HTTP regressions fail on preceding API 9833767. All 30 focused browser cases pass, covering coach/embedding flows and all six data/nine privacy cases; the new real-CLI browser test verifies restart-persistent refusal, another cookie's independent allowance and both notice translations. Production audit reports zero vulnerabilities. The first new browser assertion expected gateway wording rather than the existing friendly error message; correcting that expectation completed the scenario without a product error-message change.

### Deviations

- Hosted accounts and authenticated quotas remain deferred with 10.2, as selected by the owner. Cookie replacement can restart an individual scope; aggregate server counters remain independent. The browser model does not pass through this gateway ledger.
- Budgets are admission thresholds on completed reported usage, not reservations or hard billing caps. Final/in-flight calls, provider retries/fallbacks and crashes before usage recording can exceed or under-report them; provider-side spending caps remain necessary for hard financial limits. Operational counter retention/reset is separate from chess-data erasure and explicitly disclosed.

### Insights

- Durable cookie counters require a shared transactional store, but do not create authentication. Route/consent/payment classification must also be captured at the same point after asynchronous request-body reads.

## 2026-10-24 — Optional German move letters and figurines

TODO items: 10.8.2.

### Implementation notes

- Added pure complete-SAN-token formatting for English SAN, German K/D/T/L/S and white figurines for both colours, including promotion, captures, checks and punctuation. Typed moves also accept German/figurine letters through legal chess.js resolution; English SAN retains precedence.
- Settings → General saves an independent notation choice after acknowledgement. Main/scratch move lists and recognized coach move tokens repaint immediately, including existing answers. Canonical English SAN remains in game state, PGNs, engine lines, stored answers and cache keys. Figurines retain localized screen-reader descriptions; literal prose is left alone.
- Unknown saved preferences remain intact until an explicit selection. Failed saves retain the previous display; native cross-tab changes repaint presentation without changing games or invoking models. [Notation rules and limits](NOTATION.md) document the behavior.
- Validation: checks/build, all 549 unit/server tests (one live-provider skip), all five new browser scenarios and a complete browser rerun with 361 passes (one optional live-model skip). German phone figurine screenshot inspected; production dependency audit reports zero vulnerabilities.

### Deviations

- Display formatting recognizes actual SAN tokens; it does not rewrite arbitrary imported or model prose. English SAN stays the default independently of interface language.
- The first full browser run had 360 passes and one pre-existing scratch-board assertion failure before a move. That case passed five unchanged repeats, and the subsequent complete run passed all 361 cases. No product change or assertion relaxation was made for that intermittent failure.

### Insights

- Display notation needs to remain separate from canonical move data, especially when repainting an answer or switching interface language. A figurine's visible glyph also needs an accessible move description.

## 2026-10-24 — Verified offline app bundle and browser-coach fallback

TODO items: 10.7.

### Implementation notes

- The build generates an install manifest, authored SVG icon, font-free offline document and module worker with exact SHA-256/size metadata for every public asset. The bundle includes actual Stockfish builds, board/rules code, opening tables, classics, lessons, app/data modules and the browser-model runtime. Preparation is explicit in English/German Settings; no new dependency is needed.
- Worker installation fetches without cookies and rejects redirects, failed responses, wrong sizes or changed digests before activation. Failed new bundles are removed. Scoped cached navigation/modules retain one version, and missing files produce a failure rather than mixing a newer module into an older page. API responses, model weights, other paths/origins and mutations bypass the app cache. Reads/status checks cannot recreate an erased cache.
- Initial control starts on the next navigation. Update checks are explicit; complete updates wait for old controlled tabs to close, with no forced reload/activation. Cleanup removes only older app bundles in the same scope. Incomplete caches require explicit removal, reload and re-preparation; failures and retries stay visible. Separate removal preserves games/other caches/weights, while confirmed browser erasure also unregisters/removes the app copy before acknowledging completion.
- A bounded, versioned descriptor retains only an explicitly selected browser model's local URL/name/size. It restores the existing local coach path after gateway loss without replaying cloud status, usage or owner metadata. Unknown formats remain intact/closed; changing providers clears a readable saved choice. Existing load consent, memory limits and the wllama weight cache remain separate.
- Nine unit scenarios cover path exclusions, cookie-free integrity checks, incomplete-install cleanup, scoped activation/removal, reads after erasure, model descriptor boundaries/future formats and the actual build manifest. Seven browser scenarios cover real offline reload/Stockfish reply, browser games/openings/lesson mate, actual waiting HTTP updates, rejected changed assets, removal/data erasure, gateway-loss browser coaching, incomplete-cache re-preparation/removal retry and German phone controls.
- Validation: checks/build, all 547 unit/server tests (one live-provider skip), all seven new browser scenarios and all 356 browser tests (one optional live-model skip) pass. Production audit reports zero vulnerabilities. The real offline engine/reply and exact lesson mate run without network access; fake browser inference remains a separate test as described below.

- CI follow-up: the manifest builder rejects file/directory symlinks and checks/hashes a no-follow opened regular-file descriptor rather than statting then reading a path. The regression fails on cfe6ee0. Checks/build, all 548 unit/server cases (one live skip), six offline browser cases and three repeats of the corrected activation case pass. The activation fixture now closes all old tabs before opening its replacement and records worker/client state on failure; installation waits cover the app's existing 120-second deadline. CI's browser deadline is 60 minutes after its expanded suite reached the old 30-minute job limit. The preceding complete app suite remains the 356-pass run described above; the follow-up changes build/test handling, without product UI logic changes.

### Deviations

- [Offline scope and limits](OFFLINE.md) distinguish a browser-only offline app from locally running Ollama, which still needs the Node gateway. Browser weights need their separate prior load/cache; in-memory fallback is not proof of durable weight storage. Fresh offline private-server collections remain inaccessible without owner verification, while the separate browser library and bundled references work locally.
- Installation controls and quotas are browser dependent. Tests use actual Stockfish but fake browser-model inference; no real-model performance or cross-browser guarantee is inferred. Unknown cached-file loss can require the browser's worker/cache controls if the app page itself cannot load.

### Insights

- Re-registering identical worker code does not reconstruct an evicted cache. Cache reads also need to avoid `caches.open()` after erasure, since it creates a new empty cache even from a still-controlled old tab.

## 2026-10-24 — Keyboard board play, patterned marks and reduced motion

TODO items: 10.5.

### Implementation notes

- Added pure navigation/rules models and a native roving-focus grid in `chess/keyboard-board.js`. One Tab stop exposes all 64 labelled squares; orientation-aware arrows, row/corner keys, Enter/Space selection, Escape and legal destinations use the existing game/scratch move path. Read-only states and game/FEN changes clear captured selections; previews hide the grid and global history/flip shortcuts leave it alone.
- Promotion focuses explicit translated choices, supports keyboard underpromotion/cancellation, restores focus and checks captured game/scratch identity. A held pointer choice cannot promote in a replacement game even at the same FEN. Clearing the pointer selection before a keyboard selection prevents Chessground's king-to-rook castling shortcut from becoming an unintended move.
- Added `chess/board-marks.js`: six distinct automatic arrow patterns supplement existing colours, with literal localized descriptions of squares, meanings, patterns and validated labels. User-drawn marks also have patterns/descriptions. Prior coach marks disappear when live help becomes restricted; previews do not retain descriptions for the wrong board. All descriptions use text nodes.
- The reduced-motion media query now disables the actual Chessground animator and cancels a running animation, including preference changes while the page is open. Existing CSS motion suppression remains in effect. German controls and labels avoid a second translation pass.
- Six unit scenarios cover navigation, orientation, actual rules/king safety, castling, en passant, promotion destinations, unique patterns and hostile mark data. Ten browser scenarios cover focus/Tab, live and analysis play, game replacement, either-colour underpromotion, stale pointer promotion, mixed pointer/keyboard castling, help/preview/scratch isolation, real animator state and German dark phone layout. The stale-promotion test was run against prior head `3914e1c` and fails there because the obsolete chooser remains active.
- Validation: checks/build, all 538 unit/server tests (one live-provider skip), all ten new browser cases and all 349 browser tests (one optional live-model skip) pass. Production dependency audit reports zero vulnerabilities. German phone focus screenshot inspected; the stale-promotion regression fails on the prior build as described above.

### Deviations

- Existing typed SAN/UCI input and independent lesson/drill/own-mistake controls remain available. The new square grid targets the main board and free scratch board rather than replacing every practice widget.
- [Controls and verification limits](ACCESSIBILITY.md) document Chrome automation/visual inspection and the remaining need for hands-on assistive-technology testing; no WCAG conformance claim is made.

### Insights

- A CSS reduced-motion rule does not stop a JavaScript board animator. Keyboard selection also needs to clear the pointer renderer's previous origin before selecting another piece.

## 2026-10-24 — Explicit provider/purpose opt-in and privacy notice

TODO items: 10.4.

### Implementation notes

- Added pure `platform/privacy.js` and localized `privacy-ui.js`: initially off, acknowledged per-provider coach/test and passage/query-embedding permissions for Anthropic, OpenAI, Mistral and Ollama. A bounded v1/revision store preserves malformed/future data closed to network sharing, rejects stale sequential-tab edits and publishes grants only after save. A failed revocation denies this tab immediately and retains a distinct safe retry without temporarily re-granting permission.
- A central transport rereads choices before requests, combines cancellation signals, attaches exact version/provider/purpose attestations and fences late results. UI/native storage changes cancel pending coach/embedding transports, clear reusable conversation/semantic state and update availability. Existing in-browser model loading consent and local mock behavior remain distinct; quick in-browser routing can work while a network coach is blocked.
- The gateway checks actual routing before spending/rate-budget admission for sample, structured, connection-test and embedding calls. Provider changes cannot reuse another provider's header, and coach consent cannot authorize embeddings. Existing fake-provider budget/embedding fixtures now explicitly attest their intended calls; no real service is contacted.
- Settings place permissions beside provider controls, with an accessible jump button, English/German data-flow notice and literal provider names. Provider switches update the grant prompt immediately; enabling quick in-browser routing restores its controls while network sharing remains blocked. The notice covers questions/history, game/engine/tool context, retrieved/source text, profile fields, separately selected embedding passages/queries, configurable compatible/Ollama endpoints, fonts, local model loading and provider retention limits. Local-model wording no longer promises that all network traffic stops. [Privacy/API contract](PRIVACY.md) distinguishes explicit direct-client attestation from authentication or signed consent records.
- Six unit scenarios cover initially closed choices, separate scopes, acknowledged grants, failed revocation, stale tabs, unknown formats and cancelled held results. A fake-SDK gateway scenario verifies missing/wrong-provider/wrong-purpose/version refusals without spending. Nine browser cases cover persistence, provider switching, blocked-cloud/quick-browser routing, failed grant/revocation retry, held replies, actual cross-tab revocation, future formats, separate embeddings and German phone controls. Existing cloud-embedding policy tests explicitly grant permission before testing their later restrictions.
- Validation: checks/build and all 532 unit/server/fake-provider tests (one live-provider skip), 27 focused server cases, 19 focused browser/regression cases, all nine new privacy cases and all 339 browser tests (one optional live-model skip) pass. Production audit reports zero vulnerabilities. Readable German phone notice/control screenshots inspected.

### Deviations

- Per-purpose controls are narrower than a single provider toggle. Mock mode and the browser model do not need a network-provider permission; browser model loading retains its existing resource consent. Host-managed artifacts keep their separate host contract.
- Consent headers attest a local operator/browser choice and provide routing/version preconditions; they are not authentication or legal consent receipts. Revocation cannot recall transmitted data or stop all provider-side work already accepted. Truly simultaneous localStorage writers lack a transaction; failed revocations warn about other tabs/reloads until saved. No provider-retention/compliance guarantee is invented.

### Insights

- A connection test also contacts a provider and needs consent. Embedding ingestion has a different data scope from coach context, so sharing a provider name is insufficient permission to send passages or queries.

## 2026-10-24 — Standalone data exports and confirmed browser/server erasure

TODO items: 10.3.

### Implementation notes

- Added standalone `src/data.html` and `platform/data.js`/`data-page.js`, linked from Settings and copied by the build. The data page does not boot app autosave, engine or game state. It downloads bounded versioned JSON without model calls: raw Kibitz browser values preserve unknown/future formats and original PGNs, while current-cookie server exports refresh and validate their exact owner snapshot. Other origin-storage keys, server env keys, transient drafts and provider histories are excluded.
- Separate native confirmation dialogs distinguish browser data from the current server collection. Browser erasure compares its preview before/after cache deletion, waits for native IndexedDB deletion, removes only the Kibitz localStorage namespace and named library cache, and verifies completion without recreating app preferences. Changed previews, storage/cache failures and partial removals never claim a complete erase; retry inspects the remaining data again.
- Added cookie/scope/revision/confirmation-checked `POST /api/library/erase`, with the existing same-origin/host, JSON/size/rate boundaries. SQLite atomically removes only that owner's games/references and retains an advanced revision tombstone so older pending writes cannot resurrect data, including after restart. Other owners and browser records remain separate. Acknowledged server deletion removes only the verified owner's cache; cache failure and uncertain server acknowledgement get distinct messages.
- The page supports English/German, a phone-sized native modal, keyboard cancellation/focus, literal source contents and no reflection/prompt rendering. [Data formats and lifecycle](DATA.md) document raw exports, no automatic restore, caps, concurrent-tab limits, backups, physical SQLite remnants, provider/host-managed account exclusions and operator responsibilities.
- Five unit scenarios cover raw export fidelity/namespaces, cache acknowledgement, changed previews/partial failures, future formats, localized copy and build output. Three server scenarios check transactional owner/tombstone/restart behavior, malformed erasure and explicit session/origin/confirmation/CAS constraints. Six new browser cases verify downloads, app navigation/autosave isolation, scoped cache removal, stale writes/previews, cancellation, partial/uncertain outcomes and German phone controls.
- Validation: ESLint/JSDoc checks, build, all 525 unit tests (one live-provider skip), 16 focused server cases, all six data browser cases and all 330 browser tests (one optional live-model skip) pass. The earlier focused run passed existing localization/settings/library-storage regressions; the German data translator binding was corrected and rechecked. German phone confirmation screenshot inspected; production dependency audit reports zero vulnerabilities.

### Deviations

- The selected local single-user target uses browser and optional cookie-owned Node storage. Host-managed artifact account libraries, provider retention and operator backups remain outside these controls and are identified explicitly. No hosted-account deletion or forensic disk erasure is claimed.
- Browser key removal is not a transaction. Other tabs can recreate in-memory copies, so the page asks the player to close them; partial failure stays visible. Exports preserve saved raw values without adding an import/restore workflow.

### Insights

- Deletion needs both a persistence boundary and an acknowledgement boundary: stopping autosave prevents local recreation, while a retained server revision blocks older writes and keeps uncertain receipts from becoming false success messages.

## 2026-10-24 — Select the local single-user deployment

TODO items: 10.1; 2.9's existing env-key path resolved by this decision. Hosted 10.2 deferred.

### Implementation notes

- Recorded the project owner's explicit local single-user choice in [DEPLOYMENT.md](DEPLOYMENT.md), README, architecture, design notes, roadmap and TODO. Confirmed that `serve.mjs` already binds to `127.0.0.1` by default; no listener behavior change was needed.
- Defined operator env keys, browser-first data, optional private SQLite storage and cookie collection separation as the supported target. Local deployment can use cloud providers; offline/local-only inference remains a separate choice. The existing server-env path fulfills local key management, so 2.9 no longer waits for a hosted per-user store.
- Kept hosted authentication explicitly deferred, with no passkey/OAuth/account claim. Recorded future hosted prerequisites, remaining persistent usage/rate limits, local export/deletion, provider consent and ASVS L1 verification scope. These consequences do not mark privacy/security/release checks complete.
- Validation: documentation links and diff checked; ESLint/JSDoc checks, build and all 517 unit/server/fake-provider tests pass (one live-provider skip), including the existing loopback process, API-origin and cookie-isolation checks. No new application behavior was introduced.

### Deviations

- This milestone records a deployment decision rather than adding an authentication implementation. The current loopback default already supports the chosen operation. Hosted key/account work is deferred explicitly instead of being presented as completed.

### Insights

- Local hosting and local model inference are independent choices; privacy controls still need to cover an operator-selected cloud model.

## 2026-10-24 — Local spaced practice across lessons, openings and own mistakes

TODO items: 9.4.

### Implementation notes

- Added `player/schedule.js` and `schedule-ui.js`: a localized Lessons queue combines oldest-due reviews before new tasks, with type/new filters, explicit/time-based refresh and a 20-item cap. Current lesson revisions, existing opening keys and selected-owner surviving own-exercise candidates define eligibility. New lessons follow the explanation-level ceiling while reviewed current tasks remain available.
- Reused opening-drill intervals for all three types: misses/reveal/reflection-practice restart after ten minutes, help preserves at least a day and clean completion advances one/three/doubling days up to 180. Rules mate, recorded-line recall, engine-target results and rubric self-assessment retain separate labels and criteria. Unknown/illegal answers produce no completed receipt, and written responses never enter the scheduler.
- Kept opening reviews canonical in their existing store. Lesson/own schedules use a bounded v1 envelope, exact task/target revisions, owner/source pointers, recent completion IDs, acknowledged writes and rereads before save. Old/future/corrupt data stays intact, failed saves retain receipts and delayed older results cannot replace newer due dates. Opening reviews gained reload/sequential-tab preservation and the same delayed-result protection.
- Lesson progress acknowledges first, then a separate schedule receipt saves/retries without recounting the lesson. Own-game results show their grade independently of a failed scheduling save and expose retry in Review. Pending lesson scheduling remains visible even under restricted live help. Existing isolated players own grading; the queue opens the selected opening card or freshly qualifies an own target. Main-game/source/repertoire/policy guards reject held actions; focused opening boards now share the keyboard isolation boundary.
- Ten unit scenarios exercise intervals/evidence, identities/revisions, ordering/filter/cap, owner/deletion boundaries, invalid data, failed writes/retries, sequential tabs and late results. Eight new browser cases cover due/reload/interval advancement, opening routing, source/target refresh, failed-save boundaries, future formats, task revisions, held policy/owner actions, literal names and German phone layout. Existing opening/lesson/own-player regressions also run unchanged.
- Validation: ESLint/JSDoc checks, build, all 517 unit tests (one live-provider skip), 19 scheduling/opening logic cases, 16 focused browser cases and all 324 browser tests (one optional live-model skip) pass; the earlier focused run also passed all existing opening/lesson regressions. Production dependency audit reports zero vulnerabilities. German phone screenshot inspected.

### Deviations

- Reused the project's existing deterministic interval heuristic rather than introducing a fitted memory model or dependency. No old lesson totals are retrospectively assigned invented intervals. Schedules remain browser-local and owner-scoped rather than synchronized with a selected server library.
- Lesson counters and scheduling are separate acknowledged keys, not a cross-key transaction. Closing/reloading loses unsaved in-tab receipts; bounded retry IDs do not promise indefinite deduplication. Simultaneous localStorage writers still lack a transaction. [Practice lifecycle](PRACTICE.md) records these limits, date assumptions, caps and revision retention.

### Insights

- A due queue can share timing without conflating what each activity establishes. Keeping self-assessment, recall, engine evidence and rules mate visible is necessary before later personalization can interpret the records.

## 2026-10-24 — Freshly checked exercises from own-game mistakes

TODO items: 9.3.

### Implementation notes

- Added `player/mistake-puzzles.js`: up to 50 scoped candidates from compatible own-game measured mistakes/blunders, including quiet errors. Source prose, studies, unsupported reports and restored classes do not create exercises. Explicit preparation rechecks root/reference/original-child evidence, declines unsupported old errors and retains full-FEN source identity. A current reference needs at least a one-pawn improvement over the original, or an outcome improvement to winning mate.
- Arbitrary legal answers can qualify through fresh child searches, rather than only a listed PV move. The target is within 50 raw centipawns of the qualified reference; winning-mate alternatives stay outcome-based. Actual immediate mate succeeds by rules. Missing/shallow/bounded/illegal evidence gives no incorrect-attempt penalty. Shared evidence checks use a line's actual depth rather than a deeper sibling MultiPV result. These are bounded FEN-diagram exercises, without pre-diagram repetition claims or a unique/perfect-move certificate.
- Added `player/puzzle-player.js` with an independent Chessground board, source chooser, typed/board moves, explicit White/Black promotions, German input, two-stage hints, separate reveal and source navigation. Busy/generation/source/library/help guards reject stale searches, disconnected controls and held promotion actions. Dedicated practice searches leave the main game/clock/library intact. Source titles/moves render literally; browsing/solving makes no provider request.
- Extracted `chess/evidence.js` and `chess/practice.js` for rules/history, canonical PVs, per-line depth, move parsing, promotion intent and destinations. Authored lesson behavior remains unchanged. A global keyboard boundary prevents focused lesson/practice boards from navigating/flipping the main board; an authored-lesson regression fails on the previous behavior.
- Opaque SHA-256 IDs bind selected-owner/document/ply/full-FEN/actual-move keys; checked target/policy revisions support subsequent scheduling. Completion outcomes and help remain session-local here, without a durable-save claim. [Exercise criteria and lifetime](OWN-PUZZLES.md) document the scope.
- Four shared-evidence and seven generated-exercise unit scenarios cover depth/bounds/history, canonical inputs, source scope/provenance, fresh targets, arbitrary alternatives, unknown evidence, cancellation, Black promotion, outcome-aware mate and source immutability. Eight browser cases cover actual wiring, main-state/collection isolation, alternatives, unknown/hint/reveal distinctions, underpromotion, held searches/actions, library changes, German phone controls and authored keyboard isolation. Deterministic injected analyses cover failure/alternative paths; a real-WASM mate-before-stalemate case checks the actual worker path.
- Validation: ESLint/JSDoc checks, build, 507 unit tests (one live-provider skip), 20 foundation logic cases, ten focused browser/localization cases and all 316 browser tests (one optional live-model skip) pass. The dependency audit reports zero vulnerabilities. The German phone screenshot was inspected; its independent board and translated controls fit the viewport.

### Deviations

- Exercises target current engine move quality and accept alternatives; they do not claim forced wins, calibrated difficulty, flawless endgame grading or learner mastery. Help/reveal/rules-mate/engine-target remain distinct. Durable practice scheduling remains 9.4. No model request, new dependency, source upload or persistent schema migration is introduced.

### Insights

- A historical classification is a candidate source, not a current solution. Rechecking both the reference and the player's original move avoids generating an obsolete exercise; grading other legal answers avoids confusing a bounded reference with a unique good move.
- Independent boards need keyboard and asynchronous boundaries as well as separate chess objects. Guarding only mouse moves would still let focused practice controls alter the main board or receive late results from another context.

---

## 2026-10-24 — Review-derived phase trends and checked opportunities

TODO items: 9.2.

### Implementation notes

- Added pure `player/reviews.js` for bounded historical review reports and current-library aggregation. Own decisions retain full start/UCI/side binding, depth-qualified White-relative before/after score/PV facts, phase and a separate motif result. Restored depth-zero, bounded, shallow, malformed or illegal-PV data stays unmeasured. Terminal outcomes use complete source history and rules facts; moves after an automatic game end cannot acquire measurement credit.
- Numerical classification/accuracy reuse the existing functions from the player's perspective. The six largest measured mistakes/blunders share the existing motif verifier's EPD cache, twelve additional searches and fifteen-second search-admission budget. The exported verifier adds detached per-position proof records without changing tool-response JSON. Confirmed, refuted, unverified, no-pattern and unchecked cases remain distinct. Only supported alternatives enter theme totals; legal geometry alone does not establish payoff.
- `runReview()` captures reports only for known own played games, rechecking stop state, game generation, every captured FEN and library context around asynchronous checks. Reports travel with the ordinary own-game JSON through existing acknowledgement/quotas. Future report versions remain unchanged during re-review. Bounds survive score-coordinate conversion; the existing worker already rejects bound lines.
- Reader validation replays current legal source/history and checks format, side/mainline/FEN binding, numerical/PV bounds, phase and motif geometry. This validates a historical record rather than authenticating stored scores or rerunning Stockfish on library reads. Current-library aggregation counts each document once; reruns replace contributions, and deletion/source-line/storage/owner changes remove them. No second global history store or persistent schema migration is added.
- `player/review-history.js` renders English/German phase totals/coverage and checked theme counts, with sample sizes, explicit missing-evidence limits and up to six source samples. Played move labels and recorded checked SAN continuations make samples distinguishable. Exact source navigation rechecks record/library/game/pane/policy; restricted live help hides trends. Source titles/moves remain literal, and the phone table scrolls inside its wrapper. History is not automatically appended to model prompts.
- Ten new logic scenarios cover own/Black errors, confirmed/refuted/unknown opportunities, rules-proven mate/promotion, shallow/bounded/restored evidence, stale async capture, source/score/tag/branch tampering, deduplication/deletion, terminal facts and JSON-order independence. Six browser scenarios cover actual review persistence/repeated replacement, source claims versus compatible reports, exact navigation, storage/deletion guards, held worker cancellation, future metadata and German phone layout. Existing tool and localization tests also pass.
- Validation: ESLint/JSDoc checks, build, 496 unit tests (one live-provider skip), 23 focused review/tool logic cases and eight focused browser/localization cases pass. Final source-continuation/stage feedback passes the focused browser cases, and the German phone screenshot was inspected. The complete browser suite passes 308 tests (one optional live-model skip); the dependency audit reports zero vulnerabilities.

### Deviations

- Tracking describes recorded engine decisions/opportunities and heuristic phases, without diagnosing a learner's thought process, estimating ability or proving every possible tactic. Checks cover a bounded subset; unverified is not absence. Old reviews need fresh compatible evidence, and unknown future formats remain preserved. Own-mistake exercises/scheduling remain 9.3–9.4. [Evidence and lifecycle](REVIEWS.md) explain the limits.

### Insights

- Reusing source classifications or prose would turn imported claims into measured weaknesses. Capturing fresh qualified analysis and keeping its coverage separate prevents legacy depth-zero values and unsupported motifs from receiving credit.
- A global additive counter would double-count re-reviews and retain deleted/other-context contributions. Source-bound reports aggregated from the current library preserve replacement, deletion and ownership behavior without a second synchronization path.

---

## 2026-10-24 — Player profile and reported rating context

TODO items: 9.1.

### Implementation notes

- Added `src/player/profile.js` and `profile-ui.js`, separating browser-local teaching preferences from opponent strength and game state. Version-one profiles retain explanation level, an optional self-reported rating/pool/time control and bounded learning goals. Missing records inherit the legacy level in memory without migration or inferred ratings; unknown/malformed/future data remains intact and read-only.
- Settings preserve immediate level saves and offer explicit rating/goals save/reload controls. A successful single-key write precedes publication; failed writes retain drafts/effective preferences. Revisions and storage events reject stale sequential-tab forms and level clicks while preserving typed input. Returned profiles are detached and field/size/Unicode bounds are checked.
- Reported ratings carry explicit provenance rather than a measured Kibitz Elo or cross-pool conversion. Level labels no longer imply a rating band. Goals reach position/general chat, tutor comments, review summaries and study plans through bounded `quote()` data, subordinate to app rules/help policy. Editing/saving makes no provider request and changes no game, clock or opponent strength.
- Profile identity invalidates pending dialogue/tutor work, future model history and cached tutor context; stale review/study-plan results cannot apply after a preference change. Existing conversations/saved summaries/cache entries remain historical records. English/German settings and phone layouts explain local storage and sharing; [format/lifecycle](PROFILE.md) documents the limits. Source modules now include the separate `player/` responsibility.
- Seven unit scenarios cover legacy/no-write loading, reported provenance, detached persistence, malformed/future formats, bounds, failed-write retry, stale revisions and quoted context identity. Seven browser scenarios cover reload/no implicit requests, literal goals, failed writes/level rollback, future formats, dirty cross-tab drafts, cancelled old responses, cache invalidation and German phone layout. Existing settings/localization regressions pass; the phone screenshot was inspected.
- Validation: ESLint/JSDoc checks, build, 486 unit tests and 12 focused browser/settings/localization cases pass (one live-provider unit skip). The dependency audit reports zero vulnerabilities. The complete browser suite passes 302 tests (one optional live-model skip).

### Deviations

- This is a browser-local profile, without account synchronization or automatic performance-derived ability estimation. A reported rating is optional context, independent of explanation level and playing strength. Weakness tracking, own-mistake tasks and scheduling remain 9.2–9.4; broader export/deletion remains 10.3.

### Insights

- Explanation style, a rating from a particular pool/time control, and opponent strength are different settings. Removing implied rating bands avoids contradictory teaching context when a player deliberately chooses simpler or deeper explanations.
- Draft fields and effective preferences need separate lifetimes. A storage event can update current coaching context while preserving typed input, but that draft must not silently overwrite a newer profile—even through an unrelated level click.

---

## 2026-10-24 — Source position themes and recorded move patterns

TODO items: 8.2.

### Implementation notes

- Added pure `library/patterns.js`. Complete rules replay precedes detector indexing for every mainline occurrence, including source roots. Versioned position themes and move motifs retain revision-bound IDs, exact occurrence/start/end IDs, full branch FENs, UCI moves, source move labels and detector reasons/weights. Three-ply combinations retain the actual recorded reply/follow-up; truncated scores cannot supply them.
- Evidence classes distinguish position heuristics, geometric move/line candidates and rules-proven mate/promotion facts. The unsound recorded fork counterexample stays a candidate after its legal capture. No engine search certifies payoff or best defence. Annotation/NAG verification and general study-solution status remain separate; raw catalogue tags, supplied pattern/position fields, source prose and opening names do not populate computed facts.
- The source compiler supplies explicit standard-start context to the phase detector, including the untouched initial board. Late-counter/custom-start diagrams cannot establish early standard-start play. Tags stay on occurrences rather than shared EPD rows because contextual phase can differ on later repetitions. Existing hybrid phase eligibility and retrieval rankings remain unchanged.
- A separate source pattern index offers exact tag/role/evidence/collection/document predicates with a 20-occurrence cap. `library/pattern-browser.js` implements English/German Library controls, literal source titles, visible evidence classes, recorded sequences and exact source navigation. Existing live-game confirmation and return remain in use. Restricted help hides results; held actions recheck current game/library generation, filters, revision and policy. Deletion/storage-context changes clear the pattern index.
- Nine unit scenarios cover source-claim isolation, initial/custom phases, named pawn structures, unsound forks, mate/all promotions, detector vocabulary, three-ply boundaries, repeated/scoped/revised identities and query bounds. Six browser scenarios cover actual production data/navigation, literal markup, revision/deletion/storage invalidation, live-help/confirmation/return, no provider calls and German phone layout. The existing localization regression also checks the selector's translated labels; the phone screenshot was inspected.
- Validation: ESLint/JSDoc checks, build, 479 unit tests and eight focused browser/localization cases pass. One live-provider test is skipped; the dependency audit reports zero vulnerabilities. The complete browser suite passes 295 tests (one optional live-model skip). Both recorded position/text baseline JSON results reproduce unchanged, including source hashes and per-query rankings.

### Deviations

- Tags reuse existing detectors and describe their current coverage; a missing tag is not proof of absence. No automatic engine sweep, learned ranking, metadata-theme merge, persistent schema migration or new provider/dependency is introduced. Engine-confirmed tactical payoff remains the separate bounded tool verifier. The new source phase context deliberately leaves the recorded hybrid policy intact.

### Insights

- A legal source move and a recognized geometric combination are insufficient evidence that a tactic works. Keeping candidate status alongside its exact branch makes that distinction inspectable and testable, even when the next recorded move refutes the motif.
- Position identity alone cannot hold context-sensitive facts such as source phase. Occurrence-bound tags preserve these differences, while source revision and ownership guards keep old controls from opening replaced or unrelated records.

---

## 2026-10-24 — Material and piece-placement position indexes

TODO items: 8.1.

### Implementation notes

- Added pure `chess/signatures.js`: versioned counts by colour and piece type, sorted occupied piece-square terms and complete placement keys. Every rules-replayed library occurrence and shared EPD position carries these derived fields; full FEN, source identity, revision, counters and verification status remain separate. Captures, en passant and all promotions update counts; castling updates squares while preserving material.
- `buildPositionIndex()` adds material/placement/piece-square buckets from actual FEN/EPD, independently of imported feature assertions. `positionFeatureMatches()` provides bounded, collection/document-filtered exact predicates with explicit match reasons, retaining repeated and collection-scoped source occurrences. Selected-square queries require real query occupants. The production debug getter exposes the current index for integration checks.
- Seven unit scenarios cover equal-value/different-material classes, transpositions, turn/rights/counters, real occupied terms, special moves, malformed inputs, forged assertions, scoped/repeated occurrences, query bounds and revision-bound compiler output. Three browser scenarios verify production indexing, original source status, no provider/game mutation, revision/deletion invalidation and equal placement with distinct full-FEN/exact-position results.
- Validation: ESLint/JSDoc checks, build, 470 unit tests and the complete 289-test browser suite pass (one live-provider and one optional live-model skip respectively). The dependency audit reports zero vulnerabilities. Offline position and text benchmarks reproduce their complete recorded JSON results, including source/case hashes and per-query rankings, unchanged.

### Deviations

- This milestone supplies the missing position features and typed lookup API. Default Reading/Combined ranking remains unchanged; no similarity weights, learned metric, new UI controls or retrieval-quality improvement are claimed. Geometry checks validate encoding, while source compilation supplies rules validation. No database schema or stored library record is migrated.

### Insights

- Equal scalar piece value loses piece-class information; equal placement loses side to move, rights and counters. Explicit keys and match reasons preserve these different meanings without conflating a structural analogy with an exact game state or objective chess evidence.
- Derived feature additions need not invalidate a frozen source benchmark. Replaying both recorded baselines demonstrates that this index extension leaves the existing measured retrieval behavior intact.

---

## 2026-10-24 — Optional SQLite library and scoped browser cache

TODO items: 7.6.

### Implementation notes

- Added `server/library-store.mjs`, `library-api.mjs` and `library-files.mjs`. `serve.mjs --library FILE` offers a private SQLite library with or without the AI gateway, mounted before its wider API handler. Private file/directory creation and canonical static-root/symlink checks keep databases outside served assets; existing public-readable/symlink/future-schema files are preserved and rejected. `.kibitz-data/` is ignored. The bundled Node SQLite API adds no npm dependency.
- Version-one owner/collection/local-ID records retain original PGN/JSON/provenance fields, with owner revisions, bound SQL, consistent reads, atomic mutations, WAL/full synchronous commits and explicit record/byte quotas. A dedicated random HttpOnly SameSite cookie selects the hashed owner; body scope/revision are preconditions. Same-origin/Host/Fetch-Site, JSON/fatal UTF-8, legality/provenance/reference validation and write-rate checks bound the HTTP surface. Error responses/logs do not expose source bodies or capabilities.
- Added pure `library/storage.js`/`server-session.js` and `cache.js`. Explicit server selection keeps the existing browser and hosted-account stores separate, without migration or automatic uploads. Serialized mutation plans recheck imports/record identities against acknowledged state. Conflicts and uncertain receipts require refresh; a lost-ack import can then deduplicate without a second write. Storage generation/owner checks reject old responses and queued work; held account/delete callbacks cannot cross contexts. Actual collection ownership controls deletion, independently of an example-kind label.
- IndexedDB caches versioned snapshots by a freshly verified scope, with bounded IDs/UTF-8 sizes and connection lifetime handling. Writes capture their input before awaiting and resolve on transaction completion; native aborts retain previous entries. Future databases/layouts/envelopes stay intact. Server acknowledgement determines save success even when the optional cache fails. Cached views are read-only, with no offline write queue; a fresh offline load cannot expose the previous cookie owner's cache.
- English/German controls name the destination, separate server/browser choices and report cache/refresh/session failures. Unchanged document objects retain source drafts across acknowledgements. Reference saves keep newly typed form input while a prior write is pending, and user reference notes remain literal text. Main game/lesson/repertoire state keeps its existing storage path; switching the library leaves play intact.
- Seventeen server tests cover restart persistence, owner/collection isolation, SQL-looking literal IDs, stale-revision rejection across connections, quota rollback, unknown schemas, private paths, HTTP cookie/origin/UTF-8/record validation and actual CLI modes. Three shared-format and nine client-session scenarios cover bounds, owner verification, serialized plans, cache-independent success, uncertain acknowledgements and stale work. Six real IndexedDB cases exercise request-success-then-abort, future formats, scopes and version changes. Eleven UI cases cover explicit selection/reload/no upload, changed cookies/offline startup, cache failure after commit, conflicts, lost acknowledgements/deduplication, held callbacks, references, save-location/deletion semantics and German phone layout. Existing import/source/search/localization regressions also pass.
- Validation: ESLint/JSDoc checks, build, 463 unit tests and the complete 286-test browser suite pass (one live-provider and one optional live-model skip respectively). All 17 focused storage/cache UI cases and 25 existing library/import/localization cases pass; the German phone screenshot was inspected. The dependency audit reports zero vulnerabilities.

### Deviations

- SQLite stores original game/reference documents; source/position/passage indexes remain derived in-memory data. IndexedDB is the optional server library's cache, while the default browser collection remains in localStorage. No legacy migration, automatic library merge, offline write queue or authenticated account service is introduced. Anonymous cookie ownership supports the local-server workflow; deployment/accounts remain 10.1–10.2, full offline loading remains 10.7.

### Insights

- A durable server commit and a browser-cache transaction have different outcomes. Treating the latter as the save result would falsely report failure after a successful commit, inviting unnecessary duplicates. Explicit refresh and conservative import matching resolve uncertain receipts without blind overwrites.
- An origin-local cache does not establish the current cookie owner. Verification must precede cached fallback after a fresh load, and changes of storage context must invalidate queued work and held controls as well as visible indexes.

---

## 2026-10-24 — Combined library metadata search

TODO items: 7.5.

### Implementation notes

- Added pure `library/search.js`, with literal case/accent-insensitive AND matching over query words, both players, opening/ECO, recorded-year bounds, absolute score and catalogue themes. Known theme IDs match exact tag membership, avoiding a false Pin match through Opening. English/localized theme labels and built-in titles participate in free text. Inclusive year ranges exclude unknown/malformed recorded years; invalid/reversed filter bounds return no results with an explicit message. Bounded inputs never become user-created regular expressions.
- Legal PGN headers supply canonical names/date/result, with legacy flat-field fallback; cached early mainline EPDs identify the deepest matching ECO label through 40 plies. Custom-start studies are not classified from final piece placement. PGN parsing is cached by collection/local ID and exact text, without changing stored records, provenance or source-verification status. Source/account updates use the existing cache invalidation boundary.
- Library controls add labelled player/opening/year/result/theme fields, result/error status, invalid-year indication and reset/focus behavior. Search includes classics beside personal games in All while preserving category filters; reset keeps the category. Existing cards update in place on late ECO readiness, keeping source-form drafts and focus. Delete/Keep cancellation still works through retained renders. English/German phone layout is covered.
- The coach's library tool shares the matcher and adds validated combined fields. Existing own-player colour/win/loss/draw semantics remain separate from absolute PGN score. At most eight bounded, quoted metadata hits return, newest known dates first; no PGN/comments are exposed by search. Local browsing makes no provider requests or storage writes and does not change the game on the board.
- Seven new logic scenarios cover combined fields, exact themes, Unicode/literal text, date/range/bounds validation, legal PGN/ECO inference, legacy/curated records, own-player outcomes, quoted results and tool validation. Seven browser scenarios cover combined local search, classics with a personal library, category/reset/error behavior, literal imported markup, source-form focus through delayed ECO data, German phone labels/queries and mock-coach parity. A missing Draw translation found by existing localization regressions was corrected.
- Validation: ESLint/JSDoc checks, build and 434 unit tests pass (one live-provider skip); the dependency audit reports zero vulnerabilities. All 35 focused browser regressions and the complete 269-test browser suite pass (one optional live-model skip). Final year-field styling is rechecked with nine search/localization cases, including phone input-height assertions and a screenshot inspection.

### Deviations

- Search is over recorded metadata, not automatic motif diagnosis, source prose or model-inferred history. Structured fields and search words are page-local rather than persisted preferences. Imported games without tags remain searchable by their other fields; position/move pattern indexing remains TODO 8.2.

### Insights

- Display, browse and coach search need the same date/result/opening facts. Legal PGN-derived labels avoid dependence on whether the opening catalogue happened to arrive before import, while explicit unknown years prevent false historical matches.
- Updating catalogue labels must not replace unrelated source editing controls. Retaining unchanged record cards keeps unsaved corrections and keyboard focus through asynchronous data readiness.

---

## 2026-10-24 — Sourced problems and checked study branches

TODO items: 7.4.

### Implementation notes

- Added `library/problem-data.js` and `problems.js`: twelve curated positions, four mates in one and eight studies/reflections. Eight original curriculum exercises join the existing Réti, Saavedra, Lucena and Philidor records, for 33 reference records including the 21 games. Source lesson/exercise IDs and immutable code references preserve lineage; English/German questions, distinct problem/study badges, a wrapping Problems filter and diagram-first opening expose the collection. Normal move controls show the recorded example. Current-game departure/return behavior is retained; viewing is not a lesson solve.
- Published Réti/Saavedra diagrams retain fixed Wikipedia revisions, contributor credits, CC BY-SA 4.0 facts and 64 source cells that reconstruct their placements. Lucena/Philidor remain explicitly authored variants under the project licence, with separate conventional-method references and unknown publication dates; the Lucena name does not establish a 1497 publication. The [manifest documentation](../site/data/problems/README.md) and shipped notices separate these sources from original teaching prose.
- The general compiler keeps imported studies at legal-replay-only status. Snapshot composition attaches checked evidence only to the curated `classic` collection after binding document/root occurrence, full FEN/counters, UCI line, result and source/score rights. Four mate tasks prove actual checkmate. All 48 worked plies preserve declared White-perspective WDL in 50 saved snapshots (28 shared curriculum records plus 22 fixed Réti/Saavedra records). Notes stay unverified; arbitrary alternatives, unique best play and learner performance gain no certificate. Flat problem metadata is detached from the trusted registry, and copied IDs/extra metadata cannot opt imports into proof.
- `check-problems.mjs` audits source/diagram/curriculum bindings, bounded bilingual metadata and every numerical snapshot digest offline. Its explicit `--refresh` queries only the 22 fixed published-study FENs, serially, strips response prose/SAN, validates the collection and atomically replaces the data. No account/browser position is read or sent. Shared curriculum evidence retains its separate refresh command; ordinary/cursed/uncertain outcomes and DTZ/DTM remain distinct through the existing adapter.
- Seven logic scenarios cover collection coverage, detached metadata, forged imports, changed counters/branches/results/rights, colour/turn-sensitive outcomes, failed queen promotion in Saavedra, actual mates versus nonmates, uncertain evidence, independent diagram reconstruction, source/digest tampering, fake refresh clients/errors and an offline default. Five browser scenarios cover filtering with a personal library, no remote/provider requests or false progress, diagram-first White/Black mate examples, forged imported proof, live-game cancel/return, German phone wrapping/labels and method links. Existing source/library/localization regressions also pass.
- Validation: ESLint/JSDoc checks, build, offline source audits and 427 unit tests pass (one live-provider skip). The complete browser suite passes 262 tests (one optional live-model skip); the final colour-label adjustment is checked again with the unit suite and 19 focused browser cases.

### Deviations

- This is a curated starter collection of endgame tasks, reusing checked authored material alongside the two published studies and two conventional variants. It does not claim a complete problem corpus or a proof tree over every defence. The Library exposes worked-line inspection on its normal analysis board; interactive lesson solving/progress remains the separate lesson player. No source-view completion is converted into mastery or a performance grade.

### Insights

- Equal piece placement is insufficient for result evidence: side to move and counters can change the outcome. Matching an imported ID is also insufficient for source trust. The exact document/source/branch binding keeps objective chess facts separate from imported claims and prose.
- A named conventional position need not be the original published diagram. Recording authored variants and their method references avoids borrowing a historical date or a source's licence for a different setup. Shared curriculum examples also need stable lineage rather than duplicated, independently drifting solutions.

---

## 2026-10-24 — Published classic-game sources and expanded collection

TODO items: 7.3.

### Implementation notes

- Expanded the built-in collection from nine to 21 games, alongside the four existing studies. `library/capablanca.js` adds twelve complete scores from Part II of Capablanca's 1921 *Chess Fundamentals*, with per-game/page attribution, the source's public-domain-in-the-USA statement, theme tags and original Kibitz teaching notes. Games 3 and 6 omit their final played moves in the book and are excluded. Notes' concrete final-position facts are checked independently with chess.js; resignation results remain source reports.
- `classic-sources.js` and `data/classics/historical-scores.json` identify fixed Wikipedia revisions, contributor attribution, CC BY-SA 4.0 move-data rights, retrieval dates/digests and normalized score facts for the nine earlier versions. External prose, variations and judgement glyphs are excluded. Original teaching notes keep their separate GPL-3.0-or-later assertion. The shipped notices and [source manifest documentation](../site/data/classics/README.md) preserve licence links, changes and scope rather than relicensing the CC BY-SA data as GPL-3.0-or-later.
- `check-classics.mjs` audits all 21 games/1,355 recorded plies offline. Its bounded descriptive-notation helper reconstructs the 980 book plies by searching legal candidates across each entire score, retaining original-side piece identity through castling and checking relative squares, captures and checks. It requires a unique recorded branch, rejects invalid/ambiguous/oversized data and uses a state budget. Matching a published score establishes transcription consistency, not unique best play or a forced result.
- Cards/source details/own PGN notes disclose that Réti's game ended with resignation after 10.Bg5+, with the last two plies a teaching continuation. Légal uses the cited traditional teaching move order and unknown date, explaining the disputed date/order/rook odds. New title references recognize dated English/German forms without linking a bare player name. Reading localizes individual theme labels before joining them; a newly exposed multi-theme German gap has a browser regression.
- Froze the original thirteen-record retrieval fixture at `b1c4782` so production growth/history corrections cannot silently change prior experiments. Provider-free position/text runs reproduce the existing corpus hashes exactly (`60270e…`/`fdc2ad…`), including 21 documents/481 occurrences/45 annotations and 159 text passages. Existing source/collection tests now cover all games and retain explicit study exclusions.
- Five new logic scenarios cover source binding/transcription, tampering, independent board facts, teaching-history distinctions and ambiguous/invalid notation. Three browser scenarios cover the expanded collection, exact game opening/notes, read-only separate rights, no source/provider download, historical distinctions and German phone/theme labels. The phone source panel was inspected visually.
- Verification: lint, JSDoc types, build and the offline 21-game audit pass; all 420 unit/gateway tests and all 257 browser tests pass, with one opt-in live test skipped per suite. The clean full browser rerun follows two corrected collection-size expectations in opening tests. Provider calls use mocks/fake clients. PRs 69 and 70 are green in CI.

### Deviations

- The collection records published versions actually checked, with fixed revision/page references. It does not claim to authenticate every first historical publication; disputed teaching versions stay labelled. The two incomplete book scores are not completed from memory or mixed with another source. Study-source verification remains the separate 7.4 milestone. Public-domain status is recorded as supplied for the USA, without a blanket worldwide assertion.
- The retrieval benchmark remains a fixed development corpus; this addition makes no new retrieval-quality or learner-outcome claim about the larger production library. Its earlier metadata remains in the snapshot for reproducibility.

### Insights

- Legal replay alone cannot establish historical provenance. Published scores can omit moves, normalize dates or include a later demonstration after resignation. Binding source versions and showing these distinctions prevents a valid chess line from becoming a false historical claim.
- A growing production catalogue must not silently alter measured evaluation corpora. Freezing the original records preserves published hashes and comparisons while letting current source metadata and teaching material improve.

---

## 2026-10-24 — Conservative PGN import deduplication

TODO items: 7.2.

### Implementation notes

- Added pure `library/import.js`: bounded PGN batch splitting and a derived exact source-document identity. Top-level boundaries support adjacent/headerless games while preserving tag-like text inside comments/variations. Legal mainline/full-FEN validation precedes matching. Outside whitespace, mainline move-number spacing, header order and line-ending convention can vary; original comments, variations, glyphs, explicit/parsed headers and separate source/licence assertions participate in identity.
- Import compares against this user's current library and earlier batch entries, keeping the first document and every existing ID/PGN/revision intact. Entry origin and generated IDs/timestamps do not change content identity. Legacy records can match without migration; invalid/future metadata and unkeyable documents cannot suppress valid imports. Different source versions remain separate rather than merging annotations/rights.
- Rechecked deduplication after asynchronous validation, immediately before writes. Duplicate-only imports perform no storage write or index rebuild. Overlapping imports are disabled; added/duplicate/unreadable/failed counts remain separate and localized. Failed/unreadable batches and newly typed replacement input stay available. Limits are 500 games/5 million characters plus the existing per-document limits. Temporary unsaved snapshot cache entries are removed after an attempt.
- Existing local rollback protects failed writes. Account imports remember individually acknowledged records until snapshots arrive, preventing duplicate partial-save retries during that delay; failed writes gain no credit. Seven browser scenarios cover repeat/within-batch/reloaded matching and zero writes, distinct source content, legacy/future preservation, mixed outcomes and quota retry, delayed overlapping input, fake-account partial acknowledgements and German phone layout. Five logic scenarios cover exact identity, preservation counterexamples, full-FEN studies, invalid/legacy data and bounded source-aware splitting. The phone form/status was inspected visually.
- Verification: ESLint, JSDoc types and build pass. The complete suites passed 415 unit/gateway tests and 254 browser tests, with one opt-in live test skipped per suite. After the final temporary-cache cleanup, all 415 unit tests and all sixteen focused import/library browser regressions passed again. Providers/account storage use mocks or fake clients.
- CI CodeQL flagged a first-occurrence replacement in the result-variant test fixture. The fixture now uses `replaceAll`; all five import logic scenarios and lint/types pass after the correction.

### Deviations

- Deduplication matches conservative source documents rather than fuzzy game identity. Differently annotated/headered/licensed versions can remain separate even with the same moves, and built-ins are outside the user's import scope. Existing duplicates are not deleted. Account matching uses the current client snapshot plus its acknowledged imports; a future server uniqueness transaction is needed for simultaneous devices.

### Insights

- A mainline-only hash would silently discard distinct annotations, variations and attribution. The original PGN must remain the evidence document; normalization only belongs in a derived comparison key.
- A successful account write can precede its subscription snapshot. Remembering acknowledgements is necessary for retry-safe deduplication, while counting only records visible in the UI would create new IDs during that gap. Duplicate-only imports must avoid writing so that quota failures cannot turn a harmless repeat into an apparent failed save.

---

## 2026-10-24 — Play lesson positions against Stockfish

TODO items: 6.8.

### Implementation notes

- Added pure `curriculum/playout.js` and an owned cancellable confirmation dialog. The lesson player offers either colour from its displayed exercise/worked-example position, preserving full FEN counters and applicable rights. Finished/invalid diagrams cannot start a game or silently fall back to the opening position. The chosen colour applies to this game without changing the saved start/colour preferences.
- Both normal starts and the lesson handoff use the same engine/clock lifecycle, current strength/time settings, save and review controls. Opponent-first positions schedule a normal Stockfish reply. Starting practice makes no automatic exercise-completion claim. Native confirmation explains the selected side/settings and saves an active game with moves as unfinished before replacement; failed saves leave the game intact and support retry.
- Pending requests serialize across detached saves. Abort signals, owned dialog identity, lesson render/session identity and the main game's generation/checkpoint reject cancelled, changed and held actions. The checkpoint also covers metadata/comments. Generic game confirmations require their original connected element and game generation, preventing a cancelled old resignation from ending a new lesson game.
- Four logic scenarios cover exact source positions, side selection, counters/en passant/castling normalization, terminal versus theoretical drawn positions and invalid input. Ten browser scenarios cover worked-position starts, opponent-first replies, saving/reopening custom-FEN practice, cancel/confirm, storage failure/retry, old confirmations, lesson navigation, delayed saves with main-game or lesson changes, serialized replacement requests and German phone layout. The phone dialog was inspected visually.
- Verification: ESLint, JSDoc types and build pass; 410 unit/gateway tests and 247 browser tests pass, with one opt-in live test skipped per suite. Provider calls use mocks/fake clients. The preceding progress PR is green in CI.

### Deviations

- The current game keeps running while confirmation or saving is pending. A changed position/state prevents replacement and asks the player to start again; a previously authorized detached snapshot may already have saved. This preserves running-game behavior without pausing/resuming clocks around a separate lesson board. Practice games use ordinary game progress/review rather than being graded as lesson solutions.

### Insights

- A lesson's displayed worked position can differ from both its initial diagram and the attempted solution. The explicit handoff must capture that full FEN and validate that it remains playable. A theoretical tablebase draw is still a useful practice position; a rules-ended game is not.
- Cancelling a dialog does not cancel a storage write already in flight. Serializing subsequent handoffs and checking both the lesson and main-game context after the write prevents an older request from replacing a newly selected game.

---

## 2026-10-24 — Saved lesson and theme progress

TODO items: 6.7.

### Implementation notes

- Added pure `curriculum/progress.js` and a separate `progress-ui.js`. Version-1 browser-local records keep mate proof, source recall, rubric self-assessment (met/needs practice), revealed examples, unassisted completions, legal choices, hints, outside-reference choices and worked-example use separate. Validated Coach challenge counters appear alongside per-theme lesson counts. Catalogue badges and lesson/theme tables show practice, without a mastery/Elo claim or prerequisite lock.
- Progress identity includes the stable exercise ID and exact goal/FEN/line/source/prompt/rubric revision. Changed tasks retain old results separately and receive no borrowed credit. Bounded counters, record/revision sizes, timestamps and recent completion IDs are validated on read/write. Malformed or future saved data remains untouched/read-only; reflection responses are never stored. Revision bounds allow JSON escaping of otherwise valid bounded teaching text.
- Completion callbacks queue results in memory before saving. Atomic single-key writes precede in-memory publication; failed results stay queued across exercise/game changes for retry, with recent-ID deduplication. Reads before writes retain sequential tab changes; storage events refresh lesson results from other tabs. Queue status explains actual failures. Successful retry restores focus to status; catalogue badges update in place, preserving open details, filters and the player's return-focus target.
- Seven logic scenarios cover result/evidence aggregation, help counts, save/reload, quota failure and idempotent retry, sequential tabs, corrupt/future data preservation/recovery, exact revision separation and escaping, invalid completions and separate validated Coach counters. Seven browser scenarios cover persistence/badges/focus, source recall and Coach counters, reflection privacy/reveal distinction, multiple pending results and retry, future-data recovery, revised tasks and German phone tables. The phone summary was inspected visually.
- Verification: ESLint, JSDoc types and build pass; 406 unit/gateway tests and 237 browser tests pass, with one opt-in live test skipped per suite. Twenty-five focused curriculum/player/progress scenarios also passed; provider calls use mocks/fake clients.

### Deviations

- Results are local to the browser, with no server synchronization, new provider request or automatic skill estimate. Counts cover completed/revealed exercises, not an unfinished board or written draft. Pending failed saves remain in the current tab and need retry before it closes/reloads. localStorage's single-key write is atomic; simultaneous multi-tab read/modify/write operations are not database transactions. Profile/server storage work remains separately tracked.

### Insights

- A completed interaction can be a checked mate, source recall, rubric self-report or revealed example. Tracking those classes separately makes useful practice visible without calling every completion mastery.
- Re-rendering the whole catalogue after a save would detach the exercise button used for return focus. Updating badges in place preserves keyboard flow and filter/detail state. Task revisions must include the learning question/rubric as well as the move line, and account for JSON escaping when enforcing bounds.

---

## 2026-10-24 — Isolated lesson player and authored tutor hints

TODO items: 6.6.

### Implementation notes

- Added pure `curriculum/session.js` and a separate `player.js` renderer, composed by the page. Catalogue exercise buttons open a detached Chessground board with the lesson introduction/objectives, exercise selector, legal destinations, SAN/UCI input (including German piece letters), worked-line navigation and reveal/restart/close. Main-game state and analysis are untouched; lesson use starts no model/engine request.
- Mate tasks accept any legal actual checkmate, including alternatives to the recorded move; legal non-mates in one-move tasks receive a rules-based explanation. Other source puzzles check recorded-line recall and automatically replay one recorded opponent reply. Outside-reference legal choices keep the board unchanged and receive no independent strength verdict. Written reflections require a bounded literal answer, then a locked rubric comparison and explicit self-assessment. Revealing records a viewed example rather than a solve.
- Tutor hints use authored objectives, then the current origin square and recorded next SAN. Hint stages reset after a successful move while total help use stays attached to the attempt. Worked-example use and reveal remain separate. Completion callbacks distinguish mate proof, source recall, reflection self-assessment and revealed examples, with attempt/outside/help metadata for 6.7; no progress store is claimed yet.
- Explicit promotion dialogs handle both board moves and bare typed promotion squares, retaining the selected piece. Session identity, render versions, dialog identity and the captured main-game generation reject held events; game replacement closes the player. Worked-view arrows/Home/End stay scoped to its board, controls restore keyboard focus and close returns to the originating catalogue button. Localized accessibility attributes bypass the page’s second translation pass.
- Six logic scenarios cover all 100 exercises, detached state, alternate actual mates, legal non-mates, source recall/replies, explicit underpromotion, bounded literal reflections, self-assessment/reveal and rejecting lines past automatic game end. Six browser scenarios cover isolated play/hints, source setup and replies, worked-key navigation and held controls, reflection, promotion/replacement, game-generation invalidation, close/focus and German phone layout. The phone preview was inspected visually.
- Verification: ESLint, JSDoc type checking and build pass; 399 unit/gateway tests and 230 browser tests pass, with one opt-in live test skipped per suite. Provider calls use mocks/fake clients. The inherited puzzle-source PR’s CodeQL and browser CI corrections are green.

### Deviations

- Tutor hints and explanations are authored and available offline. Source-line recall and reflection self-assessment are labelled as such; no model-generated correctness grade, fresh strength verdict for arbitrary alternatives or measured learning gain is claimed. Persistence and per-theme aggregation remain 6.7; playing a lesson against Stockfish remains 6.8.

### Insights

- A rules-proven mate, recall of a source solution and an authored reflection rubric are different evidence classes. Separate completion kinds let later progress summaries preserve those distinctions rather than count every interaction as mastered chess.
- Session identity alone does not reject a held navigation button after a worked-view cursor change. A render version guards those controls too, and promotion callbacks additionally require their original dialog. Manual localization must cover attributes as well as text nodes to avoid duplicate translation.

---

## 2026-10-24 — Lichess puzzle source and offline import pipeline

TODO items: 6.5.

### Implementation notes

- Added the first 64 unchanged rows of the public Lichess CC0 export as a small starter source, with the exact CSV, retrieval/selection metadata, ETag/Last-Modified and SHA-256 digest. `scripts/import-puzzles.mjs` regenerates bounded JS records offline; `--check` verifies the saved bytes and generated output. No download runs implicitly. Source attribution ships in the third-party notices.
- The pure importer accepts quoted CSV, BOM/CRLF and current eleven-column or legacy ten-column schemas, with 1 MB/1,000-record bounds. It validates IDs, numeric metadata, theme/opening tokens, safe Lichess URLs, diagrams, rights, UCI moves, end conditions and mate claims. It applies the first opponent move before exposing the learner’s FEN/solution, retaining the source FEN, setup UCI/SAN, counters, original themes, ratings, opening tags and game/puzzle links.
- Four editorial rating groups contain 20/27/13/4 puzzles and join the Lessons catalogue. The complete catalogue has 34 lessons/groups and 100 exercises. Case-sensitive source IDs are encoded into stable lowercase curriculum IDs. The compiler revalidates records and binds exercise IDs, full FENs, lines and mapped themes to source-derived facts. Source themes remain distinct from motif detection; the new Zugzwang filter label adds no detector. Ratings, CC0 attribution, raw themes and validated external links render safely in English/German.
- Seven unit scenarios cover exact offline regeneration/digests, setup semantics and counters, every saved legal line, en passant/castling/underpromotion, mate checks, CSV/schema/bounds, malformed source data, URL rejection, metadata normalization, Unicode opening tags, case-sensitive IDs and source-to-exercise binding. Two browser scenarios cover rating/theme filters, links/attribution, no remote/provider requests, board isolation, unsafe metadata rejection and German phone/keyboard use.
- Verification: ESLint, JSDoc types, build and both offline data audits pass. Unit/gateway suite: 392 passed, one opt-in live test skipped. Full browser suite: 224 passed, one opt-in live test skipped. After the final import hardening, the rebuilt source also passed the complete unit suite and all twelve curriculum browser scenarios. Provider calls use mocks/fake clients.
- CodeQL review replaced separate path-stat/read operations with descriptor-based bounded reads and fatal UTF-8 decoding, covered by an additional file-boundary test. The browser request spy now parses URLs and compares exact hostnames instead of using a hostname substring regex. After these corrections, lint/types, the offline import audit, all 393 unit/gateway tests (one live skip) and both puzzle browser scenarios pass.

### Deviations

- Bundled a documented starter prefix rather than the entire multi-million-puzzle database. It demonstrates ingestion and source-aware catalogue use, not representative theme coverage, calibrated teaching difficulty or measured learning benefit. Lichess rating bands are editorial navigation, not playing Elo. Interactive solving, hints and alternative-answer grading remain 6.6. Local legality/mate checks do not independently verify other source strength or theme claims.

### Insights

- Lichess’s first UCI move belongs to the opponent. Showing the raw database FEN would present the wrong side and task; applying the setup move is a data-model invariant rather than a UI convention.
- Source IDs use both cases. Lowercasing them would merge distinct puzzles; encoding each character preserves identity within the curriculum’s existing ID alphabet. Keeping the original CSV also makes generated records auditable when the live export later changes.

---

## 2026-10-24 — Endgame lessons with recorded Syzygy evidence

TODO items: 6.4.

### Implementation notes

- Added five bilingual lessons beside the queen/king foundation: rook/king mates for both colours, king and pawn with a blocked rook-pawn counterexample, direct opposition with either side to move, Lucena’s bridge and Philidor’s defence. The complete catalogue contains thirty lessons and thirty-six exercises. Endgames have six lessons and ten exercises, with objectives, prerequisites and original explanatory rubrics.
- Recorded numerical Syzygy facts for all 28 worked plies using the public Lichess API. Full FEN, source URL, retrieval timestamp and SHA-256 digest accompany each saved result. `scripts/check-endgames.mjs` audits offline by default; explicit `--refresh` queries only authored diagrams, validates everything and atomically replaces the snapshots. No live test or browser tablebase request is needed.
- A pure evidence adapter validates at most seven pieces, canonical legal full FEN without castling rights, complete legal move lists, numeric DTZ/DTM and terminal facts through chess.js. The compiler checks the declared result at every recorded position and after every move. Move categories describe the child side to move; results are converted to White’s perspective. Uncertain, unknown and cursed/blessed categories cannot substantiate an ordinary win/loss claim. DTZ is never labelled distance to mate.
- The Lessons catalogue shows the checked result/date and its exact-position/branch scope. Six unit scenarios cover both colours, turn-dependent opposition, the drawn rook pawn, legal non-stalemating promotion, complete branches, child perspective, unsupported categories, changed counters, absent/malformed evidence and offline digest auditing. Two browser scenarios cover result labels, advanced filters, no external/provider requests, game isolation, German phone layout and keyboard access.
- Verification: ESLint, JSDoc type checking, build and the offline tablebase audit pass; 385 unit/gateway tests and 222 browser tests pass, with one opt-in live test skipped per suite. Provider requests use mocks or fake clients.

### Deviations

- Evidence is bundled for fixed teaching diagrams rather than fetching arbitrary player positions at runtime. This completes the authored endgame catalogue and its tablebase checks; interactive play and alternative-answer grading remain 6.6. A checked branch preserves the result, but does not claim a unique best move or force the opponent to follow that branch. Conventional diagrams do not resolve the separately tracked historical publication/licensing work in 7.3/7.4.

### Insights

- The same opposition placement is drawn with White to move and winning for White with Black to move. Reading the latter API `loss` as a White loss would reverse the lesson; a child move’s category needs the opposite turn again.
- EPD is suitable for the project’s engine cache, but full FEN is required for this evidence: fifty-move counters can change tablebase results. Missing evidence for a changed counter fails closed instead of borrowing a nearby snapshot.

---

## 2026-10-24 — Strategy lessons and checked structural examples

TODO items: 6.3.

### Implementation notes

- Added ten original English/German strategy reflections beside the existing king-activity lesson: IQP, Carlsbad, hanging pawns, weak squares, outposts, good/bad bishops, open files, king safety, piece activity and prophylaxis. The catalogue now has twenty-five lessons and twenty-eight exercises. Stable IDs, authored levels, objectives, prerequisites and rubrics use the existing validated hierarchy.
- Added seven strategy labels and German translations for topic filtering. These are authored lesson themes, not additional position detectors. Optional `positionTag` metadata on the three pawn-structure examples must be known, present in exercise tags and returned by the existing feature detector for that FEN.
- All demonstrations are legal reflections. Board-fact tests check the available pawn capture after an IQP advance, changing pawn support, an exchangeable supported outpost, bishop/pawn square colours, an open file, changed pawn cover, knight attacks and a possible king flight square. Text distinguishes these observations from a best-move or winning-plan claim.
- Five new unit scenarios cover the complete strategy scope, bilingual records, the concrete board facts, false/untagged structure rejection and precise level/theme filters. Two browser scenarios cover module browsing, advanced-level filtering, board isolation and German phone labels/text. Existing catalogue count expectations track the larger material.
- Verification: ESLint, JSDoc type checking and build pass; 379 unit/gateway tests and 220 browser tests pass, with one opt-in live test skipped per suite. Provider calls use mocks or fake clients.

### Deviations

- This completes authored strategy material for the catalogue. Interactive solving/grading remains 6.6; expert review and measured difficulty/learning outcomes are not claimed. Structural labels and legal candidate demonstrations do not replace current-position engine checks.

### Insights

- Pawn safety is narrower than piece safety: a pawn-supported square can still be exchanged by a knight. The example teaches both relationships together.
- A preventive pawn move can create a flight square without answering an immediate threat or being the best move. Explicit rubrics keep a useful observation separate from an unjustified recommendation.

---

## 2026-10-24 — Tactical concept lessons and defensive counterexample

TODO items: 6.2.

### Implementation notes

- Expanded `src/curriculum/tactics.js` with twelve original English/German lessons alongside the existing back-rank lesson, covering all thirteen listed tactical themes. The full catalogue now contains fifteen lessons and eighteen exercises across three modules. Levels and acyclic prerequisites keep basic relationships before intermediate/advanced combinations.
- Added optional exercise `pattern` metadata. The compiler requires a known, tagged motif present in the existing move/line detectors for the recorded legal example. This verifies the claimed geometric relationship; it does not certify a best move, forced line or material payoff. Multi-move illustrative branches remain reflection exercises; mate goals still require terminal checkmate.
- Added a capturable-fork counterexample with the legal defending rook capture recorded. Deflection/overloading lessons compare the same relationship from different perspectives; prose asks readers to check alternative defences. The new queen/bishop mate example ends in rules-verified checkmate.
- Four new unit scenarios check complete theme coverage, bilingual examples, the concrete defensive capture, false/untagged pattern rejection and level/theme filtering. Two browser scenarios browse the full tactics module, the counterexample and an advanced theme, including German phone layout. Updated the catalogue count expectations.
- Verification: ESLint, JSDoc type checking and build pass; 374 unit/gateway tests and 218 browser tests pass, with one opt-in live test skipped per suite. Provider requests use mocks or fake clients.

### Deviations

- This completes authored tactical material for catalogue use. Interactive solving and grading remain 6.6. Recorded branches and geometric recognition are explicitly separated from engine-confirmed tactical strength; no empirical difficulty or learner-benefit claim is made.

### Insights

- A legal refuting capture is a useful teaching example: a fork can be correctly recognized while the move loses its knight. A motif label must not serve as a correctness grade.
- The same legal branch can illustrate deflection and overloading. Explicit objectives and rubrics explain the relationship without treating either label as a new proof of strength.

---

## 2026-10-24 — Curriculum records and Lessons catalogue

TODO items: 6.1.

### Implementation notes

- Added `src/curriculum/` with a pure JSDoc-typed record compiler, original English/German material and a separate catalogue UI. Stable module/lesson/exercise IDs, levels, known themes, objectives, source/licence fields and prerequisite DAGs are bounded and validated. Inputs and filtered results are detached.
- The initial three modules contain three lessons and five authored exercises: back-rank mates for both colours, a king-activity reflection and queen/king mate nets. chess.js validates positions and legal UCI lines, normalizing castling rights before replay. Mate records must end in checkmate for the learner; reflection lines make no unique-best-move or winning claim.
- Added a keyboard-accessible Lessons tab and literal module/lesson summaries, goals, prerequisite titles and exercise prompts. Local filters use a level ceiling, module and theme. Browsing starts no model/engine request and never changes the active game. Localized lesson prose is separate from interface translation; explicit formatted labels avoid a second translation pass. Saved player levels are validated before application startup, and the catalogue also validates its initial filter.
- Five unit scenarios cover the catalogue, filtering/detachment, schema limits, missing/duplicate IDs, translations, levels, prerequisites/cycles, illegal lines, unsupported mate claims and castling normalization. Browser scenarios cover filtering/game isolation, hostile literal text, German phone/keyboard behaviour and corrupt saved levels. Updated the grouped-navigation expectation for the new tab.
- Verification: ESLint, JSDoc type checking and build pass; 370 unit/gateway tests and 216 Playwright tests pass, with one opt-in live test skipped in each suite. No real AI provider is used.
- Linux CI exposed a citation-test assumption: Qh5 can appear in a real engine continuation from the fixture. The test now supplies fixed legal engine lines for its current/previous positions, retaining the strict source-is-not-engine-evidence assertion independently of machine-dependent PVs.

### Deviations

- This completes the records and catalogue in 6.1. Expanded tactics/strategy/endgames, puzzle ingestion, the interactive lesson player, grading, progress and play-out remain separately tracked in 6.2–6.8. Prerequisites describe a learning sequence; no progress lock is imposed before 6.7 exists.

### Insights

- Legal replay, proved terminal mate and an authored reflection rubric are different evidence classes. Keeping the exercise goal explicit avoids treating every recorded move as a unique engine-approved answer.
- Browser consumers of pure modules must update together, and translated teaching text should bypass the interface translator. Catalogue filters belong to their panel rather than the active board or global coach state.

---

## 2026-10-24 — Organize source modules by responsibility

TODO items: 0.14.

### Implementation notes

- Moved all 30 existing JavaScript modules into `site/src/chess/`, `coach/`, `library/`, `openings/` and `platform/`. Updated page imports, module imports and JSDoc type imports, gateway consumers, opening/calibration scripts, retrieval evaluators and tests. Source references and built-in provenance point to the new locations.
- The build recursively copies the module tree, removes obsolete application assets and retains generated opening tables until their inputs change. Vendored libraries, Stockfish workers/WASM and generated opening data remain at the distribution root. Updated the opening compiler's imports and rebuild inputs.
- Added distributable checks that every source module is copied at its relative path, flat duplicates are absent, and page/module imports resolve inside `dist/`. Existing browser workflows exercise the reorganized module graph, including the engine import used by the delayed-reply regression.
- Updated AGENTS, architecture and layout documentation to describe the directories and their responsibilities.
- Moving the packaged classics source URL changes the position benchmark's corpus hash. Regenerated its recorded JSON/Markdown through the provider-free evaluator and confirmed the hash is the only report change; rankings, cases and metrics are identical.
- Verification: lint, JSDoc type checking and the build pass; 365 unit/gateway tests and 212 Playwright tests pass. One opt-in live test is skipped in each suite; provider requests use mocks or fake clients.

### Deviations

- The requested scope is the organization of existing JavaScript modules. The page still composes them through its inline application module, preserving the artifact and local-page formats.

### Insights

- A source move reaches more than browser imports: the gateway and offline benchmarks consume the same pure modules, and JSDoc imports need the same path updates.
- Removing old build assets makes missing path migrations visible instead of allowing stale flat files to satisfy imports.

---

## 2026-10-24 — Retrieved coach passages and exact source citations

TODO items: 8.6.

### Implementation notes

- Added pure, JSDoc-typed `retrieval-context.js`. Local keyword/exact-pawn/tag retrieval supplies at most three distinct annotation/guide sections with 900-character Unicode-safe excerpts. Imported title/source/author/licence/text go through `quote()`; historical FENs, match reasons and source assertions remain separate from engine evidence. General chat uses its question without the active board; position questions and tutor aspects/themes use their captured board. No implicit embeddings or fuzzy expansion.
- SHA-256 bundle identities bind citation namespaces to canonical records, query, board, language and account. Only tokens supplied with that answer become compact numbered source buttons; invented tokens stay text with a notice. Source details show supplied excerpts/licence assertions and match classes. Clicking rechecks the canonical passage, revision and exact occurrence, legally replays the PGN and preserves full FEN counters. FEN roots and repeated boards open the correct source step. Leaving live play requires confirmation and keeps the game/clock return snapshot and dialogue.
- Source/account/help/provider changes revoke pending work/actions and remove source excerpts, including with Library closed. Source-bearing model history is cleared on policy changes. Restricted live help supplies no passages even in General chess; the older uncited similar-position prompt block is replaced. Successful board tools prepare fresh source context for their next model turn. Tutor cache keys include the bundle identity, preserving citations on cache hits/reload without binding old prose to changed evidence. The composer discloses source text accompanying questions; German strings and literal user/title rendering are covered.
- Four new unit scenarios cover detached/stable request identities, repeated occurrences, foreign tokens, quote boundaries, Unicode/count bounds, language/deduplication/revisions, empty results and restricted lookup. Eleven browser scenarios cover chat/tutor/cache citations, forged tokens/HTML and unsupported source moves, deletion and held actions, live restrictions/history, late main/scratch results, confirmation/return, FEN roots, board-tool refresh and policy changes during confirmation, study-note expansion and German phone layout. The provenance regression now checks source ply/full-FEN/excerpt packets instead of the replaced uncited prompt wording.
- Updated the root README with the motivation to experiment with LLMs and symbolic solvers, and links to the Primer's text and PDF for readers learning about search, grounding, tool use and agents through Kibitz.
- Verification: `npm run check` and the build pass; 363 unit/gateway tests and 212 Playwright tests pass. One opt-in live test is skipped in each suite; no real AI provider is called.

### Deviations

- This is bounded automatic local retrieval at existing coach request boundaries. Model-requested passage tools, dense/fuzzy tutor retrieval, semantic entailment/abstention checks and outcome evaluation remain future extensions. Library search controls do not silently configure coach lookup. No new provider, dependency, external corpus, gateway route or `llmkit` code was added.

### Insights

- Valid citation identity establishes which supplied source can open, not whether a claim is supported or a source's advice transfers. Source moves must never be added to Stockfish evidence just because they have a citation.
- The source bundle belongs in the cache key and the async policy fence. Correct move numbers alone cannot protect a cached answer or a pending source action after account/revision/help changes.
- A historical EPD can match twice while its full FEN counters and occurrence differ. Preserve the original occurrence through both retrieval and the final legal replay.

---

## 2026-10-23 — Fuzzy pawn-structure distance

TODO items: 8.5.

### Implementation notes

- Added pure, JSDoc-typed `pawn-distance.js`: bounded pawn-signature decoding into literal colour/square sets and Jaccard distance with shared/union counts plus detached directional difference lists. Empty/empty is zero at the feature level; retrieval separately refuses empty-pawn analogies. No colours, directions or board reflections are normalised, and no connecting move sequence is inferred.
- Combined search adds optional **Include similar pawn structures** under explicit board relevance, defaulting off. Its fixed maximum distance is 0.25, equivalent to at least 75% shared colour/square tokens in their union. The position channel orders exact boards first, then compatible pawn candidates by increasing distance and stable ID; turn/check/phase, source/language/collection and literal-term constraints remain in force. Hybrid policy advances to `rrf-board-terms-v2` with the pawn metric version; embedding input/identity is unchanged.
- **Why this result** distinguishes exact boards, identical pawns and similar structures, and shows shared counts plus current-only/source-only squares with pawn colours. Source navigation retains its exact legal occurrence, including FEN roots. Toggling the distance option cancels pending results and held actions without erasing valid source vectors or automatically uploading a query. Existing game/scratch/source/help-policy boundaries remain enforced; FEN/feature data stay local.
- Root `utils/retrieval-eval.mjs --mode pawns` adds an offline component comparison over ten original source diagrams/eight manually labelled spatial queries. Both variants use the production profile/retrieval path and identical dynamic/source checks; no dense candidates or text matches supply filler. The adapter sees no gold labels or case IDs. The shared text runner now accepts explicit authored corpora/guide sets while preserving existing defaults and recorded baselines.
- [Recorded JSON/Markdown](eval/retrieval/pawn-distance.md) gives precision@1 0.800 and recall@3 0.750 for fuzzy matching, versus 0.400/0.250 with exact pawn placement; both reject its three no-answer requests. The one-pawn single-square advance is deliberately relevant and remains missed because its square sets are disjoint. These constructed, shared-family development cases do not establish general retrieval quality, advice transfer or teaching benefit.
- Eleven new unit/evaluation scenarios cover independent overlap/bit arithmetic, metric bounds on an enumerated feature universe, colour/empty/invalid cases, cutoff boundaries, graded ordering, dynamic eligibility, scope, detached explanations, canonical source locators, sparse misses and provider-free CLI/report reproduction. Six browser scenarios isolate structural candidates with orthogonal fake embeddings, then check explicit opt-in, exact source navigation, stale work/held actions, restricted help, deletion, scratch turn changes and translated German phone explanations.
- Validation: lint/types, a fresh build and the full mock-provider unit/gateway suite pass (359 passed, one opt-in test skipped). All 201 browser scenarios pass across two runs, with one opt-in live-model skip: the initial full run stopped after case 190 with a disk-full reporter error; all 26 tools/tutor/UX cases then passed, covering every remaining case. All thirteen targeted hybrid/pawn scenarios also pass. The German phone layout was inspected without overflow or untranslated controls. Recorded pawn JSON/Markdown reproduce exactly, all 75 checked local documentation links resolve and the staged diff passes whitespace checks.

### Deviations

- Chose the transparent square-set overlap baseline from the similarity research; the cutoff is an explicit heuristic, not a tuned relevance threshold. A one-square and a distant relocation have the same feature cost, and a missing pawn is cheaper than moving it. Assignment/transport or learned distances need separate definitions, labels and evaluation.
- The runtime consumer is Combined Library passage search. The older Reading/coach `similarPositions()` buckets and their original position benchmark remain unchanged; richer position-index work remains 8.1. Material/placement features, richer motif indexing and tutor retrieval/citations remain 8.1/8.2/8.6. No new provider, dependency, external corpus or `llmkit` code was added.

### Insights

- Distance zero on pawn features is not board identity, and empty pawn sets need an explicit retrieval eligibility rule. Rights and side still belong to the exact board key.
- A graded overlap baseline recovers some useful structural neighbours while visibly missing sparse endings. Keep that failure in the labels rather than choosing a cutoff that hides it or presenting distance as confidence.
- Fuzzy-match intent belongs in the same captured query state as board FEN and literal-term policy. Changing it can invalidate an asynchronous result or held source action without changing the game generation.

---

## 2026-10-23 — Hybrid passage retrieval with explicit board intent

TODO items: 8.4.

### Implementation notes

- Added pure, JSDoc-typed `hybrid-search.js`: up to twenty eligible candidates each from BM25, dense cosine, exact/nonempty-pawn relations and position-feature tag overlap. Reciprocal Rank Fusion uses constant sixty and stable passage IDs; raw scores never share a scale. Full literal term matches, then exact boards, rerank the fused candidates. Source/language/collection filters precede every channel, and dense IDs resolve to canonical local source records rather than provider-supplied metadata.
- Chess.js checks source/query boards. Pawn analogies require matching turn, check and phase, and exclude pawnless positions. Annotation tags come from position features; authored guides contribute their known catalogue concept without an invented FEN. Generic phase/king-activity tags and imported prose claims do not create thematic boosts. Incompatible historical boards may still match text, but receive no board/tag boost. No engine or motif-verification claim is added.
- Library adds optional **Combined** search with **Favor the current board**, **Require every search term** and **Why this result**. Default Keywords remains unchanged. The existing explicit Build/Search actions and stateless embedding route are reused; typing and option/board changes send nothing. Complete term matches and merely related text are distinguished. Every-term filtering checks normalised title/body spelling, including German move aliases; it is not semantic entailment or answer confidence.
- Query intent captures the visible game/scratch FEN when board relevance is enabled. Main/scratch steps and option changes cancel old work/results while retaining valid source vectors; source/account/filter/policy changes keep their existing stricter invalidation. Held navigation rechecks board intent even without a new game generation. Board profiles/FENs stay local, and embedding requests carry only selected title/body strings or the entered query.
- Root `utils/retrieval-eval.mjs --mode hybrid` records production fusion, dense/BM25 ablations and optional term-filter tradeoffs on the unchanged 159 authored passages/28 text queries. Query embeddings are reused across ablations. A separate ten-query board/intent suite has separate labels/hashes; its BM25 comparator applies the same explicit term constraints. No gold labels, case IDs or evaluation groups reach retrieval. Existing position/text/dense report formats and baselines are preserved.
- A manual local bge-m3 run records the installed model digest, F16/1024 dimensions and [full JSON/Markdown comparison](eval/retrieval/hybrid-bge-m3.md). Hybrid text precision@1 is 0.900, recall@3 0.950, MRR@3 0.925 and labelled no-answer false positives 0.875. Dense alone has higher recall (1.000). Requiring every term reduces false positives to zero while dropping three of twenty answerable cases. The shared Isolani/language ambiguity is retained and documented. Both constrained BM25 and hybrid score 1.000 precision@1/recall@3 and zero no-answer false positives on the small separate board/intent suite; it demonstrates no ranking advantage.
- Nine new unit/evaluation scenarios cover independent rank arithmetic, canonical sources, legal board/tag geometry, turn/check/phase/pawnless traps, literal filtering, scope violations, distinct benchmark labels, provider-work reuse, CLI opt-in and unchanged baseline reports. Seven browser scenarios cover real mock-gateway requests, precise repeated-note navigation, weak-vs-literal results, pending/held main/scratch-board work, source filtering and translated German phone controls. The shared PGN-load helper now accepts the German success message. An initial test expectation was corrected because the repeated knight loop legitimately returns to the annotated root board.
- Validation: lint/types, a fresh build and the full mock-provider unit/gateway suite pass (348 passed, one opt-in live test skipped). Full Playwright passes (195 passed, one opt-in live-model test skipped); all seven hybrid scenarios pass again after final checkbox-layout and empty-result wording polish. The three hybrid evaluation scenarios pass after the final fair-comparator adjustment, whose recorded output also matches the offline run. The final German phone layout was inspected without overflow or untranslated controls. Hybrid Markdown matches its JSON, all 83 checked local documentation links resolve and `git diff --check` passes.

### Deviations

- This delivers bounded rank fusion and a deterministic reranker over existing chess signals, with no learned cross-encoder or calibrated semantic abstention. Material/piece-placement signatures, richer position/move motif tags and fuzzy pawn distance remain 8.1/8.2/8.5. Tutor prompts and citation validation remain 8.6. No dependency, external corpus or `llmkit` code was added.
- Measurements use small authored development sets, not held-out evidence of generalisation or chess/answer quality. The real embedding run is a manual local evaluation; automatic tests use mock/fake providers only. Local-only, model metadata, budgets and source/licence assertions keep their existing semantics.

### Insights

- Fusion cannot repair unsupported evidence by itself and can lose the best individual retriever's paraphrase recall. Keep method ablations and no-answer rates visible rather than promoting an aggregate ranking score as confidence.
- A literal all-terms requirement offers predictable empty results at a measurable recall cost. It does not replace semantic support labels or calibrated abstention; unchanged lexical-intent labels also need care when interpreting bilingual semantic matches.
- Board relevance is query state, not just game identity. Cursor and scratch changes can occur without a new generation, so both asynchronous completion and held source actions must capture and recheck the intended board.

---

## 2026-10-23 — Explicit passage embeddings and dense retrieval comparison

TODO items: 8.3.2; completes 8.3.

### Implementation notes

- Library study-text search retains local Keywords as its default and adds explicit **By meaning** indexing/search. The selected source/language scope is applied before ingestion; Build sends bounded batches of literal title/body text, Search sends only the query, and typing sends nothing. Results reuse literal source/licence display and exact annotation-occurrence navigation, including repeated boards. The destination and model are visible before ingestion; changed service identities require review and another explicit build.
- Pure, JSDoc-typed `dense-search.js` validates/normalises finite nonzero vectors, ranks by cosine with stable source-ID ties, and publishes at most 512 passages atomically in batches of sixteen. Index metadata records provider, configured/reported model, supplied revision, observed dimensions, input version and opaque endpoint/cookie identities. Mismatched batches/queries are rejected. Vectors stay in browser memory; source/account/filter/method/policy changes clear them, and generation guards reject late work after cancellation/deletion or game replacement.
- A stateless `/api/ai/embeddings` route reuses the gateway's Host/Origin/JSON bounds, rate limiter and usage budgets. Per-user paid accounting follows the embedding provider independently of chat. One active request per cookie and four overall bound concurrency. The route never stores/logs text or vectors and exposes no credentials/endpoint URL. Cookie scope is an anonymous cache/request boundary, not account authentication; library ownership remains in the browser.
- Provider adapters now request float vectors, validate exact response indices/dimensions and return observed model and usage. Missing usage receives a marked conservative byte estimate. Embedding configuration reads the named provider's own credentials even under local-only mode; the route refuses cloud providers separately. Ollama metadata is checked before text is sent, rejecting cloud aliases, non-embedding models and unknown local-model metadata. Runtime local-only changes abort admitted cloud work and reject late vectors.
- Root `utils/retrieval-eval.mjs --mode dense` uses the production embedding/session path against the same 159 authored passages and 28 labelled queries as BM25. It does not load `.env` or saved player data; cloud runs require `--allow-cloud`. Alternate rankers receive no gold labels, and result identities resolve to canonical in-scope source references. Existing lexical/position modes remain unchanged.
- A manual run with the already-installed local **bge-m3**, Ollama 0.40.7, F16/1024 dimensions on Apple M1 Pro Metal records its supplied digest and full comparison in [Markdown/JSON](eval/retrieval/dense-bge-m3.md). Precision@1 increases from 0.900 to 0.950, recall@3 from 0.950 to 1.000 and MRR@3 from 0.917 to 0.975. Both paraphrases now appear within three results. However, all eight no-answer queries return hits, versus two for BM25. No private data, cloud request, model download, dependency or `llmkit` code was used.
- Sixteen new unit/gateway scenarios cover cosine geometry, literal inputs/source filters, atomic batching, vector/metadata drift, cancellation, cookie isolation, provider separation/local-only policy, budgets, disconnected callers, adapter isolation and CLI/report contracts. Eight browser scenarios cover explicit requests, paraphrase navigation, source/language changes, deletion/cancel/reload, changed model/dimension/scope, closed-tab policy changes and German phone controls. The phone check exposed double translation of pretranslated dynamic text and a literal null child; both were corrected, and the final layout was inspected without overflow or interface-language gaps.
- Validation: lint/types, a fresh build and the full mock-provider unit/gateway suite pass (339 passed, one opt-in live test skipped). Full Playwright passes (188 passed, one opt-in live-model test skipped). The five passage-evaluation scenarios pass again after the final report caveat; recorded dense Markdown matches its JSON, lexical/position baselines remain unchanged, all 64 checked local documentation links exist and `git diff --check` passes.

### Deviations

- This is a bounded memory-only index over the current source passages. Persistent/server vector stores, larger licensed corpora, hybrid ranking and tutor citation integration remain separate items. The revision is operator-supplied, not independently attested against weights; unknown revisions remain explicit. Ollama installations lacking the required local-model metadata fail closed.
- The real-model comparison is an explicit manual evaluation; automated tests only use mock/fake providers. Its small authored development suite is not held-out evidence of generalisation, chess accuracy or answer quality.
- Shared lexical gold is retained for comparability. Its German “Isolani”/English-guide case can have a useful bilingual semantic match despite its no-answer label; the report flags this intent limitation. Semantic label review is needed before using the aggregate false-positive rate to calibrate abstention. Off-topic and unsupported-proof cases still lack supporting passages.

### Insights

- Better paraphrase recall can coexist with substantially worse abstention. Positive cosine similarity cannot establish that a permitted passage answers a question; 8.4 needs separate relevance/abstention evaluation before 8.6 feeds retrieved text to the coach.
- A local service can relay a cloud model. Local-only enforcement needs model-level evidence as well as a provider label, and its policy must be rechecked after asynchronous work.
- Configured chat and embedding providers can differ. Reusing chat configuration under local-only mode must not silently substitute credentials/endpoints while retaining another provider's name.

---

## 2026-10-23 — Direct game/analysis round trips

TODO items: 4.12.7.

### Implementation notes

- Analyse now immediately pauses a detached copy of the current Play session. Play and both Return buttons restore its history, viewed step, orientation, starting position, result and clock directly. Analysis edits stay in their own snapshot; switching itself no longer saves an unfinished game to the library. Untouched/custom-start and finished games also retain a way back.
- Shared pause/return helpers use the existing capture/restore path: elapsed clock time is charged at suspension, a running clock restarts on return, and an unstarted clock stays stopped. Switching cancels chat, confirmations and opponent searches, advances the game generation, and restarts an opponent reply only if still needed. Return buttons bypass the chat command parser so an unanswered challenge cannot intercept them; typed return commands still work.
- Returning keeps the study's mainline branch, cursor, scratch variation and review results. Pure, JSDoc-typed `sessions.js` identifies its corresponding game checkpoint using full position history, viewed step, game identity, player colour and result. A transposition with different history is distinct; clock ticks and engine annotations are irrelevant. Once play advances, Analyse starts from that updated game instead of restoring an old study. Review keeps its existing confirmation and shares the same transition helpers. Undo uses modes to retain the return path for finished games too; return snapshots are bounded to twenty undo entries.
- Player rows wrap when captured pieces, result and clocks cannot fit on a phone. The German custom-start/finished-game scenario exposed this existing overflow during the new round-trip checks.
- Two unit scenarios cover checkpoint identity, legal transpositions and excluded transient data. Six browser scenarios cover timed pauses, edits and repeated switches, an advanced game, all three return controls during a challenge, cancelled and replacement opponent searches, a stale review confirmation, scratch restoration, and untouched/finished games with German phone layout and undo. The direct-switch regression was first run against the old code and failed because Analyse remained inactive awaiting confirmation. Existing UX expectations now use the immediate switch.
- The full browser run exposed an existing opening-guide test-helper race: when the coach first analysed a setup, the helper accepted the preceding completed command reply before a new answer bubble existed. It now waits for an additional coach reply before checking completion, so prompt assertions inspect the requested answer.
- Linux CI exposed a baseline-comparison portability issue from the preceding lexical-search work: two raw BM25 scores differed from the Mac-generated report by their last floating-point digit. The test now allows eight machine epsilons relative to score magnitude for those scores only. Rankings, IDs, source locators, metrics and same-process reproducibility still compare exactly; production retrieval and the recorded benchmark are unchanged.
- Validation: `npm run check`, a fresh build and the full mock-provider unit/gateway suite pass (323 passed, one opt-in live test skipped). All six new browser scenarios pass; the opening-guide suite passes three consecutive runs after the wait correction (21 scenarios). The final German phone layout was inspected with no page overflow.

### Deviations

- This extends the completed milestone 4 UX work as 4.12.7. Paired sessions remain in memory; preserving both across reloads is outside this change. Other leave-game confirmations remain in place.

### Insights

- A reversible mode switch needs the same cancellation and generation boundary as loading another game, even when both positions have the same FEN. Otherwise a cancelled reply can affect the resumed game or clear a newer search's status.
- Position equality alone is insufficient for deciding whether to reopen a study: history, viewed step and game result matter, while clock ticks should not discard useful analysis.

---

## 2026-10-23 — Local annotation and study-note search

TODO items: 8.3.1 (lexical part of 8.3; embedding ingestion/search remains 8.3.2).

### Implementation notes

- Added pure, JSDoc-typed `text-search.js`: original mainline comments become revision-bound passages with source/annotation/occurrence IDs, exact PGN UTF-16 ranges, full FEN and separate annotation licence assertions. Long fields split into bounded overlapping substrings without splitting surrogate pairs. Initial notes and repeated occurrences remain distinct; NAGs/variation comments are not indexed as prose.
- Exposed detached original guide text in both languages. Idea, plans and structure are separate passages, with SHA-256 revisions for each full language-specific guide and field locators. Guides retain the project licence and general-background role, without an invented board or engine verification.
- An in-memory inverted index performs BM25 title/body search after language/source-kind/collection filtering. Unicode/diacritic folding, English/German stopwords, SAN/castling/ECO tokens and uppercase German move-letter aliases support the current corpus. Stable-ID tie breaking and zero-score exclusion make rankings reproducible; query/term/result bounds are independent of the input element.
- Library now offers **Search study text** with local personal/classic/guide search, language filters, literal excerpts/full passages and source/licence inspection. Annotation results open the exact source step through a fresh legal PGN replay. Leave-game confirmation, source revision, current record, query/source selection and game/library generations guard navigation. Imported text is rendered as text only; no passage or search query is added to a prompt.
- Source replacements/deletions immediately clear old text results. Static guides compile lazily; completion uses only the current account's annotation set. Restricted live help clears results even in a closed tab. Search does not replace source/import drafts, write a second persistent index or call a model/embedding provider. No dependency, third-party passage or `llmkit` code was added.
- Root `utils/retrieval-eval.mjs` gains `--mode text`; default position mode and its recorded baseline are unchanged. The passage suite uses 45 comments plus 114 guide sections, with 28 manual English/German keyword, paraphrase, filter and no-answer cases. Input hashes, exact source locations and precision/recall/MRR/nDCG at 1/3/6 are recorded in Markdown/JSON.
- Initial passage precision@1 is 0.900, recall@3 0.950 and MRR@3 0.917. All eighteen direct keyword cases rank a relevant passage first. Both paraphrases miss at rank one, and two of eight no-answer cases return ordinary chess passages sharing words with unsupported requests. The benchmark records these limitations instead of treating keyword matches as proof or semantic understanding.
- Ten new unit scenarios cover source locators/revisions, tokenization/chunking, independently calculated BM25, scoped statistics, edits/deletions, result detachment, literal excerpts and CLI/report reproducibility. Eight browser scenarios cover import/reload and repeated/root navigation, provider-free guides, hostile text, drafts, delayed guide work/deletion, stale actions, help policy and German phone layout. [Design and results](TEXT-SEARCH.md) document the boundary and remaining work.
- Validation: `npm run check`, a fresh build and the full mock-provider unit/gateway suite pass (321 passed, one opt-in live test skipped). Full Playwright passes (174 passed, one opt-in live-model test skipped); all eight search scenarios pass again after final result-title/metadata-bound polish, as do the ten new unit scenarios. The full run caught two missing language-label translations, which were corrected before the passing run. Browser runs used isolated output with tracing off; CI settings are unchanged. Desktop/German phone layouts were inspected without overflow or interface-language gaps. Both CLI modes reproduce their recorded JSON; all 75 checked local documentation links exist.

### Deviations

- Split 8.3 so the lexical baseline can be measured and used before embedding ingestion. Existing separately configured provider helpers remain disconnected from search; 8.3.2 must add scope/local-only enforcement, model/dimension/version records and measured dense retrieval. Hybrid ranking and model-generated citations remain 8.4/8.6. The parent item remains open.
- The small current corpus uses an in-memory JavaScript index; server SQLite/browser persistence remains 7.6. Imported annotation language is not guessed, so undetermined notes remain searchable in either language. This is keyword lookup without stemming or semantic translation.

### Insights

- Reusing source-aware occurrence IDs solves the same-board/different-note problem for explicit passage navigation. Position matching alone cannot select a note named in the question.
- Strong direct-keyword results coexist with poor paraphrase performance and false positives on unsupported requests sharing chess words. The lexical baseline gives later embedding/reranking work concrete failures to compare against.
- Lazily compiling shared authored guides must never capture an old private annotation list; combine their completion with the current account/library state and recheck active render requests.

---

## 2026-10-23 — Labelled position-retrieval benchmark

TODO items: 8.8.

### Implementation notes

- Added an offline benchmark over the production `buildPositionIndex()`/`similarPositions()` path. It compiles thirteen packaged classics/studies and eight original fixtures through `library.js`: 21 source-aware documents, 481 indexed occurrences and 45 annotations, with no user library, provider, Stockfish search, network or new dependency.
- Twenty-four manually labelled English/German queries cover exact positions, transpositions, repeated occurrences and specific notes, structural analogies, current-game exclusions and six no-answer requests. Castling/en-passant/side identity, changed counters and a same-pawn position in check are explicit cases. Gold references resolve to revision-bound source/document/occurrence IDs; missing/excluded/duplicate/wrong-position labels fail validation.
- Pure scoring reports precision, recall, MRR and graded nDCG at 1/3/6. Short lists divide precision by k; duplicates consume slots without extra credit. Document-level analogies and occurrence-level requests use distinct relevance units. No-answer cases use a separate false-positive denominator instead of improving relevance means.
- Root `utils/retrieval-eval.mjs`, `just retrieval-eval` and `npm run eval:retrieval` print deterministic Markdown/JSON and write only with explicit `--out`. Checked-in reports include corpus/case hashes, per-query FENs, expected and retrieved references, and class/language summaries. Future adapters receive no gold judgements, evaluation groups or case IDs; unknown/mismatched returned occurrences fail scoring.
- Initial answerable-query precision@1 is 0.833, recall@3 0.861 and MRR@3 0.852. All twelve exact/transposition cases find a relevant result first. Requested repetition-game notes rank behind other games sharing an early board. Four of six no-answer cases receive pawn-only analogies. Structural ranking finds relevant IQP games but also includes the checked distractor and underranks the closest rook placement. These limitations are recorded without changing production retrieval.
- Eight new unit scenarios independently check metric arithmetic, short/duplicate/no-answer handling, legal gold/source locators, stale/invalid labels, adapter isolation/reference validation, report reproducibility and the root CLI from another working directory. The [method](RETRIEVAL-EVAL.md) documents interpretation, extension and remaining evaluations.
- Validation: `npm run check`, a fresh build and the full mock-provider unit/gateway suite pass (311 passed, one opt-in live test skipped). The gateway suite ran with loopback sockets available. Direct/just CLI runs reproduce the checked-in JSON byte-for-byte; the npm command and external-working-directory/output-path tests pass. All 49 local documentation links checked exist. No UI change, so Playwright was not rerun.

### Deviations

- This is a small authored development benchmark, not a held-out claim about retrieval quality. Text/embedding retrieval, passage-level relevance, graph synthesis, ownership/deletion tests and latency/cost measurements remain later slices. Engine correctness, citation entailment and teaching quality are separate measurements. The page is unchanged, so no new browser scenario is needed.
- `llmkit` supplied inspiration for independent scoring/test oracles only. No code, fixtures, runtime dependency or integration was imported, and that repository was not changed.

### Insights

- Same EPD does not imply the same requested source or occurrence. Correct position identity can still return the wrong note when a query names a game or a later arrival.
- Pawn equality also joins pawnless positions and tactically incompatible boards. Exact-only query intent and dynamic compatibility need to be explicit in future ranking/filtering.
- Corpus review found an existing classic with the IQP signature; it belongs in the positive labels. Gold judgements must review actual candidates when a corpus expands, rather than assuming only new fixtures are relevant.

---

## 2026-10-23 — Source-aware library records for RAG

TODO items: 7.1.

### Implementation notes

- Added JSDoc-typed `library.js` with versioned provenance and a legal-PGN compiler for sources, game documents, shared EPD positions, full-FEN occurrences, original annotations and optional study/problem records. Existing account/browser game IDs stay intact. New imported records use UUIDs; collection-scoped model IDs keep built-ins and user games distinct.
- SHA-256 of the stored PGN binds occurrence/annotation IDs to an exact source revision. A source-title correction preserves those IDs, while changed PGN changes its revision even with an unchanged timestamp. Position identity remains independent of counters and document versions; provenance and score licences belong to the occurrences rather than every game sharing the board.
- PGN comments retain original UTF-16 ranges and their exact mainline ply, including initial notes and repeated positions. Nested variation comments are excluded from the passage index. Numeric glyphs retain source attribution and an unverified status. Custom FEN studies, including position-only imports and Black starts, keep their root and recorded legal line without claiming a verified solution/result.
- Optional import fields and per-game **Source and licences** editors record title, author/curator, safe HTTP(S) URL and separate score/annotation licence assertions. Empty fields remain not supplied; no licence is inferred from a game's age or PGN headers. Built-ins identify the packaged collection and the project's authored-note licence, without inventing original historical score sources or rights.
- Legacy records are interpreted without migration writes. Unknown versions, malformed envelopes and explicit null/false values remain untouched and excluded from similar-position results; a game save cannot replace them with defaults. Valid scores remain readable. Browser writes affect only the changed games/books collection, roll memory back on failure and retain failed source edits for retry.
- Exact/pawn retrieval now consumes occurrence-specific notes and quoted source assertions. Cache invalidation uses exact PGN/provenance/kind rather than timestamps; index generations prevent delayed results from restoring deleted records. Held source edits recheck their target after asynchronous validation. Evidence completion refreshes counts without replacing an open source form or erasing unsaved input.
- Opening/saving PGN now retains initial notes and separate comments at repeated full-FEN occurrences; old EPD-keyed current-game snapshots still have an export fallback. Unreadable scores are rejected before opening. Source text renders as text, validated source links use `noopener noreferrer`, and source statements enter coach context through bounded `quote()` data.
- Eight unit scenarios and nine browser scenarios cover identities/revisions, locators/variations/Unicode, independent rights, old/future/malformed records, custom studies, repeated-note navigation and save round trips, failed writes/retry, late deletion, unsaved forms, hostile text and German phone controls. Desktop and phone forms were inspected. The [schema and lifecycle](LIBRARY.md), architecture, design overview and README describe the RAG boundary. No provider, dependency, external corpus or storage service was added.
- Validation: `npm run check`, a fresh build and the mock-provider unit/gateway suite pass (303 passed, one opt-in live test skipped). The final full browser run passed 165 scenarios with one opt-in live-model skip; its one failure exposed a German built-in-title regression, which was fixed. Both language scenarios and all nine provenance scenarios then passed together (11 passed), covering all 166 enabled scenarios across full/focused verification. Browser runs use isolated artifact folders with tracing off. Documentation links were checked and changed schema, TODO, DONE, architecture, design and README PDFs regenerated locally.

### Deviations

- Source metadata extends the existing flat records; normalised snapshots are derived/cached rather than persisted as duplicate tables. SQLite/IndexedDB remains 7.6. This establishes the data contract without requiring that storage migration first.
- The model indexes mainline comments and NAGs. Variations remain in the original stored PGN but do not produce indexed passages; current-board export still represents the mainline. Original historical-score provenance can remain unknown and needs later per-item audit/collection work in 7.3/7.4.
- Lexical/vector search, deduplication, answer citation validation and labelled retrieval evaluation remain 8.3, 7.2, 8.6 and 8.8 respectively. A recorded source statement establishes attribution, not chess strength, source permission or a forced solution.

### Insights

- Shared position identity and evidence identity serve different purposes. Reducing comments to EPD had attached a later repeated-position note to an earlier game step; full-FEN occurrences and source ranges preserve the distinction while still joining transpositions for retrieval.
- Provenance defaults must distinguish a missing field from malformed null/false data. Truthiness-based fallback can silently overwrite information that should have been retained.
- Background indexing may legitimately finish while the player is editing a source. Refreshing its evidence summary separately preserves both the source snapshot and the unsaved form.

---

## 2026-10-23 — Named opening continuations at the board

TODO items: 5.6.1–5.6.6.

### Implementation notes

- Added pure, JSDoc-typed `opening-variations.js`: compile the same CC0 Lichess rows as `openings.json` into a position graph during the build, then query by EPD in the browser. The current catalogue contains 3,865 lines and 7,983 positions (about 2.75 MB uncompressed). Data/compiler changes invalidate generated outputs; startup does not replay the full dataset.
- The Openings panel shows the current name/ECO, or explicitly labelled earlier opening background, plus legal next moves and up to three nearby recorded named destinations per move. Deeper destinations state their remaining plies. Transposed arrivals inherit the target position's names; query-time chess.js validation preserves turn, castling/en-passant rights and the displayed move counters. Frequencies remain in the separate reference-game explorer.
- Hover/focus previews the position after the move without changing the game, scratch line, engine evidence or coach query. The compact list scrolls independently, and the desktop board stays visible while browsing Openings. Preview cleanup preserves focused rows so Tab can reach the next move; actual pointer movement previews a row without scroll-induced mouseenter overriding keyboard focus.
- Click/Enter extends a scratch line during analysis or on an existing scratch board. At the current live position with Full help, it plays a normal player move, including the existing clock and engine-reply path. Historical/opponent-turn buttons are disabled. Held actions recheck generation, mode, scratch identity, full FEN and permission before acting.
- Off, Flag mistakes and Eval + mistakes clear rendered names even while the tab is closed, disable the opening quick question and omit catalogue context. General chess also omits it. Catalogue loading/retry redraws against the current game, including after a replacement position; failure leaves play and authored guides usable.
- **About this opening** supplies bounded, quoted catalogue metadata alongside the 5.5 study notes and permitted Stockfish analysis. Names establish neither strength nor engine evidence; concrete advice still requires supplied engine lines or successful engine tools. Browsing works without a provider and does not modify games, the library or repertoires.
- Seven unit scenarios cover real/deeper destinations, transpositions, counters, rights, castling, promotion, corrupt rows/edges, detached results and prompt quoting. Nine browser scenarios cover actual previewed piece placement, keyboard navigation, scratch/live clicks, help restrictions, held actions, delayed retry, coach context/evidence, hostile names and German phone layout. No dependency or external service was added.
- Validation: `npm run check`, a fresh build and mock-provider unit/gateway tests pass (295 passed, one opt-in live test skipped). Full Playwright passes (157 passed, one live-model test skipped); all 41 opening/guide/explorer/repertoire/drill scenarios pass again after the final desktop visibility and language polish. Browser runs use isolated output folders with tracing off. Desktop and German phone layouts were inspected, local documentation links checked, and changed TODO, DONE, architecture, design and site README PDFs regenerated locally.

### Deviations

- Analysis clicks use the existing scratch board, preserving the loaded game; live clicks make actual moves. The help restriction covers all three reduced-help settings, consistently with the explorer and authored guides.
- Each move displays at most three closest recorded destinations rather than every downstream catalogue name. A distance label makes clear that a later name needs further moves; the catalogue is neither exhaustive move coverage nor a recommendation ranking.

### Insights

- Equal EPDs can have different halfmove/fullmove counters. Revalidate and replay an edge from the query FEN rather than returning a catalogue's historical FEN, or previews and coach move numbers drift.
- Restoring a preview must preserve the focused controls. Rebuilding their DOM during blur interrupts keyboard navigation; scroll-generated pointer-entry events can also replace the intended keyboard preview.

---

## 2026-10-23 — Opening ideas and current pawn-structure notes

TODO items: 5.5.

### Implementation notes

- Added pure, JSDoc-typed `opening-guides.js` with original English/German notes for twelve opening families and seven pawn patterns. Each explains an idea, typical plans and possible structures. The static panel in Openings works without a provider and distinguishes known opening positions, earlier opening background and current pawn patterns.
- EPD lookup preserves side/castling/en-passant rights while ignoring counters, so transpositions retrieve the same guide. The displayed game prefix and captured scratch FENs determine the route: an ancestor branch discards later game history; a disconnected setup inherits none. A direct match takes precedence over opening-prefix history. The generic name after only `1. e4` is not enough to classify an open game.
- Structure notes use the existing board-feature detectors independently of the opening name, with at most two current patterns plus one opening-family guide. Exchanges can remove a pawn note while the earlier opening remains useful background. Unknown families, the initial position and endgames receive an explicit empty state rather than invented plans.
- **Discuss these ideas** explicitly selects position chat. The same English study notes enter permitted position/commentary/study context through bounded `quote()` data, with instructions that they are general background and establish no engine evidence. Concrete moves/evaluations still need supplied Stockfish analysis or successful tool results. Opening context now follows the displayed scratch route rather than the game behind it.
- Reduced live help clears rendered guides even while their tab is closed and omits them from prompts. General chess sends no guides. Held discussion buttons recheck game generation, full FEN and help permission; guides do not change the board, game, library or saved repertoire.
- Seven unit scenarios cover the built ECO catalogue in both languages, transpositions/rights/counters, changing pawn structures, seven pattern matches, scratch route isolation, empty states and bounded prompt quoting. Seven browser scenarios cover static use without AI calls, discussion/tool evidence, scratch/setup context, transpositions/exchanges, all restricted help settings, stale actions and German phone layout.
- Validation: `npm run check`, a fresh build and mock-provider unit tests pass (288 passed, one opt-in live test skipped). The full Playwright suite passes (148 passed, one live-model test skipped), including an explicit check with the provider disabled. The final local run used isolated output and `--trace off` to fit the available disk space; test assertions and CI tracing configuration are unchanged. Desktop and German phone layouts were inspected without horizontal overflow, 27 local documentation links checked, and all changed documentation PDFs regenerated locally.

### Deviations

- This is an initial authored catalogue, not an explanation for every ECO entry: open games, Italian, Ruy Lopez, Sicilian, French, Caro-Kann, Queen's Gambit, Slav/Semi-Slav, King's Indian, Nimzo-Indian, English and queen-pawn systems. Supported structure patterns are IQP, hanging pawns, Carlsbad, French chain, King's Indian chain, Maróczy and Stonewall. Existing detectors are heuristics; general plans still require adaptation to the actual pieces and tactics.
- No model, engine search, external service or new dependency is needed to retrieve/display a guide. Named continuation browsing remains TODO 5.6; text/embedding retrieval and a larger sourced library remain milestone 8/7 work. No third-party annotations or book passages were imported. Primary background cross-checks included the [Lichess French](https://lichess.org/opening/French_Defense) and [Sicilian](https://lichess.org/opening/Sicilian_Defense) pages; structure-based study is also described in the [author's introduction to Chess Structures](https://chess-structures.com/the-book/).

### Insights

- Opening names describe a route or a known position; they cannot establish which pawn structure exists now. Matching those two sources separately prevents a French Exchange position from receiving a locked-centre plan.
- A scratch board needs its own visible history for retrieval just as it does for move links. Future moves in the underlying game must not choose a guide for the branch on screen.

---

## 2026-10-23 — Repertoire recall with spaced reviews

TODO items: 5.4.

### Implementation notes

- Added pure, JSDoc-typed `drills.js`: one recall card per repertoire-side EPD, merging shared prefixes, repeated positions and transpositions. Every saved choice at a position is accepted; a matching stored route supplies one automatic opponent reply. chess.js validates input and replay, including castling and underpromotion.
- The Openings repertoire panel starts sessions of up to 20 new/due positions, with overdue reviews first. A separate chessground board supports click/drag and typed SAN/coordinates, a starting-square hint, answer reveal and explicit next/stop controls. The underlying game, scratch board, clock and library stay intact. Builder answers are hidden during practice; reduced live help, repertoire changes and game-generation changes invalidate the session and pending promotion callbacks.
- Grades describe repertoire recall, not engine strength: illegal input does not count as a miss; a legal unsaved move records a recall mistake and leaves the question in place. Hints and reveals are tracked separately from clean recall. Current-card totals show completed recalls, clean answers, mistakes and hints, with session results and the next review date.
- Deterministic intervals are one day, three days, then doubling up to 180 days for clean recalls. A starting-square hint keeps at least a one-day interval; a miss or reveal schedules a ten-minute retry. Card identity includes repertoire id, side, EPD and the sorted accepted choices. Renaming lines/notes preserves progress, while adding/removing choices creates a new question; unchanged positions retain their history.
- Versioned browser-local `kibitz.repertoireReviews` is separate from games/repertoires. Writes validate before publishing to memory; quota/storage failure keeps the answered card and completed attempt for retry without double-counting. Corrupt or unknown-version progress stays untouched with drills disabled, while repertoire editing remains available. Statistics ignore old keys that no longer match current cards.
- Nine unit scenarios cover merging/identity, answer legality and replies, castling/promotion, queue priority/caps, interval progression, malformed input and storage rollback. Eleven browser scenarios cover both sides, reload, hints/reveal, due ordering, failed-save retry, corrupt progress, live-help restrictions, edited choices, promotion, a stale callback after a game replacement, and German phone input/layout. Desktop and phone layouts were inspected; no provider, dependency or external service was added.
- Validation after integration with the merged coach-tool fixes: `npm run check`, a fresh build and mock-provider unit tests pass (281 passed, one opt-in live test skipped). The full Playwright run passes (141 passed, one live-model test skipped), including all eleven drill scenarios, repertoire/explorer coverage, provider-error recovery and restricted-help explanations. Changed architecture, design, TODO, DONE and site README PDFs regenerated locally.

### Deviations

- Review positions individually, rather than requiring exact replay of one route: a transposed position can have several valid saved choices. The representative route retains its full FEN for move numbering and its stored reply; the schedule belongs to the position and choices.
- The scheduler uses explicit fixed rules, not a fitted memory model. It covers opening recall only; the shared puzzle/lesson scheduler (9.4), adaptive explanations (5.5) and cloud progress remain separate. Completed reviews survive reloads; unfinished sessions are not resumed. Obsolete progress keys remain stored but do not transfer grades to edited choices; progress storage is bounded to 50,000 entries.

### Insights

- A repertoire answer can be a perfectly sound chess alternative yet fail a recall task. Keeping those verdicts separate prevents the trainer from teaching that an unsaved move is a blunder.
- Review identity must follow both the position and the accepted choices. An edited name should not erase learning, while changed answers must not inherit a previous question's completion.

---

## 2026-10-23 — Keep the coach's Stockfish tools available after provider errors

TODO items: fixes to 4.11.3, 4.11.6.

### Implementation notes

- Reproduced four browser regressions on the previous implementation: a temporary provider error or an unrelated rejected parameter silently turned off tools for the entire page; a tool-incompatible quick model disabled a capable chat model; changing the selected model did not restore access.
- Replaced the global `TOOLS_OFF` switch with a page-local capability cache keyed by the actual provider/model for the request's task. Only an explicit tool/function-calling rejection enables fixed-context fallback. Other errors remain visible without changing capability state. A different model has its own state, and a successful connection test clears the tested model's cached rejection.
- Added pure, JSDoc-typed `coach-tools.js` for route identity, conservative rejection detection and runtime instructions. Every tool-loop turn explicitly tells the model whether fresh Stockfish evaluation tools are offered, withheld by General chess/live-help context, or exhausted by the call budget. Responses may claim new analysis only after the engine tool returns evidence.
- A follow-up report confirmed the refusal happened with Flag mistakes or Eval + mistakes. Runtime instructions now identify restricted live help as the reason searches are withheld and direct the player to Full engine help (Volle Engine), rather than suggesting the app lacks an engine interface. General chess receives its own explanation. Enabling Full help makes tools available in the existing conversation, even after a reply denying engine access; the app does not change the setting for the player.
- A context-only gateway answer carries a visible translated notice. Fallback prompts describe the actual limitation; neither cached analysis nor a failed call is presented as a new model-requested search. Model changes invalidate in-flight tool work, so a late rejection cannot start a fallback against the newly selected model.
- Four new unit cases cover capability identity, positive/negative error classification, runtime availability/budget instructions and preserving the first-turn security rules and tool/result order. Seven browser regressions cover enabling Full help after the reported refusal, transient failures during a live game with Full engine help, unrelated rejection, quick/chat isolation, model changes, explicit reconnection and a held rejection arriving after a model change. Restricted-help coverage checks all three settings (Flag mistakes, Eval + mistakes and Off). The existing unsupported-model case also checks the German notice and that it creates no Stockfish evidence.
- Validation: `npm run check`, a clean build and mock-provider unit tests pass (272 passed, one opt-in live test skipped). The full Playwright suite passed before the help-explanation follow-up (127 passed, one live-model test skipped). All 42 affected chat, tool and security scenarios pass after that follow-up, including the reported denial followed by Full-help access. The missing restriction explanation fails its unit/browser checks before the change. Changed documentation PDFs regenerated locally.

### Deviations

- The reported live-game refusal follows the existing restricted-help policy; the independently reproduced provider-error bugs are separate. Model wording and tool choice are still model decisions. Tests use mocked providers and fake SDK clients; no live provider call was made.
- General chess and restricted live help still withhold engine tools, and the in-browser/artifact providers still use supplied context. This does not broaden permissions or add a provider integration. The open repertoire-drill PR remains separate.

### Insights

- A rejected request is not evidence that a model lacks tool support. Capability state must follow the selected model and be based on an explicit capability failure.
- Native tool schemas and runtime instructions serve different purposes: schemas define valid calls, while runtime instructions make the current engine access explicit. These instructions extend the standing rules rather than displacing the first-turn security contract.

---

## 2026-10-23 — White and Black repertoire builder

TODO items: 5.3.

### Implementation notes

- Added `repertoire.js`: complete standard-start PGN mainlines become legal ordered UCI lines, with regenerated SAN/FEN for display. The builder in Openings creates/renames White or Black repertoires, saves/edits named lines and notes, confirms line/repertoire removal and copies the selected repertoire as PGN.
- **Use board line** captures the game prefix plus the scratch variation only up to the displayed move. Alternatives rooted at an earlier game position reconnect to that ancestor; a disconnected custom position is rejected. A saved opening can be explored independently on the scratch board. These actions leave the underlying game and games library intact.
- A separate EPD graph merges chosen moves at transpositions and shows them only on the repertoire side's turn. Ordered routes, both sides' moves and stable line IDs remain stored for later drills. Identical routes within one repertoire are rejected as duplicates; distinct transposed routes remain valid.
- Versioned browser storage (`kibitz.repertoires`) validates on reload and before writing, and updates memory only after a successful write. Quota failures retain the saved data and editor draft. Malformed data and unknown versions stay untouched with editing disabled. User names/notes render as text and do not enter prompts; PGN export keeps them inside headers/comments.
- Saved moves, line editors and actions follow the explorer's live-help policy. Restricted help clears rendered suggestions and editor contents even while the tab is closed. German text and phone layout are covered. No provider, external service or dependency added.
- Repertoire lines support up to 200 plies without truncation. Extending a validated scratch prefix through the explorer now preserves the full prefix instead of applying the 40-ply bound for model-proposed lines.
- Tests cover game/scratch/ancestor capture, repeated-start history, legality and bounds, transpositions, duplicate identities/routes, storage rollback, malformed/future-version data and safe PGN export. Eight browser scenarios cover both sides, reload, edit/remove, hostile text, help restrictions, failed-save retry, long prefixes and German phone layout.
- Validation: `npm run check`, a fresh build and mock-provider unit tests pass (265 passed, one opt-in live test skipped). The full Playwright suite passes (114 passed, one live-model test skipped); all 14 repertoire/explorer scenarios pass again after the capture-history refinement. Desktop/phone layouts inspected, 53 local document link paths checked, and changed documentation PDFs regenerated locally.

### Deviations

- Storage is browser-local, including when the games library uses an account. Cloud persistence remains in 7.6. Each repertoire supports up to 128 lines, with up to 32 repertoires; names and notes are bounded, and limit failures do not save a partial line.
- Standard-start ordered mainlines are the editable unit. PGN annotation variations do not become additional saved choices automatically. Spaced-repetition scheduling (5.4), authored explanations (5.5) and named variation browsing (5.6) remain separate work.

### Insights

- A position graph is useful for “my chosen moves here”, while the original route is needed to edit and rehearse an opening. Keeping both avoids losing move-order choices at transpositions.
- Scratch boards may begin at the current position, an ancestor or an independent standard start. Capturing a repertoire needs an explicit connecting path, rather than concatenating every visible game move with the scratch line.
- Returning to the initial diagram later in a line is not a fresh start: capture keeps that move history, while position queries intentionally merge the repeated diagram.
## 2026-10-23 — Commentary links retain the correct game step

TODO items: fixes to 3.4, 3.7, 4.3 and 4.6.

### Implementation notes

- Reproduced five browser failures and three unit failures on the previous implementation: historical moves linked from a later occurrence, numbered alternatives inherited the previous variation's end, repeated-position comments reused an earlier turn's cached text, manual commentary ignored the scratch board, and saved review summaries had no move links.
- `annotations.js` resolves links against captured game/evidence positions. It checks full-move number and side at every linked ply, recognises formatted move runs and Unicode ellipses, and reconnects explicitly continued clauses. Separate sentences/paragraphs and alternatives reset the continuation. Repeated unnumbered historical references remain unlinked when their occurrence is ambiguous.
- Navigation legality and engine backing remain distinct: legal but unsupported variations can be inspected while retaining their flags; illegal continuations stop at the valid prefix. Bare pawn notation inside a numbered sequence is no longer mistaken for a square. Chess move numbers stay visible instead of being stripped as list numbering.
- Chat and comments snapshot the supplied analysis and game path before generation. Comment bubbles pin their original game/scratch position, and the manual comment button uses the scratch position on screen. History/full-position cache keys prevent reusing numbered wording at a different game step; prompts ask for move numbers and sides.
- Saved/generated review summaries and study plans use the same checked-link path. Their links retain the requested position across cursor changes, and study-plan work checks the game generation before rendering. Tool evidence retains its own start positions, including confirmed motif lines and flipped-side threats.
- Added JSDoc for the key replay, evidence-checking, cache and UI context/navigation functions, with shared types for checked tokens, captured positions and legal lines. Contracts distinguish UTF-16 text offsets, zero-based move indices, before/after FENs, square references and engine verdicts. Regression test/helper documentation explains the invariants each scenario protects.
- Validation: `npm run check`, a clean build and mock-provider unit tests pass (256 passed, one opt-in live test skipped). The full Playwright suite passes (113 passed, one live-model test skipped), including seven new commentary regressions and the existing annotation/tool workflows. The JSDoc follow-up also passes static checks, a fresh build, 26 focused unit tests and 20 commentary/annotation/tool browser tests. Architecture, TODO and DONE PDFs regenerated locally.

### Deviations

- This fixes reference binding and request context, not the semantic truth of arbitrary model prose. Ambiguous references are left unlinked; legal navigation does not establish engine support or prove an explanation. No provider integration or dependency added.
- Independent fix branch from main; the open repertoire-builder PR is separate.

### Insights

- SAN and EPD alone cannot identify a game occurrence. A move number, side, original route and captured evidence are needed to preserve the position the commentary refers to.
- The board cursor is presentation state. Moving it while an answer streams must not become a new source for that answer's links.

---

## 2026-10-23 — Opening explorer from reference games

TODO items: 5.2.

### Implementation notes

- Added pure `openings.js`: chess.js validates complete PGN mainlines, then builds an EPD-keyed position/move graph. Different move orders join at transpositions; side to move, castling and legal en-passant rights remain distinct. Each game record contributes its first continuation at a position, so repetitions do not inflate counts.
- The new Openings tab shows recorded continuations, their frequency among available continuations, White/draw/Black result counts and unknown results separately. Filters choose the built-in classics, the player's library or both. Sample records open at the move following the matching position; records ending at a node are reported separately.
- Clicking a continuation opens or extends a legal scratch variation. Stepping backwards, branching, closing it, navigating the game and changing the corpus refresh the explorer. Opening a sample during play asks first and retains a return snapshot; it checks the game generation, position, help permission and record content after confirmation. Exploring does not change the underlying game or saved library.
- The explorer is available in analysis, after a game or with Full engine help. Restricted live-help modes clear previously rendered continuations even while the panel is closed; move/sample actions check the policy again.
- Per-record PGN parsing is cached by source, id and content. Imports/deletions rebuild the graph; removed cache entries are dropped. The UI includes German translations and keyboard/mobile coverage. No provider, external service or dependency was added.
- Tests cover transpositions, rights/counters, repeated positions, result provenance and unknown values, corrupt/empty/custom-start games, annotation variations, promotions and source identities. Browser coverage exercises scratch/backtracking, source filters, sample occurrences, live-game confirmation/return, live-help restrictions, import/delete refreshes, hostile metadata and German phone layout; the tab-group regression includes Openings.
- Validation: `npm run check`, a fresh build and mock-provider unit tests pass (253 passed, one opt-in live test skipped). The full Playwright suite passes (106 passed, one live-model test skipped); all six explorer scenarios pass again after the final confirmation-focus refinement, including a phone viewport. Desktop/phone layouts inspected, 50 local document link paths checked, and changed documentation PDFs regenerated locally.

### Deviations

- This explorer counts the selected stored game records, not a population of online games. Repeated imports remain separate records until library deduplication (7.2). The built-in standard-start corpus is currently nine games; composed studies and custom-start fragments are excluded.
- PGN mainlines supply the recorded moves; annotation variations do not contribute votes. These frequencies/results are not engine evaluations. Repertoires, drills, authored opening explanations and named-continuation browsing remain in 5.3–5.6.

### Insights

- A displayed move tree needs a position graph underneath it: transpositions merge, while a repeated position in one game should not count as another independent game.
- Unknown outcomes and records ending at a position need their own accounting; otherwise continuation percentages and results give a misleading impression of the sample.

---

## 2026-10-23 — Road idea: animated Primer website

TODO items: none; [ROAD 11](ROAD.md#11-animated-primer-website) records a future feature.

### Implementation notes

- Added an animated Primer website idea, connected to the existing one-position tutorial and design overview. Its main scenes visualise the neurosymbolic evidence/tool/validation flow and RAG from query through matching/ranking to evidence and citations.
- Recorded step/replay controls, inspectable intermediate state, reuse of the Primer sources, accessible/static presentation and reproducible traces. Planned retrieval extensions remain labelled as such.

### Deviations

- Planning only: no website or animation implemented and no implementation TODO marked complete.

### Insights

- The useful animation follows evidence between components, showing where chess facts, retrieved material and generated explanations come from and how they are checked.

---

## 2026-10-23 — Brief LLM and symbolic design overview

TODO items: 0.13 (documentation).

### Implementation notes

- Added [AI-DESIGN.md](AI-DESIGN.md): component responsibilities, an evidence/tool/validation flow, and a feature matrix covering play, commentary, reviews, chat, board annotations, retrieval, openings, lessons and the recent ROAD ideas.
- Outlined context engineering, bounded tool use, structured output, retrieval/provenance, verification, state isolation and runtime policy. Distinguished built/prototype behaviour, planned work and exploration, with explicit limits on what each check establishes.
- Linked the overview from README, ARCH and the research index. Connected the position-similarity study to the index and repaired research links to the merged Primer sources/PDF.
- Aligned ARCH's descriptions of finite-search evidence, output formats and wrong-move marking with the current implementation.
- Validation: 71 local document links/heading targets checked; the overview renders as three PDF pages with its diagram. `npm run check`, a fresh build and mock-provider unit tests pass (243 passed, one opt-in live test skipped).

### Deviations

- Design documentation only: no app behaviour, dependencies or feature completion status changed. The overview refers to application baseline `1ce2f68` and keeps background explanations in the Primer and detailed mechanisms in ARCH/research.

### Insights

- The recurring design is evidence → permitted context → language/tool requests → validation → board/text. Each feature combines those steps differently; several useful features need no LLM.
- Explicit rules, neural engine evaluations, heuristic features and retrieved statements have different authority. The design should retain those distinctions through generation and display.

---

## 2026-10-23 — Road and research: position similarity by aspect

TODO items: none completed; [ROAD 10](ROAD.md#10-position-similarity-by-aspect) informs 8.1, 8.4, 8.5 and 8.8.

### Implementation notes

- Added the ROAD idea for a family of position similarity measures parameterised by the aspect being studied, with explained exact/structural/thematic matches.
- Added [position-similarity research](research/position-similarity.md): primary chess-retrieval studies, conditional metric learning and chess-aware encoders, candidate symbolic/dynamic distances, a proposed weighted baseline and an aspect-specific evaluation plan.
- Connected attack/defence graph features to the four-corner piece-power idea. Distinguished similarity scores, mathematical metrics, verification coverage and the validity of advice in the current position.

### Deviations

- Research and planning only. No weights or encoder selected, no similarity benchmark run, and no runtime feature or implementation TODO marked complete. The existing general research notes remain in PR #41.

### Insights

- Similar-looking positions and similar tactical solutions are different retrieval targets. The same pair can rank differently for pawn structure, piece activity and tactics.
- Corner dot counts compress relationships; retrieval needs the underlying edges and roles to distinguish positions with equal counts. An aspect-specific score can be useful without being a strict metric on complete chess states.

---

## 2026-10-23 — Road idea: piece power in four corners

TODO items: none; [ROAD 9](ROAD.md#9-piece-power-attacks-and-defence-in-four-corners) records a future feature.

### Implementation notes

- Captured the four corner dot counts: inbound/outbound attacks above, inbound/outbound defence below. Recorded always-visible and on-demand modes, details and highlights of the related pieces.
- Kept the mobile gesture as a design question with long-press and Inspect-then-tap candidates. Recorded the conflict with existing right-click circles/arrows, plus accessibility, help settings and attack/defence semantics to settle.

### Deviations

- Planning only: no board feature is implemented and no implementation TODO is marked complete.

### Insights

- Inspection and manual annotation share the right-click gesture; their interaction needs an explicit design. Attack/defender counts also need a clear definition before they can serve as teaching aids.

---

## 2026-10-23 — PDF tooling under root utilities

TODO items: 0.12.

### Implementation notes

- Moved the print stylesheet and Mermaid include to `utils/pdf/`. Updated `just pdf` / `just pdfs`, stylesheet comments and the earlier tooling entry to use the new paths.
- Documented `utils/` as the home for repository utilities in AGENTS.md.
- Validation: plain and Mermaid PDF builds pass, and an unchanged document is skipped on the second build. `npm run check`, a fresh app build and mock-provider unit tests pass (243 passed, one opt-in live test skipped).

### Deviations

- None. The PDF commands, output locations and incremental-build mechanism keep their existing behaviour.

### Insights

- PDF build assets belong with repository utilities; document sources and generated output stay with the documents.
## 2026-10-23 — Research: RAG, neurosymbolic games and milestones 5–7

TODO items: 8.9 (research); informs milestones 5–8.

### Implementation notes

- Added [docs/research](research/README.md) with a milestone-by-milestone AI use-case analysis, a code audit of Stockfish integration, a retrieval-methods study and a primary-source review of neurosymbolic chess and other games.
- The retrieval study covers source-aware passage ingestion, lexical/dense/hybrid search, reranking, structured chess queries, position/concept graphs, GraphRAG, LightRAG, HippoRAG, RAPTOR and LazyGraphRAG. It proposes a provenance-aware schema, staged delivery and separate retrieval/chess/teaching evaluations.
- The games review covers engine-grounded and concept-guided commentary, Queen, ChessGPT, Maia-2, AlphaZero, MuZero, NNUE, TextWorld logical policies, DeepProbLog and shielding. It identifies concrete experiments rather than adopting new frameworks.
- Linked the research from README, ARCH and TODO; clarified ARCH's distinction between explicit chess rules, finite engine search and claims about explanations.
- Validation: `npm run check`, a fresh build and mock-provider unit tests pass (243 passed, one opt-in live test skipped). Checked local document links and rendered the research and updated documentation PDFs; no app/UI code changed.

### Deviations

- This is documentation and selective literature review, not a runtime implementation, systematic survey or reproduction of paper benchmarks. Milestones 5–8 retain their feature status; only the research item is marked complete.
- No dependencies, datasets, model weights, embedding index or engine exports were added. The audit is pinned to `0176c62`; the pending Primer-source PR is linked separately.

### Insights

- Kibitz already uses a separate complete Stockfish analyst outside the opponent game. It does not call standalone NNUE, hidden representations, static evaluation traces or Syzygy. The embedding client helpers likewise do not constitute an implemented text-retrieval pipeline.
- A legal position/move graph, a text-derived entity graph and a hierarchy of summaries solve different retrieval problems. Establish a labelled lexical/structural baseline before adding graph complexity.
- Engine agreement, source grounding, explanation faithfulness and learner improvement need separate checks. Finite-depth analysis and a model judge should not be presented as universal chess truth.
## 2026-10-23 — Keep the game and the review, with the board visible while typing

TODO items: 4.12.2, 4.12.3, 4.12.4; completes 4.12 and milestone 4 with 4.11.2.

### Implementation notes

- The tabs are grouped into Play (Game, Coach) and Study (Review, Library, Reading), retaining their ARIA tab keyboard navigation. A banner above the board identifies the current game, finished game or analysis, with its players/title and move. The dialogue and review name their position too; imported titles remain text.
- Selecting Review during a running game asks to pause it. Cancellation keeps playing. Acceptance snapshots the live game and clock, then opens a separate analysis session. Returning resumes the live game; revisiting Review restores the previous study's cursor, scratch board and review results. Undoing a transition also keeps the other session. A confirmation tied to an old game cannot replace a newer one.
- The board and dialogue both offer Return. The header's Play switch resumes a suspended game too. Panel PGN loads, library loads and the Analyse switch preserve a return snapshot before the existing save operation normalizes metadata, so returning keeps the original headers as well as the moves and clock. Failed imports do not leave a phantom suspended game.
- Confirmed continuations later in a motif tool's line carry their own starting FEN into the answer's board links. Clicking such a tactic opens it from its actual position, rather than the tool's original root position.
- The normal dialogue stays below the board on portrait phones and beside it on tablets and landscape phones. Narrow-screen chips scroll in one row. While composing, the board and composer fit side by side inside `visualViewport`; its height and offset follow keyboard/viewport changes. Sending, Escape, losing composer focus or Full layout restores the normal view. The textarea uses 16px text on narrow screens to avoid input zoom.
- `ux.spec` adds end-to-end coverage for review confirmation/cancellation, both sessions over a round trip, preserved headers, invalid/valid imports, the Analyse switch, stale confirmation, and visible board/input/send controls at portrait, landscape and tablet sizes with a reduced keyboard viewport. Existing settings, layout and chat tests remain in place. No dependencies were added.

### Deviations

- The temporary composition view replaces a mobile drawer. It keeps the board visible without putting it behind the chat.
- The suspended game and last study remain session memory. Reload persistence for both sessions is outside this milestone; the existing single current-game snapshot remains unchanged.
- Mobile keyboard geometry is exercised in Chrome with reduced viewports. Physical iOS/Android keyboard behavior has not been manually tested.

### Insights

- Saving can change display metadata, so preserving only the moves is not enough for a faithful return: take the snapshot before saving.
- A tall stacked page can pass a simple visibility check while its board is far outside the keyboard viewport. The new tests check the actual rectangles of the board and composer.

---

## 2026-10-23 — Engine-confirmed tactical patterns

TODO items: 4.11.2; completes 4.11.

### Implementation notes

- Pattern detection now separates geometric candidates from confirmed tactics. `tools.js` checks the engine's best evaluation before and after each candidate move, from the mover's perspective. A move losing over half a pawn against the best is refuted. Missing, shallow (below depth 6), bounded or illegal engine results never confirm a motif.
- A short engine continuation must show a material gain, legal mate, or a positional advantage/compensation that a fresh evaluation still confirms at its six-ply horizon. Legal mates are conclusive even when the engine returns no terminal PV. Confirmation details, losses, continuations and reasons for abstaining travel back to the model.
- The checks apply to `analyse`, `try_move` replies, `threats` and `find_motifs`. The latter no longer passes an arbitrary supplied legal line to the answer checker as engine evidence; it supplies only confirmed continuations. A gap of 1.5 pawns marks an only move only if the best move still holds.
- `knowledge.js` adds candidate detectors for skewers, double checks, discoveries against material, interference and removing defenders. Concrete three-ply sequences identify deflection, overloaded defenders, decoys and checking zwischenzugs. Combination labels require the supplied reply/follow-up to match the engine's continuation.
- Each tool shares an EPD cache across its lines, with at most twelve additional searches and no new search after fifteen seconds. Individual searches retain the page's five-second cap. The page checks cancellation and game generation before and after every engine search, including searches inside one tool.
- Tests cover sound and poisoned forks for both colors, score validity, large scores without display clamping, terminal mates, cooperative supplied lines, bounds and the new detectors. Browser regressions exercise the model/tool round trip and evidence display with the mock provider.

### Deviations

- These are conservative detectors and finite-depth checks, not an exhaustive tactics solver. Long combinations, positional sacrifices without a stable short horizon, non-checking zwischenzugs and candidates beyond the search budget stay unverified. The broader lesson curriculum in 6.2 remains open.
- No live model evaluation was run; all provider tests use mocks. No dependencies were added.

### Insights

- A legal line can contain a losing fork or a cooperative reply. Legality alone must never turn a model's proposed continuation into engine evidence.
- A display-clamped evaluation can conceal a large loss in an already winning position. Pattern checks use the full centipawn value.

---

## 2026-10-22 — Chat context, library loading and board control

TODO items: 4.8, 4.9, 4.10 (milestone 4, part 2b).

### Implementation notes

- **Commands and validation** (`site/src/coach/chat.js`, pure): legal moves through the existing typed-move parser; FEN and PGN loading; move-number navigation; piece edits and side to move; library search by player, opening or theme, with own-game color and result filters. Imported metadata is quoted before it goes into tool results or history. Position checks now reject an attacked non-moving king as well as malformed FENs; game-start checks additionally reject terminal positions.
- **Local commands:** `e4`, `play Nf3`, `show me e4 and what follows`, `take back two moves`, `go to move 15`, `put a white knight on f5`, `remove the queens`, `White to move`, `undo`, and `return to my game`. These work without a model. Analysis moves and setups stay on a scratch board; live moves respect the player's turn, clock and help level.
- **Tools:** library and opening searches, game/FEN/PGN/opening loads, `move`, `goto`, `setup`, `undo`, using the same provider adapters as the engine tools. Each action is validated again against the current board. The existing four-round/six-call cap applies to both tool groups; engine tools withheld by the help setting are also refused if the model calls one anyway.
- **Loading a running game requires confirmation.** Cancellation leaves it in place. An accepted load suspends it in memory, with a Return button; its clock resumes when returning. Loads, scratch edits and navigation never write the saved library. A board change can be undone as one action.
- **Context:** the Discuss selector switches between the current game/position and General chess, which has its own history and sends no board context. The active tab is included in position requests. Answers carry a context button that revisits their position in analysis. Loads preserve the conversation and send fresh engine context before the next model turn; scratch questions use the position actually shown, including after stepping backwards.
- **Async guards:** cancelled or replaced requests cannot add old messages to a new game. Board actions check both generation and FEN. Review summaries now discard responses when their original game has been replaced.
- **Tests:** unit coverage for parsing, hostile arguments, legal setups, long/custom-start PGNs, quoted retrieval and gateway tool shapes; browser coverage for local and model commands, confirmation/cancellation/return, undo, searches and loads, context switches and links, withheld engine help, stale chat/summary responses, and phone/tablet layouts. Providers are mocked throughout.

### Deviations

- The context control is a select and answer buttons; the existing mobile dialogue stays in place rather than becoming a drawer.
- Suspended games and undo snapshots live only in the current session. Saving games and resuming across a reload continue to use the existing explicit library save and current-game snapshot mechanisms.
- Models without tool support still answer from fixed context. Local commands work with those models and when the coach is off. Named setups such as Lucena load their initial position from the classic collection, locally or through library tools.
- This completes the chat continuation (4.8–4.10). Evaluation-confirmed pattern search (4.11.2) and the remaining game/review UX work (4.12) stay open.

### Insights

- Checking FEN syntax is not checking a legal position: chess.js accepts some impossible king placements. A shared position check protects both loads and engine tools.
- An answer needs a snapshot of its position, not a later lookup of the same move index in whichever game is on the board. The same distinction makes general conversation, scratch analysis and return-to-game work together.

---

## 2026-10-22 — Consistent primer filenames

TODO items: none directly; documentation upkeep.

### Implementation notes

- The primer source, HTML and PDF share the `Primer_v01` basename. The build script reads and writes in `docs/primer/`, with the same prefix for intermediate Markdown files.
- Updated the primer README and the links in ARCH.md and ROAD.md for the PDF's location in `docs/primer/`.

### Deviations

- No planned feature changed.

### Insights

- One basename in the build script keeps source and output names aligned.

---

## 2026-10-22 — Engine tools for the coach: the model asks, Stockfish answers

TODO items: 4.11.1, 4.11.3, 4.11.4, 4.11.5, 4.11.6; 4.11.2 in part (milestone 4, part 2a).

### Implementation notes

- **The catalogue** (`site/src/coach/tools.js`, pure):
  - Six tools: `analyse`, `try_move`, `threats`, `compare`, `find_mate`, `find_motifs`.
  - `checkToolCall` checks every argument as untrusted. Unknown tools and extra fields are refused, FENs and moves go through chess.js, and depth, line count, mate length and line length are capped. Nothing over a cap is quietly clamped.
  - `runTool` runs a call against an engine passed in as a function: the page's Stockfish, or a fake in the tests. It returns the result for the model and the SAN lines it showed.
- **In the gateway** (4.11.3):
  - Messages can carry tool calls (`{role: 'assistant', toolCalls}`) and results (`{role: 'tool', toolCallId}`). Every call must be answered, and only tools from the catalogue may appear. A request names its tools, and the definitions sent to the provider are the server's, never the client's.
  - Anthropic gets `tool_use` and `tool_result` blocks, with the results of one turn grouped. OpenAI, Mistral and Ollama get function calling, with the streamed pieces of each call assembled by index; unreadable arguments become `{}`, which the page then refuses with a reason.
  - Tool calls come back in the stream's done line.
- **The loop runs in the page** (4.11.4, your choice): the page asks for one model turn at a time and runs each call on its own Stockfish, under the tag `tool`. Caps: 4 rounds and 6 calls per answer. The last round offers no tools, so the model must answer.
- **When tools are used:** chat and quick questions, in analysis, a finished game, or with Full engine help. They're never offered in a game with less help, since the tools would show what the player chose not to see. The in-browser model has no tools, and neither does a provider that rejects them: the page asks once more without tools and stops offering them for the session. Those models answer from the context, as before.
- **Evidence** (4.11.5): what the tools found is kept with the answer, shown under it ("Stockfish checked 2 things for this answer"), and counted by the answer check, so the lines the coach quotes from it are backed. Lines that start in positions the tools looked at can be stepped through on the scratch board too.
- **Pattern search** (4.11.2, in part): the motif detectors run along each tool line (`motifsAlong`), and `analyse` flags an "only move" when the second line is 1.5 pawns or more worse.
- **The mock** calls tools only when a question asks it to (`[mock:tool]`, `[mock:loop]`, `[mock:bad-tool]`), so the other tests don't change.
- **Tests:**
  - unit `tools.test`: the catalogue; hostile arguments; each tool against a fake engine.
  - unit `server/tools.test`:
    - messages with tool turns: accepted when complete, refused when calls are unknown, unanswered or oversized;
    - tools only from the catalogue;
    - the provider shapes, and tool calls read back from Anthropic and chat-completions streams;
    - the mock.
  - `api.test`: tool calls in the done line; unknown tools refused.
  - e2e `tools.spec` (5): a tool call with evidence; a model that never stops is stopped after 4 rounds; hostile arguments refused with a reason; no tools in a game with flags only; the fallback when a provider refuses tools.

### Deviations

- **The contract fixtures for tool calls are written by hand,** from the providers' documented stream shapes, not recorded. Recording makes paid calls (`scripts/record-ai-fixtures.mjs`), so it's left for when you want it.
- **The prompt says when to use tools,** and the coach rules gained one line. No eval has been run with tools yet, since that makes paid calls.

### Insights

- **Running the loop in the page kept the gateway stateless.** It only translates shapes. Each round is one ordinary request, counted against the rate limit and budgets like any other, so a runaway model costs at most five requests per question.
## 2026-10-22 — Fix: an annotations test depended on which lines Stockfish found

TODO items: fix for 4.7.

- **The bug:** the e2e test for lines in an answer expected "1. e4 e5 2. Nf3" to read as one line. That needs Stockfish's lines to contain it, and they did on a laptop with four threads but not on CI with one, so the test failed in CI after #34 merged.
- **The fix:** the test puts a fixed analysis for the start position into the page before asking. Every other annotations test was already independent of the engine.
- **Insight:** a test that relies on the answer check relies on the engine, so it needs fixed engine lines. Making the depth the same isn't enough.

---

## 2026-10-22 — The board speaks: lines, marks, a scratch board and "what if"

TODO items: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7 (milestone 4, part 1).

### Implementation notes

- **The schema** (`site/src/coach/annotations.js`, pure):
  - Annotations are arrows (a move for the side to move, or a threat: a move for the other side), squares, ghost pieces (`wN` on d5: where a piece belongs), labels (one or two characters) and lines (moves played one after the other from a position).
  - `checkAnnotation` checks each against the position before anything is drawn. Squares and pieces must exist, arrows must be legal moves for the right side, and a ghost needs a piece of that kind on the board and a square not taken by its own side.
- **Two sources:**
  - **Lines read from an answer:** `linesInAnswer` takes `checkAnswer`'s moves. A run of moves separated only by move numbers becomes a line, up to the first wrong move. It starts where the answer's previous line ended ("3... g6, and if 4. Qf3 then Nf6") or else in the position or the one before.
  - **Marks the coach adds:** a block opened with three backticks and `board`, one mark per line: `arrow e2 e4`, `threat d8 h4`, `square f7`, `ghost wN d5`, `label d5 !`. It's a plain line format, not JSON, so small models get it right more often. `parseBoardBlock` reads it strictly, keeps at most 8, and takes it off the text, also while the answer streams. The coach rules describe it.
- **Drawing** (`index.html`):
  - The marks that fit are drawn while the board shows the answer's position, and a button shows them again. Those that don't fit are counted in a note under the answer: "One board mark didn't fit the position and was left out."
  - Ghost pieces and labels use chessground's piece and label shapes. A red `threat` brush is added.
  - A move that belongs to a line previews the position before it on hover or focus. A click or Enter opens the line on the **scratch board**: a bar under the board with the numbered moves, back and forward (also the arrow keys), Stockfish's view of the position shown, "Ask the coach about this line" and "Back to the game".
- **What if** (4.5): "Try a move" opens the scratch board at the current position.
  - The player plays moves on it; a move continues from the move shown and drops what came after. Stockfish evaluates each position.
  - The coach can be asked about the line: it gets the line, the position after it and Stockfish's view there. The line and Stockfish's continuation count as backed in the answer check.
- **The game is never touched.** Anything that moves the game closes the scratch board: a move, navigation or a load (the game's id, cursor and length are kept with it). Playing on it, and its engine view, are allowed only where the engine's view is shown anyway (analysis, a finished game, Full engine help). In a game with less help, a line from an answer can be stepped through but not played on, and without evaluations.
- **Chat context** (4.6): the context already had the position, the game so far and the last eight turns, coach comments included. It now also has the aspects the player picked and, when there is one, the scratch line.
- **Tests:**
  - unit `annotations.test`: each kind against legal and illegal positions; threats; lines in SAN and UCI; the block's parsing, limit and streaming; hostile blocks (HTML, scripts, junk) draw nothing; lines in an answer, continued across prose and cut at a wrong move.
  - e2e `annotations.spec` (6 tests):
    - preview and stepping with the game unchanged;
    - marks checked, drawn and counted;
    - hostile marks run and draw nothing;
    - what-if with Stockfish and the coach's context;
    - no what-if in a game with flags only;
    - the scratch board closes when the game moves.

### Deviations

- **Lines come from the answer's text,** not from a separate field of the model's output. The text is what the player reads, and `checkAnswer` already checks it. The model's own marks use the block. Tool calls replace it in part 2 (4.10, 4.11).
- **The answer check stays strict:** a move the engine's lines don't back ends a line there, and the rest isn't drawn.

### Insights

- **The scratch board is the preview grown up.** The hover preview of game references (4.12.6) became a board state that `syncBoard` checks first. It closes by itself when the game's id, cursor or length change, so no code path that moves the game needs to know about it.
- **A short line format beats JSON for model marks.** It's easier to read strictly, a broken line costs one mark rather than the block, and it survives streaming.

---

## 2026-10-22 — Settings behind a gear: a modal overlay

TODO items: 4.12.1.

### Implementation notes

- **The gear** in the header opens a native `<dialog>` with `showModal()`. The browser makes the page behind it inert, closes the dialog on Escape and gives focus back to the gear. The close button and a click on the backdrop close it too: a click whose target is the dialog itself, outside `.settings-body`.
- **What moved in:**
  - General: the language (from the header) and the player's level (from the Game tab).
  - Coach: how the coach works (from the Coach tab), and the AI provider, models, local-only mode, connection test and usage (the former "Coach settings" box).
  - Engine: the analysis depth and where it runs (from the Game tab).

  Opening the dialog refreshes the gateway's status and usage, as opening the old box did.
- **What stayed in the tabs**, because it belongs to their task:
  - Game: the new game's colour, start, strength, style, clock and live help, the help level being part of a game's setup and changed during it.
  - Coach: the aspects a comment covers, the interesting moves with their line count and window, and the challenge results, now under their own heading.
- **Layout:** the dialog is at most 560 px wide, 16 px from the edges on a phone, with a sticky title bar and scrolling contents.
- **Tests:**
  - e2e `settings.spec`:
    - open and close by Escape, button and backdrop, with focus back on the gear;
    - Tab never reaches the page behind;
    - the controls live in the dialog and not in the tabs, and the settings persist after a reload;
    - no sideways scrolling at 360 px.
  - The tests and scripts that used the moved controls open the dialog first (`openSettings` and `closeSettings` in the fixtures; the eval runner and the flipbook tour click the gear). German has the new strings.

### Deviations

- **Live help stays on the Game tab.** It's part of setting up a game, and players change it during one. The plan had grouped it with the settings.
- **"Focus stays inside" is the browser's modal behaviour.** Tab moves through the dialog and then into the browser's own toolbar, never to the page behind. The test checks exactly that, rather than a hand-made focus trap.

---

## 2026-10-22 — Fix: a merge ran the boot twice; the language switch keeps the game

TODO items: fix for 1.15 and 10.8.1.

### Implementation notes

- **The bug:** merging the languages (#28) and the kept game (#31) left both versions of the boot code at the end of the page script. `start()` then ran a second time with no data and started a new game, so on main a reload lost the game again. No test caught it before merging, because each PR passed alone; the keep-game tests fail on the merged main.
- **The fix:** the old boot lines are gone, and the debug hook (`window.__kibitz`) is set once, with the language fields.
- **The language switch** no longer saves a running game to the library and asks first. The game now survives the reload (1.15), so the switch keeps the snapshot and reloads, and the game goes on in the new language. A duplicated, unticked TODO 1.15 line from the same merge is removed.
- **CI on main** was red from #30 on, for a second reason: on CI, Stockfish runs with one thread, so the engine's name shows without "· N threads", and the German test found that bare name untranslated. The engine's name is data now (`translate="no"`), and only "threads" is translated.
- **Tests:** the keep-game tests pass again on main. e2e `i18n.spec`: switching the language in a running game keeps the game going, and the engine's name is marked as data.

### Insights

- **Two PRs that each pass can still break main together.** CI runs on main after every merge and showed it, red after #30 and #31. Check that run before starting new work.
- **A test that only passes on one machine** depends on that machine, here the number of CPU threads. The German check now ignores the engine's name.

---

## 2026-10-22 — The game on the board survives a reload

TODO items: 1.15.

### Implementation notes

- **Before:** inside the Claude artifact, the host's snapshot (`window.claude.hot`) brought the game back after a reload. The local app (`just serve`) has no host, so every reload started a new game, and a running game was lost unless it had been saved to the library.
- **Now:** the snapshot the host takes (`snapshot()`: PGN, comments, game id, cursor, mode, colour, orientation, Elo, style, start ply, clock times) goes to `localStorage` under `kibitz.current` when there's no host.
  - It's written 400 ms after any change (`renderAll` and `renderMoves` schedule it, so every move, take-back, load and setting counts), and at once when the page is hidden or goes away (`pagehide`, `visibilitychange`).
  - `boot()` reads it back through the same `start()` the host uses. So a running game resumes with its clock, Stockfish moves if it was to move, and a loaded game comes back in analysis at the same move.
- **Details:**
  - An untouched start position isn't kept, so a new visit starts a new game as before.
  - The clock doesn't run while the page is closed.
  - With two tabs open, the last change wins.
  - A failed write (storage full) is announced once, instead of losing the game silently.
- **Tests:** e2e `keep-game.spec`: a reload in the middle of a game, which goes on afterwards; a timed game keeps its times; a snapshot saved with Stockfish to move makes it move; a loaded game comes back at the same move; an untouched start isn't kept.

### Deviations

- **A finished game also comes back after a reload,** in analysis, as inside the artifact. It's already in the library, and showing it again is what the host does too. The plan had said to clear the snapshot when a game ends.

### Insights

- **The artifact's snapshot was already the right format.** The work was to write it locally and read it back through the same `start()`, so both hosts restore a game the same way.
## 2026-10-21 — Paid runs ask first: `just eval` and `just flipbook`

TODO items: none (tooling). It goes with 2.11, the budgets for paid models.

### Implementation notes

- **The problem:** the eval and flipbook scripts call the AI provider in `.env` with its keys, a call per position or step. Earlier today, model variables set in the shell (Opus for the coach and the judge) cost about $2 that no one had agreed to, and 20 of those calls graded error messages.
- **The guard** (`site/scripts/paid.mjs`): once the gateway is up, and before the first call, both scripts print who answers, with which models (from the gateway's status, or the judge's config) and about how many calls.
  - With a paid provider (Anthropic, OpenAI, Mistral) as coach or judge, they stop there and send nothing. `--yes` (`just eval … yes=1`, `just flipbook … yes=1`) runs them.
  - Ollama, the in-browser model and the mock run without asking.
- **Stop at the first error:** the eval already stopped at a coach error; now a judge error stops it too. The flipbook stops at the first answer that is an error, so a bad key or a used-up budget costs one call.
- **Docs:** the examples in the justfile and in `site/eval/README.md` no longer suggest Opus. They use the models in `.env` and show the `yes=1` step.
- **Tests:** unit `paid.test`: what needs `--yes`, and the plan text. Both scripts were run against Anthropic without `--yes`: they printed the plan and sent nothing. The mock flipbook and the eval e2e test run as before.
## 2026-10-21 — Fix: a rejected request says why; no key fragments in the log

TODO items: fix for 2.x (the AI gateway's errors).

### Implementation notes

- **The bug:** with Ollama and a model pulled by an older Ollama (`deepseek-R1:latest`), the coach said "The coach couldn't answer just now", and Test connection said "Failed: The AI provider returned an error". Ollama's own reason, `"deepseek-R1:latest" does not support chat`, was dropped: every status the gateway didn't know (here 400) became the generic `provider_error`.
- **The fix:**
  - A rejected request (400) becomes `provider_rejected`, with the provider's reason in the message: "The AI provider rejected the request: …". The page shows that message in the chat and in Test connection.
  - `providerReason()` gives the provider's words as one short line, and replaces anything that looks like a key (`sk-…`, even masked) with "[key]".
  - The gateway's error log now uses it too. Before, a wrong OpenAI key put "sk-proj-***…sU5G" into the server log, against the rule that keys stay out of logs.
- **Tests:**
  - unit `ai.test`: a 400 with a reason maps to `provider_rejected` with that reason, and to `provider_error` without one; key fragments are cut and the length is capped.
  - e2e `coach.spec`: a rejected request shows its reason in the chat.

### Insights

- **The same model fails differently depending on the request.** Ollama answers the old model with 404 "not found" through the SDK's streaming request, but with 400 "does not support chat" through a plain one. Both now say what's wrong. The cure is `ollama pull deepseek-r1` again, or another model from `ollama list`.
## 2026-10-21 — Languages: English and German

TODO items: 10.8.1 (10.8 started).

### Implementation notes

- **The approach:** English stays the source, and a language is a dictionary from English text to its translation (`site/src/platform/i18n.js`, `i18n-de.js`).
  - The page translates what it shows as it appears: the markup once at load, then every text node and every title, placeholder and aria-label added later, through a MutationObserver.
  - Code that builds text needed almost no change, and neither did the pure modules (`knowledge.js`, `tutor.js`, `modes.js`) whose sentences the page shows.
- **Templates:** a key is exact text or a template with `{placeholders}` ("{n} moves ready. …"). The parts are translated again, so sentences built from smaller pieces come out whole. Two extensions cover German grammar:
  - `{p|the *}` looks the part up inside a phrase, so "the knight" becomes "den Springer" and "knight move" becomes "Springerzug";
  - keys starting with "@" only translate parts, never whole text, so a loose connector like "{a} and {b}" can't half-translate an unknown sentence.
- **What stays as it is:** text inside `translate="no"`, which covers:
  - the board, the coach's answers (already German) and PGN comments;
  - player names, book titles and authors, opening names (eco.json is English), and model ids.

  Elements marked `data-raw` keep their attributes too, such as an opening name as a title. Text built from translated parts with numbers in German format (the token counts) is marked the same way.
- **The coach:** the prompts stay in English, which every model follows best, and a rule asks for the answer in German, using "du" and English move letters (`coachRules`). Comments are cached per language. The few moves an answer still writes with German letters (Sf3, Dxd5) become SAN before they're checked and shown (`germanSanToSan`), and so do moves typed that way. Game references in German answers link too ("die Opernpartie", "Morphy gegen den Herzog").
- **The switch:** a select in the header. The choice is saved and the page reloads. Without a saved choice, the browser's language decides.
  - Inside the Claude artifact, the host's snapshot brings the game back.
  - The local app can't resume a running game yet (new TODO 1.15). So the switch asks first, and saves the game in progress to the library as unfinished.
- **Tests:**
  - unit `i18n.test`:
    - the translator, German move letters and German speech;
    - the dictionary covers every text and attribute in the markup and every label the modules show;
    - each template's placeholders match its key;
    - the coach rule and the cache key.
  - e2e `i18n.spec`:
    - the switch, and a German move typed;
    - the coach asked for German, its German letters read as moves, a German game name linked;
    - every tab with a loaded game: with `?debug`, the page records each text it showed without a translation, and that list must be empty;
    - and back to English.

### Deviations

- **Moves keep the English letters,** as on Lichess, rather than K, D, T, L, S. German letters are read, not shown. Showing them, or figurines, as a setting is 10.8.2.
- **Opening names and the classics' PGN comments stay English** (10.8.3), as do book titles, which are published names.
- **The tutor eval set is English only** (10.8.4).

### Insights

- **Translating in the DOM beats rewriting every string.** The page builds its text in about 200 places, many of them sentences put together from module output. Matching the finished text against templates kept those places unchanged and made German a single file to review.
- **A debug list of untranslated text is the test.** Crawling the page in English with `?debug` gave the complete inventory to translate. The same list in German, empty, is the e2e check, and it found everything the first dictionary missed: titles echoed back by the observer, nodes replaced in the same tick, and opening names used as titles.
- **Grammar needs a little more than templates.** German case ("den Springer") and compounds ("Läuferzug") are handled by phrase lookups. Sentences joined with "; " are translated part by part.
## 2026-10-21 — Fix: the coach's context line with "Eval + mistakes"

TODO items: fix for 1.14.

### Implementation notes

- **The bug:** with the help level "Eval + mistakes", the eval bar showed the position after the player's move, but the context line above the chat said "eval hidden while you play". The line only knew two cases, the engine shown or not, and so contradicted the setting.
- **The fix:** one function, `evalNode()`, now decides which position's evaluation the player may see, for both the bar and the line. With "Eval + mistakes" the line says "eval after your first move" until the first move, and then something like "eval after your move 1. e4: +0.30 d14". With Off and Flag mistakes it still says the evaluation is hidden.
- **Test:** an e2e regression test in `play.spec` covers the line before and after the first move, and after switching to Flag mistakes.

### Insights

- **The bar and the text should be computed by the same function.** 1.14 added the new level to the bar's logic but not to the line that describes the bar.

---

## 2026-10-21 — Answers: wrong moves underlined, game references linked to the game

TODO items: 4.12.5, 4.12.6.

### Implementation notes

- **Wrong moves** (`.san.invalid`) are underlined in red (a 2px border in `--blunder`) instead of struck through, so the move can still be read. The note under the answer still counts them.
- **Game references:**
  - `classics.js` has a name list for each classic: its title ("the Opera Game", "Game of the Century", "Rubinstein's Immortal") or the players as a pairing ("Réti–Tartakower", "Anderssen vs. Kieseritzky").
  - `findGameRefs(text)` returns the matches in text order, without overlaps.
  - `keyPosition(Chess, id)` replays the game to its key moment and returns the FEN, the last move and a label such as "10. Nxb5".
- **In the page:**
  - `renderRich` turns each reference into a button styled as a link.
  - Hovering or focusing it shows the key position on the board, with a dashed frame and a caption. The game on the board isn't touched, and anything that redraws the board (`syncBoard`) ends the preview.
  - A click opens the game at that moment through `openGame`, which asks before leaving a running game.
- **Tests:**
  - unit `classics.test`: titles and pairings are found, while openings and names alone are not ("Philidor Defence", "Lucena and Philidor section", "Morphy's style"); every key position matches the library's position at that ply.
  - e2e `modes.spec`: hovering shows and ends the preview without changing the game, and a click opens the Opera Game at 10. Nxb5.
  - e2e `tutor.spec`: a wrong move is underlined, not struck through.

### Deviations

- **"Links to the original" means the game in our own collection, not an external site.** The link always leads to a game record we've checked with chess.js, and the page never builds a URL from model output. External sources (Wikipedia, a game database) could be added per classic as fixed links later.
- **Only the 13 built-in classics are recognised.** Games in the player's library or imported studies aren't, because their names (player pairings, events) are too ambiguous to match safely in free text.

### Insights

- **A name only links when it means one game.** "Philidor" alone is also an opening and "Lucena" a person, so they need "position" or "study" after them. For the same reason, "Rubinstein's Immortal" must not also match "Immortal Game".
- **The preview is a cheap version of ROAD's scratch board.** It borrows the board for as long as the pointer stays on the link. A variation stepper (4.3) can grow from the same `previewPosition` and `syncBoard` handover.

---

## 2026-10-21 — Tutor eval set: reference positions, scored by key points, move checks and an LLM judge

TODO items: 3.8; closes 2.16.2 (choosing the in-browser model).

### Implementation notes

- **The set** (`site/eval/positions.mjs`): ten positions, each with a quick-question chip and two to four key points. Every key point is one or more case-insensitive patterns, and all of them must match. The positions:
  - tactics: the Opera Game's Nxb5, the Qh5 threat on f7, the Qg5 double attack, the Elephant Trap, a back-rank mate;
  - plans: the d5 break in Steinitz–von Bardeleben, the Sicilian after 3. d4;
  - endgames: the opposition, Lucena, Philidor.

  We checked the key moves with Stockfish 19 at depth 18, so the key points agree with what the engine shows the coach.
- **The runner** (`site/scripts/eval.mjs`, `just eval ai=… judge=… model=…`):
  - serves the app with the chosen provider (or the in-browser model) and drives it headlessly with Playwright;
  - loads each position, waits for the analysis and asks through the chip, so the model gets exactly the prompt a player's question produces;
  - writes `docs/eval/<provider>-<model>.md` and `.json`, and regenerates the comparison table in `docs/eval/README.md`.

  The helpers for driving the coach moved from `flipbook.mjs` to `scripts/coach-page.mjs` and are shared.
- **Scoring** (`site/eval/score.mjs`, pure):
  - the share of key points hit;
  - the move check, using the app's own `checkAnswer` (TODO 3.4): it loses a third for each wrong move;
  - an optional LLM judge, which grades accuracy, insight, clarity and level from 1 to 5. The judge sees the coach's context (with Stockfish's lines as the truth), the question, the answer and the key points. The answer sits between data markers. The judge runs in Node, so keys never reach the page.

  The overall score is the mean of what was measured.
- **Errors aren't answers.** The app now marks a coach bubble that holds an error with `data-error="<code>"`, and the runner reads that code:
  - after a provider's rate limit, it waits a minute and retries, up to three times;
  - any other error stops the run without writing a report.
- **Tests:**
  - unit `eval.test`: every position sets up legally, the patterns compile, and the scoring and summary work;
  - e2e `eval.spec`: every position runs through the app with the mock provider. A provider error comes back as an error, not as an answer to score.

### Results (judge: Claude Opus 5.5)

| Coach | Overall | Key points | Judge |
|---|---|---|---|
| Claude Opus 5.5 | 95% | 97% | 88% |
| Claude Haiku 5.5 | 79% | 76% | 64% |
| Qwen2.5 1.5B, in the browser | 50% | 38% | 11% |
| Qwen2.5 0.5B, in the browser | 42% | 23% | 3% |

Not one of the four runs named a move that chess.js or the engine lines contradicted, except one in the Haiku run.

### Deviations

- OpenAI and Mistral have no results yet. The OpenAI key in `.env` was refused (401), and Mistral rate-limited every request. Those first runs were scored as if the error messages were answers, which is how we found the error handling was missing. We deleted those reports. Re-run them once the keys work: `just eval openai judge=anthropic`.
- The runner doesn't record token usage. A full run with the judge costs ten calls to the coach and ten to the judge.

### Insights

- **The engine grounding works, but explaining is the hard part.** Even the 0.5B model rarely names a wrong move, because it copies Stockfish's lines. What the small models can't do is say *why*, and the judge scores insight lowest.
- **2.16.2:** the 1.5B model stays the default in the browser, being clearly better than 0.5B. It's a fallback for offline and private use, not a substitute for a cloud model. A 3–4B model is worth evaluating once WebGPU memory allows.
- **Haiku misses endgame theory.** It didn't mention the opposition in the king-and-pawn position, and the judge confirmed it. The retrieved classics (3.2.5) include the endgame studies, but no king-and-pawn opposition example yet, so that's where to add one.
- **Key points have to follow the engine, not the textbook.**
  - In the Lucena position, Opus followed Stockfish's line, 1. Rb1 and 2. Rd1+, then the king walks out, and never built the textbook bridge on the fourth rank. Its answer is correct, but it misses that key point.
  - A key point that the engine's line doesn't need measures book knowledge, not coaching. That's why the judge, with Stockfish's lines as the truth, stays part of the score.
  - Matching by regex is cheap but coarse, so each report keeps the judge's notes beside it.

---

## 2026-10-21 — Classic games for the coach: a first collection, retrieved by theme

TODO items: 3.2.5 (and 3.2); started 7.3 and 7.4.

### Implementation notes

- **The collection.** `classics.js` is pure data and retrieval, like `knowledge.js`. It holds:
  - nine games: the Opera, Immortal and Evergreen games, the Game of the Century, Réti–Tartakower, Légal's mate, Lasker–Thomas, Rotlewi–Rubinstein and Steinitz–von Bardeleben;
  - four studies: Réti's king march, Saavedra, Lucena and Philidor.

  Each has tags from the `TAG_LABELS` vocabulary, a one-line lesson, the ply of its key moment, and comments we wrote ourselves. The two games that were hard-coded as library examples are now the first two entries.
- **Retrieval** (`retrieveClassics`) scores each game by the weights of the position's features that match its tags, so the opening family and the motifs in the best move count most. This complements `similarPositions`, which only finds the same position or pawn structure, and which a classic rarely shares with the player's game.
- **Where it shows:**
  - The coach's context lists up to two classics on the position's themes. The "Similar games" aspect now asks about them too.
  - The Reading tab gains "Classic games on these themes", with an Open button that loads the game at its key moment.
  - The library gets a Classics filter. "All" shows the player's own games, and the classics only while the library is empty or during a search, so 13 built-in entries don't bury the player's games.
- **Tests:**
  - unit `classics.test`: every score loads in chess.js with every move legal; games ending in "#" are really mate, and the mated side lost; key moments lie within the game; tags are known; the famous finishes are in place; retrieval ranks by theme.
  - e2e `modes.spec`: a Caro-Kann finds Réti–Tartakower in the Reading tab, which opens at 9. Qd8+; the coach's context lists classics; the library filters work. The smoke and regression tests now expect 13 built-in games in an empty library.

### Deviations

- **The scores were written from memory.** chess.js can prove every move legal and every final mate real, but not that a game was played exactly so. The collection is small and limited to the most-published games. A larger one needs sources and licences per item (7.1).

### Insights

- **Position matching rarely finds a classic.** An exact position or pawn structure is a strong signal, but too rare to catch most games; tags by theme and opening family find a classic for most positions.

---

## 2026-10-21 — Explanation modes: commentary, challenges, interesting moves

TODO items: 3.9 (3.9.1–3.9.5).

### Implementation notes

- **Modes** (`tutor.js`). "How the coach works" in the Coach tab has five modes:
  - Only when asked (3.9.1);
  - After my mistakes;
  - After my moves;
  - Commentary on every move (3.9.2);
  - Challenge me (3.9.3).

  `shouldComment` lets commentary cover both sides' moves, including a loaded game's as you step through it. In a game the comment still gets only the view the help setting allows (`engineView`), and with help off there is no commentary. Comments use the quick model and the comment cache (3.7).
- **Interesting moves** (`modes.js interestingMoves`, 3.9.4):
  - Two settings: the analyst's line count (3–5, MultiPV) and a window of 0.5, 1 or 2 pawns from the best move.
  - Lines within the window are described from the board and the engine's own line:
    - **sacrifice:** material given up within four plies, or a piece offered that the line takes;
    - **trap:** a piece left to be taken that the engine's line doesn't take, counted net of what the move itself captured and of recaptures;
    - **different plan:** another piece, on another wing, than the best move;
    - **quiet move:** shown only when the best move is forcing.
  - The Coach tab lists the best move and the picks, with rank, evaluation and the gap to the best. Hovering one draws it on the board.
  - The coach's context gets the same picks (`interestingLines`), and a quick chip, "Other good moves", asks about them.
  - All of this only when the evaluation may be shown.
  - The analysis cache now re-runs a position when it holds fewer lines than the setting asks for.
- **Challenges** (`modes.js makeChallenge`, `checkChallenge`):
  - **Best move:** any move within 30 cp counts; only mating moves count when the best one mates.
  - **The better of two:** the best move against one at least 80 cp worse, shown as option chips.
  - **The threat:** the position with the other side to move (`flipSide`; not when in check). It needs a concrete threat: a mate, or two pawns of material won along the opponent's line.
  - **Answering:** chips, or typed into the composer through the typed-move parser, so "ra8" and "0-0" work. Anything that isn't a legal move leaves the challenge open. "Show me" reveals the answer.
  - **What follows:** only after the engine's verdict does the coach explain, if a model is set up. Challenges work without one too.
  - **Where:** in challenge mode the coach asks after each move in analysis, and in a game with Full engine help after Stockfish's reply. The "Challenge me" chip asks at any time.
  - **Progress:** results per theme (the motif of the answer move, else "calculation") are kept in the browser (`recordResult`) and shown in the Coach tab.
- **Tests:**
  - unit `modes.test`: tags on fixed lines, the window, Black's scores, each challenge kind and its checks, flipped positions, progress;
  - `tutor.test`: commentary;
  - e2e `modes.spec`: commentary on a loaded game, the interesting-moves list and the line setting, a challenge answered by chip, by typing and with an illegal move, and challenge mode asking by itself.

### Deviations

- **Challenges stay out of games** unless help is Full engine. Asking for the best move or the threat would otherwise hand out engine help the player switched off.
- **"Trap" is a heuristic.** It marks a piece offered that the engine's own line doesn't take: what looks free to a human, not proven to lose for whoever takes it.

### Insights

- **The first threat test was wrong.** It judged a threat by how much the opponent's evaluation improves if they could move now. When the side to move has mate in one, every opponent move looks like a huge "threat". A threat has to be concrete: a mate, or material won along the opponent's line.
- **A trade isn't a sacrifice.** Material has to be counted across the whole exchange: Bxf6 Qxf6 is even, while Nxb5 cxb5 Bxb5+ leaves a knight for two pawns.
- **Evaluations need a side.** "+4.81" for a threat confused even me. Challenge evaluations now always say for whom ("it would give Black +4.70").

---

## 2026-10-21 — Usage and budgets per user for paid models; tokens and cost on every answer

TODO items: 2.11 (budgets and display per user; still open: a per-user rate limit, accounts, persistence).

### Implementation notes

- **Users without accounts.** The gateway gives each browser a random `kibitz_uid` cookie (128 bits, `HttpOnly`, `SameSite=Strict`, path `/api/`) on its first API request, and counts by it (`api.mjs userOf()`).
- **`userLedger()`** (`usage.mjs`) keeps each user's day: requests, tokens in and out, and the cost from `AI_PRICES`.
  - **Limits for paid models only:** `AI_TOKEN_BUDGET_PER_USER_PER_DAY` and `AI_COST_BUDGET_PER_USER_PER_DAY` (US dollars).
  - "Paid" means a provider that isn't local. Ollama, the in-browser model and the mock are counted but never limited.
  - **A spent budget** returns 429 `budget_exceeded`, with a message the dialogue shows as is: what was used, that it resets at midnight, and that local models still work.
  - Users roll over at midnight, and at most 10,000 are kept, the oldest dropped first.
- **The server-wide ledger** (`AI_TOKEN_BUDGET_PER_DAY`) still counts everything and caps the total.
- **API:**
  - `/status` gains `user` and `paid`.
  - The stream's `done` line carries `usage` with the request's `cost`, and the user's totals.
  - `/structured` and `/test` return the same.
- **Page:**
  - Under each coach answer and comment: "720 + 29 tokens · $0.0026".
  - Under the composer: "You today: 2 answers, 1,531 tokens, about $0.0053", plus what's left of the budgets when the provider is paid.
  - The coach settings show the server's day and the user's.
- **Tests:**
  - Unit (`usage.test`): `costOf`, per-user totals, both budgets, unpriced models, the day rollover, the cap on users.
  - API (`api.test`): the cookie, per-user budgets enforced for a paid provider and not for a local one, the cost budget.
  - e2e (`coach.spec`): the note under each answer, the running total, and a spent budget's message.

### Deviations

- **No per-user rate limit yet.** The per-minute limit is still server-wide.
- **Soft per-user budgets.** Until there are accounts, clearing the cookie starts a new day; the server-wide budget is the hard cap.
- **Usage lives in memory,** like the server ledger, so a restart resets it.

### Insights

- **A comment can hide part of a config line.** Adding `AI_PRICES` to the one-line env object in `playwright.config.mjs` with a trailing `//` comment silently commented out the blanked API keys after it. The test server then saw a key from the shell. A test caught it, because a provider button was enabled that should have been disabled. No real request went out, since the provider stayed `mock`. The fix is an inline `/* */` comment, checked by loading the config.

---

## 2026-10-21 — Help level "Eval + mistakes"; the hidden eval bar no longer leaks its score

TODO items: 1.14 (added).

### Implementation notes

- **A fourth help level.** The order is now Off, Flag mistakes, **Eval + mistakes** (`help: 'eval'`), Full engine.
  - Mistakes are flagged, as with Flag mistakes.
  - The eval bar shows the position after the player's last move (`lastOwnMove()`). Its tooltip reads "Stockfish after your move 1. e4: +0.3".
  - The best-move arrow stays hidden.
  - `engineView` maps the level to `'past'`, so the coach sees what it sees with Flag mistakes.
- **The bar holds through Stockfish's reply.** It shows the position after your move until you move again, and live analysis of later positions is ignored. If it followed the board, a sudden jump after the reply would tell you the engine had blundered and a tactic was waiting.
- **Fix:** while the evaluation was hidden, the bar's tooltip still showed the score ("Stockfish: +0.29"). It now reads "Engine evaluation: hidden while you play".
- **Tests:**
  - e2e in `play.spec`: the bar is hidden before your first move, then shows "after your move 1. e4" once Stockfish has replied, with no best-move arrow.
  - e2e regression: the hidden bar's tooltip has no score.
  - Unit test in `tutor.test`: `engineView` with `'eval'`.
  - Both e2e tests fail on the previous build; the tooltip test receives "Stockfish: +0.29".

### Insights

- **Hiding has to cover every surface.** The bar's height was hidden, but its tooltip, added when the bar got too narrow for a number, still showed the score.

---

## 2026-10-21 — Flipbook: the Opera Game, explained by Claude; the chat knows the review

TODO items: none (docs). It adds to 4.6, the chat's context: the review's findings go into it.

### Implementation notes

- **The tour** (`site/flipbook/tour.mjs`) is now one story: Morphy's Opera Game, in 11 steps.
  1. The coach explains the plan after 9. Bg5.
  2. It proposes its own move for Black, and compares it honestly with the engine's lines.
  3. It explains the 10. Nxb5 sacrifice, then why taking the knight still loses.
  4. The review shows the evaluation graph and the turning points.
  5. The coach reads the graph, explains the 9… b5 turning point, and writes the summary and a study plan.
  6. You play 10. Nxb5 yourself against Stockfish, and the coach comments.
- **The runner** (`site/scripts/flipbook.mjs`):
  - New acts: `ply`, `askBy`, `capture`, `hover` and `move … comment`.
  - The README quotes every answer under its screenshot, with wrong moves struck through, and counts the moves the engine backs, the legal moves it doesn't list, and the wrong ones.
  - `--ai anthropic` (or another provider) picks the provider, with its key from `.env`. Model variables set in the shell take precedence over `.env`. The README names the model for each task.
- **Rendering:** with Claude Opus 5.5 for every task: `ANTHROPIC_MODEL=claude-opus-5-5 ANTHROPIC_MODEL_QUICK=claude-opus-5-5 ANTHROPIC_MODEL_REVIEW=claude-opus-5-5 just flipbook anthropic`. One run takes about 3 minutes and 11 requests.
- **The chat knows the review.** After a review, `contextFor()` adds `reviewFacts()`:
  - the accuracies and counts;
  - the evaluation after every move (what the player sees as the graph);
  - the turning points, with the better move and its line.

  `turningPoints()` is shared with the summary prompt.
- **The answer check** knows the same facts. `checkAnswer` takes `extra` lines in SAN, and after a review `checkFor` passes the turning points' better lines and counts the game's moves to the end.

### Deviations

- The flipbook is no longer a tour of every tab. The settings, the phone layout and dark mode are left out, so that it can show what the model adds.

### Insights

- **The first render exposed a gap.** Asked to read the evaluation graph, Claude answered that it couldn't, because the chat never received the review's findings. Only the summary prompt had them.
- **Then the check went wrong.** Once the findings were in the chat's context, the check struck through correct moves: the turning points' better lines (from other positions), and game moves after the position on the board. Context and check have to grow together.
- **The model matters.** With `claude-haiku-5-5`, the default, the answers were thinner and sometimes misleading ("Black's queen is gone" for a queen trade). With Opus, the coach proposed 9… h6 as its own idea, found the catch itself (the queen on f6 no longer guards b7), and said it couldn't evaluate the move. The check marked its untested line "Bxf6 Qxf6" as not one of the engine's.
- **What the coach sees in a game matters too.** With help on "Flag mistakes", the comment on 10. Nxb5 said it "won a pawn": true from what the coach was shown, but misleading. The last step uses "Full engine".
- **Comments stream without the Stop button,** so the runner also waits until the answer's text stops changing.

---

## 2026-10-21 — Flipbook: a happy path through the app in screenshots

TODO items: none (tooling for the docs, modelled on the demo flipbooks of the OrgFab workbench).

### Implementation notes

- `just flipbook` builds the site, then runs `site/scripts/flipbook.mjs`. The runner:
  - serves `site/dist` with the gateway on port 8797;
  - drives the page in a headless Chrome through Playwright;
  - writes one whole-page screenshot per step and a `README.md` into `docs/flipbook/`.
- `site/flipbook/tour.mjs` is the single source of truth: 15 steps, each with a title, a caption and declarative acts (`tab`, `click`, `fill`, `range`, `move`, `ask`, `confirm`, `waitFor`, `wait`, `scroll`, `viewport`, `scheme`, `js`).
- The path:
  1. a game against Stockfish at 1200, with "Flag mistakes";
  2. a hint;
  3. a quick question and a typed question to the coach;
  4. resignation, with the game saved;
  5. the Opera Game loaded for analysis at 10. Nxb5;
  6. the review and the coach's summary;
  7. the library, the reading list and the coach settings;
  8. a phone width and dark mode.
- `move` acts take a list of moves and type the first legal one, because Stockfish's replies vary between runs. `ask` clicks the quick-question chip with that label, or else types the question, and waits until the answer has finished streaming.
- The coach uses the provider in `.env` by default, like `just serve`. `just flipbook mock` blanks the keys and uses the mock provider. The README states which provider answered.
- Uncaught page errors and CSP violations fail the run, as in the e2e tests.

### Deviations

- The OrgFab flipbooks keep their capture tooling in a separate npm package. Here it reuses `@playwright/test` from `site/`, so no new dependency is needed.

### Insights

- Screenshots of the viewport cut off the move list and flags under the board, so the runner takes whole pages.
- The toast lasts 2.2 s. A step that triggers one waits for it to fade before its screenshot, so it doesn't cover the controls.
- The tour's selectors (`#coachChips`, `#chat`, `#coachInput`, the tabs) work with both layouts, the chat in the Coach tab and the dialogue beside the board (4.9.2). The tour produced all 15 steps on each.
## 2026-10-21 — PDFs of the Markdown documents

TODO items: none (tooling for the docs, adapted from the OrgFab repo's `just pdf` and `just pdfs`).

### Implementation notes

- `just pdf FILE` turns one Markdown file into an A4 PDF next to it, keeping the full name (`docs/ARCH.md` → `docs/ARCH.md.pdf`):
  - pandoc writes a standalone HTML page, with images embedded and math as MathML;
  - headless Chrome prints that page to PDF.
- `just pdfs [PATHS]` does it for every Markdown file that git tracks or would track. It skips `CLAUDE.md`, which only points at AGENTS.md, and `.github/`.
- The typography is in `utils/pdf/style.css`: a serif body, sans headings and tables, Menlo for code. Task lists (TODO.md) get checkboxes. Screenshots scale to the column, and in print to the page height.
- Documents with ```` ```mermaid ```` blocks (ARCH.md) also get `utils/pdf/mermaid.html`. pandoc downloads Mermaid 11.4.1 from jsDelivr and embeds it, and Chrome draws the diagrams before printing.
- Builds are incremental. `.pdfstamps/` keeps a hash of the source and build inputs, and of the PDF produced, so unchanged files are skipped. A second `just pdfs` skipped all 9 documents.
- `*.md.pdf` and `.pdfstamps/` are ignored by git.
- `CHROME=/path/to/chrome` picks another browser; the default is the macOS Chrome.

### Deviations

- The OrgFab version also renders its own specification languages (L3, L4) and their syntax highlighting. Kibitz has neither, so that part is left out. Mermaid support is new.
- Input is GitHub-flavoured Markdown (`-f gfm+tex_math_dollars`), so task lists and tables come out as on GitHub.

### Insights

- pandoc writes a Mermaid block as `<pre class="mermaid"><code>…</code></pre>`. Mermaid reads the `<pre>`'s markup, so the script first replaces it with its plain text.
- Building a document with diagrams needs the network once per build, for the Mermaid download. Without diagrams, building needs no network.

---

## 2026-10-21 — The dialogue beside the board

TODO items: 4.9.2 done; 4.9.3 partly.

### Implementation notes

- **The dialogue moved out of the Coach tab** to the top of the right-hand column. It holds:
  - the context line;
  - the in-browser model box;
  - the chat;
  - the Comment button with the quick chips;
  - the input.

  It is visible whichever tab is open. On wide screens it is exactly as tall as the board column from its top to the "You" row: a `ResizeObserver` on the board sets `--board-h`. On a phone it comes after the board and the move list, at most 75% of the screen high.
- **The tab panels below fold away** with a toggle at the start of the tab bar. The choice is remembered, and clicking any tab opens them again. The toggle is not a tab: the tab code now selects `[role="tab"]`, and the toggle's `aria-controls` lists the panels.
- **The Coach tab keeps the coach's settings:** the aspects, when to comment by itself, the provider.
- **What the dialogue replaces:** the comment box under the board and the dot on the Coach tab (from the tutor work) are gone. Automatic comments appear in the dialogue, which is always in view. Asking the coach no longer switches tabs.
- **Tests:**
  - `layout.spec` (3): beside the board and level with it across tabs and window sizes; folding, remembered over a reload, any tab reopens; the phone layout without sideways scrolling.
  - The tutor test now finds automatic comments in the dialogue.

### Deviations

- **No drawer on phones.** The dialogue simply follows the board. A drawer would cover the board, which is what the player is looking at.

### Insights

- **Tests that click below the fold need the board scrolled back into view.** The Game panel now sits under the dialogue, so tests that pick an option there scroll the page. chessground forgets its cached board position on the scroll event, which only fires on the next frame. A click right after scrolling went to the old coordinates and was lost: flaky, 2 of 3 runs. `move()` in the fixtures now scrolls the board into view and waits two frames. People can't click within a frame, so the page itself is fine.

---

## 2026-10-21 — Offline mode: a small model in the browser

TODO items: 2.16.0, 2.16.1, 2.16.3–2.16.6 done; 2.16.2 partly (model choice with the eval set, 3.8).

### Implementation notes

- **`just offline`:**
  - `scripts/fetch-model.mjs` downloads the chosen model once into `site/models/` (git-ignored) and checks its size and SHA-256 against the catalog in `server/models.mjs`. A marker file records the passing check, so later runs and server starts don't hash a gigabyte again.
  - It then serves with `AI_PROVIDER=browser`, `AI_LOCAL_ONLY=1`, no `.env` (`--env=`), `--models site/models` and `--offline`.
  - `just serve` also passes `--models`, so a downloaded model shows up there as "In browser".
- **Catalog:** two models, both Apache-2.0 and pinned by size and SHA-256 from the Hugging Face metadata:
  - Qwen2.5 1.5B Instruct Q4_K_M (1.12 GB), the default;
  - Qwen2.5 0.5B Instruct Q4_K_M (0.49 GB): `just offline qwen2.5-0.5b`.
- **Server:**
  - The gateway has a `browser` provider. It's local, so local-only mode allows it and falls back to it after Ollama.
  - The gateway never runs it: a request to it there fails with `in_browser`.
  - `/api/ai/status` tells the page where the weights are (`browser: {url, name, bytes}`).
  - `serve.mjs --models DIR` serves only the catalog's `.gguf` files, with an ETag, never a listing.
  - `--offline` drops the Google Fonts links from the page, and the CSP then allows no other host at all.
- **Runtime (`src/coach/browser-llm.js`):** wllama 3.8.1 (MIT, llama.cpp) runs the GGUF model on WebGPU, or in multi-threaded WebAssembly on the CPU, inside its own worker. The build copies `wllama.js` and `wllama.wasm` into `dist/`, and the page imports them only when the model is first needed. `createBrowserModel()`:
  - loads on first use, with progress;
  - streams answers, cancels through the abort signal, and turns a JSON schema into `response_format`;
  - runs one request at a time;
  - joins consecutive messages of one role, for the chat template;
  - unloads after ten idle minutes;
  - refuses to load when `navigator.deviceMemory` says the model won't fit.
- **Page:**
  - **Coach settings:** "In browser" is a provider like the others. A box above the chat shows the model, its size and state, with Load and Unload. Nothing loads until the player presses Load; the consent is remembered.
  - **Routing (2.16.5):** a setting sends only quick requests (chips and coach comments) to the in-browser model, everything else to the gateway.
  - **Connection test:** for the in-browser model it runs in the page.
- **Stockfish and the model share the CPU (2.16.4).** While the model generates on the CPU, the analyst gets fewer threads (`Engine.limitThreads`, applied between searches, never during one). On WebGPU it keeps them all.
- **Tests:**
  - Unit tests:
    - `browser-llm` (11): loading once, streaming, cancelling, one request at a time, idle unload, threads, memory check, storage fallback;
    - `models` (3): catalog, download check, servable files;
    - `serve` (2): offline page and CSP, model files only;
    - the `browser` provider in `ai.test`;
    - `Engine.limitThreads`.
  - Playwright `offline.spec` (3), with a fake `wllama.js`: consent, loading, an answer from the page with no request to the server, the connection test, unload; routing; local-only.
  - `offline-live.spec` runs the real model only with `KIBITZ_LIVE_MODEL=1`. It passed with both models. Each loaded and answered on WebGPU, and the page made no http(s) request to another host.

### Deviations

- **wllama only, not WebLLM first (2.16.1).** wllama has run on WebGPU since v3, with WebAssembly as its own fallback. One MIT dependency with one wasm file covers both paths and loads any GGUF file from our server. WebLLM would need its own compiled model libraries and a second runtime. Chrome's built-in model is still open.
- **Not in our Worker.** wllama starts its own worker (from a blob URL, allowed by `worker-src blob:`), so the page-side provider doesn't need one.
- **Model chosen before the eval set exists.** Qwen2.5 is well known, Apache-2.0, has no "thinking" mode to switch off, and has official GGUF files. 3.8 should decide between it and newer small models. Adding one is a catalog entry.

### Insights

- **The browser's storage quota is the real limit, not memory.** wllama always downloads into the browser's private storage (OPFS), even with `useCache: false`. A 1.1 GB model failed in the test browser with "exceed its storage quota", as it would in a private window. The page now checks `navigator.storage.estimate()` first: when the model doesn't fit, or caching fails on the quota, it fetches the file itself and hands it to wllama in memory. The 0.5 GB model fit either way, which is why only the default model showed the problem.
- **Quality follows size.** On the same coach prompt:
  - the 0.5B model suggested "developing the rook on h8" in the starting position;
  - the 1.5B model said to develop pieces and control the centre.

  The answer check (3.4) marks wrong moves either way. A small model is fine for putting the engine's facts into words, not for chess judgement.
- **Speed on WebGPU (Apple silicon, Chrome):** a full coach answer to a 2,950-character prompt took about 4 s with the 0.5B model.
- **A test that waits for the "thinking" style to go reads a half-streamed answer.** It disappears with the first chunk; the Stop button only disappears at the end.

---

## 2026-10-21 — Tutor commentary: aspects, templates, checked answers, when to comment, cache

TODO items: 3.2.1–3.2.4, 3.3, 3.4, 3.6, 3.7 done; 3.2.5 partly.

### Implementation notes

- **`site/src/coach/tutor.js`** (new, pure, unit-tested) holds the tutor logic. The page only wires it up.
- **Aspects and templates (3.2, 3.3):**
  - The five aspects are Last move, What's next, Keep in mind, Good habits and Similar games. Each has its own instruction.
  - `commentRequest()` asks for them in a fixed order, under a word limit.
  - `COACH_RULES`, the shared rules that used to be the page's `RULES`, now also say that every move or line must come from the engine lines or the game, and that unbacked moves are marked for the player.
  - The Coach tab has an aspect picker and a "Comment on this position" button. The choice is saved with the other settings.
- **"Keep in mind" data:** `safetyNotes()` lists, straight from the board:
  - pieces attacked and not defended;
  - pieces attacked by something cheaper;
  - loose pieces (no defender);
  - castled kings with fewer than two shield pawns.

  These go into every coach context as "Keep in mind (from the board)".
- **No spoilers mid-game (3.6):** `engineView()` decides what the coach may see.
  - **'all':** analysis, a finished game, or help "Full".
  - **'past'** (help "Flag mistakes"): how the player's own moves rated and what was better then, but not Stockfish's view of the current position.
  - **'none'** (help "Off"): no engine data at all.

  `contextFor(i, { view })` follows it, for every coach request, including typed questions. The aspects that need the engine's view of the position (What's next) are left out mid-game, and the picker says so.
- **When to comment (3.6):** the choices are "Only when asked" (the default), "After my mistakes" and "After every move".
  - `shouldComment()` allows comments only on the player's own moves, which are marked `byUser` when played on the board. Loaded games are never commented on by themselves. With help Off, the coach never comments by itself.
  - Each move is commented on at most once.
  - An automatic comment shows under the board, as well as in the chat, and the Coach tab gets a dot.
- **Checked answers (3.4):** `checkAnswer()` sorts every move-like token:
  - **in Stockfish's lines:** for this position or the one before;
  - **a game move;**
  - **legal but unchecked:** legal here or one move earlier, but in no engine line;
  - **invalid:** none of these;
  - **a square:** "the knight on f3" names a square, not a move.

  It also checks two kinds of claims:
  - Moves separated only by spaces and move numbers are read as a line. That line must be a contiguous run of an engine line or of the game, or the moves after the matching part are invalid.
  - "Bishop on b5"-style claims are checked against the board now and one move before.

  The chat and the comments strike through invalid moves, grey out unchecked ones (a tooltip gives the reason), and add a note when something is wrong.
- **Cache (3.7):** `commentKey()` combines the EPD, the move that led to the position, the aspects, the engine view, the level and the model. A 100-entry LRU keeps the comments in local storage, so they survive a reload. A repeat shows "(saved)" and costs nothing. Comments use the quick model.
- **Tests:**
  - 15 unit tests: aspects, views, templates, when to comment, safety notes, the answer check (including sentence breaks and squares), the cache.
  - 4 Playwright tests: the picker and the cache across a reload; a faked answer with an illegal move and a wrong piece claim; automatic comments without spoilers; silence with help Off.

### Deviations

- **Flagged, not dropped (3.4).** Removing text from an answer would change what it says. Marking it and telling the player keeps the coach honest, and the player can still read the rest.
- **The review summary isn't checked.** It talks about many positions at once, so a check against one position's lines would mark correct moves. It still gets the shared rules.
- **3.2.5 uses the player's library.** The classic games collection (7.3) doesn't exist yet. The Similar games aspect uses the similar positions already retrieved from the player's library and the built-in examples.
- **No threat search.** "What's next" uses the engine's top lines and the motif detectors. A separate null-move search for threats is part of the engine tools (4.11).

### Insights

- **A full stop looks like a move number.** The first version read "Start with e4. Qh5 wins" as the line 1. e4 Qh5 and flagged it. Only whitespace and real move numbers ("2.", "12...") join moves into a line now.
- **The checker needs the same tokens as the renderer.** Bare squares stay in its output with status "square", so the page can match each mark to the move it renders, in order.

---

## 2026-10-21 — CI: secret scan permissions

TODO items: 0.8 (fix).

### Implementation notes

- The first CI run (PR #11) failed the secret scan with a 403 before scanning anything. On a pull request, gitleaks-action lists the PR's commits through the GitHub API, and the workflow token was limited to `contents: read`. The `secrets` job now also has `pull-requests: read`, and PR comments are off (`GITLEAKS_ENABLE_COMMENTS: false`), so the token stays read-only. A finding still fails the job.

### Insights

- CI ran only on the PR into `main`. The stacked PRs #2–#10 (based on feature branches) never created a workflow run.

---

## 2026-10-20 — Eval bar: narrower, and it turns with the board

TODO items: none (a fix from use; the bar came with the prototype, 1.5).

### Implementation notes

- The bar is 8px wide instead of 30px (`.boardwrap` in `site/src/index.html`).
- With the board flipped, White's part grows from the top, so it's always on White's side. `syncBoard()` sets the `flipped` class from `S.orientation`, the same place the orientation goes to chessground, so every way of turning the board (the flip button, starting a game as Black, loading a game) updates the bar.
- Regression test in `tests/e2e/regressions.spec.mjs`: the bar is at most 10px wide, and at 50% the white part touches the bottom end, then the top end after a flip, then the bottom again. Both checks fail on the old code.

### Deviations

- The score label inside the bar is gone: a number doesn't fit in 8px. The score stays in the bar's tooltip and in the Coach tab's context line ("eval +0.3 d14").

---

## 2026-10-20 — AI provider layer: interface, structured output, models, limits, settings, contract tests

TODO items: 2.2, 2.7, 2.10, 2.14 done; 2.11 and 2.15 partly.

### Implementation notes

- **Provider interface (2.2):** every provider has `chat(messages, {model, system, maxTokens, schema, signal})`, an async generator of text chunks.
  - It returns `{truncated, usage}`. Anthropic's usage includes cached input; OpenAI and Ollama are asked for a usage chunk (`stream_options`); Mistral sends one unasked.
  - `complete()` collects a whole reply.
  - `embed(texts)` covers OpenAI, Mistral and Ollama, configured by `EMBEDDING_PROVIDER` and `EMBEDDING_MODEL` with that provider's key and Ollama host allowlist. It sends one plain POST to `/embeddings` and keeps the vectors in input order. The default models are text-embedding-3-small and mistral-embed; Ollama needs one set.
- **Structured output (2.7):** `POST /api/ai/structured {messages, format}` takes a named format (only `annotations` so far) and returns `{data, truncated, usage, mode}`.
  - The annotation schema has a short text, up to 8 arrows (from, to, kind) and up to 16 highlighted squares.
  - Anthropic gets `output_config.format` (json_schema). OpenAI, Mistral and Ollama get `response_format` (json_schema, strict).
  - Keywords that strict modes reject (lengths, patterns, item counts) are left out of what the provider sees and enforced by our own validator (`server/schema.mjs`).
  - If the provider rejects the format (400/422) or the reply doesn't validate, the request is retried once with the schema in the instructions, and the JSON is parsed out of the text (code fences, surrounding prose).
- **Models per task (2.10):** `quick` (the quick-question chips), `chat` (typed questions, flags) and `review` (game summary, study plan).
  - `<PROVIDER>_MODEL_QUICK` and `_MODEL_REVIEW` fall back to `<PROVIDER>_MODEL`.
  - The page names the task in each request. Unknown tasks are refused, and the artifact host's `sample()` doesn't get the option.
- **Limits (2.11):** `server/usage.mjs` counts requests and tokens per day.
  - `AI_TOKEN_BUDGET_PER_DAY` refuses requests with `budget_exceeded` (429) once it's used up.
  - `AI_PRICES` gives per-model prices for a cost estimate. Models without a price are counted in tokens only, and a day with no priced model shows no cost rather than $0.
  - The status endpoint reports today's usage.
- **Settings (2.14):** a "Coach settings" panel in the Coach tab, shown only with the local gateway.
  - You can switch among the providers `.env` sets up; unavailable ones are disabled and say why.
  - It shows the model per task.
  - Local-only mode is enforced on the server: only Ollama or the mock, with Ollama taking over if it's set up. `AI_LOCAL_ONLY` makes it the default.
  - "Test connection" sends a 256-token request and reports provider, model and time.
  - It shows today's usage.
  - `POST /api/ai/config` and `/api/ai/test` have the same origin, host and content-type checks as the other routes. Changes last until the server restarts.
- **Contract tests (2.15):** the real Anthropic and OpenAI SDK clients get a `fetch` that replays `server/fixtures/*.json`, so the tests cover the SSE wire format, the SDKs' parsing and our adapters together. They check the requests we send too.
  - `scripts/record-ai-fixtures.mjs <provider>` records real responses: two small requests per provider, keeping only status, content type and body. Headers are dropped because they carry account ids; the request isn't kept because it carries the key.
  - The Claude chat and annotation fixtures are recorded: 73 and 943 tokens on claude-haiku-5-5.
  - OpenAI, Mistral, Ollama and the error responses are hand-written from the documented format, and marked so in the file.
  - `server/live.test.mjs` runs a chat and an annotation request per provider, only with `KIBITZ_LIVE_AI=1` (`npm run test:live`).
- The Playwright server now blanks the provider keys it inherits from the shell, so no test can reach a real provider. One key in the shell environment was visible to the test server before this; no test used it.

### Deviations

- **No `stream` flag on `chat()`:** it always streams, and `complete()` collects the reply when a caller wants it whole.
- **Structured output uses JSON-schema output, not tool calling**, on every provider. It's the same mechanism everywhere, and no tool is involved.
- **Formats are named on the server.** The page can't send its own schema, which keeps model output bounded to what the server validates.
- **No built-in price list.** Prices change and I couldn't verify current ones, so cost needs `AI_PRICES`.
- **Usage, the budget and settings changes live in memory** and reset when the server restarts.
- **2.11 per-user limits and 2.9's per-user key store** wait for accounts (10.1).
- **2.15 stays open** until OpenAI, Mistral and Ollama fixtures are recorded.

### Insights

- **Claude's structured output accepts the stripped annotation schema natively.** The recorded reply validated first time, so the fallback is for the OpenAI-compatible servers whose models can't do JSON schema.
- **Strict JSON-schema modes reject some constraints.** Two layers keep it portable: what the provider sees, and what we enforce.
- **Replaying at the `fetch` level catches more than fake clients.** It covers the SDKs' own stream parsing and error classes; the fake-client unit tests stay for edge cases that are hard to record.

## 2026-10-20 — Milestone 1: play against the engine

TODO items: 1.3, 1.4 (partly), 1.6, 1.7, 1.8, 1.9, 1.11, 1.12; 6.8 added.

### Implementation notes

- **`site/src/chess/play.js`** holds the playing rules as pure functions, unit-tested in Node:
  - `gameEnd`: checkmate, stalemate, threefold repetition, insufficient material, fifty-move rule.
  - `timeoutEnd`: a timeout loses, unless the other side has no mating material.
  - Clocks.
  - The opponent's search settings, and `pickWeak` for the weakened mode below 1320.
  - `acceptsDraw`.
  - `checkStart` and `fixCastling` for start positions.

  The inline code they replace in `index.html` is gone.
- **Clock (1.6):** time controls 3+2, 5+3, 10+5, 15+10 and 30+20, with Fischer increment.
  - White's first move isn't timed: it starts Black's clock.
  - Every move stores both clocks, so a take-back restores them.
  - Stockfish thinks within its own time: a thirtieth of what's left plus three quarters of the increment, never more than untimed.
  - A 100 ms tick checks for flag fall. The PGN gets `TimeControl`, and `Termination "time forfeit"` after a timeout.
- **Draw offers (1.7):** an "Offer draw" button. Stockfish evaluates the position at depth 12–16 and accepts if it is at least a pawn worse, or after move 30 when the evaluation is within 0.3. After a refusal the next offer has to wait 5 moves.
- **Start positions (1.8):** the Game tab has "Start from", with three options:
  - the standard position;
  - an opening, searched by name or ECO code in `openings.json`, which the build writes from the Lichess data (3,865 lines, 366 KB, loaded only when needed);
  - a FEN, checked before the game starts and explained when it fails: invalid, side not to move in check, game already over.

  The opening's moves are set up as the first moves of the game; take-backs and draw offers count from there. Stockfish moves first if it is to move.
- **NAGs (1.9):** chess.js parses NAGs but doesn't expose them, so `site/src/chess/pgn.js` reads them from the movetext.
  - It reads both suffixes (`!?`) and `$n`, and skips variations, comments, escape lines and headers.
  - The move list shows the glyphs when there is no engine verdict for the move.
  - Export writes `$n`, including the engine's verdicts (`$6`, `$2`, `$4`) when annotating; it used to append `?!` to the SAN.
- **Keyboard and screen readers (1.11):**
  - A move box under the board takes SAN, loose SAN (`nf3`, `Bf7` for `Bxf7+`, `0-0`) and coordinates (`e2e4`, `e7e8q`). Ambiguous or illegal input is explained, never guessed.
  - Every move is announced in a polite live region ("You played knight f3.", "Stockfish played e takes d5, check."), and so is navigation through the moves.
- **Tests (1.12):**
  - Rule edge cases: threefold with changed castling rights, the fifty-move boundary, insufficient material, en passant timing, castling through check, under-promotion.
  - Playwright: a full game from a position played by typed moves to checkmate, then saved and reviewed; the clock with a faked timer, ending in a loss on time; draw offers declined and accepted; opening and FEN starts; a NAG round trip.
- **Multi-threaded Stockfish (1.3):**
  - Every response now sends `Cross-Origin-Embedder-Policy: require-corp`, plus `Cross-Origin-Resource-Policy: same-origin` for our own files. Together with COOP, this makes the page cross-origin isolated.
  - When it is isolated, the analyst runs the lite multi-threaded build (`sf-mt.js`/`.wasm`, 1.7 MB) with up to 4 threads (cores − 1), and the engine status shows the thread count.
  - The opponent stays on one thread, so its strength matches the calibration.
  - Without isolation (e.g. an artifact host that drops COEP), or if the threaded build fails, the single-threaded build starts as before.
- **Analysis searches are capped at 5 s** (`go depth N movetime 5000`). A capped entry remembers the depth it was asked for (`capDepth`), so the position isn't searched again on every visit.
- **Calibration (1.4, partly):** `site/scripts/calibrate.mjs` plays a round robin between the weakened levels below 1320 and Stockfish's UCI_Elo 1320 anchor.
  - It runs the lite single-threaded engine in child processes and uses the page's own search settings (`opponentSearch`, `pickWeak`).
  - Openings and colours alternate, the random numbers are seeded, and games over 300 plies count as draws.
  - It fits ratings by maximum likelihood with the anchor fixed. Three runs of 360–420 games took 11–13 minutes each on 6 cores.

  | Setting | Run 1 (old table) | Run 3 (new table) |
  |---|---|---|
  | 600 | 469 | 557 |
  | 800 | 773 | 874 |
  | 1000 | 1298 | 977 |
  | 1100 | – | 1201 |
  | 1200 | 1536 | 1141 |
  | 1300 | 1655 | 1369 |

  The new table in `play.js` uses search depth 1 up to 1100 and depth 3 above, never 5. It was interpolated from runs 1 and 2.

### Deviations

- **1.4 stays open.** Below 1320 the levels are now aligned with Stockfish's UCI_Elo scale. That scale is calibrated against engine rating lists, not human ratings, and the 1320+ levels run at our short think times with the lite network. Tying the slider to human ratings needs results from real players, e.g. from the weakness tracking in 9.2.
- **1.8:** starting from a curriculum position moved to 6.8, because there is no curriculum yet. `newGame` already starts from any FEN or move list.
- **Draw offers only go one way:** Stockfish never offers a draw itself.
- **Timeout draws use a simplified rule:** a lone king, or a king and one minor piece against a lone king, can't mate. FIDE asks whether any legal sequence mates, which is rarely different in practice.
- **No `[%clk]` comments in the PGN**, only the `TimeControl` tag.

### Insights

- **Search depth dominates the weakened mode.** Depth 1 → 3 → 5 changed strength by hundreds of Elo, far more than the "keep the best move" chance. The old table's depth 5 from 1100 up made 1300 stronger than 1320. Calibrate whenever these knobs change: the script takes about 12 minutes.
- **The calibration's noise is about ±70 Elo per level** at 120 games. 1100 came out above 1200 in run 3, although 1200 searches at the same depth and keeps the best move more often. More games would narrow this; the ordering is right in expectation.
- **MultiPV can explode in won positions.** On a mate in one whose alternatives lose, MultiPV 3 at depth 16 took 8 s single-threaded and over 30 s with 4 threads; with MultiPV 1 it takes 0.3 s. The time cap bounds it. On normal positions, 4 threads reach depth 16 about 30–45% faster.
- **chess.js keeps castling rights without a rook** and then generates O-O-O in `4k3/8/8/8/8/8/8/4K2R w KQkq`. Every pasted FEN now goes through `fixCastling`.
- **chess.js parses NAGs but drops them**, so `pgn.js` re-reads the movetext. Its ply count is tested against chess.js's history so the two can't drift apart.

## 2026-10-20 — Foundation: tooling, CI, licence

TODO items: 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 0.10. Milestone 0 is complete.

### Implementation notes

- **Node:** `.nvmrc` pins Node 24, the current LTS; `engines` asks for `>=24`. CI reads `.nvmrc`.
- **Types (0.4):** JS with JSDoc, checked by `tsc --checkJs` (TypeScript 7) through `site/tsconfig.json` and `npm run typecheck`. It covers `src/*.js`, `server/` and `scripts/`, not tests. Non-strict for now. Seven findings were fixed with inline JSDoc types; all were inference gaps (destructured options with `= {}` defaults, a mixed-type rules table), not bugs.
- **Lint (0.5):** ESLint 10 with the recommended rules, in `site/eslint.config.mjs`. `eslint-plugin-html` lints the module script inside `index.html`, which holds most of the page's code. Four findings were fixed: two unused variables and a needless escape in `knowledge.js`, plus an intended control-character regex in `prompt.js`, now marked with a reasoned disable comment. `npm run check` runs lint and types, and so does `just check`.
- **Knowledge tests (0.7):** `tests/knowledge.test.mjs` printed results; `tests/unit/knowledge.test.mjs` now asserts them in 14 tests covering EPD and pawn signatures, material, opening families, features for the Najdorf, IQP, Carlsbad, Lucena and opposite-bishop positions, book retrieval (ranking, chapter pointers, the user's own books), motifs (mate, back-rank, Greek gift, fork, pin, sacrifice, quiet moves, bad input), similar positions (exact, then structure), and the engine maths. The tests pass the opening name directly, so they no longer need `dist/eco.json`. Unit tests: 72.
- **CI (0.8):** `.github/workflows/ci.yml` runs on every PR and on `main`, in three jobs:
  - lint, types, build, unit tests and `npm audit --audit-level=high`;
  - the Playwright tests in Playwright's Chromium, uploading traces on failure;
  - gitleaks over the full history.

  `codeql.yml` runs CodeQL (JavaScript and Actions, `security-extended`) on PRs, on `main` and weekly. Every action is pinned to a commit SHA, picked from releases at least two weeks old, and the workflow token is read-only.
- **PR template (0.9):** `.github/pull_request_template.md` asks for the TODO number and has three checklists: tests, TODO/DONE and dependency licences, and the security rules from AGENTS.md.
- **Licence (0.10):** `LICENSE` holds the GPL-3.0 text, and `package.json` says `GPL-3.0-or-later`. `THIRD_PARTY_NOTICES.md` lists the following, with chess.js's BSD notice in full:
  - what ships in `dist/`: Stockfish.js, chessground, the cburnett pieces, chess.js and the Lichess opening data;
  - what the page loads: Google Fonts;
  - what the server uses: the Anthropic and OpenAI SDKs.

  The build copies both into `dist/` (`LICENSE.txt` so it is served as text).
- **`.editorconfig`** matches the existing style: UTF-8, LF, 2 spaces, tabs in the ECO data.

### Deviations

- **No npm workspaces (0.3).** Splitting `site/` into `client`, `server` and `shared` would move every file and the build paths, for no gain yet: the server doesn't import `knowledge.js`, and when it needs to, a relative import works. One project keeps one lockfile and one install. Revisit when the server needs its own deployable package (TODO 12).
- **No Prettier (0.5).** The code is written densely on purpose: one-line guards and short bodies on one line. Prettier at 120 columns turned the 2,136 lines in `src/` into 5,142 and touched nearly every line. ESLint checks correctness; `.editorconfig` covers whitespace.
- **CodeQL is skipped while the repo is private.** Code scanning on private repos needs GitHub Advanced Security. The job has `if: !github.event.repository.private`, so it starts working once the repo is public. Secret scanning uses gitleaks instead of GitHub's own, for the same reason; gitleaks-action is free for personal accounts.
- **E2E in CI uses Playwright's Chromium**, set with `PW_CHANNEL=chromium`. Locally the tests still use the installed Chrome.

### Insights

- **Most of the code sits outside `tsc`'s reach.** The inline module script in `index.html` holds most of the logic and isn't type-checked, only linted. Moving logic out into `src/*.js` modules, as was done for `engine.js`, `store.js`, `prompt.js` and `style.js`, brings it under both checks and unit tests.
- **Before the CI secret scan, the history was checked for key-like strings** (`sk-ant-…`, `sk-…`, `*_API_KEY=<value>`) and `.env` was confirmed never committed. Nothing was found.
- **Pinning actions to SHAs** blocks a moved tag from changing CI, the usual supply-chain hole in GitHub Actions. Updates need a bump: Dependabot for actions comes with TODO 11.5.

## 2026-10-20 — Stockfish playing style

TODO items: 1.13 (added).

### Implementation notes

- The Game tab has a **Stockfish style** choice next to the existing Elo slider (600–2800): Solid, Balanced (default), Active, Aggressive, Reckless. Both are saved with the other settings.
- The style shows next to Stockfish's name ("≈1400 · aggressive"). It goes into the coach's context and into saved games, and survives a restore.
- `site/src/chess/style.js`:
  - `aggressionScore()` rates a move for the side playing it. Checks, captures, sacrifices, tactics (from `moveMotifs`), pieces heading for the enemy king and pawn storms score up; retreats score down.
  - `pickStyled()` chooses among Stockfish's candidate lines. Only moves within the style's window of the move Stockfish would play are allowed: Solid 0.2, Active 0.25, Aggressive 0.5, Reckless 1.2 pawns. The style's weight decides among them; Solid prefers the lowest score.
- With a style other than Balanced, the opponent search asks for 4 lines (MultiPV 4) instead of 1.
- Tests: 8 unit tests on a fixed Italian Game position, and 4 Playwright tests. The Playwright tests check that both settings persist, that the UCI commands sent to the worker ask for 4 lines only when a style is set, and that Stockfish replies below 1320 Elo.

### Deviations

- **Style isn't a Stockfish option.** Stockfish 19's UCI options were checked directly: Skill Level, UCI_LimitStrength and UCI_Elo (minimum 1320), with no Contempt or aggressiveness setting. So style is a choice among Stockfish's candidate moves, made after the strength limit.
- **Choice groups wrap on narrow screens.** `.choice` now wraps and draws dividers as 1 px gaps, so five buttons fit a phone. Desktop looks the same as before (`width: fit-content`).

### Insights

- **Strength first, then style.** The window is measured from the move Stockfish would play under its Elo limit, not from the best move. So a style changes how Stockfish plays, not how strong it is, and a forced mate is never given up: a mate outranks any centipawn line by far more than any window.
- **Stockfish already searches several lines when strength-limited.** With `Skill Level` or `UCI_LimitStrength` on, it searches at least 4 lines internally to choose its weaker move. So the move it plays is normally among the reported lines, and asking for 4 costs little extra.
- **The aggression score is a heuristic, not tuned on real games.** It works on the test positions, and Reckless does choose sacrifices. Whether players feel the difference is worth checking during the Elo calibration (TODO 1.4).

## 2026-10-20 — Fixes from the code review: bugs and security

TODO items: 0.6, 8.7, 11.3.1 done; 1.12, 2.1, 10.5 partly.

### Implementation notes

The 2026-10-20 review of `site/src` found 25 issues. Each fixed bug now has a Playwright regression test that fails on the pre-fix page; this was checked by running the tests against a build of the last commit (`E2E_DIST`).

**Bugs fixed:**
- **Review crashed when the game changed mid-run.** It snapshots the position FENs, stops with a message when the game changes, and resets its UI in `finally`. It never classifies or saves the wrong game.
- **A failed or crashed engine froze the game.** The Engine moved to `src/chess/engine.js`. A failed start or crash rejects every waiting job, and later jobs fail at once. The engine reply, hint, analysis and coach all recover, and the status shows the failure.
- **Full browser storage still said "Saved".** `src/platform/store.js` reports failure; library writes are undone and reported.
- **The engine could play for the user.** This happened after a quick take-back, and a stale reply could also clear a newer reply's `thinking` flag. Replies now check the turn and carry a token.
- **The coach could use a game the user had left.** It checks the game generation and FEN after its analysis; the prompt is built inside `try`. It also has its own analysis tag, so moving around the board doesn't cancel it.
- **The hint could draw on the wrong position.** It now checks the position before drawing, and has its own analysis tag.
- **Restoring a game could lose it or stall it.** A failed PGN restore now says so and starts a new game; the Elo is restored, and if Stockfish was to move, it moves.
- **Saves during library loading could wipe the local library.** Library writes now wait for loading to finish.
- **Silent failures:** a failed opening-table load, losing the cloud library, and failed reference saves or deletes are now reported.
- **Smaller fixes:**
  - Restored mate scores come back as mates instead of +20.
  - A draw (0) was treated as "not over".
  - Move labels for games that start from a FEN with Black to move were wrong.
  - Named constants for the opening and book ply limits.

**Security fixes:**
- **Prompt injection (LLM01).** PGN headers and comments, and the player's own references, go into prompts only through `quote()` (`src/coach/prompt.js`). It produces one line in «guillemets», with control characters and inner guillemets removed and the length capped. The coach's rules say quoted text is data.
- **Static server hardening.**
  - A hash-based Content Security Policy for HTML: inline scripts by hash only, no plugins, no framing, `base-uri 'none'`, and `connect-src 'self'`.
  - `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy` and `Permissions-Policy` on every response.
  - Dot-paths such as `/.env` are never served.
  - Header logic lives in `server/static.mjs`, with tests.

**Performance and accessibility:**
- PGN import saves in one write and re-indexes once; the position cache is keyed by game and pruned.
- The Reading and Library panes render only while visible.
- Tabs follow the ARIA tabs pattern (`tabpanel`, `aria-controls`, arrow keys, Home and End). Focus stays in the move list across re-renders. The chat is marked busy while streaming, so screen readers announce the answer once.

**Tests:**
- 50 `node:test` unit tests. New ones cover the engine queue with a fake worker, storage, prompt quoting and security headers.
- 12 Playwright tests in the installed Chrome, replacing `tests/e2e.py`. Every one also fails on uncaught errors and CSP violations.

### Deviations

- **Not fixed:**
  - Keyboard move entry (TODO 1.11).
  - PGN comments are still keyed by position, so repeated positions share one comment.
  - `renderAll` still recomputes more than it needs to (only the hidden panes are skipped).
  - Most of the inline script is still one module; only the engine, storage and prompt helpers moved out.
- **`RULES` stays a user turn,** so the page keeps working with the artifact's `sample()`, which has no system role. The quoting carries the protection.
- **COEP is not sent,** because it would need CORP headers on every resource; it's only needed for multi-threaded Stockfish (TODO 1.3).

### Insights

- **chessground ignores untrusted (synthetic) mouse events** unless `trustAllEvents` is set. UI races are better reproduced with Playwright's fake clock (`page.clock`): it froze the 60 ms before the engine's reply, so the take-back race failed reliably on the old code.
- **The mock provider made the prompt-injection test cheap:** the test intercepts the request to `/api/ai/sample` and checks exactly what the model would receive.
- **A file-writing tool turned the escapes ` `/` ` into the literal characters.** Inside a regex literal those are line terminators, which broke parsing. Keep such escapes ASCII and check with `node --check`.

## 2026-10-20 — One app folder: `site/`

TODO items: 0.2 (decided: merge), 0.11.

### Implementation notes

- `claude/` became `site/` (git rename, history kept), and `server/` and `scripts/serve.mjs` moved into it. One `site/package.json` now holds the chess libraries and the AI SDKs. `npm test` runs the gateway tests and the knowledge check; `npm run serve` uses the Node server with the gateway instead of Python.
- `site/src/index.html` got the gateway client from `codex/index.html` (`localSample()`, the coach-off notice, two error messages). The built `site/dist/_test.html` matches the old `codex/index.html` except for the host's base `<style>` and the `just serve` wording.
- The justfile is down to `serve`, `test`, `e2e`, `build`, `build-eco` and `clean`, with `KIBITZ_PORT`/`KIBITZ_HOST`. `.env` stays at the repo root; the server finds it with `--env`.
- `.gitignore` uses `**/tests/out/`, so e2e screenshots under `site/` are ignored.
- `codex/README.md` (notes from the ChatGPT chat) moved to `docs/codex-notes.md`.

### Deviations

- **No `client`/`server`/`shared` workspaces (TODO 0.3).** One npm project is enough while the client has no build beyond copying files. 0.3 stays open for when that changes.
- **The old `codex/` copy and the root `package.json` are left on disk** for the user to delete. The tool's permission rules blocked the deletion, and `site/` replaces both.

### Insights

- `codex/` never held a separate implementation. Apart from the gateway client added on 2026-10-20, it was `claude/`'s build output, byte for byte. Committing build output as a "variant" made one codebase look like two; a real comparison would need both agents to work from the same task description.
- `codex/index.html` had been saved from the artifact host, so it carried the host's base CSS. The page's own CSS already covers what matters locally (`[hidden]`, `box-sizing`), so the build doesn't need it.

## 2026-10-20 — AI gateway, wired into `codex/`

TODO items: 2.3, 2.4, 2.5, 2.6, 2.8, 2.12, 2.13 done; 2.1, 2.9, 2.11 partly.

### Implementation notes

- `server/ai.mjs`: settings from env, one adapter per provider, request validation, error mapping and a rate limiter. Claude goes through `@anthropic-ai/sdk`; OpenAI, Mistral and Ollama share one adapter on the `openai` SDK, since all three serve the chat-completions protocol. `AI_PROVIDER=mock` streams canned replies for offline work.
- `server/api.mjs`: `GET /api/ai/status` and `POST /api/ai/sample`, which streams NDJSON lines (`{"text"}`, then `{"done","truncated"}` or `{"error"}`). Mounted by `scripts/serve.mjs --api`, which loads `.env` at startup; `just codex` uses it.
- `codex/index.html`: outside an artifact, `use('sample')` now returns a function with the same signature as the artifact's `sample()` that calls the gateway, so the coach chat, review summary and study plan work unchanged. When the gateway reports the provider unavailable, the coach notice gives the reason (e.g. which key is missing).
- Defaults are the small models: `claude-haiku-5-5`, `gpt-6-luna`, `mistral-small-latest`, with `ANTHROPIC_EFFORT=medium`. Larger Claude models also get the server-side refusal fallback; Haiku has none.
- Tests: 31 `node:test` cases in `server/` (fake SDK clients, no network). Also checked in headless Chrome over CDP: a question typed into the coach gets a streamed reply with `mock`, Opus 5.5 and Haiku 5.5. The coach-off notice shows the reason.

### Deviations

- **NDJSON over `fetch` instead of SSE (2.8).** `EventSource` can't POST a body, and a JSON-lines stream over `fetch` gives cancellation through `AbortController` for free.
- **Only `codex/` uses the gateway.** `claude/` is unchanged, and its `just claude` server doesn't load the keys.
- **Not done yet:** CSP/COOP/COEP headers (2.1), per-user key store (2.9), token budgets and cost display (2.11), structured output for board annotations (2.7).

### Insights

- **The gateway is a spending proxy, so it needs browser-side guards even on localhost.**
  - Any website can POST to `127.0.0.1`, which is why the gateway requires JSON and checks `Origin`.
  - DNS rebinding can make a page from another site look local. Requiring `Host` to be `localhost` or an IP literal blocks that, because rebinding only works under a host name.
  - Both are covered by tests (OWASP A01, LLM10).
- **Live checks found account problems, not code problems.** The OpenAI key was rejected (401). The Mistral key was refused `mistral-large-latest` by subscription tier (403), then rate-limited (429). A 403 doesn't necessarily mean a bad key, so `auth_failed` now says "check the key and that your plan includes the model".
- **Haiku 5.5 gave coaching as good as Opus 5.5 on a simple question**, at a fraction of the cost. The engine supplies the hard part. This supports small models by default; worth confirming on harder positions with the tutor eval set (3.8).
- **Newer Node treats `node --test <dir>` arguments as file patterns,** so the test script needs a glob.

## 2026-10-20 — AI provider settings

TODO items: groundwork for 2.3–2.6, 2.11, 2.12 and 8.3.

### Implementation notes

- `.env.example` (committed) is the template; `.env` (git-ignored, mode 600) holds the real keys. Settings: `AI_PROVIDER`, plus a key, model and optional base URL for Anthropic, OpenAI, Mistral and Ollama; an Ollama host allowlist; an embeddings provider and model; output, timeout and rate limits.
- Nothing reads the file yet. The Node server should load it (e.g. `node --env-file=.env`). The `justfile` deliberately doesn't load it, so keys never reach the static dev servers.

### Deviations

- TODO 8.3 assumed embeddings come from the selected chat provider. Anthropic has no embeddings API, so embeddings now have their own provider setting.

### Insights

- Model IDs move fast. Between planning and this entry, OpenAI's docs moved the flagship from GPT-5.6 to `gpt-6-astra`, and Mistral's `-latest` aliases are repointed regularly. Keep model IDs in config, never in code, and have the connection test (TODO 2.14) report which model actually answered.

## 2026-10-20 — Local dev server and justfile

TODO items: none directly; dev tooling that later supports 1.3 and 2.1.

### Implementation notes

- `justfile` at the repo root: `just claude`, `just codex`, `just both`, plus `build`, `test`, `e2e <variant>` and `clean`.
- `scripts/serve.mjs`: a dependency-free Node static server used by the `just` recipes. It sends `charset=utf-8` on every text type, serves only files inside the chosen folder (symlinks included), answers only GET and HEAD, and binds to `127.0.0.1` by default. An `--index` option lets `/` on `claude/dist` serve `_test.html`.

### Deviations

- Local serving moved from `python3 -m http.server` to Node for the `just` recipes, in line with the Node stack. `npm run serve` in `claude/` still uses Python.

### Insights

- Python's `http.server` sends `text/html` without a charset. `claude/dist/index.html` is the bare artifact body with no `<meta charset>`, so Chrome decoded it as Windows-1252 and every `≈`, `…` and `·` came out garbled. `/_test.html` and `codex/` were fine because they declare their charset. Any server we ship should set the charset in the header and not rely on the markup.
- Having our own server makes it easy to add COOP/COEP later, which multi-threaded Stockfish needs (TODO 1.3).

## 2026-10-20 — Planning baseline

TODO items: 5.1 (already done); plan, AGENTS.md and CLAUDE.md created.

### Implementation notes

The starting point is a working prototype that runs as a Claude artifact. `claude/` holds its source (npm build into `dist/`); `codex/` is a flat, prebuilt copy. What the prototype already has, marked *(prototype)* in TODO.md:

- Play against Stockfish 19 (WASM, with blob-URL and asm.js fallbacks), with strength set by `UCI_Elo` and a weakened mode below 1320
- A separate full-strength analyst engine (MultiPV 3); engine jobs queued and cancelled by tag
- Lichess-style move classes based on win-% drop, an accuracy score, and an eval graph in the post-game review
- Pure chess knowledge in `knowledge.js`: position features, motif detection, a book catalog with theme retrieval, and similar-position search by EPD and pawn structure
- Coach chat, a review summary and a study plan, all through the Claude artifact runtime (`window.claude.use('sample')`)
- Games library (artifact `db`, falling back to `localStorage`), PGN import and export
- Opening names from the Lichess chess-openings dataset (CC0)
- Mobile layout and dark mode

### Deviations

- **The AI layer moves to a Node server.** The prototype calls Claude only, through the artifact runtime. Supporting several providers means API keys have to live on a server, so TODO milestone 2 adds a Node gateway. The artifact runtime becomes one optional deployment target rather than the base.
- **The scope goes beyond the brief.** Milestones 9 to 12 and the items tagged *(added)* were proposed during planning. Typical examples: output validation, eval sets, the SSRF guard, spaced repetition and accessibility.

### Insights

- `codex/` started as a byte-identical copy of the `claude/` build output: same app code and `knowledge.js`, with chessground CSS inlined. Any difference between the two from here on is new work.
- Multi-threaded Stockfish needs `SharedArrayBuffer`, which needs cross-origin isolation (COOP/COEP headers). That constrains server headers and any third-party embeds, so it should be settled early (TODO 1.3, 2.1).
- Imported PGN comments already flow into the coach prompt. That is an indirect prompt-injection path (TODO 8.7, 11.3.1).
- A user-configurable Ollama base URL lets the server be pointed at internal addresses (SSRF), so it needs an allowlist (TODO 2.12).
- `knowledge.test.mjs` prints results but asserts nothing, so it can't catch regressions (TODO 0.7).
- `.gitignore` patterns containing a slash are anchored to the repo root: `tests/out/` stopped matching after the move to `claude/` (TODO 0.11).
