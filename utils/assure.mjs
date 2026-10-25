// File-level lineage from tracked public repository artifacts. Never execute a
// source module or read operator configuration while constructing this graph.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { NODE_TYPES, SCHEMA, validateGraph, isRepositoryPath } from '../docs/assure/types.mjs';

const require = createRequire(new URL('../site/package.json', import.meta.url));
const { Linter } = require('eslint');
const { parse } = require('parse5');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = ['docs/assure/lineage.json', 'docs/assure/schema.json', 'docs/assure/REPORT.md'];
const sha = text => createHash('sha256').update(text).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const json = value => JSON.stringify(value, null, 2) + '\n';
// One record per line keeps large graph snapshots and subsequent diffs readable.
const graphJson = graph => '{\n' + Object.entries(graph).map(([key, value]) => `  ${JSON.stringify(key)}: ` + (Array.isArray(value)
  ? '[\n' + value.map(record => '    ' + JSON.stringify(record)).join(',\n') + '\n  ]'
  : JSON.stringify(value))).join(',\n') + '\n}\n';
const loc = (file, line, endLine = line) => ({ path: file, line, endLine });
const evidence = (source, syntax, reference = '', resolution = '') => ({ ...source, syntax, reference, resolution });
const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-');
// Copied labels keep their text; source-relative links must not become broken
// report-relative links. The report supplies its own explicit source links.
const markdown = value => {
  const text = String(value), parts = []; let cursor = 0;
  for (const ref of markdownReferences(text).filter(r => r.syntax === 'markdown_link')) {
    parts.push(text.slice(cursor, ref.start), ref.label); cursor = ref.end;
  }
  parts.push(text.slice(cursor));
  return parts.join('').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('\n', ' ');
};

// Scan each character/run a bounded number of times. In particular, an
// unterminated destination cannot restart exponential regex backtracking.
export function markdownReferences(text) {
  const ticks = new Map(), positions = new Map(), refs = [], brackets = [];
  for (let i = 0; i < text.length;) {
    if (text[i] !== '`') { i++; continue; }
    const start = i; while (text[i] === '`') i++;
    const length = i - start;
    if (!ticks.has(length)) ticks.set(length, []);
    ticks.get(length).push({ start, end: i });
  }
  const destination = start => {
    let i = start;
    while (/\s/u.test(text[i] || '') && i < text.length) i++;
    let reference, end;
    if (text[i] === '<') {
      const from = ++i;
      while (i < text.length && text[i] !== '>') { if (text[i] === '\\' && i + 1 < text.length) i++; i++; }
      if (i === text.length) return { end: i };
      reference = text.slice(from, i++);
    } else {
      const from = i; let depth = 0;
      while (i < text.length) {
        if (text[i] === '\\' && i + 1 < text.length) { i += 2; continue; }
        if (text[i] === '(') depth++;
        else if (text[i] === ')') { if (!depth) break; depth--; }
        else if (/\s/u.test(text[i]) && !depth) break;
        i++;
      }
      reference = text.slice(from, i);
    }
    while (i < text.length && /\s/u.test(text[i])) i++;
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i++];
      while (i < text.length && text[i] !== quote) { if (text[i] === '\\' && i + 1 < text.length) i++; i++; }
      if (text[i] === quote) i++;
      while (i < text.length && /\s/u.test(text[i])) i++;
    }
    if (reference && text[i] === ')') { end = i + 1; return { reference, end }; }
    return { end: Math.min(i + 1, text.length) };
  };
  for (let i = 0; i < text.length;) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '`') {
      const start = i; while (text[i] === '`') i++;
      const length = i - start, runs = ticks.get(length);
      let at = positions.get(length) || 0;
      while (at < runs.length && runs[at].start < start) at++;
      const close = runs[at + 1]; positions.set(length, at + (close ? 2 : 1));
      if (close) { refs.push({ syntax: 'code_span', reference: text.slice(i, close.start), start, end: close.end }); i = close.end; }
      continue;
    }
    if (text[i] === '[') brackets.push(i);
    if (text[i] === ']' && brackets.length) {
      const start = brackets.pop();
      if (text[i + 1] === '(') {
        const found = destination(i + 2);
        if (found.reference) refs.push({ syntax: 'markdown_link', reference: found.reference, label: text.slice(start + 1, i), start, end: found.end });
        brackets.length = 0; i = found.end; continue;
      }
    }
    i++;
  }
  return refs;
}

export function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean).map(row => {
    const match = row.match(/^(\d+) [a-f0-9]+ (\d)\t([\s\S]+)$/);
    if (!match || match[2] !== '0') throw new Error('Resolve Git index conflicts before generating lineage');
    return { path: match[3], mode: match[1] };
  }).sort((a, b) => compare(a.path, b.path));
}

function readText(root, file) {
  // Open first; metadata and bounded reads refer to that same regular file.
  const fd = fs.openSync(path.join(root, file), fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | (fs.constants.O_NOFOLLOW || 0));
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error(`Not a regular lineage input: ${file}`);
    const limit = file === OUTPUTS[0] ? 16 * 1024 * 1024 : 2 * 1024 * 1024;
    const buffer = Buffer.alloc(limit + 1);
    let size = 0, count;
    while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null))) size += count;
    if (size === buffer.length) throw new Error(`Lineage input exceeds ${limit} bytes: ${file}`);
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, size));
  } finally { fs.closeSync(fd); }
}

function markdownLines(text) {
  let fence;
  return text.split('\n').map((text, index) => {
    const mark = text.match(/^\s*(`{3,}|~{3,})/);
    if (mark && !fence) { fence = mark[1]; return { text, line: index + 1, active: false }; }
    if (mark && fence && mark[1][0] === fence[0] && mark[1].length >= fence.length) { fence = undefined; return { text, line: index + 1, active: false }; }
    return { text, line: index + 1, active: !fence };
  });
}

export function resolveReference(file, reference, inventory, syntax) {
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(reference)) return { ignored: true };
  let target;
  try { target = decodeURIComponent(reference.split(/[?#]/)[0]).replace(/\\([\\()[\] <>])/g, '$1'); } catch { return { reason: 'missing', candidates: [] }; }
  const normalize = value => path.posix.normalize(value);
  const relative = normalize(path.posix.join(path.posix.dirname(file), target));
  if (target.startsWith('/') || relative === '..' || relative.startsWith('../')) return { reason: 'outside_repository', candidates: [] };
  const candidates = syntax === 'code_span'
    ? [...new Set([normalize(target), relative, normalize(`site/${target}`)].filter(p => inventory.has(p)))]
    : inventory.has(relative) ? [relative] : [];
  if (candidates.length === 1) return { path: candidates[0], resolution: candidates[0] === relative ? 'relative' : 'repository_path' };
  if (candidates.length > 1) return { reason: 'ambiguous', candidates: candidates.sort(compare) };
  if (syntax === 'code_span' && !target.startsWith('.')) {
    const suffix = [...inventory].filter(p => p === target || p.endsWith('/' + target));
    if (suffix.length === 1) return { path: suffix[0], resolution: 'unique_suffix' };
    if (suffix.length > 1) return { reason: 'ambiguous', candidates: suffix.sort(compare) };
  }
  const prefix = normalize(target).replace(/\/$/, '') + '/';
  return { reason: [...inventory].some(p => p.startsWith(prefix)) ? 'directory' : 'missing', candidates: [] };
}

export function todoReferences(text) {
  const ids = new Set([...text.matchAll(/\b\d+(?:\.\d+)+\b/g)].map(m => m[0]));
  const unsupported = [];
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)+)\s*[–-]\s*(\d+(?:\.\d+)*)\b/g)) {
    const left = match[1].split('.'), right = match[2].includes('.') ? match[2].split('.') : [...left.slice(0, -1), match[2]];
    const start = Number(left.at(-1)), end = Number(right.at(-1));
    if (left.slice(0, -1).join('.') !== right.slice(0, -1).join('.') || end < start || end - start > 100) unsupported.push(match[0]);
    else for (let n = start; n <= end; n++) ids.add([...left.slice(0, -1), n].join('.'));
  }
  for (const match of text.matchAll(/\b(\d+(?:\.\d+)+)((?:\/\d+)+)/g)) for (const n of match[2].slice(1).split('/')) ids.add([...match[1].split('.').slice(0, -1), n].join('.'));
  for (const match of text.matchAll(/\bmilestones?\s+(\d+)(?:\s*[–-]\s*(\d+))?/gi)) {
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (end >= start && end - start <= 100) for (let n = start; n <= end; n++) ids.add(String(n));
  }
  return { ids: [...ids].sort(compare), unsupported };
}

export function buildGraph(root, files = trackedFiles(root)) {
  files = [...files].sort((a, b) => compare(a.path, b.path));
  if (files.some(f => !isRepositoryPath(f.path))) throw new Error('Lineage inventory contains an unsafe repository path');
  const inventory = new Set(files.map(f => f.path));
  const nodes = new Map(), edges = new Map(), unresolved = [], inputs = [], texts = new Map(), owners = new Map();
  const addNode = node => { if (nodes.has(node.id)) throw new Error(`Duplicate identity: ${node.id}`); nodes.set(node.id, node); return node; };
  const addEdge = (type, from, to, ev) => {
    const key = JSON.stringify([type, from, to]);
    if (!edges.has(key)) edges.set(key, { type, from, to, evidence: [] });
    const list = edges.get(key).evidence;
    if (!list.some(e => JSON.stringify(e) === JSON.stringify(ev))) list.push(ev);
  };
  const addItem = node => { addNode(node); addEdge('recorded_in', node.id, `file:${node.source.path}`, evidence(node.source, 'heading')); return node; };
  const issue = (source, reference, reason, candidates = []) => unresolved.push({ source, reference, reason, candidates });
  for (const file of files) {
    const kind = /\.md$/.test(file.path) ? 'documentation' : /(^|\/)(tests?|fixtures)\/|\.test\./.test(file.path) ? 'test'
      : /\.(?:m?js|ts|html|py|sh)$/.test(file.path) ? 'source' : /(?:^|\/)(?:data|eval)\//.test(file.path) || /\.(?:pgn|csv|tsv)$/.test(file.path) ? 'data'
        : /\.(?:json|ya?ml)$|(?:^|\/)(?:\.[^/]+|justfile|Dockerfile|LICENSE)$/.test(file.path) ? 'configuration' : 'asset';
    addNode({ id: `file:${file.path}`, type: 'artifact', path: file.path, kind, mode: file.mode });
    if (['100644', '100755'].includes(file.mode) && !OUTPUTS.includes(file.path) && /\.(?:md|m?js|html)$/.test(file.path)) {
      const text = readText(root, file.path); texts.set(file.path, text); inputs.push({ path: file.path, sha256: sha(text) });
    }
  }
  for (const required of ['docs/TODO.md', 'docs/DONE.md']) if (!texts.has(required)) throw new Error(`Missing tracked input: ${required}`);
  const todoLines = markdownLines(texts.get('docs/TODO.md'));
  const todoItems = [];
  for (let i = 0; i < todoLines.length; i++) {
    const row = todoLines[i]; if (!row.active) continue;
    const group = row.text.match(/^## (\d+)\. (.+)/), item = row.text.match(/^\s*- \[([ xX])\] (\d+(?:\.\d+)+)\s+(.+)/);
    if (group) todoItems.push(addItem({ id: `milestone:${group[1]}`, type: 'milestone', number: group[1], title: group[2], source: loc('docs/TODO.md', row.line) }));
    if (item) {
      let end = i;
      while (end + 1 < todoLines.length && !/^(?:\s*- \[[ xX]\] \d|## )/.test(todoLines[end + 1].text)) end++;
      todoItems.push(addItem({ id: `todo:${item[2]}`, type: 'todo', number: item[2], status: item[1] === ' ' ? 'open' : 'done', text: todoLines.slice(i, end + 1).map(l => l.text).join('\n').trim().replace(/^\s*- \[[ xX]\] \d+(?:\.\d+)+\s+/, ''), source: loc('docs/TODO.md', row.line, end + 1) }));
    }
  }
  for (const node of todoItems.filter(n => n.type === 'todo')) {
    let parent = node.number.split('.').slice(0, -1);
    while (parent.length) {
      const id = `${parent.length === 1 ? 'milestone' : 'todo'}:${parent.join('.')}`;
      if (nodes.has(id)) { addEdge('part_of', node.id, id, evidence(node.source, 'heading')); break; }
      parent = parent.slice(0, -1);
    }
  }
  owners.set('docs/TODO.md', todoItems);
  const doneLines = markdownLines(texts.get('docs/DONE.md'));
  const starts = doneLines.filter(l => l.active && /^## /.test(l.text));
  const doneOwners = [], titles = new Set();
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i], end = (starts[i + 1]?.line || doneLines.length + 1) - 1;
    const title = start.text.slice(3), date = title.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) throw new Error(`DONE entry needs a date at line ${start.line}`);
    const id = `done:${slug(title)}`;
    if (titles.has(id)) throw new Error(`DONE headings must have distinct stable identities: ${title}`);
    titles.add(id);
    const rows = doneLines.slice(start.line - 1, end), annotation = rows.find(l => l.active && /^TODO items?:/i.test(l.text));
    const entry = addItem({ id, type: 'done', title, date, annotation: annotation?.text || '', source: loc('docs/DONE.md', start.line, end) }); doneOwners.push(entry);
    if (annotation) {
      const refs = todoReferences(annotation.text);
      for (const number of refs.ids) {
        const target = `${number.includes('.') ? 'todo' : 'milestone'}:${number}`;
        if (nodes.has(target)) addEdge('references_todo', id, target, evidence(loc('docs/DONE.md', annotation.line), 'todo_annotation', annotation.text, 'identifier_or_expanded_range'));
        else issue(loc('docs/DONE.md', annotation.line), number, 'unknown_todo');
      }
      refs.unsupported.forEach(ref => issue(loc('docs/DONE.md', annotation.line), ref, 'unsupported_range'));
    }
    let heading = '', noteStart, buffer = [];
    const flush = () => {
      const text = buffer.map(l => l.text).join('\n').trim();
      if (text) {
        const type = /deviation/i.test(heading) && /insight/i.test(heading) ? 'reflection' : /deviation/i.test(heading) ? 'deviation' : 'insight';
        const note = addItem({ id: `${id}/${type}:${sha(text).slice(0, 16)}`, type, text, heading, source: loc('docs/DONE.md', noteStart, buffer.at(-1).line) });
        addEdge(`has_${type}`, id, note.id, evidence(note.source, 'section')); doneOwners.push(note);
      }
      noteStart = undefined; buffer = [];
    };
    for (const row of rows) {
      if (row.active && /^### /.test(row.text)) { flush(); heading = row.text.slice(4); continue; }
      if (!/deviation|insight/i.test(heading)) continue;
      if (row.active && /^- /.test(row.text)) flush();
      if (!row.text.trim() && !buffer.length) continue;
      if (row.active && !row.text.trim()) { flush(); continue; }
      noteStart ??= row.line; buffer.push(row);
    }
    flush();
  }
  owners.set('docs/DONE.md', doneOwners);
  const attach = (file, line, reference, syntax) => {
    const found = resolveReference(file, reference, inventory, syntax);
    if (found.ignored) return;
    if (!found.path) { issue(loc(file, line), reference, found.reason, found.candidates); return; }
    const type = syntax === 'js_import' ? 'imports' : syntax === 'markdown_link' ? 'links_to' : 'mentions';
    const ev = evidence(loc(file, line), syntax, reference, found.resolution);
    addEdge(type, `file:${file}`, `file:${found.path}`, ev);
    const owner = (owners.get(file) || []).filter(n => n.source.line <= line && n.source.endLine >= line).sort((a, b) => (a.source.endLine - a.source.line) - (b.source.endLine - b.source.line))[0];
    if (owner) addEdge(type, owner.id, `file:${found.path}`, ev);
  };
  const parseImports = (file, text, offset = 0, sourceType = 'module') => {
    const linter = new Linter();
    const problems = linter.verify(text, [{ languageOptions: { ecmaVersion: 'latest', sourceType } }]);
    if (problems.some(p => p.fatal)) { for (const p of problems.filter(p => p.fatal)) issue(loc(file, offset + (p.line || 1)), p.message, 'parse_error'); return; }
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      const source = ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) ? node.source
        : node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length === 1 ? node.arguments[0] : undefined;
      if (source?.type === 'Literal' && typeof source.value === 'string' && source.value.startsWith('.')) attach(file, offset + source.loc.start.line, source.value, 'js_import');
      for (const [key, child] of Object.entries(node)) if (!['loc', 'range', 'tokens', 'comments', 'parent'].includes(key)) {
        if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child);
      }
    };
    walk(linter.getSourceCode().ast);
  };
  for (const [file, text] of texts) {
    if (file.endsWith('.md')) for (const row of markdownLines(text).filter(l => l.active)) {
      for (const found of markdownReferences(row.text)) {
        const ref = found.reference;
        if (found.syntax === 'markdown_link' || /^(?:[\w./@%+ -]+\.(?:m?js|ts|md|html|json|css|ya?ml|pgn|csv|tsv|pdf|wasm|sh|py|svg|png|jpe?g|gif|webp|ttf|woff2?|txt|sqlite)|(?:[\w./-]*\/)?(?:justfile|Dockerfile|LICENSE|\.[\w.-]+)|[\w./-]+\/)$/u.test(ref)) attach(file, row.line, ref, found.syntax);
      }
    }
    else if (/\.m?js$/.test(file)) parseImports(file, text);
    else if (file.endsWith('.html')) {
      const walk = node => {
        if (node.tagName === 'script' && ['', 'module', 'text/javascript', 'application/javascript'].includes(node.attrs.find(a => a.name === 'type')?.value || '') && !node.attrs.some(a => a.name === 'src')) {
          parseImports(file, (node.childNodes || []).map(n => n.value || '').join(''), (node.sourceCodeLocation?.startTag.endLine || 1) - 1, node.attrs.some(a => a.name === 'type' && a.value === 'module') ? 'module' : 'script');
        }
        (node.childNodes || []).forEach(walk);
      };
      walk(parse(text, { sourceCodeLocationInfo: true }));
    }
  }
  const graph = { schemaVersion: 1, inventorySha256: sha(json(files)), inputs: inputs.sort((a, b) => compare(a.path, b.path)), nodes: [...nodes.values()].sort((a, b) => compare(a.id, b.id)), edges: [...edges.values()].sort((a, b) => compare(JSON.stringify([a.type, a.from, a.to]), JSON.stringify([b.type, b.from, b.to]))), unresolved: [...new Map(unresolved.map(u => [JSON.stringify(u), u])).values()].sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))) };
  for (const edge of graph.edges) edge.evidence.sort((a, b) => compare(a.path, b.path) || a.line - b.line || compare(a.reference, b.reference));
  return validateGraph(graph);
}

export function neighborhood(graph, id, depth = 2, limit = 150) {
  validateGraph(graph);
  if (!graph.nodes.some(n => n.id === id)) throw new Error(`Unknown lineage node: ${id}`);
  if (!Number.isSafeInteger(depth) || depth < 0 || depth > 4) throw new Error('Depth must be 0–4');
  const seen = new Set([id]); let frontier = [id], truncated = false;
  const relations = graph.edges.filter(e => !['recorded_in', 'part_of'].includes(e.type));
  for (let step = 0; step < depth; step++) {
    const next = [];
    for (const edge of relations) for (const [from, to] of [[edge.from, edge.to], [edge.to, edge.from]]) if (frontier.includes(from) && !seen.has(to)) {
      if (seen.size >= limit) { truncated = true; continue; }
      seen.add(to); next.push(to);
    }
    frontier = next;
  }
  return { root: id, depth, truncated, nodes: graph.nodes.filter(n => seen.has(n.id)), edges: graph.edges.filter(e => seen.has(e.from) && seen.has(e.to)) };
}

export function renderReport(graph) {
  const counts = Object.fromEntries(NODE_TYPES.map(t => [t, graph.nodes.filter(n => n.type === t).length]));
  const todos = graph.nodes.filter(n => n.type === 'todo').sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }));
  const done = graph.nodes.filter(n => n.type === 'done').sort((a, b) => b.source.line - a.source.line).reverse();
  const fileLink = source => `[${source.path}:${source.line}](../../${source.path})`;
  const incoming = id => graph.edges.filter(e => e.type === 'references_todo' && e.to === id);
  const connected = new Set(graph.edges.flatMap(e => [e.from, e.to]));
  const unlinkedFiles = graph.nodes.filter(n => n.type === 'artifact' && !connected.has(n.id));
  const out = ['# Assurance lineage report', '', 'Generated by `node utils/assure.mjs build`. Counts describe extracted references, not requirement satisfaction or verified evidence.', '', '```mermaid', 'flowchart LR', '  D[DONE entry] -->|references_todo| T[TODO item]', '  T -->|part_of| M[Milestone / parent TODO]', '  D -->|has_insight| I[Insight]', '  D -->|has_deviation| V[Deviation]', '  D -->|has_reflection| R[Combined reflection]', '  D -->|mentions / links_to| A[File artifact]', '  I -->|mentions / links_to| A', '  V -->|mentions / links_to| A', '  A -->|imports / links_to / mentions| B[File artifact]', '```', '', '## Inventory', '', '| Node type | Count |', '| --- | ---: |', ...Object.entries(counts).map(([type, count]) => `| ${type} | ${count} |`), '', `${graph.edges.length} typed edges; ${graph.inputs.length} scanned text inputs; ${graph.unresolved.length} unresolved references.`, '', '## TODO → DONE index', '', 'A DONE reference may describe partial work, deferred scope or a limitation. Checkbox state is copied only from TODO.md.', '', '| TODO | Checkbox | DONE references | Source |', '| --- | --- | ---: | --- |'];
  for (const todo of todos) out.push(`| ${todo.number}: ${markdown(todo.text.split('\n')[0])} | ${todo.status} | ${incoming(todo.id).length} | ${fileLink(todo.source)} |`);
  out.push('', '## DONE → rationale and scope', '', '| Entry | TODO references | Insights | Deviations | Combined |', '| --- | --- | ---: | ---: | ---: |');
  for (const entry of done) {
    const edges = graph.edges.filter(e => e.from === entry.id);
    const refs = edges.filter(e => e.type === 'references_todo').map(e => e.to.replace(/^(todo|milestone):/, '')).join(', ') || 'none recorded';
    out.push(`| [${markdown(entry.title)}](../DONE.md#${entry.id.slice(5)}) | ${refs} | ${edges.filter(e => e.type === 'has_insight').length} | ${edges.filter(e => e.type === 'has_deviation').length} | ${edges.filter(e => e.type === 'has_reflection').length} |`);
  }
  out.push('', '## Coverage gaps', '', `- ${todos.filter(n => n.status === 'done' && !incoming(n.id).length).length} checked TODO items have no DONE annotation reference.`, `- ${done.filter(n => !graph.edges.some(e => e.from === n.id && e.type === 'references_todo')).length} DONE entries have no resolvable TODO annotation reference.`, '', 'Unresolved paths, directories, ambiguous short names and unknown TODO IDs remain explicit in `lineage.json`. The first fifty records are shown here; no renamed path or completion claim is invented.', '', '| Source | Reference | Reason |', '| --- | --- | --- |');
  for (const item of graph.unresolved.slice(0, 50)) out.push(`| ${fileLink(item.source)} | ${markdown(item.reference)} | ${item.reason} |`);
  out.push('', `### Files without extracted relationships (${unlinkedFiles.length})`, '', 'The first thirty are listed; these files remain in the inventory. Extraction coverage is described in README.md.', '');
  for (const file of unlinkedFiles.slice(0, 30)) out.push(`- [${markdown(file.path)}](../../${file.path.split('/').map(encodeURIComponent).join('/')})`);
  return out.join('\n') + '\n';
}

export function run(argv = process.argv.slice(2), root = ROOT) {
  const [command = 'check', target, ...extra] = argv;
  if (!['build', 'check', 'query'].includes(command) || command !== 'query' && (target || extra.length) || command === 'query' && (!target || extra.length)) throw new Error('Usage: node utils/assure.mjs build|check|query NODE_OR_PATH');
  if (command === 'query') {
    const graph = validateGraph(JSON.parse(readText(root, OUTPUTS[0])));
    const id = /^\d+(?:\.\d+)+$/.test(target) ? `todo:${target}` : graph.nodes.some(n => n.id === target) ? target : `file:${target}`;
    process.stdout.write(json(neighborhood(graph, id))); return;
  }
  const graph = buildGraph(root), values = [graphJson(graph), json(SCHEMA), renderReport(graph)];
  if (command === 'build') OUTPUTS.forEach((file, i) => fs.writeFileSync(path.join(root, file), values[i]));
  else for (let i = 0; i < OUTPUTS.length; i++) if (readText(root, OUTPUTS[i]) !== values[i]) throw new Error(`Stale assurance artifact: ${OUTPUTS[i]}; run node utils/assure.mjs build and stage the outputs`);
  return { nodes: graph.nodes.length, edges: graph.edges.length, unresolved: graph.unresolved.length };
}
const isMain = () => {
  try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
};
if (isMain()) {
  try { const result = run(); if (result) console.log(`${JSON.stringify(result)} — reference lineage, not verification`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
