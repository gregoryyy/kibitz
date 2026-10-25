// Include repository assurance utilities in the existing correctness lint gate.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import js from '@eslint/js';
import globals from 'globals';
const root = new URL('../../', import.meta.url);
const files = ['utils/assure.mjs', 'utils/assure-detail.mjs', 'utils/assure-infer.mjs', 'docs/assure/confidence.mjs', 'docs/assure/assessment-types.mjs', 'docs/assure/types.mjs', 'docs/assure/detail-types.mjs', ...fs.readdirSync(new URL('utils/assure-browser/', root)).filter(f => f.endsWith('.mjs')).map(f => `utils/assure-browser/${f}`)];
const eslint = new ESLint({ cwd: fileURLToPath(root), overrideConfigFile: true, overrideConfig: [js.configs.recommended, { languageOptions: { globals: { ...globals.node, ...globals.browser } }, rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }], 'no-empty': ['error', { allowEmptyCatch: true }] } }] });
const results = await eslint.lintFiles(files);
const formatter = await eslint.loadFormatter('stylish'); const output = formatter.format(results);
if (output) console.log(output);
if (results.some(r => r.errorCount || r.warningCount)) process.exitCode = 1;
