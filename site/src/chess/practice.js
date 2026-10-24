// Rules-only input shared by authored lessons and generated practice, with explicit promotion.
import { parseMoveInput } from './notation.js';
import { germanSanToSan } from '../platform/i18n.js';

export function practiceMove(Chess, fen, input, language = 'en') {
  if (typeof input !== 'string' || !input.trim() || input.length > 100) return { kind: 'invalid' };
  const c = new Chess(fen), text = input.trim();
  const coordinates = /^([a-h][1-8])-?([a-h][1-8])$/.exec(text), bare = /^([a-h])?x?([a-h][18])[+#]?$/.exec(text);
  const promotions = c.moves({ verbose: true }).filter(m => m.promotion && (coordinates ? m.from === coordinates[1] && m.to === coordinates[2] : bare && m.to === bare[2] && (!bare[1] || m.from[0] === bare[1])));
  if (promotions.length && new Set(promotions.map(m => m.from + m.to)).size === 1) return { kind: 'promotion',
    promotion: { from: promotions[0].from, to: promotions[0].to, choices: promotions.map(m => m.promotion) } };
  let move = parseMoveInput(Chess, fen, text);
  if (move.error && language === 'de') move = parseMoveInput(Chess, fen, germanSanToSan(text));
  if (move.error) return { kind: 'invalid' };
  const uci = move.from + move.to + (move.promotion || '');
  c.move({ from: move.from, to: move.to, promotion: move.promotion });
  return { kind: 'move', move, uci, fen: c.fen() };
}

export function practiceDestinations(Chess, fen) {
  const destinations = new Map();
  for (const move of new Chess(fen).moves({ verbose: true })) {
    if (!destinations.has(move.from)) destinations.set(move.from, []);
    if (!destinations.get(move.from).includes(move.to)) destinations.get(move.from).push(move.to);
  }
  return destinations;
}
