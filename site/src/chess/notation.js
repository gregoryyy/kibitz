// Moves as text: reading what the player types, and saying a move for screen readers.
import { germanSanToSan } from '../platform/i18n.js';

export const notationMode = value => ['san', 'german', 'figurine'].includes(value) ? value : 'san';
const GERMAN = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };
const FIGURINES = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
const FROM_FIGURINE = { '♔': 'K', '♕': 'Q', '♖': 'R', '♗': 'B', '♘': 'N', '♚': 'K', '♛': 'Q', '♜': 'R', '♝': 'B', '♞': 'N' };
const SAN_TOKEN = /^(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][1-8](?:=[QRBN])?)[+#]?[!?]*$/;

/** Display a complete SAN token; prose, squares and internal chess records are not rewritten. */
export function displaySan(san, mode = 'san') {
  const text = String(san ?? ''), selected = notationMode(mode);
  if (selected === 'san' || !SAN_TOKEN.test(text)) return text;
  const pieces = selected === 'german' ? GERMAN : FIGURINES;
  return text.replace(/^[KQRBN]/, piece => pieces[piece]).replace(/=([QRBN])/, (_, piece) => '=' + pieces[piece]);
}
export const figurineToSan = text => String(text ?? '').replace(/[♔♕♖♗♘♚♛♜♝♞]/g, piece => FROM_FIGURINE[piece]);

const WORDS = {
  en: { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', takes: 'takes', short: 'castles kingside', long: 'castles queenside', promotes: 'promotes to', check: 'check', mate: 'checkmate' },
  de: { K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', takes: 'schlägt', short: 'kurze Rochade', long: 'lange Rochade', promotes: 'wird zur', check: 'Schach', mate: 'Schachmatt' },
};

// "Nxe5+" -> "knight takes e5, check"; "O-O" -> "castles kingside"; "e8=Q#" -> "e8 promotes to queen, checkmate".
// lang 'de' says it in German ("Springer schlägt e5, Schach").
export function sanToSpeech(san, lang = 'en') {
  const W = WORDS[lang] || WORDS.en, PIECE_WORD = W;
  const m = /^(O-O-O|O-O|([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?)([+#])?/.exec(String(san || ''));
  if (!m) return String(san || '');
  let s;
  if (m[1] === 'O-O') s = W.short;
  else if (m[1] === 'O-O-O') s = W.long;
  else {
    const piece = m[2] ? PIECE_WORD[m[2]] : '';
    const from = (m[3] || '') + (m[4] || '');
    s = [piece, from, m[5] ? W.takes : '', m[6]].filter(Boolean).join(' ');
    if (m[7]) s += ` ${W.promotes} ${PIECE_WORD[m[7]]}`;
  }
  if (m[8] === '+') s += `, ${W.check}`;
  if (m[8] === '#') s += `, ${W.mate}`;
  return s;
}

// The legal move the player means by `text` in `fen`, or {error}. Accepts SAN with or without
// check marks, capture signs and "=" ("Nf3", "nf3", "Ne5" for Nxe5, "e8Q", "0-0") and
// coordinates ("e2e4", "e7e8q", "e2-e4"). A promotion without a piece becomes a queen.
export function parseMoveInput(Chess, fen, text) {
  const moves = new Chess(fen).moves({ verbose: true });
  let t = figurineToSan(text).trim().replace(/[+#!?\s]/g, '').replace(/0/g, 'O');
  if (!t) return { error: 'Type a move first.' };
  const uci = /^([a-h][1-8])-?([a-h][1-8])=?([qrbnQRBN])?$/.exec(t);
  if (uci) {
    const hits = moves.filter(m => m.from === uci[1] && m.to === uci[2] && (!m.promotion || m.promotion === (uci[3] || 'q').toLowerCase()));
    return hits.length ? hits[0] : { error: `${text.trim()} isn't a legal move here.` };
  }
  t = t.replace(/^o-o(-o)?$/i, s => s.toUpperCase());
  const key = s => s.replace(/[+#]/g, '').replace(/=/, '');
  const norm = s => key(s).replace(/x/g, '');
  const promo = s => s.replace(/([a-h][18])([qrbn])$/i, (_, sq, p) => sq + p.toUpperCase());
  const tries = [promo(t), promo(t[0].toUpperCase() + t.slice(1))];
  for (const cand of [...tries, ...tries.map(germanSanToSan)]) {
    const c = cand.replace(/=/, '');
    let hits = moves.filter(m => key(m.san) === c);
    if (!hits.length) hits = moves.filter(m => norm(m.san) === c.replace(/x/g, ''));
    // A bare square with a promotion move ("e8") means promote to a queen.
    if (!hits.length) hits = moves.filter(m => m.promotion === 'q' && norm(m.san) === c.replace(/x/g, '') + 'Q');
    // A piece and a square without the disambiguation SAN needs ("Nd2" when two knights can go there).
    const pc = /^([KQRBN])x?([a-h][1-8])$/.exec(c);
    if (!hits.length && pc) hits = moves.filter(m => m.piece === pc[1].toLowerCase() && m.to === pc[2]);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return { error: `${text.trim()} could mean ${hits.map(h => h.san).join(' or ')}.` };
  }
  return { error: `${text.trim()} isn't a legal move here.` };
}
