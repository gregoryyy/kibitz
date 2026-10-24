# Deployment decision: local single-user app

Decision for TODO 10.1, confirmed by the project owner on 2026-10-24: **target a local single-user application**. One operator runs the Node server and opens Kibitz in a browser on that machine. The engine and retrieval stay in the browser. Browser storage remains the default; a private SQLite server library is optional. The existing `serve.mjs` default binds to `127.0.0.1`, with same-origin/host checks around the APIs.

This deployment can still use a cloud AI provider chosen by the operator. “Local app” describes where the application runs; `AI_LOCAL_ONLY`, Ollama and the in-browser model provide the separate offline/local-inference options. Provider data sharing and explicit opt-in remain TODO 10.4.

## Supported operation

Build and run from the repository:

```sh
just serve
# Optional private, persistent library:
cd site
node scripts/serve.mjs dist --api --library ../.kibitz-data/library.sqlite
```

The server reads operator-supplied keys from the root `.env`; keys remain outside browser storage, exports, logs and prompts. Server-env key management satisfies TODO 2.9's supported local path. An encrypted store for separate account-owned keys belongs to a future hosted deployment.

The optional library's anonymous HttpOnly cookie separates browser collections, without providing a sign-in or cross-device account. Clearing the cookie loses that browser's route to the previous server collection. Browser profiles, progress, repertoires and practice schedules stay local to the browser. The operator is responsible for local files and backups. Explicit export/deletion is tracked in TODO 10.3.

The existing `--host` option can change the listener for deliberate development/packaging use. Binding to a LAN/public address does not add accounts, transport security or authorization. A public/shared service is outside this deployment decision. A local machine's users, browser profiles and anonymous cookie scopes are not a hosted tenant-security boundary.

## Consequences for the plan

- TODO 10.2 hosted authentication is deferred. Passkeys/OAuth, account sessions, tenant isolation, account-based budgets and encrypted per-user provider keys are prerequisites for any later hosted service.
- TODO 2.11 still needs restart-persistent usage and explicit cookie-scoped rate limits. Cookies supply local usage grouping, not authenticated quotas. Aggregate server limits remain authoritative.
- Data export/deletion covers the standalone browser and explicitly selected local-server library. External artifact hosts retain control of their account data.
- Security verification targets the chosen local deployment (ASVS L1 in TODO 11.4), with applicable provider/prompt/import checks. This decision does not mark those checks complete.
- Packaging, privacy/consent, accessibility, offline use, localization and operations remain actionable. Containers must retain local-only defaults unless an operator intentionally changes them.

## Existing alternate runtimes

The Claude artifact adapter remains an existing host-managed integration. The fully offline browser-model path remains supported. Neither changes the selected release target or supplies a self-hosted multi-user account implementation.

A future hosted proposal must explicitly revisit this decision, threat model, authentication, tenant isolation, provider-key ownership, retention/deletion, persistent budgets, HTTPS and ASVS level before it can claim support.
