// Local static server; parse5 selects inline HTML scripts for CSP hashes.
//   node scripts/serve.mjs <dir> [--port 8765] [--host 127.0.0.1] [--index index.html] [--api [--env .env]]
//                          [--models DIR [--model ID]] [--offline] [--library FILE] [--usage FILE]
//                          [--operator FILE --sessions FILE --permissions FILE] [--tls-key FILE --tls-cert FILE [--app-host NAME | --legacy-origin] | --http-dev]
// --api also mounts the AI gateway (server/api.mjs) under /api/, configured from the env file
// (--env= loads none); the gateway additionally needs the provider SDKs. Every response carries security
// headers, HTML pages a hash-based Content Security Policy (server/static.mjs).
// --models serves the in-browser model (server/models.mjs) from DIR under /models/, once
// scripts/fetch-model.mjs has downloaded and checked it, and tells the gateway about it.
// --offline serves the page without Google Fonts and with a CSP that allows no other host.
// Text responses carry an explicit charset=utf-8; without it, a page that lacks
// <meta charset> (such as site/dist/index.html, the bare artifact body) is
// decoded as Windows-1252 and every non-ASCII character comes out garbled.
import http from 'http';
import https from 'node:https';
import fs from 'fs';
import { parseArgs } from 'util';
import { modelEnv, servableModel } from '../server/models.mjs';
import { aiConfigEvent, logProvider, logRequest, serverErrorEvent } from '../server/logging.mjs';
import { loadTlsOptions } from '../server/tls.mjs';
import { applicationHost, enforceTransport } from '../server/transport.mjs';

async function main() {

  const { values: opt, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', default: '8765' },
      host: { type: 'string', default: '127.0.0.1' },
      index: { type: 'string', default: 'index.html' },
      api: { type: 'boolean', default: false },
      env: { type: 'string', default: '.env' },
      models: { type: 'string', default: '' },
      model: { type: 'string', default: '' },
      offline: { type: 'boolean', default: false },
      library: { type: 'string', default: '' },
      usage: { type: 'string', default: ':memory:' },
      'tls-key': { type: 'string' },
      'tls-cert': { type: 'string' },
      'http-dev': { type: 'boolean', default: false },
      operator: { type: 'string' },
      sessions: { type: 'string' },
      permissions: { type: 'string' },
      'app-host': { type: 'string' },
      'legacy-origin': { type: 'boolean', default: false },
    },
  });
  if (positionals.length !== 1) { console.error('usage: serve.mjs <dir> [--port N] [--host H] [--index FILE] [--api [--env FILE]] [--models DIR [--model ID]] [--offline] [--library FILE] [--usage FILE] [--operator FILE --sessions FILE --permissions FILE] [--tls-key FILE --tls-cert FILE [--app-host NAME | --legacy-origin] | --http-dev]'); process.exit(2); }
  const root = fs.realpathSync(positionals[0]);
  let modelsDir = '';
  if (opt.models) {
    try { modelsDir = fs.realpathSync(opt.models); if (!fs.statSync(modelsDir).isDirectory()) throw new Error(); }
    catch { console.error('The model directory must already exist and be a directory; download the selected model first or omit --models.'); process.exit(2); }
  }
  // Validate every public tree before creating a private database or any missing parents.
  const servedRoots = [root, ...(modelsDir ? [modelsDir] : [])];
  const tlsSelected = opt['tls-key'] !== undefined || opt['tls-cert'] !== undefined;
  if ((opt['app-host'] !== undefined && (!tlsSelected || opt['legacy-origin'] || opt['http-dev']))
    || (opt['legacy-origin'] && (!tlsSelected || opt['http-dev']))) {
    throw Object.assign(new Error('Invalid application transport configuration.'), { code: 'ERR_KIBITZ_APP_HOST' });
  }
  const appHost = tlsSelected && !opt['legacy-origin'] ? applicationHost(opt['app-host']) : null;
  const tlsOptions = loadTlsOptions({ key: opt['tls-key'], cert: opt['tls-cert'], servedRoots, hostname: appHost });
  if ((!tlsOptions && (opt.api || opt.library) && !opt['http-dev']) || (tlsOptions && opt['http-dev'])) {
    throw Object.assign(new Error('TLS required'), { code: 'ERR_KIBITZ_HTTPS_REQUIRED' });
  }
  // Keep missing runtime dependencies inside the bounded startup-error handler.
  const [{ BASE_HEADERS, isHiddenPath }, { servePublicFile }] = await Promise.all([
    import('../server/static.mjs'), import('../server/public-files.mjs'),
  ]);
  let sessionApi = null, registry = null;
  if (opt.api || opt.library) {
    const { createSessionApi } = await import('../server/session-api.mjs');
    if (tlsOptions) {
      const { readOperator } = await import('../server/operator.mjs');
      const { sessionStore } = await import('../server/sessions.mjs');
      const { privateDatabaseFile } = await import('../server/private-files.mjs');
      // Operator proof/configuration precedes private database creation.
      const operator = readOperator(opt.operator, servedRoots);
      const { readPermissions } = await import('../server/permissions.mjs');
      readPermissions(opt.permissions, servedRoots, operator); // Validate before opening any private database.
      if (!opt.sessions) throw Object.assign(new Error('Configure a private operator identity and session database outside served directories.'), { code: 'ERR_KIBITZ_OPERATOR_CONFIG' });
      registry = sessionStore(privateDatabaseFile(opt.sessions, servedRoots));
      process.once('exit', () => registry.close());
      sessionApi = createSessionApi({ operator, store: registry, hostname: appHost, permissions: () => readPermissions(opt.permissions, servedRoots, operator) });
    } else sessionApi = createSessionApi(); // Explicit plaintext development, never final authentication.
  }
  const identity = tlsOptions ? sessionApi?.identity : undefined;
  let library = null, libraryStore = null;
  if (opt.library) {
    const { openPrivateLibrary } = await import('../server/library-files.mjs');
    const { createLibraryApi } = await import('../server/library-api.mjs');
    libraryStore = openPrivateLibrary(opt.library, servedRoots);
    library = createLibraryApi({ store: libraryStore, allowInsecureHttp: opt['http-dev'], hostname: appHost, ...(identity ? { identity } : {}) });
    process.once('exit', () => libraryStore.close());
  }

  let api = null, apiStatus = '';
  if (opt.api) {
    if (opt.env) try { process.loadEnvFile(opt.env); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (modelsDir) {
      const { env, reason } = modelEnv(modelsDir, opt.model || process.env.BROWSER_MODEL);
      Object.assign(process.env, env, reason ? { BROWSER_MODEL_REASON: reason } : {});
    }
    const { loadConfig } = await import('../server/ai.mjs');
    const { createApi } = await import('../server/api.mjs');
    const config = loadConfig();
    const { sqliteUsageStore } = await import('../server/usage-store.mjs');
    const { privateDatabaseFile } = await import('../server/private-files.mjs');
    const { usageAccounting } = await import('../server/usage.mjs');
    const usageStore = sqliteUsageStore(privateDatabaseFile(opt.usage, servedRoots));
    process.once('exit', () => usageStore.close());
    api = createApi({ config, allowInsecureHttp: opt['http-dev'], hostname: appHost, ...(identity ? { identity } : {}), ...usageAccounting(config, { store: usageStore }) });
    console.log(aiConfigEvent(config));
    apiStatus = config.available ? `AI coach: ${logProvider(config.provider)} (configured)` : 'AI coach off: check Settings or server configuration';
  }

  const send = (res, code, msg) => { res.writeHead(code, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg + '\n'); };

  const handle = async (req, res) => {
    logRequest(req, res);
    if (appHost && !enforceTransport(req, res, { hostname: appHost })) return send(res, 403, 'Host not allowed');
    // API routers also parse the target. Reject malformed URLs before an async rejection
    // could reach Node's default stack printer with its raw `input` property.
    try { new URL(req.url, 'http://x'); } catch { return send(res, 400, 'Bad request'); }
    if (sessionApi && await sessionApi.handle(req, res)) return;
    if (library && await library(req, res)) return;
    if (api && await api(req, res)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(res, 400, 'Bad request'); }
    if (rel.endsWith('/')) rel += opt.index;
    if (isHiddenPath(rel)) return send(res, 404, 'Not found');
    if (rel.startsWith('/models/')) {
      const name = rel.slice('/models/'.length);
      if (!modelsDir || !servableModel(name)) return send(res, 404, 'Not found');
      return servePublicFile(req, res, { root: modelsDir, relative: name, model: true });
    }
    return servePublicFile(req, res, { root, relative: rel.slice(1), offline: opt.offline });
  };
  const server = tlsOptions ? https.createServer(tlsOptions, handle) : http.createServer(handle);
  // Parser/TLS failures cannot establish a valid application host. Close rather
  // than emitting Node's default HTTP response outside the application policy.
  server.on('clientError', (_error, socket) => socket.destroy());
  server.on('error', (/** @type {NodeJS.ErrnoException} */ e) => {
    console.error(serverErrorEvent(e));
    process.exit(1);
  }).listen(Number(opt.port), opt.host, function () {
    const port = this.address().port;
    const host = appHost || (['127.0.0.1', 'localhost', '::1'].includes(opt.host) ? (opt.host === '::1' ? '[::1]' : opt.host) : null);
    const scheme = tlsOptions ? 'https' : 'http';
    console.log(host ? `Serving Kibitz at ${scheme}://${host}:${port}/` : `Serving Kibitz on configured interface, port ${port} (${scheme})`);
    if (apiStatus) { console.log(apiStatus); console.log(opt.usage === ':memory:' ? 'AI usage: in memory; restart resets counters' : 'AI usage: private persistent counters'); }
    if (opt.offline) console.log('Offline: the page loads nothing from other hosts');
  });

}
main().catch(error => { console.error(serverErrorEvent(error)); process.exitCode = 1; });
