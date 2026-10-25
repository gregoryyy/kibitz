import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { checkImageReport, scannerArgs, SCANNER_IMAGE, DB_REPOSITORY } from '../../scripts/image-advisories.mjs';

const now = Date.parse('2026-10-25T12:00:00Z'), imageId = 'sha256:' + 'a'.repeat(64), revision = 'b'.repeat(40);
const options = { now, imageId, revision, dependencies: { 'chess.js': '1.4.0', parse5: '8.0.1' }, osPackages: ['libc6@2.36-9', 'zlib1g@1:1.2.13'] };
const report = () => ({ SchemaVersion: 2, ArtifactType: 'container_image', Trivy: { Version: '0.76.1' }, CreatedAt: '2026-10-25T11:58:00Z',
  Metadata: { ImageID: imageId, OS: { Family: 'debian', Name: '12.12' }, ImageConfig: { config: { Labels: { 'org.opencontainers.image.revision': revision } } } },
  Results: [{ Target: 'debian', Class: 'os-pkgs', Type: 'debian', Packages: [{ Name: 'libc6', Version: '2.36-9' }, { Name: 'zlib1g', Version: '1:1.2.13' }] },
    { Target: 'installed modules', Class: 'lang-pkgs', Type: 'node-pkg', Packages: [{ Name: 'chess.js', Version: '1.4.0' }, { Name: 'parse5', Version: '8.0.1' }] }] });
const database = () => ({ Version: 2, UpdatedAt: '2026-10-25T06:00:00Z', DownloadedAt: '2026-10-25T11:57:00Z', NextUpdate: '2026-10-25T12:05:00Z' });
const finding = (Severity = 'MEDIUM') => ({ VulnerabilityID: 'CVE-2026-12345', PkgName: 'libc6', InstalledVersion: '2.36-9', Severity, Status: 'affected' });

test('raw image report ties exact source/image/scanner and complete OS/production package inventories to a fresh DB', () => {
  assert.deepEqual(checkImageReport(report(), database(), options), { errors: [], findings: [], osPackages: 2, libraryPackages: 2 });
  const data = report(); data.Results[0].Packages[0].Name = 'libc6:amd64';
  assert.deepEqual(checkImageReport(data, database(), options).errors, []);
});

test('missing, malformed, wrong-source/image/scanner/OS or stale reports fail rather than report a clean scan', () => {
  for (const data of [null, {}, { ...report(), Results: [] }, { ...report(), SchemaVersion: 1 }, { ...report(), ArtifactType: 'filesystem' },
    { ...report(), Trivy: { Version: 'weekly' } }, { ...report(), CreatedAt: '2026-10-24T12:00:00Z' }, { ...report(), CreatedAt: '2026-10-26T12:00:00Z' }]) {
    assert.ok(checkImageReport(data, database(), options).errors.length);
  }
  for (const mutate of [data => { data.Metadata.ImageID = 'sha256:' + 'c'.repeat(64); }, data => { data.Metadata.ImageConfig.config.Labels = {}; },
    data => { data.Metadata.OS.Family = 'unknown'; }, data => { data.Metadata.OS.EOSL = true; }, data => { data.Results = [null]; }]) {
    const data = report(); mutate(data); assert.ok(checkImageReport(data, database(), options).errors.length);
  }
});

test('a fresh download cannot disguise a stale, expired, future, missing or wrong-schema vulnerability DB', () => {
  for (const db of [null, {}, { ...database(), Version: 1 }, { ...database(), UpdatedAt: '2026-10-23T06:00:00Z' },
    { ...database(), UpdatedAt: '2026-10-26T06:00:00Z' }, { ...database(), DownloadedAt: '2026-10-24T11:57:00Z' },
    { ...database(), NextUpdate: '2026-10-25T10:00:00Z' }, { ...database(), NextUpdate: '2030-10-25T12:00:00Z' }]) {
    assert.ok(checkImageReport(report(), db, options).errors.includes('Missing, stale or invalid advisory database'));
  }
});

test('dropped OS packages, missing production modules and wrong installed versions fail coverage', () => {
  for (const group of [0, 1]) {
    const data = report(); data.Results[group].Packages.pop();
    assert.ok(checkImageReport(data, database(), options).errors.some(error => error.includes('coverage')));
  }
  const data = report(); data.Results[1].Packages[0].Version = '1.3.0';
  assert.ok(checkImageReport(data, database(), options).errors.includes('Incomplete production dependency coverage'));
});

test('all vulnerability statuses/severities stay visible; high and critical fail even when no fix is known', () => {
  for (const level of ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
    for (const status of ['affected', 'fixed', 'will_not_fix', 'end_of_life']) {
      const data = report(); data.Results[0].Vulnerabilities = [{ ...finding(level), Status: status }];
      const result = checkImageReport(data, database(), options);
      assert.equal(result.findings.length, 1); assert.equal(result.findings[0].severity, level); assert.equal(result.findings[0].status, status);
      assert.equal(result.errors.includes('High or critical image vulnerability'), ['HIGH', 'CRITICAL'].includes(level));
    }
  }
});

test('malformed vulnerabilities, missing inventories and modified/suppressed findings cannot pass', () => {
  for (const value of [null, {}, { ...finding(), Severity: 'other' }, { ...finding(), Status: {} }]) {
    const data = report(); data.Results[0].Vulnerabilities = [value];
    assert.ok(checkImageReport(data, database(), options).errors.includes('Malformed vulnerability'));
  }
  for (const value of [{}, [{ VulnerabilityID: 'CVE-2026-12345', Status: 'ignored' }]]) {
    const data = report(); data.Results[0].ExperimentalModifiedFindings = value;
    assert.ok(checkImageReport(data, database(), options).errors.includes('Modified or suppressed findings'));
  }
  const data = report(); data.Results[0].Packages = null; data.Results[1].Vulnerabilities = {};
  assert.ok(checkImageReport(data, database(), options).errors.includes('Malformed package inventory'));
  assert.ok(checkImageReport(data, database(), options).errors.includes('Malformed vulnerability list'));
});

test('scanner plan pins its engine and public DB, uses a tar export without sockets, and retains all findings', () => {
  assert.match(SCANNER_IMAGE, /^ghcr\.io\/aquasecurity\/trivy:0\.76\.1@sha256:[a-f0-9]{64}$/);
  assert.equal(DB_REPOSITORY, 'ghcr.io/aquasecurity/trivy-db:2');
  const args = scannerArgs({ archive: '/tmp/image.tar', output: '/tmp/evidence', name: 'kibitz-advisories-abcd', uid: 1001, gid: 1001 });
  for (const required of ['--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=2g', '--cpus=2', '--pids-limit=128',
    '--list-all-pkgs', '--disable-telemetry', '--skip-version-check', '--offline-scan', SCANNER_IMAGE, DB_REPOSITORY, 'vuln', 'os,library']) assert.ok(args.includes(required), required);
  assert.ok(args.includes('type=bind,src=/tmp/image.tar,dst=/input/image.tar,readonly'));
  assert.ok(!args.some(value => /docker\.sock|--severity|--ignore-unfixed|--ignore-status|--skip-db-update|--vex|--env/.test(value)));
  assert.equal(args[args.indexOf('--ignorefile') + 1], '/dev/null'); assert.equal(args[args.indexOf('--config') + 1], '/dev/null');
  for (const change of [{ archive: 'relative.tar' }, { output: '/tmp/bad,path' }, { uid: 0 }, { name: 'operator-container' }]) {
    assert.throws(() => scannerArgs({ archive: '/tmp/image.tar', output: '/tmp/evidence', name: 'kibitz-advisories-abcd', uid: 1001, gid: 1001, ...change }));
  }
});

test('stdin imports and rejected CLI options cannot start Docker or inspect an operator image', () => {
  const script = new URL('../../scripts/image-advisories.mjs', import.meta.url);
  const imported = spawnSync(process.execPath, ['--input-type=module', '-'], { env: {}, encoding: 'utf8', input: `import { SCANNER_IMAGE } from ${JSON.stringify(script.href)}; console.log(SCANNER_IMAGE.startsWith('ghcr.io/'));` });
  assert.equal(imported.status, 0, imported.stderr); assert.equal(imported.stdout.trim(), 'true');
  const rejected = spawnSync(process.execPath, [script.pathname, '--target', 'https://example.invalid'], { env: {}, encoding: 'utf8' });
  assert.equal(rejected.status, 1); assert.equal(rejected.stdout, ''); assert.equal(rejected.stderr.trim(), 'Image advisory verification failed; inspect retained evidence.');
});
