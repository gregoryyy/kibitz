import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { openContainerApp } from '../container/startup.mjs';

const url = 'http://127.0.0.1:8765/?debug';
const request = (errorText = 'net::ERR_NETWORK_CHANGED', target = 'http://127.0.0.1:8765/chess/play.js', type = 'script') => ({
  url: () => target, resourceType: () => type, failure: () => ({ errorText }),
});
const page = (csp = []) => Object.assign(new EventEmitter(), { evaluate: async () => csp });
const cleaned = p => { for (const name of ['requestfailed', 'response', 'pageerror']) assert.equal(p.listenerCount(name), 0, name); };

test('normal container startup navigates once and removes only its own observers', async () => {
  const p = page(), observer = () => {}; p.on('response', observer);
  let calls = 0;
  assert.equal(await openContainerApp(p, url, async (actual, target) => {
    calls++; assert.equal(actual, p); assert.equal(target, url);
  }), false);
  assert.equal(calls, 1); assert.deepEqual(p.listeners('response'), [observer]);
  p.off('response', observer); cleaned(p);
});

test('one local module network-change failure permits one fresh navigation at the same URL', async () => {
  const p = page(); let calls = 0;
  const recovered = await openContainerApp(p, url, async (actual, target) => {
    assert.equal(actual, p); assert.equal(target, url);
    if (++calls === 1) { p.emit('requestfailed', request()); throw new Error('initial module graph aborted'); }
  });
  assert.equal(recovered, true); assert.equal(calls, 2); cleaned(p);
});

test('a repeated network-change failure remains a failure after the single recovery', async () => {
  const p = page(); let calls = 0;
  const error = new Error('still unavailable');
  await assert.rejects(openContainerApp(p, url, async () => {
    calls++; p.emit('requestfailed', request()); throw error;
  }), e => e === error);
  assert.equal(calls, 2); cleaned(p);
});

test('unrelated network errors, other origins and non-script failures never authorize a recovery', async () => {
  for (const r of [request('net::ERR_CONNECTION_REFUSED'), request(undefined, 'https://unrelated.invalid/a.js'), request(undefined, undefined, 'fetch')]) {
    const p = page(); let calls = 0;
    await assert.rejects(openContainerApp(p, url, async () => {
      calls++; p.emit('requestfailed', r); throw new Error('failure');
    }), /failure/);
    assert.equal(calls, 1); cleaned(p);
  }
});

test('HTTP or page failures prevent recovery even when a network change also occurs', async () => {
  for (const trigger of [p => p.emit('response', { request: () => request(), status: () => 404 }),
    p => p.emit('pageerror', new Error('application failure')), p => p.emit('requestfailed', request('net::ERR_CONNECTION_RESET'))]) {
    const p = page(); let calls = 0;
    await assert.rejects(openContainerApp(p, url, async () => {
      calls++; p.emit('requestfailed', request()); trigger(p); throw new Error('failure');
    }), /failure/);
    assert.equal(calls, 1); cleaned(p);
  }
});

test('CSP violations and unavailable policy evidence cannot be erased by a recovery navigation', async () => {
  for (const p of [page(['script-src blocked']), page(null), page('clear'),
    Object.assign(page(), { evaluate: async () => undefined }),
    Object.assign(page(), { evaluate: async () => { throw new Error('page gone'); } })]) {
    let calls = 0;
    await assert.rejects(openContainerApp(p, url, async () => {
      calls++; p.emit('requestfailed', request()); throw new Error('failure');
    }), /failure/);
    assert.equal(calls, 1); cleaned(p);
  }
});
