// Operator-only capture: HTTP bytes are test data, never code or filenames.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { complete, createProvider } from '../server/ai.mjs';
import { FORMATS, parseJsonReply, validate } from '../server/schema.mjs';

export const FILES = Object.freeze({
  anthropic: { chat: 'anthropic-chat.json', json: 'anthropic-json.json' },
  openai: { chat: 'openai-chat.json', json: 'openai-json.json' },
  mistral: { chat: 'mistral-chat.json', json: 'mistral-json.json' },
  ollama: { chat: 'ollama-chat.json', json: 'ollama-json.json' },
});
export const CASES = {
  chat: { system: 'You are a chess coach. Answer in one short sentence.', messages: [{ role: 'user', content: 'Name one principle for the opening.' }], maxTokens: 400 },
  json: { messages: [{ role: 'user', content: 'Position after 1. e4 e5 2. Nf3, Black to move. Point out the attacked pawn and the best defence as board annotations.' }], maxTokens: 1500, schema: FORMATS.annotations },
};
export class CaptureError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new CaptureError(code); };
export function fixtureName(provider, label) {
  if (!Object.hasOwn(FILES, provider) || !Object.hasOwn(FILES[provider], label)) fail('invalid_selection');
  return FILES[provider][label];
}
// Exact known values and common encodings only. Unknown/private fields still need review.
export function checkSecrets(text, secrets) {
  for (const key of secrets.filter(s => typeof s === 'string' && s.length)) {
    for (const value of [key, JSON.stringify(key).slice(1, -1), encodeURIComponent(key)]) {
      if (text.includes(value)) fail('credential_in_capture');
    }
  }
}
/** One total deadline covers headers, body and SDK parsing.
 * @param {any} cfg
 * @param {string} label
 * @param {{fetcher?: typeof fetch, secrets?: string[], timeoutMs?: number, maxBytes?: number}} options
 */
export async function recordFixture(cfg, label, { fetcher = fetch, secrets = [], timeoutMs = Math.min(cfg.timeoutMs, 300_000), maxBytes = 1_048_576 } = {}) {
  fixtureName(cfg.provider, label);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000 || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1_048_576) fail('invalid_limits');
  secrets = [...secrets, ...(cfg.provider === 'ollama' ? [] : [cfg.apiKey])];
  checkSecrets(JSON.stringify({ model: cfg.model }), secrets);
  const controller = new AbortController();
  let saved, failure, attempts = 0, reader, timer;
  const abort = () => { void reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', abort);
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => { failure = new CaptureError('capture_timeout'); controller.abort(); reject(failure); }, timeoutMs);
  });
  const recordingFetch = async (url, init) => {
    try {
      controller.signal.throwIfAborted();
      if (++attempts > 1) fail('extra_request');
      const res = await fetcher(url, { ...init, signal: controller.signal, redirect: 'error' });
      const contentType = res.headers.get('content-type') || '';
      if (res.status !== 200 || contentType.split(';')[0].trim().toLowerCase() !== 'text/event-stream' || !res.body) {
        void res.body?.cancel().catch(() => {}); fail('invalid_http_response');
      }
      reader = res.body.getReader();
      let size = 0;
      const chunks = [];
      for (;;) {
        controller.signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) fail('response_too_large');
        chunks.push(value);
      }
      controller.signal.throwIfAborted();
      const body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
      checkSecrets(body, secrets);
      // The SDK can accept EOF without a stop chunk. A fixture must contain the protocol terminator.
      const data = body.replace(/\r\n?/g, '\n').split('\n\n').map(frame => frame.split('\n')
        .filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n'));
      const events = data.filter(s => s && s !== '[DONE]').map(s => JSON.parse(s));
      if (cfg.provider === 'anthropic' ? !events.some(e => e.type === 'message_stop') :
        !data.includes('[DONE]') || !events.some(e => e.choices?.[0]?.finish_reason === 'stop')) fail('incomplete_stream');
      const day = new Date().toISOString().slice(0, 10);
      saved = { provider: cfg.provider, case: label, model: cfg.model, recorded: day,
        source: `recorded with scripts/record-ai-fixtures.mjs on ${day}`, status: 200, contentType, body };
      checkSecrets(JSON.stringify(saved), secrets);
      return new Response(body, { status: 200, headers: { 'content-type': contentType } });
    } catch (error) { failure ||= error instanceof CaptureError ? error : new CaptureError('capture_failed'); throw failure; }
    finally { void reader?.cancel().catch(() => {}); }
  };
  try {
    const baseURL = cfg.provider === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
    // null means console in both SDKs. Explicit sinks also override inherited SDK debug settings.
    const options = { apiKey: cfg.apiKey, baseURL, fetch: recordingFetch, maxRetries: 0, timeout: timeoutMs,
      logger: { debug() {}, info() {}, warn() {}, error() {} } };
    const client = cfg.provider === 'anthropic' ? new Anthropic(options) : new OpenAI(options);
    const run = complete(createProvider(cfg, { client }), CASES[label].messages, { ...CASES[label], serverFallback: false, signal: controller.signal });
    const result = await Promise.race([run, deadline]);
    controller.signal.throwIfAborted();
    if (!saved || attempts !== 1 || !result.text.trim() || result.truncated || result.toolCalls?.length) fail('invalid_completion');
    checkSecrets(result.text, secrets); // A key may span separate SSE delta events.
    if (label === 'json' && validate(FORMATS.annotations.schema, parseJsonReply(result.text)).length) fail('invalid_annotations');
    return saved;
  } catch (error) { throw failure || (error instanceof CaptureError ? error : new CaptureError('provider_failed')); }
  finally { clearTimeout(timer); controller.abort(); controller.signal.removeEventListener('abort', abort); }
}
// Atomic replacement does not open an existing destination symlink. Directory writers are trusted.
export async function publishFixture(dir, saved) {
  const file = path.join(dir, fixtureName(saved.provider, saved.case));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const temporary = path.join(dir, `.fixture-${randomUUID()}.part`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify(saved, null, 2) + '\n');
    await handle.close(); handle = null;
    await fs.rename(temporary, file);
  } finally { await handle?.close().catch(() => {}); await fs.rm(temporary, { force: true }); }
  return file;
}
