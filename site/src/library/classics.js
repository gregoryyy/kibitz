// Classic games and studies: a first built-in collection (TODO 7.3) for the "Similar games" aspect
// (3.2.5), the reading list and the library. Pure data and retrieval, like knowledge.js: no DOM,
// no globals. The game scores are historical record; the comments are ours. Tags use the
// vocabulary of knowledge.js TAG_LABELS, so a position's features find the games that teach them.
import { makeProvenance } from './library.js';
import { CLASSIC_SCORE_SOURCES } from './classic-sources.js';
import { CAPABLANCA_GAMES } from './capablanca.js';
import { AUTHORED_PROBLEMS, CURATED_PROBLEMS } from './problem-data.js';
import { classicMoves } from './classic-comments-de.js';

const problemsById = new Map(CURATED_PROBLEMS.map(p => [p.id, p]));

// Each entry: id, title, white, black, event, date, result, tags, about (one line on what it
// teaches), moment (the ply of its key moment), and either moves (from the start) or fen + moves (a study).
/** @typedef {{id:string,title:string,white:string,black:string,event:string,date:string,result:string,tags:string[],about:string,moment:number,moves:string,fen?:string,scoreNote?:string,source?:{title:string,author:string,url:string,score:string}}} ClassicEntry */
/** @type {ClassicEntry[]} */
export const CLASSICS = [
  {
    id: 'ex-opera', title: 'The Opera Game', white: 'Paul Morphy', black: 'Duke Karl / Count Isouard', event: 'Paris', date: '1858', result: '1-0',
    tags: ['open-games', 'opening', 'pin', 'sacrifice', 'king-attack', 'back-rank', 'mate'], moment: 19,
    about: 'Development against an uncastled king: Morphy gives material to keep the lines open, and every piece joins in.',
    moves: '1. e4 e5 2. Nf3 d6 3. d4 Bg4 {Pinning the knight, but Black soon has to give up the bishop pair.} 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 {Development with a threat: Qxf7 mate is in the air.} Nf6 7. Qb3 {A double attack on f7 and b7.} Qe7 8. Nc3 c6 9. Bg5 {Every White piece is developed; Black\'s kingside pieces are still at home.} b5 10. Nxb5 {Morphy sacrifices to keep the lines open against the uncastled king.} cxb5 11. Bxb5+ Nbd7 12. O-O-O {The rook joins the attack on the pinned knight on d7.} Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ {A queen sacrifice that deflects the knight from d7.} Nxb8 17. Rd8# 1-0',
  },
  {
    id: 'ex-immortal', title: 'The Immortal Game', white: 'Adolf Anderssen', black: 'Lionel Kieseritzky', event: 'London', date: '1851', result: '1-0',
    tags: ['open-games', 'opening', 'sacrifice', 'king-attack', 'mate'], moment: 35,
    about: 'Activity over material: White gives up a bishop, both rooks and the queen, and mates with the minor pieces.',
    moves: '1. e4 e5 2. f4 {The King\'s Gambit: a pawn for rapid development and the f-file.} exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 {Giving up the bishop to gain time against the black queen.} cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 {White ignores both rooks: development and the attack on the king matter more than material.} Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ {A final queen sacrifice: the knight on g8 must take and the bishop mates.} Nxf6 23. Be7# 1-0',
  },
  {
    id: 'cl-evergreen', title: 'The Evergreen Game', white: 'Adolf Anderssen', black: 'Jean Dufresne', event: 'Berlin', date: '1852', result: '1-0',
    tags: ['open-games', 'italian', 'sacrifice', 'king-attack', 'discovered-attack', 'mate'], moment: 37,
    about: 'The Evans Gambit: lines opened in the centre, a quiet rook move that allows the queen to be taken, and a double check.',
    moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 {The Evans Gambit: a pawn for time and the centre.} Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 {A quiet move with a mating idea: Black may take the knight on f3 with check.} Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ {The queen sacrifice that clears the d-file.} Kxd7 22. Bf5+ {Double check.} Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0',
  },
  {
    id: 'cl-century', title: 'The Game of the Century', white: 'Donald Byrne', black: 'Robert James Fischer', event: 'New York', date: '1956', result: '0-1',
    tags: ['grunfeld', 'sacrifice', 'discovered-attack', 'king-attack', 'calculation'], moment: 34,
    about: 'A 13-year-old\'s queen sacrifice: Black gives the queen for a decisive lead in material and a king that cannot escape the checks.',
    moves: '1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 {White\'s king is still in the centre, with the f1 bishop at home.} Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 {The famous queen sacrifice: the bishop takes on c4 with check, and a windmill of discovered checks follows.} 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1',
  },
  {
    id: 'cl-reti-tartakower', title: 'Réti\'s queen sacrifice', white: 'Richard Réti', black: 'Savielly Tartakower', event: 'Vienna', date: '1910', result: '1-0',
    tags: ['caro-kann', 'opening', 'sacrifice', 'mate'], moment: 17,
    about: 'A miniature: Black\'s king stays in the centre with the queen chasing pawns, and a queen sacrifice ends in a double check and mate.',
    scoreNote: 'The published game ended after 10.Bg5+. The final two plies show a teaching continuation.',
    moves: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nf6 5. Qd3 e5 6. dxe5 Qa5+ 7. Bd2 Qxe5 8. O-O-O {The rook takes the d-file while Black has not castled.} Nxe4 9. Qd8+ {The queen sacrifice.} Kxd8 10. Bg5+ {Double check. The published game ended here with Black resigning; the following two plies are a teaching continuation.} Kc7 11. Bd8# 1-0',
  },
  {
    id: 'cl-legal', title: 'Légal\'s mate', white: 'Sire de Légal', black: 'Saint Brie', event: 'Traditional teaching version', date: '????', result: '1-0',
    tags: ['open-games', 'opening', 'pin', 'sacrifice', 'mate'], moment: 9,
    about: 'A pin that isn\'t one: the knight ignores the pin on f3, gives up the queen, and the minor pieces mate.',
    scoreNote: 'Traditional teaching version. The historical date, move order and rook odds are disputed.',
    moves: '1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 {The knight leaves f3 although it seems pinned to the queen. This is a traditional teaching version; the historical date, move order and rook odds are disputed.} Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0',
  },
  {
    id: 'cl-lasker-thomas', title: 'The king hunt', white: 'Edward Lasker', black: 'George Alan Thomas', event: 'London', date: '1912', result: '1-0',
    tags: ['dutch', 'sacrifice', 'king-attack', 'mate'], moment: 21,
    about: 'A queen sacrifice on h7 drives the black king across the whole board to its death on g1.',
    moves: '1. d4 e6 2. Nf3 f5 3. Nc3 Nf6 4. Bg5 Be7 5. Bxf6 Bxf6 6. e4 fxe4 7. Nxe4 b6 8. Ne5 O-O 9. Bd3 Bb7 10. Qh5 Qe7 11. Qxh7+ {The queen sacrifice.} Kxh7 12. Nxf6+ Kh6 13. Neg4+ Kg5 14. h4+ Kf4 15. g3+ Kf3 16. Be2+ Kg2 17. Rh2+ Kg1 18. Kd2# 1-0',
  },
  {
    id: 'cl-rotlewi-rubinstein', title: 'Rubinstein\'s Immortal', white: 'Georg Rotlewi', black: 'Akiba Rubinstein', event: 'Lodz', date: '1907', result: '0-1',
    tags: ['queens-gambit', 'd-pawn', 'sacrifice', 'king-attack', 'calculation'], moment: 44,
    about: 'Bishops aimed at the king: Black gives the queen and a rook to open the long diagonals against White\'s castled king.',
    moves: '1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6 6. dxc5 Bxc5 7. a3 a6 8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7 11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8 14. Qe2 Bb7 15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8 19. e5 Bb6+ 20. Kh1 Ng4 {Both bishops aim at White\'s king.} 21. Be4 Qh4 22. g3 Rxc3 {The start of the combination.} 23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1',
  },
  {
    id: 'cl-steinitz-bardeleben', title: 'Steinitz\'s rook dance', white: 'Wilhelm Steinitz', black: 'Curt von Bardeleben', event: 'Hastings', date: '1895', result: '1-0',
    tags: ['italian', 'open-games', 'iqp', 'sacrifice', 'king-attack'], moment: 43,
    about: 'An isolated queen pawn pushed at the right moment, then a rook that checks on the seventh rank and cannot be taken.',
    moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 {White has an isolated queen pawn after the exchanges to come.} Bb4+ 7. Nc3 d5 8. exd5 Nxd5 9. O-O Be6 10. Bg5 Be7 11. Bxd5 Bxd5 12. Nxd5 Qxd5 13. Bxe7 Nxe7 14. Re1 f6 15. Qe2 Qd7 16. Rac1 c6 17. d5 {The isolated pawn advances to open lines against the uncastled king.} cxd5 18. Nd4 Kf7 19. Ne6 Rhc8 20. Qg4 g6 21. Ng5+ Ke8 22. Rxe7+ {The rook cannot be taken: every capture loses to a check.} Kf8 23. Rf7+ Kg8 24. Rg7+ Kh8 25. Rxh7+ 1-0',
  },
  {
    id: 'st-reti', title: 'Réti\'s king march (study)', white: 'Richard Réti', black: 'study', event: 'Kagans Neueste Schachnachrichten', date: '1921', result: '1/2-1/2',
    tags: ['pawn-endgame', 'king-activity', 'endgame'], moment: 1,
    about: 'A king can chase two goals at once: walking the diagonal, it supports its own pawn and catches the enemy one.',
    fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
    moves: '1. Kg7 {Towards the h-pawn and the c-pawn at the same time.} h4 2. Kf6 Kb6 3. Ke5 Kxc6 4. Kf4 {In the square of the pawn: a draw.} 1/2-1/2',
  },
  {
    id: 'st-saavedra', title: 'The Saavedra position (study)', white: 'Fernando Saavedra', black: 'study', event: 'Glasgow Weekly Citizen', date: '1895', result: '1-0',
    tags: ['promotion', 'endgame', 'calculation'], moment: 11,
    about: 'Underpromotion: a queen would allow stalemate, a rook wins.',
    fen: '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1',
    moves: '1. c7 Rd6+ 2. Kb5 Rd5+ 3. Kb4 Rd4+ 4. Kb3 Rd3+ 5. Kc2 Rd4 {Rc4+ is ready: after c8=Q, Rc4+ Qxc4 is stalemate.} 6. c8=R {The rook avoids the stalemate and threatens Ra8 mate.} Ra4 7. Kb3 {Attacking the rook and threatening Rc1 mate.} 1-0',
  },
  {
    id: 'st-lucena', title: 'The Lucena position', white: 'study', black: 'study', event: 'Lucena', date: '????', result: '1-0',
    tags: ['rook-pawn-vs-rook', 'rook-endgame', 'endgame'], moment: 3,
    about: 'Building a bridge: the rook shields the king from checks so the pawn can queen.',
    fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
    moves: '1. Rd1+ {Drive the defending king one file further away.} Ke7 2. Rd4 {The bridge: the rook will block the checks on the fourth rank.} Ra1 3. Kc7 Rc1+ 4. Kb6 Rb1+ 5. Kc6 Rc1+ 6. Kb5 Rb1+ 7. Rb4 1-0',
  },
  {
    id: 'st-philidor', title: 'The Philidor position', white: 'study', black: 'study', event: 'Philidor', date: '????', result: '1/2-1/2',
    tags: ['rook-pawn-vs-rook', 'rook-endgame', 'endgame'], moment: 4,
    about: 'The defence: the rook holds the third rank until the pawn advances, then checks from behind.',
    fen: '4k3/7R/r7/3KP3/8/8/8/8 b - - 0 1',
    moves: '1... Rb6 {Keep the rook on the sixth rank: the white king can\'t come forward.} 2. e6 Rb1 {Now the pawn has left the king no shelter: check from behind.} 3. Kd6 Rd1+ 4. Ke5 Re1+ 1/2-1/2',
  },
  ...CAPABLANCA_GAMES,
  ...AUTHORED_PROBLEMS,
];

// The collection as library games: {id, kind: 'example', title, white, black, date, result, pgn, tags, about, moment}.
export function classicGames({ language = 'en' } = {}) {
  return CLASSICS.map(item => {
    const problem = problemsById.get(item.id) || null, c = { ...item, ...(problem?.date ? { date: problem.date } : {}), ...(problem?.scoreNote ? { scoreNote: problem.scoreNote } : {}) };
    return {
    id: c.id, kind: 'example', title: c.title, white: c.white, black: c.black, date: c.date, result: c.result, tags: c.tags, about: c.about, moment: c.moment, scoreNote: c.scoreNote || '', problem: problem ? structuredClone(problem) : null,
    // Games have published score sources; problem definitions distinguish diagrams and authored variants.
    provenance: makeProvenance('builtin', { ...(problem?.source || c.source || CLASSIC_SCORE_SOURCES[c.id] || { title: 'Kibitz classics collection', author: 'Kibitz contributors', url: 'https://github.com/gregoryyy/kibitz/blob/main/site/src/library/classics.js' }), annotations: 'GPL-3.0-or-later' }),
    pgn: [
      `[Event "${c.event}"]`, `[Date "${c.date}"]`, `[White "${c.white}"]`, `[Black "${c.black}"]`, `[Result "${c.result}"]`,
      ...(c.fen ? ['[SetUp "1"]', `[FEN "${c.fen}"]`] : []), '', classicMoves(c.moves, language),
    ].join('\n'),
  }; });
}

// Classics that teach this position's themes (3.2.5): scored by the features' weights on the
// game's tags, so the opening family and the strongest motifs count most.
// features: [{tag, weight}] from knowledge.js positionFeatures / moveMotifs.
export function retrieveClassics(features, { limit = 3, exclude = null } = {}) {
  return CLASSICS.map(c => {
    if (c.id === exclude) return null;
    const hits = features.filter(f => c.tags.includes(f.tag));
    if (!hits.length) return null;
    return { game: c, hits, score: hits.reduce((a, f) => a + (f.weight || 1), 0) };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.hits.length - a.hits.length).slice(0, limit);
}

// --- Game references in text ---------------------------------------------------
// How the coach (or a book) names each classic: its title, or the players as a pairing
// ("Réti–Tartakower", "Anderssen vs. Kieseritzky"), in English and German (TODO 10.8: a German
// answer says "die Opernpartie" or "Morphy gegen den Herzog"). Only names that mean this one game:
// "Philidor" alone is also an opening, "Lucena" alone a person.
const pair = (a, b) => `${a}\\s*(?:[–—-]|vs?\\.?|versus|against|gegen)\\s*${b}`;
const NAMES = {
  ...Object.fromEntries(AUTHORED_PROBLEMS.map(g => [g.id, [problemsById.get(g.id).title.en, problemsById.get(g.id).title.de].map(title => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))])),
  ...Object.fromEntries(CAPABLANCA_GAMES.map(g => [g.id, [g.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('–', '[–—-]').replaceAll('St Petersburg', 'St\\.?\\s+Petersburg')]])),
  'ex-opera': ['(?:Morphy[\'’]s )?Opera (?:House )?Game', 'Opernpartie', pair('Morphy', '(?:the |den )?(?:Duke|Count|Herzog|Grafen?|Isouard|Brunswick|Braunschweig)')],
  'ex-immortal': ['(?<!Rubinstein[\'’]s )Immortal Game', '(?<!Rubinsteins )Unsterbliche(?:n)? Partie', pair('Anderssen', 'Kieseritzky')],
  'cl-evergreen': ['Evergreen (?:Game|Partie)', 'Immergrüne(?:n)? Partie', pair('Anderssen', 'Dufresne')],
  'cl-century': ['Game of the Century', 'Partie des Jahrhunderts', pair('(?:Donald )?Byrne', 'Fischer')],
  'cl-reti-tartakower': [pair('R[ée]ti', 'Tartakower'), 'R[ée]tis Damenopfer'],
  'cl-legal': ['L[ée]gal[\'’]s mate', 'Seekadettenmatt', pair('(?:de )?L[ée]gal', 'Saint[ -]Brie')],
  'cl-lasker-thomas': [pair('(?:Edward |Ed\\. )?Lasker', 'Thomas')],
  'cl-rotlewi-rubinstein': ['Rubinstein[\'’]?s Immortal', 'Rubinsteins Unsterbliche', pair('Rotlewi', 'Rubinstein')],
  'cl-steinitz-bardeleben': [pair('Steinitz', '(?:von )?Bardeleben')],
  'st-reti': ['R[ée]ti[\'’]s (?:king march|study|endgame study)', 'R[ée]ti (?:study|manoeuvre|maneuver)', 'R[ée]tis (?:Königsmarsch|Studie)', 'R[ée]ti-Studie'],
  'st-saavedra': ['Saavedra (?:position|study)', 'Saavedra-(?:Stellung|Studie)'],
  'st-lucena': ['Lucena (?:position|study|1497)', 'Lucena-Stellung'],
  'st-philidor': ['Philidor (?:position|draw)', 'Philidor-Stellung'],
};
const REFS = Object.entries(NAMES).map(([id, names]) => ({ id, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:the|die|der|den) )?(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'giu') }));

// The classics a text names, in text order and without overlaps: [{index, length, id}].
export function findGameRefs(text) {
  const found = [];
  for (const { id, re } of REFS) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text));) found.push({ index: m.index, length: m[0].length, id });
  }
  found.sort((a, b) => a.index - b.index || b.length - a.length);
  const refs = [];
  for (const r of found) if (!refs.length || r.index >= refs.at(-1).index + refs.at(-1).length) refs.push(r);
  return refs;
}

// A classic at its key moment, for a preview on the board: {fen, lastMove: [from, to] | null, label}.
// label is like "16. Qb8+", the move that leads to the moment (or "the start" for a study at ply 0).
export function keyPosition(Chess, id) {
  const g = classicGames().find(x => x.id === id);
  if (!g) return null;
  const c = new Chess(); c.loadPgn(g.pgn);
  const moves = c.history({ verbose: true }).slice(0, CLASSICS.find(x => x.id === id).moment);
  const start = c.getHeaders().FEN;
  const b = new Chess(start || undefined);
  for (const m of moves) b.move(m.san);
  const last = moves.at(-1);
  const num = last ? `${Math.ceil((moves.length + (start && start.split(' ')[1] === 'b' ? 1 : 0)) / 2)}${last.color === 'w' ? '.' : '…'}` : '';
  return { fen: b.fen(), lastMove: last ? [last.from, last.to] : null, label: last ? `${num} ${last.san}` : 'the start' };
}
