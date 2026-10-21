// Languages (TODO 10.8). English is the source: the page and the code are written in English,
// and a language is a dictionary from English text to its translation (i18n-de.js). Pure, like
// knowledge.js: the page applies it to its own text as it renders (index.html, translateTree).
//
// A key is either exact text ("Start game") or a template with {placeholders} for the parts
// that vary ("{n} games", "{move} isn't a legal move here."). The parts are translated again
// when they are themselves known text ("knight" -> "Springer"), so sentences built from smaller
// pieces in knowledge.js, tutor.js and modes.js need no change there.
// German needs the part in a phrase sometimes ("den Springer", "Springerzug"): in a translation,
// {p|the *} is the translation of "the knight" when p is "knight", and {p} where there is none.
// Keys starting with "@" only translate parts, never whole text ("@{a} and {b}"), so a loose
// connector can't half-translate an unknown sentence.
// The prompts stay in English; only the coach's answers are asked for in the player's language.

export const LANGS = { en: 'English', de: 'Deutsch' };

// The language to use: the saved choice, else the browser's first supported language, else English.
export function pickLang(saved, preferred = []) {
  if (saved && LANGS[saved]) return saved;
  for (const p of preferred) { const l = String(p).toLowerCase().split('-')[0]; if (LANGS[l]) return l; }
  return 'en';
}

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A translator for one dictionary: t(text) gives the translation, or the text itself when there is
// none. Whitespace around the text is kept. vars fill {placeholders} in exact keys: t('{n} games', {n: 3}).
export function translator(dict = {}) {
  const exact = new Map();
  const templates = [];
  for (const [key, v] of Object.entries(dict)) {
    const nested = key.startsWith('@'), k = nested ? key.slice(1) : key;
    if (/\{\w+\}/.test(k)) {
      const names = [...k.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
      const re = new RegExp('^' + k.split(/\{\w+\}/).map(escape).join('(.+?)') + '$', 's');
      templates.push({ k, v, names, re, nested, literal: k.replace(/\{\w+\}/g, '').length });
    }
    if (!nested) exact.set(k, v); else exact.set('@' + k, v);
  }
  templates.sort((a, b) => b.literal - a.literal); // the most specific template first
  const fill = (v, vars, raw = {}) => v.replace(/\{(\w+)(?:\|([^}]*))?\}/g, (m, n, phrase) => {
    if (!(n in vars)) return m;
    if (phrase) { const hit = lookup(phrase.replace('*', raw[n]), 1); if (hit !== null) return hit; }
    return String(vars[n]);
  });

  function lookup(s, depth) {
    if (exact.has(s)) return exact.get(s);
    if (depth > 0 && exact.has('@' + s)) return exact.get('@' + s);
    if (depth > 3 || s.length > 600) return null;
    for (const tp of templates) {
      if (tp.nested && depth === 0) continue;
      const m = tp.re.exec(s);
      if (!m) continue;
      const vars = {}, raw = {};
      tp.names.forEach((n, i) => { raw[n] = m[i + 1]; vars[n] = lookup(m[i + 1], depth + 1) ?? m[i + 1]; });
      return fill(tp.v, vars, raw);
    }
    return null;
  }
  return {
    // The translation of text as shown; null when there is none (for finding gaps).
    find(text) {
      const s = String(text); const core = s.trim();
      if (!core) return null;
      const hit = lookup(core, 0);
      return hit === null ? null : s.slice(0, s.indexOf(core)) + hit + s.slice(s.indexOf(core) + core.length);
    },
    t(text, vars = null) {
      const s = String(text);
      const hit = vars ? (exact.get(s) ?? s) : (this.find(s) ?? s);
      return vars ? fill(hit, vars) : hit;
    },
  };
}

// Text worth translating: has a word in it, and isn't only a move, a square, a number or a FEN.
export function isText(s) {
  const core = String(s).trim();
  if (/^[\w/]+ [wb] [-KQkq]+ [-a-h1-8]+/.test(core)) return false; // a FEN
  // Without moves (Nf3, exd5, O-O, e8=Q+), move numbers and squares, is a word left?
  return /[A-Za-z]{3,}/.test(core.replace(/\b(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?/g, ' '));
}

// German piece letters (K, D, T, L, S) in moves, as German players write them, to SAN:
// "Sf3" -> "Nf3", "Dxd5+" -> "Qxd5+", "e8=D" -> "e8=Q". Only tokens that are moves change.
const DE_PIECES = { K: 'K', D: 'Q', T: 'R', L: 'B', S: 'N' };
export function germanSanToSan(text) {
  return String(text)
    .replace(/(^|[^A-Za-z0-9])([KDTLS])([a-h]?[1-8]?x?[a-h][1-8])(?![A-Za-z0-9])/g, (_, pre, p, rest) => pre + DE_PIECES[p] + rest)
    .replace(/([a-h][18])=?([DTLS])(?![A-Za-z])/g, (_, sq, p) => `${sq}=${DE_PIECES[p]}`);
}
