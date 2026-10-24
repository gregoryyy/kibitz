// HTTP routes for the AI gateway, mounted by scripts/serve.mjs --api.
//   GET  /api/ai/status  -> {provider, model, models: {quick, chat, review}, available, reason, usage, user, paid}
//                           usage: the server's requests, tokens, cost estimate and budget today (usage.mjs);
//                           user: the same for this user, with the per-user budgets for paid models;
//                           paid: whether the current provider is a paid (cloud) one
// Users are told apart by the kibitz_uid cookie (random, HttpOnly), set on the first API request.
//   POST /api/ai/config  {provider?, localOnly?} -> status; switches among the providers .env sets up
//   POST /api/ai/test    {} -> {ok, provider, model, ms, usage}: a tiny request to check the connection
//   POST bodies may name a "task" (quick | chat | review) to pick that task's model.
//   POST /api/ai/sample  -> NDJSON stream: {"text":"..."} lines, then {"done":true,"truncated":false,"usage":{"input":n,"output":n,"cost":x|null},"user":{...}}
//                           or {"error":{"code":"...","message":"..."}}
//   POST /api/ai/structured {messages|prompt, format} -> {data, truncated, usage, mode, user} as JSON;
//                           format names one of schema.mjs FORMATS, e.g. "annotations"
//   GET  /api/ai/embeddings -> safe destination/configuration and opaque cookie scope
//   POST /api/ai/embeddings {texts, fingerprint, scope} -> {vectors, metadata, usage, user}
//                           explicit bounded batches; no server text/vector storage
import crypto from 'crypto';
import net from 'net';
import { applyLocalOnly, complete, createProvider, GatewayError, LOCAL_PROVIDERS, modelFor, providerReason, publicStatus, rateLimiter, switchProvider, toGatewayError, validateMessages, validateTools } from './ai.mjs';
import { completeJson, FORMATS } from './schema.mjs';
import { parsePrices, usageLedger, userLedger } from './usage.mjs';
import { createEmbeddingApi } from './embeddings.mjs';
import { CONSENT_HEADER, providerConsentHeader } from '../src/platform/privacy.js';

const MAX_BODY = 1_000_000;
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

// Explicit local-operator attestation, not an authentication token. Bind it to actual routing.
function requireConsent(req, provider, purpose) {
  const expected = providerConsentHeader(provider, purpose);
  if (expected && req.headers[CONSENT_HEADER] !== expected) throw new GatewayError('consent_required', 'Allow this provider in Settings → Privacy before sending data.', 403);
}

// The settings UI can switch provider and local-only mode while the server runs (until restart);
// `makeProvider` builds the new provider's client.
export function createApi({
  config, provider = config.available ? createProvider(config) : null, makeProvider = createProvider, log = console,
  ledger = usageLedger({ tokensPerDay: config.tokensPerDay, prices: parsePrices(config.prices) }),
  users = userLedger({ tokensPerDay: config.userTokensPerDay, costPerDay: config.userCostPerDay, prices: parsePrices(config.prices) }),
  embeddingConfig = undefined, embedder = undefined,
}) {
  const allow = rateLimiter(config.ratePerMinute);
  const embeddings = createEmbeddingApi({ ...(embeddingConfig ? { config: embeddingConfig } : {}), ...(embedder ? { embedder } : {}), localOnly: () => !!config.localOnly, allow, ledger, users });
  const paid = () => !LOCAL_PROVIDERS.includes(config.provider);
  const status = uid => ({ ...publicStatus(config), usage: ledger.today(), user: users.today(uid), paid: paid() });
  // Counts a finished request for the server and the user; returns its usage with the cost.
  const count = (uid, model, usage) => {
    ledger.add(model, usage);
    return { input: usage?.input || 0, output: usage?.output || 0, cost: users.add(uid, model, usage, { paid: paid() }) };
  };
  return async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://x');
    if (!pathname.startsWith('/api/')) return false;
    try {
      checkHost(req);
      const uid = userOf(req, res);
      if (pathname === '/api/ai/embeddings' && req.method === 'GET') return json(res, 200, embeddings.status(uid));
      if (pathname === '/api/ai/embeddings' && req.method === 'POST') { checkPost(req); requireConsent(req, embeddings.status(uid).provider, 'embeddings'); return json(res, 200, await embeddings.embed(uid, await readJson(req), res)); }
      if (pathname === '/api/ai/status' && req.method === 'GET') return json(res, 200, status(uid));
      if (pathname === '/api/ai/config' && req.method === 'POST') return await setConfig(req, res, uid);
      if (pathname === '/api/ai/test' && req.method === 'POST') return await testConnection(req, res, uid);
      if (pathname === '/api/ai/sample' && req.method === 'POST') return await sample(req, res, uid);
      if (pathname === '/api/ai/structured' && req.method === 'POST') return await structured(req, res, uid);
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

  async function setConfig(req, res, uid) {
    checkPost(req);
    const body = await readJson(req);
    let next = config;
    if (typeof body?.localOnly === 'boolean') next = applyLocalOnly({ ...next, localOnly: body.localOnly });
    if (body?.provider !== undefined) next = switchProvider(next, body.provider);
    if (next !== config) {
      config = next; provider = config.available ? makeProvider(config) : null;
      embeddings.policyChanged();
      log.info?.(`AI coach: ${config.available ? `${config.provider} / ${config.model}` : `off (${config.reason})`}${config.localOnly ? ', local only' : ''}`);
    }
    return json(res, 200, status(uid));
  }

  // The server's daily budget, and the user's for paid models.
  function checkBudgets(uid) {
    ledger.check();
    if (paid()) users.check(uid);
  }

  async function testConnection(req, res, uid) {
    checkPost(req);
    if (!provider) throw new GatewayError('unavailable', config.reason || 'No AI provider configured', 503);
    requireConsent(req, config.provider, 'coach');
    checkBudgets(uid);
    if (!allow()) throw new GatewayError('rate_limited', 'Too many requests; try again in a minute', 429);
    const model = modelFor(config, 'quick'), t0 = Date.now();
    const r = await complete(provider, [{ role: 'user', content: 'Reply with the single word OK.' }], { model, maxTokens: 256 });
    return json(res, 200, { ok: true, provider: config.provider, model, ms: Date.now() - t0, usage: count(uid, model, r.usage), user: users.today(uid) });
  }

  // Checks shared by the model requests: same origin, JSON body, a provider, valid messages, the
  // daily budgets and the rate limit.
  async function accept(req, uid) {
    checkPost(req);
    if (!provider) throw new GatewayError('unavailable', config.reason || 'No AI provider configured', 503);
    requireConsent(req, config.provider, 'coach');
    const body = await readJson(req);
    const messages = validateMessages(body);
    const model = modelFor(config, body?.task);
    checkBudgets(uid);
    if (!allow()) throw new GatewayError('rate_limited', 'Too many requests; try again in a minute', 429);
    return { body, messages, model };
  }

  async function sample(req, res, uid) {
    const { body, messages, model } = await accept(req, uid);
    const tools = validateTools(body?.tools); // TODO 4.11.3: the model may call these; the page runs them

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...SECURITY_HEADERS });
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    const write = obj => res.write(JSON.stringify(obj) + '\n');
    try {
      const it = provider.chat(messages, { model, tools, signal: ac.signal });
      let r;
      while (!(r = await it.next()).done) write({ text: r.value });
      const toolCalls = r.value?.toolCalls?.length ? r.value.toolCalls : undefined;
      write({ done: true, truncated: !!r.value?.truncated, ...(toolCalls ? { toolCalls } : {}), usage: count(uid, model, r.value?.usage), user: users.today(uid) });
    } catch (e) {
      const g = toGatewayError(e, ac.signal);
      // Log the code and the provider's message, never the prompt.
      if (g.code !== 'cancelled') { log.error(`AI ${config.provider}/${model}: ${g.code} (${e?.status ?? '-'}) ${providerReason(e)}`); write({ error: { code: g.code, message: g.message } }); }
    }
    res.end();
    return true;
  }

  async function structured(req, res, uid) {
    const { body, messages, model } = await accept(req, uid);
    const format = Object.hasOwn(FORMATS, body?.format) ? FORMATS[body.format] : null;
    if (!format) throw new GatewayError('bad_request', `"format" must be one of ${Object.keys(FORMATS).join(', ')}`, 400);
    const ac = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    try {
      const out = await completeJson(provider, messages, format, { model, signal: ac.signal });
      return json(res, 200, { ...out, usage: count(uid, model, out.usage), user: users.today(uid) });
    }
    catch (e) {
      const g = toGatewayError(e, ac.signal);
      if (g.code !== 'cancelled') log.error(`AI ${config.provider}/${model}: ${g.code} (${e?.status ?? '-'}) ${providerReason(e)}`);
      throw g;
    }
  }
}

// The user, from the kibitz_uid cookie; a new random one is issued when it's missing or malformed.
// It only tells users apart for counting and budgets (no accounts yet, TODO 10.1): HttpOnly, so page
// scripts can't read it, and SameSite=Strict, so other sites' requests don't carry it.
const UID_RE = /^[A-Za-z0-9_-]{22}$/;
function userOf(req, res) {
  const m = /(?:^|;\s*)kibitz_uid=([^;]*)/.exec(req.headers.cookie || '');
  if (m && UID_RE.test(m[1])) return m[1];
  const uid = crypto.randomBytes(16).toString('base64url');
  res.setHeader('Set-Cookie', `kibitz_uid=${uid}; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=31536000`);
  return uid;
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
