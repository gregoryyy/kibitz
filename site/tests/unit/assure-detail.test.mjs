import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildGraph, trackedFiles } from '../../../utils/assure.mjs';
import { buildDetails, sections, replay, sha256, validatePullRequests } from '../../../utils/assure-detail.mjs';
import { validateLayers } from '../../../docs/assure/detail-types.mjs';
import { createNavigation, indexGraph, search, walk } from '../../../utils/assure-browser/model.mjs';
const fixture = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-detail-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (p, text) => { fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); fs.writeFileSync(path.join(root, p), text); };
  write('docs/TODO.md', '# TODO\n## 0. Foundation\n- [ ] 0.16 Work still open, see `site/src/a.js` and `outer`.\n');
  write('docs/DONE.md', '# DONE\n## 2026-10-25 — Partial fixture\nTODO item: 0.16.\n### Insights\n- `site/src/a.js` implements `outer`, but completion remains open.\n### Deviations\n- Member calls remain dynamic.\n');
  write('site/src/a.js', 'export function target() { return 1; }\nexport function outer() {\n const local = () => target();\n if (true) { local(); }\n return local;\n}\nfunction shadow(target) { return target(); }\nexport class Coach { run() { return target(); } }\n');
  write('site/src/b.js', "import { target as imported } from './a.js';\nexport const go = () => imported();\n// function fake() {}\nconst text = 'function imaginary() {}';\n");
  write('site/src/index.html', '<h1>Do not execute</h1>\n<script type="application/json">{"not":"code"}</script>\n<script type="module">\nfunction inline() { return 2; }\ninline();\n</script>');
  write('docs/guide.md', '# Guide\n`site/src/a.js` and `outer` are related.\n## Steps\n[back](#guide) and [other][ref].\n[ref]: ../site/src/a.js\n```js\n[fake](missing.md)\nfunction fake() {}\n```\n## Steps\n[bad](#absent)\n## Separate\n`outer` alone is not a file citation.\nSetext\n------\n');
  write('docs/assure/pull-requests.json', '{}\n');
  execFileSync('git', ['init', '-q'], { cwd: root }); execFileSync('git', ['add', '.'], { cwd: root });
  const prs = { schemaVersion: 1, repository: 'gregoryyy/kibitz', pulls: [{ number: 1, title: 'Fixture', body: 'Intro\n## Implementation\nTODO 0.16: `site/src/a.js` and `outer`.\n## Validation\n`target` without a file reference.\n', state: 'MERGED', url: 'https://github.com/gregoryyy/kibitz/pull/1', head: 'a'.repeat(40), base: 'b'.repeat(40), files: ['site/src/a.js', 'old.js'], filesComplete: true }] };
  const files = trackedFiles(root), base = buildGraph(root, files), layers = buildDetails(root, base, files, prs);
  return { root, write, prs, files, base, ...layers };
};
test('objects preserve selectors, exact hashes, lexical calls, local imports and HTML offsets', t => {
  const { root, objects } = fixture(t);
  const nodes = objects.nodes.filter(n => n.type === 'object'), outer = nodes.find(n => n.name === 'outer'), target = nodes.find(n => n.name === 'target');
  assert(outer); assert(nodes.some(n => n.kind === 'block')); assert(nodes.some(n => n.kind === 'method'));
  assert(!nodes.some(n => /fake|imaginary/.test(n.name)));
  const text = fs.readFileSync(path.join(root, outer.source.path), 'utf8');
  assert.equal(sha256(text.slice(outer.locator.start, outer.locator.end)), outer.locator.sha256);
  assert.match(outer.locator.selector, /^program\/body\[/);
  assert(objects.edges.some(e => e.type === 'calls' && e.to === target.id));
  assert(objects.edges.some(e => e.type === 'references_binding' && e.from === outer.id));
  const shadow = nodes.find(n => n.name === 'shadow'); assert(!objects.edges.some(e => e.type === 'calls' && e.from === shadow.id));
  const go = nodes.find(n => n.name === 'go'); assert(objects.edges.some(e => e.type === 'imports_binding' && e.from === go.id && e.to === target.id));
  const inline = nodes.find(n => n.name === 'inline'); assert.equal(inline.source.line, 4); assert.match(inline.locator.selector, /^script\[0\]/);
});
test('PR descriptions link exact sections to items/objects; file changes are a distinct relation', t => {
  const { objects } = fixture(t), implementation = objects.nodes.find(n => n.type === 'pr_section' && n.name === 'Implementation'), validation = objects.nodes.find(n => n.type === 'pr_section' && n.name === 'Validation');
  assert(objects.edges.some(e => e.type === 'references_item' && e.from === implementation.id && e.to === 'todo:0.16'));
  assert(objects.edges.some(e => e.type === 'mentions_object' && e.from === implementation.id));
  assert(!objects.edges.some(e => e.type === 'mentions_object' && e.from === validation.id));
  assert(objects.edges.some(e => e.type === 'changes_file' && e.from === 'pr:1' && e.to === 'file:site/src/a.js'));
  assert(objects.unresolved.some(u => u.reason === 'historical_PR_file_absent'));
  assert(objects.edges.some(e => e.type === 'mentions_object' && e.from.includes('/insight:')));
});
test('documentation resolves heading anchors and reference links, retaining gaps and literal blocks', t => {
  const { base, objects, documents } = fixture(t);
  assert(documents.nodes.some(n => n.id === 'section:docs/guide.md#steps-1'));
  assert(documents.nodes.some(n => n.name === 'Setext'));
  assert(documents.nodes.some(n => n.type === 'doc_block' && n.language === 'js'));
  assert(documents.edges.some(e => e.type === 'documents_link' && e.to === 'section:docs/guide.md#guide'));
  assert(documents.edges.some(e => e.type === 'documents_link' && e.to === 'file:site/src/a.js' && e.evidence.resolution.includes('reference-style')));
  assert(documents.unresolved.some(u => u.reason === 'missing_document_anchor'));
  assert(!documents.unresolved.some(u => u.reference === 'missing.md'));
  assert(!documents.edges.some(e => e.type === 'mentions_object' && e.from === 'section:docs/guide.md#separate'));
  assert(documents.edges.some(e => e.type === 'locates_item' && e.to === 'todo:0.16'));
  assert.equal(base.nodes.find(n => n.id === 'todo:0.16').status, 'open');
  assert.equal(validateLayers(base, [objects, documents]).length, 2);
});
test('replay reparses selectors and detects source drift without evaluating code', t => {
  const f = fixture(t), outer = f.objects.nodes.find(n => n.type === 'object' && n.name === 'outer');
  const result = replay(f.root, f.base, [f.objects, f.documents], outer.id, f.prs); assert.match(result.text, /^function outer/);
  f.write('site/src/a.js', fs.readFileSync(path.join(f.root, 'site/src/a.js'), 'utf8').replace('return local;', 'return 42;'));
  assert.throws(() => replay(f.root, f.base, [f.objects, f.documents], outer.id, f.prs), /drift/);
});
test('identities and extraction are deterministic, missing sources and ambiguous names stay explicit', t => {
  const f = fixture(t); assert.deepEqual(buildDetails(f.root, f.base, [...f.files].reverse(), f.prs), { objects: f.objects, documents: f.documents });
  f.write('site/src/a.js', 'export function outer() { return 1; }\nfunction wrapper() { function outer() {} return outer; }\n');
  const result = buildDetails(f.root, f.base, f.files, f.prs);
  assert(result.objects.unresolved.some(u => u.reason === 'ambiguous_object_name'));
  assert(!result.objects.edges.some(e => e.type === 'mentions_object' && e.from.startsWith('pr_section:')));
});
test('typed integrity rejects invalid endpoints, duplicate identities, ownership and unsafe URLs', t => {
  const { base, objects, documents } = fixture(t);
  for (const mutate of [
    layers => { layers[0].edges[0].to = 'absent'; },
    layers => { layers[0].nodes.push(layers[0].nodes[0]); },
    layers => { layers[0].edges = layers[0].edges.filter(e => e.type !== 'contains_object'); },
    layers => { layers[0].nodes.find(n => n.type === 'pull_request').url = 'javascript:alert(1)'; },
  ]) { const layers = structuredClone([objects, documents]); mutate(layers); assert.throws(() => validateLayers(base, layers)); }
  const { prs } = fixture(t); prs.pulls[0].head = 'main'; assert.throws(() => validatePullRequests(prs));
});
test('search and bounded directed traversal retain provenance and disclose limits', t => {
  const { base, objects, documents } = fixture(t), graph = indexGraph([base, objects, documents]);
  assert(search(graph, 'outer', { level: 2, type: 'object' }).nodes.length);
  assert.equal(search(graph, 'outer', { level: 3, type: 'object' }).total, 0);
  assert(search(graph, '', {}, 2).truncated);
  const view = walk(graph, 'pr:1', { direction: 'out', depth: 1, relation: 'changes_file' });
  assert.equal(view.nodes.length, 2); assert.equal(view.nodes[1].id, 'file:site/src/a.js');
  assert(walk(graph, 'file:site/src/a.js', { depth: 2, limit: 2 }).truncated);
  assert.equal(walk(graph, 'pr:1', { depth: 1, direction: 'in' }).nodes.length, 1);
  assert.throws(() => walk(graph, 'pr:1', { depth: 500 }));
});
test('Markdown headings ignore fenced examples and support duplicate and setext selectors', () => {
  const parsed = sections('docs/a.md', '# Hello\n```md\n# Fake\n```\n# Hello\nSection\n=======\n');
  assert.deepEqual(parsed.map(n => n.anchor), ['hello', 'hello-1', 'section']);
});


test('inspection keeps the path root and history until an explicit walk; Back follows path changes only', () => {
  const navigation = createNavigation({ nodes: new Map(['a', 'b', 'c'].map(id => [id, { id }])) });
  assert.equal(navigation.back(), false); assert.equal(navigation.walkFrom('a'), true);
  const revision = navigation.revision;
  assert.equal(navigation.inspect('b'), true); assert.equal(navigation.root, 'a'); assert.equal(navigation.inspected, 'b'); assert.equal(navigation.steps, 0);
  navigation.inspect('a'); assert(navigation.revision > revision); // A→B→A cannot revive an old source request.
  assert.equal(navigation.inspect('missing'), false); assert.equal(navigation.walkFrom('missing'), false); assert.equal(navigation.root, 'a'); assert.equal(navigation.steps, 0);
  navigation.walkFrom('b'); navigation.inspect('c'); assert.equal(navigation.steps, 1); assert.equal(navigation.root, 'b');
  navigation.walkFrom('b'); assert.equal(navigation.steps, 1); assert.equal(navigation.inspected, 'b');
  navigation.walkFrom('c'); assert.equal(navigation.steps, 2);
  navigation.back(); assert.equal(navigation.root, 'b'); assert.equal(navigation.inspected, 'b'); assert.equal(navigation.steps, 1);
  navigation.back(); assert.equal(navigation.root, 'a'); assert.equal(navigation.steps, 0); assert.equal(navigation.back(), false);
});
