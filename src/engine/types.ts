/**
 * Engine contracts. Every module under src/engine implements or consumes these;
 * every exercise component under src/exercises renders one of the Exercise
 * variants. Change this file deliberately: several agents build against it.
 */
import type { Item, Scenario, RemarkOption, Verdict } from '../content/types'

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export type ExerciseType =
  | 'drop-the-needle' // hear a synthesised theme, pick composer / work / era
  | 'zoom-out' // a painting revealed from brushwork outward, pick artist / title
  | 'remark' // a social situation with a graceful, a wrong and a gaffe reply
  | 'timeline' // order 3 or 4 entries chronologically
  | 'match' // pair left column to right column
  | 'lexicon' // term to definition
  | 'whos-who' // a portrait, four names
  | 'apocrypha' // attested / embellished / invented
  | 'identify' // text-only fallback choice question when an item has no media

export interface Option {
  id: string
  label: string
  sublabel?: string
}

interface ExerciseBase {
  id: string
  type: ExerciseType
  /** Every item this exercise touches; scheduler updates apply to all of them. */
  itemIds: string[]
  /** True when the exercise reviews an item the user has already met. */
  isReview: boolean
  /** 1-based position in the session. */
  slot: number
  /** The 12th slot: a hard recognition item worth bonus Prestige. */
  isFinale?: boolean
}

export type ChoiceAsk = 'creator' | 'title' | 'era' | 'term' | 'person' | 'year' | 'fact'

export interface ChoiceExercise extends ExerciseBase {
  type: 'drop-the-needle' | 'zoom-out' | 'lexicon' | 'whos-who' | 'identify'
  itemId: string
  askFor: ChoiceAsk
  /** "Who composed this?", "Whose portrait is this?", "What does sprezzatura mean?" */
  question: string
  /** Four options, already shuffled. */
  options: Option[]
  correctOptionId: string
}

export interface RemarkExercise extends ExerciseBase {
  type: 'remark'
  scenario: Scenario
  /** The scenario's three options, already shuffled. */
  options: Array<RemarkOption & { id: string }>
}

export interface TimelineEntry {
  id: string
  itemId: string
  label: string
  sublabel?: string
  year: number
}

export interface TimelineExercise extends ExerciseBase {
  type: 'timeline'
  question: string
  /** Presented order (shuffled). */
  entries: TimelineEntry[]
  /** Entry ids in chronological order. Ties are not allowed: the builder picks distinct years. */
  correctOrder: string[]
}

export interface MatchPair {
  id: string
  itemId: string
  left: string
  right: string
}

export interface MatchExercise extends ExerciseBase {
  type: 'match'
  question: string
  /** 3 or 4 pairs. The component shuffles the right column for display. */
  pairs: MatchPair[]
}

export interface ApocryphaExercise extends ExerciseBase {
  type: 'apocrypha'
  itemId: string
  claim: string
  attributedTo: string
  correctVerdict: Verdict
  truth: string
  sources: string[]
}

export type Exercise = ChoiceExercise | RemarkExercise | TimelineExercise | MatchExercise | ApocryphaExercise

// ---------------------------------------------------------------------------
// Answers and sessions
// ---------------------------------------------------------------------------

export interface Answer {
  exerciseId: string
  correct: boolean
  itemIds: string[]
  msElapsed: number
  /** Zoom Out only: fraction of the reveal still hidden when the user answered (0..1). */
  earlyFraction?: number
  /** Remark only: which kind of option was chosen. */
  remarkKind?: 'correct' | 'wrong' | 'gaffe'
  /** What the user actually chose, for the feedback panel. */
  chosen?: string | string[]
}

export interface SessionPlan {
  id: string
  cityId: string
  lessonId: string
  exercises: Exercise[]
  newItemIds: string[]
  reviewItemIds: string[]
  createdAt: number
}

export type Grade = 'first' | 'upper-second' | 'lower-second' | 'third' | 'pass'

export const GRADE_LABELS: Record<Grade, string> = {
  first: 'First',
  'upper-second': 'Upper Second',
  'lower-second': 'Lower Second',
  third: 'Third',
  pass: 'Pass',
}

export interface SessionSummary {
  sessionId: string
  cityId: string
  lessonId: string
  grade: Grade
  correct: number
  total: number
  reviewErrors: number
  prestigeEarned: number
  guineasEarned: number
  /** Items that crossed the acquisition threshold during this session. */
  acquired: string[]
  /** Rank before and after; differ when the session caused a rank-up. */
  rankBefore: RankLevel
  rankAfter: RankLevel
  standing: number
  lessonCompleted: boolean
  cityCompleted: boolean
  completedAt: number
}

// ---------------------------------------------------------------------------
// Scheduler (spaced repetition)
// ---------------------------------------------------------------------------

export interface CardState {
  itemId: string
  /** Epoch ms when the card is next due. */
  due: number
  stability: number
  difficulty: number
  reps: number
  lapses: number
  /** ts-fsrs State enum value: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state: number
  lastReview?: number
  /** Distinct local days (YYYY-MM-DD) on which the item was answered correctly. */
  correctDays: string[]
  /** True once the item is in the Collection. Never reverts. */
  acquired: boolean
  acquiredAt?: number
  /** Serialised ts-fsrs card for exact round-tripping. */
  fsrs?: unknown
}

export interface Scheduler {
  newCard(itemId: string, now: Date): CardState
  /** Apply one answer. Returns the updated card; must not mutate the input. */
  review(card: CardState, correct: boolean, now: Date): CardState
  isDue(card: CardState, now: Date): boolean
  /** Predicted probability of recall at `now` (0..1). */
  retrievability(card: CardState, now: Date): number
}

/**
 * Acquisition rule: an item enters the Collection when it has been answered
 * correctly on at least ACQUIRE_MIN_DAYS distinct days and its FSRS stability
 * is at least ACQUIRE_MIN_STABILITY_DAYS.
 */
export const ACQUIRE_MIN_DAYS = 3
export const ACQUIRE_MIN_STABILITY_DAYS = 7

// ---------------------------------------------------------------------------
// Ranks and profile
// ---------------------------------------------------------------------------

export type RankLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type TitleStyle = 'masculine' | 'feminine' | 'plain'

export interface RankDefinition {
  level: RankLevel
  names: Record<TitleStyle, string>
  /** Items acquired required. */
  items: number
  /** Cities completed required. */
  cities: number
  /** True for ranks that are peers; the first five are not. */
  peer: boolean
}

export interface Profile {
  id: 'me'
  createdAt: number
  titleStyle: TitleStyle
  displayName: string
  prestige: number
  guineas: number
  /** Consecutive days with a completed session. */
  standing: number
  /** Local day (YYYY-MM-DD) of the last completed session. */
  lastSessionDay: string | null
  /** Country Weekends (streak freezes) remaining this calendar month. */
  countryWeekendsLeft: number
  countryWeekendMonth: string | null // YYYY-MM
  currentCityId: string
  /** Next lesson order (1-based) per city; a city is complete when this exceeds its lesson count. */
  lessonProgress: Record<string, number>
  completedCities: string[]
  /** Cosmetic furnishings bought with Guineas. */
  furnishings: string[]
  /** Sessions completed, all time. Rank 2 needs one. */
  sessionsCompleted: number
  /** Audio on/off for Drop the Needle. */
  soundEnabled: boolean
}

export interface SessionRecord {
  id?: number
  sessionId: string
  cityId: string
  lessonId: string
  startedAt: number
  completedAt: number | null
  summary: SessionSummary | null
  answers: Answer[]
}

// ---------------------------------------------------------------------------
// Utilities shared across modules
// ---------------------------------------------------------------------------

/** Local calendar day as YYYY-MM-DD. */
export function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Deterministic PRNG so sessions and tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Type guard helpers. */
export function isChoice(e: Exercise): e is ChoiceExercise {
  return e.type === 'drop-the-needle' || e.type === 'zoom-out' || e.type === 'lexicon' || e.type === 'whos-who' || e.type === 'identify'
}

export type ItemLookup = (id: string) => Item | undefined
