# Local server logs and monitoring

This guide covers TODO 12.3 for the [local single-user deployment](DEPLOYMENT.md).
The Node HTTP server emits one JSON line per completed or disconnected request.
Application events contain fixed categories, numbers and booleans:

| Event | Fields beyond the UTC `at` timestamp | Meaning |
| --- | --- | --- |
| `http` | `method`, `route`, `status`, `complete`, `ms` | Response status and elapsed milliseconds, capped at one day. A disconnect before completion has status `0` and `complete: false`. |
| `ai_error` | `action`, `provider`, `code`, `status` | Sample, structured, connection-test or embedding failure. Status is the exception's numeric HTTP status, or `0` if absent/invalid. Cancelled work emits no AI error. |
| `ai_config` | `provider`, `available`, `localOnly` | Initial gateway configuration or a successful settings change. Availability means configured, without testing connectivity. |
| `server_error` | `code`, `hint` | Startup/listener failure with an allowlisted system code and a fixed operator hint. |

Methods, providers, actions, routes and codes use closed vocabularies; unknown values
become `OTHER`/`other`. Routes distinguish known AI endpoints, `library`, `model`,
`api.other`, `static` and `invalid`. Personal library IDs and file/model names never
become categories. Recognized HTTP statuses are integers from 100 through 599.
See [field construction](../site/server/logging.mjs).

These events omit request URLs, paths, queries, IPs, cookies, request/response bodies,
prompts, answers, tokens identifying a browser, model IDs, endpoint overrides and raw
SDK messages/stacks. Redacting key-shaped strings alone would still permit reflected
personal text. A bounded, key-redacted provider rejection reason may still be returned
to the requesting page; it is excluded from server logs.

Startup also prints fixed readiness/usage/offline messages. Loopback startup reports
its local URL and actual port; other bindings report only the port and “configured
interface”. Directory paths, arbitrary hostnames and model names are omitted. There
is no verbose mode that restores request/provider payload logging. Node/runtime
warnings, OS diagnostics and operator utilities (benchmarks, fixture capture and the
flipbook) have their own output; the HTTP event contract does not cover those tools.
Unexpected static-file race/error handling remains tracked in
[#99](https://github.com/gregoryyy/kibitz/issues/99).

## Running and retaining logs

`just serve` shows events in the terminal. If retaining them, create a private local
directory outside all served roots and restrict the file to the operator. For example,
from the repository root, after `just build`:

```sh
umask 077
mkdir -p .kibitz-data
chmod 700 .kibitz-data
node site/scripts/serve.mjs site/dist --api --env .env --index _test.html \
  --usage .kibitz-data/usage.sqlite > .kibitz-data/runtime.log 2>&1
```

Logs are neither persisted nor rotated by the application. The operator controls
retention and should rotate/remove saved logs between runs as needed; a redirected
file can grow without a bound on total requests. Browser/server library erasure does
not delete operational logs or copies. Do not add a proxy/access logger that saves raw
URLs or cookies when preserving this policy.

## Checking the local server

For a no-inference liveness check, use:

```sh
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8765/
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8765/api/ai/status
```

The first checks static serving; the second checks the enabled gateway handler.
Neither verifies model/provider connectivity. Inspect Settings for actual configured
models and availability. The connection-test button makes a model request and may
cost money; do not use `/api/ai/test` as an automatic health probe.

To inspect application events in a saved log without printing other diagnostics:

```sh
node --input-type=module -e '
import fs from "node:fs";
for (const line of fs.readFileSync(".kibitz-data/runtime.log", "utf8").split("\n")) {
  try {
    const e = JSON.parse(line);
    if (e.event === "ai_error" || e.event === "server_error" ||
        (e.event === "http" && (!e.complete || e.status >= 400))) console.log(JSON.stringify(e));
  } catch {}
}'
```

Watch repeated `auth_failed`/`model_not_found` failures for configuration problems,
`rate_limited`/`budget_exceeded` for admission limits, and `timeout`/`provider_error`
for unavailable services. A streamed answer may have HTTP status 200 and still emit
an `ai_error`, so inspect both event types. HTTP disconnects alone do not establish an
attack. There are no hosted dashboards, automatic paging or user-level audit trails;
monitoring in this deployment is operator-run. Review CI/security findings separately
before any release.

## Regression evidence

[Unit/server cases](../site/server/logging.test.mjs) use fake SDK clients that reflect
synthetic prompt, answer, cookie and key markers on all four AI routes, including a
late stream failure, provider changes during a request and hostile code/status fields.
[Real-CLI Playwright cases](../site/tests/e2e/private-logs.spec.mjs) check URL/query/control
markers, malformed request targets and startup path failures against actual stdout
and stderr. These are regression evidence for covered paths, not a release audit or
a guarantee about external runtime diagnostics.
