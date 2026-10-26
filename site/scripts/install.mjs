// `just` must not confuse an existing node_modules directory with current dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('..', import.meta.url));

/** Repair missing/stale dependency trees using the exact lockfile, without install scripts. */
export function ensureDependencies({ directory = SITE, run = spawnSync, runtime = `${process.versions.modules}:${process.platform}:${process.arch}` } = {}) {
  const marker = path.join(directory, 'node_modules', '.kibitz-install');
  const hash = createHash('sha256').update('kibitz-install-v1\0').update(runtime);
  for (const name of ['package.json', 'package-lock.json']) hash.update('\0').update(fs.readFileSync(path.join(directory, name)));
  const fingerprint = hash.digest('hex') + '\n';
  let retained;
  try { retained = fs.readFileSync(marker, 'utf8'); } catch { /* First run or incomplete install. */ }
  const complete = () => run('npm', ['ls', '--all', '--include=dev'], { cwd: directory, stdio: 'ignore' }).status === 0;
  if (retained === fingerprint && complete()) return { installed: false };
  fs.rmSync(marker, { force: true }); // Never retain a successful stamp across a failed repair.
  const result = run('npm', ['ci', '--ignore-scripts', '--include=dev', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
  if (result.status !== 0 || !complete()) throw new Error('Dependency installation is incomplete. Run npm ci --include=dev --ignore-scripts in site/ and retry.');
  fs.writeFileSync(marker, fingerprint);
  return { installed: true };
}

let main = false;
try { main = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch {}
if (main) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node site/scripts/install.mjs');
    ensureDependencies();
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
