# Coach providers and local Ollama

This guide configures the standalone [local single-user app](DEPLOYMENT.md). Start with the [user guide](GUIDE.md); [`.env.example`](../.env.example) is the complete configuration reference. The instructions below are setup steps, not evidence that an account/model has been tested live. External console instructions were checked against the linked primary documentation on 2026-10-25.

## Configure a provider

If the root `.env` does not already exist, copy `.env.example` to `.env`. Edit the file locally, selecting one `AI_PROVIDER` and filling only the credentials/model settings you intend to use. Keep it private and outside Git; never paste keys into coach chat, browser settings, screenshots or issue reports. Existing shell environment values take precedence over values loaded from the file.

| Provider | Root `.env` settings | Obtain access |
| --- | --- | --- |
| Claude | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-5-5`, `ANTHROPIC_EFFORT=medium` | Create a personal API key for local development in the [Claude Console](https://platform.claude.com/docs/en/get-api-key), selecting a workspace-scoped key. |
| OpenAI | `AI_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna` | Create an API project key through the [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart). Check that this API project has access to the selected model. |
| Mistral | `AI_PROVIDER=mistral`, `MISTRAL_API_KEY`, `MISTRAL_MODEL=mistral-small-latest` | Activate Studio and create a key using [Mistral's setup instructions](https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key). Check your account's quota, plan and rate limits. |
| Ollama | `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://127.0.0.1:11434`, `OLLAMA_MODEL` | Use an installed local model as described below; no cloud API key is needed for this path. |
| In browser | Use `just offline` or `just offline-chrome` | Explicit model loading/download is separate; see [offline choices](OFFLINE.md). |
| Mock | `AI_PROVIDER=mock` | Deterministic development replies, with no model service. |

The gateway's default endpoints are the official Claude, OpenAI and Mistral APIs. Optional `<PROVIDER>_BASE_URL` overrides change the actual destination; do not use an untrusted proxy with a provider key. Ollama additionally requires its hostname in `OLLAMA_ALLOWED_HOSTS`. Provider labels alone do not prove where data goes.

Run `just serve`, or `npm --prefix site run serve`, from the repository root. Stop/restart after configuration edits; the server loads the root `.env` once. In **Settings → Coach**, select the configured provider, grant its **coach** permission through **Provider permissions**, then deliberately choose **Test connection**. This sends a small real request and can incur API charges. A successful test checks that reply, not explanation quality, every task or all tool/structured-output features.

## Task models, sharing and spending

`<PROVIDER>_MODEL` controls chat. `_MODEL_QUICK` controls quick chips/automatic comments and `_MODEL_REVIEW` controls review summaries/study plans; missing overrides fall back to the chat model. Settings displays the chosen task models. Provider/local-only changes there last until server restart. The optional quick-in-browser route needs its own explicit Load.

Kibitz uses OpenAI Chat Completions. For the exact selected `gpt-6-luna` model it sends `reasoning_effort: none`, as required for its [documented function-calling protocol](https://developers.openai.com/api/docs/models/gpt-6-luna). Other model IDs and compatible providers receive no added reasoning field. A mutable model alias can change behind an unchanged name; configuring a revision label does not verify weights or quality.

Coach and embedding permissions are separate, initially off choices. Summaries, automatic comments, connection tests and tool follow-ups can all make provider requests. Keep **How the coach works → Only when asked** for manual use. Embeddings stay optional: leave `EMBEDDING_MODEL` empty to retain local keyword/board search, or configure a suitable embedding model and deliberately build/search after granting that provider's embedding permission. The chat model is not automatically an embedding model. See [embedding configuration and revision limits](TEXT-SEARCH.md#gateway-and-configuration).

Use `AI_RATE_LIMIT_PER_MINUTE` and the per-user setting for request admission, plus token/cost thresholds if desired. Dollar estimates require operator-supplied `AI_PRICES`; unknown prices remain unknown. Completed-usage thresholds can overshoot and are **not hard billing caps**. Tool rounds and format/server-side fallbacks can add calls even though automatic SDK retries are disabled. Configure financial controls in the provider account as appropriate. [Usage accounting](USAGE.md) describes exact scopes, deadlines, resets and cancellation limits.

## Self-host with native Ollama

Keep Kibitz and Ollama on the same machine for the straightforward loopback setup. Install Ollama from its [official quickstart](https://docs.ollama.com/quickstart). Run its application/service; if you manage it in a terminal and no instance is already running, use:

```sh
OLLAMA_NO_CLOUD=1 ollama serve
```

Ollama normally listens on `127.0.0.1:11434`. Its [FAQ](https://docs.ollama.com/faq) describes cloud disabling and service-specific environment configuration. Set `OLLAMA_NO_CLOUD=1` on the **Ollama process**, restarting it if necessary; placing it only in Kibitz's `.env` does not reconfigure an already running service. Preserve loopback binding. Kibitz's `AI_LOCAL_ONLY=1` restricts provider routing, while Ollama itself controls whether a model is remote/cloud.

List installed models without generating a reply:

```sh
ollama ls
```

Choose the exact installed local model tag. If none fits your needs, choose and download a model separately using Ollama's [CLI reference](https://docs.ollama.com/cli), checking its licence, storage/RAM needs and tool support first. A pull transfers weights and can be large; this guide does not run or prescribe a download. Models without native tool support can still explain supplied engine context, but connection success does not establish tool capability or chess reliability.

Set the root `.env` values, replacing the placeholder with your installed tag:

```dotenv
AI_PROVIDER=ollama
AI_LOCAL_ONLY=1
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_ALLOWED_HOSTS=127.0.0.1,localhost
OLLAMA_MODEL=your-installed-model:tag
EMBEDDING_MODEL=
```

Build and run from the repository root:

```sh
npm --prefix site run build
node site/scripts/serve.mjs site/dist --api --tls-key .kibitz-data/tls/key.pem --tls-cert .kibitz-data/tls/cert.pem --env .env --usage .kibitz-data/usage.sqlite --offline --index _test.html
```

This explicit `--offline` invocation preserves the offline page path and removes legacy external font links if present. The current app already bundles its fonts and uses the same strict same-origin style/font policy in either mode. Coaching still needs the local Node gateway and Ollama process. The browser is served at `https://127.0.0.1:8765/`. Grant **Ollama → coach** permission, then press **Test connection** when ready to load/run the selected model. Local models still use memory and computation. No Ollama CORS wildcard is needed: the browser calls Kibitz's same-origin gateway, and Node contacts Ollama.

For an optional persistent server library, add `--library .kibitz-data/library.sqlite` to that server command, then explicitly select it in Library. Keep private databases outside `site/dist/` and any served model root. The usage and library databases are separate; cookie-based collections do not provide accounts or cross-device sync. Follow [data controls](DATA.md) and [backup guidance](CONTAINER.md) for the applicable deployment.

The supplied Docker package has its own loopback. Host `127.0.0.1:11434` is not the host's Ollama service from inside a bridge container. The [container guide](CONTAINER.md) documents explicit runtime configuration; use the native Node path above for same-machine Ollama without changing network exposure. A LAN/public bind is not a supported shared-user deployment.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Provider not offered | Correct `AI_PROVIDER`, required key/model and restart; inspect the fixed startup/status reason. An installed browser model requires its separate runtime setup. |
| Permission required | Grant the exact provider/purpose. Coach permission does not authorize embeddings, and a key alone grants neither. |
| API authentication/model rejection | Verify the private key, API project/workspace, quota and exact model ID in that provider's console. The app intentionally does not reflect raw provider error bodies. |
| Ollama unavailable/model missing | Check the local service and `ollama ls`, the configured tag/base URL and exact hostname allowlist. Do not widen its listener to fix a tag or stopped service. |
| Timeout | Allow model warm-up on your machine or choose a suitable installed model. `AI_TIMEOUT_MS` defaults to 60 seconds and caps at 15 minutes. A cancelled/timed-out paid request may already be billable. |
| Tool or structured reply unsupported | Check the selected task model's capabilities. The fallback may explain existing context; it does not make unavailable engine tool evidence exist. |
| Usage/cost seems absent | Confirm persistent usage storage, configured prices and provider-reported usage. Browser inference bypasses gateway counters; local/mock work is excluded from paid-user totals. |

Use [fixed-category logs and no-inference health checks](OPERATIONS.md) for local diagnostics. Do not share actual `.env` contents, browser cookies or prompt/response payloads with a bug report. Existing [recorded evaluations](eval/README.md) have provider-specific evidence limits and are not implied by this setup guide.
