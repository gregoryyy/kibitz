// Assembles dist/ from src/ and the npm packages.
//   dist/index.html   page body as published to a Claude artifact (no <html>/<head>; the host wraps it)
//   dist/_test.html   same page wrapped in a full document, for local testing
//   dist/*.js|wasm    vendored libraries + the knowledge module, served next to the page
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
copy(nm('chess.js/dist/esm/chess.js'), 'chess.js');
copy(nm('@lichess-org/chessground/dist/chessground.min.js'), 'chessground.js');
copy(path.join(root, 'src/knowledge.js'), 'knowledge.js');

if (!fs.existsSync(path.join(dist, 'eco.json')) || process.argv.includes('--eco')) {
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
