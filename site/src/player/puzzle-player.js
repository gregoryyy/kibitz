// Independent own-game exercise board. The app supplies engine access and source/policy fences.
import { ownPuzzleCandidates, prepareOwnPuzzle, checkOwnPuzzle } from './mistake-puzzles.js';
import { practiceDestinations } from '../chess/practice.js';

export function createOwnPuzzlePlayer(root, { Chess, mountBoard, engine, cancelEngine, state, onSource, onComplete, t, language = 'en' }) {
  const doc = root.ownerDocument;
  let engineRun = engine, deck = [], selected = 0, session = null, ground = null, promotion = null, version = 0, observed = null;
  root.classList.add('lesson-player'); root.setAttribute('translate', 'no'); root.setAttribute('data-raw', '');
  const el = (tag, text = '', raw = false) => { const n = doc.createElement(tag); n.textContent = raw ? text : t(text); n.setAttribute('translate', 'no'); return n; };
  const resize = new ResizeObserver(() => ground?.redrawAll()); resize.observe(root);
  const active = run => {
    const now = state(), entry = now.records.get(`library:${run?.candidate.g.id}`);
    return session === run && now.allowed && now.generation === run?.generation && now.context === run?.context
      && entry?.g === run.candidate.g && entry?.snapshot === run.candidate.snapshot;
  };
  const visible = () => state().visible;
  function closePromotion() { promotion?.close(); promotion?.remove(); promotion = null; }
  function stop() { cancelEngine?.(); closePromotion(); ground?.destroy(); ground = null; session = null; }
  function emit(run) {
    if (!active(run) || !run.complete || run.reported) return;
    run.reported = true;
    onComplete?.({ id: run.puzzle.id, revision: run.puzzle.revision, sourceKey: run.candidate.key, kind: run.result,
      attempts: run.attempts, mistakes: run.mistakes, hints: run.hints, revealed: run.result === 'revealed' });
  }
  async function start(index = selected) {
    if (!visible() || !state().allowed || !deck[index]) return;
    stop(); selected = index;
    const now = state(), run = session = { candidate: deck[index], generation: now.generation, context: now.context, puzzle: null,
      busy: true, complete: false, reported: false, result: '', attempts: 0, mistakes: 0, hints: 0, draft: '', message: 'Checking this review position…', displayFen: deck[index].fen };
    render();
    try {
      const prepared = await prepareOwnPuzzle(Chess, run.candidate, { engine: engineRun, current: () => active(run) });
      if (!active(run)) return;
      run.puzzle = prepared.kind === 'ready' ? prepared.puzzle : null;
      run.message = prepared.kind === 'ready' ? 'Find a stronger move than the one you played.' : prepared.kind === 'outdated' ? 'The current search no longer supports this exercise. Choose another position or re-run the review.' : 'Engine evidence is unavailable. Retry this position.';
    } catch { if (active(run)) run.message = 'Engine evidence is unavailable. Retry this position.'; }
    if (!active(run)) return;
    run.busy = false; render(); root.scrollIntoView({ block: 'nearest' });
    (matchMedia('(pointer: fine)').matches ? root.querySelector('#ownPuzzleMove') : root.querySelector('#ownPuzzleBoard'))?.focus();
  }
  function choosePromotion(run, choice) {
    if (!active(run)) return;
    closePromotion(); const dialog = el('dialog'); promotion = dialog; dialog.id = 'ownPuzzlePromotion'; dialog.className = 'lesson-promotion'; dialog.setAttribute('aria-label', t('Choose a promotion piece'));
    dialog.append(el('p', 'Choose a promotion piece'));
    for (const piece of ['q', 'r', 'b', 'n'].filter(p => choice.choices.includes(p))) {
      const button = el('button', { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece]); button.type = 'button'; button.className = 'btn'; button.dataset.piece = piece;
      button.addEventListener('click', () => { if (promotion !== dialog || !active(run) || !visible()) return; closePromotion(); answer(run, choice.from + choice.to + piece); }); dialog.append(button);
    }
    const cancel = el('button', 'Cancel'); cancel.type = 'button'; cancel.className = 'btn'; cancel.addEventListener('click', closePromotion); dialog.append(cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePromotion(); }); root.append(dialog); dialog.showModal();
  }
  async function answer(run, input) {
    if (!active(run) || !visible() || !run.puzzle || run.busy || run.complete || promotion) return;
    run.draft = input; run.busy = true; run.message = 'Checking your move…'; render();
    let result;
    try { result = await checkOwnPuzzle(Chess, run.puzzle, input, { engine: engineRun, current: () => active(run), language }); }
    catch { result = { kind: 'unverified' }; }
    if (!active(run)) return;
    run.busy = false;
    if (result.kind === 'promotion') { run.message = ''; render(); choosePromotion(run, result.promotion); return; }
    if (result.kind === 'accepted' || result.kind === 'below-target') {
      run.attempts++; run.draft = '';
      if (result.kind === 'accepted') { run.complete = true; run.result = result.basis; run.displayFen = result.fen; }
      else run.mistakes++;
    }
    run.message = result.kind === 'accepted' ? result.basis === 'rules-mate' ? 'Checkmate, verified by the chess rules.' : 'Your move meets the engine target.'
      : result.kind === 'below-target' ? 'This move scores below the current target. Try another move.'
        : result.kind === 'invalid' ? 'Enter a legal move for this exercise.' : 'The engine could not verify this move. Retry without a penalty.';
    emit(run); render(); root.querySelector('#ownPuzzleMove')?.focus();
  }
  function render() {
    closePromotion(); ground?.destroy(); ground = null;
    const renderVersion = ++version, now = state(), run = session;
    const button = (label, action, disabled = false) => {
      const n = el('button', label); n.type = 'button'; n.className = 'btn small'; n.disabled = disabled;
      n.addEventListener('click', () => { if (renderVersion === version && visible()) action(); }); return n;
    };
    root.replaceChildren(el('h3', 'Practise your own mistakes'));
    if (!now.allowed) { root.append(el('p', 'Own-game practice is hidden while you play with restricted help.')); return; }
    root.append(el('p', 'Exercises come from your reviewed games. Stockfish checks the current target and any legal alternative; searches are bounded.'));
    if (!deck.length) { root.append(el('p', 'Review your own played games to find practice positions.')); return; }
    const chooser = el('select'); chooser.id = 'ownPuzzleChoice'; chooser.style.width = '100%'; chooser.setAttribute('aria-label', t('Practice position'));
    for (const [i, item] of deck.entries()) { const option = el('option', `${String(item.g.title || item.g.white || '').slice(0, 140)} · ${item.playedLabel}`, true); option.value = String(i); chooser.append(option); }
    chooser.value = String(selected); chooser.addEventListener('change', () => { if (renderVersion === version && visible()) { selected = +chooser.value; if (session) start(selected); } }); root.append(chooser);
    const controls = el('div'); controls.className = 'row'; controls.style.flexWrap = 'wrap';
    controls.append(button(run ? 'Restart exercise' : 'Start exercise', () => start()), button('Next position', () => start((selected + 1) % deck.length), deck.length < 2));
    if (run) controls.append(button('Close practice', () => { stop(); render(); })); root.append(controls);
    if (!run || !active(run)) return;
    const status = el('p', run.message); status.id = 'ownPuzzleStatus'; status.setAttribute('role', 'status'); root.append(status);
    if (!run.puzzle) return;
    root.append(el('p', t('Your recorded move: {move}', { move: run.candidate.playedLabel }), true));
    const content = el('div'); content.className = 'lesson-content'; const wrap = el('div'); wrap.className = 'lesson-board-wrap';
    const board = el('div'); board.id = 'ownPuzzleBoard'; board.tabIndex = 0; board.setAttribute('role', 'group'); board.setAttribute('aria-label', t('Own-game practice board')); board.dataset.fen = run.displayFen; wrap.append(board);
    const task = el('div'); task.className = 'lesson-task'; const c = new Chess(run.displayFen);
    task.append(el('p', t('{side} to move · move {number}', { side: t(c.turn() === 'w' ? 'White' : 'Black'), number: c.moveNumber() }), true));
    const form = el('form'), input = el('input'); input.id = 'ownPuzzleMove'; input.type = 'text'; input.maxLength = 100; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', t('Your practice move')); input.value = run.draft; input.disabled = run.busy || run.complete;
    input.addEventListener('input', () => { if (renderVersion === version && active(run)) run.draft = input.value; }); const submit = el('button', 'Check move'); submit.type = 'submit'; submit.className = 'btn small primary'; submit.disabled = input.disabled; form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); if (renderVersion === version) answer(run, input.value); }); task.append(form);
    const help = el('div'); help.className = 'row'; help.style.flexWrap = 'wrap';
    help.append(button('Hint', () => { if (!active(run) || run.busy || run.complete) return; run.hints++; render(); }, run.busy || run.complete || run.hints >= 2),
      button('Reveal checked line', () => { if (!active(run) || run.busy || run.complete) return; run.complete = true; run.result = 'revealed'; run.message = 'The checked line is shown. This is not an independent solve.'; emit(run); render(); }, run.busy || run.complete)); task.append(help);
    if (run.hints) task.append(el('p', run.hints === 1 ? t('Consider the piece on {square}.', { square: run.puzzle.best.slice(0, 2) }) : run.puzzle.bestSan, true));
    if (run.complete) task.append(el('p', 'Checked example'), el('p', run.puzzle.line.sans.join(' '), true));
    task.append(el('p', t('Attempts: {n} · hints: {h}', { n: run.attempts, h: run.hints }), true),
      button('Open source position', () => { if (active(run)) onSource?.(run.candidate, () => active(run)); }));
    content.append(wrap, task); root.append(content);
    const movable = !run.busy && !run.complete;
    ground = mountBoard(board, { fen: run.displayFen, orientation: run.puzzle.side === 'w' ? 'white' : 'black', turnColor: c.turn() === 'w' ? 'white' : 'black', check: c.inCheck(),
      movable: { free: false, color: movable ? run.puzzle.side === 'w' ? 'white' : 'black' : undefined, dests: movable ? practiceDestinations(Chess, run.puzzle.fen) : new Map(), events: { after: (from, to) => { if (renderVersion === version) answer(run, from + to); } } }, premovable: { enabled: false }, drawable: { enabled: false }, animation: { enabled: false } });
  }
  function sync() {
    const now = state();
    if (observed && observed.records === now.records && observed.scope === now.scope && observed.context === now.context && observed.generation === now.generation && observed.allowed === now.allowed) return;
    stop(); observed = now;
    deck = now.allowed ? ownPuzzleCandidates(Chess, [...now.records.values()], { scope: now.scope }) : [];
    selected = Math.min(selected, Math.max(0, deck.length - 1)); render();
  }
  sync();
  return { sync, close: () => { stop(); render(); }, setEngine: next => { stop(); engineRun = next; render(); }, destroy: () => { stop(); resize.disconnect(); root.replaceChildren(); } };
}
