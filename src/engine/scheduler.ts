/**
 * Spaced-repetition scheduler on ts-fsrs 5 (FSRS-6 parameters).
 *
 * Every item is one CardState. The authoritative memory state is the ts-fsrs
 * card, kept serialised (epoch-ms dates, numeric state) in `card.fsrs` so a
 * round trip through JSON or IndexedDB reproduces the exact same scheduling.
 * The flat fields on CardState (due, stability, ...) mirror it for querying.
 *
 * Rating policy: a correct answer is Rating.Good, a wrong one Rating.Again.
 * Fuzz is disabled so identical inputs always schedule identically.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type CardInput } from 'ts-fsrs'
import { ACQUIRE_MIN_DAYS, ACQUIRE_MIN_STABILITY_DAYS, localDay, type CardState, type Scheduler } from './types'

/** Shape stored in `CardState.fsrs`: a ts-fsrs Card with JSON-safe dates. */
export interface SerialisedFsrsCard {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: number | null
}

function serialise(card: Card): SerialisedFsrsCard {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.getTime() : null,
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isSerialisedFsrsCard(v: unknown): v is SerialisedFsrsCard {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    isFiniteNumber(c.due) &&
    isFiniteNumber(c.stability) &&
    isFiniteNumber(c.difficulty) &&
    isFiniteNumber(c.reps) &&
    isFiniteNumber(c.lapses) &&
    isFiniteNumber(c.state) &&
    (c.last_review === null || c.last_review === undefined || isFiniteNumber(c.last_review))
  )
}

/**
 * Fresh ts-fsrs input for a CardState. Prefers the serialised card in
 * `card.fsrs`; falls back to the flat fields for cards written without it.
 * Always returns a new object so ts-fsrs can never touch the caller's state.
 */
function toFsrsInput(card: CardState): CardInput {
  if (isSerialisedFsrsCard(card.fsrs)) {
    const s = card.fsrs
    return {
      due: s.due,
      stability: s.stability,
      difficulty: s.difficulty,
      elapsed_days: isFiniteNumber(s.elapsed_days) ? s.elapsed_days : 0,
      scheduled_days: isFiniteNumber(s.scheduled_days) ? s.scheduled_days : 0,
      learning_steps: isFiniteNumber(s.learning_steps) ? s.learning_steps : 0,
      reps: s.reps,
      lapses: s.lapses,
      state: s.state as State,
      last_review: s.last_review ?? null,
    }
  }
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReview ?? null,
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * Acquisition threshold: answered correctly on at least ACQUIRE_MIN_DAYS
 * distinct local days AND FSRS stability of at least ACQUIRE_MIN_STABILITY_DAYS.
 * Pure rule on the card's current numbers; the persisted `card.acquired` flag
 * (set by `review`) is what never reverts.
 */
export function shouldAcquire(card: CardState): boolean {
  const distinctDays = new Set(card.correctDays ?? []).size
  return distinctDays >= ACQUIRE_MIN_DAYS && card.stability >= ACQUIRE_MIN_STABILITY_DAYS
}

export function createScheduler(): Scheduler {
  const f = fsrs({ enable_fuzz: false })

  function build(itemId: string, fsrsCard: Card, extra: Pick<CardState, 'correctDays' | 'acquired' | 'acquiredAt'>): CardState {
    const next: CardState = {
      itemId,
      due: fsrsCard.due.getTime(),
      stability: fsrsCard.stability,
      difficulty: fsrsCard.difficulty,
      reps: fsrsCard.reps,
      lapses: fsrsCard.lapses,
      state: fsrsCard.state,
      correctDays: extra.correctDays,
      acquired: extra.acquired,
      fsrs: serialise(fsrsCard),
    }
    if (fsrsCard.last_review) next.lastReview = fsrsCard.last_review.getTime()
    if (extra.acquiredAt !== undefined) next.acquiredAt = extra.acquiredAt
    return next
  }

  return {
    newCard(itemId, now) {
      const empty = createEmptyCard(now)
      return build(itemId, empty, { correctDays: [], acquired: false })
    },

    review(card, correct, now) {
      const grade = correct ? Rating.Good : Rating.Again
      const { card: scheduled } = f.next(toFsrsInput(card), now, grade)

      const correctDays = [...(card.correctDays ?? [])]
      if (correct) {
        const day = localDay(now)
        if (!correctDays.includes(day)) correctDays.push(day)
      }

      const candidate = build(card.itemId, scheduled, {
        correctDays,
        acquired: card.acquired,
        acquiredAt: card.acquiredAt,
      })

      if (!card.acquired && shouldAcquire(candidate)) {
        candidate.acquired = true
        candidate.acquiredAt = now.getTime()
      }
      return candidate
    },

    isDue(card, now) {
      return card.due <= now.getTime()
    },

    retrievability(card, now) {
      if (card.state === State.New) return 0
      return clamp01(f.get_retrievability(toFsrsInput(card), now, false))
    },
  }
}
