// Downloads the in-browser model once into site/models/ and checks it (TODO 2.16.0).
//   node scripts/fetch-model.mjs [--model ID] [--dir models] [--timeout-ms 1800000]
// The file comes from Hugging Face over HTTPS and only counts once its size and SHA-256 match
// the catalog (server/models.mjs). Later runs see the checked file and do nothing, so `just
// offline` works without a network after the first time.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { BROWSER_MODELS, browserModel, modelEnv, verifyModel } from '../server/models.mjs';
import { downloadModel, MODEL_DOWNLOAD_TIMEOUT_MS } from './download-model.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: opt } = parseArgs({ options: { model: { type: 'string', default: process.env.BROWSER_MODEL || '' }, dir: { type: 'string', default: path.join(root, 'models') }, 'timeout-ms': { type: 'string', default: String(MODEL_DOWNLOAD_TIMEOUT_MS) } } });
const MB = n => (n / 1e6).toFixed(0) + ' MB';

let m;
try { m = browserModel(opt.model); } catch (e) { console.error(e.message); process.exit(2); }
const dir = path.resolve(opt.dir), file = path.join(dir, m.file);
const timeoutMs = Number(opt['timeout-ms']);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2 ** 31 - 1) { console.error('--timeout-ms must be a positive integer up to 2147483647.'); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });

if (!modelEnv(dir, m.id).reason) { console.log(`${m.name}: already downloaded and checked (${path.relative(process.cwd(), file)})`); process.exit(0); }
if (fs.existsSync(file) && fs.statSync(file).size === m.bytes) {
  console.log(`${m.name}: checking the file that's already there…`);
  if ((await verifyModel(dir, m)).ok) { console.log('OK'); process.exit(0); }
}

console.log(`${m.name} (${m.licence}): downloading ${MB(m.bytes)} from ${m.source}`);
let shown = -1;
try {
  await downloadModel(dir, m, { timeoutMs, onProgress: got => {
    const pct = Math.floor(got / m.bytes * 100);
    if (pct !== shown && pct % 5 === 0) { shown = pct; process.stdout.write(`\r  ${pct}% (${MB(got)})`); }
  } });
  process.stdout.write('\n');
  console.log(`OK: ${path.relative(process.cwd(), file)} (SHA-256 checked). Other models: ${BROWSER_MODELS.map(x => x.id).join(', ')} (--model ID).`);
} catch (error) { console.error(`\nDownload failed: ${error.message}`); process.exitCode = 1; }
