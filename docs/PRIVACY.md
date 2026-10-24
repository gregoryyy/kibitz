# Provider privacy and opt-in

The selected deployment is a [local single-user app](DEPLOYMENT.md). **Settings → Coach → Provider permissions** explains sharing and provides separate, initially off permissions for coach requests and passage/query embeddings for Claude/Anthropic, OpenAI, Mistral and Ollama. The operator configures keys, models and supported endpoints; entering a key does not grant browser permission to send data.

## What goes where

| Activity | Possible content | Destination and explicit action |
| --- | --- | --- |
| Coach chat, tutor, game summary or study plan | Question/conversation; permitted game, FEN and move history; engine scores/lines and tool results; selected retrieved comments/references; profile level, reported rating and goals | The selected configured provider through the local gateway, after its coach permission. Tool follow-up turns use the same permission. |
| Connection test | Fixed “OK” request, model/API metadata and usage | The selected provider, after its coach/test permission. |
| Semantic index build | Only the source/language-filtered passages selected for that index | The separately configured embedding provider, after its embedding permission and a Build click. |
| Semantic query | The written query | The same embedding provider, after permission and an explicit search. |
| Rules, Stockfish, lessons, keyword search and ordinary library browsing | No model request | Browser/local assets; no model-provider permission required. |
| In-browser model | Coach context processed on this device | Existing explicit model-load consent applies. Weights come from the local server and may be cached on the device. |
| Mock provider | Test/development requests | The local deterministic mock; no external model service. |

Coach data follows live-help policy. Imported/user text still enters prompts through `quote()` and validated context; consent does not weaken move/source/tool checks. Lesson reflection drafts are not automatically sent to a model. Vectors stay in browser memory and clear on source/account/policy changes.

OpenAI/Mistral-compatible endpoints and the allowlisted Ollama endpoint can be operator-configured. The provider name alone does not identify every possible host. Ask the operator about the actual destination, account and retention settings before granting permission. The page exposes no keys/private endpoint URLs. This notice describes application transfers, without provider-retention or regulatory-compliance guarantees.

The normal page can load Google Fonts. Font requests carry ordinary connection metadata, without coach prompts. `--offline` removes remote fonts and external-host CSP allowances. The local-model selector restricts model-provider routing; it does not change a configured Ollama endpoint or itself enable offline server mode.

## Choices and revocation

`kibitz.providerConsent` is a bounded v1 browser record of exact provider/purpose pairs and a revision, without prompts, keys or answers. Grants require a successful save. Future/corrupt formats remain intact/read-only and closed to network-provider sharing. Browser erasure clears these choices.

A failed revocation immediately denies that provider/purpose in this tab, with a distinct retry control. The page warns that other tabs/reloads may retain the old grant until revocation saves. Sequential stale-tab edits cannot silently restore another tab's choices; simultaneous localStorage writers still lack a transaction.

Before a network call, the transport rereads permission. Changes abort this tab's pending coach/embedding transports, clear reusable conversation/semantic state and fence late results. Other tabs reload through storage events and reread before new work. Already accepted calls may still finish at the provider. Revocation cannot recall transmitted data or erase provider copies. [Data controls](DATA.md) handle local saved data; external retention/deletion belongs to that service/operator.

The in-browser model and mock work without a network-provider grant. Quick requests can use the separately consented browser model while a network coach is blocked.

## Gateway and direct clients

The gateway requires exact `X-Kibitz-Consent: v1:<provider>:<purpose>` before sample, structured, connection-test or embedding work. Purposes are `coach` and `embeddings`. It checks actual routing: another provider's header or coach permission cannot authorize embeddings. Denials precede SDK calls and spending/rate-budget admission.

The browser adds the header only for an acknowledged grant. Direct API operators must deliberately include it to opt in. This is a local-client attestation, **not authentication, a signed consent receipt or a tenant boundary**. Origin/host/JSON checks, key ownership, budgets and validation remain separate. Hosted accounts/artifact runtimes need their own contract; these standalone controls do not impersonate the host.
