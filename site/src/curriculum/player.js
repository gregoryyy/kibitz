// Isolated lesson player (TODO 6.6). Authored explanations/hints; no provider or engine calls.
import { lessonText } from './curriculum.js';
import { startLessonSession, submitLessonMove, lessonDestinations, submitReflection, assessReflection, revealLesson } from './session.js';
import { translator } from '../platform/i18n.js';
import { playLine } from '../coach/annotations.js';
import { prepareLessonGame } from './playout.js';

/**
 * @param {HTMLElement} root Dedicated player container.
 * @param {import('./curriculum.js').Curriculum} catalogue Validated catalogue.
 * @param {object} options
 * @param {import('../coach/tutor.js').ChessConstructor} options.Chess
 * @param {typeof import('@lichess-org/chessground').Chessground} options.mountBoard
 * @param {string} [options.language]
 * @param {(text: string, vars?: object) => string} [options.t]
 * @param {() => number} [options.generation] Current main-game generation, checked on held actions.
 * @param {(result: {lessonId: string, exerciseId: string, kind: string, attempts: number, outside: number, hints: number, worked: boolean, revealed: boolean, assessment: string|null}) => void} [options.onComplete]
 * @param {(request: {fen: string, color: string, title: string, lessonId: string, exerciseId: string, signal: AbortSignal, isCurrent: () => boolean}) => Promise<{error?: string, cancelled?: boolean}>} [options.onPlay]
 */
export function createLessonPlayer(root, catalogue, { Chess, mountBoard, language = 'en', t: translate, generation = () => 0, onComplete, onPlay } ) {
  const doc = root.ownerDocument, fallback = translator({});
  /** @type {(text: string, vars?: object) => string} */
  const t = translate || ((text, vars) => fallback.t(text, vars));
  const words = value => lessonText(value, language);
  const el = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    node.setAttribute('data-raw', ''); // labels are already localized by this module
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    for (const child of children.flat()) node.append(typeof child === 'string' ? doc.createTextNode(child) : child);
    return node;
  };
  /** @type {import('./session.js').LessonSession|null} */
  let session = null;
  /** @type {import('./curriculum.js').Lesson|null} */
  let lesson = null;
  /** @type {ReturnType<typeof mountBoard>|null} */
  let ground = null;
  /** @type {HTMLDialogElement|null} */
  let promotion = null;
  /** @type {HTMLElement|null} */
  let returnFocus = null;
  /** @type {AbortController|null} */
  let playRequest = null;
  let playColor = 'w', playMessage = '';
  let capturedGen = 0, renderVersion = 0, reported = false, view = 'exercise', examplePly = 0, draft = '', message = '';
  root.hidden = true; root.setAttribute('translate', 'no'); root.setAttribute('data-raw', ''); root.setAttribute('aria-label', t('Lesson player')); root.classList.add('lesson-player');
  const resize = new ResizeObserver(() => ground?.redrawAll()); resize.observe(root);
  const focus = selector => { const node = /** @type {HTMLElement|null} */ (root.querySelector(selector)); if (node && !node.matches(':disabled')) node.focus(); };
  function closePromotion() { promotion?.close(); promotion?.remove(); promotion = null; }
  function close(restoreFocus = true) {
    playRequest?.abort(); playRequest = null;
    closePromotion(); ground?.destroy(); ground = null; session = null; lesson = null;
    root.replaceChildren(); root.hidden = true;
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus(); returnFocus = null;
  }
  function valid(run) {
    if (!run || session !== run) return false;
    if (generation() !== capturedGen) { close(false); return false; }
    return true;
  }
  function emit() {
    if (!session?.complete || reported) return;
    reported = true;
    onComplete?.({ lessonId: lesson.id, exerciseId: session.exercise.id, kind: session.result, attempts: session.attempts,
      outside: session.outside, hints: session.hints, worked: session.worked, revealed: session.revealed, assessment: session.assessment });
  }
  function open(lessonId, exerciseId) {
    const found = catalogue.modules.flatMap(m => m.lessons).find(l => l.id === lessonId), exercise = found?.exercises.find(e => e.id === exerciseId);
    if (!exercise) return false;
    const opener = root.contains(doc.activeElement) ? returnFocus : /** @type {HTMLElement|null} */ (doc.activeElement);
    close(false); returnFocus = opener; lesson = found; session = startLessonSession(Chess, exercise); capturedGen = generation();
    playColor = session.learner; playMessage = '';
    reported = false; view = 'exercise'; examplePly = 0; draft = ''; message = '';
    root.hidden = false; render(); root.scrollIntoView({ block: 'nearest' }); root.querySelector('h3')?.focus();
    return true;
  }
  function showPromotion(run, choice) {
    if (!valid(run)) return;
    closePromotion();
    const dialog = doc.createElement('dialog'); promotion = dialog;
    dialog.setAttribute('data-raw', '');
    dialog.id = 'lessonPromotion'; dialog.className = 'lesson-promotion'; dialog.setAttribute('aria-label', t('Choose a promotion piece'));
    dialog.append(el('p', {}, t('Choose a promotion piece')));
    const dismiss = () => { if (promotion === dialog) { closePromotion(); focus('#lessonMove'); } };
    for (const piece of ['q', 'r', 'b', 'n'].filter(p => choice.choices.includes(p))) {
      const button = el('button', { type: 'button', class: 'btn', 'data-piece': piece }, t({ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece]));
      button.addEventListener('click', () => {
        if (promotion !== dialog || !valid(run)) return;
        closePromotion(); answer(run, choice.from + choice.to + piece);
      }); dialog.append(button);
    }
    const cancel = el('button', { type: 'button', class: 'btn' }, t('Cancel')); cancel.addEventListener('click', dismiss); dialog.append(cancel);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    root.append(dialog); dialog.showModal();
  }
  function answer(run, input) {
    if (!valid(run) || promotion || view !== 'exercise') return;
    const result = submitLessonMove(Chess, run, input, language);
    if (result.kind === 'promotion') { renderBoard(run); showPromotion(run, result.promotion); return; }
    if (result.kind === 'inactive') return;
    session = result.state;
    message = {
      invalid: 'Enter a legal move for this exercise.', outside: 'Legal move outside this example. Try the recorded line.',
      'not-mate': 'That move is legal, but it does not give checkmate.',
      advance: 'Recorded move found. The example reply has been played.',
      complete: session.result === 'mate' ? 'Checkmate, verified by the chess rules.' : 'Recorded line completed.',
    }[result.kind];
    emit(); render(); focus('#lessonMove');
  }
  function renderBoard(run) {
    const board = root.querySelector('#lessonBoard'); if (!board) return;
    const fen = view === 'example' ? run.example.fens[examplePly] : run.fen, c = new Chess(fen);
    board.setAttribute('data-fen', fen);
    const canMove = view === 'exercise' && !run.complete && run.type !== 'reflection';
    /** @type {Parameters<typeof mountBoard>[1]} */
    const config = { fen, orientation: run.learner === 'w' ? 'white' : 'black', turnColor: c.turn() === 'w' ? 'white' : 'black',
      check: c.inCheck(), movable: { free: false, color: canMove ? run.learner === 'w' ? 'white' : 'black' : undefined,
        dests: canMove ? lessonDestinations(Chess, fen) : new Map(), events: { after: (from, to) => answer(run, from + to) } },
      premovable: { enabled: false }, drawable: { enabled: false }, animation: { enabled: false } };
    if (!ground) ground = mountBoard(/** @type {HTMLElement} */ (board), config); else ground.set(config);
  }
  function render() {
    const run = session; if (!valid(run)) return;
    playRequest?.abort(); playRequest = null;
    const version = ++renderVersion;
    const restoreFocus = root.contains(doc.activeElement) ? doc.activeElement?.id : '';
    closePromotion(); ground?.destroy(); ground = null;
    const button = (label, action, attrs = {}) => {
      const node = el('button', { type: 'button', class: 'btn', ...attrs }, t(label));
      node.addEventListener('click', () => { if (valid(run) && version === renderVersion) action(); }); return node;
    };
    const heading = el('h3', { tabindex: '-1' }, words(lesson.title));
    const select = el('select', { id: 'lessonExercise', 'aria-label': t('Exercise') }, ...lesson.exercises.map(e => el('option', { value: e.id }, words(e.title))));
    select.value = run.exercise.id;
    select.addEventListener('change', () => { if (valid(run) && version === renderVersion) open(lesson.id, select.value); });
    const controls = el('div', { class: 'row lesson-controls' }, button('Close lesson', close),
      button('Restart exercise', () => open(lesson.id, run.exercise.id)),
      button('Worked example', () => { session = { ...run, worked: true }; view = 'example'; examplePly = 0; render(); }, { id: 'lessonWorked', 'aria-pressed': String(view === 'example') }),
      button('Exercise', () => { view = 'exercise'; render(); }, { id: 'lessonSolve', 'aria-pressed': String(view === 'exercise') }));
    const board = el('div', { id: 'lessonBoard', tabindex: '0', role: 'group', 'aria-label': t('Lesson board') });
    const fen = view === 'example' ? run.example.fens[examplePly] : run.fen;
    const side = new Chess(fen).turn() === 'w' ? t('White') : t('Black');
    const position = el('p', { id: 'lessonPosition', class: 'hint' }, t('{side} to move · move {number}', { side, number: fen.split(' ')[5] }));
    const body = el('div', { class: 'lesson-content' }, el('div', { class: 'lesson-board-wrap' }, board), el('div', { class: 'lesson-task' },
      el('strong', {}, words(run.exercise.title)), el('p', { id: 'lessonPrompt' }, words(run.exercise.prompt)), position));
    const task = body.querySelector('.lesson-task');
    const playControls = el('div', { class: 'lesson-play-controls' });
    if (onPlay) {
      const color = el('select', { id: 'lessonPlayColor', 'aria-label': t('Side for this game') }, el('option', { value: 'w' }, t('White')), el('option', { value: 'b' }, t('Black')));
      color.value = playColor;
      color.addEventListener('change', () => { if (valid(run) && version === renderVersion) { playColor = color.value; render(); } });
      const title = `${t('Lesson practice')}: ${words(run.exercise.title)}`.replace(/\s+/g, ' ').trim();
      const prepared = prepareLessonGame(Chess, { fen, color: playColor, title });
      const start = button('Play against Stockfish', async () => {
        if (playRequest) return;
        const controller = new AbortController(); playRequest = controller;
        const isCurrent = () => !controller.signal.aborted && valid(run) && version === renderVersion;
        start.disabled = true;
        const status = root.querySelector('#lessonPlayStatus'); if (status) status.textContent = t('Preparing the practice game…');
        try {
          const result = await onPlay({ fen, color: playColor, title, lessonId: lesson.id, exerciseId: run.exercise.id, signal: controller.signal, isCurrent });
          if (!isCurrent()) return;
          playMessage = result.error || '';
        } catch {
          if (isCurrent()) playMessage = 'The practice game could not be started. Try again.';
        } finally {
          if (playRequest === controller) {
            playRequest = null;
            if (isCurrent()) { render(); focus('#lessonPlayStart'); }
          }
        }
      }, { id: 'lessonPlayStart' });
      start.disabled = !!prepared.error;
      playControls.append(el('div', { class: 'row' }, el('label', { for: 'lessonPlayColor' }, t('Side for this game')), color, start),
        el('p', { id: 'lessonPlayStatus', role: 'status', class: 'hint' }, prepared.error ? t(new Chess(fen).isGameOver() ? 'Choose an earlier unfinished position to play.' : prepared.error) : playMessage ? t(playMessage) : ''));
    }
    if (view === 'exercise' && run.played.length) task.append(el('p', { id: 'lessonPlayed' }, playLine(Chess, run.exercise.fen, run.played).sans.join(' ')));
    if (view === 'example') {
      const back = button('Previous move', () => { examplePly--; render(); }, { id: 'lessonPrevious' }); back.disabled = examplePly === 0;
      const next = button('Next move', () => { examplePly++; render(); }, { id: 'lessonNext' }); next.disabled = examplePly === run.example.ucis.length;
      task.append(el('p', { class: 'hint' }, t('This recorded branch is a worked example.')), el('div', { class: 'row' }, back, next),
        el('ol', { id: 'lessonLine' }, ...run.example.sans.map((san, i) => {
          const node = button(san, () => { examplePly = i + 1; render(); }, { 'aria-pressed': String(examplePly === i + 1) });
          // SAN is notation, not an interface phrase to translate.
          node.textContent = san; return el('li', {}, node);
        })));
    } else if (run.type === 'reflection') {
      const input = doc.createElement('textarea'); input.id = 'lessonResponse'; input.maxLength = 2000; input.value = draft;
      input.setAttribute('data-raw', '');
      input.setAttribute('aria-label', t('Your reasoning')); input.disabled = run.complete || !!run.response;
      input.addEventListener('input', () => { if (valid(run)) draft = input.value; });
      const compare = button('Compare with rubric', () => {
        const next = submitReflection(run, input.value);
        if (!next) { message = 'Write your reasoning before comparing it.'; render(); return; }
        session = next; message = ''; render();
      }, { id: 'lessonCompare' }); compare.disabled = run.complete || !!run.response;
      task.append(el('label', { for: 'lessonResponse' }, t('Your reasoning')), input, compare);
      if (run.response || run.revealed) {
        task.append(el('p', { class: 'hint' }, t('Compare your answer with this rubric. This is a self-assessment.')),
          el('ul', { id: 'lessonRubric' }, ...run.exercise.rubric.map(r => el('li', {}, words(r)))));
        for (const [assessment, label] of [['met', 'Matches the rubric'], ['practice', 'Needs more study']]) {
          const assess = button(label, () => {
            const next = assessReflection(run, /** @type {'met'|'practice'} */ (assessment)); if (!next) return;
            session = next; message = 'Reflection compared with the rubric.'; emit(); render();
          }, { 'data-assessment': assessment }); assess.disabled = run.complete; task.append(assess);
        }
      }
    } else {
      task.append(el('p', { class: 'hint' }, t(run.type === 'mate' ? 'Find checkmate; every legal mating move is accepted.' : 'This exercise checks recall of the recorded source line.')));
      const form = el('form', { id: 'lessonMoveForm', class: 'row' }), input = doc.createElement('input');
      input.setAttribute('data-raw', '');
      input.id = 'lessonMove'; input.maxLength = 100; input.autocomplete = 'off'; input.setAttribute('aria-label', t('Your move')); input.disabled = run.complete;
      const submit = el('button', { type: 'submit', class: 'btn primary' }, t('Play move')); submit.disabled = run.complete;
      form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); answer(run, input.value); }); task.append(form);
    }
    if (view === 'exercise') {
      const limit = run.type === 'reflection' ? 1 : 3;
      const hint = button('Tutor hint', () => { session = { ...run, hints: run.hints + 1, hintStage: Math.min(limit, run.hintStage + 1) }; render(); }, { id: 'lessonHint' });
      hint.disabled = run.complete || run.hintStage >= limit;
      const reveal = button('Reveal example', () => { session = revealLesson(run); message = 'Example revealed. This is not recorded as a solve.'; emit(); render(); }, { id: 'lessonReveal' }); reveal.disabled = run.complete;
      task.append(el('div', { class: 'row' }, hint, reveal));
      if (run.hintStage) {
        const hints = [words(lesson.objectives[0])], uci = run.example.ucis[run.ply];
        if (run.hintStage >= 2 && uci) hints.push(t('Consider a piece on {square}.', { square: uci.slice(0, 2) }));
        if (run.hintStage >= 3 && uci) hints.push(t('The recorded next move is {move}.', { move: run.example.sans[run.ply] }));
        task.append(el('ul', { id: 'lessonHints' }, ...hints.map(h => el('li', {}, h))));
      }
      task.append(el('p', { id: 'lessonFeedback', role: 'status' }, message ? t(message) : ''));
      if (run.complete && run.type !== 'reflection') task.append(el('ul', { id: 'lessonRubric' }, ...run.exercise.rubric.map(r => el('li', {}, words(r)))));
    }
    root.replaceChildren(heading, controls, el('p', {}, words(lesson.introduction)), el('ul', {}, ...lesson.objectives.map(o => el('li', {}, words(o)))),
      el('label', {}, t('Exercise'), select), playControls, body);
    renderBoard(run);
    if (restoreFocus && root.querySelector('#' + restoreFocus) && !root.querySelector('#' + restoreFocus).matches(':disabled')) focus('#' + restoreFocus);
    else if (view === 'example') focus('#lessonBoard');
    else if (restoreFocus) focus(run.type === 'reflection' ? '#lessonResponse' : '#lessonMove');
  }
  const keys = event => {
    if (!session) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      event.preventDefault(); event.stopPropagation(); if (!valid(session) || view !== 'example') return;
      examplePly = event.key === 'Home' ? 0 : event.key === 'End' ? session.example.ucis.length : Math.max(0, Math.min(session.example.ucis.length, examplePly + (event.key === 'ArrowRight' ? 1 : -1)));
      render(); focus('#lessonBoard');
    }
  };
  root.addEventListener('keydown', keys);
  return { open, close, sync: () => { if (session && generation() !== capturedGen) close(false); },
    destroy: () => { close(false); resize.disconnect(); root.removeEventListener('keydown', keys); } };
}
