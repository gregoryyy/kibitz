// Original Kibitz study notes (TODO 5.5), under the repository licence. These are general
// ideas, not engine lines or book excerpts. Match the opening route and the current pawns
// separately; a historical opening name does not establish today's pawn structure.
import { epd, openingFamily, positionFeatures } from './knowledge.js';
import { quote } from './prompt.js';

/** @typedef {[string, string, string, string]} GuideWords Title, idea, plans, possible pawn structures. */
/** @type {{id: string, kind: 'opening'|'structure', en: GuideWords, de: GuideWords}[]} */
const GUIDES = [
  { id: 'open-games', kind: 'opening', en: [
    'Open games', 'Both sides occupy the centre early. Development and king safety matter before collecting material.',
    'White seeks active pieces and a supported central expansion. Black develops with threats against the centre and prepares to contest open files.',
    'Central exchanges can open files quickly; a closed centre needs a different pace.'
  ], de: [
    'Offene Spiele', 'Beide Seiten besetzen früh das Zentrum. Entwicklung und Königssicherheit gehen vor Materialgewinn.',
    'Weiß strebt aktive Figuren und eine vorbereitete Ausdehnung im Zentrum an. Schwarz entwickelt sich mit Druck auf das Zentrum und bereitet den Kampf um offene Linien vor.',
    'Zentrumsabtausche können schnell Linien öffnen; ein geschlossenes Zentrum verlangt ein anderes Tempo.'
  ] },
  { id: 'italian', kind: 'opening', en: [
    'Italian Game', 'The king bishop develops actively while the centre remains flexible.',
    'White coordinates development with a central break. Black seeks the same central activity and should avoid falling behind in development.',
    'Quiet central pawn chains can turn into an open centre after exchanges. A bishop aimed at the king is useful only when the rest of the army can join.'
  ], de: [
    'Italienische Partie', 'Der Königsflügelläufer wird aktiv entwickelt, während das Zentrum beweglich bleibt.',
    'Weiß verbindet die Entwicklung mit einem vorbereiteten Zentrumsdurchbruch. Schwarz strebt ebenfalls aktives Zentrumsspiel an und sollte keinen Entwicklungsrückstand zulassen.',
    'Ruhige Bauernketten können nach Abtauschen in ein offenes Zentrum übergehen. Ein auf den König gerichteter Läufer hilft nur, wenn die übrigen Figuren mitwirken können.'
  ] },
  { id: 'ruy-lopez', kind: 'opening', en: [
    'Ruy Lopez', 'Pressure on the knight supporting the centre gives White a long-term central task.',
    'White improves the pieces before choosing a central or kingside expansion. Black develops harmoniously and looks for a freeing central break.',
    'The centre may stay closed or open by exchange. Exchanging a bishop for a knight changes the balance between pawn weaknesses and the bishop pair.'
  ], de: [
    'Spanische Partie', 'Druck auf den Springer, der das Zentrum stützt, gibt Weiß eine langfristige Aufgabe im Zentrum.',
    'Weiß verbessert die Figuren vor einer Ausdehnung im Zentrum oder am Königsflügel. Schwarz entwickelt sich harmonisch und sucht einen befreienden Zentrumsdurchbruch.',
    'Das Zentrum kann geschlossen bleiben oder durch Abtausch geöffnet werden. Ein Läufer-Springer-Tausch verändert das Verhältnis zwischen Bauernschwächen und Läuferpaar.'
  ] },
  { id: 'sicilian', kind: 'opening', en: [
    'Sicilian Defence', 'Black challenges the centre from the flank, creating an asymmetric game.',
    'White uses development and central space for activity. Black seeks counterplay on central and queenside lines; the exact variation decides the timing.',
    'An open Sicilian often trades Black’s c-pawn for White’s d-pawn. Closed and other Sicilian systems have different pawn structures.'
  ], de: [
    'Sizilianische Verteidigung', 'Schwarz greift das Zentrum vom Flügel aus an und schafft ein asymmetrisches Spiel.',
    'Weiß nutzt Entwicklung und Raum im Zentrum für aktives Spiel. Schwarz sucht Gegenspiel auf Zentrums- und Damenflügellinien; die konkrete Variante bestimmt den Zeitpunkt.',
    'Im offenen Sizilianer wird oft der schwarze c-Bauer gegen den weißen d-Bauern getauscht. Geschlossene und andere sizilianische Systeme haben andere Bauernstrukturen.'
  ] },
  { id: 'french', kind: 'opening', en: [
    'French Defence', 'Black supports a central foothold with the e-pawn, accepting a restricted light-squared bishop for a solid centre.',
    'White can use space to improve the pieces. Black challenges the pawn centre and seeks useful work for the light-squared bishop.',
    'An advanced white e-pawn can lock the centre; exchanging central pawns produces a different game. Do not assume the locked chain is present.'
  ], de: [
    'Französische Verteidigung', 'Schwarz stützt mit dem e-Bauern einen zentralen Stützpunkt und nimmt für ein festes Zentrum einen eingeschränkten weißfeldrigen Läufer in Kauf.',
    'Weiß kann Raum zur Verbesserung der Figuren nutzen. Schwarz greift das Bauernzentrum an und sucht eine sinnvolle Aufgabe für den weißfeldrigen Läufer.',
    'Ein vorgeschobener weißer e-Bauer kann das Zentrum verriegeln; Zentrumsabtausche führen zu einem anderen Spiel. Die verriegelte Kette muss tatsächlich vorhanden sein.'
  ] },
  { id: 'caro-kann', kind: 'opening', en: [
    'Caro-Kann', 'Black supports the central d-pawn with the c-pawn, keeping a route out for the light-squared bishop.',
    'White uses central space and development. Black aims for sound development and a prepared challenge to the centre.',
    'Advance, exchange and isolated-pawn positions need different plans; use the pawns on the board to distinguish them.'
  ], de: [
    'Caro-Kann', 'Schwarz stützt den zentralen d-Bauern mit dem c-Bauern und hält dem weißfeldrigen Läufer einen Weg offen.',
    'Weiß nutzt Raum im Zentrum und Entwicklung. Schwarz strebt eine gesunde Entwicklung und einen vorbereiteten Angriff auf das Zentrum an.',
    'Vorstoß-, Abtausch- und Isolanistellungen brauchen unterschiedliche Pläne; entscheide anhand der Bauern auf dem Brett.'
  ] },
  { id: 'queens-gambit', kind: 'opening', en: [
    'Queen’s Gambit', 'White challenges Black’s central foothold with a wing pawn while building a centre of their own.',
    'White develops pressure against the centre. Black completes development and prepares a freeing pawn break instead of defending passively.',
    'Exchanges may lead to a Carlsbad structure, an isolated d-pawn or hanging pawns. These are possible outcomes, not features of every Queen’s Gambit.'
  ], de: [
    'Damengambit', 'Weiß greift den schwarzen Stützpunkt im Zentrum mit einem Flügelbauern an und baut ein eigenes Zentrum auf.',
    'Weiß entwickelt Druck gegen das Zentrum. Schwarz vollendet die Entwicklung und bereitet einen befreienden Bauernvorstoß vor, statt nur passiv zu verteidigen.',
    'Abtausche können zu einer Karlsbader Struktur, einem isolierten d-Bauern oder hängenden Bauern führen. Diese Strukturen entstehen nicht in jedem Damengambit.'
  ] },
  { id: 'slav', kind: 'opening', en: [
    'Slav and Semi-Slav', 'Black supports the central d-pawn with the c-pawn. The placement of the e-pawn changes the light-squared bishop’s freedom.',
    'White develops pressure in the centre. Black balances solid support with active development and a prepared central break.',
    'Exchanges can create symmetry, an isolated pawn or a minority-attack structure. The opening name alone does not choose the plan.'
  ], de: [
    'Slawisch und Halbslawisch', 'Schwarz stützt den zentralen d-Bauern mit dem c-Bauern. Die Stellung des e-Bauern beeinflusst die Freiheit des weißfeldrigen Läufers.',
    'Weiß entwickelt Druck im Zentrum. Schwarz verbindet eine feste Basis mit aktiver Entwicklung und einem vorbereiteten Zentrumsdurchbruch.',
    'Abtausche können Symmetrie, einen isolierten Bauern oder eine Struktur für einen Minoritätsangriff schaffen. Der Eröffnungsname allein bestimmt den Plan nicht.'
  ] },
  { id: 'kid', kind: 'opening', en: [
    'King’s Indian Defence', 'Black lets White build a broad centre and prepares to challenge it with pieces and pawn breaks.',
    'White uses space without neglecting king safety. Black completes development and chooses a central challenge before the position becomes too cramped.',
    'A locked centre can support play on opposite wings. An exchanged or open centre requires different handling.'
  ], de: [
    'Königsindische Verteidigung', 'Schwarz lässt Weiß ein breites Zentrum aufbauen und bereitet den Angriff darauf mit Figuren und Bauernvorstößen vor.',
    'Weiß nutzt den Raum, ohne die Königssicherheit zu vernachlässigen. Schwarz vollendet die Entwicklung und wählt einen Gegenstoß im Zentrum, bevor die Stellung zu eng wird.',
    'Ein verriegeltes Zentrum kann Spiel an entgegengesetzten Flügeln ermöglichen. Ein abgetauschtes oder offenes Zentrum verlangt andere Pläne.'
  ] },
  { id: 'nimzo', kind: 'opening', en: [
    'Nimzo-Indian Defence', 'Black uses quick development and pressure on a central knight to influence White’s pawn centre.',
    'White balances central space and the bishop pair against possible pawn weaknesses. Black seeks active pieces and timely central exchanges.',
    'Doubled c-pawns and isolated d-pawns are possible, but neither is guaranteed. Reassess the structure after each central exchange.'
  ], de: [
    'Nimzoindische Verteidigung', 'Schwarz beeinflusst das weiße Bauernzentrum durch schnelle Entwicklung und Druck auf einen zentralen Springer.',
    'Weiß wägt Raum und Läuferpaar gegen mögliche Bauernschwächen ab. Schwarz sucht aktive Figuren und rechtzeitige Zentrumsabtausche.',
    'Doppelbauern auf der c-Linie und isolierte d-Bauern sind möglich, aber nicht zwingend. Beurteile die Struktur nach jedem Zentrumsabtausch neu.'
  ] },
  { id: 'english', kind: 'opening', en: [
    'English Opening', 'White influences the centre from the c-file and keeps several central formations available.',
    'White develops before committing the central pawns. Black can occupy the centre or mirror White’s setup, while watching for transpositions.',
    'The game can transpose into a queen-pawn opening or take a reversed Sicilian shape. Match the actual position rather than memorising one move order.'
  ], de: [
    'Englische Eröffnung', 'Weiß beeinflusst das Zentrum von der c-Linie aus und hält mehrere Zentrumsformationen offen.',
    'Weiß entwickelt sich, bevor die Zentrumsbauern festgelegt werden. Schwarz kann das Zentrum besetzen oder den Aufbau spiegeln und achtet dabei auf Zugumstellungen.',
    'Die Partie kann in eine Damenbauerneröffnung oder eine sizilianische Struktur mit vertauschten Farben übergehen. Entscheidend ist die Stellung, nicht eine einzige Zugfolge.'
  ] },
  { id: 'd-pawn', kind: 'opening', en: [
    'Queen-pawn systems', 'A supported d-pawn gives White a central foothold; the bishop setup and later pawn exchanges distinguish the systems.',
    'White coordinates the pieces before expanding. Black contests the centre and seeks useful activity rather than copying a setup mechanically.',
    'The c- and e-pawns determine whether the centre stays compact or opens. A familiar piece setup does not guarantee the same pawn structure.'
  ], de: [
    'Damenbauernsysteme', 'Ein gestützter d-Bauer gibt Weiß Halt im Zentrum; Läuferaufbau und spätere Bauernabtausche unterscheiden die Systeme.',
    'Weiß stimmt die Figuren vor einer Ausdehnung aufeinander ab. Schwarz kämpft um das Zentrum und sucht aktives Spiel, statt einen Aufbau mechanisch zu kopieren.',
    'Die c- und e-Bauern bestimmen, ob das Zentrum kompakt bleibt oder sich öffnet. Ein vertrauter Figurenaufbau garantiert nicht dieselbe Bauernstruktur.'
  ] },
  { id: 'iqp', kind: 'structure', en: [
    'Isolated d-pawn', 'Without a pawn on an adjacent file, the d-pawn cannot be supported by another pawn.',
    'The owner seeks piece activity and a well-supported advance. The opponent tries to blockade the pawn and reduce the attacking pieces.',
    'This note applies to either colour. A pawn exchange or advance can change the structure and the balance of activity.'
  ], de: [
    'Isolierter d-Bauer', 'Ohne Bauern auf einer Nachbarlinie kann der d-Bauer nicht durch einen anderen Bauern gedeckt werden.',
    'Die Seite mit dem Isolani sucht Figurenaktivität und einen gut vorbereiteten Vorstoß. Der Gegner versucht, den Bauern zu blockieren und Angriffsfiguren abzutauschen.',
    'Dieser Hinweis gilt für beide Farben. Ein Bauernabtausch oder Vorstoß kann die Struktur und das Verhältnis der Aktivität verändern.'
  ] },
  { id: 'hanging-pawns', kind: 'structure', en: [
    'Hanging c- and d-pawns', 'The connected central pawns have no neighbouring b- or e-pawn to support them.',
    'The owner uses their space and mobility. The opponent pressures the pawns and tries to provoke an advance that leaves a fixed target.',
    'After one pawn advances or is exchanged, reassess the newly exposed squares and any isolated pawn.'
  ], de: [
    'Hängende c- und d-Bauern', 'Die verbundenen Zentrumsbauern haben keinen benachbarten b- oder e-Bauern zur Unterstützung.',
    'Ihre Seite nutzt Raum und Beweglichkeit. Der Gegner setzt die Bauern unter Druck und versucht, einen Vorstoß mit einer bleibenden Schwäche zu provozieren.',
    'Nach einem Vorstoß oder Abtausch müssen die neu freigelegten Felder und mögliche isolierte Bauern neu beurteilt werden.'
  ] },
  { id: 'carlsbad', kind: 'structure', en: [
    'Carlsbad structure', 'The exchanged central pawns leave unequal pawn majorities on the wings.',
    'A minority attack can create a pawn target on the queenside. The other side seeks active pieces and central or kingside counterplay; preparation matters.',
    'The pattern may occur with colours reversed. Use the pawn placement to identify the minority and the targets.'
  ], de: [
    'Karlsbader Struktur', 'Die abgetauschten Zentrumsbauern hinterlassen unterschiedliche Bauernmehrheiten an den Flügeln.',
    'Ein Minoritätsangriff kann am Damenflügel ein Bauernziel schaffen. Die andere Seite sucht aktive Figuren und Gegenspiel im Zentrum oder am Königsflügel; die Vorbereitung ist entscheidend.',
    'Das Muster kann mit vertauschten Farben auftreten. Bestimme Minderheit und Ziele anhand der tatsächlichen Bauernstellung.'
  ] },
  { id: 'french-chain', kind: 'structure', en: [
    'Locked French centre', 'White’s d4–e5 chain faces Black’s d5–e6 chain.',
    'White can use the space behind the advanced e-pawn. Black seeks pressure on the chain’s base and a prepared pawn break; both sides need routes for restricted pieces.',
    'These exact central pawns are present now. Once the chains open, reassess the files and king safety.'
  ], de: [
    'Verriegeltes französisches Zentrum', 'Die weiße Kette d4–e5 steht der schwarzen Kette d5–e6 gegenüber.',
    'Weiß kann den Raum hinter dem vorgeschobenen e-Bauern nutzen. Schwarz sucht Druck auf die Kettenbasis und einen vorbereiteten Bauernhebel; beide Seiten brauchen Wege für eingeschränkte Figuren.',
    'Diese Zentrumsbauern stehen jetzt tatsächlich auf dem Brett. Nach dem Öffnen der Ketten sind Linien und Königssicherheit neu zu beurteilen.'
  ] },
  { id: 'kid-chain', kind: 'structure', en: [
    'Locked King’s Indian centre', 'White’s d5–e4 chain faces Black’s d6–e5 chain.',
    'White often has room for queenside play. Black looks for kingside counterplay, while both sides watch for a central opening that changes the race.',
    'The locked centre makes wing play possible; it does not make every pawn storm safe.'
  ], de: [
    'Verriegeltes königsindisches Zentrum', 'Die weiße Kette d5–e4 steht der schwarzen Kette d6–e5 gegenüber.',
    'Weiß hat oft Raum für Damenflügelspiel. Schwarz sucht Gegenspiel am Königsflügel; beide Seiten beachten eine mögliche Zentrumsöffnung, die den Wettlauf verändert.',
    'Das verriegelte Zentrum ermöglicht Flügelspiel; es macht nicht jeden Bauernsturm sicher.'
  ] },
  { id: 'maroczy', kind: 'structure', en: [
    'Maróczy bind', 'White’s c4- and e4-pawns control central space after the d-pawn has left its file.',
    'White improves pieces while keeping control. Black seeks exchanges, active squares and a prepared freeing break against the bind.',
    'Space can restrict the opponent, but advancing too quickly may release that pressure.'
  ], de: [
    'Maróczy-Aufbau', 'Die weißen Bauern c4 und e4 kontrollieren Raum im Zentrum, nachdem der d-Bauer seine Linie verlassen hat.',
    'Weiß verbessert die Figuren und hält die Kontrolle aufrecht. Schwarz sucht Abtausch, aktive Felder und einen vorbereiteten Befreiungsstoß gegen die Klammer.',
    'Raum kann den Gegner einschränken; zu schnelle Vorstöße können diesen Druck jedoch lösen.'
  ] },
  { id: 'stonewall', kind: 'structure', en: [
    'Stonewall', 'A connected central pawn wall gains space but leaves holes on the opposite colour.',
    'The owner supports useful outposts and finds work for the restricted bishop. The opponent contests those outposts and looks for a central break.',
    'Either colour can build the wall. Identify the weak squares from the actual pawn placement.'
  ], de: [
    'Stonewall-Aufbau', 'Ein verbundener Bauernwall im Zentrum gewinnt Raum, hinterlässt aber Löcher auf der anderen Feldfarbe.',
    'Seine Seite stützt nützliche Vorposten und sucht eine Aufgabe für den eingeschränkten Läufer. Der Gegner bekämpft die Vorposten und sucht einen Zentrumsdurchbruch.',
    'Beide Farben können den Wall aufbauen. Bestimme die schwachen Felder aus der tatsächlichen Bauernstellung.'
  ] },
];

/**
 * Capture the visible route only. An ancestor-rooted scratch line replaces the later game
 * path; a disconnected setup receives no opening history from the game behind it.
 * Full FENs distinguish repeated occurrences before EPD-based opening lookup.
 * @param {string[]} gameFens Checked game positions through the displayed cursor.
 * @param {{start: string, fens: string[]}|null} [scratch=null] Checked visible scratch prefix.
 * @returns {string[]} Detached path, without future moves.
 */
export function openingGuidePath(gameFens, scratch = null) {
  if (!scratch) return gameFens.slice();
  const root = gameFens.lastIndexOf(scratch.start);
  return [...(root < 0 ? [] : gameFens.slice(0, root)), ...scratch.fens];
}

/**
 * Retrieve one authored opening-family guide and up to two current structure notes.
 * Opening lookup keeps EPD rights/turn and ignores counters; the latest match along the
 * opening prefix is background only. A direct match always takes precedence. Structures
 * come from the current legal board, never an opening name. Endgames receive no guides.
 * @param {import('./tutor.js').ChessConstructor} Chess Injected chess.js constructor.
 * @param {Record<string, string[]>} eco EPD to [ECO code, opening name].
 * @param {string[]} path Checked positions through the displayed game/scratch cursor.
 * @param {string} [lang='en'] Guide language, with English fallback.
 */
export function openingGuides(Chess, eco, path, lang = 'en') {
  const fen = path.at(-1), empty = { fen, opening: null, guides: [] };
  let c; try { c = new Chess(fen); } catch { return empty; }
  if (!fen) return empty;
  const current = eco[epd(c.fen())];
  let matched = current;
  if (!matched) for (const f of path.slice(0, 41)) if (eco[epd(f)]) matched = eco[epd(f)];
  const opening = matched ? { eco: matched[0], name: matched[1] } : null;
  const features = positionFeatures(c, { ply: (c.moveNumber() - 1) * 2 + +(c.turn() === 'b'), opening });
  if (c.isGameOver() || features.some(f => f.tag === 'endgame')) return { fen, opening, guides: [] };
  const family = openingFamily(opening?.name), tags = new Set(features.map(f => f.tag));
  // The generic "King's Pawn Game" name after only 1. e4 also maps to open-games in
  // knowledge.js. Do not teach an open-game structure before Black has chosen it.
  const selected = [GUIDES.find(g => g.kind === 'opening' && g.id === family && (family !== 'open-games' || /^C/.test(opening.eco))),
    ...GUIDES.filter(g => g.kind === 'structure' && tags.has(g.id)).slice(0, 2)].filter(Boolean);
  const guides = selected.map(g => {
    const [title, idea, plans, structure] = lang === 'de' ? g.de : g.en;
    return { id: g.id, kind: g.kind, title, idea, plans, structure,
      match: g.kind === 'structure' ? 'pawns' : current ? 'position' : 'history' };
  });
  return { fen, opening, guides };
}

/**
 * Quote guide text as bounded retrieval data, separated from the engine's evidence.
 * No authored plan can establish a current evaluation or license an unsupported line.
 * @param {ReturnType<typeof openingGuides>} study Captured selection, normally in English.
 * @returns {string} Empty for no match; caller applies live-help/General chess permissions.
 */
export function openingGuideContext(study) {
  if (!study.guides.length) return '';
  return ['Kibitz opening study notes (general background, not engine evidence). Apply only ideas that fit the supplied position. Proposed continuations and evaluations require supplied engine evidence or successful engine tools. Discuss played moves as game history.',
    ...study.guides.map(g => `- Guide ${quote(g.id, 60)}, matched by ${g.match}: ${quote(`${g.title}. Idea: ${g.idea} Plans: ${g.plans} Pawn structures: ${g.structure}`, 1800)}`)].join('\n');
}
