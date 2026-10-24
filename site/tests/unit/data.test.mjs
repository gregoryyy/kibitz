import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserData, exportBrowserData, eraseBrowserData, eraseLibraryCache } from '../../src/platform/data.js';
import DE from '../../src/platform/i18n-de.js';

function memory(entries = []) {
  const data = new Map(entries); let blocked = null;
  return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: key => data.get(key) ?? null,
    removeItem: key => { if (key === blocked) throw Error('blocked'); data.delete(key); }, data, block: key => { blocked = key; } };
}
test('browser exports preserve raw future formats and literal private text without collecting unrelated keys', () => {
  const storage = memory([['other-app.secret', 'unrelated'], ['kibitz.future', '{broken future format'], ['kibitz.profile', '{"goals":"<script>private</script>"}']]);
  const exported = JSON.parse(exportBrowserData(storage, new Date('2026-10-24T12:00:00Z')));
  assert.equal(exported.format, 'kibitz-browser-data'); assert.equal(exported.exportedAt, '2026-10-24T12:00:00.000Z');
  assert.deepEqual(exported.entries, [['kibitz.future', '{broken future format'], ['kibitz.profile', '{"goals":"<script>private</script>"}']]);
  assert.equal(storage.data.size, 3); assert.throws(() => browserData(null));
});
test('browser erasure checks its confirmed snapshot, waits for cache erasure and preserves unrelated storage', async () => {
  const storage = memory([['kibitz.games', 'games'], ['kibitz.future', 'future'], ['another.setting', 'keep']]); let cleared = false;
  await eraseBrowserData(storage, browserData(storage), async () => { assert.ok(storage.data.has('kibitz.games')); cleared = true; });
  assert.ok(cleared); assert.deepEqual([...storage.data], [['another.setting', 'keep']]);
});
test('changed snapshots, cache failures and partial key failures never report a completed erasure', async () => {
  const storage = memory([['kibitz.a', 'a'], ['kibitz.b', 'b']]), before = browserData(storage);
  storage.data.set('kibitz.b', 'new'); let ran = false;
  await assert.rejects(eraseBrowserData(storage, before, async () => { ran = true; }), e => e.code === 'changed'); assert.equal(ran, false);
  await assert.rejects(eraseBrowserData(storage, browserData(storage), async () => { throw Error('cache'); })); assert.equal(storage.data.size, 2);
  await assert.rejects(eraseBrowserData(storage, browserData(storage), async () => storage.data.set('kibitz.new', 'new')), e => e.code === 'changed');
  storage.data.delete('kibitz.new'); storage.block('kibitz.b');
  await assert.rejects(eraseBrowserData(storage, browserData(storage), async () => {}));
  assert.deepEqual([...storage.data], [['kibitz.b', 'new']]);
  storage.block(null); await eraseBrowserData(storage, browserData(storage), async () => {}); assert.equal(storage.data.size, 0);
});
test('cache erasure waits for actual database deletion and rejects native errors', async () => {
  let request = null;
  const factory = { deleteDatabase: name => { assert.equal(name, 'test-cache'); return request = {}; } };
  let complete = false; const pending = eraseLibraryCache(factory, 'test-cache').then(() => { complete = true; });
  await Promise.resolve(); assert.equal(complete, false); request.onsuccess(); await pending; assert.equal(complete, true);
  const rejected = eraseLibraryCache(factory, 'test-cache'); request.onerror(); await assert.rejects(rejected, e => e.code === 'cache');
  await assert.rejects(eraseLibraryCache(null));
});
test('standalone data-page copy and action labels have German translations and ship in the build', () => {
  const page = readFileSync(new URL('../../src/data.html', import.meta.url), 'utf8');
  for (const [, text] of page.matchAll(/data-i18n>([^<]+)</g)) assert.ok(Object.hasOwn(DE, text), text);
  assert.equal(readFileSync(new URL('../../dist/data.html', import.meta.url), 'utf8'), page);
});
