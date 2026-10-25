// See docs/AI-FIXTURES.md. Planning/refusal performs no inference or output writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from '../server/ai.mjs';
import { CaptureError, CASES, FILES, checkSecrets, recordFixture, publishFixture } from './fixture-recording.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function main(args = process.argv.slice(2)) {
  try {
    const { values: opt, positionals: names } = parseArgs({ args, allowPositionals: true, options: {
      env: { type: 'string', default: '../.env' }, out: { type: 'string', default: '../.kibitz-data/ai-fixtures' },
      plan: { type: 'boolean', default: false }, yes: { type: 'boolean', default: false },
    } });
    if (!names.length || new Set(names).size !== names.length || names.some(name => !Object.hasOwn(FILES, name))) throw new CaptureError('invalid_selection');
    if (opt.env) { try { process.loadEnvFile(path.resolve(root, opt.env)); } catch (error) { if (error.code !== 'ENOENT') throw new CaptureError('env_unreadable'); } }
    const secrets = ['ANTHROPIC', 'OPENAI', 'MISTRAL'].map(p => process.env[`${p}_API_KEY`]).filter(Boolean);
    const configs = names.map(name => {
      const cfg = loadConfig({ ...process.env, AI_PROVIDER: name });
      if (!cfg.available || cfg.provider !== name) throw new CaptureError('provider_unavailable');
      if (cfg.model.length > 200 || [...cfg.model].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new CaptureError('invalid_model');
      checkSecrets(JSON.stringify({ model: cfg.model }), secrets);
      return cfg;
    });
    const out = path.resolve(root, opt.out);
    // Resolve existing parent aliases without creating output during a dry run.
    let existing = out;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const canonical = path.resolve(fs.realpathSync(existing), path.relative(existing, out));
    const repo = fs.realpathSync(path.dirname(root)), inside = path.relative(repo, canonical);
    const allowed = ['.kibitz-data', path.join('site', 'server', 'fixtures')].some(p => inside === p || inside.startsWith(p + path.sep));
    if (canonical === path.parse(canonical).root || canonical.split(path.sep).some(p => ['.git', 'node_modules'].includes(p)) ||
        (!inside.startsWith('..' + path.sep) && !path.isAbsolute(inside) && !allowed)) throw new CaptureError('invalid_output');
    checkSecrets(canonical, secrets);
    console.log('Fixture plan: up to two HTTP requests per provider; chat 400 and JSON 1500 output tokens.');
    console.log('No SDK retries, redirects, fallback, tools, judge or embeddings. Provider billing may apply, including Ollama aliases.');
    for (const cfg of configs) console.log(`${cfg.provider}: ${JSON.stringify(cfg.model)}; chat + json`);
    console.log(`Output: ${JSON.stringify(canonical)}. Review private fields before copying fixtures into the repository.`);
    if (opt.plan) return 0;
    if (!opt.yes) { console.error('Recording requires --yes after reviewing the plan.'); return 2; }
    // Check the directory before incurring provider work.
    fs.mkdirSync(canonical, { recursive: true, mode: 0o700 });
    fs.accessSync(canonical, fs.constants.W_OK);
    for (const cfg of configs) {
      for (const label of Object.keys(CASES)) {
        const saved = await recordFixture(cfg, label, { secrets });
        await publishFixture(canonical, saved);
        console.log(`${cfg.provider}/${label}: captured HTTP 200`);
      }
    }
    return 0;
  } catch (error) {
    console.error(`fixture_recording: ${error instanceof CaptureError ? error.code : 'operation_failed'}`);
    return 1;
  }
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
