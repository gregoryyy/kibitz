// AI gateway core: settings, provider adapters and request validation.
// Server-side only. API keys come from process.env (loaded from .env) and never leave this process.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { exampleFor, providerSchema } from './schema.mjs';
import { TOOLS, CAPS as TOOL_CAPS } from '../src/coach/tools.js';
import { toolsUnsupported } from '../src/coach/coach-tools.js';
import { normaliseVector } from '../src/library/dense-search.js';
import { providerOperation, ProviderLimitError, PROVIDER_LIMITS } from './provider-limits.mjs';

const SDK_LOGGER = Object.freeze({ debug() {}, info() {}, warn() {}, error() {} });

export const PROVIDERS = ['anthropic', 'openai', 'mistral', 'ollama', 'browser', 'mock'];
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

// Providers that keep everything on this machine. "browser" is the in-browser model (TODO 2.16):
// the page runs it itself; the gateway only tells the page where its weights are.
export const LOCAL_PROVIDERS = ['ollama', 'browser', 'mock'];

// Reads the AI settings from an env object. `available` is false (with a `reason`) when the
// chosen provider can't be used, so the client can hide the coach and say why. `choices` holds
// every provider's settings (server-side only: they include the keys), so the settings UI can
// switch between the ones .env sets up; `localOnly` (AI_LOCAL_ONLY) allows only local ones.
export function loadConfig(env = process.env) {
  const active = (env.AI_PROVIDER || 'anthropic').trim().toLowerCase();
  const choices = Object.fromEntries(PROVIDERS.filter(p => p !== 'mock' || active === 'mock').map(p => [p, providerConfig(env, p)]));
  return applyLocalOnly({ ...providerConfig(env, active), choices, localOnly: /^(1|true|yes|on)$/i.test(env.AI_LOCAL_ONLY || '') });
}

// In local-only mode a cloud provider is never used: Ollama takes over if it's set up, else the
// in-browser model.
export function applyLocalOnly(cfg) {
  if (!cfg.localOnly || LOCAL_PROVIDERS.includes(cfg.provider)) return cfg;
  const local = [cfg.choices?.ollama, cfg.choices?.browser].find(c => c?.available);
  if (local) return { ...local, choices: cfg.choices, localOnly: true };
  return { ...cfg, available: false, reason: 'Local-only mode is on, and neither Ollama (OLLAMA_MODEL in .env) nor the in-browser model (`just offline`) is set up' };
}

// Settings with another configured provider active; keys and models still come from .env.
export function switchProvider(cfg, name) {
  if (!Object.hasOwn(cfg.choices || {}, name)) throw new GatewayError('bad_request', `Unknown provider "${name}"`, 400);
  const next = cfg.choices[name];
  if (cfg.localOnly && !LOCAL_PROVIDERS.includes(name)) throw new GatewayError('forbidden', 'Local-only mode is on: only Ollama or the in-browser model can be used', 409);
  if (!next.available) throw new GatewayError('unavailable', next.reason, 409);
  return { ...next, choices: cfg.choices, localOnly: cfg.localOnly };
}

function providerConfig(env, provider) {
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
  const cfg = {
    provider, model: '', available: false, reason: '',
    maxTokens: num(env.AI_MAX_OUTPUT_TOKENS, 16000),
    timeoutMs: num(env.AI_TIMEOUT_MS, 60000),
    ratePerMinute: num(env.AI_RATE_LIMIT_PER_MINUTE, 20),
    userRatePerMinute: num(env.AI_RATE_LIMIT_PER_USER_PER_MINUTE, 20),
    tokensPerDay: num(env.AI_TOKEN_BUDGET_PER_DAY, 0), // 0: no budget
    userTokensPerDay: num(env.AI_TOKEN_BUDGET_PER_USER_PER_DAY, 0), // per user, paid models only (usage.mjs userLedger)
    userCostPerDay: num(env.AI_COST_BUDGET_PER_USER_PER_DAY, 0), // US dollars, per user, paid models only
    prices: env.AI_PRICES || '',
  };
  const off = reason => ({ ...cfg, reason });
  if (!PROVIDERS.includes(provider)) return off(`AI_PROVIDER "${provider}" is not one of ${PROVIDERS.join(', ')}`);
  if (provider === 'mock') return { ...cfg, model: 'mock', models: { quick: 'mock', chat: 'mock', review: 'mock' }, available: true };
  if (provider === 'browser') {
    const runtime = (env.BROWSER_RUNTIME || 'wllama').trim().toLowerCase();
    if (!['wllama', 'chrome'].includes(runtime)) return off('BROWSER_RUNTIME must be wllama or chrome');
    if (runtime === 'chrome') {
      const name = 'Chrome built-in model';
      // Browser capability and download consent are checked by the page, never by Node.
      return { ...cfg, model: name, models: { quick: name, chat: name, review: name }, available: true, browser: { runtime: 'chrome', name } };
    }
    // Set by scripts/serve.mjs --models once the model file is downloaded and checked.
    const url = env.BROWSER_MODEL_URL || '', name = env.BROWSER_MODEL_NAME || 'In-browser model';
    if (!url) return off(env.BROWSER_MODEL_REASON || 'No in-browser model yet: run `just offline` once to download it');
    return { ...cfg, model: name, models: { quick: name, chat: name, review: name }, available: true, browser: { url, name, bytes: num(env.BROWSER_MODEL_BYTES, 0) } };
  }

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
export const publicStatus = cfg => ({
  provider: cfg.provider, model: cfg.model, models: cfg.models || null, available: cfg.available, reason: cfg.reason, localOnly: !!cfg.localOnly,
  // Where the page finds the in-browser model's weights (a path on this server), when there is one.
  browser: cfg.choices?.browser?.available ? cfg.choices.browser.browser : null,
  providers: Object.values(cfg.choices || {}).map(c => ({
    name: c.provider, model: c.model, local: LOCAL_PROVIDERS.includes(c.provider),
    available: c.available && (!cfg.localOnly || LOCAL_PROVIDERS.includes(c.provider)),
    reason: c.available && cfg.localOnly && !LOCAL_PROVIDERS.includes(c.provider) ? 'Local-only mode is on' : c.reason,
  })),
});
// The model for a request's task ("chat" when none is given); unknown tasks are refused.
export function modelFor(cfg, task) {
  if (task === undefined || task === null) task = 'chat';
  if (!TASKS.includes(task)) throw new GatewayError('bad_request', `"task" must be one of ${TASKS.join(', ')}`, 400);
  return cfg.models?.[task] || cfg.model;
}

// Accepts {prompt: string} or {messages: [...]}: {role: 'user', content}, {role: 'assistant',
// content, toolCalls?: [{id, name, input}]}, and {role: 'tool', toolCallId, content} answering a
// tool call of an earlier assistant turn (TODO 4.11.3). The client can't send system messages, so
// it can't replace server-side instructions, and tool calls only name tools from the catalogue.
const CALL_ID = /^[A-Za-z0-9_-]{1,64}$/;
export function validateMessages(body) {
  const msgs = typeof body?.prompt === 'string' ? [{ role: 'user', content: body.prompt }] : body?.messages;
  if (!Array.isArray(msgs) || !msgs.length) throw new GatewayError('bad_request', 'Expected "messages" or "prompt"', 400);
  if (msgs.length > LIMITS.messages) throw new GatewayError('prompt_too_large', `At most ${LIMITS.messages} messages`, 413);
  let total = 0;
  const bad = msg => { throw new GatewayError('bad_request', msg, 400); };
  const open = new Set(); // tool calls not answered yet
  const out = msgs.map(m => {
    if (!m || !['user', 'assistant', 'tool'].includes(m.role) || typeof m.content !== 'string') bad('Each message needs role "user", "assistant" or "tool" and string content');
    total += m.content.length;
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'tool') {
      if (typeof m.toolCallId !== 'string' || !open.delete(m.toolCallId)) bad('A tool message must answer a tool call of an earlier assistant turn');
      return { role: 'tool', toolCallId: m.toolCallId, content: m.content };
    }
    if (m.toolCalls === undefined) return { role: 'assistant', content: m.content };
    if (!Array.isArray(m.toolCalls) || !m.toolCalls.length || m.toolCalls.length > TOOL_CAPS.calls) bad(`An assistant turn has 1-${TOOL_CAPS.calls} tool calls`);
    const calls = m.toolCalls.map(c => {
      if (!c || !CALL_ID.test(c.id) || !Object.hasOwn(TOOLS, c.name) || !c.input || typeof c.input !== 'object' || Array.isArray(c.input)) bad('Each tool call needs an id, a known tool name and an object input');
      const size = JSON.stringify(c.input).length;
      if (size > 2000) bad('A tool call\'s input is too large');
      total += size; open.add(c.id);
      return { id: c.id, name: c.name, input: c.input };
    });
    return { role: 'assistant', content: m.content, toolCalls: calls };
  });
  if (total > LIMITS.chars) throw new GatewayError('prompt_too_large', `At most ${LIMITS.chars} characters in total`, 413);
  if (out[0].role !== 'user' || !['user', 'tool'].includes(out.at(-1).role)) bad('The first message must come from the user, and the last from the user or a tool');
  if (open.size) bad('Every tool call needs its result before the next request');
  return out;
}
// The tools a request offers the model, by name from the catalogue (src/coach/tools.js): [{name,
// description, schema}], or null for none. The definitions are ours, never the client's.
export function validateTools(names) {
  if (names === undefined || names === null) return null;
  if (!Array.isArray(names) || names.length > Object.keys(TOOLS).length || names.some(n => typeof n !== 'string' || !Object.hasOwn(TOOLS, n))) {
    throw new GatewayError('bad_request', `"tools" must name tools from: ${Object.keys(TOOLS).join(', ')}`, 400);
  }
  return [...new Set(names)].map(name => ({ name, ...TOOLS[name] }));
}

// A provider exposes chat(messages, opts): an async generator that yields text chunks and
// returns {truncated, usage: {input, output}, toolCalls} (token counts, 0 when the provider doesn't
// say; toolCalls: [{id, name, input}] when the model called tools, else empty).
//   opts: {model, system, maxTokens, schema, tools, signal}; model and maxTokens default to the configuration.
//   schema: a format from schema.mjs ({name, schema}); the provider is asked for JSON matching it.
//   tools: from validateTools; the model may call them instead of (or after) writing text.
// complete() below collects a whole reply. `client` can be injected for tests.
export function createProvider(cfg, /** @type {{ client?: any }} */ { client } = {}) {
  if (['anthropic', 'openai', 'mistral', 'ollama'].includes(cfg.provider)) return {
    async *chat(messages, /** @type {ChatOptions} */ opts = {}) {
      const operation = providerOperation(cfg.timeoutMs, opts.signal);
      try {
        const baseURL = cfg.provider === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
        const options = { apiKey: cfg.apiKey, baseURL, timeout: operation.timeoutMs, fetch: operation.fetch, maxRetries: 0, logger: SDK_LOGGER };
        const sdk = client ?? (cfg.provider === 'anthropic' ? new Anthropic(options) : new OpenAI(options));
        const provider = cfg.provider === 'anthropic' ? anthropicProvider(cfg, sdk) : openAICompatProvider(cfg, sdk);
        return yield* operation.read(provider.chat(messages, { ...opts, signal: operation.signal }));
      } catch (error) { throw operation.error || error; }
      finally { operation.close(); }
    },
  };
  switch (cfg.provider) {
    case 'mock': return mockProvider();
    case 'browser': return {
      // eslint-disable-next-line require-yield -- never yields: the page runs this model itself
      async *chat() { throw new GatewayError('in_browser', 'The in-browser model runs in the page, not on the server', 409); },
    };
    default: throw new GatewayError('unavailable', `Unknown provider ${cfg.provider}`, 503);
  }
}

/** @typedef {{ model?: string, system?: string, maxTokens?: number, schema?: { name: string, schema: object }, tools?: { name: string, description: string, schema: object }[] | null, signal?: AbortSignal, serverFallback?: boolean }} ChatOptions */

// Messages in Anthropic's shape: tool calls are tool_use blocks of the assistant turn, and the
// results of one turn's calls go back together as tool_result blocks of one user turn.
export function anthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const block = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const prev = out.at(-1);
      if (prev?.role === 'user' && Array.isArray(prev.content) && prev.content.every(b => b.type === 'tool_result')) prev.content.push(block);
      else out.push({ role: 'user', content: [block] });
    } else if (m.role === 'assistant' && m.toolCalls) {
      out.push({ role: 'assistant', content: [...(m.content ? [{ type: 'text', text: m.content }] : []), ...m.toolCalls.map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input }))] });
    } else out.push({ role: m.role, content: m.content });
  }
  return out;
}
// ... and in the chat-completions shape (OpenAI, Mistral, Ollama).
export function openAIMessages(messages) {
  return messages.map(m => m.role === 'tool' ? { role: 'tool', tool_call_id: m.toolCallId, content: m.content }
    : m.role === 'assistant' && m.toolCalls ? { role: 'assistant', content: m.content || null, tool_calls: m.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } })) }
    : { role: m.role, content: m.content });
}
// A tool call's arguments as the model wrote them; unreadable JSON becomes {} (the page then
// answers the call with an error the model can read).
const parseArgs = s => { try { const v = JSON.parse(s || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };

function anthropicProvider(cfg, client) {
  return {
    async *chat(messages, /** @type {ChatOptions} */ { model = cfg.model, system, maxTokens = cfg.maxTokens, schema, tools, signal, serverFallback = true } = {}) {
      const output = { ...(cfg.effort ? { effort: cfg.effort } : {}), ...(schema ? { format: { type: 'json_schema', schema: providerSchema(schema.schema) } } : {}) };
      const stream = client.beta.messages.stream({
        model,
        max_tokens: maxTokens,
        messages: anthropicMessages(messages),
        ...(system ? { system } : {}),
        ...(tools?.length ? { tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.schema })) } : {}),
        ...(Object.keys(output).length ? { output_config: output } : {}),
        // On a safety decline, re-run on Anthropic's recommended fallback model instead of failing.
        // Haiku models have no server-side fallback, so the option is left off for them.
        ...(!serverFallback || model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      }, { signal });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
      }
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new GatewayError('refused', 'The model declined to answer', 200);
      const u = msg.usage || {};
      const toolCalls = (msg.content || []).filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input && typeof b.input === 'object' ? b.input : {} }));
      return { truncated: msg.stop_reason === 'max_tokens', toolCalls, usage: { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), output: u.output_tokens || 0 } };
    },
  };
}

// OpenAI, Mistral and Ollama all serve the OpenAI chat-completions protocol.
// Token usage: OpenAI and Ollama report it in a last chunk when asked (stream_options);
// Mistral sends it with the final chunk on its own.
function openAICompatProvider(cfg, client) {
  const tokenParam = cfg.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens';
  return {
    async *chat(messages, /** @type {ChatOptions} */ { model = cfg.model, system, maxTokens = cfg.maxTokens, schema, tools, signal } = {}) {
      const msgs = openAIMessages(messages);
      const params = {
        model, stream: true, [tokenParam]: maxTokens,
        messages: system ? [{ role: 'system', content: system }, ...msgs] : msgs,
        ...(tools?.length ? { tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } })) } : {}),
        ...(cfg.provider === 'mistral' ? {} : { stream_options: { include_usage: true } }),
        ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: schema.name, schema: providerSchema(schema.schema), strict: true } } } : {}),
      };
      const stream = await client.chat.completions.create(params, { signal });
      let finish = null, usage = null;
      const calls = []; // tool calls arrive in pieces, by index: id and name first, then the arguments
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const text = deltaText(choice?.delta?.content);
        if (text) yield text;
        for (const d of choice?.delta?.tool_calls || []) {
          const c = calls[d.index ?? calls.length] ??= { id: '', name: '', args: '' };
          if (d.id) c.id = d.id;
          if (d.function?.name) c.name += d.function.name;
          if (d.function?.arguments) c.args += d.function.arguments;
        }
        if (choice?.finish_reason) finish = choice.finish_reason;
        if (chunk.usage) usage = chunk.usage;
      }
      if (finish === 'content_filter') throw new GatewayError('refused', 'The model declined to answer', 200);
      const toolCalls = calls.filter(c => c?.name).map((c, k) => ({ id: c.id || `call_${k}`, name: c.name, input: parseArgs(c.args) }));
      return { truncated: finish === 'length', toolCalls, usage: { input: usage?.prompt_tokens || 0, output: usage?.completion_tokens || 0 } };
    },
  };
}
// Some Mistral models stream content as an array of typed parts; keep only the text.
const deltaText = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(p => p?.type === 'text').map(p => p.text).join('') : '';

// Offline stand-in for development and tests (AI_PROVIDER=mock).
// Token counts are rough (four characters a token) but deterministic.
// Tools, for tests, when a user message asks: "[mock:tool]" calls `analyse` on the FEN in the
// messages (or the first tool offered) once, then answers with what the tool said; "[mock:loop]"
// calls tools forever; "[mock:bad-tool]" calls one with arguments that don't hold up. Otherwise it
// answers directly, as a model that needs no tool would.
function mockProvider() {
  return {
    async *chat(messages, /** @type {ChatOptions} */ { schema, tools } = {}) {
      const chars = messages.reduce((n, m) => n + m.content.length, 0);
      const asked = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      const results = messages.filter(m => m.role === 'tool');
      const wants = /\[mock:(tool|loop|bad-tool)\]/.test(asked);
      const action = [...asked.matchAll(/\[mock:action:(\w+)\s+(\{[^\n]*\})\]/g)].at(-1);
      if (tools?.some(t => t.name === action?.[1]) && !results.length) {
        return { truncated: false, toolCalls: [{ id: 'action1', name: action[1], input: parseArgs(action[2]) }], usage: { input: Math.ceil(chars / 4), output: 20 } };
      }
      if (tools?.length && wants && tools.some(t => t.name === 'analyse') && (!results.length || asked.includes('[mock:loop]'))) {
        const fen = /Current position \(FEN\): (\S+ [wb] \S+ \S+ \d+ \d+)/.exec(asked)?.[1] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const name = tools.some(t => t.name === 'analyse') ? 'analyse' : tools[0].name;
        const input = asked.includes('[mock:bad-tool]') ? { fen: 'not a fen', depth: 99 } : { fen };
        return { truncated: false, toolCalls: [{ id: `mock${results.length + 1}`, name, input }], usage: { input: Math.ceil(chars / 4), output: 20 } };
      }
      const last = results.at(-1)?.content;
      const reply = schema ? JSON.stringify(exampleFor(schema.schema))
        : last !== undefined ? `Mock coach used a tool and read: ${last.slice(0, 160)}`
        : `Mock coach (AI_PROVIDER=mock). Your message had ${messages.at(-1).content.length} characters; set a real provider in .env for actual coaching.`;
      for (const word of reply.split(/(?<= )/)) yield word;
      return { truncated: false, toolCalls: [], usage: { input: Math.ceil(chars / 4), output: Math.ceil(reply.length / 4) } };
    },
  };
}

// The whole reply at once: {text, truncated, usage, toolCalls}.
export async function complete(provider, messages, opts = {}) {
  const it = provider.chat(messages, opts);
  let text = '', r;
  while (!(r = await it.next()).done) text += r.value;
  return { text, truncated: !!r.value?.truncated, usage: r.value?.usage || { input: 0, output: 0 }, toolCalls: r.value?.toolCalls || [] };
}

// ---------------------------------------------------------------- Embeddings (for RAG, TODO 8.3)
// Anthropic has no embeddings API, so EMBEDDING_PROVIDER is openai, mistral or ollama. The key,
// base URL and Ollama host allowlist are the chat provider's settings for that name.
export const EMBEDDING_PROVIDERS = ['openai', 'mistral', 'ollama', 'mock'];
const EMBEDDING_DEFAULTS = { openai: 'text-embedding-3-small', mistral: 'mistral-embed', ollama: '' };
export const EMBED_LIMITS = { texts: 128, chars: 8000 };
export function loadEmbeddingConfig(env = process.env) {
  const provider = (env.EMBEDDING_PROVIDER || 'ollama').trim().toLowerCase();
  const revision = (env.EMBEDDING_REVISION || '').trim().slice(0, 160);
  const off = reason => ({ provider, model: '', revision, available: false, reason });
  if (!EMBEDDING_PROVIDERS.includes(provider)) return off(`EMBEDDING_PROVIDER "${provider}" is not one of ${EMBEDDING_PROVIDERS.join(', ')}`);
  if (provider === 'mock') return { provider, model: 'mock', revision, available: true, reason: '' };
  // Read this provider's actual credentials/endpoint; runtime local-only policy is enforced
  // by the embedding route, without silently substituting the chat provider's local client.
  const base = /** @type {any} */ (loadConfig({ ...env, AI_PROVIDER: provider, AI_LOCAL_ONLY: '', [`${provider.toUpperCase()}_MODEL`]: 'embeddings' }));
  const model = env.EMBEDDING_MODEL || EMBEDDING_DEFAULTS[provider];
  if (!model) return off('EMBEDDING_MODEL is empty; for Ollama, set it to an embedding model you have pulled (e.g. nomic-embed-text)');
  if (!base.available) return off(base.reason);
  return { provider, model, revision, available: true, reason: '', apiKey: base.apiKey, baseURL: base.baseURL, timeoutMs: base.timeoutMs };
}
// embed(texts, {signal}) -> one vector (array of numbers) per text, in order.
export function createEmbedder(cfg, /** @type {{ client?: any, inspectModel?: (model: string, signal?: AbortSignal) => Promise<any> }} */ { client, inspectModel } = {}) {
  if (!cfg.available) throw new GatewayError('unavailable', cfg.reason || 'No embedding provider configured', 503);
  const check = texts => {
    if (!Array.isArray(texts) || !texts.length || texts.some(t => typeof t !== 'string' || !t.trim())) throw new GatewayError('bad_request', 'Expected non-empty text strings', 400);
    if (texts.length > EMBED_LIMITS.texts || texts.some(t => t.length > EMBED_LIMITS.chars)) throw new GatewayError('prompt_too_large', `At most ${EMBED_LIMITS.texts} texts of ${EMBED_LIMITS.chars} characters`, 413);
  };
  const baseURL = cfg.provider === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
  // Ollama can relay cloud models too. Its provider label alone is not proof of local inference.
  // Inspect only model metadata before sending text; old/unknown metadata fails closed.
  /** Ordered finite vectors plus observed model/usage; absent usage gets a conservative byte estimate. */
  async function embedBatch(texts, /** @type {{signal?: AbortSignal}} */ { signal } = {}) {
    check(texts);
    if (cfg.provider === 'mock') return { vectors: texts.map(t => Array.from({ length: 8 }, (_, k) => [...t].reduce((a, ch, i) => a + (i % 8 === k ? ch.charCodeAt(0) : 0), 0) / 1000)), providerModel: 'mock', usage: { input: texts.reduce((s, t) => s + t.length, 0), output: 0, estimated: true } };
    const operation = providerOperation(cfg.timeoutMs, signal, { maxDecodedBytes: PROVIDER_LIMITS.bytes });
    try {
      if (cfg.provider === 'ollama') {
        const info = await operation.wait(async () => {
          if (inspectModel) return inspectModel(cfg.model, operation.signal);
          const r = await operation.fetch(cfg.baseURL.replace(/\/+$/, '') + '/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.model }) });
          if (!r.ok) throw new GatewayError('provider_error', 'Could not verify a local Ollama embedding model', 502);
          return r.json();
        });
        if (info?.remote_model || info?.remote_host || !['gguf', 'safetensors'].includes(info?.details?.format) || !info?.model_info?.['general.architecture'] || !info?.capabilities?.includes('embedding')) throw new GatewayError('forbidden', 'Ollama embeddings require a verified local embedding model', 409);
      }
      const c = client ?? new OpenAI({ apiKey: cfg.apiKey, baseURL, timeout: operation.timeoutMs, fetch: operation.fetch, maxRetries: 0, logger: SDK_LOGGER });
      const res = await operation.wait(() => c.post('/embeddings', { body: { model: cfg.model, input: texts, encoding_format: 'float' }, signal: operation.signal }));
      operation.count(res);
      const data = Array.isArray(res?.data) ? [...res.data].sort((a, b) => a?.index - b?.index) : [];
      if (data.length !== texts.length || data.some((d, i) => d?.index !== i)) throw new GatewayError('provider_error', 'The embedding provider returned invalid input indices', 502);
      try { const dimensions = data[0]?.embedding?.length; data.forEach(d => normaliseVector(d.embedding, dimensions)); }
      catch { throw new GatewayError('provider_error', 'The embedding provider returned invalid vectors', 502); }
      const tokens = res.usage?.prompt_tokens ?? res.usage?.total_tokens;
      if (tokens !== undefined && (!Number.isSafeInteger(tokens) || tokens < 0)) throw new GatewayError('provider_error', 'The embedding provider returned invalid usage', 502);
      return { vectors: data.map(d => d.embedding), providerModel: typeof res.model === 'string' ? res.model.slice(0, 200) : null,
        usage: { input: tokens ?? texts.reduce((s, t) => s + Buffer.byteLength(t, 'utf8') + 1, 0), output: 0, estimated: tokens === undefined } };
    } catch (error) { throw operation.error || error; }
    finally { operation.close(); }
  }
  return {
    embedBatch,
    async embed(texts, options = {}) { return (await embedBatch(texts, options)).vectors; },
  };
}

// Classify provider prose into fixed public hints. Prefix/length redaction cannot protect
// arbitrary credentials, endpoints or reflected user text. Never return a substring of the input.
export function providerReason(e) {
  const m = e?.error?.message || e?.error?.error?.message || e?.message || '';
  const text = typeof m === 'string' ? m.slice(0, 8192) : '';
  if (toolsUnsupported({ code: 'provider_rejected', message: text })) return 'This model does not support tools.';
  if (/\b(?:does not|doesn't|cannot|can't)\s+support\s+chat\b/i.test(text)) return 'This model does not support chat.';
  if (/\b(?:response_format|json_schema|structured output)\b.{0,40}\b(?:not supported|unsupported)\b/i.test(text)) return 'This model does not support the requested JSON format.';
  if (/\binvalid\s+(?:response\s+)?schema\b/i.test(text)) return 'The provider rejected the response schema.';
  if (/\b(?:context length|context window|maximum context)\b/i.test(text)) return 'The request exceeds the model context limit.';
  return '';
}

// Maps SDK and network errors to the codes the page understands (see coachError in index.html).
export function toGatewayError(e, signal) {
  if (e instanceof GatewayError) return e;
  if (e instanceof ProviderLimitError) return new GatewayError(e.code, e.message, e.status);
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
    case 400: return new GatewayError('provider_rejected', providerReason(e) || 'The AI provider rejected the request. Check the selected model and request settings.', 502);
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
