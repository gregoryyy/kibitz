// HTTP routes for the AI gateway, mounted by scripts/serve.mjs --api.
//   GET  /api/ai/status  -> {provider, model, models: {quick, chat, review}, available, reason, usage}
//                           usage: today's requests, tokens, cost estimate and budget (usage.mjs)
//   POST /api/ai/config  {provider?, localOnly?} -> status; switches among the providers .env sets up
//   POST /api/ai/test    {} -> {ok, provider, model, ms, usage}: a tiny request to check the connection
//   POST bodies may name a "task" (quick | chat | review) to pick that task's model.
//   POST /api/ai/sample  -> NDJSON stream: {"text":"..."} lines, then {"done":true,"truncated":false,"usage":{"input":n,"output":n}}
//                           or {"error":{"code":"...","message":"..."}}
//   POST /api/ai/structured {messages|prompt, format} -> {data, truncated, usage, mode} as JSON;
//                           format names one of schema.mjs FORMATS, e.g. "annotations"
import net from 'net';
import { applyLocalOnly, complete, createProvider, GatewayError, modelFor, publicStatus, rateLimiter, switchProvider, toGatewayError, validateMessages } from './ai.mjs';
import { completeJson, FORMATS } from './schema.mjs';
import { parsePrices, usageLedger } from './usage.mjs';

const MAX_BODY = 1_000_000;
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// The settings UI can switch provider and local-only mode while the server runs (until restart);
// `makeProvider` builds the new provider's client.
export function createApi({ config, provider = config.available ? createProvider(config) : null, makeProvider = createProvider, log = console, ledger = usageLedger({ tokensPerDay: config.tokensPerDay, prices: parsePrices(config.prices) }) }) {
  const allow = rateLimiter(config.ratePerMinute);
  const status = () => ({ ...publicStatus(config), usage: ledger.today() });
  return async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith('/api/')) return false;
    try {
      checkHost(req);
      if (pathname === '/api/ai/status' && req.method === 'GET') return json(res, 200, status());
      if (pathname === '/api/ai/config' && req.method === 'POST') return await setConfig(req, res);
      if (pathname === '/api/ai/test' && req.method === 'POST') return await testConnection(req, res);
      if (pathname === '/api/ai/sample' && req.method === 'POST') return await sample(req, res);
      if (pathname === '/api/ai/structured' && req.method === 'POST') return await structured(req, res);
      throw new GatewayError('not_found', 'Not found', 404);
    } catch (e) {
      const g = toGatewayError(e);
      if (!res.headersSent) json(res, g.status, { error: { code: g.code, message: g.message } });
      else res.end();
    }
    return true;
  };

  // Same origin and a JSON body, for every POST.
  function checkPost(req) {
    checkOrigin(req);
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new GatewayError('bad_request', 'Content-Type must be application/json', 415);
  }

  async function setConfig(req, res) {
    checkPost(req);
    const body = await readJson(req);
    let next = config;
    if (typeof body?.localOnly === 'boolean') next = applyLocalOnly({ ...next, localOnly: body.localOnly });
    if (body?.provider !== undefined) next = switchProvider(next, body.provider);
    if (next !== config) {
      config = next; provider = config.available ? makeProvider(config) : null;
      log.info?.(`AI coach: ${config.available ? `${config.provider} / ${config.model}` : `off (${config.reason})`}${config.localOnly ? ', local only' : ''}`);
    }
    return json(res, 200, status());
  }

  async function testConnection(req, res) {
    checkPost(req);
    if (!provider) throw new GatewayError('unavailable', config.reason || 'No AI provider configured', 503);
    ledger.check();
    if (!allow()) throw new GatewayError('rate_limited', 'Too many requests; try again in a minute', 429);
    const model = modelFor(config, 'quick'), t0 = Date.now();
    const r = await complete(provider, [{ role: 'user', content: 'Reply with the single word OK.' }], { model, maxTokens: 256 });
    ledger.add(model, r.usage);
    return json(res, 200, { ok: true, provider: config.provider, model, ms: Date.now() - t0, usage: r.usage });
  }

  // Checks shared by the model requests: same origin, JSON body, a provider, valid messages, the
  // daily budget and the rate limit.
  async function accept(req) {
    checkPost(req);
    if (!provider) throw new GatewayError('unavailable', config.reason || 'No AI provider configured', 503);
    const body = await readJson(req);
    const messages = validateMessages(body);
    const model = modelFor(config, body?.task);
    ledger.check();
    if (!allow()) throw new GatewayError('rate_limited', 'Too many requests; try again in a minute', 429);
    return { body, messages, model };
  }

  async function sample(req, res) {
    const { messages, model } = await accept(req);

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...SECURITY_HEADERS });
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const write = obj => res.write(JSON.stringify(obj) + '\n');
    try {
      const it = provider.chat(messages, { model, signal: ac.signal });
      let r;
      while (!(r = await it.next()).done) write({ text: r.value });
      ledger.add(model, r.value?.usage);
      write({ done: true, truncated: !!r.value?.truncated, usage: r.value?.usage || { input: 0, output: 0 } });
    } catch (e) {
      const g = toGatewayError(e, ac.signal);
      // Log the code and the provider's message, never the prompt.
      if (g.code !== 'cancelled') { log.error(`AI ${config.provider}/${model}: ${g.code} (${e?.status ?? '-'}) ${e?.message ?? ''}`); write({ error: { code: g.code, message: g.message } }); }
    }
    res.end();
    return true;
  }

  async function structured(req, res) {
    const { body, messages, model } = await accept(req);
    const format = Object.hasOwn(FORMATS, body?.format) ? FORMATS[body.format] : null;
    if (!format) throw new GatewayError('bad_request', `"format" must be one of ${Object.keys(FORMATS).join(', ')}`, 400);
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    try {
      const out = await completeJson(provider, messages, format, { model, signal: ac.signal });
      ledger.add(model, out.usage);
      return json(res, 200, out);
    }
    catch (e) {
      const g = toGatewayError(e, ac.signal);
      if (g.code !== 'cancelled') log.error(`AI ${config.provider}/${model}: ${g.code} (${e?.status ?? '-'}) ${e?.message ?? ''}`);
      throw g;
    }
  }
}

// DNS-rebinding guard: a rebinding attack reaches us under an attacker-controlled host name,
// so only accept requests addressed to localhost or to an IP literal.
function checkHost(req) {
  let host;
  try { host = new URL(`http://${req.headers.host}`).hostname.replace(/^\[|\]$/g, ''); } catch { host = ''; }
  if (host !== 'localhost' && !net.isIP(host)) throw new GatewayError('forbidden', 'Host not allowed', 403);
}

// CSRF guard: browsers send Origin on cross-site POSTs, so a page on another site can't spend
// the API credits. Non-browser clients (no Origin) are allowed; they could reach the server anyway.
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { originHost = null; }
  if (originHost !== req.headers.host) throw new GatewayError('forbidden', 'Cross-origin requests are not allowed', 403);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // Past the limit, keep draining but drop the data, so the 413 reaches the client
    // instead of a reset connection.
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(new GatewayError('prompt_too_large', 'Request body too large', 413));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new GatewayError('bad_request', 'Body is not valid JSON', 400)); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(body));
  return true;
}
