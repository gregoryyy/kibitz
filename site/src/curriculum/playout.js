// A lesson diagram becomes a new game only after rules validation, never a normal-start fallback.
import { checkStart } from '../chess/play.js';

/**
 * @param {import('../coach/tutor.js').ChessConstructor} Chess
 * @param {{fen: string, color: string, title?: string}} request
 * @returns {{error?: string, start?: {fen: string, sans: string[], title: string}, color?: string}}
 */
export function prepareLessonGame(Chess, { fen, color, title = 'Lesson practice' }) {
  if (!['w', 'b'].includes(color)) return { error: 'Choose White or Black for this game.' };
  if (typeof fen !== 'string' || fen.length > 150 || fen.trim().split(/\s+/).length !== 6) return { error: 'Choose a legal unfinished position to play.' };
  if (typeof title !== 'string' || !title.trim() || title.length > 240 || /[\r\n\0]/.test(title)) return { error: 'The lesson title is not usable for a game.' };
  const position = checkStart(Chess, fen);
  if (position.error) return { error: 'Choose a legal unfinished position to play.' };
  return { start: { fen: position.fen, sans: [], title: title.trim() }, color };
}
