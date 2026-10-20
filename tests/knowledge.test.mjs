import { Chess } from 'chess.js';
import * as K from '../src/knowledge.js';
import fs from 'fs';
const eco = JSON.parse(fs.readFileSync(new URL('../dist/eco.json', import.meta.url)));
function run(label, pgnOrFen, isFen) {
  const c = isFen ? new Chess(pgnOrFen) : (()=>{const c=new Chess(); c.loadPgn(pgnOrFen); return c;})();
  // deepest opening match along history
  let opening=null; const h=new Chess(); if(!isFen){ for(const m of c.history()){ h.move(m); const e=eco[K.epd(h.fen())]; if(e) opening={eco:e[0],name:e[1]}; } }
  const f = K.positionFeatures(c,{ply:c.history().length, opening});
  console.log('\n==',label, opening?.name||''); console.log(f.map(x=>x.tag+'('+x.weight+')').join(', '));
  console.log(K.retrieveLiterature(f,{level:2}).map(r=>r.book.title+' ['+r.hits.map(h=>h.tag)+'] '+(r.where||'')).join('\n'));
  console.log('pawns', K.pawnSignature(c.fen()));
}
run('Najdorf','1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6');
run('IQP','1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 c5 5. cxd5 Nxd5 6. e3 cxd4 7. exd4 Be7 8. Bd3 O-O 9. O-O Nc6 10. Re1 Nf6 11. a3 b6 12. Bc2');
run('Carlsbad','1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 O-O 8. Qc2 Nbd7 9. Nf3 Re8 10. O-O Nf8 11. Rab1');
run('Lucena','1K6/1P1k4/8/8/8/8/r7/5R2 w - - 0 1',true);
run('OCB','8/5k2/4b3/3p4/3B4/4K3/8/8 w - - 0 1',true);
console.log(K.moveMotifs(Chess,'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 2 3','f3f7'));
console.log(K.moveMotifs(Chess,'r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4','f3e5'));
console.log(K.moveMotifs(Chess,'4k3/8/8/8/8/2n5/8/R3K2Q b - - 0 1','c3d1'), 'fork-ish test');
console.log(K.moveMotifs(Chess,'r1bq1rk1/pppn1ppp/4p3/3pP3/1b1P4/2NB1N2/PPP2PPP/R2QK2R w KQ - 0 8','d3h7'));
