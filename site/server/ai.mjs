// AI gateway core: settings, provider adapters and request validation.
// Server-side only. API keys come from process.env (loaded from .env) and never leave this process.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { exampleFor, providerSchema } from './schema.mjs';

export const PROVIDERS = ['anthropic', 'openai', 'mistral', 'ollama', 'mock'];
// Small, fast models by default: coaching replies are short and grounded in engine output.
const DEFAULTS = {
  anthropic: { model: 'claude-haiku-5-5' },
  openai: { model: 'gpt-6-luna', baseURL: 'https://api.openai.com/v1' },
  mistral: { model: 'mistral-small-latest', baseURL: 'https://api.mistral.ai/v1' },
  ollama: { model: '', baseURL: 'http://127.0.0.1:11434' },
};
export const LIMITS = { messages: 40, chars: 200_000 };
// What a request is for; each can have its own model (<PROVIDER>_MODEL_QUICK, _MODEL_REVIEW;
// chat uses <PROVIDER>_MODEL). quick: the quick-question chips; chat: typed questions; review:
// the game summary and study plan.
export const TASKS = ['quick', 'chat', 'review'];

export class GatewayError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}

// Reads the AI settings from an env object. `available` is false (with a `reason`) when the
// chosen provider can't be used, so the client can hide the coach and say why.
export function loadConfig(env = process.env) {
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
  const provider = (env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
  const cfg = {
    provider, model: '', available: false, reason: '',
    maxTokens: num(env.AI_MAX_OUTPUT_TOKENS, 16000),
    timeoutMs: num(env.AI_TIMEOUT_MS, 60000),
    ratePerMinute: num(env.AI_RATE_LIMIT_PER_MINUTE, 20),
  };
  const off = reason => ({ ...cfg, reason });
  if (!PROVIDERS.includes(provider)) return off(`AI_PROVIDER "${provider}" is not one of ${PROVIDERS.join(', ')}`);
  if (provider === 'mock') return { ...cfg, model: 'mock', models: { quick: 'mock', chat: 'mock', review: 'mock' }, available: true };

  const P = provider.toUpperCase();
  cfg.model = env[`${P}_MODEL`] || DEFAULTS[provider].model;
  cfg.baseURL = env[`${P}_BASE_URL`] || DEFAULTS[provider].baseURL;
  if (!cfg.model) return off(provider === 'ollama' ? 'OLLAMA_MODEL is empty; set it to a model from `ollama list`' : `${P}_MODEL is empty`);
  cfg.models = { quick: env[`${P}_MODEL_QUICK`] || cfg.model, chat: cfg.model, review: env[`${P}_MODEL_REVIEW`] || cfg.model };
  if (provider === 'anthropic') cfg.effort = env.ANTHROPIC_EFFORT ?? 'medium';
  if (provider === 'ollama') {
    // SSRF guard: the server only talks to Ollama hosts that are explicitly allowed.
    const allowed = (env.OLLAMA_ALLOWED_HOSTS || '127.0.0.1,localhost').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    let host;
    try { host = new URL(cfg.baseURL).hostname.toLowerCase(); } catch { return off('OLLAMA_BASE_URL is not a valid URL'); }
    if (!allowed.includes(host)) return off(`OLLAMA_BASE_URL host "${host}" is not in OLLAMA_ALLOWED_HOSTS`);
    return { ...cfg, apiKey: 'ollama', available: true };
  }
  cfg.apiKey = env[`${P}_API_KEY`] || '';
  if (!cfg.apiKey) return off(`${P}_API_KEY is empty in .env`);
  return { ...cfg, available: true };
}

// What the browser may see about the configuration: never keys or base URLs.
export const publicStatus = cfg => ({ provider: cfg.provider, model: cfg.model, models: cfg.models || null, available: cfg.available, reason: cfg.reason });
// The model for a request's task ("chat" when none is given); unknown tasks are refused.
export function modelFor(cfg, task) {
  if (task === undefined || task === null) task = 'chat';
  if (!TASKS.includes(task)) throw new GatewayError('bad_request', `"task" must be one of ${TASKS.join(', ')}`, 400);
  return cfg.models?.[task] || cfg.model;
}

// Accepts {prompt: string} or {messages: [{role: 'user'|'assistant', content: string}]}.
// The client can't send system messages, so it can't replace server-side instructions.
export function validateMessages(body) {
  const msgs = typeof body?.prompt === 'string' ? [{ role: 'user', content: body.prompt }] : body?.messages;
  if (!Array.isArray(msgs) || !msgs.length) throw new GatewayError('bad_request', 'Expected "messages" or "prompt"', 400);
  if (msgs.length > LIMITS.messages) throw new GatewayError('prompt_too_large', `At most ${LIMITS.messages} messages`, 413);
  let total = 0;
  const out = msgs.map(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      throw new GatewayError('bad_request', 'Each message needs role "user" or "assistant" and string content', 400);
    }
    total += m.content.length;
    return { role: m.role, content: m.content };
  });
  if (total > LIMITS.chars) throw new GatewayError('prompt_too_large', `At most ${LIMITS.chars} characters in total`, 413);
  if (out[0].role !== 'user' || out.at(-1).role !== 'user') throw new GatewayError('bad_request', 'The first and last messages must come from the user', 400);
  return out;
}

// A provider exposes chat(messages, opts): an async generator that yields text chunks and
// returns {truncated, usage: {input, output}} (token counts, 0 when the provider doesn't say).
//   opts: {model, system, maxTokens, schema, signal}; model and maxTokens default to the configuration.
//   schema: a format from schema.mjs ({name, schema}); the provider is asked for JSON matching it.
// complete() below collects a whole reply. `client` can be injected for tests.
export function createProvider(cfg, /** @type {{ client?: any }} */ { client } = {}) {
  switch (cfg.provider) {
    case 'anthropic':
      return anthropicProvider(cfg, client ?? new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeout: cfg.timeoutMs }));
    case 'openai': case 'mistral': case 'ollama': {
      const baseURL = cfg.provider === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
      return openAICompatProvider(cfg, client ?? new OpenAI({ apiKey: cfg.apiKey, baseURL, timeout: cfg.timeoutMs }));
    }
    case 'mock': return mockProvider();
    default: throw new GatewayError('unavailable', `Unknown provider ${cfg.provider}`, 503);
  }
}

/** @typedef {{ model?: string, system?: string, maxTokens?: number, schema?: { name: string, schema: object }, signal?: AbortSignal }} ChatOptions */

function anthropicProvider(cfg, client) {
  return {
    async *chat(messages, /** @type {ChatOptions} */ { model = cfg.model, system, maxTokens = cfg.maxTokens, schema, signal } = {}) {
      const output = { ...(cfg.effort ? { effort: cfg.effort } : {}), ...(schema ? { format: { type: 'json_schema', schema: providerSchema(schema.schema) } } : {}) };
      const stream = client.beta.messages.stream({
        model,
        max_tokens: maxTokens,
        messages,
        ...(system ? { system } : {}),
        ...(Object.keys(output).length ? { output_config: output } : {}),
        // On a safety decline, re-run on Anthropic's recommended fallback model instead of failing.
        // Haiku models have no server-side fallback, so the option is left off for them.
        ...(model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      }, { signal });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
      }
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new GatewayError('refused', 'The model declined to answer', 200);
      const u = msg.usage || {};
      return { truncated: msg.stop_reason === 'max_tokens', usage: { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), output: u.output_tokens || 0 } };
    },
  };
}

// OpenAI, Mistral and Ollama all serve the OpenAI chat-completions protocol.
// Token usage: OpenAI and Ollama report it in a last chunk when asked (stream_options);
// Mistral sends it with the final chunk on its own.
function openAICompatProvider(cfg, client) {
  const tokenParam = cfg.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens';
  return {
    async *chat(messages, /** @type {ChatOptions} */ { model = cfg.model, system, maxTokens = cfg.maxTokens, schema, signal } = {}) {
      const params = {
        model, stream: true, [tokenParam]: maxTokens,
        messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
        ...(cfg.provider === 'mistral' ? {} : { stream_options: { include_usage: true } }),
        ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: providerSchema(schema.schema), strict: true } } } : {}),
      };
      const stream = await client.chat.completions.create(params, { signal });
      let finish = null, usage = null;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const text = deltaText(choice?.delta?.content);
        if (text) yield text;
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (chunk.usage) usage = chunk.usage;
      }
      if (finish === 'content_filter') throw new GatewayError('refused', 'The model declined to answer', 200);
      return { truncated: finish === 'length', usage: { input: usage?.prompt_tokens || 0, output: usage?.completion_tokens || 0 } };
    },
  };
}
// Some Mistral models stream content as an array of typed parts; keep only the text.
const deltaText = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(p => p?.type === 'text').map(p => p.text).join('') : '';

// Offline stand-in for development and tests (AI_PROVIDER=mock).
// Token counts are rough (four characters a token) but deterministic.
function mockProvider() {
  return {
    async *chat(messages, /** @type {ChatOptions} */ { schema } = {}) {
      const reply = schema ? JSON.stringify(exampleFor(schema.schema)) : `Mock coach (AI_PROVIDER=mock). Your message had ${messages.at(-1).content.length} characters; set a real provider in .env for actual coaching.`;
      for (const word of reply.split(/(?<= )/)) yield word;
      const chars = messages.reduce((n, m) => n + m.content.length, 0);
      return { truncated: false, usage: { input: Math.ceil(chars / 4), output: Math.ceil(reply.length / 4) } };
    },
  };
}

// The whole reply at once: {text, truncated, usage}.
export async function complete(provider, messages, opts = {}) {
  const it = provider.chat(messages, opts);
  let text = '', r;
  while (!(r = await it.next()).done) text += r.value;
  return { text, truncated: !!r.value?.truncated, usage: r.value?.usage || { input: 0, output: 0 } };
}

// ---------------------------------------------------------------- Embeddings (for RAG, TODO 8.3)
// Anthropic has no embeddings API, so EMBEDDING_PROVIDER is openai, mistral or ollama. The key,
// base URL and Ollama host allowlist are the chat provider's settings for that name.
export const EMBEDDING_PROVIDERS = ['openai', 'mistral', 'ollama', 'mock'];
const EMBEDDING_DEFAULTS = { openai: 'text-embedding-3-small', mistral: 'mistral-embed', ollama: '' };
export const EMBED_LIMITS = { texts: 128, chars: 8000 };
export function loadEmbeddingConfig(env = process.env) {
  const provider = (env.EMBEDDING_PROVIDER || 'ollama').trim().toLowerCase();
  const off = reason => ({ provider, model: '', available: false, reason });
  if (!EMBEDDING_PROVIDERS.includes(provider)) return off(`EMBEDDING_PROVIDER "${provider}" is not one of ${EMBEDDING_PROVIDERS.join(', ')}`);
  if (provider === 'mock') return { provider, model: 'mock', available: true, reason: '' };
  const base = /** @type {any} */ (loadConfig({ ...env, AI_PROVIDER: provider, [`${provider.toUpperCase()}_MODEL`]: 'embeddings' }));
  const model = env.EMBEDDING_MODEL || EMBEDDING_DEFAULTS[provider];
  if (!model) return off('EMBEDDING_MODEL is empty; for Ollama, set it to an embedding model you have pulled (e.g. nomic-embed-text)');
  if (!base.available) return off(base.reason);
  return { provider, model, available: true, reason: '', apiKey: base.apiKey, baseURL: base.baseURL, timeoutMs: base.timeoutMs };
}
// embed(texts, {signal}) -> one vector (array of numbers) per text, in order.
export function createEmbedder(cfg, /** @type {{ client?: any }} */ { client } = {}) {
  if (!cfg.available) throw new GatewayError('unavailable', cfg.reason || 'No embedding provider configured', 503);
  const check = texts => {
    if (!Array.isArray(texts) || !texts.length || texts.some(t => typeof t !== 'string')) throw new GatewayError('bad_request', 'Expected a list of strings', 400);
    if (texts.length > EMBED_LIMITS.texts || texts.some(t => t.length > EMBED_LIMITS.chars)) throw new GatewayError('prompt_too_large', `At most ${EMBED_LIMITS.texts} texts of ${EMBED_LIMITS.chars} characters`, 413);
  };
  if (cfg.provider === 'mock') {
    // Deterministic 8-dimensional vectors from character codes, for tests.
    return { async embed(texts) { check(texts); return texts.map(t => Array.from({ length: 8 }, (_, k) => [...t].reduce((a, ch, i) => a + (i % 8 === k ? ch.charCodeAt(0) : 0), 0) / 1000)); } };
  }
  const baseURL = cfg.provider === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
  const c = client ?? new OpenAI({ apiKey: cfg.apiKey, baseURL, timeout: cfg.timeoutMs });
  return {
    async embed(texts, /** @type {{ signal?: AbortSignal }} */ { signal } = {}) {
      check(texts);
      // A plain POST: the SDK's embeddings.create() asks for base64 by default, which the
      // OpenAI-compatible servers (Mistral, Ollama) may not support.
      const res = await c.post('/embeddings', { body: { model: cfg.model, input: texts }, signal });
      const data = [...(res?.data || [])].sort((a, b) => a.index - b.index);
      if (data.length !== texts.length || data.some(d => !Array.isArray(d.embedding))) throw new GatewayError('provider_error', 'The embedding provider returned an unexpected response', 502);
      return data.map(d => d.embedding);
    },
  };
}

// Maps SDK and network errors to the codes the page understands (see coachError in index.html).
export function toGatewayError(e, signal) {
  if (e instanceof GatewayError) return e;
  if (signal?.aborted || e?.name === 'AbortError' || e instanceof Anthropic.APIUserAbortError || e instanceof OpenAI.APIUserAbortError) {
    return new GatewayError('cancelled', 'Cancelled', 499);
  }
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof OpenAI.APIConnectionTimeoutError) return new GatewayError('timeout', 'The AI provider timed out', 504);
  switch (e?.status) {
    case 429: return new GatewayError('rate_limited', 'The AI provider is rate limiting requests', 429);
    // 401 is a bad key; 403 can also mean the plan doesn't include the model (Mistral does this).
    case 401: case 403: return new GatewayError('auth_failed', 'The AI provider refused the request; check the API key and that your plan includes the model', 502);
    case 404: return new GatewayError('model_not_found', 'The AI provider does not know this model', 502);
    case 413: return new GatewayError('prompt_too_large', 'The request is too large for the model', 413);
  }
  return new GatewayError('provider_error', 'The AI provider returned an error', 502);
}

// Sliding one-minute window, shared by all clients of this (single-user, local) server.
export function rateLimiter(perMinute, now = () => Date.now()) {
  const hits = [];
  return () => {
    const t = now();
    while (hits.length && t - hits[0] >= 60_000) hits.shift();
    if (hits.length >= perMinute) return false;
    hits.push(t);
    return true;
  };
}
