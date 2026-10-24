import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/platform/store.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test('round-trips JSON under the kibitz. prefix', () => {
  const s = memory(); const store = createStore(s);
  assert.equal(store.set('games', [{ id: 'g1' }]), true);
  assert.deepEqual(store.get('games', []), [{ id: 'g1' }]);
  assert.ok(s.m.has('kibitz.games'));
});

test('set() returns false when storage is full', () => {
  const store = createStore({ getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } });
  assert.equal(store.set('games', [1, 2, 3]), false);
});

test('get() falls back to the default on corrupt data or missing storage', () => {
  const s = memory(); s.setItem('kibitz.games', '{not json');
  assert.deepEqual(createStore(s).get('games', []), []);
  assert.equal(createStore(null).get('tab', 'game'), 'game');
  assert.equal(createStore(null).set('tab', 'game'), false);
});
