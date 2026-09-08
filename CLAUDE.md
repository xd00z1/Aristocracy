# Aristocracy: rules for anyone (human or agent) working in this repo

A daily five-minute trainer for cultural fluency (classical music, opera, art, history), structured as a game with an aristocratic frame. Read `docs/OUTLINE.md` for the product and `docs/HISTORY.md` for the history curriculum. This file is the engineering and content rulebook.

## Commands

| Command | What it does |
|---|---|
| `npm run validate` | Validate every file in `content/` (schema + cross-item rules). Zero errors required. Warnings are advice. |
| `npm run content` | Validate, generate lessons and the media index, write `src/content/generated/content.json`. Run after any content change. |
| `npm run typecheck` | `tsc --noEmit` over src, scripts, e2e. |
| `npm test` | Vitest (jsdom, fake-indexeddb preloaded). |
| `npm run build` | content + typecheck + Vite production build (PWA). |
| `npm run e2e` | Playwright against `vite preview` on port 4173. Set `CHROMIUM_PATH=/opt/pw-browsers/chromium` in this sandbox. |
| `npm run media` | Download public-domain images from Wikimedia Commons (works only outside the sandbox). |

Never run `npm install`, never edit `package.json`, never commit or push unless you are the session owner. Node 22, Vite 8, React 19, Tailwind 4, Zod 4, Dexie 4, ts-fsrs 5.

## Layout and ownership

```
content/            YAML content: cities.yaml, items/<discipline>/<city>.yaml, scenarios/<city>.yaml
scripts/            validate-content.ts, build-content.ts (lib/content.ts), fetch-media.mjs, make-icons.mjs
src/content/        schema.ts (Zod, the source of truth), types.ts, index.ts (runtime loader), generated/content.json
src/engine/         types.ts (contracts), scheduler.ts, session.ts, distractors.ts, grading.ts, ranks.ts, progress.ts
src/store/          db.ts (Dexie)
src/audio/          theme.ts (notation parser), synth.ts (Web Audio), useThemePlayer.ts
src/exercises/      types.ts (component contract), index.ts (registry), one component per exercise type
src/ui/             design-system primitives (Button, Card, Meter, Feedback, Fleuron, ...)
src/app/            App.tsx (routes) and screens: Today, Session, Estate, Tour, Collection, Settings
e2e/                Playwright specs
public/media/img/   fetched images (gitignored); credits.json written by fetch-media
```

When several agents work at once, each writes only inside the paths it was assigned. Shared contracts live in `src/engine/types.ts`, `src/exercises/types.ts`, `src/content/schema.ts`, `src/content/types.ts`, and `src/content/index.ts`. Do not change a contract to suit your module; if a contract is wrong, say so in your report and code to it as written.

## Module APIs (build to these signatures)

```ts
// src/engine/scheduler.ts (ts-fsrs)
export function createScheduler(): Scheduler            // see Scheduler in engine/types.ts
export function shouldAcquire(card: CardState): boolean // ACQUIRE_MIN_DAYS distinct correct days AND stability >= ACQUIRE_MIN_STABILITY_DAYS
// correct answer -> Rating.Good, wrong -> Rating.Again; keep the serialised ts-fsrs card in card.fsrs

// src/engine/session.ts
export interface BuildSessionInput { profile: Profile; cards: Map<string, CardState>; now: Date; seed?: number; attempt?: number }
export function buildSession(input: BuildSessionInput): SessionPlan
// src/engine/distractors.ts
export function optionsFor(item: Item, askFor: ChoiceAsk, pool: Item[], rand: () => number): { options: Option[]; correctOptionId: string }
export function redactNames(text: string, names: string[]): string

// src/engine/grading.ts
export function gradeSession(plan: SessionPlan, answers: Answer[]): { grade: Grade; correct: number; total: number; reviewErrors: number }
export function prestigeFor(plan: SessionPlan, answers: Answer[], grade: Grade): number
export function guineasFor(plan: SessionPlan, answers: Answer[], grade: Grade): number

// src/engine/ranks.ts
export const RANKS: RankDefinition[]                                   // 10 entries, level 1..10
export function rankFor(stats: { acquired: number; cities: number; sessions: number }): RankDefinition
export function rankName(rank: RankDefinition, style: TitleStyle): string
export function nextRank(level: RankLevel): RankDefinition | null

// src/engine/progress.ts (Dexie-backed; all async)
export async function loadProfile(): Promise<Profile>                  // creates the default profile on first run
export async function saveProfile(p: Profile): Promise<Profile>
export async function loadCards(): Promise<Map<string, CardState>>
export async function startSession(now?: Date): Promise<SessionPlan>   // builds the plan, writes a SessionRecord
export async function recordAnswer(plan: SessionPlan, answer: Answer, now?: Date): Promise<void>   // updates cards at once
export async function completeSession(plan: SessionPlan, answers: Answer[], now?: Date): Promise<SessionSummary>
export async function dueCount(now?: Date): Promise<number>
export async function collection(): Promise<CardState[]>              // acquired cards
export async function estateProgress(): Promise<Record<Discipline, { acquired: number; total: number }>>
export async function buyFurnishing(id: string, price: number): Promise<Profile>   // throws if too poor
export async function resetAll(): Promise<void>

// src/store/db.ts
export class AristocracyDB extends Dexie { cards: Table<CardState, string>; profile: Table<Profile, string>; sessions: Table<SessionRecord, number> }
export const db: AristocracyDB

// src/audio/theme.ts
export interface ParsedNote { midi: number | null; beats: number; startSeconds: number; seconds: number }
export function parseTheme(theme: Theme): { notes: ParsedNote[]; durationSeconds: number }   // throws on a bad token
export function midiToFrequency(midi: number): number
// src/audio/synth.ts
export interface ThemePlayback { stop(): void; done: Promise<void>; durationSeconds: number }
export function ensureAudioContext(): AudioContext                      // singleton; call from a user gesture
export function playTheme(theme: Theme, opts?: { context?: AudioContext; gain?: number }): ThemePlayback
// src/audio/useThemePlayer.ts
export function useThemePlayer(theme: Theme | undefined, enabled: boolean): { play(): void; stop(): void; playing: boolean; progress: number; durationSeconds: number }

// src/exercises/index.ts
export const EXERCISE_COMPONENTS: Record<ExerciseType, ExerciseComponent<any>>
```

## Session rules (the engine implements these exactly)

Twelve slots, about five minutes.

| Slot | Content |
|---|---|
| 1 to 3 | Review: due cards (`isDue`) sorted by due date. If fewer than three are due, fill with new items from the lesson. |
| 4 to 9 | New items from the current lesson, in lesson order. If the lesson has fewer than six, fill from earlier lessons in the same city. |
| 10 | The Remark: one scenario from the lesson's `scenarioIds` (rotate by seed). If none, another item exercise. |
| 11 | Timeline on even seeds, Match on odd seeds. Timeline: four items with distinct years from today's items plus the city's acquired items. Match: four works, title to creator. Fall back to an item exercise if not enough material. |
| 12 | Finale: the hardest unused item in the city as a choice exercise, `isFinale: true`. |

Exercise type per item: `apocrypha` kind → apocrypha; `term` → lexicon (askFor `term`, options are definitions); music or opera `work` with a theme → drop-the-needle (askFor alternates creator / title by seed); art `work` with an image on disk → zoom-out (askFor creator); `person` with an image → whos-who (options are names); otherwise → identify, a text-only choice: works ask for the creator ("Who composed…?" / "Who painted…?"); persons and creators show a name-redacted clue built from `facts` and ask who; episodes ask for the year; venues and movements show a redacted clue and ask for the title. Distractors come from `item.distractors[askFor]` first, then from other items of the same discipline and kind, never duplicating the correct answer. Options are always four (three for verdicts), shuffled with the session's seeded PRNG (`mulberry32(hashString(sessionId))`). Session id: `${localDay}-${lessonId}-${attempt}`.

Sessions are always completable: never block on media. Missing images degrade to identify; missing themes degrade to identify. `soundEnabled: false` still allows drop-the-needle to be answered (it becomes identify-like with a notice).

## Grading, meters, streaks, ranks

- Errors = wrong answers. `reviewErrors` = wrong answers on `isReview` exercises.
- Grade: First if reviewErrors = 0 and errors ≤ 1; Upper Second if errors ≤ 2; Lower Second if ≤ 4; Third if ≤ 6; else Pass.
- Prestige: +10 per correct; a correct finale is +15 instead; zoom-out adds `round(earlyFraction × 10)`; a correct Remark adds +5; grade bonus First +25, Upper Second +15, Lower Second +5.
- Guineas: 5 per completed session, +1 per correct, +10 for a First, +5 for an Upper Second.
- Standing (streak), evaluated on completion with local days: same day → unchanged; previous day → +1; gap of exactly one missed day with a Country Weekend left → spend it, +1; otherwise → 1. Two Country Weekends per calendar month (`countryWeekendsLeft`, reset when `countryWeekendMonth` changes).
- Lesson progress: completing the current lesson advances `lessonProgress[cityId]`; past the last lesson, the city joins `completedCities` and `currentCityId` moves to the next `release: mvp` city (stays on the last if none).
- Acquisition: `shouldAcquire` after every answer; newly acquired ids go in `SessionSummary.acquired`. Acquired never reverts.
- Ranks (items acquired / cities completed): 1 Commoner 0; 2 Gentleman–Gentlewoman–Gentle (first completed session); 3 Esquire 25; 4 Knight–Dame–Knight 60 + 1 city; 5 Baronet 120; 6 Baron–Baroness–Baron 200 + 2 cities; 7 Viscount–Viscountess–Viscount 320; 8 Earl–Countess–Earl 480 + 4 cities; 9 Marquess–Marchioness–Marquess 700; 10 Duke–Duchess–Duke 1000 + 4 cities. The first five are not peers (`peer: false`); the plain style uses the bare rank word.

## Design rules (UI)

Restraint is the aesthetic. Ivory ground, ink text, oxblood for emphasis and errors, gilt for reward (tokens in `src/index.css`: `bg-ivory`, `text-ink`, `text-ink-soft`, `text-ink-mute`, `border-rule`, `text-oxblood`, `bg-oxblood`, `text-gilt`, `bg-parchment`, `font-serif`, `font-sans`, `shadow-card`, `rounded-card`). Serif for everything except tiny UI labels. No confetti, no mascots, no fire emoji, no pure white, no saturated green. Celebration is a single fleuron rule (`.rule-fleuron`) and small caps (`.smallcaps`). Copy is dry and never mocks the user for not knowing. Every screen must work at 360 px wide and be usable with a thumb; tap targets at least 44 px. Every interactive element is a real `<button>` with a visible focus ring. No drag-and-drop libraries: Timeline is tap-to-order, Match is tap-left-then-right.

`data-testid` attributes are part of the contract (Playwright depends on them): `begin-session`, `exercise-<type>` on each exercise root, `option-<optionId>` on choice and remark options, `play-theme`, `timeline-entry-<entryId>`, `timeline-reset`, `timeline-submit`, `match-left-<pairId>`, `match-right-<pairId>`, `apocrypha-<verdict>`, `feedback`, `continue`, `session-summary`, `nav-today`, `nav-estate`, `nav-tour`, `nav-collection`, `nav-settings`.

## Content rules

Every item needs a `remark` (one sayable, defensible sentence), a `gaffe` (what exposes you), at least one `fact`, at least one `source`, a `city`, a `difficulty` (1 easy, 2 standard, 3 hard) and an `era`. History items must `link` to at least one item in another discipline. Facts must be verifiable against a standard reference; if you cannot source it, leave it out. Do not invent quotations, dates or attributions. `reviewed_by` stays `null` until a human signs off. Ids: `discipline.slug.parts` with lowercase letters, digits, dots and hyphens.

Theme notation (`theme.notes`) for Drop the Needle: tokens `<pitch>/<value>` or `R/<value>`; pitch is scientific (C4 = middle C), accidentals `#` and `b`; values 1, 2, 4, 8, 16, 32, optionally dotted (`4.`); `|` bar lines are ignored; `tempo` is quarter-note beats per minute. Write only the opening phrase (4 to 16 bars, 8 to 40 notes), only for melodies you are certain of, at concert pitch, melody line only.

Images: give `media.image.commons` as a Wikimedia Commons file title for a public-domain file; `scripts/fetch-media.mjs` checks the licence and downloads it. Never point at a file you are not sure is public domain or CC0.

Distractors must be plausible and wrong: three other composers of the same era, not three random names. Never include the correct answer among them (the validator checks).

## Testing rules

Vitest for logic (scheduler, session builder, grading, ranks, progress, theme parser) and testing-library for components. Tests must be deterministic: pass `now` and `seed` explicitly, never read the clock. `fake-indexeddb/auto` is preloaded; create a fresh Dexie database name per test file or `resetAll()` in `beforeEach`. Playwright e2e lives in `e2e/` and drives a full 12-exercise session using the `data-testid`s above.
