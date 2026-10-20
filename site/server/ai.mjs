// AI gateway core: settings, provider adapters and request validation.
// Server-side only. API keys come from process.env (loaded from .env) and never leave this process.
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const PROVIDERS = ['anthropic', 'openai', 'mistral', 'ollama', 'mock'];
// Small, fast models by default: coaching replies are short and grounded in engine output.
const DEFAULTS = {
  anthropic: { model: 'claude-haiku-5-5' },
  openai: { model: 'gpt-6-luna', baseURL: 'https://api.openai.com/v1' },
  mistral: { model: 'mistral-small-latest', baseURL: 'https://api.mistral.ai/v1' },
  ollama: { model: '', baseURL: 'http://127.0.0.1:11434' },
};
export const LIMITS = { messages: 40, chars: 200_000 };

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
  if (provider === 'mock') return { ...cfg, model: 'mock', available: true };

  const P = provider.toUpperCase();
  cfg.model = env[`${P}_MODEL`] || DEFAULTS[provider].model;
  cfg.baseURL = env[`${P}_BASE_URL`] || DEFAULTS[provider].baseURL;
  if (!cfg.model) return off(provider === 'ollama' ? 'OLLAMA_MODEL is empty; set it to a model from `ollama list`' : `${P}_MODEL is empty`);
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
export const publicStatus = cfg => ({ provider: cfg.provider, model: cfg.model, available: cfg.available, reason: cfg.reason });

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

// A provider exposes stream(messages, {signal}): an async generator that yields text chunks
// and returns {truncated}. `client` can be injected for tests.
export function createProvider(cfg, { client } = {}) {
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

function anthropicProvider(cfg, client) {
  return {
    async *stream(messages, { signal } = {}) {
      const stream = client.beta.messages.stream({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        messages,
        ...(cfg.effort ? { output_config: { effort: cfg.effort } } : {}),
        // On a safety decline, re-run on Anthropic's recommended fallback model instead of failing.
        // Haiku models have no server-side fallback, so the option is left off for them.
        ...(cfg.model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
      }, { signal });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield ev.delta.text;
      }
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new GatewayError('refused', 'The model declined to answer', 200);
      return { truncated: msg.stop_reason === 'max_tokens' };
    },
  };
}

// OpenAI, Mistral and Ollama all serve the OpenAI chat-completions protocol.
function openAICompatProvider(cfg, client) {
  const tokenParam = cfg.provider === 'openai' ? 'max_completion_tokens' : 'max_tokens';
  return {
    async *stream(messages, { signal } = {}) {
      const stream = await client.chat.completions.create({ model: cfg.model, messages, stream: true, [tokenParam]: cfg.maxTokens }, { signal });
      let finish = null;
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        const text = deltaText(choice?.delta?.content);
        if (text) yield text;
        if (choice?.finish_reason) finish = choice.finish_reason;
      }
      if (finish === 'content_filter') throw new GatewayError('refused', 'The model declined to answer', 200);
      return { truncated: finish === 'length' };
    },
  };
}
// Some Mistral models stream content as an array of typed parts; keep only the text.
const deltaText = c => typeof c === 'string' ? c : Array.isArray(c) ? c.filter(p => p?.type === 'text').map(p => p.text).join('') : '';

// Offline stand-in for development and tests (AI_PROVIDER=mock).
function mockProvider() {
  return {
    async *stream(messages) {
      const reply = `Mock coach (AI_PROVIDER=mock). Your message had ${messages.at(-1).content.length} characters; set a real provider in .env for actual coaching.`;
      for (const word of reply.split(/(?<= )/)) yield word;
      return { truncated: false };
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
