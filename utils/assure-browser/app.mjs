import cytoscape from '/vendor/cytoscape.mjs';
import { columnRows, connections, createNavigation, indexGraph, label, lineage, pageItems, search, walk } from './model.mjs';
const $ = id => document.getElementById(id);
let graph, navigation, cy, pathView, connectionPage = 0, gaps = [], findings = [];
const columnPages = new Map();
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
  columnPages.clear(); connectionPage = 0; $('path-search').value = ''; $('connection-search').value = ''; showInspection(); draw();
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
  markInspection();
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
function pager(page, change) {
  const nav = document.createElement('div'); nav.className = 'pager';
  const first = button('First', () => change(0)), previous = button('Previous', () => change(page.page - 1)), next = button('Next', () => change(page.page + 1)), last = button('Last', () => change(page.pages - 1));
  first.disabled = previous.disabled = page.page === 0; last.disabled = next.disabled = page.page + 1 === page.pages;
  const count = document.createElement('span'); count.textContent = `${page.start}–${page.end} of ${page.total}`;
  const input = document.createElement('input'); input.type = 'number'; input.min = '1'; input.max = String(page.pages); input.value = String(page.page + 1); input.setAttribute('aria-label', 'Page number');
  input.addEventListener('change', () => { const value = Number(input.value); if (Number.isSafeInteger(value) && value >= 1 && value <= page.pages) change(value - 1); else input.value = String(page.page + 1); });
  const of = document.createElement('span'); of.textContent = `/ ${page.pages}`;
  nav.append(count, first, previous, input, of, next, last); return nav;
}
function markInspection() {
  $('inspection-context').textContent = navigation.inspected === navigation.root ? 'Reviewed path root' : pathView?.distances.has(navigation.inspected) ? 'Within the reviewed path' : 'Outside the current filtered path';
  for (const card of $('columns').querySelectorAll('[data-node-id]')) {
    const inspected = card.dataset.nodeId === navigation.inspected;
    card.classList.toggle('inspected', inspected); card.setAttribute('aria-pressed', String(inspected));
  }
}
function renderColumns() {
  if (!pathView) return;
  const groups = columnRows(pathView, $('path-search').value);
  $('column-count').textContent = `${groups.reduce((n, g) => n + g.nodes.length, 0)} of ${pathView.nodes.length} path elements available · root included · up to 40 cards per column page`;
  $('columns').replaceChildren(...groups.map(group => {
    const section = document.createElement('section'); section.className = 'lineage-column'; section.dataset.column = group.id;
    const heading = document.createElement('h2'); heading.textContent = `${group.name} · ${group.nodes.length}/${group.total}`;
    const page = pageItems(group.nodes, columnPages.get(group.id) || 0);
    columnPages.set(group.id, page.page);
    const list = document.createElement('div'); list.className = 'cards';
    list.append(...page.items.map(node => {
      const card = elementButton('', node.id); card.className = 'lineage-card';
      card.title = `${label(node)}\nClick to inspect; double-click to walk from this element`;
      const name = document.createElement('span'); name.className = 'card-name'; name.textContent = label(node);
      card.classList.toggle('path-root', node.id === navigation.root);
      const meta = document.createElement('small'); meta.className = 'card-id'; meta.textContent = `${node.type} · ${node.id}`;
      const distance = document.createElement('small'); distance.textContent = node.id === navigation.root ? 'Reviewed path root' : `${pathView.distances.get(node.id)} hop(s) from root`;
      card.append(name, meta, distance); return card;
    }));
    const pages = pager(page, index => { columnPages.set(group.id, index); renderColumns(); });
    pages.setAttribute('aria-label', `${group.name} pages`); section.append(heading, pages, list); return section;
  })); markInspection();
}
function renderConnections() {
  if (!navigation?.root) return;
  const id = navigation.root, all = connections(graph, id, options()), filtered = $('connection-search').value.trim() ? connections(graph, id, options(), $('connection-search').value) : all;
  const page = pageItems(filtered, connectionPage); connectionPage = page.page;
  $('connection-count').textContent = `${filtered.length} of ${all.length} filtered direct relations · ${new Set(all.map(e => e.from === id ? e.to : e.from)).size} distinct neighbors`;
  const groups = new Map();
  for (const edge of all) {
    const key = `${edge.from === id ? '→ outgoing' : '← incoming'} ${edge.type}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  $('connection-groups').replaceChildren(...[...groups].map(([key, count]) => {
    const b = button(`${key} · ${count}`, () => { $('connection-search').value = key.split(' ').at(-1); connectionPage = 0; renderConnections(); });
    b.title = 'Filter connections by this relation type'; return b;
  }));
  $('neighbors').replaceChildren(...page.items.map(e => {
    const other = e.from === id ? e.to : e.from;
    const b = elementButton(`${e.type} [${e.confidence.value.toFixed(2)}]: ${label(graph.nodes.get(e.from))} → ${label(graph.nodes.get(e.to))}`, other);
    const row = document.createElement('div'); row.className = 'connection-row';
    const record = document.createElement('details'), summary = document.createElement('summary'), evidence = document.createElement('pre');
    summary.textContent = 'Confidence and evidence'; evidence.textContent = JSON.stringify({ confidence: e.confidence, evidence: e.evidence, assessmentEvidence: e.assessmentEvidence }, null, 2);
    record.append(summary, evidence); row.append(b, record); return row;
  }));
  $('connection-pages').replaceChildren(pager(page, index => { connectionPage = index; renderConnections(); }));
}
function draw() {
  const selected = navigation.root;
  if (!selected) return;
  const graphMode = $('view').value === 'graph';
  $('lineage').hidden = graphMode; $('graph').hidden = !graphMode; $('fit').hidden = !graphMode;
  pathView = lineage(graph, selected, options());
  renderConnections(); markInspection();
  if (!graphMode) {
    cy?.destroy(); cy = null;
    $('walk-count').textContent = `${pathView.nodes.length} nodes · ${pathView.edges.length} relations · complete filtered walk within depth ${$('depth').value}; cards are paged`;
    renderColumns(); return;
  }
  const view = walk(graph, selected, options());
  $('walk-count').textContent = `${view.nodes.length} of ${pathView.nodes.length} nodes · ${view.edges.length} relations${view.truncated ? ' · 70-node limit reached; use Lineage columns for every connection' : ''}`;
  const colors = { artifact: '#718594', object: '#287a71', section: '#b47732', doc_block: '#c49d58', pull_request: '#79528c', pr_section: '#9b75a7', todo: '#396eb3', done: '#47684d', insight: '#5b8554', deviation: '#b16c5c', reflection: '#8b7f4a', external: '#738584' };
  cy?.destroy();
  cy = cytoscape({ container: $('graph'), elements: [...view.nodes.map(n => ({ data: { id: n.id, label: graphLabel(n), color: colors[n.type] || '#718594', root: n.id === selected ? 1 : 0 } })), ...view.edges.map((e, i) => ({ data: { id: `edge:${i}`, source: e.from, target: e.to, label: e.type, weight: e.confidence.value } }))],
    style: [{ selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', 'font-size': 11, 'text-wrap': 'wrap', 'text-max-width': 95, color: '#20363d', 'text-valign': 'bottom', 'text-margin-y': 6, width: 23, height: 23 } }, { selector: 'node[root = 1]', style: { 'border-width': 4, 'border-color': '#173b48', width: 32, height: 32 } }, { selector: 'edge', style: { width: 'mapData(weight, 0, 1, 1, 4)', opacity: 'mapData(weight, 0, 1, 0.3, 1)', 'line-color': '#a4b8b4', 'target-arrow-color': '#638781', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } }],
    autounselectify: true, multiClickDebounceTime: 500, layout: { name: 'breadthfirst', directed: false, roots: [selected], padding: 45, spacingFactor: 1.3, nodeDimensionsIncludeLabels: true }, minZoom: 0.1, maxZoom: 3 });
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
$('view').addEventListener('change', () => graph && draw());
$('path-search').addEventListener('input', () => { columnPages.clear(); renderColumns(); });
$('connection-search').addEventListener('input', () => { connectionPage = 0; renderConnections(); });
$('fit').addEventListener('click', () => cy?.fit(undefined, 35));
$('search').addEventListener('input', () => graph && results());
for (const id of ['level', 'type', 'relation', 'direction', 'depth', 'containment', 'confidence']) $(id).addEventListener('change', () => { if (graph) { columnPages.clear(); connectionPage = 0; results(); draw(); } });
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
