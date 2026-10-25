import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGraph, trackedFiles, resolveReference, todoReferences, neighborhood, renderReport, run } from '../../../utils/assure.mjs';
import { validateGraph, SCHEMA } from '../../../docs/assure/types.mjs';

const TODO = '# TODO\n\n## 0. Foundation\n\n- [x] 0.1 Build `site/src/a.js`\n- [ ] 0.2 More work\n';
const DONE = '# DONE\n\n## 2026-10-25 — First entry\n\nTODO items: 0.1 done; 0.2 partly.\n\n### Implementation notes\n\n- Built `site/src/a.js`.\n\n### Deviations\n\n- `site/src/b.js` still needs work.\n\n### Insights\n\n- Keep the evidence [nearby](../README.md).\n';
function fixture(t, changes = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-lineage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const content = { 'docs/TODO.md': TODO, 'docs/DONE.md': DONE, 'README.md': '# Project\n', 'site/src/a.js': 'import { b } from "./b.js";\nexport const a = b;\n', 'site/src/b.js': 'export const b = 1;\n', ...changes };
  for (const [file, text] of Object.entries(content)) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); }
  return { root, files: Object.keys(content).map(path => ({ path, mode: '100644' })) };
}

test('the complete lineage preserves open TODO status and typed, source-backed rationale paths', t => {
  const { root, files } = fixture(t, {
    'docs/DONE.md': DONE + '\n- Keep `site/src/icon.svg`, `site/fonts/local.ttf` and `site/screens/test.png` linked.\n',
    'site/src/icon.svg': '<svg/>', 'site/fonts/local.ttf': 'font fixture', 'site/screens/test.png': 'image fixture',
  }), graph = buildGraph(root, files);
  const done = graph.nodes.find(n => n.type === 'done');
  assert.equal(graph.nodes.find(n => n.id === 'todo:0.2').status, 'open');
  for (const type of ['insight', 'deviation']) {
    const note = graph.nodes.find(n => n.type === type);
    assert.ok(graph.edges.some(e => e.type === `has_${type}` && e.from === done.id && e.to === note.id));
    assert.ok(graph.edges.some(e => e.from === note.id && e.to.startsWith('file:') && ['mentions', 'links_to'].includes(e.type)));
    const source = fs.readFileSync(path.join(root, note.source.path), 'utf8').split('\n').slice(note.source.line - 1, note.source.endLine).join('\n');
    assert.equal(source.trim(), note.text);
  }
  assert.ok(graph.edges.some(e => e.type === 'references_todo' && e.from === done.id && e.to === 'todo:0.2'));
  assert.ok(graph.edges.some(e => e.type === 'part_of' && e.from === 'todo:0.1' && e.to === 'milestone:0'));
  assert.ok(graph.edges.some(e => e.type === 'imports' && e.from === 'file:site/src/a.js' && e.to === 'file:site/src/b.js'));
  for (const file of ['site/src/icon.svg', 'site/fonts/local.ttf', 'site/screens/test.png']) {
    assert.ok(graph.edges.some(e => e.type === 'mentions' && e.to === `file:${file}`));
    assert.equal(graph.inputs.some(i => i.path === file), false, 'binary assets are referenced without reading them');
  }
  assert.equal(validateGraph(graph), graph);
});

test('TODO ranges, sibling shorthand and contextual references do not become completion assertions', () => {
  assert.deepEqual(todoReferences('TODO items: 5.6.1–5.6.3; 11.3.4–6; 11.3.2/3/9; milestones 5–6.').ids,
    ['11.3.2', '11.3.3', '11.3.4', '11.3.5', '11.3.6', '11.3.9', '5', '5.6.1', '5.6.2', '5.6.3', '6']);
  assert.deepEqual(todoReferences('TODO items: 1.2–2.4.').unsupported, ['1.2–2.4']);
});

test('unknown TODOs, historical paths, directories and ambiguous names remain explicit gaps', t => {
  const { root, files } = fixture(t, { 'docs/DONE.md': DONE.replace('0.2 partly', '0.2 partly; 9.99 remains open') + '\n- `a.js`, `site/src/old/a.js` and `site/` need review.\n', 'other/a.js': 'export {};\n' });
  const graph = buildGraph(root, files);
  for (const [ref, reason] of [['9.99', 'unknown_todo'], ['a.js', 'ambiguous'], ['site/src/old/a.js', 'missing'], ['site/', 'directory']]) {
    assert.ok(graph.unresolved.some(u => u.reference === ref && u.reason === reason), `${ref}: ${reason}`);
  }
  assert.equal(graph.nodes.some(n => n.id === 'todo:9.99'), false);
  assert.equal(graph.edges.some(e => e.evidence.some(v => v.reference === 'site/src/old/a.js')), false);
});

test('Markdown resolution uses exact local links and records unique-suffix evidence without guessing ambiguous names', () => {
  const files = new Set(['README.md', 'docs/guide with spaces.md', 'site/src/a.js', 'other/a.js', 'site/src/b.js']);
  assert.equal(resolveReference('docs/TODO.md', './guide%20with%20spaces.md#part', files, 'markdown_link').path, 'docs/guide with spaces.md');
  assert.equal(resolveReference('docs/DONE.md', 'b.js', files, 'code_span').resolution, 'unique_suffix');
  assert.equal(resolveReference('docs/DONE.md', 'a.js', files, 'code_span').reason, 'ambiguous');
  assert.equal(resolveReference('docs/DONE.md', 'b.js', files, 'markdown_link').reason, 'missing');
  assert.equal(resolveReference('docs/DONE.md', '../../private.md', files, 'markdown_link').reason, 'outside_repository');
  assert.equal(resolveReference('docs/DONE.md', 'https://example.invalid/private.md', files, 'markdown_link').ignored, true);
});

test('fenced examples cannot create TODOs or links; combined rationale headings remain a distinct type', t => {
  const { root, files } = fixture(t, { 'docs/TODO.md': TODO + '\n```md\n- [x] 9.99 Example only\n```\n', 'docs/DONE.md': DONE.replace('### Deviations', '### Deviations and insights').replace('### Insights\n\n- Keep the evidence [nearby](../README.md).', '```js\nimport x from "./not-real.js";\n```') });
  const graph = buildGraph(root, files);
  assert.equal(graph.nodes.some(n => n.id === 'todo:9.99'), false);
  assert.ok(graph.nodes.some(n => n.type === 'reflection'));
  assert.equal(graph.unresolved.some(u => u.reference === './not-real.js'), false);
});

test('AST extraction ignores strings/comments and dynamic expressions but retains literal module edges and HTML locations', t => {
  const { root, files } = fixture(t, {
    'site/src/a.js': '// import z from "./not-real.js"\nconst prose = \'import z from "./not-real.js"\';\nexport { b } from "./b.js";\nimport("./b.js");\nimport(prose);\nrequire("./b.js");\n',
    'site/src/index.html': '<!doctype html>\n<script type="application/json">{"x":"ignored"}</script>\n<script type="module">\nimport { b } from "./b.js";\n</script>\n',
    'site/src/broken.js': 'export const = ;',
  });
  const graph = buildGraph(root, files), edge = graph.edges.find(e => e.type === 'imports' && e.from === 'file:site/src/a.js');
  assert.equal(edge.evidence.length, 3);
  assert.equal(graph.unresolved.some(u => u.reference.includes('not-real')), false);
  assert.equal(graph.edges.find(e => e.type === 'imports' && e.from === 'file:site/src/index.html').evidence[0].line, 4);
  assert.ok(graph.unresolved.some(u => u.source.path === 'site/src/broken.js' && u.reason === 'parse_error'));
});

test('identities survive line shifts and inventory order; unrelated additions do not rename rationale', t => {
  const { root, files } = fixture(t), before = buildGraph(root, files);
  assert.deepEqual(before, buildGraph(root, [...files].reverse()));
  fs.writeFileSync(path.join(root, 'docs/DONE.md'), '\n\n' + DONE);
  const after = buildGraph(root, files);
  assert.deepEqual(before.nodes.map(n => n.id), after.nodes.map(n => n.id));
  assert.notDeepEqual(before.inputs, after.inputs);
  assert.equal(after.nodes.find(n => n.type === 'insight').source.line, before.nodes.find(n => n.type === 'insight').source.line + 2);
});

test('duplicate TODO or DONE identities stop generation', t => {
  const { root, files } = fixture(t, { 'docs/TODO.md': TODO + '\n- [ ] 0.1 Duplicate\n' });
  assert.throws(() => buildGraph(root, files), /Duplicate identity/);
  fs.writeFileSync(path.join(root, 'docs/TODO.md'), TODO);
  fs.writeFileSync(path.join(root, 'docs/DONE.md'), DONE + '\n' + DONE.slice(DONE.indexOf('## ')));
  assert.throws(() => buildGraph(root, files), /distinct stable identities/);
});

test('validation rejects dangling/mistyped edges, duplicates, missing evidence, orphan notes and invalid source paths', t => {
  const { root, files } = fixture(t), original = buildGraph(root, files);
  for (const mutate of [
    g => { g.edges[0].to = 'file:absent.js'; },
    g => { g.edges[0].type = 'satisfies'; },
    g => { g.nodes.push(g.nodes[0]); },
    g => { g.edges.push(g.edges[0]); },
    g => { g.edges[0].evidence = []; },
    g => { g.edges = g.edges.filter(e => e.type !== 'has_insight'); },
    g => { g.edges.find(e => e.type === 'has_insight').to = 'todo:0.1'; },
    g => { g.nodes.find(n => n.type === 'insight').source.path = '../outside.md'; },
    g => { g.nodes.find(n => n.type === 'insight').source.endLine = 9999; },
    g => { g.edges.find(e => e.type === 'part_of').to = 'todo:0.2'; },
  ]) { const graph = structuredClone(original); mutate(graph); assert.throws(() => validateGraph(graph)); }
  assert.equal(SCHEMA.properties.edges.items.properties.type.enum.includes('satisfies'), false);
});

test('queries traverse rationale with explicit bounds and do not expand the complete log via containment', t => {
  const { root, files } = fixture(t), graph = buildGraph(root, files), result = neighborhood(graph, 'todo:0.2');
  assert.ok(result.nodes.some(n => n.type === 'insight'));
  assert.ok(result.nodes.some(n => n.type === 'deviation'));
  assert.equal(result.nodes.some(n => n.id === 'milestone:0'), false);
  assert.equal(neighborhood(graph, 'todo:0.2', 2, 2).truncated, true);
  assert.throws(() => neighborhood(graph, 'todo:404'), /Unknown/);
  assert.throws(() => neighborhood(graph, 'todo:0.1', 99), /Depth/);
  assert.match(renderReport(graph), /0\.2: More work \| open/);
});

test('report labels cannot move source-relative links or introduce HTML, and CLI import/alias entry is safe', t => {
  const { root, files } = fixture(t, { 'docs/TODO.md': TODO.replace('More work', 'Read [the design](AI-DESIGN.md), <img src=x> | follow-up') });
  const report = renderReport(buildGraph(root, files));
  assert.ok(!report.includes('](AI-DESIGN.md)'));
  assert.ok(!report.includes('<img'));
  assert.ok(report.includes('&lt;img src=x&gt; \\| follow-up'));
  const script = fileURLToPath(new URL('../../../utils/assure.mjs', import.meta.url));
  const imported = spawnSync(process.execPath, ['--input-type=module'], { input: `await import(${JSON.stringify(new URL('../../../utils/assure.mjs', import.meta.url).href)});`, encoding: 'utf8' });
  assert.equal(imported.status, 0); assert.equal(imported.stdout, ''); assert.equal(imported.stderr, '');
  const alias = path.join(root, 'assure-alias.mjs'); fs.symlinkSync(script, alias);
  const cli = spawnSync(process.execPath, [alias, 'unknown'], { encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.match(cli.stderr, /Usage:/);
});

test('only tracked paths are inventoried, symlinks are not read, and regenerated output has an exact freshness check', t => {
  const { root } = fixture(t, { '.gitignore': '.env\n', '.env': 'synthetic-secret=not-an-input', 'untracked.md': '# Private draft\n' });
  for (const file of ['lineage.json', 'schema.json', 'REPORT.md']) { fs.mkdirSync(path.join(root, 'docs/assure'), { recursive: true }); fs.writeFileSync(path.join(root, 'docs/assure', file), ''); }
  fs.symlinkSync('../.env', path.join(root, 'docs/symlink.md'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.gitignore', 'README.md', 'docs', 'site'], { cwd: root });
  const files = trackedFiles(root);
  assert.equal(files.some(f => f.path === '.env' || f.path === 'untracked.md'), false);
  assert.equal(buildGraph(root, files).inputs.some(i => i.path === 'docs/symlink.md'), false);
  run(['build'], root); run(['check'], root);
  fs.writeFileSync(path.join(root, 'README.md'), '# Changed\n');
  assert.throws(() => run(['check'], root), /Stale assurance artifact/);
  run(['build'], root); run(['check'], root);
  for (const file of ['../secret.md', '/absolute.md', 'docs/../secret.md', 'docs/\u0000secret.md', 'docs/\u001fsecret.md']) {
    assert.throws(() => buildGraph(root, [{ path: file, mode: '100644' }]), /unsafe repository path/);
  }
});
