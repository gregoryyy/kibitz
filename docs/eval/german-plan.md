# German tutor benchmark — prepared live-run plan

Plan checked locally on 2026-10-24. No live coach or judge request has been sent for this German matrix.

The runner uses the same ten reference positions and concept counts as the English set, with German questions/key points, the app's normal engine context and a club-level profile. Its headless browser starts with no personal library/profile. The optional model judge is disabled.

| Selected provider | Configured model | Planned positions | Result |
|---|---|---:|---|
| Anthropic | `claude-haiku-5-5` | up to 10 | Not run |
| OpenAI | `gpt-6-luna` | up to 10 | Not run |
| Mistral | `mistral-small-latest` | up to 10 | Not run |
| Ollama | `deepseek-R1:latest` | up to 10 | Not run |

All four configurations report available locally. This checks configuration/key presence, not successful authentication, service reachability or model availability. Mistral's first local gateway startup timed out under test load; its separate retry produced the plan successfully. Provider endpoints remain the operator-configured destinations.

The existing [paid-run guard](../../site/scripts/paid.mjs) and [runner instructions](../../site/eval/README.md) require approval before adding `--yes` for paid runs. The numbers above are position/answer counts, not a hard request/cost cap: tool follow-ups, output-format fallback and up to three rate-limit retries can add requests. Each provider run stops at its first unrecovered error. No price estimate or successful live result is inferred from configuration.

Prepared validation uses mocks: the full English/German browser benchmark paths, source/score/report unit tests and a one-position German CLI report in a temporary directory. Mock cue scores verify plumbing only and are not coaching-quality evidence. Live reports or explicit per-provider errors must replace the planned status before TODO 10.8.4 is complete. Each new JSON report captures its language, reference positions/cues and actual answer context; regex cue coverage is not semantic verification or a calibrated comparison between languages.
