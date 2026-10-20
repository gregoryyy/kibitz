// Live smoke tests against real providers (TODO 2.15). They spend a few hundred tokens each, so
// they only run with KIBITZ_LIVE_AI=1, using the keys in ../.env:
//   KIBITZ_LIVE_AI=1 npm run test:live                         (the provider in AI_PROVIDER)
//   KIBITZ_LIVE_AI=1 KIBITZ_LIVE_PROVIDERS=anthropic,ollama npm run test:live
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complete, createProvider, loadConfig } from './ai.mjs';
import { ANNOTATION_SCHEMA, completeJson, FORMATS, validate } from './schema.mjs';

const live = process.env.KIBITZ_LIVE_AI === '1';
if (live) { try { process.loadEnvFile(new URL('../../.env', import.meta.url)); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
const names = live ? (process.env.KIBITZ_LIVE_PROVIDERS || process.env.AI_PROVIDER || 'anthropic').split(',').map(s => s.trim()) : ['(set KIBITZ_LIVE_AI=1)'];

for (const name of names) {
  test(`live ${name}: a short chat reply and valid board annotations`, { skip: !live && 'KIBITZ_LIVE_AI is not 1' }, async () => {
    const cfg = loadConfig({ ...process.env, AI_PROVIDER: name });
    assert.ok(cfg.available, cfg.reason);
    const p = createProvider(cfg);
    const chat = await complete(p, [{ role: 'user', content: 'Name one principle for the opening, in one sentence.' }], { maxTokens: 400 });
    assert.ok(chat.text.trim().length > 10, 'some text');
    const json = await completeJson(p, [{ role: 'user', content: 'After 1. e4 e5 2. Nf3, annotate the attacked pawn and the best defence.' }], FORMATS.annotations, { maxTokens: 1500 });
    assert.deepEqual(validate(ANNOTATION_SCHEMA, json.data), []);
  });
}
