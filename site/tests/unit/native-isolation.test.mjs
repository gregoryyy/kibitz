import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { nativePolicy, nativeSystemReads, sandboxCommand } from '../../scripts/native-sandbox.mjs';
import { nativeDiagnostic } from '../../scripts/native-runtime.mjs';
import { sourceControlRoots, assertMetadataUnavailable, acceptNativeProof, writeImageDeployment, imageDeployment } from '../../server/deployment.mjs';

const fixture = t => { const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kibitz-isolation-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; };
test('loader and forged structured diagnostics cannot smuggle private paths or arbitrary fields into logs', () => {
  const privateValue = '/synthetic/private/key.pem';
  assert.equal(nativeDiagnostic('loader failure ' + privateValue), null);
  const safe = nativeDiagnostic(JSON.stringify({ event: 'server_error', code: privateValue, hint: privateValue, secret: privateValue }));
  assert(!safe.includes(privateValue)); assert.equal(JSON.parse(safe).code, 'other'); assert.equal(JSON.parse(safe).secret, undefined);
  assert.equal(JSON.parse(nativeDiagnostic(JSON.stringify({ event: 'server_error', code: 'ERR_KIBITZ_ISOLATION' }))).code, 'ERR_KIBITZ_ISOLATION');
});
test('discover linked worktree and common metadata without evaluating scripts or invoking Git', t => {
  const root = fixture(t), work = path.join(root, 'work'), main = path.join(root, 'main'); fs.mkdirSync(work); fs.mkdirSync(main);
  const common = path.join(main, '.git'), gitdir = path.join(common, 'worktrees/work'); fs.mkdirSync(gitdir, { recursive: true });
  fs.writeFileSync(path.join(work, '.git'), 'gitdir: ' + gitdir + '\n'); fs.writeFileSync(path.join(gitdir, 'commondir'), '../..\n');
  assert.deepEqual(sourceControlRoots(work), [common, gitdir, path.join(work, '.git')].sort());
  assert.throws(() => assertMetadataUnavailable(sourceControlRoots(work)), { code: 'ERR_KIBITZ_ISOLATION' });
  assert.doesNotThrow(() => assertMetadataUnavailable([path.join(root, 'removed', '.git')]));
  const alternate = path.join(root, 'alternate'), next = path.join(root, 'next');
  fs.mkdirSync(path.join(common, 'objects/info'), { recursive: true }); fs.mkdirSync(path.join(alternate, 'info'), { recursive: true }); fs.mkdirSync(next);
  fs.writeFileSync(path.join(common, 'objects/info/alternates'), alternate + '\n'); fs.writeFileSync(path.join(alternate, 'info/alternates'), '../next\n');
  assert.deepEqual(sourceControlRoots(work), [common, gitdir, path.join(work, '.git'), alternate, next].sort());
});

test('policy cannot grant the filesystem root or a directory containing application metadata', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.git'));
  for (const read of [['/'], [root]]) assert.throws(() => nativePolicy({ read, metadata: [path.join(root, '.git')] }), { code: 'ERR_KIBITZ_ISOLATION' });
  assert.throws(() => nativePolicy({ platform: 'unsupported' }), { code: 'ERR_KIBITZ_ISOLATION' });
  fs.writeFileSync(path.join(root, '.git/config'), 'synthetic'); fs.symlinkSync(path.join(root, '.git/config'), path.join(root, 'alias'));
  for (const settings of [{ read: [path.join(root, 'alias')] }, { immutable: [path.join(root, '.git/config')] }]) {
    assert.throws(() => nativePolicy({ ...settings, metadata: [path.join(root, '.git')] }), { code: 'ERR_KIBITZ_ISOLATION' });
  }
  const policy = nativePolicy({ read: [path.join(root, '.git')], metadata: [] });
  assert.throws(() => sandboxCommand({ ...policy, platform: 'linux' }, [], { bubblewrap: path.join(root, 'missing') }), { code: 'ERR_KIBITZ_ISOLATION' });
});

test('native proof refuses a readable canary, malformed descriptor and a copied image marker in a checkout', t => {
  const root = fixture(t), file = path.join(root, 'proof.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, file, nonce: 'a'.repeat(64), metadata: [] }), { mode: 0o600 });
  assert.throws(() => acceptNativeProof(fs.openSync(file, 'r')), { code: 'ERR_KIBITZ_ISOLATION' });
  assert.throws(() => acceptNativeProof(-1), { code: 'ERR_KIBITZ_ISOLATION' });
  assert.equal(imageDeployment(root), false); writeImageDeployment(root); assert.equal(imageDeployment(root), true);
  fs.mkdirSync(path.join(root, '.git')); fs.writeFileSync(path.join(root, '.git/HEAD'), 'synthetic');
  assert.throws(() => imageDeployment(root), { code: 'ERR_KIBITZ_ISOLATION' });
  assert.throws(() => writeImageDeployment(root), { code: 'ERR_KIBITZ_ISOLATION' });
});

test('the real OS sandbox denies original metadata while allowing only selected runtime/state access', { skip: !['darwin', 'linux'].includes(process.platform) }, t => {
  const root = fixture(t), runtime = path.join(root, 'runtime'), state = path.join(root, 'state'), git = path.join(root, '.git');
  for (const directory of [runtime, state, git]) fs.mkdirSync(directory);
  fs.writeFileSync(path.join(git, 'config'), 'SYNTHETIC_METADATA'); fs.writeFileSync(path.join(runtime, 'asset'), 'runtime');
  const database = new DatabaseSync(path.join(git, 'objects.sqlite')); database.exec('CREATE TABLE secret(value); INSERT INTO secret VALUES (42)'); database.close();
  fs.symlinkSync(path.join(git, 'config'), path.join(runtime, 'alias')); fs.writeFileSync(path.join(state, 'identity'), 'readonly');
  const policy = nativePolicy({ read: [...nativeSystemReads(), runtime], write: [state], immutable: [runtime, path.join(state, 'identity')], metadata: [git] });
  const program = `const fs=require('node:fs'),{DatabaseSync}=require('node:sqlite');const [runtime,state,git]=process.argv.slice(1);
if(fs.readFileSync(runtime+'/asset','utf8')!=='runtime')process.exit(2);fs.writeFileSync(state+'/saved','ok');
for(const file of [git+'/config',runtime+'/alias']){try{fs.readFileSync(file);process.exit(3)}catch(e){if(!['EACCES','EPERM','ENOENT'].includes(e.code))process.exit(4)}}
try{new DatabaseSync(git+'/objects.sqlite',{readOnly:true});process.exit(5)}catch{}
for(const file of [runtime+'/asset',state+'/identity']){try{fs.writeFileSync(file,'bad');process.exit(6)}catch(e){if(!['EACCES','EPERM','EROFS'].includes(e.code))process.exit(7)}}
const db=new DatabaseSync(state+'/data.sqlite');db.exec('CREATE TABLE allowed(value)');db.close();console.log('isolated')`;
  const invocation = sandboxCommand(policy, ['-e', program, runtime, state, git]);
  const result = spawnSync(invocation.command, invocation.args, { cwd: runtime, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, `${result.signal || ''} ${result.stderr}`); assert.equal(result.stdout.trim(), 'isolated'); assert.equal(fs.readFileSync(path.join(state, 'saved'), 'utf8'), 'ok');
});
