// Runtime logs contain only fixed vocabulary, numbers and booleans. Never serialize a
// request, SDK error, config object or arbitrary string, even after key-pattern redaction.
const PROVIDERS = new Set(['anthropic', 'openai', 'mistral', 'ollama', 'browser', 'mock']);
const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const ACTIONS = new Set(['sample', 'structured', 'test', 'embeddings']);
const CODES = new Set(['auth_failed', 'bad_request', 'bad_output', 'budget_exceeded', 'cancelled', 'consent_required', 'forbidden', 'in_browser', 'model_not_found', 'not_found', 'prompt_too_large', 'provider_error', 'provider_rejected', 'response_too_large', 'rate_limited', 'refused', 'stale_embeddings', 'timeout', 'unavailable', 'usage_unavailable']);
const SYSTEM_CODES = new Set(['EACCES', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EEXIST', 'EINVAL', 'EISDIR', 'ENOENT', 'ENOTDIR', 'EPERM', 'ERR_MODULE_NOT_FOUND', 'ERR_INVALID_ARG_VALUE', 'ERR_SOCKET_BAD_PORT', 'ERR_PARSE_ARGS_UNKNOWN_OPTION', 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE', 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL', 'ERR_KIBITZ_TLS_CONFIG', 'ERR_KIBITZ_HTTPS_REQUIRED', 'ERR_KIBITZ_APP_HOST', 'ERR_KIBITZ_OPERATOR_CONFIG', 'ERR_KIBITZ_PERMISSIONS_CONFIG', 'ERR_KIBITZ_ISOLATION']);
const ROUTES = new Map(['status', 'config', 'test', 'sample', 'structured', 'embeddings'].map(name => [`/api/ai/${name}`, `ai.${name}`]));
export const logProvider = value => PROVIDERS.has(value) ? value : 'other';
const statusNumber = value => Number.isInteger(value) && value >= 100 && value <= 599 ? value : 0;
const line = fields => JSON.stringify({ at: new Date().toISOString(), ...fields });

export function routeCategory(url) {
  let pathname;
  try { pathname = new URL(url, 'http://x').pathname; } catch { return 'invalid'; }
  return ROUTES.get(pathname) || (pathname.startsWith('/api/library/') ? 'library' : pathname.startsWith('/api/') ? 'api.other' : pathname.startsWith('/models/') ? 'model' : 'static');
}

/** One event on completion or disconnect, including streamed responses; no identity fields. */
export function logRequest(req, res, log = console) {
  const route = routeCategory(req.url), method = METHODS.has(req.method) ? req.method : 'OTHER', started = performance.now();
  let recorded = false;
  const record = () => {
    if (recorded) return;
    recorded = true;
    log.log(line({ event: 'http', method, route, status: res.writableFinished ? statusNumber(res.statusCode) : 0,
      complete: !!res.writableFinished, ms: Math.min(86_400_000, Math.max(0, Math.round(performance.now() - started))) }));
  };
  res.once('finish', record); res.once('close', record);
}

export function aiErrorEvent(action, provider, code, status) {
  return line({ event: 'ai_error', action: ACTIONS.has(action) ? action : 'other', provider: logProvider(provider),
    code: CODES.has(code) ? code : 'other', status: statusNumber(status) });
}

export function aiConfigEvent(config) {
  return line({ event: 'ai_config', provider: logProvider(config.provider), available: !!config.available, localOnly: !!config.localOnly });
}

export function fileErrorEvent(resource, code) {
  const codes = new Set(['EIO', 'EMFILE', 'ENFILE', 'ENOMEM', 'ESTALE', 'EBADF', 'ERR_STREAM_PREMATURE_CLOSE']);
  return line({ event: 'file_error', resource: resource === 'model' ? 'model' : 'static', code: codes.has(code) ? code : 'other' });
}

// These application-owned messages are exact matches, never arbitrary exception prose.
const STARTUP_HINTS = new Map([
  ['Native isolation is unavailable. Use the documented isolated runtime or explicit development mode.', 'Native isolation is unavailable. Use the documented isolated runtime or explicit development mode.'],
  ['Configure a private, operator-bound permission policy outside served directories.', 'Configure a private, operator-bound permission policy outside served directories.'],
  ['Configure a private operator identity and session database outside served directories.', 'Configure a private operator identity and session database outside served directories.'],
  ['Invalid application transport configuration.', 'Use an isolated .test application hostname with matching TLS SAN, or select the documented legacy-origin recovery mode.'],
  ['TLS required', 'Configure native TLS certificates, or explicitly select --http-dev for isolated development.'],
  ['Configure both TLS PEM files outside served directories; the private key must have owner-only permissions.', 'Configure both TLS PEM files outside served directories; the private key must have owner-only permissions.'],
  ['The database must be outside every served directory.', 'The database must be outside every served directory.'],
  ['The database must be a private regular file (mode 0600).', 'The database must be a private regular file (mode 0600).'],
  ['Specify a private database file.', 'Specify a private database file.'],
]);
export function serverErrorEvent(error) {
  return line({ event: 'server_error', code: SYSTEM_CODES.has(error?.code) ? error.code : 'other',
    hint: STARTUP_HINTS.get(error?.message) || (error?.code === 'EADDRINUSE' ? 'Listener already in use; stop the other server or pick another port.'
      : error?.code === 'ERR_MODULE_NOT_FOUND' ? 'Run npm ci in site/ to install Node dependencies.' : 'Check command options, directory existence, file permissions and server configuration.') });
}
