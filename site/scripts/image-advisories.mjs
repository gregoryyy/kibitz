// Scan only the local image built/tested by container.yml; no daemon socket enters Trivy.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { command } from './security-scan.mjs';
import { readBoundedFile } from './image-inventory.mjs';

export const SCANNER_IMAGE = 'ghcr.io/aquasecurity/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c';
export const DB_REPOSITORY = 'ghcr.io/aquasecurity/trivy-db:2';
const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_DB_AGE = 24 * 60 * 60_000, MAX_SCAN_AGE = 30 * 60_000, CLOCK_SKEW = 5 * 60_000;
const severity = new Set(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const fresh = (value, now, age) => Number.isFinite(timestamp(value)) && timestamp(value) <= now + CLOCK_SKEW && timestamp(value) >= now - age;
const sha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
// Last reviewed Node 24 security floor: 2026-10-21. This is not a future advisory guarantee.
export function patchedNode(version) {
  const match = /^v24\.(\d+)\.(\d+)$/.exec(version || '');
  return !!match && (Number(match[1]) > 22 || (Number(match[1]) === 22 && Number(match[2]) >= 1));
}

// Docker archive config digests and modern daemon image/index IDs are different identities.
// Read only fixed/validated members to stdout; never extract an archive into the filesystem.
export function archiveConfig(archive) {
  const read = member => execFileSync('tar', ['-xOf', archive, member], { timeout: 30_000, maxBuffer: 2_000_000 });
  const manifests = JSON.parse(read('manifest.json').toString('utf8'));
  if (!Array.isArray(manifests) || manifests.length !== 1 || !/^(?:blobs\/sha256\/)?[a-f0-9]{64}(?:\.json)?$/.test(manifests[0]?.Config || '')) throw Error('Unexpected image archive config');
  const bytes = read(manifests[0].Config), id = sha(bytes);
  if (path.basename(manifests[0].Config).replace(/\.json$/, '') !== id.slice(7)) throw Error('Image archive config digest mismatch');
  return { id, bytes, config: JSON.parse(bytes.toString('utf8')) };
}

function debianVersion(pkg) {
  if (pkg.Epoch !== undefined && (!Number.isSafeInteger(pkg.Epoch) || pkg.Epoch < 0)) return null;
  if (pkg.Release !== undefined && (typeof pkg.Release !== 'string' || !pkg.Release)) return null;
  return `${pkg.Epoch ? pkg.Epoch + ':' : ''}${pkg.Version}${pkg.Release ? '-' + pkg.Release : ''}`;
}

/** Validate raw unfiltered evidence independently of Trivy's exit code. */
export function checkImageReport(report, db, { imageId, configId, diffIds, revision, dependencies, osPackages, now = Date.now() }) {
  const errors = [], findings = [];
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId || '') || !/^sha256:[a-f0-9]{64}$/.test(configId || '')
      || report?.Metadata?.ImageID !== configId) errors.push('Image config identity mismatch');
  if (!Array.isArray(diffIds) || !diffIds.length || diffIds.some(id => !/^sha256:[a-f0-9]{64}$/.test(id))
      || JSON.stringify(report?.Metadata?.DiffIDs) !== JSON.stringify(diffIds)) errors.push('Image layer identity mismatch');
  if (!/^[a-f0-9]{40}$/.test(revision || '') || report?.Metadata?.ImageConfig?.config?.Labels?.['org.opencontainers.image.revision'] !== revision) errors.push('Image source mismatch');
  if (report?.SchemaVersion !== 2 || report?.ArtifactType !== 'container_image' || report?.Trivy?.Version !== '0.76.1') errors.push('Unsupported scanner report');
  if (!fresh(report?.CreatedAt, now, MAX_SCAN_AGE)) errors.push('Missing or stale scan timestamp');
  if (db?.Version !== 2 || !fresh(db?.UpdatedAt, now, MAX_DB_AGE) || !fresh(db?.DownloadedAt, now, MAX_SCAN_AGE)
      || !Number.isFinite(timestamp(db?.NextUpdate)) || timestamp(db?.NextUpdate) < now - CLOCK_SKEW
      || timestamp(db?.NextUpdate) <= timestamp(db?.UpdatedAt) || timestamp(db?.NextUpdate) > now + 48 * 60 * 60_000) errors.push('Missing, stale or invalid advisory database');
  const system = report?.Metadata?.OS;
  if (system?.Family !== 'debian' || !/^13(?:\.\d+)?$/.test(system?.Name || '')
      || (system?.EOSL !== undefined && system.EOSL !== false)) errors.push('Unsupported or end-of-life image OS');
  const results = report?.Results;
  if (!Array.isArray(results) || !results.length || results.length > 10_000) return { errors: [...errors, 'Missing package scan results'], findings, osPackages: 0, libraryPackages: 0 };
  const systemPackages = new Set(), libraryPackages = new Set();
  for (const result of results) {
    if (!result || typeof result !== 'object') { errors.push('Malformed scan result'); continue; }
    if (result.ExperimentalModifiedFindings !== undefined
        && (!Array.isArray(result.ExperimentalModifiedFindings) || result.ExperimentalModifiedFindings.length)) errors.push('Modified or suppressed findings');
    if (result.Packages !== undefined && !Array.isArray(result.Packages)) errors.push('Malformed package inventory');
    for (const pkg of Array.isArray(result.Packages) ? result.Packages : []) {
      if (typeof pkg?.Name !== 'string' || !pkg.Name || typeof pkg.Version !== 'string' || !pkg.Version) { errors.push('Malformed package inventory'); continue; }
      if (result.Class === 'os-pkgs' && result.Type === 'debian') {
        const version = debianVersion(pkg);
        if (version === null) errors.push('Malformed Debian package version');
        else systemPackages.add(`${pkg.Name.replace(/:[a-z0-9]+$/, '')}@${version}`);
      }
      if (result.Class === 'lang-pkgs' && ['npm', 'node-pkg'].includes(result.Type)) libraryPackages.add(`${pkg.Name}@${pkg.Version}`);
    }
    if (result.Vulnerabilities !== undefined && !Array.isArray(result.Vulnerabilities)) errors.push('Malformed vulnerability list');
    for (const vuln of Array.isArray(result.Vulnerabilities) ? result.Vulnerabilities : []) {
      if (typeof vuln?.VulnerabilityID !== 'string' || !vuln.VulnerabilityID || typeof vuln.PkgName !== 'string' || !vuln.PkgName
          || typeof vuln.InstalledVersion !== 'string' || !vuln.InstalledVersion || !severity.has(vuln.Severity)
          || (vuln.Status !== undefined && typeof vuln.Status !== 'string') || (vuln.FixedVersion !== undefined && typeof vuln.FixedVersion !== 'string')) { errors.push('Malformed vulnerability'); continue; }
      findings.push({ id: vuln.VulnerabilityID, package: vuln.PkgName, version: vuln.InstalledVersion,
        severity: vuln.Severity, status: vuln.Status || 'unknown', fixedVersion: vuln.FixedVersion || null });
      if (['HIGH', 'CRITICAL'].includes(vuln.Severity)) errors.push('High or critical image vulnerability');
    }
  }
  if (!systemPackages.size || !Array.isArray(osPackages) || !osPackages.length
      || osPackages.some(pkg => !systemPackages.has(pkg))) errors.push('Incomplete OS package coverage');
  if (!libraryPackages.size || !dependencies || !Object.keys(dependencies).length
      || Object.entries(dependencies).some(([name, version]) => !libraryPackages.has(`${name}@${version}`))) errors.push('Incomplete production dependency coverage');
  return { errors: [...new Set(errors)], findings, osPackages: systemPackages.size, libraryPackages: libraryPackages.size };
}

export function scannerArgs({ archive, output, name, uid, gid }) {
  if (![archive, output].every(value => path.isAbsolute(value) && !/[\r\n,]/.test(value))
      || !/^kibitz-advisories-[a-f0-9-]+$/.test(name) || !Number.isInteger(uid) || uid < 1 || !Number.isInteger(gid) || gid < 1) throw Error('Invalid scanner boundary');
  return ['run', '--rm', '--name', name, '--user', `${uid}:${gid}`, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--memory=2g', '--cpus=2', '--pids-limit=128', '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m', '--workdir', '/work',
    '--mount', `type=bind,src=${archive},dst=/input/image.tar,readonly`, '--mount', `type=bind,src=${output},dst=/work`, SCANNER_IMAGE,
    '--config', '/dev/null', '--cache-dir', '/work/cache', 'image', '--input', '/input/image.tar', '--scanners', 'vuln',
    '--pkg-types', 'os,library', '--list-all-pkgs', '--format', 'json', '--output', '/work/report.json',
    '--ignorefile', '/dev/null', '--disable-telemetry', '--skip-version-check', '--offline-scan', '--db-repository', DB_REPOSITORY, '--timeout', '8m'];
}

function json(file) {
  return JSON.parse(readBoundedFile(file, 32 * 1024 * 1024).toString('utf8'));
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function run(args = process.argv.slice(2)) {
  if (args.length || process.platform !== 'linux') throw Error('Run the fixed image check in Linux container CI');
  const metadata = path.join(site, 'tests/out/container-metadata'), output = path.join(metadata, 'advisories');
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  for (const name of ['report.json', 'database.json', 'summary.json', 'image-config.json', 'image-rootfs.json', 'cache']) fs.rmSync(path.join(output, name), { recursive: true, force: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-advisories-'));
  fs.mkdirSync(path.join(temp, 'docker-config'));
  const env = { PATH: process.env.PATH, DOCKER_CONFIG: path.join(temp, 'docker-config') };
  const docker = (...values) => execFileSync('docker', values, { cwd: site, env, timeout: 60_000, maxBuffer: 2_000_000, encoding: 'utf8' }).trim();
  /** @type {Record<string, any>} */
  const summary = { scanner: SCANNER_IMAGE, databaseRepository: DB_REPOSITORY,
    date: new Date().toISOString(), complete: false, passed: false, errors: [], findings: [] };
  const name = `kibitz-advisories-${randomUUID()}`;
  let started = false;
  try {
    summary.stage = 'image-metadata';
    const imageId = fs.readFileSync(path.join(metadata, 'image-id.txt'), 'utf8').trim();
    const revision = fs.readFileSync(path.join(metadata, 'revision.txt'), 'utf8').trim();
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: site, env, encoding: 'utf8', timeout: 10_000 }).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId) || !/^[a-f0-9]{40}$/.test(revision) || revision !== head
        || docker('image', 'inspect', '--format', '{{.Id}}', 'kibitz:container-test') !== imageId) throw Error('Image metadata mismatch');
    summary.imageId = imageId; summary.revision = revision;
    summary.node = docker('run', '--rm', '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--entrypoint', 'node', imageId, '--version');
    if (!patchedNode(summary.node)) throw Error('Unreviewed packaged Node version');
    summary.stage = 'image-export';
    const archive = path.join(temp, 'image.tar');
    docker('image', 'save', '--output', archive, imageId);
    const extracted = archiveConfig(archive), diffIds = JSON.parse(docker('image', 'inspect', '--format', '{{json .RootFS.Layers}}', imageId));
    if (JSON.stringify(extracted.config?.rootfs?.diff_ids) !== JSON.stringify(diffIds)
        || extracted.config?.config?.Labels?.['org.opencontainers.image.revision'] !== revision) throw Error('Exported image identity mismatch');
    summary.configId = extracted.id;
    fs.writeFileSync(path.join(output, 'image-config.json'), extracted.bytes);
    fs.writeFileSync(path.join(output, 'image-rootfs.json'), JSON.stringify({ imageId, revision, diffIds }, null, 2) + '\n');
    started = true;
    summary.stage = 'scanner';
    const status = await command('docker', scannerArgs({ archive, output, name, uid: process.getuid(), gid: process.getgid() }), { env, timeout: 600_000 });
    if (status !== 0) throw Error('Scanner operation failed');
    summary.stage = 'raw-evidence';
    const report = json(path.join(output, 'report.json')), db = json(path.join(output, 'cache/db/metadata.json'));
    fs.writeFileSync(path.join(output, 'database.json'), JSON.stringify({ ...db, sha256: await digest(path.join(output, 'cache/db/trivy.db')) }, null, 2) + '\n');
    const dependencies = json(path.join(site, 'package.json')).dependencies;
    const osPackages = fs.readFileSync(path.join(metadata, 'os-packages.txt'), 'utf8').trim().split('\n').map(line => {
      const [pkg, version, ...extra] = line.trim().split(/\s+/);
      if (!pkg || !version || extra.length) throw Error('Malformed OS inventory');
      return `${pkg.replace(/:[a-z0-9]+$/, '')}@${version}`;
    });
    Object.assign(summary, checkImageReport(report, db, { imageId, configId: extracted.id, diffIds, revision, dependencies, osPackages }),
      { complete: true, reportSha256: await digest(path.join(output, 'report.json')), archiveSha256: await digest(archive) });
    summary.passed = !summary.errors.length;
    summary.stage = 'evaluated';
  } catch { summary.errors.push('Image advisory operation incomplete'); }
  finally {
    if (started) {
      try { docker('rm', '--force', name); }
      catch (error) { if (!/No such (container|object)/i.test(String(error.stderr))) summary.errors.push('Scanner cleanup failed'); }
    }
    fs.rmSync(path.join(output, 'cache'), { recursive: true, force: true });
    fs.rmSync(temp, { recursive: true, force: true });
    summary.passed = summary.complete && !summary.errors.length;
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  }
  if (!summary.passed) throw Error('Image advisory verification failed; inspect retained evidence');
  console.log(`Image advisory evidence verified: ${summary.osPackages} OS and ${summary.libraryPackages} library package versions; ${summary.findings.length} retained findings. Not release approval.`);
  return summary;
}

let main = false;
try { main = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { /* Imported from stdin or a test runner. */ }
if (main) run().catch(() => { console.error('Image advisory verification failed; inspect retained evidence.'); process.exitCode = 1; });
