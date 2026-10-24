// Native roving-focus board controls. Rules, clocks and game mutation stay with the app.
const FILES = 'abcdefgh', ROLES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const squareValid = square => typeof square === 'string' && /^[a-h][1-8]$/.test(square);
export function keyboardNextSquare(square, key, orientation = 'white', whole = false) {
  if (!squareValid(square) || !['white', 'black'].includes(orientation)) throw Error('Invalid keyboard square');
  const direction = orientation === 'white' ? 1 : -1, left = direction === 1 ? 0 : 7;
  let file = FILES.indexOf(square[0]), rank = +square[1];
  if (key === 'ArrowLeft') file -= direction;
  else if (key === 'ArrowRight') file += direction;
  else if (key === 'ArrowUp') rank += direction;
  else if (key === 'ArrowDown') rank -= direction;
  else if (key === 'Home') { file = left; if (whole) rank = direction === 1 ? 8 : 1; }
  else if (key === 'End') { file = 7 - left; if (whole) rank = direction === 1 ? 1 : 8; }
  else return null;
  return FILES[Math.max(0, Math.min(7, file))] + Math.max(1, Math.min(8, rank));
}

/** Actual rules state, not engine advice. Promotions retain one destination with multiple choices. */
export function keyboardPosition(Chess, fen, orientation = 'white') {
  if (!['white', 'black'].includes(orientation)) throw Error('Invalid board orientation');
  const c = new Chess(fen), legal = new Map();
  for (const move of c.moves({ verbose: true })) {
    if (!legal.has(move.from)) legal.set(move.from, new Set()); legal.get(move.from).add(move.to);
  }
  const files = [...FILES], ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  if (orientation === 'black') { files.reverse(); ranks.reverse(); }
  return { turn: c.turn(), legal, rows: ranks.map(rank => files.map(file => {
    const square = file + rank, piece = c.get(square);
    return { square, piece: piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${ROLES[piece.type]}` : null };
  })) };
}

/**
 * @param {HTMLElement} root
 * @param {{Chess:any,state:()=>any,onMove:(from:string,to:string)=>void,onSelect?:(square:string|null)=>void,announce:(message:string)=>void,t:(text:string,vars?:any)=>string}} options
 */
export function createKeyboardBoard(root, { Chess, state, onMove, onSelect = () => {}, announce, t }) {
  const doc = root.ownerDocument, buttons = new Map();
  let observed = null, model = null, origin = null, cursor = null, order = '';
  const identity = s => JSON.stringify([s.fen, s.generation, s.orientation, s.allowed, s.visible]);
  root.setAttribute('role', 'grid'); root.setAttribute('aria-label', t('Keyboard chessboard')); root.setAttribute('aria-rowcount', '8'); root.setAttribute('aria-colcount', '8');
  root.setAttribute('aria-describedby', 'keyboardHelp'); root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  function clear() { if (origin) { origin = null; onSelect(null); } }
  function focus(square) { cursor = square; for (const [key, button] of buttons) button.tabIndex = key === cursor ? 0 : -1; buttons.get(square)?.focus(); }
  function activate(square) {
    const now = state();
    if (!observed || identity(now) !== identity(observed)) { sync(); announce(t('The position changed. Choose a piece again.')); return; }
    if (!now.visible || !now.allowed || !model.legal.size) { clear(); sync(); announce(t('Moves cannot be entered in this position.')); return; }
    if (origin && model.legal.get(origin)?.has(square)) {
      const from = origin; clear(); onMove(from, square); sync(); return;
    }
    if (model.legal.has(square)) {
      origin = square; onSelect(square); sync(); announce(t('Piece selected on {square}. Choose a destination, or press Escape.', { square }));
    } else announce(t('Choose a piece with a legal move for the side to move.'));
  }
  function keydown(event) {
    const button = event.target.closest('[data-keyboard-square]'); if (!button || !root.contains(button) || event.altKey || event.metaKey) return;
    const square = button.dataset.keyboardSquare;
    if (event.ctrlKey && !['Home', 'End'].includes(event.key)) return;
    const next = keyboardNextSquare(square, event.key, state().orientation, event.ctrlKey);
    if (next) { event.preventDefault(); event.stopPropagation(); focus(next); }
    else if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); activate(square); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); clear(); sync(); announce(t('Board selection cleared.')); }
  }
  function sync() {
    const now = state();
    if (origin && observed && identity(observed) !== identity(now)) clear();
    observed = { ...now }; root.hidden = !now.visible;
    if (!now.visible) return;
    model = keyboardPosition(Chess, now.fen, now.orientation);
    const flat = model.rows.flat(), nextOrder = flat.map(c => c.square).join('');
    cursor ||= flat.find(c => model.legal.has(c.square))?.square || flat[0].square;
    if (order !== nextOrder) {
      const focused = root.contains(doc.activeElement); order = nextOrder;
      const rows = model.rows.map((row, r) => {
        const element = doc.createElement('div'); element.className = 'keyboard-row'; element.setAttribute('role', 'row'); element.setAttribute('aria-rowindex', String(r + 1));
        for (const [col, cell] of row.entries()) {
          let button = buttons.get(cell.square);
          if (!button) {
            button = doc.createElement('button'); button.type = 'button'; button.className = 'keyboard-square'; button.dataset.keyboardSquare = cell.square;
            button.setAttribute('data-raw', ''); // Labels below have already been translated.
            button.setAttribute('role', 'gridcell'); button.addEventListener('click', () => activate(cell.square)); button.addEventListener('focus', () => { cursor = cell.square; for (const [key, b] of buttons) b.tabIndex = key === cursor ? 0 : -1; }); buttons.set(cell.square, button);
          }
          button.setAttribute('aria-colindex', String(col + 1)); element.append(button);
        }
        return element;
      }); root.replaceChildren(...rows); if (focused) focus(cursor);
    }
    root.dataset.fen = now.fen; root.setAttribute('aria-readonly', String(!now.allowed || !model.legal.size));
    for (const cell of flat) {
      const button = buttons.get(cell.square), destination = !!origin && model.legal.get(origin)?.has(cell.square);
      button.tabIndex = cell.square === cursor ? 0 : -1; button.dataset.origin = String(cell.square === origin);
      button.setAttribute('aria-selected', String(cell.square === origin));
      button.setAttribute('aria-label', (cell.piece ? t('{piece} on {square}', { piece: t(cell.piece), square: cell.square }) : t('Empty square {square}', { square: cell.square })) + (destination ? ' · ' + t('Legal destination') : ''));
    }
  }
  root.addEventListener('keydown', keydown); sync();
  return { sync, focus: () => focus(cursor), destroy() { root.removeEventListener('keydown', keydown); buttons.clear(); root.replaceChildren(); } };
}
