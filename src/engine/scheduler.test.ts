import { describe, expect, it } from 'vitest'
import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs'
import { createScheduler, shouldAcquire } from './scheduler'
import { ACQUIRE_MIN_DAYS, ACQUIRE_MIN_STABILITY_DAYS, localDay, type CardState } from './types'

/** Local-time date so localDay() is stable whatever the sandbox timezone. */
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0, 0)

const DAY1 = at(2026, 1, 5)
const DAY2 = at(2026, 1, 6)
const DAY3 = at(2026, 1, 13)
const ITEM = 'music.synthetic.fixture'

function deepFreeze<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v)
    for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k])
  }
  return v
}

/** Three correct answers on three distinct days, returning every intermediate card. */
function learnOverThreeDays() {
  const s = createScheduler()
  const c0 = s.newCard(ITEM, DAY1)
  const c1 = s.review(c0, true, DAY1)
  const c2 = s.review(c1, true, DAY2)
  const c3 = s.review(c2, true, DAY3)
  return { s, c0, c1, c2, c3 }
}

describe('createScheduler().newCard', () => {
  it('creates a new card that is due immediately', () => {
    const s = createScheduler()
    const card = s.newCard(ITEM, DAY1)
    expect(card.itemId).toBe(ITEM)
    expect(card.due).toBe(DAY1.getTime())
    expect(card.state).toBe(State.New)
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.stability).toBe(0)
    expect(card.correctDays).toEqual([])
    expect(card.acquired).toBe(false)
    expect(card.acquiredAt).toBeUndefined()
    expect(card.lastReview).toBeUndefined()
    expect(card.fsrs).toBeDefined()
    expect(s.isDue(card, DAY1)).toBe(true)
    expect(s.isDue(card, new Date(DAY1.getTime() - 1))).toBe(false)
  })

  it('keeps a JSON-safe ts-fsrs card in card.fsrs', () => {
    const card = createScheduler().newCard(ITEM, DAY1)
    expect(card.fsrs).toEqual({
      due: DAY1.getTime(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      last_review: null,
    })
  })
})

describe('createScheduler().review', () => {
  it('does not mutate its input', () => {
    const s = createScheduler()
    const card = deepFreeze(s.newCard(ITEM, DAY1))
    const snapshot = JSON.stringify(card)
    const next = s.review(card, true, DAY1)
    expect(JSON.stringify(card)).toBe(snapshot)
    expect(next).not.toBe(card)
    expect(next.correctDays).not.toBe(card.correctDays)
    expect(next.fsrs).not.toBe(card.fsrs)

    const frozenNext = deepFreeze(next)
    const snapshot2 = JSON.stringify(frozenNext)
    s.review(frozenNext, false, DAY2)
    expect(JSON.stringify(frozenNext)).toBe(snapshot2)
  })

  it('maps correct to Rating.Good and wrong to Rating.Again', () => {
    const s = createScheduler()
    const reference = fsrs({ enable_fuzz: false })
    const empty = createEmptyCard(DAY1)
    const good = reference.next(empty, DAY1, Rating.Good).card
    const again = reference.next(empty, DAY1, Rating.Again).card

    const card = s.newCard(ITEM, DAY1)
    const right = s.review(card, true, DAY1)
    const wrong = s.review(card, false, DAY1)

    expect(right.due).toBe(good.due.getTime())
    expect(right.stability).toBe(good.stability)
    expect(right.difficulty).toBe(good.difficulty)
    expect(right.state).toBe(good.state)
    expect(wrong.due).toBe(again.due.getTime())
    expect(wrong.stability).toBe(again.stability)
    expect(wrong.difficulty).toBe(again.difficulty)
    expect(wrong.state).toBe(again.state)
  })

  it('schedules a wrong answer sooner than a right one', () => {
    const s = createScheduler()
    const card = s.newCard(ITEM, DAY1)
    const right = s.review(card, true, DAY1)
    const wrong = s.review(card, false, DAY1)
    expect(right.due).toBeGreaterThan(DAY1.getTime())
    expect(wrong.due).toBeGreaterThan(DAY1.getTime())
    expect(wrong.due).toBeLessThan(right.due)
    expect(wrong.stability).toBeLessThan(right.stability)

    // Same ordering once the card is in review.
    const { c3 } = learnOverThreeDays()
    const later = at(2026, 2, 20)
    const rightLater = s.review(c3, true, later)
    const wrongLater = s.review(c3, false, later)
    expect(wrongLater.due).toBeLessThan(rightLater.due)
  })

  it('records reps, lapses, state and lastReview from ts-fsrs', () => {
    const { c1, c3, s } = learnOverThreeDays()
    expect(c1.reps).toBe(1)
    expect(c1.state).toBe(State.Learning)
    expect(c1.lastReview).toBe(DAY1.getTime())
    expect(c3.reps).toBe(3)
    expect(c3.state).toBe(State.Review)
    expect(c3.lastReview).toBe(DAY3.getTime())
    expect(c3.lapses).toBe(0)

    const lapsed = s.review(c3, false, at(2026, 2, 1))
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.state).toBe(State.Relearning)
    expect(lapsed.stability).toBeLessThan(c3.stability)
  })

  it('records distinct local correct days, and only for correct answers', () => {
    const s = createScheduler()
    let card = s.newCard(ITEM, DAY1)
    card = s.review(card, false, DAY1)
    expect(card.correctDays).toEqual([])

    card = s.review(card, true, DAY1)
    card = s.review(card, true, at(2026, 1, 5, 9, 15))
    card = s.review(card, true, at(2026, 1, 5, 23, 59))
    expect(card.correctDays).toEqual([localDay(DAY1)])

    card = s.review(card, false, DAY2)
    expect(card.correctDays).toEqual([localDay(DAY1)])

    card = s.review(card, true, DAY2)
    card = s.review(card, true, DAY3)
    expect(card.correctDays).toEqual([localDay(DAY1), localDay(DAY2), localDay(DAY3)])
  })

  it('tolerates a card written without correctDays or fsrs', () => {
    const s = createScheduler()
    const bare = {
      itemId: ITEM,
      due: DAY1.getTime(),
      stability: 0,
      difficulty: 0,
      reps: 0,
      lapses: 0,
      state: State.New,
      acquired: false,
    } as unknown as CardState
    const next = s.review(bare, true, DAY1)
    expect(next.correctDays).toEqual([localDay(DAY1)])
    expect(next.due).toBeGreaterThan(DAY1.getTime())
    expect(next.state).toBe(State.Learning)
    expect(next.fsrs).toBeDefined()
    expect(s.retrievability(next, DAY2)).toBeGreaterThan(0)
  })
})

describe('acquisition', () => {
  it('acquires after three correct answers on three distinct days with stability >= 7', () => {
    const { c1, c2, c3 } = learnOverThreeDays()

    expect(c1.acquired).toBe(false)
    // Two days may already give the stability, but not the days.
    expect(c2.correctDays).toHaveLength(2)
    expect(c2.acquired).toBe(false)
    expect(shouldAcquire(c2)).toBe(false)

    expect(c3.correctDays).toHaveLength(ACQUIRE_MIN_DAYS)
    expect(c3.stability).toBeGreaterThanOrEqual(ACQUIRE_MIN_STABILITY_DAYS)
    expect(shouldAcquire(c3)).toBe(true)
    expect(c3.acquired).toBe(true)
    expect(c3.acquiredAt).toBe(DAY3.getTime())
  })

  it('does not acquire on three correct answers within a single day', () => {
    const s = createScheduler()
    let card = s.newCard(ITEM, DAY1)
    card = s.review(card, true, DAY1)
    card = s.review(card, true, at(2026, 1, 5, 9, 12))
    card = s.review(card, true, at(2026, 1, 5, 18, 0))
    card = s.review(card, true, at(2026, 1, 5, 22, 0))
    expect(card.correctDays).toHaveLength(1)
    expect(card.acquired).toBe(false)
    expect(shouldAcquire(card)).toBe(false)
  })

  it('never reverts once acquired, even after a lapse', () => {
    const { s, c3 } = learnOverThreeDays()
    const lapsed = s.review(c3, false, at(2026, 2, 1))
    expect(lapsed.acquired).toBe(true)
    expect(lapsed.acquiredAt).toBe(c3.acquiredAt)

    const lapsedAgain = s.review(lapsed, false, at(2026, 2, 1, 9, 10))
    expect(lapsedAgain.acquired).toBe(true)
    expect(lapsedAgain.acquiredAt).toBe(c3.acquiredAt)

    // acquiredAt is fixed at the moment of acquisition, not moved by later successes.
    const recovered = s.review(lapsedAgain, true, at(2026, 2, 2))
    expect(recovered.acquired).toBe(true)
    expect(recovered.acquiredAt).toBe(DAY3.getTime())
  })

  it('shouldAcquire is a pure threshold on distinct days and stability', () => {
    const base: CardState = {
      itemId: ITEM,
      due: 0,
      stability: ACQUIRE_MIN_STABILITY_DAYS,
      difficulty: 5,
      reps: 3,
      lapses: 0,
      state: State.Review,
      correctDays: ['2026-01-05', '2026-01-06', '2026-01-13'],
      acquired: false,
    }
    expect(shouldAcquire(base)).toBe(true)
    expect(shouldAcquire({ ...base, stability: ACQUIRE_MIN_STABILITY_DAYS - 0.001 })).toBe(false)
    expect(shouldAcquire({ ...base, correctDays: ['2026-01-05', '2026-01-06'] })).toBe(false)
    expect(shouldAcquire({ ...base, correctDays: ['2026-01-05', '2026-01-05', '2026-01-05'] })).toBe(false)
    expect(shouldAcquire({ ...base, correctDays: [] })).toBe(false)
    expect(shouldAcquire({ ...base, stability: 30, correctDays: [...base.correctDays, '2026-02-01'] })).toBe(true)
  })
})

describe('isDue and retrievability', () => {
  it('isDue compares card.due to now', () => {
    const { s, c3 } = learnOverThreeDays()
    expect(c3.due).toBeGreaterThan(DAY3.getTime())
    expect(s.isDue(c3, DAY3)).toBe(false)
    expect(s.isDue(c3, new Date(c3.due - 1))).toBe(false)
    expect(s.isDue(c3, new Date(c3.due))).toBe(true)
    expect(s.isDue(c3, new Date(c3.due + 1))).toBe(true)
  })

  it('retrievability is 0..1, 0 for a new card, and decays with time', () => {
    const { s, c0, c3 } = learnOverThreeDays()
    expect(s.retrievability(c0, DAY1)).toBe(0)

    const r0 = s.retrievability(c3, DAY3)
    const r1 = s.retrievability(c3, at(2026, 1, 20))
    const r2 = s.retrievability(c3, at(2026, 3, 1))
    const r3 = s.retrievability(c3, at(2027, 1, 1))
    for (const r of [r0, r1, r2, r3]) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
    expect(r0).toBeGreaterThan(0.99)
    expect(r1).toBeLessThan(r0)
    expect(r2).toBeLessThan(r1)
    expect(r3).toBeLessThan(r2)
  })
})

describe('serialisation', () => {
  it('a new card survives JSON.parse(JSON.stringify(card))', () => {
    const s = createScheduler()
    const card = s.newCard(ITEM, DAY1)
    const back = JSON.parse(JSON.stringify(card)) as CardState
    expect(back).toEqual(card)
    expect(s.review(back, true, DAY1)).toEqual(s.review(card, true, DAY1))
  })

  it('a reviewed card survives JSON.parse(JSON.stringify(card)) exactly', () => {
    const { s, c2, c3 } = learnOverThreeDays()
    for (const card of [c2, c3]) {
      const back = JSON.parse(JSON.stringify(card)) as CardState
      expect(back).toEqual(card)
      expect(back.fsrs).toEqual(card.fsrs)

      const later = at(2026, 2, 20)
      expect(s.review(back, true, later)).toEqual(s.review(card, true, later))
      expect(s.review(back, false, later)).toEqual(s.review(card, false, later))
      expect(s.retrievability(back, later)).toBe(s.retrievability(card, later))
      expect(s.isDue(back, later)).toBe(s.isDue(card, later))
    }
  })

  it('a card that round-trips repeatedly schedules the same as one that never did', () => {
    const s = createScheduler()
    let live = s.newCard(ITEM, DAY1)
    let stored = JSON.parse(JSON.stringify(live)) as CardState
    const steps: Array<[Date, boolean]> = [
      [DAY1, true],
      [DAY2, true],
      [at(2026, 1, 9), false],
      [at(2026, 1, 9, 9, 12), true],
      [DAY3, true],
      [at(2026, 2, 3), true],
    ]
    for (const [now, correct] of steps) {
      live = s.review(live, correct, now)
      stored = JSON.parse(JSON.stringify(s.review(stored, correct, now))) as CardState
      expect(stored).toEqual(live)
    }
  })
})
