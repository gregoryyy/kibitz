// Models for the in-browser coach (TODO 2.16): GGUF files the page runs itself with wllama.
// scripts/fetch-model.mjs downloads one once into site/models/; scripts/serve.mjs --models then
// serves it from there, so the page never fetches weights from another host. Each file is
// pinned by size and SHA-256 (taken from the Hugging Face LFS metadata).
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const HF = (repo, file) => `https://huggingface.co/${repo}/resolve/main/${file}`;
export const BROWSER_MODELS = [
  {
    id: 'qwen2.5-1.5b', name: 'Qwen2.5 1.5B Instruct', licence: 'Apache-2.0',
    file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', bytes: 1117320736,
    sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
    source: HF('Qwen/Qwen2.5-1.5B-Instruct-GGUF', 'qwen2.5-1.5b-instruct-q4_k_m.gguf'),
  },
  {
    id: 'qwen2.5-0.5b', name: 'Qwen2.5 0.5B Instruct', licence: 'Apache-2.0',
    file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', bytes: 491400032,
    sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
    source: HF('Qwen/Qwen2.5-0.5B-Instruct-GGUF', 'qwen2.5-0.5b-instruct-q4_k_m.gguf'),
  },
];
export const DEFAULT_BROWSER_MODEL = 'qwen2.5-1.5b';

export function browserModel(id = DEFAULT_BROWSER_MODEL) {
  const m = BROWSER_MODELS.find(x => x.id === (id || DEFAULT_BROWSER_MODEL));
  if (!m) throw new Error(`Unknown in-browser model "${id}"; one of ${BROWSER_MODELS.map(x => x.id).join(', ')}`);
  return m;
}

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('error', reject).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex')));
  });
}

// After a full check, a marker next to the file records the hash, so starting the server
// doesn't hash a gigabyte every time. The marker isn't served (only .gguf files are).
const markerOf = file => file + '.sha256';
export async function verifyModel(dir, m) {
  const file = path.join(dir, m.file);
  let st;
  try { st = fs.statSync(file); } catch { return { ok: false, reason: 'missing' }; }
  if (st.size !== m.bytes) return { ok: false, reason: `size ${st.size}, expected ${m.bytes}` };
  const hash = await sha256File(file);
  if (hash !== m.sha256) return { ok: false, reason: `SHA-256 ${hash}, expected ${m.sha256}` };
  fs.writeFileSync(markerOf(file), hash + '\n');
  return { ok: true, reason: '' };
}

// Quick check for the server: the file is there with the right size and a matching marker.
// Returns the settings the gateway's "browser" provider reads (ai.mjs), or why there are none.
export function modelEnv(dir, id) {
  const m = browserModel(id), file = path.join(dir, m.file);
  let ok = false;
  try { ok = fs.statSync(file).size === m.bytes && fs.readFileSync(markerOf(file), 'utf8').trim() === m.sha256; } catch { /* missing */ }
  if (!ok) return { env: {}, reason: `${m.name} isn't downloaded or checked yet: run \`just offline\` once` };
  return { env: { BROWSER_MODEL_URL: `models/${m.file}`, BROWSER_MODEL_NAME: m.name, BROWSER_MODEL_BYTES: String(m.bytes) }, reason: '' };
}

// The model files a server may hand out under /models/: catalog files only, nothing else in the folder.
export const servableModel = name => BROWSER_MODELS.some(m => m.file === name);
