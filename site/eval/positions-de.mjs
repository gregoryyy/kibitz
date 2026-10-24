// Same reference positions and concepts as the English set; German text and lexical cues.
import { POSITIONS } from './positions.mjs';
import DE from '../src/platform/i18n-de.js';

/** @type {Record<string, {title:string, keys:[string, string[]][]}>} */
const LOCALIZED = {
  'opera-b5': { title: 'Opernpartie nach 9… b5', keys: [
    ['nennt 10. Nxb5', ['[NS]xb5']], ['erkennt das Opfer', ['opfer|gibt? (den |einen )?(springer|figur)']],
    ['Schwarz liegt in der Entwicklung zurück, der König steht im Zentrum', ['entwick|unrochiert|rochad|k(ö|oe)nig.{0,35}(zentrum|e8)']], ['öffnet Linien gegen den König', ['offen|öffn|oeffn']],
  ] },
  'qh5-threat': { title: '1. e4 e5 2. Qh5 Nc6 3. Bc4: Schwarz am Zug', keys: [
    ['Weiß droht Qxf7 matt', ['[QD]xf7|f7', 'matt']], ['nennt eine Verteidigung: g6, Qe7 oder Qf6', ['\\bg6\\b|[QD]e7|[QD]f6']],
  ] },
  'qg5-fork': { title: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5: Schwarz am Zug', keys: [
    ['nennt Qg5', ['[QD]g5']], ['erkennt den Doppelangriff auf Springer e5 und g2', ['e5|springer', 'g2']],
  ] },
  'elephant-trap': { title: 'Damengambit: Elefantenfalle nach 6. Nxd5', keys: [
    ['nennt Nxd5', ['[NS]xd5']], ['beantwortet Bxd8 mit Bb4+', ['[BL]b4']], ['Schwarz gewinnt Material', ['gewinn|figur|material|mehr']],
  ] },
  'back-rank': { title: 'Grundreihenmatt in einem Zug', keys: [
    ['nennt Ra8#', ['[RT]a8']], ['erkennt das Matt', ['matt']], ['der König ist hinter den eigenen Bauern eingeschlossen', ['grundreih|bauer|bauern|f7|g7|h7|flucht']],
  ] },
  'iqp-break': { title: 'Steinitz–von Bardeleben vor 17. d5', keys: [
    ['nennt den Durchbruch d5', ['\\bd5\\b']], ['erkennt den isolierten Damenbauern', ['isol|d4']], ['König im Zentrum oder offene Linien', ['k(ö|oe)nig|e-linie|offen|öffn|oeffn']],
  ] },
  'opposition': { title: 'König und Bauer: Schwarz hat die Opposition', keys: [
    ['nennt die Opposition', ['opposition']], ['bei bestem Spiel remis', ['remis|unentschieden']],
  ] },
  'lucena': { title: 'Lucena-Stellung', keys: [
    ['schneidet den König ab oder drängt ihn mit Rd1+ ab', ['[RT]d1|abschn|abdräng|abdraeng']],
    ['Brückenbau auf der vierten Reihe', ['br(ü|ue)cke|[RT]d4|viert.{0,12}reihe|abschirm']], ['Weiß gewinnt', ['gewinn']],
  ] },
  'philidor': { title: 'Philidor-Stellung: Schwarz am Zug', keys: [
    ['der Turm hält die sechste Reihe', ['sechst|dritt|reihe']], ['nach dem Bauernvorstoß Schachs von hinten', ['hinten|schach']], ['erkennt das Remis', ['remis|unentschieden']],
  ] },
  'sicilian-d4': { title: 'Sizilianisch nach 3. d4', keys: [
    ['schlägt auf d4 mit cxd4', ['cxd4']], ['halboffene c-Linie oder zentrale Bauernmehrheit', ['c-linie|halboffen|halb.offen|mehrheit|zentrum']], ['entwickelt mit Nf6', ['[NS]f6|entwick']],
  ] },
};

export const POSITIONS_DE = POSITIONS.map(position => {
  const value = LOCALIZED[position.id]; if (!value || !DE[position.chip]) throw Error('Missing German eval position: ' + position.id);
  return { ...position, language: 'de', title: value.title, chip: DE[position.chip], keyPoints: value.keys.map(([point, all]) => ({ point, all })) };
});

export function evalPositions(language = 'en', only = '') {
  if (!['en', 'de'].includes(language)) throw Error('Eval language must be en or de.');
  const positions = language === 'de' ? POSITIONS_DE : POSITIONS;
  const ids = only ? only.split(',').map(id => id.trim()).filter(Boolean) : null;
  if (ids && (!ids.length || ids.some(id => !positions.some(p => p.id === id)))) throw Error('Unknown or empty eval position selection.');
  return positions.filter(p => !ids || ids.includes(p.id)).map(p => ({ ...p, language, keyPoints: p.keyPoints.map(k => ({ ...k, all: [...k.all] })) }));
}
