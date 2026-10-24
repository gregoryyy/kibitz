// Cancellable, owned confirmation for leaving a live game to practise a lesson position.
/**
 * @param {Document} doc
 * @param {{side: string, signal: AbortSignal, t: (text: string, vars?: object) => string}} options
 * @returns {Promise<boolean>}
 */
export function confirmLessonGame(doc, { side, signal, t }) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const dialog = doc.createElement('dialog');
    dialog.id = 'lessonPlayConfirm'; dialog.className = 'lesson-play-confirm'; dialog.setAttribute('translate', 'no'); dialog.setAttribute('data-raw', '');
    dialog.setAttribute('aria-labelledby', 'lessonPlayConfirmTitle');
    const title = doc.createElement('h3'); title.id = 'lessonPlayConfirmTitle'; title.textContent = t('Start lesson practice?');
    const text = doc.createElement('p'); text.textContent = t('The current game will be saved as unfinished before the lesson position starts.');
    const settings = doc.createElement('p'); settings.textContent = t('You will play {side}. Current strength and clock settings will be used.', { side });
    let settled = false;
    const done = ok => {
      if (settled) return; settled = true;
      signal.removeEventListener('abort', abort); dialog.close(); dialog.remove(); resolve(ok);
    };
    const abort = () => done(false);
    const yes = doc.createElement('button'); yes.type = 'button'; yes.className = 'btn primary'; yes.textContent = t('Save and start lesson'); yes.addEventListener('click', () => done(true));
    const no = doc.createElement('button'); no.type = 'button'; no.className = 'btn'; no.textContent = t('Cancel'); no.addEventListener('click', () => done(false));
    dialog.addEventListener('cancel', event => { event.preventDefault(); done(false); });
    dialog.append(title, text, settings, yes, no); doc.body.append(dialog); signal.addEventListener('abort', abort, { once: true }); dialog.showModal();
  });
}
