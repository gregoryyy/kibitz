# German tutor benchmark — approved live trials

The operator approved this four-provider matrix on 2026-10-24, including paid cloud calls, tool follow-ups and retries, with no judge. Trials ran sequentially on the same day. The initial Claude gateway startup timed out before a provider request; its retry started successfully.

The runner uses the same ten reference positions and concept counts as the English set, with German questions/key points, the app's normal engine context and a club-level profile. Its headless browser starts with no personal library/profile. The optional model judge is disabled.

| Selected provider | Configured model | Planned positions | Result |
|---|---|---:|---|
| Anthropic | `claude-haiku-5-5` | up to 10 | **10/10 answered**; [recorded report](anthropic-claude-haiku-5-5-de.md), [JSON with actual contexts/cues](anthropic-claude-haiku-5-5-de.json). Legacy capture caveat below. |
| OpenAI | `gpt-6-luna` | up to 10 | **0 answered**; first position failed with HTTP 401 / `auth_failed` (incorrect API key). No scored report. |
| Mistral | `mistral-small-latest` | up to 10 | **0 answered**; first position and all three runner retries returned HTTP 429 / `rate_limited`. No scored report. |
| Ollama | `deepseek-R1:latest` | up to 10 | **0 answered**; first position failed with HTTP 404 / `model_not_found`. No model downloaded/substituted and no scored report. |

All four configurations reported available in the preflight plans. This checked configuration/key presence, not successful authentication, service reachability or model availability. Provider endpoints remained the operator-configured destinations. Models were not substituted or downloaded to work around failures. Gateway errors are recorded separately from answers, without credentials, raw provider responses or a guessed quality score.

The existing [paid-run guard](../../site/scripts/paid.mjs) and [runner instructions](../../site/eval/README.md) require approval before adding `--yes` for paid runs; that approval was received. The numbers above are position/answer counts, not a hard request/cost cap: tool follow-ups, output-format fallback, SDK retries and up to three runner rate-limit retries can add requests. Each provider run stops at its first unrecovered error. No invoice total or exact provider-request count is inferred from the number of answers.

## What the completed Claude trial establishes

The report retains the original ten answers, captured engine context, German cues and automatic checks from source commit `21af92f`. It ran without a judge. The app flagged two move-like tokens (`Kxf7` in an explanation of why the capture fails, and `Ne5` used as a piece reference). These are checker observations, not independently established recommendations to play illegal moves.

The trial exposed a capture bug: the old extractor included the message's supplied source passages, tool cards and interface controls in the scored text. For example, Lucena's bridge cue appeared in a supplied source rather than the model's own explanation. The retained `rendered-message-v1` cue/overall scores therefore **are not model-only quality scores**. They must not be used to select a provider or claim improved German coaching. Regex cues also match negations and irrelevant mentions; no semantic or cross-language calibration is claimed.

Future captures use `coach-prose-v2`, excluding those cards/controls and counting moves only in the remaining prose. A synthetic browser regression fails on the old extractor and passes on the fix; both complete English/German mock paths exercise the new capture. The original live text/scores were preserved, rather than retrospectively rewriting them or sending additional paid questions. A useful provider comparison still needs successful missing-provider runs and fresh comparable prose-only captures under a new approved run plan; TODO 10.8.4 remains open.
