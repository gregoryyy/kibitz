// Languages (TODO 10.8): the translator, German move letters, and a German dictionary that covers
// the page's markup and the labels the modules show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { Chess } from 'chess.js';
import { LANGS, pickLang, translator, isText, germanSanToSan } from '../../src/i18n.js';
import DE from '../../src/i18n-de.js';
import { TAG_LABELS, LITERATURE } from '../../src/knowledge.js';
import { ASPECTS, COMMENT_WHEN, coachRules, COACH_RULES, commentKey } from '../../src/tutor.js';
import { STYLES } from '../../src/style.js';
import { CLASSICS } from '../../src/classics.js';
import { sanToSpeech, parseMoveInput } from '../../src/notation.js';

const T = translator(DE);
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('the language: a saved choice, else the browser\'s first supported language, else English', () => {
  assert.deepEqual(Object.keys(LANGS), ['en', 'de']);
  assert.equal(pickLang('de', ['en-US']), 'de');
  assert.equal(pickLang(null, ['fr-FR', 'de-AT', 'en']), 'de');
  assert.equal(pickLang('xx', ['fr']), 'en');
  assert.equal(pickLang(undefined, []), 'en');
});

test('translator: exact text keeps its spacing; templates translate their parts again; unknown text stays', () => {
  const t = translator({ 'Play': 'Spielen', '{n} games': '{n} Partien', 'knight': 'Springer', '{p} on {sq}': '{p} auf {sq}', 'the {p}': 'X', '@the knight': 'den Springer', 'takes {p|the *}': 'nimmt {p|the *}', '@{a} and {b}': '{a} und {b}', 'attacks {l}': 'greift {l} an' });
  assert.equal(t.t('  Play '), '  Spielen ');
  assert.equal(t.t('{n} games', { n: 3 }), '3 Partien');
  assert.equal(t.find('12 games'), '12 Partien');
  assert.equal(t.find('knight on f5'), 'Springer auf f5');
  assert.equal(t.find('attacks knight on f5 and knight on d5'), 'greift Springer auf f5 und Springer auf d5 an');
  assert.equal(t.find('cats and dogs'), null, 'a part-only key never translates whole text');
  assert.equal(t.find('Unknown'), null);
  assert.equal(t.t('Unknown'), 'Unknown');
  assert.equal(translator({}).t('Play'), 'Play');
});

test('isText: words count; moves, move lists and FENs don\'t', () => {
  assert.ok(isText('Better was d4.'));
  for (const s of ['Nf3', 'exd5+', 'O-O-O', '1. e4 c5 2. Nf3 d6 3. d4 cxd4', START, '+0.30', '  ']) assert.ok(!isText(s), s);
});

test('German move letters become SAN, only in moves', () => {
  assert.equal(germanSanToSan('Sf3 und Dxd5+, dann Lb5 Txe1 Kg1 e8=D, e8T'), 'Nf3 und Qxd5+, dann Bb5 Rxe1 Kg1 e8=Q, e8=R');
  assert.equal(germanSanToSan('Der Springer zieht. Spiel Sbd2!'), 'Der Springer zieht. Spiel Nbd2!');
  assert.equal(germanSanToSan('Nf3 and Qxd5'), 'Nf3 and Qxd5');
  assert.equal(parseMoveInput(Chess, START, germanSanToSan('Sf3')).san, 'Nf3');
});

test('screen readers hear moves in the page\'s language', () => {
  assert.equal(sanToSpeech('Nxe5+', 'de'), 'Springer schlägt e5, Schach');
  assert.equal(sanToSpeech('O-O-O', 'de'), 'lange Rochade');
  assert.equal(sanToSpeech('e8=Q#', 'de'), 'e8 wird zur Dame, Schachmatt');
  assert.equal(sanToSpeech('Nxe5+'), 'knight takes e5, check');
});

test('the coach answers in German when asked, with English move letters; German comments are cached apart', () => {
  assert.equal(coachRules('en'), COACH_RULES);
  assert.match(coachRules('de'), /Answer in German \(Deutsch\).*English piece letters/s);
  assert.ok(coachRules('de').startsWith(COACH_RULES), 'the English rules stay as they are');
  const k = { epd: 'x', uci: 'e2e4', aspects: ['last'], view: 'all', level: 2, model: 'm' };
  assert.equal(commentKey(k), commentKey({ ...k, lang: 'en' }), 'English keys are unchanged');
  assert.notEqual(commentKey(k), commentKey({ ...k, lang: 'de' }));
});

// The page's markup: every text and title, placeholder or aria-label in it has a German translation.
test('German covers every text in the page\'s markup', () => {
  const html = fs.readFileSync(new URL('../../src/index.html', import.meta.url), 'utf8');
  const body = html.slice(html.indexOf('<header'), html.indexOf('<script type="module">'));
  const texts = [...body.replace(/<select[^>]*translate="no"[\s\S]*?<\/select>/g, '').matchAll(/>([^<>]+)</g)].map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim());
  const attrs = [...body.matchAll(/(?:title|placeholder|aria-label)="([^"]+)"/g)].map(m => m[1]);
  const missing = [...texts, ...attrs].filter(s => isText(s) && T.find(s) === null);
  assert.deepEqual([...new Set(missing)], []);
});

test('German covers the labels the modules show: themes, aspects, modes, styles, classics, books', () => {
  const shown = [
    ...Object.values(TAG_LABELS), ...ASPECTS.map(a => a.label), ...COMMENT_WHEN.map(w => w.label),
    ...STYLES.flatMap(s => [s.label, s.hint]), ...CLASSICS.flatMap(c => [c.title, c.about]),
    ...LITERATURE.map(b => b.about), ...LITERATURE.flatMap(b => Object.values(b.where || {})).map(w => `Start with ${w}.`),
  ];
  assert.deepEqual(shown.filter(s => T.find(s) === null), []);
});

test('every German template uses the placeholders of its key, and none is empty', () => {
  for (const [k, v] of Object.entries(DE)) {
    assert.ok(v.length || k.startsWith('@'), k);
    const names = s => [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map(m => m[1]).sort();
    assert.deepEqual(names(v), names(k.replace(/^@/, '')), k);
  }
});

test('typical sentences read as German', () => {
  const cases = {
    'Looking at after 2. g4 · Black to move · eval −1.49 d14 · coach sees the engine\'s analysis': 'Stellung nach 2. g4 · Schwarz am Zug · Bewertung −1.49 d14 · Coach sieht: die Engine-Analyse',
    'leaves the knight on b5 to be taken (cxb5), but that isn\'t the engine\'s choice for Black': 'lässt den Springer auf b5 schlagen (cxb5), aber das ist nicht die Wahl der Engine für Schwarz',
    'a different idea: a bishop move on the queenside, where the best move is a pawn move on the centre': 'eine andere Idee: ein Läuferzug auf dem Damenflügel, wo der beste Zug ein Bauernzug im Zentrum ist',
    '· Now Qxf3: wins a loose bishop': '· Jetzt Qxf3: gewinnt einen ungedeckten Läufer',
    'Game over: 0-1 by resignation': 'Partie zu Ende: 0-1 durch Aufgabe',
    'Challenges: 1 of 2 right. By theme: Fork 1/1, Pin 0/1.': 'Herausforderungen: 1 von 2 richtig. Nach Thema: Gabel 1/1, Fesselung 0/1.',
  };
  for (const [en, de] of Object.entries(cases)) assert.equal(T.find(en), de);
});
