// Pattern and text cues complement colour. This describes existing marks, not chess evidence.
export const BOARD_MARK_STYLES = Object.freeze({
  best: { key: 'kb', name: 'Engine move', pattern: 'Solid line', dash: 'none' },
  played: { key: 'kp', name: 'Played move', pattern: 'Long dashes', dash: '0.4 0.2' },
  alt: { key: 'ka', name: 'Alternative from the previous move', pattern: 'Dashes', dash: '0.18 0.18' },
  hint: { key: 'kh', name: 'Hint mark', pattern: 'Short dashes', dash: '0.1 0.2' },
  san: { key: 'ks', name: 'Line or coach mark', pattern: 'Dash-dot line', dash: '0.25 0.12 0.02 0.12' },
  threat: { key: 'kt', name: 'Threat mark', pattern: 'Dots', dash: '0.02 0.2' },
  green: { key: 'g', name: 'Your mark', pattern: 'Dashes', dash: '0.18 0.18' },
  red: { key: 'r', name: 'Your mark', pattern: 'Long dashes', dash: '0.4 0.2' },
  blue: { key: 'b', name: 'Your mark', pattern: 'Dash-dot line', dash: '0.25 0.12 0.02 0.12' },
  yellow: { key: 'y', name: 'Your mark', pattern: 'Dots', dash: '0.02 0.2' },
});
const square = value => typeof value === 'string' && /^[a-h][1-8]$/.test(value);
export function describeBoardMarks(shapes) {
  if (!Array.isArray(shapes)) return [];
  const seen = new Set(), result = [];
  for (const shape of shapes) {
    if (!shape || !Object.hasOwn(BOARD_MARK_STYLES, shape.brush) || !square(shape.orig) || shape.dest !== undefined && !square(shape.dest)) continue;
    const style = BOARD_MARK_STYLES[shape.brush], label = /^[A-Za-z0-9!?+#=]{1,2}$/.test(shape.label?.text || '') ? shape.label.text : '';
    const name = shape.piece ? 'Example piece' : label ? 'Board label' : style.name;
    const row = { name, pattern: shape.dest ? style.pattern : 'Circle or square mark', from: shape.orig, to: shape.dest || null, label };
    const key = JSON.stringify(row); if (seen.has(key)) continue; seen.add(key); result.push(row);
  }
  return result;
}
