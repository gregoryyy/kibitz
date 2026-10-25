import cytoscape from '/vendor/cytoscape.mjs';
import { createNavigation, indexGraph, label, search, walk } from './model.mjs';
const $ = id => document.getElementById(id);
let graph, navigation, cy, gaps = [], findings = [];
const options = () => ({ minConfidence: Number($('confidence').value), level: $('level').value, type: $('type').value, relation: $('relation').value, direction: $('direction').value, depth: Number($('depth').value), includeContainment: $('containment').checked });
const button = (text, action) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); return b; };
const elementButton = (text, id) => { const b = button(text, () => inspect(id)); b.dataset.nodeId = id; b.title = 'Click to inspect; double-click to walk from this element'; b.addEventListener('dblclick', () => select(id)); return b; };
function select(id) {
  if (navigation.walkFrom(id)) showPath();
}
function showPath() {
  const id = navigation.root;
  location.hash = encodeURIComponent(id); $('back').disabled = !navigation.steps;
  $('trail').textContent = `${navigation.steps} step${navigation.steps === 1 ? '' : 's'} · Path root: ${id}`;
  showInspection(); draw();
}
function inspect(id) {
  if (navigation.inspect(id)) showInspection();
}
function showInspection() {
  const id = navigation.inspected;
  $('walk-from').disabled = id === navigation.root;
  const node = graph.nodes.get(id);
  $('selected-name').textContent = label(node); $('selected-id').textContent = `${node.type} · Level ${node.level} · ${id}`;
  const sourcePath = node.source?.path || node.path || (node.type === 'pull_request' ? node.id : '');
  const issues = gaps.filter(g => g.source?.path === sourcePath && (!node.source || g.source.line >= node.source.line && g.source.line <= node.source.endLine));
  $('gap-count').textContent = `${issues.length} gaps in this source range`; $('gaps').textContent = JSON.stringify(issues, null, 2);
  $('details').textContent = JSON.stringify(node, null, 2); $('links').replaceChildren();
  const pr = node.type === 'pull_request' ? node : node.type === 'pr_section' ? graph.nodes.get(`pr:${node.number}`) : null;
  if (pr) {
    const a = document.createElement('a'); a.href = pr.url; a.textContent = `Open PR #${pr.number} on GitHub`; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('links').append(a);
  } else if (node.type === 'external' && /^https?:\/\//.test(node.url)) {
    const a = document.createElement('a'); a.href = node.url; a.textContent = 'Open external documentation'; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('links').append(a);
  }
  $('source').hidden = !node.locator; $('source-text').hidden = true; $('source-text').textContent = '';
}
function results() {
  const result = search(graph, $('search').value, options());
  $('result-count').textContent = `${result.total} matches${result.truncated ? ' · first 100 shown; refine search' : ''}`;
  $('results').replaceChildren(...result.nodes.map(node => {
    const b = elementButton(label(node), node.id); const small = document.createElement('small'); small.textContent = `${node.type} · ${node.id}`; b.append(small); return b;
  }));
}
function graphLabel(node) {
  if (node.type === 'object') {
    const name = node.name.split('/').at(-1);
    return (name.startsWith('<') ? node.kind : name.slice(0, 25)) + `\nL${node.source.line}`;
  }
  if (node.type === 'artifact') return node.path.split('/').at(-1).slice(0, 28);
  return String(label(node)).slice(0, 28);
}
function draw() {
  const selected = navigation.root;
  if (!selected) return;
  const view = walk(graph, selected, options());
  $('walk-count').textContent = `${view.nodes.length} nodes · ${view.edges.length} relations${view.truncated ? ' · 70-node limit reached; narrow filters or walk one step' : ''}`;
  const colors = { artifact: '#718594', object: '#287a71', section: '#b47732', doc_block: '#c49d58', pull_request: '#79528c', pr_section: '#9b75a7', todo: '#396eb3', done: '#47684d', insight: '#5b8554', deviation: '#b16c5c', reflection: '#8b7f4a', external: '#738584' };
  cy?.destroy();
  cy = cytoscape({ container: $('graph'), elements: [...view.nodes.map(n => ({ data: { id: n.id, label: graphLabel(n), color: colors[n.type] || '#718594', root: n.id === selected ? 1 : 0 } })), ...view.edges.map((e, i) => ({ data: { id: `edge:${i}`, source: e.from, target: e.to, label: e.type, weight: e.confidence.value } }))],
    style: [{ selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', 'font-size': 11, 'text-wrap': 'wrap', 'text-max-width': 95, color: '#20363d', 'text-valign': 'bottom', 'text-margin-y': 6, width: 23, height: 23 } }, { selector: 'node[root = 1]', style: { 'border-width': 4, 'border-color': '#173b48', width: 32, height: 32 } }, { selector: 'edge', style: { width: 'mapData(weight, 0, 1, 1, 4)', opacity: 'mapData(weight, 0, 1, 0.3, 1)', 'line-color': '#a4b8b4', 'target-arrow-color': '#638781', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } }],
    autounselectify: true, layout: { name: 'breadthfirst', directed: false, roots: [selected], padding: 45, spacingFactor: 1.3, nodeDimensionsIncludeLabels: true }, minZoom: 0.1, maxZoom: 3 });
  // Cytoscape groups nearby taps by time, even across different nodes. Only a
  // repeated tap on the same element is an explicit request to change paths.
  let lastTapped, doubleTapped;
  cy.on('tap', event => {
    const id = event.target.isNode?.() ? event.target.id() : null;
    doubleTapped = id && id === lastTapped ? id : null; lastTapped = id;
    if (id) inspect(id);
  });
  cy.on('dbltap', 'node', event => {
    if (event.target.id() === doubleTapped) select(event.target.id());
    lastTapped = doubleTapped = null;
  });
  $('neighbors').replaceChildren(...view.edges.map(e => {
    const other = e.from === selected ? e.to : e.from;
    const b = elementButton(`${e.type} [${e.confidence.value.toFixed(2)}]: ${label(graph.nodes.get(e.from))} → ${label(graph.nodes.get(e.to))}`, other);
    const evidence = document.createElement('small'); evidence.textContent = JSON.stringify({ confidence: e.confidence, evidence: e.evidence, assessmentEvidence: e.assessmentEvidence }); b.append(evidence); return b;
  }));
}
function findingResults() {
  const words = $('finding-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean), status = $('finding-status').value;
  const result = findings.filter(f => (!status || f.status === status) && words.every(word => `${f.subject} ${f.related.join(' ')} ${f.message} ${f.rule}`.toLowerCase().includes(word)));
  $('finding-count').textContent = `${result.length} findings · first ${Math.min(40, result.length)} shown · rule threshold 0.80 (independent of graph display filter)`;
  $('finding-results').replaceChildren(...result.slice(0, 40).map(f => { const b = elementButton(`${f.status} · ${f.rule} [${f.confidence.value.toFixed(2)}] · ${f.subject}`, f.subject); b.addEventListener('click', () => {
    $('finding-detail').hidden = false; $('finding-detail').textContent = JSON.stringify(f, null, 2);
  }); return b; }));
}
$('finding-search').addEventListener('input', () => graph && findingResults());
$('finding-status').addEventListener('change', () => graph && findingResults());
$('source').addEventListener('click', async () => {
  const id = navigation.inspected, revision = navigation.revision; $('source-text').hidden = false; $('source-text').textContent = 'Checking captured content…';
  try { const response = await fetch(`/source?id=${encodeURIComponent(id)}`); if (!response.ok) throw new Error(await response.text()); const text = await response.text(); if (navigation.inspected === id && navigation.revision === revision) $('source-text').textContent = text; }
  catch (error) { if (navigation.inspected === id && navigation.revision === revision) $('source-text').textContent = String(error.message); }
});
$('back').addEventListener('click', () => { if (navigation.back()) showPath(); });
$('walk-from').addEventListener('click', () => select(navigation.inspected));
$('fit').addEventListener('click', () => cy?.fit(undefined, 35));
$('search').addEventListener('input', () => graph && results());
for (const id of ['level', 'type', 'relation', 'direction', 'depth', 'containment', 'confidence']) $(id).addEventListener('change', () => { if (graph) { results(); draw(); } });
window.addEventListener('hashchange', () => { try { const id = decodeURIComponent(location.hash.slice(1)); if (id !== navigation?.root && graph?.nodes.has(id)) select(id); } catch { /* Invalid deep links do not execute or alter source. */ } });
try {
  const response = await fetch('/data'); if (!response.ok) throw new Error('Local snapshots could not be loaded');
  const { layers, findings: retained } = await response.json(); findings = retained.findings; graph = indexGraph(layers); navigation = createNavigation(graph); gaps = layers.flatMap(l => l.unresolved);
  for (const type of [...new Set([...graph.nodes.values()].map(n => n.type))].sort()) $('type').add(new Option(type, type));
  for (const type of [...new Set(graph.edges.map(e => e.type))].sort()) $('relation').add(new Option(type, type));
  $('status').textContent = `${graph.nodes.size.toLocaleString()} nodes · ${graph.edges.length.toLocaleString()} relations · ${gaps.length.toLocaleString()} explicit gaps · offline snapshots`;
  $('findings-panel').querySelector('summary').textContent = `Gap and deviation findings (${findings.length.toLocaleString()})`;
  findingResults(); results(); let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { /* Fall back to the default. */ }
  select(graph.nodes.has(id) ? id : 'todo:0.16');
} catch (error) { $('status').textContent = `Unable to load assurance: ${error.message}`; }
