// Chat commands and board tools (TODO 4.8–4.10). Pure validation and retrieval; the page owns
// confirmation, clocks and changes to its board. None of these functions writes saved games.
import { parseMoveInput } from './notation.js';
import { playLine } from './annotations.js';
import { checkPosition, checkStart, fixCastling } from './play.js';
import { quote } from './prompt.js';
import { mainlineNags } from './pgn.js';

const str = description => ({ type: 'string', description });
const schema = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const tool = (description, properties, required = []) => ({ description, schema: schema(properties, required) });
export const CHAT_TOOLS = {
  search_library: tool('Find saved or classic games by player, opening or theme. Optional color and result refer to the player in their own games. Returns ids for load_game, newest first.', {
    query: str('Search words, or empty for all games.'), color: { type: 'string', enum: ['w', 'b'] }, result: { type: 'string', enum: ['win', 'loss', 'draw'] },
  }),
  search_openings: tool('Find named opening lines by name or ECO code. Returns moves for load_opening.', { query: str('Opening name or ECO code.') }, ['query']),
  load_game: tool('Show an existing library game in analysis, optionally at a half-move (ply 0 is the start). Leaving a running game asks the player first. Never edits saved games.', {
    id: str('An id from search_library.'), ply: { type: 'integer', minimum: 0, maximum: 2000 },
  }, ['id']),
  load_position: tool('Load a legal FEN in analysis. Leaving a running game asks the player first.', { fen: str('FEN to show.') }, ['fen']),
  load_pgn: tool('Load a short PGN in analysis. Never imports it into the saved library.', { pgn: str('PGN, at most 1800 characters.') }, ['pgn']),
  load_opening: tool('Show an opening line from the initial position in analysis.', { moves: { type: 'array', minItems: 1, maxItems: 40, items: { type: 'string' } } }, ['moves']),
  move: tool('Make one player move in a running game, respecting its turn and clock. In analysis, try a line on the scratch board, leaving the game untouched.', {
    moves: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'string' } },
  }, ['moves']),
  goto: tool('Show a half-move of the current game (0 is the start). Does not alter its moves.', { ply: { type: 'integer', minimum: 0, maximum: 2000 } }, ['ply']),
  setup: tool('Edit a scratch position in analysis only. Pieces are wK, bQ, wN, etc.; null removes a piece. All edits are checked together, including king safety and castling rights.', {
    pieces: { type: 'array', maxItems: 64, items: schema({ square: str('Square a1–h8.'), piece: { type: ['string', 'null'], description: 'wK, bQ, wN, etc., or null to remove.' } }, ['square', 'piece']) },
    turn: { type: 'string', enum: ['w', 'b'] },
  }),
  undo: tool('Undo the last chat board change in one step. Never changes the saved library.', {}),
};
export const CHAT_TOOL_NAMES = Object.keys(CHAT_TOOLS);

export function readGame(Chess, pgn) {
  if (typeof pgn !== 'string' || pgn.length > 200_000) return { error: 'The PGN is too large.' };
  try {
    const c = new Chess(); c.loadPgn(pgn);
    const start = new Chess(c.getHeaders().FEN).fen();
    const valid = checkPosition(Chess, start);
    if (valid.error) return valid;
    const line = playLine(Chess, start, []), replay = new Chess(start);
    // PGNs may be longer than a scratch variation's 40-ply cap.
    for (const mv of c.history()) {
      const m = replay.move(mv);
      line.sans.push(m.san); line.ucis.push(m.from + m.to + (m.promotion || '')); line.fens.push(replay.fen());
    }
    return { line, headers: c.getHeaders(), nags: mainlineNags(pgn), comments: Object.fromEntries(c.getComments().map(({ fen, comment }) => [fen.split(' ').slice(0, 4).join(' '), comment])) };
  } catch { return { error: 'That does not look like a valid PGN.' }; }
}

export function setupPosition(Chess, fen, input) {
  try {
    const c = new Chess(fen), edits = input.pieces || [];
    if (!Array.isArray(edits) || edits.length > 64 || edits.some(e => !e || typeof e.square !== 'string' || !/^[a-h][1-8]$/.test(e.square) || (e.piece !== null && (typeof e.piece !== 'string' || !/^[wb][KQRBNP]$/.test(e.piece))) || Object.keys(e).some(k => !['square', 'piece'].includes(k)))) return { error: 'Use valid pieces and squares for the setup.' };
    if (new Set(edits.map(e => e.square)).size !== edits.length) return { error: 'Set each square only once.' };
    // Remove first, so relocating a king is independent of edit order.
    for (const e of edits) c.remove(e.square);
    for (const e of edits) if (e.piece && !c.put({ type: e.piece[1].toLowerCase(), color: e.piece[0] }, e.square)) return { error: 'The setup has an extra king.' };
    if (input.turn !== undefined && !['w', 'b'].includes(input.turn)) return { error: 'Choose White or Black to move.' };
    const f = c.fen().split(' '); f[1] = input.turn || c.turn(); f[3] = '-'; f[4] = '0';
    return checkStart(Chess, fixCastling(f.join(' ')));
  } catch { return { error: 'That is not a legal setup.' }; }
}

// State-dependent checks run again immediately before the page applies an action.
export function checkChatCall(Chess, name, input, { fen, plies = 0, playing = false, canMove = false, userColor = 'w' }) {
  const fail = error => ({ error });
  if (!Object.hasOwn(CHAT_TOOLS, name) || !input || typeof input !== 'object' || Array.isArray(input)) return fail('Unknown chat action.');
  const s = CHAT_TOOLS[name].schema;
  if (Object.keys(input).some(k => !Object.hasOwn(s.properties, k)) || s.required.some(k => input[k] === undefined)) return fail('Invalid arguments for the chat action.');
  if (name === 'search_library') {
    if ((input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 200)) || (input.color !== undefined && !['w', 'b'].includes(input.color)) || (input.result !== undefined && !['win', 'loss', 'draw'].includes(input.result))) return fail('Invalid library search.');
  } else if (name === 'search_openings') {
    if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 100) return fail('Use a short opening name or ECO code.');
  } else if (name === 'load_game') {
    if (typeof input.id !== 'string' || input.id.length > 100 || (input.ply !== undefined && (!Number.isInteger(input.ply) || input.ply < 0 || input.ply > 2000))) return fail('Invalid game or move number.');
  } else if (name === 'load_position') {
    if (typeof input.fen !== 'string' || input.fen.length > 100) return fail('That is not a valid FEN.');
    const checked = checkPosition(Chess, input.fen);
    return checked.error ? checked : { args: { fen: checked.fen } };
  } else if (name === 'load_pgn') {
    if (typeof input.pgn !== 'string' || input.pgn.length > 1800) return fail('Use a PGN of at most 1800 characters.');
    const game = readGame(Chess, input.pgn);
    if (game.error) return game;
  } else if (name === 'move' || name === 'load_opening') {
    const ms = input.moves, cap = name === 'move' ? 12 : 40;
    if (!Array.isArray(ms) || !ms.length || ms.length > cap || ms.some(m => typeof m !== 'string' || m.length > 15)) return fail('Use a short list of legal moves.');
    if (name === 'move' && playing && (!canMove || ms.length !== 1 || new Chess(fen).turn() !== userColor)) return fail('Only one move for your side is allowed on your turn.');
    const start = name === 'load_opening' ? new Chess().fen() : fen;
    const line = playLine(Chess, start, ms);
    return line ? { args: { moves: line.sans }, line } : fail('The line is not legal in that position.');
  } else if (name === 'goto') {
    if (!Number.isInteger(input.ply) || input.ply < 0 || input.ply > plies) return fail('That move is not in this game.');
  } else if (name === 'setup') {
    if (playing) return fail('Setups are available only in analysis.');
    if (!input.pieces?.length && input.turn === undefined) return fail('Choose pieces or the side to move.');
    const pos = setupPosition(Chess, fen, input);
    return pos.error ? pos : { args: input, fen: pos.fen };
  }
  return { args: input };
}

// Returns only metadata, not PGN or comments. User-written fields reach the model through quote().
export function searchGames(games, /** @type {{ query?: string, color?: string, result?: string }} */ { query = '', color, result } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return games.filter(g => {
    if (color && g.userColor !== color) return false;
    if (result) {
      const mine = g.userColor === 'w' ? '1-0' : g.userColor === 'b' ? '0-1' : null;
      if (!mine || (result === 'draw' ? g.result !== '1/2-1/2' : !['1-0', '0-1'].includes(g.result) || (g.result === mine) !== (result === 'win'))) return false;
    }
    const text = [g.title, g.white, g.black, g.eco, g.opening, ...(g.tags || [])].join(' ').toLowerCase();
    return words.every(w => text.includes(w));
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8).map(g => ({
    id: g.id, title: quote(g.title, 100), white: quote(g.white, 80), black: quote(g.black, 80), date: quote(g.date, 30), result: quote(g.result, 12), opening: quote(g.opening, 100),
  }));
}

const PIECES = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
// null means ordinary conversation. Recognised commands with bad moves remain commands: they
// are explained locally instead of being sent to a model that might try to perform them anyway.
export function parseChatCommand(Chess, text, fen, startFen = new Chess().fen()) {
  const t = String(text).trim(); let m;
  if (/^show(?: me)? (?:how|why|what|a plan|ideas)\b/i.test(t)) return null;
  if (/^(?:load\s+)?[rnbqkpRNBQKP1-8]+\/(?:[^\s]+\s+)[wb]\s/i.test(t)) return { name: 'load_position', input: { fen: t.replace(/^load\s+/i, '') } };
  if (/^(?:\[\w+\s+"|1\.\s*\S+\s+\S+)/.test(t)) return { name: 'pgn', input: { pgn: t } };
  if ((m = /^(?:go to|goto|show) (?:move )?(\d+)(\.{1,3})?$/i.exec(t))) {
    const f = startFen.split(' '), ply = 2 * (+m[1] - +f[5]) + (m[2] === '...' ? 2 : 1) - (f[1] === 'b' ? 1 : 0);
    return { name: 'goto', input: { ply } };
  }
  if (/^undo$/i.test(t)) return { name: 'undo', input: {} };
  if ((m = /^take back(?: (one|two|three|four|\d+) moves?)?$/i.exec(t))) return { name: 'takeback', input: { count: m[1] ? ({ one: 1, two: 2, three: 3, four: 4 }[m[1].toLowerCase()] || +m[1]) : 2 } };
  if (/^(?:back to|return to) (?:my |the )?game$/i.test(t)) return { name: 'return', input: {} };
  if ((m = /^set up (?:a |the )?(.+)$/i.exec(t))) return { name: 'find_game', input: { query: m[1], ply: 0 } };
  if ((m = /^(?:open|load|show)(?: me)? (.+)$/i.exec(t))) {
    // "show me Nf3" is a variation, while a game name is resolved by the local library.
    if (!/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]/.test(m[1])) return { name: 'find_game', input: { query: m[1] } };
  }
  if ((m = /^put (?:a |the )?(white|black) (king|queen|rook|bishop|knight|pawn) (?:on )?([a-h][1-8])$/i.exec(t))) return { name: 'setup', input: { pieces: [{ square: m[3], piece: (m[1].toLowerCase() === 'white' ? 'w' : 'b') + PIECES[m[2].toLowerCase()] }] } };
  if ((m = /^(white|black) to move$/i.exec(t))) return { name: 'setup', input: { turn: m[1].toLowerCase() === 'white' ? 'w' : 'b' } };
  if ((m = /^remove (?:the )?(queens|rooks|bishops|knights|pawns|[a-h][1-8])$/i.exec(t))) {
    const c = new Chess(fen), which = m[1].toLowerCase();
    const squares = /^[a-h][1-8]$/.test(which) ? [which] : c.board().flat().filter(p => p?.type === PIECES[which.slice(0, -1)]?.toLowerCase()).map(p => p.square);
    return { name: 'setup', input: { pieces: squares.map(square => ({ square, piece: null })) } };
  }
  const explicit = /^(play|show(?: me)?)\s+(.+)$/i.exec(t);
  const raw = (explicit ? explicit[2] : t).replace(/\s+and what follows[?.]?$/i, '').replace(/\d+\.(?:\.\.)?\s*/g, '').trim();
  const moves = raw.split(/\s+/);
  if (explicit || moves.every(s => /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#?!]*|[a-h][1-8]-?[a-h][1-8][qrbn]?|[O0]-[O0](?:-[O0])?)$/i.test(s))) {
    const c = new Chess(fen), sans = [];
    for (const s of moves) {
      const mv = parseMoveInput(Chess, c.fen(), s);
      if (mv.error) return { error: mv.error };
      c.move(mv.san); sans.push(mv.san);
    }
    return { name: 'move', input: { moves: sans }, preview: explicit?.[1].toLowerCase().startsWith('show') || /and what follows/i.test(t), ...(/and what follows/i.test(t) ? { follow: true } : {}) };
  }
  return null;
}
