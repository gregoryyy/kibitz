// Downloads the in-browser model once into site/models/ and checks it (TODO 2.16.0).
//   node scripts/fetch-model.mjs [--model ID] [--dir models]
// The file comes from Hugging Face over HTTPS and only counts once its size and SHA-256 match
// the catalog (server/models.mjs). Later runs see the checked file and do nothing, so `just
// offline` works without a network after the first time.
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { BROWSER_MODELS, browserModel, modelEnv, verifyModel } from '../server/models.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: opt } = parseArgs({ options: { model: { type: 'string', default: process.env.BROWSER_MODEL || '' }, dir: { type: 'string', default: path.join(root, 'models') } } });
const MB = n => (n / 1e6).toFixed(0) + ' MB';

let m;
try { m = browserModel(opt.model); } catch (e) { console.error(e.message); process.exit(2); }
const dir = path.resolve(opt.dir), file = path.join(dir, m.file);
fs.mkdirSync(dir, { recursive: true });

if (!modelEnv(dir, m.id).reason) { console.log(`${m.name}: already downloaded and checked (${path.relative(process.cwd(), file)})`); process.exit(0); }
if (fs.existsSync(file) && fs.statSync(file).size === m.bytes) {
  console.log(`${m.name}: checking the file that's already there…`);
  if ((await verifyModel(dir, m)).ok) { console.log('OK'); process.exit(0); }
}

console.log(`${m.name} (${m.licence}): downloading ${MB(m.bytes)} from ${m.source}`);
const part = file + '.part';
const res = await fetch(m.source);
if (!res.ok || !res.body) { console.error(`Download failed: HTTP ${res.status}`); process.exit(1); }
let got = 0, shown = -1;
const body = Readable.fromWeb(/** @type {any} */ (res.body));
body.on('data', d => {
  got += d.length;
  const pct = Math.floor(got / m.bytes * 100);
  if (pct !== shown && pct % 5 === 0) { shown = pct; process.stdout.write(`\r  ${pct}% (${MB(got)})`); }
});
await pipeline(body, fs.createWriteStream(part));
process.stdout.write('\n');
fs.renameSync(part, file);
const check = await verifyModel(dir, m);
if (!check.ok) {
  fs.rmSync(file, { force: true });
  console.error(`The download doesn't match the catalog (${check.reason}); it was deleted. Try again, or check server/models.mjs.`);
  process.exit(1);
}
console.log(`OK: ${path.relative(process.cwd(), file)} (SHA-256 checked). Other models: ${BROWSER_MODELS.map(x => x.id).join(', ')} (--model ID).`);
