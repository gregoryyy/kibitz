import { test, expect } from '@playwright/test';

const section = 'pr_section:pr:136#what-and-why';
async function openPath(page) {
  await page.goto('/#' + encodeURIComponent('pr:136'));
  await expect(page.locator('#status')).toContainText('offline snapshots');
  await page.selectOption('#view', 'graph');
  await page.selectOption('#relation', 'has_description'); await page.selectOption('#direction', 'out');
  await expect(page.locator('#neighbors button').filter({ hasText: 'What and why' })).toHaveCount(1);
}
// Read actual rendered node positions, then drive normal mouse gestures on canvas.
const point = (page, id) => page.evaluate(id => {
  const element = document.getElementById('graph'), cy = element._cyreg.cy, node = cy.getElementById(id), bounds = element.getBoundingClientRect();
  const position = node.renderedPosition(); return { x: bounds.x + position.x, y: bounds.y + position.y };
}, id);
const view = page => page.evaluate(() => {
  const cy = document.getElementById('graph')._cyreg.cy;
  return { nodes: cy.nodes().map(node => ({ id: node.id(), position: node.position() })), edges: cy.edges().map(edge => edge.id()),
    root: cy.nodes('[root = 1]').map(node => node.id()), pan: cy.pan(), zoom: cy.zoom(), selected: cy.$(':selected').length };
});

test('single canvas clicks inspect captured source while preserving the highlighted path, layout, viewport, URL and Back history', async ({ page }) => {
  await openPath(page); const before = await view(page), url = page.url(), count = await page.locator('#walk-count').textContent();
  await page.evaluate(() => { globalThis.originalAssureGraph = document.getElementById('graph')._cyreg.cy; });
  const location = await point(page, section); await page.mouse.click(location.x, location.y);
  await expect(page.locator('#selected-name')).toHaveText('What and why');
  expect(page.url()).toBe(url);
  await expect(page.locator('#trail')).toContainText('Path root: pr:136'); await expect(page.locator('#back')).toBeDisabled();
  expect(await view(page)).toEqual(before); await expect(page.locator('#walk-count')).toHaveText(count);
  expect(await page.evaluate(() => globalThis.originalAssureGraph === document.getElementById('graph')._cyreg.cy)).toBe(true);
  await page.click('#source'); await expect(page.locator('#source-text')).toContainText('TODO 0.15'); expect(await view(page)).toEqual(before);
});

test('double-clicking a canvas node or relation changes the path and Back restores its previous root', async ({ page }) => {
  await openPath(page); const before = await view(page);
  const location = await point(page, section); await page.mouse.dblclick(location.x, location.y, { delay: 75 });
  await expect(page).toHaveURL('/#' + encodeURIComponent(section)); await expect(page.locator('#trail')).toContainText('1 step');
  expect((await view(page)).root).toEqual([section]); await page.click('#back');
  await expect(page).toHaveURL('/#' + encodeURIComponent('pr:136')); expect((await view(page)).root).toEqual(['pr:136']);
  expect((await view(page)).nodes.map(node => node.id)).toEqual(before.nodes.map(node => node.id));
  await page.locator('#neighbors button').filter({ hasText: 'What and why' }).dblclick();
  await expect(page).toHaveURL('/#' + encodeURIComponent(section)); await page.click('#back');
  await expect(page.locator('#selected-name')).toContainText('#136');
});

test('successive clicks on different nodes stay inspections even when the graph library groups them as a double tap', async ({ page }) => {
  await openPath(page);
  const other = await page.evaluate(first => {
    const cy = document.getElementById('graph')._cyreg.cy; cy.multiClickDebounceTime(1000);
    globalThis.assureDoubleTaps = []; cy.on('dbltap', 'node', event => globalThis.assureDoubleTaps.push(event.target.id()));
    return cy.nodes().filter(node => node.id() !== first && !node.data('root'))[0].id();
  }, section);
  const before = await view(page), first = await point(page, section), second = await point(page, other);
  await page.mouse.click(first.x, first.y); await page.mouse.click(second.x, second.y);
  expect(await page.evaluate(() => globalThis.assureDoubleTaps)).toEqual([other]);
  await expect(page.locator('#selected-id')).toContainText(other);
  await expect(page).toHaveURL('/#' + encodeURIComponent('pr:136')); expect(await view(page)).toEqual(before);
  await expect(page.locator('#back')).toBeDisabled();
});

test('keyboard inspection and explicit walking keep search results and findings separate from path history', async ({ page }) => {
  await openPath(page); const before = await view(page), url = page.url();
  const relation = page.locator('#neighbors button').filter({ hasText: 'What and why' }); await relation.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#selected-name')).toHaveText('What and why'); expect(await view(page)).toEqual(before); expect(page.url()).toBe(url);
  await page.locator('#walk-from').focus(); await page.keyboard.press('Space'); await expect(page).toHaveURL('/#' + encodeURIComponent(section));
  await page.click('#back'); await page.fill('#search', 'pr:140'); await page.locator('#results button[data-node-id="pr:140"]').click();
  await expect(page.locator('#selected-name')).toContainText('#140'); expect(page.url()).toBe(url); expect(await view(page)).toEqual(before);
  await page.locator('#findings-panel summary').click(); await page.selectOption('#finding-status', 'recorded');
  await page.locator('#finding-results button').first().click(); await expect(page.locator('#finding-detail')).toContainText('recorded_deviation');
  expect(page.url()).toBe(url); expect(await view(page)).toEqual(before); await expect(page.locator('#back')).toBeDisabled();
});

test('a late captured-source response cannot overwrite a later inspection of the same element', async ({ page }) => {
  let release, first = true;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/source?*', async route => {
    if (first) { first = false; await held; await route.fulfill({ status: 200, body: 'STALE_CAPTURE_MUST_NOT_APPEAR' }); }
    else await route.continue();
  });
  await openPath(page); const relation = page.locator('#neighbors button').filter({ hasText: 'What and why' });
  await relation.click(); await page.click('#source'); await expect(page.locator('#source-text')).toContainText('Checking captured content');
  await page.fill('#search', 'pr:136'); await page.locator('#results button[data-node-id="pr:136"]').click();
  await relation.click(); await page.click('#source'); await expect(page.locator('#source-text')).toContainText('TODO 0.15');
  const response = page.waitForResponse(response => response.url().includes('/source?') && response.request().isNavigationRequest() === false);
  release(); await (await response).finished(); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#source-text')).toContainText('TODO 0.15'); await expect(page.locator('#source-text')).not.toContainText('STALE_CAPTURE');
  await expect(page).toHaveURL('/#' + encodeURIComponent('pr:136'));
});
