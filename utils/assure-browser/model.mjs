// Shared by the offline browser and Node tests; no DOM or mutable graph state.
export const containment = new Set(['recorded_in', 'part_of', 'contains_object', 'contains_section', 'contains_block', 'locates_item', 'has_description']);
export const label = node => node.name || node.title || node.path || node.text?.split('\n')[0] || node.number || node.id;
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
export function walk(graph, root, { depth = 1, limit = 70, direction = 'both', relation = '', includeContainment = true, minConfidence = 0, ...options } = {}) {
  if (!graph.nodes.has(root)) throw new Error('Unknown browser root');
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > 4 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !['both', 'out', 'in'].includes(direction)) throw new Error('Invalid walk bounds/direction');
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
