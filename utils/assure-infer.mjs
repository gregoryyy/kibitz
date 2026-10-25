// Deterministic review leads over typed evidence, not a compliance oracle.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateGraph } from '../docs/assure/types.mjs';
import { validateLayers } from '../docs/assure/detail-types.mjs';
import { ASSESSMENT_SCHEMA, validateAssessments, applyAssessments } from '../docs/assure/assessment-types.mjs';
import { confidence, pathConfidence } from '../docs/assure/confidence.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
const recordsJson = value => '{\n' + Object.entries(value).map(([key, item]) => `  ${JSON.stringify(key)}: ` + (Array.isArray(item) ? '[\n' + item.map(record => '    ' + JSON.stringify(record)).join(',\n') + '\n  ]' : JSON.stringify(item))).join(',\n') + '\n}\n';
const sha = value => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const evidencePath = edges => edges.map(e => ({ type: e.type, from: e.from, to: e.to, confidence: e.confidence.value }));
const relations = new Set(['imports', 'calls', 'imports_binding', 'references_binding']);
export function inferFindings(layers, assessments, { threshold = 0.8, maxImpact = 100, depth = 2 } = {}) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1 || !Number.isSafeInteger(depth) || depth < 0 || depth > 4 || !Number.isSafeInteger(maxImpact) || maxImpact < 1 || maxImpact > 500) throw new Error('Invalid inference bounds');
  validateAssessments(assessments, layers);
  const nodes = new Map(layers.flatMap(l => l.nodes).map(n => [n.id, n])), edges = applyAssessments(layers, assessments).flatMap(l => l.edges), incoming = new Map(), outgoing = new Map(), findings = new Map();
  for (const e of edges) {
    if (!e.confidence || !Number.isFinite(e.confidence.value) || e.confidence.value < 0 || e.confidence.value > 1) throw new Error('Inference requires bounded typed-link confidence');
    if (!outgoing.has(e.from)) outgoing.set(e.from, []); outgoing.get(e.from).push(e);
    if (!incoming.has(e.to)) incoming.set(e.to, []); incoming.get(e.to).push(e);
  }
  const strong = e => e.confidence.value >= threshold && e.confidence.value > 0;
  const add = (rule, status, subject, related, message, paths = [], source = nodes.get(subject)?.source, identity = '') => {
    const id = `finding:${rule}:${sha(JSON.stringify([subject, identity])).slice(0, 20)}`;
    const value = paths.length ? Math.max(...paths.map(pathConfidence)) : 1;
    const item = { id, rule, status, subject, related: [...new Set(related)].sort(compare), message,
      confidence: confidence(value, 'rule', paths.length ? 'Strongest support path; each path uses its weakest typed link. Not a calibrated probability of a defect.' : 'Closed-world observation about the retained graph, not missing real-world implementation.'),
      paths: paths.map(evidencePath), source: source || null };
    const previous = findings.get(id); if (!previous || previous.confidence.value < value) findings.set(id, item);
  };
  const deviationContexts = [];
  for (const node of nodes.values()) if (node.type === 'deviation') {
    const owner = (incoming.get(node.id) || []).find(e => e.type === 'has_deviation');
    const todoLinks = (outgoing.get(owner?.from) || []).filter(e => e.type === 'references_todo' && nodes.get(e.to)?.type === 'todo');
    const files = (outgoing.get(node.id) || []).filter(e => ['mentions', 'links_to'].includes(e.type));
    add('recorded_deviation', 'recorded', node.id, [...todoLinks.map(e => e.to), ...files.map(e => e.to)], node.text, owner ? [[owner], ...todoLinks.map(e => [owner, e]), ...files.map(e => [e])] : []);
    for (const link of todoLinks) if (strong(owner) && strong(link)) deviationContexts.push({ subject: node.id, target: link.to, path: [owner, link] });
  }
  for (const e of assessments.edges) if (e.type === 'deviates_from') {
    add('assessed_deviation', 'candidate', e.from, [e.to], 'An analyst proposes a deviation relation; inspect its rationale and source.', [[e]], e.evidence.source, e.to);
    if (strong(e)) deviationContexts.push({ subject: e.from, target: e.to, path: [e] });
  }
  for (const node of nodes.values()) if (node.type === 'todo' && node.status === 'done') {
    const links = incoming.get(node.id) || [];
    if (!links.some(e => e.type === 'references_todo' && strong(e))) add('missing_done_reference', 'gap', node.id, [], 'Checked TODO has no DONE annotation link at the selected confidence threshold.');
    for (const type of ['implements', 'verifies']) if (!links.some(e => e.type === type && strong(e))) add(`${type}_unassessed`, 'candidate', node.id, [], `No explicit ${type} assessment meets the selected confidence threshold. This is unassessed evidence, not proof the work or tests are absent.`);
  }
  const located = [...nodes.values()].filter(n => n.source);
  for (const layer of layers) for (const issue of layer.unresolved) {
    const s = issue.source;
    const owner = located.filter(n => n.source.path === s.path && n.source.line <= s.line && n.source.endLine >= s.endLine).sort((a, b) => (a.source.endLine - a.source.line) - (b.source.endLine - b.source.line) || compare(a.id, b.id))[0];
    const subject = owner?.id || (nodes.has(s.path) ? s.path : `file:${s.path}`);
    add('unresolved_reference', 'gap', subject, issue.candidates.filter(id => nodes.has(id)), `${issue.reason}: ${issue.reference}`, [], s, JSON.stringify(issue));
  }
  for (const e of assessments.edges.filter(e => e.type === 'supports' && strong(e))) {
    const opposite = assessments.edges.find(other => other.type === 'contradicts' && other.from === e.from && other.to === e.to && strong(other));
    if (opposite) add('conflicting_assessments', 'candidate', e.from, [e.to], 'The same pair has supported and contradicted type assessments above threshold; review the evidence.', [[e, opposite]], e.evidence.source, e.to);
  }
  let truncatedContexts = 0;
  for (const context of deviationContexts) {
    const seeds = nodes.get(context.target)?.type === 'todo' ? (incoming.get(context.target) || []).filter(e => e.type === 'implements' && strong(e)).map(e => ({ id: e.from, path: [...context.path, e] })) : [{ id: context.target, path: context.path }];
    // Bounded strongest-path relaxation: revisiting with greater support is
    // permitted, cycles never increase the bottleneck, and weak paths do not
    // hide a stronger alternate route. No multiplication or independence claim.
    const best = new Map(); let frontier = seeds, count = 0, truncated = false;
    for (let step = 0; step <= depth; step++) {
      const next = [];
      for (const candidate of frontier.sort((a, b) => pathConfidence(b.path) - pathConfidence(a.path) || compare(a.id, b.id))) {
        const score = pathConfidence(candidate.path);
        if (best.has(candidate.id) && best.get(candidate.id) >= score) continue;
        if (!best.has(candidate.id) && count >= maxImpact) { truncated = true; continue; }
        if (!best.has(candidate.id)) count++; best.set(candidate.id, score);
        add('possible_deviation_impact', 'candidate', candidate.id, [context.subject, context.target], 'Static dependency path from a recorded/proposed deviation. It identifies review scope, not an observed defect or cause.', [candidate.path], undefined, context.subject);
        if (step === depth) continue;
        for (const edge of incoming.get(candidate.id) || []) if (relations.has(edge.type) && strong(edge)) next.push({ id: edge.from, path: [...candidate.path, edge] });
      }
      frontier = next;
    }
    if (truncated) truncatedContexts++;
  }
  return { schemaVersion: 1, policy: { version: 'typed-links-1', threshold, depth, maxImpact, aggregation: 'max over path minima; no independence or probability claim' }, truncatedContexts,
    findings: [...findings.values()].sort((a, b) => compare(a.id, b.id)) };
}
export function readAssurance(root = ROOT) {
  const layers = ['lineage', 'objects', 'documents'].map(name => JSON.parse(fs.readFileSync(path.join(root, `docs/assure/${name}.json`), 'utf8')));
  validateGraph(layers[0]); validateLayers(layers[0], layers.slice(1));
  const assessments = JSON.parse(fs.readFileSync(path.join(root, 'docs/assure/links.json'), 'utf8'));
  validateAssessments(assessments, layers); return { layers, assessments };
}
const reportText = value => String(value).slice(0, 350).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', ' ').split('').map(c => '\\`*_{}[]()#!|~'.includes(c) ? '\\' + c : c).join('');
export function findingReport(result) {
  const counts = Object.fromEntries([...new Set(result.findings.map(f => f.rule))].sort().map(rule => [rule, result.findings.filter(f => f.rule === rule).length]));
  const out = ['# Assurance findings', '', 'Generated offline from typed, confidence-weighted links. These are recorded deviations, extraction gaps and review candidates; they are not inferred compliance or confirmed defects.', '', '| Rule | Count |', '| --- | ---: |', ...Object.entries(counts).map(([rule, count]) => `| ${rule} | ${count} |`), '', `Confidence threshold: ${result.policy.threshold}; dependency depth: ${result.policy.depth}; per-deviation impact limit: ${result.policy.maxImpact}; truncated contexts: ${result.truncatedContexts}.`, '', 'See [README](README.md) for weights, inference rules, exclusions and maintenance. The complete findings and supporting typed paths are in [findings.json](findings.json) and the browser.', '', '## First findings by rule', ''];
  for (const rule of Object.keys(counts)) {
    out.push(`### ${rule}`, '');
    for (const f of result.findings.filter(f => f.rule === rule).slice(0, 8)) out.push(`- ${f.status}; ${f.confidence.value.toFixed(2)}; \`${f.subject.replaceAll('`', '')}\`: ${reportText(f.message)}`);
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}
export function run(argv = process.argv.slice(2), root = ROOT) {
  const [command = 'check', ...extra] = argv;
  if (extra.length || !['build', 'check'].includes(command)) throw new Error('Usage: node utils/assure-infer.mjs build|check');
  const { layers, assessments } = readAssurance(root), result = inferFindings(layers, assessments);
  result.inputsSha256 = sha(json({ layers, assessments }));
  const values = [['docs/assure/findings.json', recordsJson(result)], ['docs/assure/FINDINGS.md', findingReport(result)], ['docs/assure/links-schema.json', json(ASSESSMENT_SCHEMA)]];
  for (const [file, value] of values) {
    if (command === 'build') fs.writeFileSync(path.join(root, file), value);
    else if (fs.readFileSync(path.join(root, file), 'utf8') !== value) throw new Error(`Stale assurance findings: ${file}; run node utils/assure-infer.mjs build`);
  }
  return { findings: result.findings.length, truncatedContexts: result.truncatedContexts };
}
const isMain = () => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } };
if (isMain()) { try { console.log(JSON.stringify(run())); } catch (error) { console.error(error.message); process.exitCode = 1; } }
