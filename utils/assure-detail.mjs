// Reproducible finer-grained reference lineage. Parsing never evaluates inputs.
import { classifyLink } from '../docs/assure/confidence.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { trackedFiles, readText, markdownLines, markdownReferences, resolveReference, todoReferences } from './assure.mjs';
import { DETAIL_SCHEMA, validateLayers } from '../docs/assure/detail-types.mjs';
const require = createRequire(new URL('../site/package.json', import.meta.url));
const { Linter } = require('eslint'), { parse } = require('parse5');
const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const REPOSITORY = 'gregoryyy/kibitz';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const compact = graph => '{\n' + Object.entries(graph).map(([key, value]) => `  ${JSON.stringify(key)}: ` + (Array.isArray(value) ? '[\n' + value.map(v => '    ' + JSON.stringify(v)).join(',\n') + '\n  ]' : JSON.stringify(value))).join(',\n') + '\n}\n';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-');
const lineIndexes = new Map();
const lineAt = (text, offset) => {
  if (!lineIndexes.has(text)) {
    const starts = [0]; let at = text.indexOf('\n');
    while (at >= 0) { starts.push(at + 1); at = text.indexOf('\n', at + 1); }
    lineIndexes.set(text, starts);
  }
  const starts = lineIndexes.get(text); let low = 0, high = starts.length;
  while (low < high) { const mid = (low + high) >>> 1; if (starts[mid] <= offset) low = mid + 1; else high = mid; }
  return low;
};
const sourceAt = (file, text, start, end) => ({ path: file, line: lineAt(text, start), endLine: lineAt(text, Math.max(start, end - 1)) });
const locator = (text, start, end, selector, parser) => ({ start, end, sha256: sha256(text.slice(start, end)), selector, parser });
const OUTPUTS = ['docs/assure/objects.json', 'docs/assure/documents.json', 'docs/assure/detail-schema.json'];

// Explicit refresh only. CI/build/check use the retained public metadata offline.
export function refreshPullRequests(root = ROOT) {
  const pulls = []; let after = null;
  do {
    const query = `query($after:String){repository(owner:"gregoryyy",name:"kibitz"){pullRequests(first:50,after:$after,orderBy:{field:CREATED_AT,direction:ASC}){pageInfo{hasNextPage endCursor}nodes{number title body state url baseRefOid headRefOid files(first:100){totalCount nodes{path}}}}}}`;
    const args = ['api', 'graphql', '-f', `query=${query}`];
    if (after) args.push('-f', `after=${after}`);
    const response = JSON.parse(execFileSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
    if (response.errors) throw new Error('PR metadata request failed');
    const page = response.data.repository.pullRequests;
    for (const pr of page.nodes) {
      // Paginate file lists explicitly, even for the larger early source PRs.
      const files = pr.files.totalCount <= 100 ? pr.files.nodes.map(f => f.path) : JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${REPOSITORY}/pulls/${pr.number}/files?per_page=100`], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })).flat().map(f => f.filename);
      pulls.push({ number: pr.number, title: pr.title, body: pr.body, state: pr.state, url: pr.url, head: pr.headRefOid, base: pr.baseRefOid, files: files.sort(compare), filesComplete: files.length === pr.files.totalCount });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  const snapshot = { schemaVersion: 1, repository: REPOSITORY, pulls: pulls.sort((a, b) => a.number - b.number) };
  fs.writeFileSync(path.join(root, 'docs/assure/pull-requests.json'), json(snapshot));
  return { pullRequests: pulls.length };
}
export function validatePullRequests(snapshot) {
  if (snapshot.schemaVersion !== 1 || snapshot.repository !== REPOSITORY || !Array.isArray(snapshot.pulls)) throw new Error('Invalid PR snapshot');
  const seen = new Set();
  for (const pr of snapshot.pulls) {
    if (!Number.isSafeInteger(pr.number) || pr.number < 1 || seen.has(pr.number) || typeof pr.title !== 'string' || typeof pr.body !== 'string' || !['OPEN', 'MERGED', 'CLOSED'].includes(pr.state) || pr.url !== `https://github.com/${REPOSITORY}/pull/${pr.number}` || !/^[a-f0-9]{40}$/.test(pr.head) || !/^[a-f0-9]{40}$/.test(pr.base) || !Array.isArray(pr.files) || pr.files.some(p => typeof p !== 'string') || typeof pr.filesComplete !== 'boolean') throw new Error('Invalid PR record');
    seen.add(pr.number);
  }
  return snapshot;
}

// UTF-16 ranges refer to the complete UTF-8 decoded file/body. Selectors replay
// structure; SHA-256 verifies exact selected bytes after UTF-8 encoding.
export function sections(file, text, prefix = 'section') {
  const rows = markdownLines(text), starts = [], offsets = []; let offset = 0;
  for (const row of rows) { offsets.push(offset); offset += row.text.length + 1; }
  const slugs = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; if (!row.active) continue;
    const atx = row.text.match(/^ {0,3}(#{1,6})[ \t]+(.*)$/);
    if (atx) {
      atx[2] = atx[2].trimEnd(); let close = atx[2].length;
      while (atx[2][close - 1] === '#') close--;
      if (close < atx[2].length && /[ \t]/.test(atx[2][close - 1] || '')) atx[2] = atx[2].slice(0, close).trimEnd();
    }
    const setext = i + 1 < rows.length && rows[i + 1].active && /^ {0,3}(?:=+|-+)\s*$/.test(rows[i + 1].text) && row.text.trim() && !/^\s*[-*>]/.test(row.text);
    if (!atx && !setext) continue;
    const name = atx ? atx[2] : row.text.trim(), depth = atx ? atx[1].length : rows[i + 1].text.trim()[0] === '=' ? 1 : 2;
    const stem = slug(name), count = slugs.get(stem) || 0; slugs.set(stem, count + 1);
    starts.push({ name, depth, anchor: stem + (count ? `-${count}` : ''), start: offsets[i] });
    if (setext) i++;
  }
  return starts.map((s, i) => {
    const end = starts.slice(i + 1).find(n => n.depth <= s.depth)?.start ?? text.length;
    return { id: `${prefix}:${file}#${s.anchor}`, type: prefix === 'pr_section' ? 'pr_section' : 'section', name: s.name, anchor: s.anchor,
      source: sourceAt(file, text, s.start, end), locator: locator(text, s.start, end, `heading:${s.anchor}`, 'markdown-headings-1'), depth: s.depth };
  });
}
const ownerAt = (nodes, offset, fallback) => nodes.filter(n => n.locator.start <= offset && offset < n.locator.end).sort((a, b) => b.locator.start - a.locator.start || a.locator.end - b.locator.end)[0]?.id || fallback;

export function buildDetails(root, base, files = trackedFiles(root), prs = validatePullRequests(JSON.parse(readText(root, 'docs/assure/pull-requests.json')))) {
  const baseText = compact(base), make = level => ({ schemaVersion: 2, level, extractor: 'kibitz-detail-1', baseSha256: sha256(baseText), exclusions: { externalImportCalls: 0, memberOrDynamicCalls: 0 }, inputs: [], nodes: [], edges: [], unresolved: [] });
  const objects = make(2), documents = make(3), inventory = new Set(files.map(f => f.path)), texts = new Map(), edgeMaps = new Map([[objects, new Map()], [documents, new Map()]]);
  const addEdge = (layer, type, from, to, source, reference, resolution) => {
    const edge = { type, from, to, evidence: { source, reference, resolution } }, key = JSON.stringify([type, from, to]);
    if (!edgeMaps.get(layer).has(key)) { edgeMaps.get(layer).set(key, edge); layer.edges.push(edge); }
  };
  const issue = (layer, source, reference, reason, candidates = []) => layer.unresolved.push({ source, reference, reason, candidates });
  const modules = new Map(), exports = new Map(), pendingImports = [];
  for (const file of files) {
    if (!['100644', '100755'].includes(file.mode) || !/\.(?:md|m?js|html)$/.test(file.path) || ['docs/assure/report.md', 'docs/assure/findings.md'].includes(file.path)) continue;
    const text = readText(root, file.path); texts.set(file.path, text);
    if (!/\.(?:m?js|html)$/.test(file.path)) continue;
    objects.inputs.push({ path: file.path, sha256: sha256(text) });
    const extracted = [], units = [];
    if (file.path.endsWith('.html')) {
      const walk = node => {
        if (node.tagName === 'script' && !node.attrs.some(a => a.name === 'src') && ['', 'module', 'text/javascript', 'application/javascript'].includes(node.attrs.find(a => a.name === 'type')?.value || '')) {
          const start = node.sourceCodeLocation.startTag.endOffset, end = node.sourceCodeLocation.endTag?.startOffset ?? text.length;
          units.push({ text: text.slice(start, end), offset: start, sourceType: node.attrs.some(a => a.name === 'type' && a.value === 'module') ? 'module' : 'script', prefix: `script[${units.length}]` });
        }
        (node.childNodes || []).forEach(walk);
      }; walk(parse(text, { sourceCodeLocationInfo: true }));
    } else units.push({ text, offset: 0, sourceType: 'module', prefix: 'program' });
    const ordinals = new Map();
    for (const unit of units) {
      const linter = new Linter(), messages = linter.verify(unit.text, [{ languageOptions: { ecmaVersion: 'latest', sourceType: unit.sourceType } }]);
      if (messages.some(m => m.fatal)) { issue(objects, sourceAt(file.path, text, unit.offset, unit.offset + unit.text.length), unit.prefix, 'parse_error'); continue; }
      const code = linter.getSourceCode(), ast = code.ast, byAst = new Map(), parents = new Map(), selectors = new Map();
      const walk = (node, parent, selector, parentObject, qualified = '') => {
        if (!node || typeof node.type !== 'string') return;
        parents.set(node, parent); selectors.set(node, selector);
        const isFunction = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type), isClass = /^(?:ClassDeclaration|ClassExpression)$/.test(node.type);
        const block = node.type === 'BlockStatement' && !/^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(parent?.type || '');
        let current = parentObject, childQualified = qualified;
        if (isFunction || isClass || block) {
          const start = unit.offset + node.range[0], end = unit.offset + node.range[1];
          const inferred = node.id?.name || (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier' ? parent.id.name : ['MethodDefinition', 'Property', 'PropertyDefinition'].includes(parent?.type) && !parent.computed ? parent.key.name || parent.key.value : null);
          const kind = isClass ? 'class' : block ? 'block' : parent?.type === 'MethodDefinition' ? 'method' : 'function';
          const name = String(inferred || `<${block ? parent?.type || 'block' : node.type}:${sha256(text.slice(start, end)).slice(0, 12)}>`);
          childQualified = qualified ? `${qualified}/${name}` : name;
          const stem = `${unit.prefix}:${childQualified}:${kind}`, ordinal = ordinals.get(stem) || 0; ordinals.set(stem, ordinal + 1);
          current = { id: `object:${file.path}#${encodeURIComponent(stem)}:${ordinal}`, type: 'object', name: childQualified, kind, source: sourceAt(file.path, text, start, end), locator: locator(text, start, end, `${unit.prefix}${selector}`, `eslint-estree-1`) };
          objects.nodes.push(current); extracted.push(current); byAst.set(node, current);
          if (parent?.type === 'VariableDeclarator') byAst.set(parent, current);
          if (parent?.type === 'MethodDefinition') byAst.set(parent, current);
          addEdge(objects, 'contains_object', parentObject?.id || `file:${file.path}`, current.id, current.source, current.name, 'AST containment');
        }
        for (const [key, value] of Object.entries(node)) {
          if (['parent', 'loc', 'range', 'tokens', 'comments'].includes(key)) continue;
          if (Array.isArray(value)) value.forEach((child, i) => { if (child?.type) walk(child, node, `${selector}/${key}[${i}]`, current, childQualified); });
          else if (value?.type) walk(value, node, `${selector}/${key}`, current, childQualified);
        }
      }; walk(ast, null, '', null);
      const defs = new Map(), references = new Map();
      for (const scope of code.scopeManager.scopes) {
        for (const variable of scope.variables) {
          const def = variable.defs[0];
          if (def && ['FunctionName', 'ClassName', 'Variable'].includes(def.type) && variable.defs.length === 1 && !variable.references.some(ref => ref.isWrite() && !ref.init)) defs.set(variable, byAst.get(def.node) || byAst.get(def.node?.init));
        }
        for (const ref of scope.references) references.set(ref.identifier, ref.resolved);
      }
      // Only lexically resolved direct identifier calls. Member/dynamic calls
      // and shadowed non-function bindings deliberately acquire no guessed edge.
      for (const [node] of parents) if (['CallExpression', 'NewExpression'].includes(node.type)) {
        if (node.callee.type !== 'Identifier') { objects.exclusions.memberOrDynamicCalls++; continue; }
        const variable = references.get(node.callee), target = defs.get(variable);
        const source = sourceAt(file.path, text, unit.offset + node.range[0], unit.offset + node.range[1]);
        const caller = ownerAt(extracted, unit.offset + node.range[0], `file:${file.path}`);
        if (target) addEdge(objects, 'calls', caller, target.id, source, node.callee.name, 'ESLint lexical binding (static target, not runtime proof)');
        else if (variable?.defs[0]?.type === 'ImportBinding') {
          const def = variable.defs[0], declaration = parents.get(def.node), spec = def.node;
          if (!declaration.source.value.startsWith('.')) { objects.exclusions.externalImportCalls++; continue; }
          pendingImports.push({ caller, source, file: file.path, module: declaration.source.value, imported: spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported?.name });
        }
      }
      for (const scope of code.scopeManager.scopes) for (const ref of scope.references) {
        const target = defs.get(ref.resolved), parent = parents.get(ref.identifier);
        if (!target || !ref.isRead() || ['CallExpression', 'NewExpression'].includes(parent?.type) && parent.callee === ref.identifier) continue;
        const start = unit.offset + ref.identifier.range[0], end = unit.offset + ref.identifier.range[1];
        addEdge(objects, 'references_binding', ownerAt(extracted, start, `file:${file.path}`), target.id, sourceAt(file.path, text, start, end), ref.identifier.name, 'ESLint lexical read reference (callback/alias/value use)');
      }
      const moduleScope = code.scopeManager.scopes.find(s => s.type === 'module') || code.scopeManager.globalScope;
      const bindings = new Map(moduleScope.variables.map(variable => [variable.name, defs.get(variable)]));
      for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration?.id?.name && byAst.has(node.declaration)) exports.set(`${file.path}:${node.declaration.id.name}`, byAst.get(node.declaration).id);
          if (node.declaration?.type === 'VariableDeclaration') for (const declaration of node.declaration.declarations) if (byAst.has(declaration)) exports.set(`${file.path}:${declaration.id.name}`, byAst.get(declaration).id);
          for (const spec of node.specifiers || []) if (!node.source && bindings.get(spec.local.name)) exports.set(`${file.path}:${spec.exported.name}`, bindings.get(spec.local.name).id);
        }
        if (node.type === 'ExportDefaultDeclaration') {
          const target = byAst.get(node.declaration) || bindings.get(node.declaration.name);
          if (target) exports.set(`${file.path}:default`, target.id);
        }
      }
    }
    modules.set(file.path, extracted);
  }
  for (const call of pendingImports) {
    const result = resolveReference(call.file, call.module, inventory, 'js_import'), target = exports.get(`${result.path}:${call.imported}`);
    if (target) addEdge(objects, 'imports_binding', call.caller, target, call.source, `${call.module}#${call.imported}`, 'literal local import and declared export');
    else issue(objects, call.source, `${call.module}#${call.imported || '*'}`, 'unresolved_import_call');
  }
  const snapshot = validatePullRequests(prs);
  objects.inputs.push({ path: 'docs/assure/pull-requests.json', sha256: sha256(readText(root, 'docs/assure/pull-requests.json')) });
  const prBodies = new Map(), prSections = new Map();
  for (const pr of snapshot.pulls) {
    const id = `pr:${pr.number}`, source = { path: id, line: 1, endLine: Math.max(1, pr.body.split('\n').length) };
    objects.nodes.push({ id, type: 'pull_request', name: `#${pr.number} ${pr.title}`, number: pr.number, url: pr.url, state: pr.state, head: pr.head, base: pr.base, filesComplete: pr.filesComplete });
    const parsed = sections(id, pr.body, 'pr_section');
    // Keep the introduction and even an empty body as an addressable section.
    const introEnd = parsed[0]?.locator.start ?? pr.body.length;
    parsed.unshift({ id: `pr_section:${id}#@introduction`, type: 'pr_section', name: 'Introduction', anchor: '', source: sourceAt(id, pr.body, 0, introEnd), locator: locator(pr.body, 0, introEnd, 'introduction', 'markdown-headings-1'), depth: 0 });
    for (const section of parsed) {
      const node = { ...section }; delete node.depth;
      objects.nodes.push({ ...node, number: pr.number, text: pr.body.slice(node.locator.start, node.locator.end) });
      addEdge(objects, 'has_description', id, node.id, node.source, node.name, 'captured PR body section');
    }
    prBodies.set(id, pr.body); prSections.set(id, parsed);
    for (const file of pr.files) if (inventory.has(file)) addEdge(objects, 'changes_file', id, `file:${file}`, source, file, 'GitHub PR changed-file list (no object-level attribution)');
    else issue(objects, source, file, 'historical_PR_file_absent');
    if (!pr.filesComplete) issue(objects, source, id, 'incomplete_PR_file_list');
  }
  // Exact code-span names may resolve only in files explicitly cited by the
  // same authored section/item; no PR-wide changed-file guess is used.
  const resolveMentions = (layer, file, body, sectionNodes, fallback, baseOffset = 0, fileCandidates = null) => {
    let rowOffset = 0; const inactive = [];
    for (const row of markdownLines(body)) { if (!row.active) inactive.push([rowOffset, rowOffset + row.text.length + 1]); rowOffset += row.text.length + 1; }
    const refs = markdownReferences(body).filter(r => !inactive.some(([start, end]) => start <= r.start && r.start < end)), candidatesByOwner = new Map();
    const candidatesFor = ref => {
      const owner = ownerAt(sectionNodes, baseOffset + ref.start, fallback);
      if (!candidatesByOwner.has(owner)) candidatesByOwner.set(owner, new Set(fileCandidates || []));
      return candidatesByOwner.get(owner);
    };
    for (const ref of refs) {
      const result = resolveReference(file.startsWith('pr:') ? 'README.md' : file, ref.reference, inventory, ref.syntax === 'code_span' ? 'code_span' : 'markdown_link');
      if (result.path) {
        candidatesFor(ref).add(result.path);
        if (file.startsWith('pr:')) addEdge(objects, 'mentions_file', ownerAt(sectionNodes, baseOffset + ref.start, fallback), `file:${result.path}`, sourceAt(file, prBodies.get(file), baseOffset + ref.start, baseOffset + ref.end), ref.reference, 'explicit PR body reference');
      }
    }
    for (const ref of refs.filter(r => r.syntax === 'code_span')) {
      const name = ref.reference.replace(/\(\)$/, '');
      if (!/^[\w$]+(?:[./][\w$]+)*$/.test(name) || inventory.has(name)) continue;
      const matches = [...candidatesFor(ref)].flatMap(p => modules.get(p) || []).filter(n => n.kind !== 'block' && (n.name === name || n.name.split('/').at(-1) === name));
      if (!matches.length) continue;
      const full = texts.get(file) ?? prBodies.get(file), source = sourceAt(file, full, baseOffset + ref.start, baseOffset + ref.end);
      if (matches.length === 1) addEdge(layer, 'mentions_object', ownerAt(sectionNodes, baseOffset + ref.start, fallback), matches[0].id, source, ref.reference, 'exact code-span name within explicitly cited file(s)');
      else issue(layer, source, ref.reference, 'ambiguous_object_name', matches.map(n => n.id));
    }
  };
  for (const [file, parsed] of prSections) {
    const body = prBodies.get(file);
    for (const section of parsed) {
      // Avoid borrowing names/files from child sections: each section owns only
      // the range before its first nested heading.
      const end = parsed.filter(n => n.locator.start > section.locator.start && n.locator.start < section.locator.end).sort((a, b) => a.locator.start - b.locator.start)[0]?.locator.start ?? section.locator.end;
      const own = body.slice(section.locator.start, end);
      resolveMentions(objects, file, own, [section], section.id, section.locator.start);
      for (const match of own.matchAll(/\bTODO(?: items?)?\s+([\d./–, -]+)/gi)) for (const number of todoReferences(match[1]).ids) {
        const target = `${number.includes('.') ? 'todo' : 'milestone'}:${number}`;
        if (base.nodes.some(n => n.id === target)) addEdge(objects, 'references_item', section.id, target, section.source, match[0], 'explicit TODO annotation in PR section');
      }
    }
  }
  for (const node of base.nodes.filter(n => ['todo', 'done', 'insight', 'deviation', 'reflection'].includes(n.type))) {
    const full = texts.get(node.source.path); if (!full) continue;
    const start = full.split('\n').slice(0, node.source.line - 1).join('\n').length + (node.source.line > 1 ? 1 : 0);
    const end = full.split('\n').slice(0, node.source.endLine).join('\n').length;
    const candidates = base.edges.filter(e => e.from === node.id && ['mentions', 'links_to'].includes(e.type)).map(e => e.to.slice(5));
    resolveMentions(objects, node.source.path, full.slice(start, end), [], node.id, start, candidates);
  }
  const docSections = new Map();
  for (const [file, text] of texts) if (file.endsWith('.md')) {
    documents.inputs.push({ path: file, sha256: sha256(text) });
    const parsed = sections(file, text); docSections.set(file, parsed);
    for (const section of parsed) {
      const parent = parsed.filter(n => n !== section && n.depth < section.depth && n.locator.start <= section.locator.start && n.locator.end >= section.locator.end).sort((a, b) => b.depth - a.depth)[0];
      const node = { ...section }; delete node.depth; documents.nodes.push(node);
      addEdge(documents, 'contains_section', parent?.id || `file:${file}`, node.id, node.source, node.name, 'Markdown heading hierarchy');
    }
    let fence, start, language, offset = 0, block = 0;
    for (const row of text.split('\n')) {
      const mark = row.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (mark && !fence) { fence = mark[1]; start = offset; language = mark[2].trim(); }
      else if (mark && fence && mark[1][0] === fence[0] && mark[1].length >= fence.length && !mark[2].trim()) {
        const end = Math.min(text.length, offset + row.length + 1), name = `Fenced block ${++block}`;
        const node = { id: `doc_block:${file}#${block}`, type: 'doc_block', name, language, source: sourceAt(file, text, start, end), locator: locator(text, start, end, `fence:${block}`, 'markdown-fences-1') };
        documents.nodes.push(node); addEdge(documents, 'contains_block', ownerAt(parsed, start, `file:${file}`), node.id, node.source, language, 'fenced literal block'); fence = undefined;
      }
      offset += row.length + 1;
    }
    if (fence) issue(documents, sourceAt(file, text, start, text.length), language, 'unclosed_fence');
    for (const item of base.nodes.filter(n => n.source?.path === file)) {
      const offset = text.split('\n').slice(0, item.source.line - 1).join('\n').length + (item.source.line > 1 ? 1 : 0);
      addEdge(documents, 'locates_item', ownerAt(parsed, offset, `file:${file}`), item.id, item.source, item.id, 'source-range containment, not satisfaction');
    }
    resolveMentions(documents, file, text, parsed, `file:${file}`);
  }
  for (const [file, parsed] of docSections) {
    const text = texts.get(file), rows = markdownLines(text), definitions = new Map();
    let offset = 0; const refs = [];
    for (const row of rows) {
      if (row.active) {
        const definition = row.text.match(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/);
        if (definition) definitions.set(definition[1].trim().toLowerCase(), definition[2] || definition[3]);
        else {
          const inline = markdownReferences(row.text); refs.push(...inline.filter(r => r.syntax === 'markdown_link').map(r => ({ ...r, start: offset + r.start, end: offset + r.end })));
          // A bounded per-line pass handles full/collapsed reference links.
          const blocked = inline.sort((a, b) => a.start - b.start); let blockedAt = 0, open = -1;
          for (let i = 0; i < row.text.length; i++) {
            while (blockedAt < blocked.length && blocked[blockedAt].end <= i) blockedAt++;
            if (blocked[blockedAt]?.start <= i) { i = blocked[blockedAt].end - 1; open = -1; continue; }
            if (row.text[i] === '\\') { i++; continue; }
            if (row.text[i] === '[') open = i;
            else if (row.text[i] === ']' && open >= 0 && row.text[i + 1] === '[') {
              let end = i + 2;
              while (end < row.text.length && row.text[end] !== ']') { if (row.text[end] === '\\') end++; end++; }
              if (end < row.text.length) refs.push({ referenceLabel: (row.text.slice(i + 2, end) || row.text.slice(open + 1, i)).trim().toLowerCase(), start: offset + open, end: offset + end + 1 });
              i = end; open = -1;
            } else if (row.text[i] === ']') open = -1;
          }
        }
      }
      offset += row.text.length + 1;
    }
    for (const ref of refs) {
      const reference = ref.reference ?? definitions.get(ref.referenceLabel), source = sourceAt(file, text, ref.start, ref.end), from = ownerAt(parsed, ref.start, `file:${file}`);
      if (!reference) { issue(documents, source, ref.referenceLabel, 'missing_link_definition'); continue; }
      let target;
      if (/^https?:\/\//.test(reference)) {
        const pr = reference.match(/^https:\/\/github\.com\/gregoryyy\/kibitz\/pull\/([1-9]\d*)(?:#(.*))?$/);
        if (pr && prBodies.has(`pr:${pr[1]}`)) target = `pr:${pr[1]}`;
        else { target = `url:${reference}`; if (!documents.nodes.some(n => n.id === target)) documents.nodes.push({ id: target, type: 'external', name: reference, url: reference }); }
      } else if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) { issue(documents, source, reference, 'unsupported_link_scheme'); continue; }
      else {
        const fragment = reference.includes('#') ? reference.slice(reference.indexOf('#') + 1) : '';
        const result = reference.startsWith('#') ? { path: file } : resolveReference(file, reference, inventory, 'markdown_link');
        if (!result.path) { issue(documents, source, reference, result.reason || 'unresolved_link', result.candidates || []); continue; }
        if (fragment) {
          let anchor; try { anchor = decodeURIComponent(fragment); } catch { anchor = fragment; }
          target = docSections.get(result.path)?.find(n => n.anchor === anchor)?.id;
          if (!target) { issue(documents, source, reference, 'missing_document_anchor'); continue; }
        } else target = `file:${result.path}`;
      }
      addEdge(documents, 'documents_link', from, target, source, reference, ref.referenceLabel ? 'reference-style Markdown link' : 'inline Markdown link');
    }
  }
  for (const layer of [objects, documents]) {
    layer.nodes.sort((a, b) => compare(a.id, b.id)); layer.edges.sort((a, b) => compare(JSON.stringify([a.type, a.from, a.to]), JSON.stringify([b.type, b.from, b.to])));
    layer.inputs.sort((a, b) => compare(a.path, b.path)); layer.unresolved.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
  }
  for (const layer of [objects, documents]) for (const edge of layer.edges) edge.confidence = classifyLink(edge.type, edge.evidence);
  validateLayers(base, [objects, documents]);
  return { objects, documents };
}
export function replay(root, base, layers, id, prs = JSON.parse(readText(root, 'docs/assure/pull-requests.json'))) {
  const expected = layers.flatMap(l => l.nodes).find(n => n.id === id);
  if (!expected?.locator) throw new Error('Replay needs an object, section or block ID');
  const current = Object.values(buildDetails(root, base, trackedFiles(root), prs)).flatMap(l => l.nodes).find(n => n.id === id);
  if (!current || JSON.stringify(current.locator) !== JSON.stringify(expected.locator) || JSON.stringify(current.source) !== JSON.stringify(expected.source)) throw new Error('Replay drift: regenerate and review the changed selector/range/content');
  const text = expected.source.path.startsWith('pr:') ? prs.pulls.find(p => `pr:${p.number}` === expected.source.path)?.body : readText(root, expected.source.path);
  const selected = text.slice(expected.locator.start, expected.locator.end);
  if (sha256(selected) !== expected.locator.sha256) throw new Error('Replay content mismatch');
  return { id, source: expected.source, locator: expected.locator, text: selected };
}
export function run(argv = process.argv.slice(2), root = ROOT) {
  const [command = 'check', ...extra] = argv;
  if (command === 'replay' && extra.length === 1) return replay(root, JSON.parse(readText(root, 'docs/assure/lineage.json')), OUTPUTS.slice(0, 2).map(p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))), extra[0]);
  if (extra.length || !['build', 'check', 'refresh-prs'].includes(command)) throw new Error('Usage: node utils/assure-detail.mjs build|check|refresh-prs|replay ID');
  if (command === 'refresh-prs') return refreshPullRequests(root);
  const base = JSON.parse(readText(root, 'docs/assure/lineage.json'));
  const { objects, documents } = buildDetails(root, base);
  const values = [compact(objects), compact(documents), json(DETAIL_SCHEMA)];
  OUTPUTS.forEach((file, i) => {
    if (command === 'build') fs.writeFileSync(path.join(root, file), values[i]);
    else if (fs.readFileSync(path.join(root, file), 'utf8') !== values[i]) throw new Error(`Stale detailed assurance: ${file}; run node utils/assure-detail.mjs build`);
  });
  return { objects: objects.nodes.length, documents: documents.nodes.length, edges: objects.edges.length + documents.edges.length, unresolved: objects.unresolved.length + documents.unresolved.length };
}
const isMain = () => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) { try { console.log(JSON.stringify(run())); } catch (error) { console.error(error.message); process.exitCode = 1; } }
