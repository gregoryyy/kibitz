// Minimal static server for local development, no dependencies.
//   node scripts/serve.mjs <dir> [--port 8765] [--host 127.0.0.1] [--index index.html] [--api [--env .env]]
//                          [--models DIR [--model ID]] [--offline] [--library FILE] [--usage FILE]
// --api also mounts the AI gateway (server/api.mjs) under /api/, configured from the env file
// (--env= loads none); that part needs the npm dependencies. Every response carries security
// headers, HTML pages a hash-based Content Security Policy (server/static.mjs).
// --models serves the in-browser model (server/models.mjs) from DIR under /models/, once
// scripts/fetch-model.mjs has downloaded and checked it, and tells the gateway about it.
// --offline serves the page without Google Fonts and with a CSP that allows no other host.
// Text responses carry an explicit charset=utf-8; without it, a page that lacks
// <meta charset> (such as site/dist/index.html, the bare artifact body) is
// decoded as Windows-1252 and every non-ASCII character comes out garbled.
import http from 'http';
import fs from 'fs';
import { parseArgs } from 'util';
import { BASE_HEADERS, isHiddenPath } from '../server/static.mjs';
import { modelEnv, servableModel } from '../server/models.mjs';
import { servePublicFile } from '../server/public-files.mjs';
import { aiConfigEvent, logProvider, logRequest, serverErrorEvent } from '../server/logging.mjs';

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
    },
  });
  if (positionals.length !== 1) { console.error('usage: serve.mjs <dir> [--port N] [--host H] [--index FILE] [--api [--env FILE]] [--models DIR [--model ID]] [--offline] [--library FILE] [--usage FILE]'); process.exit(2); }
  const root = fs.realpathSync(positionals[0]);
  let modelsDir = '';
  if (opt.models) {
    try { modelsDir = fs.realpathSync(opt.models); if (!fs.statSync(modelsDir).isDirectory()) throw new Error(); }
    catch { console.error('The model directory must already exist and be a directory; download the selected model first or omit --models.'); process.exit(2); }
  }
  // Validate every public tree before creating a private database or any missing parents.
  const servedRoots = [root, ...(modelsDir ? [modelsDir] : [])];
  let library = null, libraryStore = null;
  if (opt.library) {
    const { openPrivateLibrary } = await import('../server/library-files.mjs');
    const { createLibraryApi } = await import('../server/library-api.mjs');
    libraryStore = openPrivateLibrary(opt.library, servedRoots);
    library = createLibraryApi({ store: libraryStore });
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
    api = createApi({ config, ...usageAccounting(config, { store: usageStore }) });
    console.log(aiConfigEvent(config));
    apiStatus = config.available ? `AI coach: ${logProvider(config.provider)} (configured)` : 'AI coach off: check Settings or server configuration';
  }

  const send = (res, code, msg) => { res.writeHead(code, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(msg + '\n'); };

  http.createServer(async (req, res) => {
    logRequest(req, res);
    // API routers also parse the target. Reject malformed URLs before an async rejection
    // could reach Node's default stack printer with its raw `input` property.
    try { new URL(req.url, 'http://x'); } catch { return send(res, 400, 'Bad request'); }
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
  }).on('error', (/** @type {NodeJS.ErrnoException} */ e) => {
    console.error(serverErrorEvent(e));
    process.exit(1);
  }).listen(Number(opt.port), opt.host, function () {
    const port = this.address().port;
    const host = ['127.0.0.1', 'localhost', '::1'].includes(opt.host) ? (opt.host === '::1' ? '[::1]' : opt.host) : null;
    console.log(host ? `Serving Kibitz at http://${host}:${port}/` : `Serving Kibitz on configured interface, port ${port}`);
    if (apiStatus) { console.log(apiStatus); console.log(opt.usage === ':memory:' ? 'AI usage: in memory; restart resets counters' : 'AI usage: private persistent counters'); }
    if (opt.offline) console.log('Offline: the page loads nothing from other hosts');
  });

}
main().catch(error => { console.error(serverErrorEvent(error)); process.exitCode = 1; });
