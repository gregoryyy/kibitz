// Lint for correctness only; formatting is left to the code's own compact style (see DONE.md).
import js from '@eslint/js';
import html from 'eslint-plugin-html';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'tests/out/'] },
  js.configs.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // The page and its modules run in the browser.
  { files: ['src/**/*.js', 'src/**/*.html'], plugins: { html }, languageOptions: { globals: globals.browser } },
  // Server, scripts, configs and tests run on Node; Playwright callbacks (e2e tests, the flipbook tour) also run in the page.
  { files: ['server/**', 'scripts/**', 'tests/**', '*.mjs'], languageOptions: { globals: globals.node } },
  { files: ['tests/e2e/**', 'flipbook/**', 'scripts/flipbook.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
