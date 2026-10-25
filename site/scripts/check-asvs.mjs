// Offline coverage and evidence checks, not a security certification.
import { readFileSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const source = Object.freeze({
  version: '5.0.0', level: 1, totalRequirements: 345,
  url: 'https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv',
  sha256: '98c8fe911b9edb403af8ee05d3ce8201ecac2659e313b053890a62847cdcf680',
});
// Independently transcribed from the pinned official CSV's L=1 rows.
export const baseline = Object.freeze(`
1.2.1 1.2.2 1.2.3 1.2.4 1.2.5 1.3.1 1.3.2 1.5.1
2.1.1 2.2.1 2.2.2 2.3.1
3.2.1 3.2.2 3.3.1 3.4.1 3.4.2 3.5.1 3.5.2 3.5.3
4.1.1 4.4.1 5.2.1 5.2.2 5.3.1 5.3.2
6.1.1 6.2.1 6.2.2 6.2.3 6.2.4 6.2.5 6.2.6 6.2.7 6.2.8 6.3.1 6.3.2 6.4.1 6.4.2
7.2.1 7.2.2 7.2.3 7.2.4 7.4.1 7.4.2
8.1.1 8.2.1 8.2.2 8.3.1 9.1.1 9.1.2 9.1.3 9.2.1
10.4.1 10.4.2 10.4.3 10.4.4 10.4.5
11.3.1 11.3.2 11.4.1 12.1.1 12.2.1 12.2.2
13.4.1 14.2.1 14.3.1 15.1.1 15.2.1 15.3.1
`.trim().split(/\s+/).map(id => `v5.0.0-${id}`));
const chapters = [
  '0x10-V1-Encoding-and-Sanitization', '0x11-V2-Validation-and-Business-Logic',
  '0x12-V3-Web-Frontend-Security', '0x13-V4-API-and-Web-Service', '0x14-V5-File-Handling',
  '0x15-V6-Authentication', '0x16-V7-Session-Management', '0x17-V8-Authorization',
  '0x18-V9-Self-contained-Tokens', '0x19-V10-OAuth-and-OIDC', '0x20-V11-Cryptography',
  '0x21-V12-Secure-Communication', '0x22-V13-Configuration', '0x23-V14-Data-Protection',
  '0x24-V15-Secure-Coding-and-Architecture',
];
const statuses = ['verified', 'not-applicable', 'deviation', 'open'];
const methods = ['code-and-test', 'documentation-review', 'scope-review'];
const textField = value => typeof value === 'string' && value.trim().length > 0
  && value.length <= 2000 && !Array.from(value).some(c => c.codePointAt(0) < 32 || c.codePointAt(0) === 127);

/** Only repository source, tests and documentation may be evidence. No secret paths. */
export function evidenceExists(path) {
  if (typeof path !== 'string' || !/^(docs|site\/(src|server|tests|scripts))\/[A-Za-z0-9_./-]+$/.test(path)
      || path.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.'))
      || !/\.(?:md|json|js|mjs|html)$/.test(path)) return false;
  try {
    const target = realpathSync(resolve(root, path));
    const rel = relative(realpathSync(root), target);
    return rel !== '..' && !rel.startsWith(`..${sep}`)
      && !rel.startsWith(sep) && statSync(target).isFile();
  } catch { return false; }
}

/** @param {any} data @param {(path: string) => boolean} [exists] */
export function validateChecklist(data, exists = evidenceExists) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['Checklist must be an object'];
  for (const [key, value] of Object.entries(source)) {
    if (data.source?.[key] !== value) errors.push(`Incorrect source ${key}`);
  }
  if (data.scope !== 'local-single-user') errors.push('Incorrect deployment scope');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed ?? '')) errors.push('Missing review date');
  if (!/^[a-f0-9]{40}$/.test(data.revision ?? '')) errors.push('Missing reviewed revision');
  if (!Array.isArray(data.controls)) return [...errors, 'Missing controls array'];
  const seen = new Set();
  for (const row of data.controls) {
    if (!row || typeof row !== 'object') { errors.push('Invalid control'); continue; }
    const id = row.id;
    if (!baseline.includes(id)) errors.push(`Unknown L1 ID: ${id}`);
    if (seen.has(id)) errors.push(`Duplicate ID: ${id}`);
    seen.add(id);
    if (!statuses.includes(row.status)) errors.push(`Invalid status: ${id}`);
    if (!methods.includes(row.method)) errors.push(`Invalid method: ${id}`);
    if (!textField(row.topic) || !textField(row.note)) errors.push(`Missing or invalid assessment: ${id}`);
    if (!Array.isArray(row.evidence) || row.evidence.length === 0 || row.evidence.length > 12
        || row.evidence.some(path => !exists(path))) errors.push(`Invalid evidence: ${id}`);
    const evidence = Array.isArray(row.evidence) ? row.evidence : [];
    if (row.status === 'verified' && row.method === 'scope-review') errors.push(`Verification needs evidence review: ${id}`);
    if (row.method === 'code-and-test' && (!evidence.some(path => /^site\/(src|server|scripts)\//.test(path) && !path.includes('.test.'))
        || !evidence.some(path => /\.(test|spec)\.mjs$/.test(path)))) errors.push(`Code and test evidence required: ${id}`);
    if (row.method === 'documentation-review' && !evidence.some(path => /^docs\/.+\.md$/.test(path))) errors.push(`Documentation evidence required: ${id}`);
    if (['open', 'deviation'].includes(row.status) && !/^TODO \d+\.\d+(?:\.\d+)*$/.test(row.followUp ?? '')) errors.push(`Missing follow-up: ${id}`);
  }
  for (const id of baseline) if (!seen.has(id)) errors.push(`Missing ID: ${id}`);
  return errors;
}

// Encode all metadata as literal table text; link targets below are fixed or validated paths.
export const markdownText = value => String(value).replace(/[&<>|`[\]\\*_\r\n]/g,
  c => `&#${c.codePointAt(0)};`);

/** @param {any} data Call only after validateChecklist succeeds. */
export function renderChecklist(data) {
  const counts = Object.fromEntries(statuses.map(status => [status, data.controls.filter(r => r.status === status).length]));
  const lines = [
    '# ASVS L1 assessment', '',
    'Generated from [asvs-l1.json](asvs-l1.json). Read [scope and limitations](ASVS.md) before using this assessment.', '',
    `Reviewed ${markdownText(data.reviewed)} at revision ${markdownText(data.revision)}.`, '',
    `Coverage: ${baseline.length}/${baseline.length} L1 controls; ${statuses.map(s => `${counts[s]} ${s}`).join(', ')}.`, '',
    '**Coverage and verified entries do not establish ASVS compliance or release approval.**', '',
    '| Requirement / topic | Disposition / method | Application assessment | Evidence / follow-up |',
    '| --- | --- | --- | --- |',
  ];
  for (const id of baseline) {
    const row = data.controls.find(r => r.id === id);
    const chapter = Number(id.slice('v5.0.0-'.length).split('.')[0]);
    const url = `https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/${chapters[chapter - 1]}.md`;
    const evidence = row.evidence.map(path => `[${markdownText(path)}](../${path})`).join('<br>');
    lines.push(`| [${id}](${url}) ${markdownText(row.topic)} | ${row.status}<br>${row.method} | ${markdownText(row.note)} | ${evidence}${row.followUp ? `<br>${markdownText(row.followUp)}` : ''} |`);
  }
  return `${lines.join('\n')}\n`;
}

export function run(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--write') || args.length > 1) throw new Error('Usage: node scripts/check-asvs.mjs [--write]');
  const data = JSON.parse(readFileSync(resolve(root, 'docs/asvs-l1.json'), 'utf8'));
  const errors = validateChecklist(data);
  if (errors.length) throw new Error(errors.join('\n'));
  const rendered = renderChecklist(data);
  const output = resolve(root, 'docs/ASVS-L1.md');
  if (args.includes('--write')) writeFileSync(output, rendered);
  else if (readFileSync(output, 'utf8') !== rendered) throw new Error('ASVS-L1.md is stale; run npm run check:asvs -- --write');
  console.log(`ASVS ${source.version} L1 coverage: ${baseline.length}/${baseline.length}; `
    + statuses.map(s => `${data.controls.filter(r => r.status === s).length} ${s}`).join(', ')
    + '. This checks records and document freshness, not compliance.');
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
