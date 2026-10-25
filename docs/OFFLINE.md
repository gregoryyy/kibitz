# Offline app

Start Kibitz normally, open **Settings → Offline app**, then choose **Prepare or check updates**. Keep the page open until preparation is confirmed, then reload once. Bookmark that same address, including its port, or install Kibitz through your browser's app-install menu when offered. The browser can subsequently open that address with the Node server unavailable.

Preparation saves a complete public app bundle: Stockfish workers and WASM, chess rules/board code, opening tables, reference games, curriculum, application modules, bundled fonts/licences, data-management page and model runtime. It does not download model weights, send games to a service or cache API responses. Browser-local saved games, current-game snapshots and practice results retain their existing localStorage lifecycle. Bundled references and lessons are available offline. The private server library still needs a verified server owner; a fresh offline load cannot reveal an earlier cookie owner's cached collection. Select the browser library before relying on it offline.

## Coach choices

- **Ollama:** an internet connection is unnecessary when Ollama and the Kibitz Node gateway are running locally with a downloaded model. The PWA does not replace either process. Provider opt-in still applies, and a configured remote Ollama endpoint still needs that network connection.
- **In browser:** select this provider and explicitly load its model while the server is running. Model loading keeps its existing resource consent and wllama weight cache. Kibitz retains only the selected browser model's bounded local URL/name/size, without network-provider status, usage, credentials or user identity. When the gateway cannot be reached after a reload, this descriptor permits the existing browser-coach path; no network provider is silently substituted. Changing to another provider clears that saved choice when storage permits.

The offline app copy includes wllama's runtime, not its weights. A successful in-memory model load does not prove durable caching: private browsing, quota pressure or storage eviction can leave the weights unavailable after reload. Test a reload without the server on your own device before depending on offline coaching. Missing weights or memory remain visible load errors. Cloud coaching and remote embeddings need their configured services; lexical/board search and authored lessons do not.

## Optional Chrome built-in coach

Run `just offline-chrome`, open the Coach tab in supported desktop Google Chrome, and press **Load**. This recipe serves the offline page with local-only policy and no `.env` keys or GGUF download. Alternatively set `BROWSER_RUNTIME=chrome` in `.env`, start `npm run serve` in `site/`, and select **In browser**. The default `BROWSER_RUNTIME=wllama` and `just offline` retain the pinned GGUF runtime.

The [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) exposes its built-in model to supported windows. Chrome manages its download, storage, hardware/language eligibility and updates; the exact size/version is not pinned by Kibitz. Initial download needs network access. Chrome documents inference as on-device and subsequent use as offline-capable. Its browser-managed downloads are outside the page's same-origin CSP/cache. Check availability on your own device; other browsers' Prompt API implementations are not selected by this backend.

The notice above **Load** explains this download permission. A capability probe never creates a session. A click is required each time the model is loaded, including after reload, explicit **Unload** or ten idle minutes. Remembering the selected runtime does not authorize another download. **Unload** also stops a pending load; late sessions are destroyed. Loading creates an empty session, and each question uses a disposable clone so only the application's supplied messages form its history. Switching away while browser inference is unused unloads it. The existing quick-question routing and page-side connection test work with either runtime; no automatic cloud fallback occurs.

Kibitz bounds Chrome requests to 100,000 input characters, 12,000 output characters and two minutes, with a five-minute loading deadline. Characters here are UTF-16 code units; these are not exact token limits or usage estimates. Context measurement and overflow refusal prevent silently dropping supplied evidence. Native JSON constraints are passed when requested; normal output/move checks still apply. Chrome does not expose a reliable CPU/GPU choice or model-memory estimate, so it checks eligibility itself and Kibitz conservatively reduces analyst threads during inference. The API remains in the window rather than a Worker, as required by its current interface.

The offline descriptor stores only `{runtime: 'chrome', name: 'Chrome built-in model'}` in the existing bounded version-one envelope; it stores neither model weights, API responses nor loading consent. Missing/evicted native weights or unavailable capabilities remain failures until an explicit successful Load. Removing Kibitz's offline copy or erasing its browser data does not remove Chrome-managed model files; Chrome controls that storage. Fake-API unit and browser tests cover the lifecycle, limits, routing, JSON, unsupported devices, offline descriptor and German controls. No real Chrome-model performance, availability or chess-quality result is claimed.

## Model weight downloads

`just offline` downloads the selected catalogue model before building/serving. The Node download command limits the response to the pinned byte count while streaming and checks its exact size and SHA-256 before replacing the final model file. Unique exclusive temporary files keep concurrent downloads separate; handled failures/cancellation remove that run's temporary files and leave earlier weights/markers intact before publication. The byte cap applies per download.

Both Qwen download URLs select full upstream commits rather than `main`. The
[dated source record](security/2026-10-25-browser-models.json) matches those
revisions' LFS pointers to the existing byte/hash pins and identifies their model
cards and Apache-2.0 licences. The weights and local filenames have not changed,
so already checked files keep their existing fast path. For an upgrade, review
the official repository, full revision, LFS size/hash, model card, licence and
runtime compatibility together in a PR; update the catalogue and evidence, then
run the catalogue/download regressions before making a separate approved weight
download or inference trial. Publisher metadata does not verify training or
quantization lineage, teaching quality or continued upstream availability.

The default total transfer deadline is 30 minutes, covering response headers and body. To allow an hour, run `node site/scripts/fetch-model.mjs --timeout-ms 3600000` from the repository root. The option accepts a positive integer up to 2147483647 milliseconds. Invalid sizes, hashes, failed HTTP responses, stalled transfers and interrupted streams produce a failure rather than publishing unchecked weights. Already checked files retain the existing no-download fast path.

File and marker publication use separate atomic replacements; an interrupted marker update can leave verified weights needing another full check. A process crash can leave `.part-*` files, which are not served as models; remove abandoned partials only when no download is running. The `.sha256` marker is a quick availability check in an operator-controlled directory, not a fresh hash of every served byte. Keep model files/markers trusted; a same-size local edit with an old marker is outside that shortcut's detection. The download/verification command and browser weight cache have separate lifecycles from the public offline app bundle.

## Integrity, updates and removal

The build generates a manifest of every public bundle asset with exact byte count and SHA-256. A module service worker fetches without cookies, rejects redirects/failed responses and verifies each asset before installation can succeed. An incomplete new cache is removed. Once a version controls the page, navigation and bundled assets come from that version; an absent cached file returns a visible failure rather than mixing in a different build. API requests, model weights, non-bundle paths, mutations and other origins bypass this cache.

The first install controls the next navigation. **Prepare or check updates** explicitly checks the worker again; a complete update waits until every tab using the prior version closes. No automatic page reload, forced activation or background game replacement occurs. Activation deletes only obsolete Kibitz bundle caches in the same scope. These lifecycle choices follow the [Service Workers specification](https://www.w3.org/TR/service-workers/). Service workers require a secure context; the supported loopback address qualifies, as does HTTPS.

**Remove offline copy** unregisters this app's worker and removes its public bundle caches. It preserves saved games, other applications' caches and model weights. Reload with the server running before preparing again. **Your data → Erase browser data** also removes the offline app registration/bundles before acknowledging browser erasure. Other open tabs can retain loaded code/data, so close them as the erasure page instructs. Public model weights retain their separate runtime/browser-storage lifecycle.

Browser storage is not a backup and the browser can clear it. Keep exports of games and learning data. A missing or incomplete registered copy is not reported ready: remove it in Settings, reload with the server running, then prepare again. If the page itself can no longer load, remove the service worker/cache through the browser's site controls before reconnecting. Preparation/removal failures remain visible. Browser installation UI, storage quotas and model-cache support vary by platform. Automated Chrome tests cover a real offline engine/reply, local library and lesson use, update waiting, failed-update integrity, cache re-preparation, removal retries and German phone controls; browser-coach fallback uses a fake runtime. No real-model performance or cross-browser guarantee is inferred from those tests.

The offline manifest builder rejects symlink entries and hashes regular assets through the same no-follow file descriptor it checks. The build output remains a trusted operator workspace; this is not isolation against a local process that controls its parent directories.
