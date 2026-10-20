// Records real provider responses as fixtures for the contract tests (TODO 2.15).
//   node scripts/record-ai-fixtures.mjs <provider...> [--env ../.env]
// Sends two tiny requests per provider (a short chat reply and board annotations as JSON) with the
// keys from .env, and saves each HTTP response's status, content type and body to
// server/fixtures/<provider>-<case>.json. Response headers are not kept (they can carry account
// ids), and neither is the request (it carries the key). Costs a few hundred tokens per provider.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { complete, createProvider, loadConfig } from '../server/ai.mjs';
import { FORMATS } from '../server/schema.mjs';

const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { env: { type: 'string', default: '../.env' } } });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.resolve(root, opt.env)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (!positionals.length) { console.error('usage: record-ai-fixtures.mjs <anthropic|openai|mistral|ollama ...>'); process.exit(2); }

const CASES = {
  chat: { system: 'You are a chess coach. Answer in one short sentence.', messages: [{ role: 'user', content: 'Name one principle for the opening.' }], maxTokens: 400 },
  json: { messages: [{ role: 'user', content: 'Position after 1. e4 e5 2. Nf3, Black to move. Point out the attacked pawn and the best defence as board annotations.' }], maxTokens: 1500, schema: FORMATS.annotations },
};

for (const name of positionals) {
  const cfg = loadConfig({ ...process.env, AI_PROVIDER: name });
  if (!cfg.available) { console.error(`${name}: skipped (${cfg.reason})`); continue; }
  for (const [label, c] of Object.entries(CASES)) {
    let saved = null;
    const recordingFetch = async (url, init) => {
      const res = await fetch(url, init);
      const body = await res.text();
      const day = new Date().toISOString().slice(0, 10);
      saved = { provider: name, case: label, model: cfg.model, recorded: day, source: `recorded with scripts/record-ai-fixtures.mjs on ${day}`, status: res.status, contentType: res.headers.get('content-type') || '', body };
      return new Response(body, { status: res.status, headers: { 'content-type': saved.contentType } });
    };
    const baseURL = name === 'ollama' ? cfg.baseURL.replace(/\/+$/, '') + '/v1' : cfg.baseURL;
    const client = name === 'anthropic' ? new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL, fetch: recordingFetch, maxRetries: 0 })
      : new OpenAI({ apiKey: cfg.apiKey, baseURL, fetch: recordingFetch, maxRetries: 0 });
    let outcome;
    try { const r = await complete(createProvider(cfg, { client }), c.messages, c); outcome = `${r.text.length} chars, usage ${JSON.stringify(r.usage)}`; }
    catch (e) { outcome = `error ${e.status ?? ''} ${e.code ?? ''}`.trim(); }
    if (!saved) { console.error(`${name}/${label}: no response recorded (${outcome})`); continue; }
    const file = path.join(root, 'server/fixtures', `${name}-${label}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(saved, null, 2) + '\n');
    console.log(`${name}/${label}: HTTP ${saved.status}, ${outcome} -> ${path.relative(root, file)}`);
  }
}
