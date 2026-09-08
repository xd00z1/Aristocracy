/**
 * Content schema. Everything editors write in content/*.yaml is validated
 * against this before it reaches the app. Keep the schema and CLAUDE.md's
 * content rules in step.
 */
import { z } from 'zod'

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

export const ThemeSchema = z.object({
  notes: z.string().min(1),
  tempo: z.number().int().min(30).max(240),
  key: z.string().optional(),
  note: z.string().optional(), // editorial note, e.g. "opening bars, first violins"
})

export const ImageMediaSchema = z.object({
  /** Wikimedia Commons file title, e.g. "File:Van Eyck - Arnolfini Portrait.jpg". Resolved by scripts/fetch-media.mjs. */
  commons: z.string().optional(),
  /** Local file name under public/media/img. Defaults to `<item id>.jpg` when fetched. */
  file: z.string().optional(),
  source: z.string().min(1),
  license: z.string().min(1),
  /** Where to centre the initial zoom for Zoom Out, as fractions of width/height. */
  focus: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
})

export const AudioMediaSchema = z.object({
  file: z.string().min(1),
  seconds: z.number().positive().optional(),
  source: z.string().min(1),
  license: z.string().min(1),
})

export const MediaSchema = z.object({
  image: ImageMediaSchema.optional(),
  audio: AudioMediaSchema.optional(),
})

export const DistractorsSchema = z.object({
  creator: z.array(z.string().min(1)).optional(),
  title: z.array(z.string().min(1)).optional(),
  era: z.array(z.string().min(1)).optional(),
  year: z.array(z.number().int()).optional(),
  term: z.array(z.string().min(1)).optional(), // wrong definitions for a term
  person: z.array(z.string().min(1)).optional(),
})

const ItemBase = z.object({
  id: z.string().regex(ID_PATTERN, 'id must look like discipline.slug.parts'),
  discipline: z.enum(DISCIPLINES),
  kind: z.enum(ITEM_KINDS),
  title: z.string().min(1),
  /** Which Grand Tour city teaches this item. Must exist in content/cities.yaml. */
  city: z.string().regex(CITY_ID_PATTERN),
  /** 1 easy, 2 standard, 3 hard. */
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  era: z.string().min(1),
  /** The year that pins this item to a timeline (composition, birth, event). */
  year: z.number().int().optional(),
  year_end: z.number().int().optional(),
  /** "c." prefix in the UI when the year is approximate. */
  year_approx: z.boolean().optional(),
  creator: z.string().optional(),
  parent: z.string().optional(), // the opera an aria belongs to, the cycle a painting belongs to
  facts: z.array(z.string().min(1)).min(1),
  /** One sayable, defensible sentence. Required for everything. */
  remark: z.string().min(1),
  /** The thing that exposes you. Required for everything. */
  gaffe: z.string().min(1),
  links: z.array(z.string().regex(ID_PATTERN)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  sources: z.array(z.string().min(1)).min(1),
  reviewed_by: z.string().nullable().default(null),
  distractors: DistractorsSchema.optional(),
  media: MediaSchema.optional(),
  theme: ThemeSchema.optional(),
  /** For terms and foreign titles: a respelling like "sprets-tsa-TOO-ra". */
  pronunciation: z.string().optional(),
  language: z.string().optional(),
})

export const WorkItemSchema = ItemBase.extend({
  kind: z.literal('work'),
  creator: z.string().min(1),
  year: z.number().int(),
})

export const CreatorItemSchema = ItemBase.extend({
  kind: z.literal('creator'),
  year: z.number().int(), // birth
  year_end: z.number().int().optional(), // death
})

export const MovementItemSchema = ItemBase.extend({
  kind: z.literal('movement'),
  year: z.number().int(),
})

export const TermItemSchema = ItemBase.extend({
  kind: z.literal('term'),
  definition: z.string().min(1),
})

export const VenueItemSchema = ItemBase.extend({
  kind: z.literal('venue'),
  location: z.string().min(1),
  year: z.number().int().optional(),
})

export const EpisodeItemSchema = ItemBase.extend({
  kind: z.literal('episode'),
  year: z.number().int(),
  cast: z.array(z.string().min(1)).optional(),
})

export const PersonItemSchema = ItemBase.extend({
  kind: z.literal('person'),
  year: z.number().int(), // birth
  year_end: z.number().int().optional(),
  role: z.string().optional(),
})

export const ApocryphaItemSchema = ItemBase.extend({
  kind: z.literal('apocrypha'),
  claim: z.string().min(1),
  attributed_to: z.string().min(1),
  verdict: z.enum(VERDICTS),
  truth: z.string().min(1),
})

export const ItemSchema = z.discriminatedUnion('kind', [
  WorkItemSchema,
  CreatorItemSchema,
  MovementItemSchema,
  TermItemSchema,
  VenueItemSchema,
  EpisodeItemSchema,
  PersonItemSchema,
  ApocryphaItemSchema,
])

export const ItemFileSchema = z.object({
  items: z.array(ItemSchema).min(1),
})

export const REMARK_OPTION_KINDS = ['correct', 'wrong', 'gaffe'] as const
export type RemarkOptionKind = (typeof REMARK_OPTION_KINDS)[number]

export const RemarkOptionSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(REMARK_OPTION_KINDS),
  /** Shown after answering, whichever option was chosen. */
  explanation: z.string().min(1),
})

export const ScenarioSchema = z.object({
  id: z.string().regex(SCENARIO_ID_PATTERN),
  city: z.string().regex(CITY_ID_PATTERN),
  discipline: z.enum(DISCIPLINES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Where you are: "Interval, Covent Garden, Tosca." */
  setting: z.string().min(1),
  /** What is said to you. */
  prompt: z.string().min(1),
  options: z.array(RemarkOptionSchema).length(3),
  links: z.array(z.string().regex(ID_PATTERN)).min(1),
  sources: z.array(z.string().min(1)).default([]),
  reviewed_by: z.string().nullable().default(null),
})

export const ScenarioFileSchema = z.object({
  scenarios: z.array(ScenarioSchema).min(1),
})

export const CitySchema = z.object({
  id: z.string().regex(CITY_ID_PATTERN),
  name: z.string().min(1),
  order: z.number().int().min(1),
  /** One line under the city name on the Tour map. */
  blurb: z.string().min(1),
  /** Which release the city ships in. Only 'mvp' cities are built into the app today. */
  release: z.enum(['mvp', 'v2', 'v3']),
  /** Target number of new items per lesson when the build script generates lessons. */
  lesson_size: z.number().int().min(4).max(10).default(6),
})

export const CitiesFileSchema = z.object({
  cities: z.array(CitySchema).min(1),
})

export type Theme = z.infer<typeof ThemeSchema>
export type ImageMedia = z.infer<typeof ImageMediaSchema>
export type Media = z.infer<typeof MediaSchema>
export type Distractors = z.infer<typeof DistractorsSchema>
export type Item = z.infer<typeof ItemSchema>
export type WorkItem = z.infer<typeof WorkItemSchema>
export type CreatorItem = z.infer<typeof CreatorItemSchema>
export type TermItem = z.infer<typeof TermItemSchema>
export type EpisodeItem = z.infer<typeof EpisodeItemSchema>
export type PersonItem = z.infer<typeof PersonItemSchema>
export type ApocryphaItem = z.infer<typeof ApocryphaItemSchema>
export type RemarkOption = z.infer<typeof RemarkOptionSchema>
export type Scenario = z.infer<typeof ScenarioSchema>
export type City = z.infer<typeof CitySchema>
