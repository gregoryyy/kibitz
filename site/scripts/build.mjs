// Assembles dist/ from src/ and the npm packages.
//   dist/index.html   page body as published to a Claude artifact (no <html>/<head>; the host wraps it)
//   dist/_test.html   same page wrapped in a full document, for local testing
//   dist/*.js|wasm    vendored libraries + the knowledge module, served next to the page
//   dist/eco.json     opening names by position; dist/openings.json every named line with its moves
//   dist/LICENSE.txt, dist/THIRD_PARTY_NOTICES.md
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = p => path.join(root, 'node_modules', p);
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const copy = (from, to) => fs.copyFileSync(from, path.join(dist, to));
copy(nm('stockfish/bin/stockfish-19-lite-single.js'), 'sf.js');
copy(nm('stockfish/bin/stockfish-19-lite-single.wasm'), 'sf.wasm');
copy(nm('stockfish/bin/stockfish-19-asm.js'), 'sf-asm.js');
// Multi-threaded build, used when the page is cross-origin isolated (the server sends COOP and COEP)
copy(nm('stockfish/bin/stockfish-19-lite.js'), 'sf-mt.js');
copy(nm('stockfish/bin/stockfish-19-lite.wasm'), 'sf-mt.wasm');
copy(nm('chess.js/dist/esm/chess.js'), 'chess.js');
copy(nm('@lichess-org/chessground/dist/chessground.min.js'), 'chessground.js');
// wllama runs the in-browser model (TODO 2.16): one ES module and one wasm (WebGPU, or WebAssembly on the CPU)
copy(nm('@wllama/wllama/esm/index.js'), 'wllama.js');
copy(nm('@wllama/wllama/esm/wasm/wllama.wasm'), 'wllama.wasm');
// The page's own modules (knowledge.js, engine.js, store.js, prompt.js, ...)
for (const f of fs.readdirSync(path.join(root, 'src'))) if (f.endsWith('.js')) copy(path.join(root, 'src', f), f);
// Licence texts ship with the page (GPL-3.0; chess.js's BSD notice is in the notices file)
copy(path.join(root, '../LICENSE'), 'LICENSE.txt');
copy(path.join(root, '../THIRD_PARTY_NOTICES.md'), 'THIRD_PARTY_NOTICES.md');

if (!fs.existsSync(path.join(dist, 'eco.json')) || !fs.existsSync(path.join(dist, 'openings.json')) || process.argv.includes('--eco')) {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-eco.mjs')], { stdio: 'inherit' });
}

const cgBase = fs.readFileSync(nm('@lichess-org/chessground/assets/chessground.base.css'), 'utf8');
const cgPieces = fs.readFileSync(nm('@lichess-org/chessground/assets/chessground.cburnett.css'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
  .replace('/*CG_BASE*/', () => cgBase).replace('/*CG_PIECES*/', () => cgPieces);
fs.writeFileSync(path.join(dist, 'index.html'), page);
fs.writeFileSync(path.join(dist, '_test.html'),
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + page + '</body></html>');
console.log('Built dist/ (' + fs.readdirSync(dist).join(', ') + ')');
