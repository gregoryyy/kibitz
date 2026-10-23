// Kibitz knowledge layer: position features, literature catalog, retrieval.
// Pure functions over chess.js objects so they can be tested outside the page.

export const TAG_LABELS = {
  opening: 'Opening play', middlegame: 'Middlegame planning', endgame: 'Endgame',
  'open-games': '1.e4 e5 open games', sicilian: 'Sicilian Defence', french: 'French Defence',
  'caro-kann': 'Caro-Kann', 'pirc-modern': 'Pirc / Modern', scandinavian: 'Scandinavian',
  alekhine: 'Alekhine Defence', 'queens-gambit': "Queen's Gambit", slav: 'Slav',
  kid: "King's Indian", nimzo: 'Nimzo-Indian', qid: "Queen's Indian", grunfeld: 'Grünfeld',
  benoni: 'Benoni', dutch: 'Dutch', english: 'English Opening', flank: 'Réti / flank openings',
  'd-pawn': 'Queen-pawn systems', italian: 'Italian Game', 'ruy-lopez': 'Ruy Lopez',
  iqp: 'Isolated queen pawn', 'hanging-pawns': 'Hanging pawns', carlsbad: 'Carlsbad structure',
  maroczy: 'Maróczy bind', 'french-chain': 'French pawn chain', 'kid-chain': 'King\'s Indian pawn chain',
  'benoni-structure': 'Benoni structure', hedgehog: 'Hedgehog', stonewall: 'Stonewall',
  'open-center': 'Open centre', 'closed-center': 'Closed centre', 'opposite-castling': 'Opposite-side castling',
  'passed-pawn': 'Passed pawn', 'isolated-pawn': 'Isolated pawn', 'doubled-pawns': 'Doubled pawns',
  'bishop-pair': 'Bishop pair', 'pawn-endgame': 'King and pawn ending', 'rook-endgame': 'Rook ending',
  'rook-pawn-vs-rook': 'Rook + pawn vs rook', ocb: 'Opposite-coloured bishops',
  'minor-endgame': 'Minor-piece ending', 'queen-endgame': 'Queen ending', 'rook-vs-minor': 'Rook vs minor piece',
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer', 'discovered-attack': 'Discovered attack', 'double-check': 'Double check',
  deflection: 'Deflection', decoy: 'Decoy', overloading: 'Overloading', interference: 'Interference',
  'removing-defender': 'Removing the defender', zwischenzug: 'Zwischenzug', 'back-rank': 'Back-rank weakness',
  'hanging-piece': 'Loose / hanging piece', promotion: 'Promotion', sacrifice: 'Sacrifice',
  'greek-gift': 'Bishop sacrifice on h7/h2', 'king-attack': 'Attack on the king', mate: 'Checkmate pattern',
  calculation: 'Calculation & blunder-checking', planning: 'Planning & imbalances', 'king-activity': 'King activity',
};

// --- Literature catalog -------------------------------------------------
// Book-level metadata only; `where` points to the part of the book that matches a tag.
export const LITERATURE = [
  { id: 'fco', title: 'Fundamental Chess Openings', author: 'Paul van der Sterren', year: 2009, level: 2,
    tags: ['opening', 'open-games', 'sicilian', 'french', 'caro-kann', 'pirc-modern', 'scandinavian', 'alekhine', 'queens-gambit', 'slav', 'kid', 'nimzo', 'qid', 'grunfeld', 'benoni', 'dutch', 'english', 'flank', 'd-pawn', 'italian', 'ruy-lopez'],
    about: 'A one-volume survey of every major opening that explains the ideas and typical plans behind each line instead of listing raw theory.',
    where: { _opening: 'the chapter on this opening family' } },
  { id: 'mco', title: 'Mastering the Chess Openings (4 vols)', author: 'John Watson', year: 2006, level: 3,
    tags: ['opening', 'open-games', 'sicilian', 'french', 'caro-kann', 'queens-gambit', 'slav', 'kid', 'nimzo', 'qid', 'grunfeld', 'benoni', 'english', 'flank', 'italian', 'ruy-lopez'],
    about: 'Explains why openings are played the way they are, with the strategic themes that carry into the middlegame. Volume 4 covers the English and Réti.',
    where: { english: 'Volume 4', flank: 'Volume 4' } },
  { id: 'structures', title: 'Chess Structures: A Grandmaster Guide', author: 'Mauricio Flores Rios', year: 2015, level: 3,
    tags: ['middlegame', 'iqp', 'hanging-pawns', 'carlsbad', 'maroczy', 'french-chain', 'kid-chain', 'benoni-structure', 'hedgehog', 'stonewall', 'grunfeld', 'caro-kann', 'slav', 'planning'],
    about: 'Organised by pawn structure. Each chapter teaches the standard plans for both sides through annotated model games.',
    where: { iqp: 'the Isolated Queen Pawn chapter', 'hanging-pawns': 'the Hanging Pawns chapter', carlsbad: 'the Carlsbad chapter', maroczy: 'the Maróczy chapter', 'french-chain': 'the French chapters', 'kid-chain': "the King's Indian chapters", 'benoni-structure': 'the Benoni chapter', hedgehog: 'the Hedgehog chapter', stonewall: 'the Stonewall chapter' } },
  { id: 'soltis', title: 'Pawn Structure Chess', author: 'Andrew Soltis', year: 1976, level: 2,
    tags: ['middlegame', 'planning', 'iqp', 'maroczy', 'french-chain', 'kid-chain', 'open-center', 'closed-center', 'carlsbad', 'stonewall', 'sicilian'],
    about: 'Groups openings into a small number of pawn-structure families and shows the plans that belong to each.',
    where: {} },
  { id: 'nimzo', title: 'My System', author: 'Aron Nimzowitsch', year: 1925, level: 2,
    tags: ['middlegame', 'passed-pawn', 'isolated-pawn', 'french-chain', 'closed-center', 'planning'],
    about: 'The classic on open files, the seventh rank, passed pawns and blockade, pawn chains and prophylaxis.',
    where: { 'passed-pawn': 'the sections on the passed pawn and blockade', 'french-chain': 'the section on pawn chains', 'isolated-pawn': 'the section on the isolated queen pawn' } },
  { id: 'reassess', title: 'How to Reassess Your Chess', author: 'Jeremy Silman', year: 2010, level: 2,
    tags: ['middlegame', 'planning', 'bishop-pair', 'open-center', 'closed-center', 'isolated-pawn', 'doubled-pawns'],
    about: 'Teaches planning from the imbalances in a position: minor pieces, pawn structure, space, material and development.',
    where: { 'bishop-pair': 'the chapters on bishops versus knights' } },
  { id: 'amateur', title: "The Amateur's Mind", author: 'Jeremy Silman', year: 1999, level: 1,
    tags: ['middlegame', 'planning', 'calculation'],
    about: 'Shows the typical thinking errors of club players through their own games and how to correct them.', where: {} },
  { id: 'logical', title: 'Logical Chess: Move by Move', author: 'Irving Chernev', year: 1957, level: 1,
    tags: ['opening', 'middlegame', 'king-attack', 'planning'],
    about: 'Explains every single move of 33 master games, a gentle introduction to principled play.', where: {} },
  { id: 'stean', title: 'Simple Chess', author: 'Michael Stean', year: 1978, level: 1,
    tags: ['middlegame', 'planning', 'isolated-pawn', 'open-center', 'doubled-pawns'],
    about: 'Short, clear lessons on weak squares, outposts, open files, weak pawns and the majority.', where: {} },
  { id: 'vukovic', title: 'The Art of Attack in Chess', author: 'Vladimir Vuković', year: 1965, level: 3,
    tags: ['king-attack', 'greek-gift', 'opposite-castling', 'sacrifice', 'mate'],
    about: 'A systematic treatment of attacks on the castled king, including the classic bishop sacrifice on h7.',
    where: { 'greek-gift': 'the chapter on the classic bishop sacrifice' } },
  { id: 'weteschnik', title: 'Understanding Chess Tactics', author: 'Martin Weteschnik', year: 2006, level: 2,
    tags: ['fork', 'pin', 'discovered-attack', 'back-rank', 'hanging-piece', 'sacrifice', 'mate'],
    about: 'Explains why tactics appear (loose pieces, exposed kings, overloaded defenders) so you can spot them in your own games.', where: {} },
  { id: 'polgar', title: 'Chess Tactics for Champions', author: 'Susan Polgar & Paul Truong', year: 2006, level: 1,
    tags: ['fork', 'pin', 'discovered-attack', 'back-rank', 'mate', 'promotion', 'hanging-piece'],
    about: 'Motif-by-motif tactics training with worked examples and exercises.', where: {} },
  { id: 'woodpecker', title: 'The Woodpecker Method', author: 'Axel Smith & Hans Tikkanen', year: 2018, level: 3,
    tags: ['fork', 'pin', 'discovered-attack', 'sacrifice', 'calculation', 'mate'],
    about: 'A repetition-based programme of over a thousand puzzles to make tactical patterns automatic.', where: {} },
  { id: 'reinfeld', title: '1001 Winning Chess Sacrifices and Combinations', author: 'Fred Reinfeld', year: 1955, level: 1,
    tags: ['sacrifice', 'mate', 'fork', 'pin', 'back-rank', 'king-attack'],
    about: 'A classic puzzle collection grouped by tactical theme.', where: {} },
  { id: 'kotov', title: 'Think Like a Grandmaster', author: 'Alexander Kotov', year: 1971, level: 3,
    tags: ['calculation', 'planning'],
    about: 'Introduces candidate moves and the tree of analysis, the standard method for calculating cleanly.', where: {} },
  { id: 'rowson', title: 'The Seven Deadly Chess Sins', author: 'Jonathan Rowson', year: 2000, level: 3,
    tags: ['calculation', 'planning'],
    about: 'On the psychological roots of mistakes: thinking, blinking, wanting, materialism and more.', where: {} },
  { id: 'silman-end', title: "Silman's Complete Endgame Course", author: 'Jeremy Silman', year: 2007, level: 1,
    tags: ['endgame', 'pawn-endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'minor-endgame', 'ocb', 'queen-endgame', 'rook-vs-minor', 'king-activity'],
    about: 'Endgames taught in the order you need them, organised by rating band from beginner to master.', where: {} },
  { id: 'villa', title: '100 Endgames You Must Know', author: 'Jesús de la Villa', year: 2008, level: 2,
    tags: ['endgame', 'pawn-endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'minor-endgame', 'queen-endgame', 'rook-vs-minor'],
    about: 'The essential theoretical endings (Lucena, Philidor, opposition, key squares and more) with exercises.',
    where: { 'rook-pawn-vs-rook': 'the rook and pawn versus rook positions (Lucena, Philidor)', 'pawn-endgame': 'the king and pawn chapters' } },
  { id: 'dvoretsky', title: "Dvoretsky's Endgame Manual", author: 'Mark Dvoretsky', year: 2003, level: 4,
    tags: ['endgame', 'pawn-endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'ocb', 'minor-endgame', 'queen-endgame', 'rook-vs-minor'],
    about: 'The standard advanced endgame reference, with the key positions highlighted for study.', where: {} },
  { id: 'fce', title: 'Fundamental Chess Endings', author: 'Karsten Müller & Frank Lamprecht', year: 2001, level: 4,
    tags: ['endgame', 'pawn-endgame', 'rook-endgame', 'rook-pawn-vs-rook', 'ocb', 'minor-endgame', 'queen-endgame', 'rook-vs-minor'],
    about: 'An encyclopedic one-volume reference for theoretical endings.', where: {} },
  { id: 'shereshevsky', title: 'Endgame Strategy', author: 'Mikhail Shereshevsky', year: 1985, level: 3,
    tags: ['endgame', 'king-activity', 'passed-pawn', 'bishop-pair', 'planning'],
    about: 'Practical endgame technique: king activity, the principle of two weaknesses and not hurrying.', where: {} },
  { id: 'watson-french', title: 'Play the French', author: 'John Watson', year: 2012, level: 2,
    tags: ['french', 'french-chain'],
    about: 'A complete French Defence repertoire with an emphasis on understanding the pawn chain.', where: {} },
];

// --- Opening family from ECO name ---------------------------------------
/** @type {[RegExp, string][]} */
const FAMILY_RULES = [
  [/^Sicilian/, 'sicilian'], [/^French/, 'french'], [/^Caro-Kann/, 'caro-kann'],
  [/^(Pirc|Modern Defense)/, 'pirc-modern'], [/^Scandinavian/, 'scandinavian'], [/^Alekhine/, 'alekhine'],
  [/^Ruy Lopez/, 'ruy-lopez'], [/^(Italian|Two Knights)/, 'italian'],
  [/^(King's Pawn|Scotch|Petrov|Russian|Vienna|King's Gambit|Philidor|Four Knights|Three Knights|Bishop's Opening|Center Game|Danish|Ponziani|Latvian|Elephant)/, 'open-games'],
  [/^Slav|Semi-Slav/, 'slav'], [/^Queen's Gambit/, 'queens-gambit'], [/^Tarrasch/, 'queens-gambit'],
  [/^King's Indian/, 'kid'], [/^Nimzo-Indian/, 'nimzo'], [/^(Queen's Indian|Bogo-Indian)/, 'qid'],
  [/^Gr(ü|u)nfeld/, 'grunfeld'], [/^(Benoni|Benko)/, 'benoni'], [/^Dutch/, 'dutch'],
  [/^English/, 'english'], [/^(Zukertort|Réti|Reti|King's Indian Attack|Nimzo-Larsen|Bird|Polish|Hungarian)/, 'flank'],
  [/^(Queen's Pawn|London|Colle|Trompowsky|Torre|Richter-Veresov|Indian Defense|Catalan|Blackmar)/, 'd-pawn'],
];
export function openingFamily(name) {
  if (!name) return null;
  for (const [re, tag] of FAMILY_RULES) if (re.test(name)) return tag;
  return null;
}

// --- Board helpers --------------------------------------------------------
const FILES = 'abcdefgh';
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function epd(fen) { return fen.split(' ').slice(0, 4).join(' '); }
export function pawnSignature(fen) {
  // Placement of pawns only: a structure fingerprint for "similar positions".
  return fen.split(' ')[0].replace(/[^pP/\d]/g, '1').replace(/1+/g, m => String(m.length))
    .split('/').map(r => r.replace(/\d+/g, d => String([...d].reduce((a, c) => a + +c, 0)))).join('/');
}
function pieces(chess) {
  const out = [];
  chess.board().forEach(row => row.forEach(p => p && out.push(p)));
  return out;
}
function squareColor(sq) { return (FILES.indexOf(sq[0]) + +sq[1]) % 2 === 1 ? 'light' : 'dark'; }
function pawnMap(ps, color) {
  const files = {};
  ps.filter(p => p.type === 'p' && p.color === color).forEach(p => { (files[p.square[0]] ??= []).push(+p.square[1]); });
  return files;
}
function has(ps, color, sq) { return ps.some(p => p.type === 'p' && p.color === color && p.square === sq); }

export function material(chess) {
  const m = { w: 0, b: 0 };
  pieces(chess).forEach(p => { m[p.color] += VAL[p.type]; });
  return m;
}

// --- Feature extraction ---------------------------------------------------
// Returns [{tag, weight, why}] describing the current position.
export function positionFeatures(chess, ctx = {}) {
  const ps = pieces(chess);
  const feats = [];
  const add = (tag, weight, why) => { if (!feats.some(f => f.tag === tag)) feats.push({ tag, weight, why }); };
  const nonPawn = c => ps.filter(p => p.color === c && !['p', 'k'].includes(p.type)).reduce((a, p) => a + VAL[p.type], 0);
  const count = (c, t) => ps.filter(p => p.color === c && p.type === t).length;
  const npW = nonPawn('w'), npB = nonPawn('b');
  const ply = ctx.ply ?? 0;

  // Phase
  const queens = count('w', 'q') + count('b', 'q');
  const isEnd = (npW <= 13 && npB <= 13 && queens === 0) || (npW + npB <= 20);
  const phase = isEnd ? 'endgame' : (ply <= 20 && ctx.opening) ? 'opening' : 'middlegame';
  add(phase, 1, phase === 'opening' ? `Move ${Math.ceil((ply || 1) / 2)}, still in known opening territory` : phase === 'endgame' ? 'Little material left on the board' : 'Pieces developed, out of the opening');

  if (ctx.opening) {
    const fam = openingFamily(ctx.opening.name);
    if (fam) add(fam, 3, `${ctx.opening.eco} ${ctx.opening.name}`);
  }

  const W = pawnMap(ps, 'w'), B = pawnMap(ps, 'b');
  // Isolated queen pawn
  for (const [, M, other] of [['w', W, 'White'], ['b', B, 'Black']]) {
    if (M.d && !M.c && !M.e && phase !== 'endgame') add('iqp', 4, `${other} has an isolated d-pawn`);
    if (M.c && M.d && !M.b && !M.e && phase !== 'endgame') add('hanging-pawns', 4, `${other} has hanging c- and d-pawns`);
    for (const f of Object.keys(M)) {
      const i = FILES.indexOf(f);
      if (phase !== 'endgame' && f !== 'd' && !M[FILES[i - 1]] && !M[FILES[i + 1]]) add('isolated-pawn', 1.5, `${other} has an isolated ${f}-pawn`);
      if (M[f].length > 1) add('doubled-pawns', 1.5, `${other} has doubled ${f}-pawns`);
    }
  }
  // Named structures
  if (has(ps, 'w', 'd4') && has(ps, 'b', 'd5') && has(ps, 'b', 'c6') && !W.c && !B.e) add('carlsbad', 4, 'White d4 vs Black c6–d5 with the c- and e-pawns traded: a Carlsbad structure');
  if (has(ps, 'b', 'd5') && has(ps, 'w', 'd4') && has(ps, 'w', 'c3') && !B.c && !W.e) add('carlsbad', 4, 'Reversed Carlsbad structure');
  if (has(ps, 'w', 'c4') && has(ps, 'w', 'e4') && !W.d && !B.c && B.d) add('maroczy', 4, 'White pawns on c4 and e4 with no d-pawn: a Maróczy bind');
  if (has(ps, 'b', 'a6') && has(ps, 'b', 'b6') && has(ps, 'b', 'd6') && has(ps, 'b', 'e6') && !B.c) add('hedgehog', 4, 'Black pawns on a6, b6, d6, e6: a Hedgehog');
  if (has(ps, 'w', 'e5') && has(ps, 'w', 'd4') && has(ps, 'b', 'e6') && has(ps, 'b', 'd5')) add('french-chain', 4, 'Locked chains d4–e5 vs d5–e6: the French structure');
  if (has(ps, 'w', 'd5') && has(ps, 'w', 'e4') && has(ps, 'b', 'd6') && has(ps, 'b', 'e5')) add('kid-chain', 4, "Locked chains d5–e4 vs d6–e5: the King's Indian structure");
  if (has(ps, 'w', 'd5') && has(ps, 'b', 'c5') && has(ps, 'b', 'd6') && !B.e) add('benoni-structure', 4, 'White d5 against Black c5–d6: a Benoni structure');
  if ((has(ps, 'w', 'd4') && has(ps, 'w', 'e3') && has(ps, 'w', 'f4') && has(ps, 'w', 'c3')) || (has(ps, 'b', 'd5') && has(ps, 'b', 'e6') && has(ps, 'b', 'f5') && has(ps, 'b', 'c6'))) add('stonewall', 4, 'c3–d4–e3–f4 (or the mirror for Black): a Stonewall');
  const centerPawns = ps.filter(p => p.type === 'p' && 'de'.includes(p.square[0])).length;
  if (phase !== 'endgame') {
    if (centerPawns <= 1) add('open-center', 2, 'Few or no pawns on the d- and e-files');
    else {
      const blocked = ['c', 'd', 'e', 'f'].filter(f => ps.some(p => p.type === 'p' && p.color === 'w' && p.square[0] === f && has(ps, 'b', f + (+p.square[1] + 1)))).length;
      if (blocked >= 2) add('closed-center', 2, 'Two or more pairs of central pawns are locked');
    }
  }
  // Passed pawns
  for (const [c, M, O, name] of [['w', W, B, 'White'], ['b', B, W, 'Black']]) {
    for (const [f, ranks] of Object.entries(M)) for (const r of ranks) {
      const i = FILES.indexOf(f);
      const blockers = [FILES[i - 1], f, FILES[i + 1]].filter(Boolean).flatMap(ff => (O[ff] || []));
      const passed = c === 'w' ? blockers.every(rr => rr <= r) : blockers.every(rr => rr >= r);
      if (passed) add('passed-pawn', phase === 'endgame' ? 3 : 2, `${name} has a passed ${f}-pawn`);
    }
  }
  // Bishop pair
  for (const c of ['w', 'b']) if (count(c, 'b') === 2 && count(c === 'w' ? 'b' : 'w', 'b') < 2 && phase !== 'opening') add('bishop-pair', 1.5, `${c === 'w' ? 'White' : 'Black'} has the bishop pair`);
  // Kings
  const kW = ps.find(p => p.type === 'k' && p.color === 'w')?.square, kB = ps.find(p => p.type === 'k' && p.color === 'b')?.square;
  const wing = sq => sq && ('abc'.includes(sq[0]) ? 'q' : 'fgh'.includes(sq[0]) ? 'k' : 'c');
  if (phase === 'middlegame' && wing(kW) !== 'c' && wing(kB) !== 'c' && wing(kW) !== wing(kB)) add('opposite-castling', 3, 'Kings on opposite wings: a pawn-storm race');
  // Endgame types
  if (phase === 'endgame') {
    add('king-activity', 1, 'In the endgame the king is a fighting piece');
    const kinds = c => ps.filter(p => p.color === c && !['p', 'k'].includes(p.type)).map(p => p.type).sort().join('');
    const kw = kinds('w'), kb = kinds('b');
    const pawnsW = count('w', 'p'), pawnsB = count('b', 'p');
    if (!kw && !kb) add('pawn-endgame', 5, 'Only kings and pawns remain');
    else if (/^r+$/.test(kw) && kw === kb) {
      add('rook-endgame', 5, 'Rooks and pawns only');
      if (kw === 'r' && pawnsW + pawnsB === 1) add('rook-pawn-vs-rook', 6, 'Rook and pawn versus rook: Lucena / Philidor territory');
    } else if (kw === 'b' && kb === 'b') {
      const bw = ps.find(p => p.type === 'b' && p.color === 'w'), bb = ps.find(p => p.type === 'b' && p.color === 'b');
      if (squareColor(bw.square) !== squareColor(bb.square)) add('ocb', 5, 'Opposite-coloured bishops: strong drawing tendency');
      else add('minor-endgame', 4, 'Same-coloured bishop ending');
    } else if (/^[bn]+$/.test(kw) && /^[bn]+$/.test(kb)) add('minor-endgame', 4, 'Minor pieces and pawns');
    else if (/^q$/.test(kw) && /^q$/.test(kb)) add('queen-endgame', 4, 'Queen ending');
    else if ((kw === 'r' && /^[bn]$/.test(kb)) || (kb === 'r' && /^[bn]$/.test(kw))) add('rook-vs-minor', 4, 'Rook against a minor piece');
  }
  return feats;
}

// Tactical motifs revealed by a concrete move (the engine's best move or a refutation).
export function moveMotifs(Chess, fen, uci) {
  const out = [];
  if (!uci) return out;
  let c; try { c = new Chess(fen); } catch { return out; }
  const before = new Chess(fen);
  let mv;
  try { mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }); } catch { return out; }
  const me = mv.color, them = me === 'w' ? 'b' : 'w';
  const add = (tag, why) => out.push({ tag, weight: 4, why });
  if (c.isCheckmate()) {
    add('mate', `${mv.san} is checkmate`);
    const k = pieces(c).find(p => p.type === 'k' && p.color === them);
    if (k && (k.square[1] === '1' || k.square[1] === '8') && 'rq'.includes(mv.piece) && mv.to[1] === k.square[1]) add('back-rank', 'Mate on the back rank');
  }
  if (mv.promotion) add('promotion', `${mv.san} promotes`);
  if (mv.captured === undefined && /x/.test(mv.san) === false && ['b', 'n', 'r', 'q'].includes(mv.piece) && c.isAttacked(mv.to, them)) {
    const defended = c.attackers(mv.to, me).length > 0;
    if (!defended) add('sacrifice', `${mv.san} offers an undefended ${pieceName(mv.piece)}`);
  }
  if (mv.piece === 'b' && mv.captured === 'p' && (mv.to === 'h7' || mv.to === 'h2') && c.inCheck()) add('greek-gift', `${mv.san} is the classic bishop sacrifice`);
  // Fork: the moved piece attacks two or more valuable enemy pieces (or king + piece).
  const targets = pieces(c).filter(p => p.color === them && (p.type === 'k' || VAL[p.type] > VAL[mv.piece] || (VAL[p.type] >= 3 && c.attackers(p.square, them).length === 0)) && attacksFrom(c, mv.to, p.square));
  if (targets.length >= 2 && !c.isCheckmate()) add('fork', `${mv.san} attacks ${targets.map(t => pieceName(t.type) + ' ' + t.square).join(' and ')}`);
  // Discovered attacks include attacks on material, not just checks.
  const enemies = pieces(c).filter(p => p.color === them);
  const king = enemies.find(p => p.type === 'k');
  if (king && c.attackers(king.square, me).length >= 2) add('double-check', `${mv.san} gives double check`);
  for (const target of enemies.filter(p => p.type === 'k' || VAL[p.type] >= 3)) {
    const newly = c.attackers(target.square, me).filter(s => s !== mv.to && !before.attackers(target.square, me).includes(s));
    if (newly.length) add('discovered-attack', `${mv.san} uncovers an attack on the ${pieceName(target.type)} on ${target.square}`);
    const defenders = before.attackers(target.square, them);
    if (c.attackers(target.square, them).length || !c.attackers(target.square, me).length) continue;
    if (mv.captured && defenders.includes(mv.to)) add('removing-defender', `${mv.san} removes the defender of the ${pieceName(target.type)} on ${target.square}`);
    else if (defenders.some(s => c.get(s)?.color === them && 'brq'.includes(c.get(s).type))) add('interference', `${mv.san} cuts the defence of the ${pieceName(target.type)} on ${target.square}`);
  }
  // Skewer: the moved slider attacks a more valuable enemy in front of another enemy piece.
  if ('brq'.includes(mv.piece)) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [df, dr] of dirs) {
      if ((mv.piece === 'b' && !(df && dr)) || (mv.piece === 'r' && df && dr)) continue;
      const ray = [];
      for (let f = FILES.indexOf(mv.to[0]) + df, r = +mv.to[1] + dr; f >= 0 && f < 8 && r >= 1 && r <= 8; f += df, r += dr) {
        const p = c.get(FILES[f] + r);
        if (!p) continue;
        if (p.color === me) break;
        ray.push({ ...p, square: FILES[f] + r });
        if (ray.length === 2) break;
      }
      if (ray.length === 2 && (ray[0].type === 'k' || VAL[ray[0].type] > VAL[ray[1].type]) && VAL[ray[1].type] >= 3) add('skewer', `${mv.san} skewers the ${pieceName(ray[0].type)} on ${ray[0].square} to the ${pieceName(ray[1].type)} on ${ray[1].square}`);
    }
  }
  // Hanging piece: the move captures an undefended piece.
  if (mv.captured && VAL[mv.captured] >= 3) {
    const before = new Chess(fen);
    if (before.attackers(mv.to, them).length === 0) add('hanging-piece', `${mv.san} wins a loose ${pieceName(mv.captured)}`);
  }
  // Pin: an enemy piece that cannot move off a line to its king.
  if (detectPin(c, them) && !detectPin(new Chess(fen), them)) add('pin', `${mv.san} pins a piece to its king`);
  if (c.inCheck() || out.some(o => o.tag === 'sacrifice')) {
    const k = pieces(c).find(p => p.type === 'k' && p.color === them);
    if (k && c.attackers(k.square, me).length) add('king-attack', 'Direct pressure on the king');
  }
  return out;
}

// Candidates that need a reply and a follow-up. These describe the concrete line only; tools
// must check its moves and the evaluation before claiming that the tactic works.
export function lineMotifs(Chess, fen, ucis) {
  let c; try { c = new Chess(fen); } catch { return []; }
  const rows = [];
  for (const uci of ucis) {
    try { rows.push({ before: new Chess(c.fen()), move: c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }), after: new Chess(c.fen()) }); }
    catch { return []; }
  }
  return rows.map((a, i) => {
    const b = rows[i + 1], d = rows[i + 2], out = [];
    if (!b || !d) return out;
    const add = (tag, why) => out.push({ tag, weight: 4, why, span: 3 });
    const forced = a.after.inCheck() || (b.move.captured && b.move.to === a.move.to);
    if (forced && d.move.captured && a.before.get(d.move.to)?.color === b.move.color && a.before.attackers(d.move.to, b.move.color).includes(b.move.from) && !b.after.attackers(d.move.to, b.move.color).length) {
      add('deflection', `${a.move.san} deflects the defender from ${b.move.from}, allowing ${d.move.san}`);
      if (a.before.attackers(a.move.to, b.move.color).includes(b.move.from)) add('overloading', `The defender on ${b.move.from} cannot cover both ${a.move.to} and ${d.move.to}`);
    }
    if (a.move.piece !== 'p' && b.move.captured && b.move.to === a.move.to && ((d.move.captured && d.move.to === b.move.to) || d.after.isCheckmate())) add('decoy', `${a.move.san} draws the ${pieceName(b.move.piece)} to ${b.move.to} before ${d.move.san}`);
    if (a.after.inCheck() && !a.move.captured && d.move.captured && VAL[d.move.captured] >= 3 && a.before.moves({ verbose: true }).some(m => m.to === d.move.to && m.captured === d.move.captured) && !a.before.attackers(d.move.to, b.move.color).length) add('zwischenzug', `${a.move.san} inserts a check before ${d.move.san}`);
    return out;
  });
}
function pieceName(t) { return { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[t]; }
function attacksFrom(c, from, to) {
  return c.attackers(to, c.get(from)?.color).includes(from);
}
function detectPin(c, side) {
  const king = pieces(c).find(p => p.type === 'k' && p.color === side);
  if (!king) return false;
  const [kf, kr] = [FILES.indexOf(king.square[0]), +king.square[1]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [df, dr] of dirs) {
    let f = kf + df, r = kr + dr, own = null;
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      const p = c.get(FILES[f] + r);
      if (p) {
        if (p.color === side) { if (own) break; own = p; }
        else {
          const diag = df && dr;
          if (own && own.type !== 'k' && (p.type === 'q' || (diag ? p.type === 'b' : p.type === 'r'))) return true;
          break;
        }
      }
      f += df; r += dr;
    }
  }
  return false;
}

// --- Retrieval ---------------------------------------------------------
// level: 1 beginner … 4 master. Books near the player's level rank higher.
export function retrieveLiterature(features, { level = 2, limit = 5, userBooks = [] } = {}) {
  const pool = [...LITERATURE, ...userBooks];
  const scored = pool.map(book => {
    const hits = features.filter(f => book.tags.includes(f.tag));
    if (!hits.length) return null;
    const relevance = hits.reduce((a, f) => a + f.weight, 0);
    const fit = 1 - Math.min(Math.abs((book.level ?? level) - level), 3) * 0.15;
    const score = relevance * fit + (book.user ? 1 : 0);
    const top = hits.sort((a, b) => b.weight - a.weight)[0];
    const where = book.where?.[top.tag] || (TAG_LABELS[top.tag] && FAMILY_TAGS.has(top.tag) ? book.where?._opening : null);
    return { book, score, hits, where };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
const FAMILY_TAGS = new Set(FAMILY_RULES.map(r => r[1]));

// Index games (PGN-derived position lists) for "seen before" retrieval.
// games: [{id, title, positions:[{epd, pawns, ply, san, comment, cls}]}]
export function buildPositionIndex(games) {
  const byEpd = new Map(), byPawns = new Map();
  for (const g of games) for (const p of g.positions || []) {
    (byEpd.get(p.epd) || byEpd.set(p.epd, []).get(p.epd)).push({ g, p });
    if (p.ply >= 12) (byPawns.get(p.pawns) || byPawns.set(p.pawns, []).get(p.pawns)).push({ g, p });
  }
  return { byEpd, byPawns };
}
export function similarPositions(index, fen, /** @type {{ excludeGameId?: any, limit?: number }} */ { excludeGameId, limit = 6 } = {}) {
  const e = epd(fen), s = pawnSignature(fen);
  const exact = (index.byEpd.get(e) || []).filter(x => x.g.id !== excludeGameId);
  const seen = new Set(exact.map(x => x.g.id));
  const structural = [];
  for (const x of (index.byPawns.get(s) || [])) {
    if (x.g.id === excludeGameId || seen.has(x.g.id)) continue;
    seen.add(x.g.id); structural.push(x);
  }
  return [
    ...exact.slice(0, limit).map(x => ({ ...x, kind: 'same position' })),
    ...structural.slice(0, Math.max(0, limit - exact.length)).map(x => ({ ...x, kind: 'same pawn structure' })),
  ];
}

// --- Engine maths ---------------------------------------------------------
// Win probability for the side the score is given for, from centipawns (lichess model).
export function winPct(cp) { return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
export function scoreToCp(score) {
  if (!score) return 0;
  if (score.mate !== undefined && score.mate !== null) return score.mate > 0 ? 10000 - score.mate * 10 : -10000 - score.mate * 10;
  return Math.max(-2000, Math.min(2000, score.cp));
}
// Classify a move by the drop in the mover's win percentage.
export function classify(wpBefore, wpAfter, { isBest = false, isBook = false } = {}) {
  if (isBook) return 'book';
  const drop = wpBefore - wpAfter;
  if (isBest) return 'best';
  if (drop < 5) return 'good';
  if (drop < 10) return 'inaccuracy';
  if (drop < 20) return 'mistake';
  return 'blunder';
}
// Per-move accuracy from win% drop (lichess formula).
export function moveAccuracy(wpBefore, wpAfter) {
  const d = Math.max(0, wpBefore - wpAfter);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * d) - 3.1669));
}
export function parseInfo(line) {
  // "info depth 12 seldepth 17 multipv 1 score cp -34 nodes ... pv e7e5 g1f3"
  const t = line.split(' ');
  const o = {};
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'depth') o.depth = +t[++i];
    else if (k === 'multipv') o.multipv = +t[++i];
    else if (k === 'score') { const kind = t[++i]; const v = +t[++i]; o.score = kind === 'cp' ? { cp: v } : { mate: v }; if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') o.bound = t[++i]; }
    else if (k === 'pv') { o.pv = t.slice(i + 1); break; }
  }
  return o;
}
