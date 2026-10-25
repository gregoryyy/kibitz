import test from 'node:test';
import assert from 'node:assert/strict';
import { columnRows, connections, indexGraph, lineage, pageItems, walk } from '../../../utils/assure-browser/model.mjs';

function hub(size = 4800) {
  const nodes = [{ id: 'hub', type: 'artifact', path: 'hub.js' }], edges = [];
  for (let i = 0; i < size; i++) {
    nodes.push({ id: `node:${i}`, type: ['object', 'todo', 'done', 'section'][i % 4], name: `Node ${i}` });
    edges.push({ from: i % 2 ? `node:${i}` : 'hub', to: i % 2 ? 'hub' : `node:${i}`, type: i % 3 ? 'mentions' : 'supports', confidence: { value: i % 5 ? 1 : 0.5 }, evidence: { text: `Evidence ${i}` } });
  }
  return indexGraph([{ nodes, edges, level: 1 }]);
}
test('complete column traversal keeps all high-degree neighbors; paging never changes the walk', () => {
  const graph = hub(), full = lineage(graph, 'hub');
  assert.equal(full.nodes.length, 4801); assert.equal(full.edges.length, 4800); assert.equal(full.truncated, false);
  assert.equal(walk(graph, 'hub').nodes.length, 70); assert.equal(walk(graph, 'hub').truncated, true);
  const groups = columnRows(full), recovered = new Set();
  assert.equal(groups.length, 4);
  for (const group of groups) {
    const pages = pageItems(group.nodes);
    for (let i = 0; i < pages.pages; i++) for (const node of pageItems(group.nodes, i).items) recovered.add(node.id);
  }
  assert.equal(recovered.size, 4801); assert(recovered.has('node:4799'));
  assert.equal(columnRows(full, 'Node 4799').flatMap(g => g.nodes).length, 2); // matching card plus retained root
  assert.equal(columnRows(full).find(g => g.id === 'code').nodes[0].id, 'hub');
});
test('full traversal respects depth, confidence, direction, relation, containment and endpoint filters', () => {
  const graph = hub(1000);
  graph.nodes.set('last', { id: 'last', type: 'object', level: 2 }); graph.adjacency.set('last', []);
  const e = { from: 'node:2', to: 'last', type: 'calls', confidence: { value: 1 } };
  graph.edges.push(e); graph.adjacency.get('node:2').push(e); graph.adjacency.get('last').push(e);
  assert(!lineage(graph, 'hub').nodes.some(n => n.id === 'last'));
  assert(lineage(graph, 'hub', { depth: 2 }).nodes.some(n => n.id === 'last'));
  assert.equal(lineage(graph, 'hub', { direction: 'out', minConfidence: 1 }).nodes.length, 401);
  assert.equal(lineage(graph, 'hub', { direction: 'in' }).nodes.length, 501);
  assert(lineage(graph, 'hub', { relation: 'supports' }).edges.every(e => e.type === 'supports'));
  assert.equal(lineage(graph, 'hub', { type: 'todo' }).nodes.length, 251);
  assert.equal(lineage(graph, 'hub', { level: '2' }).nodes.length, 1);
  assert.equal(lineage(graph, 'hub', { depth: 0 }).nodes.length, 1);
  const contains = { ...e, from: 'hub', type: 'contains_object' };
  graph.edges.push(contains); graph.adjacency.get('hub').push(contains); graph.adjacency.get('last').push(contains);
  assert(!lineage(graph, 'hub', { includeContainment: false }).nodes.some(n => n.id === 'last'));
  assert.throws(() => lineage(graph, 'hub', { depth: 5 })); assert.throws(() => lineage(graph, 'missing'));
});
test('direct relations retain parallel types, incoming direction, self loops and literal evidence beyond graph limits', () => {
  const graph = hub(), same = { from: 'hub', to: 'node:4799', type: 'contradicts', confidence: { value: 0.9 }, evidence: { text: '<img onerror=boom>' } };
  graph.edges.push(same); graph.adjacency.get('hub').push(same); graph.adjacency.get('node:4799').push(same);
  assert.equal(connections(graph, 'hub').length, 4801);
  assert.equal(connections(graph, 'hub', {}, 'node:4799').length, 2);
  assert.equal(connections(graph, 'hub', { direction: 'out' }, 'node:4799').length, 1);
  assert.equal(connections(graph, 'hub', { direction: 'in' }, 'node:4799').length, 1);
  assert.equal(connections(graph, 'hub', { minConfidence: 1 }, 'node:4799').length, 1);
  assert.equal(connections(graph, 'hub', {}, 'onerror=boom')[0], same);
  assert.equal(connections(graph, 'hub', { relation: 'contradicts' })[0], same);
  assert.equal(connections(graph, 'hub', { type: 'todo' }).length, 1200);
  const self = { from: 'hub', to: 'hub', type: 'supports', confidence: { value: 1 } }; graph.adjacency.get('hub').push(self);
  assert.equal(connections(graph, 'hub', {}, 'hub hub').filter(e => e.from === e.to).length, 1);
});
test('page bounds handle empty results and clamp after filtering without skipping or duplicating items', () => {
  const items = Array.from({ length: 81 }, (_, i) => i);
  assert.deepEqual([0, 1, 2].flatMap(i => pageItems(items, i).items), items);
  assert.equal(pageItems(items, 9).page, 2); assert.deepEqual(pageItems([], 9), { items: [], page: 0, pages: 1, total: 0, start: 0, end: 0 });
  assert.throws(() => pageItems(items, -1)); assert.throws(() => pageItems(items, 0, 0));
});
