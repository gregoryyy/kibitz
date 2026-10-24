import { test, expect, open, S } from './fixtures.mjs';
const PROMOTION = '[SetUp "1"]\n[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"]\n\n1. a8=Q+ Kh7 *';
const SOURCE = { id: 'index-source', kind: 'study', title: 'Signature source', white: 'White', black: 'Black', pgn: PROMOTION,
  signatures: { material: 'forged', pieces: ['wQa1'] }, positions: [{ fen: 'forged position', epd: 'forged', material: 'forged' }] };
async function seed(page, records) {
  await page.addInitScript(games => { if (!localStorage.getItem('kibitz.games')) localStorage.setItem('kibitz.games', JSON.stringify(games)); }, records);
}
const ready = page => expect.poll(() => page.evaluate(() => !!window.__kibitz.libraryRecords().get('library:index-source')?.snapshot)).toBe(true);

test('the production index contains rules-derived material/piece squares, ignoring imported feature assertions and preserving source status', async ({ page }) => {
  await seed(page, [SOURCE]); const providers = []; page.on('request', r => { if (/\/api\/ai\/(?:sample|embeddings|structured)$/.test(new URL(r.url()).pathname)) providers.push(r.url()); });
  await open(page); await ready(page); const before = await S(page);
  const facts = await page.evaluate(async () => {
    const K = await import('/chess/knowledge.js'), record = window.__kibitz.libraryRecords().get('library:index-source'), index = window.__kibitz.positionIndex();
    const rows = record.snapshot.occurrences, filters = { collection: 'library', documentId: record.snapshot.document.id, limit: 20 };
    const matches = K.positionFeatureMatches(index, rows[1].fen, { ...filters, by: 'material' });
    return { version: rows[0].signatures.version, counts: rows.map(o => [o.signatures.counts.w.p, o.signatures.counts.w.q]), plies: matches.map(h => h.p.ply),
      squares: rows[1].signatures.pieces, verification: record.snapshot.problem.verification, forged: index.byMaterial.has('forged'),
      initial: K.positionFeatureMatches(index, window.__kibitz.S.nodes[0].fen, filters).length,
      provenance: matches.every(h => h.p.sourceId === record.snapshot.source.id && h.p.documentId === record.snapshot.document.id && h.p.revision === record.snapshot.document.revision) };
  });
  expect(facts).toMatchObject({ version: 'counts-squares-v1', counts: [[1, 0], [0, 1], [0, 1]], plies: [1, 2], verification: 'legal-replay-only', forged: false, initial: 0, provenance: true });
  expect(facts.squares).toContain('wQa8'); expect(facts.squares).not.toContain('wPa7'); expect(await S(page)).toEqual(before); expect(providers).toEqual([]);
  await page.locator('[data-tab="library"]').click(); const details = page.locator('#libList [data-collection="library"] .source-details'); await details.locator('summary').click();
  await expect(details).toContainText('solution and stated result are unverified');
});

test('source revisions rebuild current feature buckets, and deletion removes all new lookup paths', async ({ page }) => {
  await seed(page, [{ ...SOURCE, pgn: PROMOTION.replace('1. a8', '{First source note.} 1. a8') }]); await open(page); await ready(page);
  const initial = await page.evaluate(() => { const s = window.__kibitz.libraryRecords().get('library:index-source').snapshot; return { revision: s.document.revision, material: s.occurrences[0].signatures.material, occurrence: s.occurrences[0].id }; });
  await page.evaluate(() => { const records = JSON.parse(localStorage.getItem('kibitz.games')); records[0].pgn = records[0].pgn.replace('First source note.', 'A revised source note.'); localStorage.setItem('kibitz.games', JSON.stringify(records)); });
  await page.reload(); await ready(page);
  const changed = await page.evaluate(async () => {
    const K = await import('/chess/knowledge.js'), s = window.__kibitz.libraryRecords().get('library:index-source').snapshot;
    return { revision: s.document.revision, material: s.occurrences[0].signatures.material, matches: K.positionFeatureMatches(window.__kibitz.positionIndex(), s.occurrences[0].fen, { collection: 'library', by: 'placement' }).map(h => h.p.id) };
  });
  expect(changed.revision).not.toBe(initial.revision); expect(changed.material).toBe(initial.material); expect(changed.matches).not.toContain(initial.occurrence);
  await page.locator('[data-tab="library"]').click(); const card = page.locator('#libList [data-collection="library"][data-game-id="index-source"]');
  await card.getByRole('button', { name: 'Delete', exact: true }).click(); await card.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(card).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const index = window.__kibitz.positionIndex();
    return [index.byMaterial, index.byPlacement, index.byPieceSquare].every(map => [...map.values()].every(entries => entries.every(e => e.g.collection !== 'library' || e.g.id !== 'index-source')));
  })).toBe(true);
});

test('equal piece placement across side/rights differences keeps distinct full-FEN occurrences and exact-position results', async ({ page }) => {
  const a = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 10', b = 'r3k2r/8/8/8/8/8/8/R3K2R b - - 17 42';
  await seed(page, [{ ...SOURCE, pgn: `[SetUp "1"]\n[FEN "${a}"]\n\n*` }, { ...SOURCE, id: 'other-state', pgn: `[SetUp "1"]\n[FEN "${b}"]\n\n*` }]);
  await open(page); await ready(page);
  const matches = await page.evaluate(async fen => {
    const K = await import('/chess/knowledge.js'), index = window.__kibitz.positionIndex();
    return { placement: K.positionFeatureMatches(index, fen, { by: 'placement', collection: 'library', limit: 20 }).map(h => ({ id: h.g.id, fen: h.p.fen, kind: h.kind })),
      exact: K.similarPositions(index, fen).filter(h => h.g.collection === 'library').map(h => [h.g.id, h.kind]) };
  }, a);
  expect(matches.placement.map(h => h.id)).toEqual(['index-source', 'other-state']); expect(matches.placement.map(h => h.fen)).toEqual([a, b]);
  expect(matches.placement.every(h => h.kind === 'same piece placement')).toBe(true); expect(matches.exact).toEqual([['index-source', 'same position']]);
});
