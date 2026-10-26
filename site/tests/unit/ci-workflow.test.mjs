import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adapt, condition, jobsOf, localSteps, parseYaml } from '../../scripts/ci/workflow.mjs';

const WORKFLOW = `# CI
name: CI
on:
  push:
    branches: [main]
jobs:
  build:
    name: Build — lint, test
    timeout-minutes: 15
    env:
      PW_CHANNEL: chromium
    defaults:
      run:
        working-directory: site
    steps:
      - uses: actions/checkout@3d3c # v7.0.1
        with:
          fetch-depth: 0
      - uses: actions/setup-node@949f
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: node report.mjs >> "$GITHUB_STEP_SUMMARY" # into the summary
        working-directory: .
      - if: failure()
        uses: actions/upload-artifact@cf43
        with:
          name: traces
          path: site/tests/out/
`;

test('TODO 0.18: reads the subset of YAML a workflow uses, comments and quotes included', () => {
  assert.deepEqual(parseYaml(WORKFLOW), {
    name: 'CI',
    on: { push: { branches: ['main'] } },
    jobs: {
      build: {
        name: 'Build — lint, test',
        'timeout-minutes': '15',
        env: { PW_CHANNEL: 'chromium' },
        defaults: { run: { 'working-directory': 'site' } },
        steps: [
          { uses: 'actions/checkout@3d3c', with: { 'fetch-depth': '0' } },
          { uses: 'actions/setup-node@949f', with: { 'node-version-file': '.nvmrc', cache: 'npm' } },
          { run: 'npm ci' },
          { run: 'node report.mjs >> "$GITHUB_STEP_SUMMARY"', 'working-directory': '.' },
          { if: 'failure()', uses: 'actions/upload-artifact@cf43', with: { name: 'traces', path: 'site/tests/out/' } },
        ],
      },
    },
  });
  assert.deepEqual(parseYaml('steps:\n- run: echo "a # b"\n- run: \'x\'\n'), { steps: [{ run: 'echo "a # b"' }, { run: 'x' }] });
});

test('TODO 0.18: what the reader does not support is an error with the line, not a wrong reading', () => {
  assert.throws(() => parseYaml('run: |\n  npm ci\n'), /line 1: block scalars/);
  assert.throws(() => parseYaml('a: 1\n    b: 2\n'), /line 2: unexpected indentation/);
  assert.throws(() => parseYaml('a: 1\na: 2\n'), /line 2: duplicate key "a"/);
  assert.throws(() => parseYaml('a: &x 1\n'), /anchors/);
});

test('TODO 0.18: every step maps to its local equivalent, in the job working directory unless the step names one', () => {
  const [job] = jobsOf(parseYaml(WORKFLOW));
  assert.equal(job.name, 'Build — lint, test');
  assert.equal(job.timeoutMinutes, 15);
  assert.deepEqual(job.env, { PW_CHANNEL: 'chromium' });
  assert.deepEqual(localSteps(job), [
    { kind: 'checkout', label: 'actions/checkout', when: 'success' },
    { kind: 'node', label: 'actions/setup-node', when: 'success', file: '.nvmrc', version: undefined },
    { kind: 'shell', label: 'npm ci', when: 'success', command: 'npm ci', cwd: 'site', env: {} },
    { kind: 'shell', label: 'node report.mjs >> "$GITHUB_STEP_SUMMARY"', when: 'success', command: 'node report.mjs >> "$GITHUB_STEP_SUMMARY"', cwd: '.', env: {} },
    { kind: 'artifact', label: 'actions/upload-artifact', when: 'failure', name: 'traces', path: 'site/tests/out/' },
  ]);
});

test('TODO 0.18: workflow env and defaults apply to every job; the job wins, and a step keeps its env', () => {
  const [job] = jobsOf(parseYaml('env:\n  A: w\n  B: w\ndefaults:\n  run:\n    working-directory: site\njobs:\n  j:\n    env:\n      B: j\n    steps:\n      - run: make\n        env:\n          C: s\n'));
  assert.deepEqual(job.env, { A: 'w', B: 'j' });
  assert.deepEqual(localSteps(job), [{ kind: 'shell', label: 'make', when: 'success', command: 'make', cwd: 'site', env: { C: 's' } }]);
});

test('TODO 0.18: an unknown action, key, condition or expression in a command stops the run before it starts', () => {
  const job = step => jobsOf(parseYaml(`jobs:\n  j:\n    steps:\n      - ${step}\n`))[0];
  const steps = '    steps:\n      - run: make\n';
  assert.throws(() => localSteps(job('uses: someone/deploy@v1')), /no local equivalent for someone\/deploy/);
  assert.throws(() => localSteps(job('run: echo ${{ github.sha }}')), /expressions in run steps/);
  assert.throws(() => localSteps(job('if: github.event_name == \'push\'\n        run: echo')), /only success\(\), failure\(\) and always\(\)/);
  assert.throws(() => jobsOf(parseYaml(`jobs:\n  j:\n    services:\n      db:\n        image: postgres\n${steps}`)), /jobs\.j: services not supported/);
  assert.throws(() => jobsOf(parseYaml(`jobs:\n  j:\n    strategy:\n      matrix:\n        node: [24]\n${steps}`)), /jobs\.j: strategy not supported/);
  assert.throws(() => jobsOf(parseYaml(`jobs:\n  j:\n    defaults:\n      run:\n        shell: sh\n${steps}`)), /jobs\.j\.defaults\.run: shell not supported/);
  assert.throws(() => jobsOf(parseYaml('jobs:\n  j:\n    steps:\n      - run: make\n        continue-on-error: true\n')), /steps\[0\]: continue-on-error not supported/);
  assert.throws(() => jobsOf(parseYaml('jobs:\n  j:\n    env:\n      T: ${{ secrets.T }}\n' + steps)), /jobs\.j\.env\.T: expressions/);
});

test('TODO 0.18: conditions and the Linux-only --with-deps', () => {
  assert.equal(condition(undefined), 'success');
  assert.equal(condition('${{ always() }}'), 'always');
  assert.equal(adapt('npx playwright install --with-deps chromium', 'darwin'), 'npx playwright install chromium');
  assert.equal(adapt('npx playwright install --with-deps chromium', 'linux'), 'npx playwright install --with-deps chromium');
});

test('TODO 0.18: the repository CI workflow runs locally, every job and step', () => {
  const jobs = jobsOf(parseYaml(readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')));
  assert.deepEqual(jobs.map(j => j.id), ['check', 'e2e', 'native-macos', 'secrets']);
  for (const job of jobs) assert.ok(localSteps(job).length > 0, job.id);
  const secrets = localSteps(jobs.find(j => j.id === 'secrets'));
  assert.ok(secrets.some(s => s.kind === 'secrets'), 'gitleaks maps to the local binary');
});
