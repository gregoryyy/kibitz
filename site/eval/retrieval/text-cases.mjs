// Manual passage-level judgements. These test keyword retrieval, not answer/chess correctness.
export const TEXT_SUITE_VERSION = 1;
const annotation = (game, ply, collection = 'classic') => ({ kind: 'annotation', game, ply, collection });
const guide = (id, language, section) => ({ kind: 'guide', guide: id, language, section });
/** @typedef {{kind: string, game?: string, ply?: number, collection?: string, guide?: string, language?: string, section?: string}} Label */
/** @type {Array<{id: string, language: string, text: string, kind: string, collection?: string, group?: string, expected: Label[], reason: string}>} */
export const TEXT_CASES = [
  { id: 'mate-san-en', language: 'en', text: 'Qxf7', kind: 'annotation', expected: [annotation('ex-opera', 11)], reason: 'The Opera note explicitly names Qxf7.' },
  { id: 'mate-san-de', language: 'de', text: 'Dxf7', kind: 'annotation', expected: [annotation('ex-opera', 11)], reason: 'German queen notation should find the English SAN in an imported note.' },
  { id: 'lucena-bridge', language: 'en', text: 'bridge fourth rank', kind: 'annotation', expected: [annotation('st-lucena', 3)], reason: 'The Lucena note describes blocking checks on the fourth rank.' },
  { id: 'philidor-sixth', language: 'en', text: 'sixth rank', kind: 'annotation', expected: [annotation('st-philidor', 1)], reason: 'The Philidor defence note names the sixth rank.' },
  { id: 'saavedra-stalemate', language: 'en', text: 'Saavedra stalemate', kind: 'annotation', expected: [annotation('st-saavedra', 10), annotation('st-saavedra', 11)], reason: 'Both notes discuss the stalemate idea, at different plies.' },
  { id: 'second-note', language: 'en', text: 'second arrival', kind: 'annotation', collection: 'library', expected: [annotation('repeat', 5, 'library')], reason: 'The second note is a separate passage despite equal board EPDs.' },
  { id: 'first-note', language: 'en', text: 'first arrival', kind: 'annotation', collection: 'library', expected: [annotation('repeat', 1, 'library')], reason: 'The first arrival must retain its own passage.' },
  { id: 'en-passant-note', language: 'en', text: 'en passant d6', kind: 'annotation', collection: 'library', expected: [annotation('en-passant', 0, 'library')], reason: 'An initial-position comment can be retrieved.' },
  { id: 'castling-note', language: 'en', text: 'castling rights', kind: 'annotation', collection: 'library', expected: [annotation('castling', 0, 'library')], reason: 'The source comment names castling rights.' },
  { id: 'iqp-en', language: 'en', text: 'blockade attacking pieces', kind: 'guide', expected: [guide('iqp', 'en', 'plans')], reason: 'The authored IQP plan describes blockade and reducing attacking pieces.' },
  { id: 'iqp-de', language: 'de', text: 'Isolani blockieren', kind: 'guide', expected: [guide('iqp', 'de', 'plans')], reason: 'The German IQP plan contains both concepts.' },
  { id: 'carlsbad-en', language: 'en', text: 'minority attack queenside', kind: 'guide', expected: [guide('carlsbad', 'en', 'plans')], reason: 'The Carlsbad plan explicitly describes a minority attack.' },
  { id: 'carlsbad-de', language: 'de', text: 'Minoritätsangriff Damenflügel', kind: 'guide', expected: [guide('carlsbad', 'de', 'plans')], reason: 'The same authored plan is searchable in German.' },
  { id: 'sicilian-exchange', language: 'en', text: 'c-pawn d-pawn Sicilian', kind: 'guide', expected: [guide('sicilian', 'en', 'structure')], reason: 'This section states which central pawns an open Sicilian trades.' },
  { id: 'french-base', language: 'de', text: 'Kettenbasis Bauernhebel', kind: 'guide', expected: [guide('french-chain', 'de', 'plans')], reason: 'The locked French plan names the chain base and pawn break.' },
  { id: 'hanging-support', language: 'en', text: 'neighbouring b e pawn support', kind: 'guide', expected: [guide('hanging-pawns', 'en', 'idea')], reason: 'The definition identifies the missing neighbouring support pawns.' },
  { id: 'maroczy-en', language: 'en', text: 'Maroczy', kind: 'guide', expected: ['idea', 'plans', 'structure'].map(s => guide('maroczy', 'en', s)), reason: 'An accent-insensitive title lookup retrieves all three guide sections.' },
  { id: 'maroczy-de', language: 'de', text: 'Maroczy', kind: 'guide', expected: ['idea', 'plans', 'structure'].map(s => guide('maroczy', 'de', s)), reason: 'The German guide title also has the accent.' },
  { id: 'bridge-paraphrase', language: 'en', text: 'How can I shelter the king from rook checks in a winning rook ending?', kind: 'annotation', group: 'paraphrase', expected: [annotation('st-lucena', 3)], reason: 'Building the Lucena bridge shelters the king from checks; the question avoids the source wording.' },
  { id: 'iqp-paraphrase', language: 'de', text: 'Wie stoppt man einen freistehenden Zentralbauern durch Figuren?', kind: 'guide', group: 'paraphrase', expected: [guide('iqp', 'de', 'plans')], reason: 'The isolated-pawn plan explains blockading with pieces using different wording.' },
  { id: 'no-quantum-en', language: 'en', text: 'quantum tunnelling', kind: 'all', expected: [], reason: 'No such passage in this fixed corpus.' },
  { id: 'no-quantum-de', language: 'de', text: 'Quantenverschränkung', kind: 'guide', expected: [], reason: 'No such German lesson text.' },
  { id: 'wrong-language', language: 'en', text: 'Isolani', kind: 'guide', expected: [], reason: 'An English-only guide filter excludes the German wording.' },
  { id: 'wrong-collection', language: 'en', text: 'Qxf7', kind: 'annotation', collection: 'library', expected: [], reason: 'The matching Opera annotation is outside the requested collection.' },
  { id: 'wrong-kind', language: 'en', text: 'Lucena', kind: 'guide', expected: [], reason: 'The collection has a Lucena study, but no authored Lucena guide.' },
  { id: 'stopwords-only', language: 'de', text: 'the und für', kind: 'all', expected: [], reason: 'Stopwords alone carry no lexical retrieval signal.' },
  { id: 'unsupported-quantum-knight', language: 'en', text: 'quantum knight teleportation', kind: 'annotation', expected: [], reason: 'Ordinary knight notes do not describe the requested fictional mechanism.' },
  { id: 'unsupported-proof', language: 'en', text: 'Syzygy proof rook draw', kind: 'annotation', expected: [], reason: 'No passage supplies a Syzygy proof; matching rook/draw words does not establish one.' },
];
