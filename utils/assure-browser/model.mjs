// Shared by the offline browser and Node tests; no DOM or mutable graph state.
export const containment = new Set(['recorded_in', 'part_of', 'contains_object', 'contains_section', 'contains_block', 'locates_item', 'has_description']);
export const label = node => node.name || node.title || node.path || node.text?.split('\n')[0] || node.number || node.id;
// Inspection is deliberately independent of path navigation and its history.
export function createNavigation(graph) {
  let root = null, inspected = null, revision = 0;
  const history = [];
  const inspect = id => {
    if (!graph.nodes.has(id)) return false;
    inspected = id; revision++; return true;
  };
  const walkFrom = (id, remember = true) => {
    if (!graph.nodes.has(id)) return false;
    if (remember && root && root !== id) history.push(root);
    root = id; inspect(id); return true;
  };
  return { inspect, walkFrom, back: () => history.length ? walkFrom(history.pop(), false) : false,
    get root() { return root; }, get inspected() { return inspected; },
    get revision() { return revision; }, get steps() { return history.length; } };
}
export function indexGraph(layers) {
  const nodes = new Map(), adjacency = new Map(), edges = [];
  for (const layer of layers) for (const node of layer.nodes) {
    if (nodes.has(node.id)) throw new Error(`Duplicate browser identity: ${node.id}`);
    nodes.set(node.id, { ...node, level: layer.level || 1 }); adjacency.set(node.id, []);
  }
  for (const layer of layers) for (const edge of layer.edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error('Dangling browser edge');
    const e = { ...edge, level: layer.level || 1 }; edges.push(e);
    adjacency.get(e.from).push(e); if (e.from !== e.to) adjacency.get(e.to).push(e);
  }
  return { nodes, edges, adjacency };
}
const accepts = (node, { level = '', type = '' }) => (!level || String(node.level) === String(level)) && (!type || node.type === type);
export function search(graph, query = '', options = {}, limit = 100) {
  const words = query.toLocaleLowerCase('en').trim().split(/\s+/).filter(Boolean), results = []; let total = 0;
  for (const node of graph.nodes.values()) {
    if (!accepts(node, options)) continue;
    const haystack = `${node.id} ${label(node)} ${node.text || ''}`.toLocaleLowerCase('en');
    if (!words.every(w => haystack.includes(w))) continue;
    total++; if (results.length < limit) results.push(node);
  }
  return { nodes: results, total, truncated: total > results.length };
}
function traverse(graph, root, { depth = 1, limit, direction = 'both', relation = '', includeContainment = true, minConfidence = 0, ...options } = {}) {
  if (!graph.nodes.has(root)) throw new Error('Unknown browser root');
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > 4 || !Number.isSafeInteger(limit) || limit < 1 || !['both', 'out', 'in'].includes(direction)) throw new Error('Invalid walk bounds/direction');
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) throw new Error('Invalid confidence threshold');
  const seen = new Set([root]), distances = new Map([[root, 0]]), eligible = e => e.confidence.value >= minConfidence && (!relation || e.type === relation) && (includeContainment || !containment.has(e.type));
  let frontier = [root], truncated = false;
  for (let step = 0; step < depth; step++) {
    const next = [];
    for (const id of frontier) for (const edge of graph.adjacency.get(id)) {
      if (!eligible(edge)) continue;
      const targets = [];
      if (direction !== 'in' && edge.from === id) targets.push(edge.to);
      if (direction !== 'out' && edge.to === id) targets.push(edge.from);
      for (const target of targets) if (!seen.has(target) && accepts(graph.nodes.get(target), options)) {
        if (seen.size >= limit) { truncated = true; continue; }
        seen.add(target); distances.set(target, step + 1); next.push(target);
      }
    }
    frontier = next;
  }
  return { root, nodes: [...seen].map(id => graph.nodes.get(id)), distances, edges: graph.edges.filter(e => seen.has(e.from) && seen.has(e.to) && eligible(e)), truncated };
}

// Columns cover the complete filtered walk. Only rendering is paged; graph mode
// keeps its separate, explicit cap. Grouping is presentation, never edge direction.
export const columns = [
  { id: 'documents', name: 'Documents & references' },
  { id: 'plan', name: 'Plan' },
  { id: 'evidence', name: 'PRs, progress & rationale' },
  { id: 'code', name: 'Code & tests' },
];
export function columnFor(node) {
  if (['todo', 'milestone'].includes(node.type)) return 'plan';
  if (['done', 'insight', 'deviation', 'reflection', 'pull_request', 'pr_section'].includes(node.type)) return 'evidence';
  if (node.type === 'object' || node.type === 'artifact' && !/\.md$/i.test(node.path || '')) return 'code';
  return 'documents';
}
export function walk(graph, root, options = {}) {
  const limit = options.limit ?? 70;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid walk bounds/direction');
  return traverse(graph, root, { ...options, limit });
}
export function lineage(graph, root, options = {}) {
  return traverse(graph, root, { ...options, limit: graph.nodes.size });
}
const collator = new Intl.Collator('en', { numeric: true });
const compare = (a, b) => collator.compare(String(label(a)), String(label(b))) || a.id.localeCompare(b.id);
export function columnRows(view, query = '') {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return columns.map(column => {
    const all = view.nodes.filter(n => columnFor(n) === column.id).sort((a, b) => Number(b.id === view.root) - Number(a.id === view.root) || compare(a, b));
    return { ...column, total: all.length, nodes: all.filter(n => n.id === view.root || words.every(w => `${n.id} ${label(n)} ${n.text || ''}`.toLowerCase().includes(w))) };
  });
}
export function pageItems(items, page = 0, size = 40) {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100) throw new Error('Invalid page bounds');
  const pages = Math.max(1, Math.ceil(items.length / size)), index = Math.min(page, pages - 1);
  return { items: items.slice(index * size, (index + 1) * size), page: index, pages, total: items.length, start: items.length ? index * size + 1 : 0, end: Math.min((index + 1) * size, items.length) };
}
export function connections(graph, id, { direction = 'both', relation = '', includeContainment = true, minConfidence = 0, ...options } = {}, query = '') {
  if (!graph.nodes.has(id)) throw new Error('Unknown browser root');
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return graph.adjacency.get(id).filter(e => {
    if (e.confidence.value < minConfidence || relation && e.type !== relation || !includeContainment && containment.has(e.type)) return false;
    if (direction === 'out' && e.from !== id || direction === 'in' && e.to !== id) return false;
    const other = graph.nodes.get(e.from === id ? e.to : e.from);
    return accepts(other, options) && words.every(w => `${e.type} ${e.from} ${e.to} ${label(other)} ${e.confidence.value} ${JSON.stringify(e.evidence)} ${JSON.stringify(e.assessmentEvidence || '')}`.toLowerCase().includes(w));
  }).sort((a, b) => a.type.localeCompare(b.type) || compare(graph.nodes.get(a.from === id ? a.to : a.from), graph.nodes.get(b.from === id ? b.to : b.from)) || a.from.localeCompare(b.from) || a.confidence.value - b.confidence.value);
}
