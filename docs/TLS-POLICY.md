# Encrypted application and service connections (experimental)

TODO **11.4.2.7 / ASVS 12.2.1** requires encrypted final browser/gateway and
external HTTP-service connections without plaintext fallback. This change
implements that policy; verification and disposition are tracked in the PR and
[ASVS assessment](ASVS.md). Actual endpoint/protocol inventory (11.4.2.6) and
public trust/certificate lifecycle (11.4.2.8) remain separate gates.

## Application boundary

The final native/container command requires the [HTTPS identity](TLS.md),
[dedicated HSTS hostname](TLS.md#isolated-application-hsts), operator identity and
permission file. There is no HTTP redirect or fallback listener. Both the native
listener and fixed container health client explicitly select TLS **1.2–1.3**;
the health request explicitly requires certificate/hostname validation. API
constructors deny plaintext unless their caller deliberately selects the
isolated development mode. Public/LAN hosted operation remains unsupported.

Static app assets, bundled fonts/chess data and wllama runtime/weights are served
from the app origin. `BROWSER_MODEL_URL` accepts only a relative `/models/` GGUF
file path, rather than a remote or protocol-relative URL. The existing model
server separately restricts requests to catalogue files. Browser-managed Chrome
provisioning remains outside Kibitz's connection/certificate controls; this
policy does not certify its downloads, updates or weights.

## Providers and embeddings

Every cloud or Ollama endpoint must use HTTPS with certificate verification.
The same checks apply to connection tests, streaming/structured coaching,
embedding requests and Ollama's pre-upload model inspection. Base-URL paths are
allowed; URL credentials, queries, fragments, malformed URLs and unsupported
schemes disable that provider with a fixed reason that reveals no key or origin.
Configuring a forbidden inactive provider cannot make it available by switching
providers later. Explicit Anthropic defaults avoid an unreviewed ambient SDK
base-URL fallback.

[Shared fetch](../site/server/secure-fetch.mjs) checks the actual destination
again immediately before every network request. Provider redirects are refused,
including HTTPS-to-HTTPS redirects: keys, prompts and POST bodies are never
forwarded to another endpoint. Repair the configured endpoint instead. Existing
operation deadlines, cancellation, raw/decoded byte bounds and disabled SDK
retries remain in effect. Transport-policy failure is a fixed provider error,
not a format fallback or a reason to retry over HTTP. Consent, authentication,
function grants, local-only routing and budgets remain independent checks.

Node's reviewed defaults must allow **TLS 1.2 or 1.3 as minimum and TLS 1.3 as
maximum**, with certificate verification enabled. These correspond to
[ASVS V12.1.1](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x21-V12-Secure-Communication.md)
and [RFC 9325](https://www.rfc-editor.org/rfc/rfc9325.html#section-3.1).
A weakened `--tls-min-v1.0`, capped `--tls-max-v1.2` or
`NODE_TLS_REJECT_UNAUTHORIZED=0` refuses HTTPS provider/download work before
fetching. The gate rereads runtime settings for each request. Node trust stores
and explicitly configured extra CAs still determine trust; their public-CA
eligibility is not established by this check. Trusted operator code and files
remain part of the process boundary. The implementation uses existing Node
fetch without adding a networking dependency.

## Ollama transition

Ollama's current default plain `http://127.0.0.1:11434` is unavailable in final
mode, even on loopback. Selecting a model or allowing its hostname does not
waive encryption. Configure an existing TLS endpoint for Ollama with a matching
trusted identity and put that hostname in `OLLAMA_ALLOWED_HOSTS`. This can be a
separately managed TLS front end for the Ollama service; the Kibitz application
itself continues using native Node HTTPS. Do not expose Ollama publicly or
silently reinterpret its HTTP port as HTTPS. A private local CA can enable
experimental local testing but does not close the public-trust release gate.
No service, certificate, trust-store entry or provider configuration is created
by this change. Browser inference and mock operation do not require Ollama.

For deliberately isolated development only, the CLI's **`--http-dev`** passes a
backend-only option permitting HTTP to exact loopback hosts `127.0.0.1`, `::1`
and `localhost`. It never permits a LAN/remote plaintext host or a provider
redirect, cannot combine with native TLS, and cannot be enabled by request
bodies or an environment flag. Direct module callers must opt in explicitly;
normal evaluators/recorders use the secure default. Unavailable providers are
refused before SDK construction, including with an injected client. The recorder
also checks its own actual destination and refuses unavailable/forged configs,
so a missing synthetic key cannot fall back to an ambient SDK credential. HTTPS endpoints in dev mode
still require the same reviewed TLS runtime and certificate checks. Synthetic
HTTP development is outside the supported final app. Keep its identities and
private databases separate as in the [migration guide](COOKIE-MIGRATION.md).

## Model provisioning

The model downloader validates its initial HTTPS URL **before creating a
destination directory**. It follows at most five HTTPS redirects, validates
each new destination before opening its socket and never follows HTTP or
credential-bearing URLs. Redirects use explicit manual handling and no inherited
headers, body or included credentials. Signed HTTPS CDN query parameters are
allowed for transfer but never included in policy errors. There is no HTTP
fallback. Existing total cancellation/deadline, pinned size/SHA-256 verification,
exclusive temporary files and verified publication remain required.

A permitted redirect does not prove that a new CDN/endpoint has been inventoried;
11.4.2.6 still needs actual redirect/SDK/browser/deployment evidence. No model
was downloaded for these tests. Operator imports, explicit external links and
maintainer-only provenance/tablebase tools retain the [inventory scope](TLS-INVENTORY.md).

## Verification scope

Local fixtures exercise real SDK coaching for all four adapters, real embedding
requests and Ollama inspection under verified TLS 1.3; provider redirects point
at a local plaintext leak trap which receives no request. Tests also cover
unsafe runtime flags, config/URL rejection, default Ollama refusal, independent
explicit loopback development, download downgrade/loop/credential refusal,
pre-filesystem rejection and unchanged byte/hash publication boundaries.

The actual native CLI/browser regression signs in over the final HTTPS hostname,
checks forbidden cloud/embedding configuration, attempts a protected connection
test and confirms no synthetic key/context reaches the plaintext trap. The
pre-enforcement CLI reports the same endpoint available and fails this test.
The packaged image case independently checks that a configured plaintext cloud
choice cannot be selected and its embeddings are unavailable. Synthetic browser
trust exceptions apply only to generated fixture identities; real SDK clients
require their explicitly supplied fixture CA. Actual operator/public service
trust and deployment verification are not supplied by those fixtures.
