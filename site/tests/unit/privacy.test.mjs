import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConsentStore, createPrivacyGate, providerConsentHeader, PRIVACY_KEY } from '../../src/platform/privacy.js';
function memory() { const data = new Map(); let blocked = false; return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (blocked) throw Error('quota'); data.set(k, v); }, block: v => { blocked = v; } }; }

test('network provider choices start off, remain purpose-specific and publish only acknowledged grants', () => {
  const storage = memory(), store = createConsentStore(storage);
  for (const provider of ['anthropic', 'openai', 'mistral', 'ollama']) for (const purpose of ['coach', 'embeddings']) assert.equal(store.allowed(provider, purpose), false);
  assert.ok(store.allowed('mock', 'coach')); assert.ok(store.allowed('browser', 'coach'));
  storage.block(true); assert.equal(store.set('openai', 'coach', true), 'storage'); assert.equal(store.allowed('openai', 'coach'), false);
  storage.block(false); assert.equal(store.set('openai', 'coach', true), null); assert.ok(store.allowed('openai', 'coach')); assert.equal(store.allowed('openai', 'embeddings'), false);
  assert.ok(createConsentStore(storage).allowed('openai', 'coach'));
  assert.equal(store.set('fake', 'coach', true), 'invalid'); assert.equal(providerConsentHeader('openai', 'coach'), 'v1:openai:coach');
  assert.equal(providerConsentHeader('mock', 'embeddings'), null); assert.throws(() => providerConsentHeader('fake', 'coach'));
});

test('failed revocation still stops this tab, without claiming the persisted grant was removed', () => {
  const storage = memory(), store = createConsentStore(storage); store.set('anthropic', 'coach', true);
  const raw = storage.data.get(PRIVACY_KEY); storage.block(true);
  assert.equal(store.set('anthropic', 'coach', false), 'storage'); assert.equal(store.allowed('anthropic', 'coach'), false);
  store.reload(); assert.equal(store.allowed('anthropic', 'coach'), false); assert.equal(storage.data.get(PRIVACY_KEY), raw);
  assert.equal(createConsentStore(storage).allowed('anthropic', 'coach'), true, 'failure must warn about other tabs/reloads');
  storage.block(false); assert.equal(store.set('anthropic', 'coach', false), null); assert.equal(createConsentStore(storage).allowed('anthropic', 'coach'), false);
});

test('stale sequential-tab changes cannot restore another tab\'s revoked grant', () => {
  const storage = memory(), a = createConsentStore(storage), b = createConsentStore(storage);
  a.set('openai', 'coach', true); assert.equal(b.set('mistral', 'coach', true), 'conflict');
  assert.equal(b.set('mistral', 'coach', true), null); a.reload(); assert.ok(a.allowed('mistral', 'coach'));
  b.set('openai', 'coach', false); assert.equal(a.set('anthropic', 'coach', true), 'conflict'); assert.equal(a.allowed('openai', 'coach'), false);
});

test('malformed/future consent remains untouched and grants no network permission', () => {
  const storage = memory();
  for (const raw of ['{bad', JSON.stringify({ version: 99, keep: true }), JSON.stringify({ version: 1, revision: 1, grants: [['openai', 'coach'], ['openai', 'coach']] })]) {
    storage.data.set(PRIVACY_KEY, raw); const store = createConsentStore(storage);
    assert.ok(store.unreadable); assert.equal(store.allowed('openai', 'coach'), false); assert.equal(store.set('openai', 'coach', true), 'unreadable'); assert.equal(storage.data.get(PRIVACY_KEY), raw);
  }
});

test('privacy transport makes no call without a grant and sends a provider/purpose-bound attestation', async () => {
  const storage = memory(), store = createConsentStore(storage), gate = createPrivacyGate(store); let calls = 0;
  const operation = async ({ headers }) => { calls++; return headers; };
  await assert.rejects(gate.run('openai', 'coach', operation), { code: 'consent_required' }); assert.equal(calls, 0);
  store.set('openai', 'coach', true);
  assert.deepEqual(await gate.run('openai', 'coach', operation), { 'x-kibitz-consent': 'v1:openai:coach' });
  await assert.rejects(gate.run('openai', 'embeddings', operation), { code: 'consent_required' }); assert.equal(calls, 1);
});

test('revocation and changed policy cancel held results even if the underlying operation ignores abort', async () => {
  const storage = memory(), store = createConsentStore(storage), gate = createPrivacyGate(store); store.set('mistral', 'coach', true);
  let release, signal; const run = gate.run('mistral', 'coach', options => { signal = options.signal; return new Promise(resolve => { release = resolve; }); });
  store.set('mistral', 'coach', false); gate.changed(); assert.ok(signal.aborted); release('late'); await assert.rejects(run, { code: 'cancelled' });
  store.set('mistral', 'coach', true);
  const second = gate.run('mistral', 'coach', () => new Promise(resolve => { release = resolve; }));
  const other = createConsentStore(storage); other.set('mistral', 'coach', false); release('late from another tab'); await assert.rejects(second, { code: 'cancelled' });
});
