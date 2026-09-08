/**
 * The plain constants of the content model: the closed vocabularies and the
 * patterns ids and theme tokens must match.
 *
 * They live here rather than in schema.ts so the app can read them without
 * pulling Zod into the client bundle. schema.ts imports them, so there is
 * still one source of truth; the validator and the app agree by construction.
 * Nothing in this file may import anything.
 */

export const DISCIPLINES = ['music', 'opera', 'art', 'history'] as const
export type Discipline = (typeof DISCIPLINES)[number]

export const ITEM_KINDS = [
  'work', // a symphony, an aria, a painting
  'creator', // a composer or an artist
  'movement', // Impressionism, verismo, the Secession
  'term', // a lexicon entry: chiaroscuro, bel canto, leitmotif
  'venue', // a museum, an opera house
  'episode', // history: a dated event or era
  'person', // history: a ruler, patron, courtier, taught through a portrait
  'apocrypha', // history: a famous line or story with a verdict
] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const VERDICTS = ['attested', 'embellished', 'invented'] as const
export type Verdict = (typeof VERDICTS)[number]

export const REMARK_OPTION_KINDS = ['correct', 'wrong', 'gaffe'] as const
export type RemarkOptionKind = (typeof REMARK_OPTION_KINDS)[number]

// Item ids look like `music.beethoven.symphony-5.i` or `history.apocrypha.let-them-eat-cake`.
export const ID_PATTERN = /^(music|opera|art|history)\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/
export const SCENARIO_ID_PATTERN = /^scenario\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/
export const CITY_ID_PATTERN = /^[a-z]+(?:-[a-z]+)*$/

/**
 * Theme notation for synthesised playback (Drop the Needle).
 * Tokens: `<pitch>/<value>` or `R/<value>` for a rest. Pitch is scientific
 * (C4 = middle C), accidentals `#` and `b`. Value is 1, 2, 4, 8, 16 or 32,
 * optionally dotted (`4.`). Bar lines `|` are ignored. Example, Beethoven 5:
 *   "R/8 G4/8 G4/8 G4/8 Eb4/2 | R/8 F4/8 F4/8 F4/8 D4/2"
 */
export const THEME_TOKEN = /^(?:R|[A-G][#b]?[0-8])\/(?:1|2|4|8|16|32)\.?$/
