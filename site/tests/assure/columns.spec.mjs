import { test, expect } from '@playwright/test';

const hub = 'file:hub.js';
async function openHub(page) {
  await page.route('**/data', async route => {
    const nodes = [{ id: hub, type: 'artifact', path: 'hub.js', name: 'High degree hub' }], edges = [];
    for (const [type, prefix, relation] of [['artifact', 'code', 'imports'], ['section', 'docs', 'links_to'], ['todo', 'plan', 'part_of'], ['done', 'evidence', 'supports']]) {
      for (let i = 0; i < 1200; i++) {
        const id = `${prefix}:${i}`;
        nodes.push({ id, type, name: `${prefix} ${i}`, ...(type === 'artifact' ? { path: `${id}.js` } : {}) });
        edges.push({ from: hub, to: id, type: relation, confidence: { value: i === 1199 ? 0.8 : 1, rationale: 'Fixture support, not proof' }, evidence: { text: `Evidence ${prefix} ${i}` } });
      }
    }
    await route.fulfill({ json: { layers: [{ nodes, edges, unresolved: [], level: 1 }], findings: { findings: [] } } });
  });
  await page.goto('/#' + encodeURIComponent(hub));
  await expect(page.locator('#status')).toContainText('offline snapshots');
}
const state = page => page.locator('#columns').evaluate(element => ({
  scroll: [element.scrollTop, element.scrollLeft],
  cards: [...element.querySelectorAll('[data-node-id]')].map(e => e.dataset.nodeId),
  root: [...element.querySelectorAll('.path-root')].map(e => e.dataset.nodeId),
}));

test('default lineage pages a 4800-degree hub completely without building a graph or losing the last relation', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openHub(page);
  await expect(page.locator('#walk-count')).toContainText('4801 nodes · 4800 relations · complete filtered walk');
  await expect(page.locator('#view')).toHaveValue('columns');
  await expect(page.locator('#graph')).toBeHidden(); await expect(page.locator('#graph canvas')).toHaveCount(0);
  await expect(page.locator('#columns .lineage-card')).toHaveCount(160);
  await expect(page.locator('#neighbors button')).toHaveCount(40);
  await expect(page.locator('#connection-count')).toContainText('4800 of 4800');
  const evidence = page.locator('[data-column="evidence"]');
  await evidence.getByRole('button', { name: 'Last', exact: true }).click();
  await expect(evidence.getByRole('button', { name: /evidence 1199/ })).toBeVisible();
  await page.locator('#connection-pages').getByRole('button', { name: 'Last', exact: true }).click();
  await expect(page.locator('#neighbors')).toContainText('Evidence evidence 1199');
  await page.fill('#connection-search', 'Evidence code 1199');
  await expect(page.locator('#neighbors button')).toHaveCount(1); await expect(page.locator('#neighbors')).toContainText('imports [0.80]');
  await page.locator('#neighbors summary').click(); await expect(page.locator('#neighbors pre')).toBeVisible();
  await expect(page.locator('#neighbors pre')).toContainText('Fixture support, not proof');
  await page.locator('#neighbors button').click(); await expect(page.locator('#selected-name')).toHaveText('code 1199');
  await expect(page).toHaveURL('/#' + encodeURIComponent(hub)); await expect(page.locator('#back')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('column inspections preserve cards, scroll, highlighted root and URL; double-click and Back navigate', async ({ page }) => {
  await openHub(page);
  const evidence = page.locator('[data-column="evidence"]');
  await evidence.getByRole('button', { name: 'Last', exact: true }).click();
  const card = evidence.locator('[data-node-id="evidence:1199"]');
  await card.scrollIntoViewIfNeeded(); const before = await state(page);
  await card.click(); await expect(page.locator('#selected-name')).toHaveText('evidence 1199');
  await expect(card).toHaveClass(/inspected/); expect(await state(page)).toEqual(before);
  await expect(page).toHaveURL('/#' + encodeURIComponent(hub)); await expect(page.locator('#back')).toBeDisabled();
  await card.dblclick(); await expect(page).toHaveURL('/#' + encodeURIComponent('evidence:1199'));
  await expect(page.locator('#trail')).toContainText('1 step');
  await page.click('#back'); await expect(page).toHaveURL('/#' + encodeURIComponent(hub));
  await expect(page.locator('#walk-count')).toContainText('4801 nodes');
});

test('path search and confidence filters reach every card; keyboard inspection and graph switching retain the root', async ({ page }) => {
  await openHub(page);
  await page.fill('#path-search', 'code 1199');
  await expect(page.locator('#columns .lineage-card')).toHaveCount(2); // match plus retained root
  const card = page.locator('#columns [data-node-id="code:1199"]');
  await card.focus(); await page.keyboard.press('Enter'); await expect(page.locator('#selected-name')).toHaveText('code 1199');
  await expect(page.locator('#trail')).toContainText('Path root: ' + hub);
  await page.selectOption('#confidence', '1'); await expect(page.locator('#walk-count')).toContainText('4797 nodes');
  await expect(page.locator('#columns .lineage-card')).toHaveCount(1);
  await page.selectOption('#confidence', '0.8'); await expect(page.locator('#columns .lineage-card')).toHaveCount(2);
  await page.selectOption('#view', 'graph'); await expect(page.locator('#walk-count')).toContainText('70 of 4801 nodes');
  await expect(page.locator('#walk-count')).toContainText('70-node limit');
  await page.selectOption('#view', 'columns'); await expect(page.locator('#columns .lineage-card')).toHaveCount(2);
  await expect(page.locator('#selected-name')).toHaveText('code 1199');
  await page.locator('#walk-from').focus(); await page.keyboard.press('Space');
  await expect(page).toHaveURL('/#' + encodeURIComponent('code:1199'));
});

test('column paging supports direct page selection and narrow screens', async ({ page }) => {
  await openHub(page); const column = page.locator('[data-column="code"]');
  await column.getByRole('spinbutton', { name: 'Page number' }).fill('20');
  await column.getByRole('spinbutton', { name: 'Page number' }).press('Tab');
  await expect(column.locator('.pager')).toContainText('761–800 of 1201');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.fill('#path-search', 'code 1199'); await expect(column.locator('[data-node-id="code:1199"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('revealing captured-source controls cannot move a connection during a double-click', async ({ page }) => {
  await page.goto('/#' + encodeURIComponent('pr:136')); await expect(page.locator('#status')).toContainText('offline snapshots');
  await page.selectOption('#relation', 'has_description'); await page.selectOption('#direction', 'out');
  await expect(page.locator('#source')).toBeHidden();
  const relation = page.locator('#neighbors button').filter({ hasText: 'What and why' });
  await relation.scrollIntoViewIfNeeded(); const before = await relation.boundingBox();
  await relation.click(); await expect(page.locator('#source')).toBeVisible();
  expect(await relation.boundingBox()).toEqual(before); await expect(page.locator('#inspection-context')).toHaveText('Within the reviewed path');
  await relation.dblclick(); await expect(page).toHaveURL('/#' + encodeURIComponent('pr_section:pr:136#what-and-why'));
  await page.click('#back'); await expect(page.locator('#selected-name')).toContainText('#136'); await expect(page.locator('#back')).toBeDisabled();
});
