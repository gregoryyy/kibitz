# TLS transport inventory (experimental)

This is the first evidence-collection step for **TODO 11.4.2.6 / ASVS
12.1.1**. The parent stays open. It is a transport inventory, with partial live
observations, rather than a release approval or a public-trust assessment.
The initial review remains due **2026-11-01** and all final-release remediation
requirements retain their deadlines.

The reviewed protocol policy is **TLS 1.2–1.3, preferring 1.3**. This follows
[ASVS 5.0.0 V12.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x21-V12-Secure-Communication.md)
and [IETF BCP 195 / RFC 9325 §3.1](https://www.rfc-editor.org/rfc/rfc9325.html#section-3.1).
A configured minimum, a successful TLS 1.3 connection and refusal of older
versions establish different facts. Record all three, with their actual scope.

## Current application paths

The original endpoint observations use source inherited from
`96a49b8320551b466bb32762a6dee25fac44cb68`. The current source now implements
[encrypted transport enforcement](TLS-POLICY.md) under TODO 11.4.2.7.
These entries distinguish that configuration policy from actual deployment evidence.
They do not promote current RC allowances into final-release exceptions.

| Path | Current implementation/settings | Evidence and remaining work |
| --- | --- | --- |
| Browser → native gateway, static assets, private library, local WASM/model files | [Native TLS loader](../site/server/tls.mjs) explicitly sets minimum 1.2 and maximum 1.3. [Host/HSTS policy](TLS.md) requires a dedicated `.test` name. | Native/browser/container synthetic tests exist. Actual operator certificate/CA and a running final endpoint were unavailable at standard paths on 2026-10-25; browser and packaged negotiated evidence still required. A private fixture is not that evidence. |
| Container health → native listener | [Health probe](../site/scripts/healthcheck.mjs) uses HTTPS, normal certificate/hostname validation and an explicit public CA file when selected. | Actual image tests cover a synthetic CA/identity. Record the deployed image/runtime, health-client defaults and actual negotiated version too. |
| Gateway → Anthropic | [Adapter](../site/server/ai.mjs) uses the pinned Anthropic SDK, HTTPS default `api.anthropic.com`; base URL can be overridden. | Public default-host direct handshakes recorded below. SDK fetch checks the reviewed runtime defaults, refuses plaintext overrides and refuses all provider redirects. Synthetic real-SDK TLS evidence exists; actual provider API/deployment negotiation remains unverified. No inference was run. |
| Gateway → OpenAI / Mistral | [Coaching and embedding adapters](../site/server/ai.mjs) use the pinned OpenAI SDK with HTTPS defaults `api.openai.com` / `api.mistral.ai`. | Public default-host direct handshakes recorded. Coaching, embeddings and connection tests share transports, but these probes do not execute SDK requests. Base-URL/runtime enforcement is implemented; actual installation/SDK endpoint evidence remains required. |
| Gateway → Ollama (coaching, model inspection, embeddings) | Default `http://127.0.0.1:11434`; an allowlisted host can be overridden. | The inspected operator configuration selects HTTP, which is now unavailable in final mode. The probe deliberately sends no plaintext traffic. A configured final TLS endpoint and actual negotiation remain missing; loopback is not counted as encrypted connectivity. |
| Browser → wllama weights/runtime | Built runtime and catalogue model are served from the app origin; [adapter](../site/src/coach/browser-llm.js). | Covered by the application TLS path only when actually same-origin. Configuration now restricts `BROWSER_MODEL_URL` to an app-relative GGUF path under /models/; actual final-origin browser negotiation still needs evidence. |
| Explicit model download → upstream and redirects | [Catalogue](../site/server/models.mjs) pins HTTPS `huggingface.co` URLs. [Downloader](../site/scripts/download-model.mjs) validates runtime defaults, requires HTTPS at every hop and follows at most five manually checked HTTPS redirects. | Only the initial public host handshake was probed. No model was downloaded; signed CDN URLs/redirect origins and TLS policies remain unverified. Do not publish signed URLs or download tokens. |
| Browser-managed Chrome model | Chrome provisions/updates weights outside the app's network and hash controls; [scope](OFFLINE.md#optional-chrome-built-in-coach). | No gateway inference transport, but provisioning is an explicitly unverified browser-managed service boundary. Record browser/version and available transport evidence or resolve final support scope before closing the parent. |
| Fonts and shipped chess/opening/library data | Bundled by [build](../site/scripts/build.mjs), including [checked local fonts](../site/scripts/build-fonts.mjs), then served from the app origin. | Current build has no automatic remote-font connection. Older historical threat-model references to Google Fonts describe the RC baseline. Build/provenance evidence is separate from live TLS evidence. |
| Explicit external links and maintainer utilities | Lichess analysis links navigate outside the app; reference links may open external publications. Optional tablebase-verification scripts contact `tablebase.lichess.ovh`; imports consume separately acquired files. | User navigation and maintainer verification are outside the running gateway's service contract. They are not certified here. The FEN-bearing analysis URL remains TODO 11.4.2.10; model provisioning above remains in this inventory despite being an operator command. |
| HTTP development / legacy recovery | Explicit `--http-dev` uses isolated test/dev identities; `--legacy-origin` requires TLS but lacks final hostname policy. | Neither is a supported final deployment. Plain static HTTP serving must not be used as evidence for an authenticated final app. |

## Dated public endpoint observations

[Raw report](security/2026-10-25-tls-default-endpoints.json), collected on
2026-10-25 using Node 24.22.1 / OpenSSL 3.5.9. It retains client defaults, a hash
of the default CA set, negotiation/cipher, leaf fingerprint and validity dates.
It contains no key, cookie, prompt, API request, response body or model download.
The three cloud origins match the configured defaults; no custom cloud base URL
was set in the inspected local configuration. No configuration contents or keys
were retained. The operator subsequently asked about self-signing; the
[TLS guide](TLS.md#optional-local-development-certificate) documents a
locally trusted development setup without generating keys or modifying trust.
Actual installation evidence and final public-trust disposition remain pending.

| Public origin | Default / reviewed-policy negotiation | Forced 1.2 / 1.3 | Legacy attempts |
| --- | --- | --- | --- |
| `https://api.anthropic.com` | 1.3 / 1.3 | Both succeeded | Client policy refused |
| `https://api.openai.com` | 1.3 / 1.3 | Both succeeded | Client policy refused |
| `https://api.mistral.ai` | 1.3 / 1.3 | Both succeeded | Client policy refused |
| `https://huggingface.co` | 1.3 / 1.3 | Both succeeded | Client policy refused |

`local_policy_refused` for TLS 1.0/1.1 **does not prove peer downgrade refusal**.
A timeout, trust failure or generic handshake error also proves no such thing.
The probe reports a protocol-version alert separately when received. Default
Node trust acceptance is evidence for this client/trust set at this time, not
proof of public trust for every installation, browser, redirect or operator CA.
These are direct TCP/TLS handshakes, not production SDK/fetch/browser requests;
they do not observe HTTP proxies or redirects. Certificate expiry dates in the
report are observations, not a renewal/expiry-monitoring service.

## Reproduce without inference

Run from the repository root, selecting only credential-free **origins**:

```sh
node site/scripts/tls-inventory.mjs \
  --endpoint anthropic-default=https://api.anthropic.com \
  --endpoint openai-default=https://api.openai.com \
  --endpoint mistral-default=https://api.mistral.ai \
  --endpoint model-source=https://huggingface.co > tls-observations.json
```

For an existing local deployment, select its actual origin and optionally its
**public CA certificate**, never its private key:

```sh
node site/scripts/tls-inventory.mjs \
  --endpoint local-app=https://kibitz.test:8765 \
  --ca /operator/public-ca.pem > local-tls-observations.json
```

The name must be a unique lowercase identifier. Credentials, paths beyond `/`,
queries, fragments, unsupported schemes and ambiguous URL syntax are rejected
before any endpoint is contacted. HTTP origins are recorded as
`plaintext_not_contacted`; they are never requested. At most 32 origins and six
parallel handshake sockets are allowed, with a five-second **total** deadline
per attempt (including DNS), configurable up to 30 seconds. The CLI reads only
an explicitly named bounded public trust bundle, never discovers `.env`, keys,
operator/session files or browsers, and uses certificate validation even if the
ambient TLS-disable environment variable is set. Errors use fixed categories
without raw input, filenames, certificates or OpenSSL messages.

Exit zero means a report was produced, **not that endpoints passed**. Inspect
all outcomes. The runtime-default probe records actual Node min/max settings;
the separate recommended probe explicitly uses 1.2–1.3. Forced versions are
separate diagnostic sockets, with no retry fallback carrying application data.
A custom CA is labeled `explicit-ca`, with its hash; it cannot establish public
trust. Origins and certificate fingerprints may reveal private infrastructure;
review local reports before publishing them. Rerun on endpoint, certificate,
runtime, image, CA/trust, proxy, provider or protocol-policy changes.

## Remaining final-release evidence

TODO 11.4.2.6 stays open until the actual browser/native/image/health/provider/
service matrix is verified and enforced, including latest-version preference
and credible downgrade refusal. TODO 11.4.2.7 implements encrypted application/service paths with native and
packaged regression coverage; its PR records source-specific verification. TODO 11.4.2.8 must resolve public trust and
certificate lifecycle for the selected deployment, including the `.test` private
identity boundary. Historical RC dispositions and remaining deadlines are unchanged; the current
[assessment](ASVS.md) separately records technically verified remediation.
