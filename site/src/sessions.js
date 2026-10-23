/**
 * Game facts that determine whether a suspended study still belongs to this checkpoint.
 * @typedef {{gameId: string|null, start: string, userColor: string, cursor: number,
 *   nodes: {fen: string}[], over: {result: string, reason: string}|null}} GameCheckpoint
 */

/**
 * Identify the full game history and viewed step, including its result. A transposition or
 * take-back must not reopen analysis of a different line. Clock ticks, orientation and engine
 * annotations are deliberately excluded: they do not change which position is being studied.
 * @param {GameCheckpoint} game Live state or a detached board snapshot's state.
 * @returns {string} Session-local identity; never used as a library/source identifier.
 */
export function gameCheckpoint(game) {
  return JSON.stringify([game.gameId, game.start, game.userColor, game.cursor,
    game.nodes.map(n => n.fen), game.over?.result ?? null, game.over?.reason ?? null]);
}
