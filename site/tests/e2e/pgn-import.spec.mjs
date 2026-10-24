import { test, expect, open, reveal, S } from './fixtures.mjs';

const A = '[Event "Notebook"]\n[White "Alice"]\n[Black "Bob"]\n\n1. e4 {My note} e5 2. Nf3 $1 *';
const B = '[Event "Second"]\n[White "Carol"]\n[Black "Dave"]\n\n1. d4 d5 *';
const cards = page => page.locator('#libList .game[data-collection="library"]');
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('kibitz.games') || '[]'));
async function library(page) { await page.locator('[data-tab="library"]').click(); await reveal(page, '#importText'); }
async function submit(page, pgn) { await page.locator('#importText').fill(pgn); await page.locator('#btnImport').click(); await expect(page.locator('#btnImport')).toBeEnabled(); }

test('reimports skip equivalent documents within a batch, after reload, and without writing over the first original', async ({ page }) => {
  await open(page); const game = await S(page); await library(page);
  await submit(page, A + '\n' + A); await expect(page.locator('#importMsg')).toHaveText('Added 1 game. Skipped 1 duplicate.');
  const first = await stored(page); expect(first[0].pgn).toBe(A); await expect(cards(page)).toHaveCount(1);
  await page.reload(); await expect(page.locator('#engineDot')).toHaveClass(/ok/); await library(page);
  await page.evaluate(() => { window.__importWrites = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'kibitz.games') window.__importWrites++; return set.call(this, k, v); }; });
  await submit(page, '[Black "Bob"]\n[White "Alice"]\n[Event "Notebook"]\n\n1.e4 {My note}\ne5 2.Nf3$1 *');
  await expect(page.locator('#importMsg')).toHaveText('Skipped 1 duplicate.'); expect(await stored(page)).toEqual(first);
  expect(await page.evaluate(() => window.__importWrites)).toBe(0); await expect(page.locator('#importText')).toHaveValue(''); expect(await S(page)).toEqual(game);
});

test('different annotations, variations, headers and source assertions are retained without merging their licences', async ({ page }) => {
  await open(page); await library(page);
  const variants = [A, A.replace('My note', '<img src=x onerror=alert(1)>'), A.replace('e5 2.', 'e5 (2. Bc4 {Another branch}) 2.'), A.replace('Notebook', 'Other event')];
  await submit(page, variants.join('\n')); await expect(page.locator('#importMsg')).toHaveText('Added 4 games.');
  await page.locator('#importSourceFields').evaluate(e => { e.closest('details').open = true; });
  await page.locator('[data-source-field="annotations"]').last().fill('Personal notes');
  await submit(page, A); await expect(page.locator('#importMsg')).toHaveText('Added 1 game.');
  const games = await stored(page); expect(games.map(g => g.pgn)).toEqual([...variants, A]);
  expect(games.slice(0, 4).every(g => g.provenance.rights.annotations === '')).toBe(true); expect(games[4].provenance.rights.annotations).toBe('Personal notes');
  await expect(page.locator('#libList img')).toHaveCount(0); await expect(cards(page)).toHaveCount(5);
});

test('legacy duplicates stay byte-for-byte intact and future records cannot suppress a new valid import', async ({ page }) => {
  const legacy = { id: 'legacy', kind: 'study', pgn: A, white: 'Alice', black: 'Bob' };
  const future = { id: 'future', kind: 'study', pgn: B, provenance: { version: 99, keep: 'future source fields' } };
  await page.addInitScript(records => localStorage.setItem('kibitz.games', JSON.stringify(records)), [legacy, future]);
  await open(page); await library(page); await submit(page, A + '\n' + B);
  await expect(page.locator('#importMsg')).toHaveText('Added 1 game. Skipped 1 duplicate.');
  const records = await stored(page); expect(records.slice(0, 2)).toEqual([legacy, future]); expect(records[2].pgn).toBe(B); expect(records[2].provenance.version).toBe(1);
});

test('mixed duplicates/unreadable PGNs and a failed save report separate counts; retry adds only the missing record', async ({ page }) => {
  await open(page); await library(page); await submit(page, A); const before = await stored(page);
  await page.evaluate(() => { const set = Storage.prototype.setItem; window.__restoreImportStorage = () => { Storage.prototype.setItem = set; }; Storage.prototype.setItem = function(k, v) { if (k === 'kibitz.games') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; });
  const mixed = A + '\n' + B + '\n[Event "Bad"]\n\n1. e5 *';
  await submit(page, mixed); await expect(page.locator('#importMsg')).toHaveText('Skipped 1 duplicate. Skipped 1 unreadable game. Could not save 1 game. Retry the import.');
  expect(await stored(page)).toEqual(before); await expect(page.locator('#importText')).toHaveValue(mixed);
  await page.evaluate(() => window.__restoreImportStorage()); await page.locator('#btnImport').click();
  await expect(page.locator('#importMsg')).toHaveText('Added 1 game. Skipped 1 duplicate. Skipped 1 unreadable game.'); expect((await stored(page)).length).toBe(2);
  await submit(page, A + '\n' + B); await expect(page.locator('#importMsg')).toHaveText('Skipped 2 duplicates.'); await expect(page.locator('#importText')).toHaveValue('');
});

test('a pending import rejects overlapping clicks and keeps a newly typed batch available', async ({ page }) => {
  await open(page); await library(page); const game = await S(page);
  await page.evaluate(() => {
    const digest = SubtleCrypto.prototype.digest; window.__importDigests = []; window.__holdImport = true;
    SubtleCrypto.prototype.digest = async function(...args) { const value = await digest.apply(this, args); if (window.__holdImport && new TextDecoder().decode(args[1]).includes('[Event "Notebook"]')) await new Promise(resolve => window.__importDigests.push(resolve)); return value; };
  });
  await page.locator('#importText').fill(A); await page.locator('#btnImport').click(); await expect(page.locator('#btnImport')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__importDigests.length)).toBe(1);
  await page.locator('#btnImport').evaluate(b => b.click()); await page.locator('#importText').fill(B);
  await page.evaluate(() => { window.__holdImport = false; window.__importDigests.forEach(resolve => resolve()); });
  await expect(page.locator('#importMsg')).toHaveText('Added 1 game.'); await expect(page.locator('#importText')).toHaveValue(B);
  expect((await stored(page)).map(g => g.pgn)).toEqual([A]); expect(await S(page)).toEqual(game);
  await page.locator('#btnImport').click(); await expect(page.locator('#importMsg')).toHaveText('Added 1 game.'); expect((await stored(page)).length).toBe(2);
});

test('acknowledged account imports deduplicate before a delayed snapshot, including partial-save retry', async ({ page }) => {
  await page.addInitScript(() => {
    const games = new Map(); let notify; window.__accountSets = 0; window.__accountFail = true;
    const collection = name => ({
      onSnapshot(fn) { if (name === 'games') notify = fn; fn({ docs: [] }); return () => {}; },
      doc(id) { return { async set(value) { window.__accountSets++; if (window.__accountFail && value.white === 'Carol') throw new Error('fake write failure'); games.set(id, value); }, async delete() { games.delete(id); } }; },
    });
    window.__accountFlush = () => notify({ docs: [...games].map(([id, value]) => ({ id, data: () => value })) });
    window.__accountCount = () => games.size;
    window.claude = { use: async name => name === 'db' ? { doc: () => ({ collection }) } : name === 'user' ? { id: async () => 'fake-user' } : null };
  });
  await open(page); await library(page); await submit(page, A + '\n' + B);
  await expect(page.locator('#importMsg')).toHaveText('Added 1 game. Could not save 1 game. Retry the import.');
  expect(await page.evaluate(() => window.__accountCount())).toBe(1); await expect(cards(page)).toHaveCount(0);
  await page.evaluate(() => { window.__accountFail = false; }); await page.locator('#btnImport').click();
  await expect(page.locator('#importMsg')).toHaveText('Added 1 game. Skipped 1 duplicate.'); expect(await page.evaluate(() => window.__accountSets)).toBe(3);
  await submit(page, A + '\n' + B); await expect(page.locator('#importMsg')).toHaveText('Skipped 2 duplicates.'); expect(await page.evaluate(() => window.__accountSets)).toBe(3);
  await page.evaluate(() => window.__accountFlush()); await expect(cards(page)).toHaveCount(2);
  await submit(page, A); await expect(page.locator('#importMsg')).toHaveText('Skipped 1 duplicate.'); expect(await page.evaluate(() => window.__accountCount())).toBe(2);
});

test('German phone duplicate/error counts translate and bounded batches fail without writing', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.addInitScript(() => localStorage.setItem('kibitz.lang', JSON.stringify('de')));
  await open(page); await library(page); await submit(page, A + '\n' + A + '\n[Event "Bad"]\n\n1. e5 *');
  await expect(page.locator('#importMsg')).toHaveText('1 Partie hinzugefügt. 1 Duplikat übersprungen. 1 unlesbare Partie übersprungen.');
  const before = await stored(page);
  await submit(page, Array(501).fill('1. e4 *').join('\n')); await expect(page.locator('#importMsg')).toHaveText('Importiere höchstens 500 Partien auf einmal.'); expect(await stored(page)).toEqual(before);
  await page.locator('#importText').fill(A); await page.locator('#btnImport').click(); await expect(page.locator('#importMsg')).toHaveText('1 Duplikat übersprungen.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#importMsg').scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath('pgn-import-phone.png') });
});
