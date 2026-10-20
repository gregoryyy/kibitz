import { Chess } from 'chess.js';
import fs from 'fs';
const out = {};
let n=0;
for (const f of 'abcde') {
  const lines = fs.readFileSync(new URL(`../data/eco/${f}.tsv`, import.meta.url),'utf8').trim().split('\n').slice(1);
  for (const l of lines) {
    const [eco,name,pgn] = l.split('\t');
    const c = new Chess();
    const sans = pgn.replace(/\d+\.(\.\.)?/g,' ').trim().split(/\s+/);
    for (const s of sans) c.move(s);
    const epd = c.fen().split(' ').slice(0,4).join(' ');
    // keep longest (most specific) name per position
    if (!out[epd] || out[epd][2] < sans.length) out[epd] = [eco,name,sans.length];
    n++;
  }
}
const compact = Object.fromEntries(Object.entries(out).map(([k,v])=>[k,[v[0],v[1]]]));
fs.writeFileSync(new URL('../dist/eco.json', import.meta.url), JSON.stringify(compact));
console.log(n, Object.keys(compact).length, fs.statSync(new URL('../dist/eco.json', import.meta.url)).size);
