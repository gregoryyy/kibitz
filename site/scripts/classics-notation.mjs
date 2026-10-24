// Offline audit helper for the recorded public-domain score tables.
import { Chess } from 'chess.js';
const piece = {P:'p',R:'r',Kt:'n',B:'b',Q:'q',K:'k'};
const files = {QR:'a',QKt:'b',QB:'c',Q:'d',K:'e',KB:'f',KKt:'g',KR:'h',R:'ah',Kt:'bg',B:'cf'};
function squares(desc, color) {
  const m=/^(QR|QKt|QB|Q|K|KB|KKt|KR|R|Kt|B)([1-8])$/.exec(desc);
  if (!m) throw Error('square '+desc);
  return [...files[m[1]]].map(f=>f+(color==='w'?m[2]:9-Number(m[2])));
}
function candidates(c, source, origins) {
  const text=source.text.replace(/\s/g,'').replace(/X/g,'×').replace(/(?:ch|mate|[!?])+$/g,'');
  const legal=c.moves({verbose:true});
  if (/^O-O(?:-O)?$/.test(text)) return legal.filter(m=>m.san.replace(/[+#]$/,'')===text);
  const separator=text.search(/[-×]/); if(separator<=0 || separator===text.length-1) throw Error('move '+text);
  const from=text.slice(0,separator), op=text[separator], to=text.slice(separator+1), base=/^(Kt|[PRBQK])/.exec(from)?.[1] || (['KR','QR'].includes(from)?'R':null);
  const origin=/^([A-Za-z]+)(?:\(([^()]+)\))?$/.exec(from);
  if(!origin || !['K','Q','R','B','Kt','P','KR','QR','KB','QB','KKt','QKt','KP','QP','RP','BP','KtP'].includes(origin[1]))throw Error('piece '+from);
  const target=op==='×'?/^([A-Za-z]+)(?:\(([^()]+)\))?$/.exec(to):null;
  if(op==='×'&&(!target || !['K','Q','R','B','Kt','P','KR','QR','KB','QB','KKt','QKt','KP','QP','RP','BP','KtP','KRP','QRP','KBP','QBP','KKtP','QKtP'].includes(target[1])))throw Error('capture '+to);
  const qualifiedFrom=/^([KQ])(Kt|R|B|P)$/.exec(from), pawnFrom=/^(R|B|Kt)P$/.exec(from);
  const type=pawnFrom?'p':qualifiedFrom ? piece[qualifiedFrom[2]] : piece[base];
  if (!type) throw Error('piece '+from);
  return legal.filter(m=>{
    if(m.piece!==type || (op==='×')!==!!m.captured) return false;
    if(source.text.includes('ch')&&!/[+#]$/.test(m.san))return false;
    if(source.text.includes('mate')&&!m.san.endsWith('#'))return false;
    if(qualifiedFrom&&qualifiedFrom[2]!=='P'&&origins[m.from]!==qualifiedFrom[1].toLowerCase())return false;
    if(pawnFrom&&!files[pawnFrom[1]].includes(m.from[0]))return false;
    if(qualifiedFrom?.[2]==='P'&&m.from[0]!==files[qualifiedFrom[1]])return false;
    if(['KR','QR'].includes(from)&&origins[m.from]!==from[0].toLowerCase())return false;
    const fromSquare=/\(([^)]+)\)/.exec(from)?.[1];if(fromSquare&&!squares(fromSquare,c.turn()).includes(m.from))return false;
    if(op==='-')return squares(to,c.turn()).includes(m.to);
    const victim=target[1].endsWith('P')?'p':target[1].endsWith('Kt')?'n':piece[target[1].at(-1)];if(victim!==m.captured)return false;
    if(target[2]&&!squares(target[2],c.turn()).includes(m.to))return false;
    const plainPawn=/^(R|B|Kt)P$/.exec(to);if(plainPawn&&!files[plainPawn[1]].includes(m.to[0]))return false;
    const qualified=/^([KQ](?:R|B|Kt))P$/.exec(to);if(qualified&&!files[qualified[1]].includes(m.to[0]))return false;
    return true;
  });
}
/**
 * Reconstruct one unique legal branch for the limited descriptive notation in the recorded
 * Capablanca tables. Ambiguity is checked across the whole score, never guessed per move.
 * This audits factual notation; it does not prove a forced result or a unique best move.
 * @param {{side: string, text: string}[]} line
 * @returns {string[]}
 */
export function transcribeDescriptive(line) {
  if (!Array.isArray(line) || !line.length || line.length > 512 || line.some(m => !m || !['w', 'b'].includes(m.side) || typeof m.text !== 'string' || m.text.length > 100)) throw new Error('Invalid bounded descriptive score.');
  const c = new Chess(), answers = []; let states = 0;
  function visit(i, origins, moves) {
    if (++states > 200_000) throw new Error('Descriptive score exceeds the search budget.');
    if (answers.length > 1) return;
    if (i === line.length) { answers.push(moves); return; }
    if (line[i].side !== c.turn()) return;
    for (const m of candidates(c, line[i], origins)) {
      const next = { ...origins }; delete next[m.to]; next[m.to] = next[m.from]; delete next[m.from];
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const rank = c.turn() === 'w' ? '1' : '8', file = m.flags.includes('k') ? 'h' : 'a', dest = m.flags.includes('k') ? 'f' : 'd';
        next[dest + rank] = next[file + rank]; delete next[file + rank];
      }
      c.move(m.san); visit(i + 1, next, [...moves, m.from + m.to + (m.promotion || '')]); c.undo();
    }
  }
  visit(0, { a1: 'q', h1: 'k', a8: 'q', h8: 'k', b1: 'q', g1: 'k', c1: 'q', f1: 'k', b8: 'q', g8: 'k', c8: 'q', f8: 'k' }, []);
  if (answers.length !== 1) throw new Error(answers.length ? 'Ambiguous descriptive score.' : 'No legal branch matches the descriptive score.');
  return answers[0];
}
