import { describe, expect, it } from 'vitest'
import { GUINEAS, PRESTIGE, gradeFor, gradeSession, guineasFor, prestigeFor } from './grading'
import type { Answer, Exercise, ExerciseType, Grade, SessionPlan } from './types'

// ---------------------------------------------------------------------------
// Synthetic plans. Grading reads only id, type, isReview and isFinale, so the
// exercises are minimal shapes cast to the union.
// ---------------------------------------------------------------------------

interface Spec {
  type?: ExerciseType
  isReview?: boolean
  isFinale?: boolean
}

function exercise(slot: number, spec: Spec): Exercise {
  const type = spec.type ?? 'identify'
  const base = {
    id: `s.${slot}`,
    type,
    itemIds: [`item.${slot}`],
    isReview: spec.isReview ?? false,
    slot,
    ...(spec.isFinale ? { isFinale: true } : {}),
  }
  if (type === 'remark') return { ...base, scenario: {}, options: [] } as unknown as Exercise
  if (type === 'timeline') return { ...base, question: '', entries: [], correctOrder: [] } as unknown as Exercise
  if (type === 'match') return { ...base, question: '', pairs: [] } as unknown as Exercise
  if (type === 'apocrypha') {
    return { ...base, itemId: base.itemIds[0], claim: '', attributedTo: '', correctVerdict: 'attested', truth: '', sources: [] } as unknown as Exercise
  }
  return { ...base, itemId: base.itemIds[0], askFor: 'creator', question: '', options: [], correctOptionId: 'a' } as unknown as Exercise
}

/** The canonical twelve: 1-3 review, 4-9 new, 10 Remark, 11 Timeline, 12 finale. */
function plan(overrides: Partial<Record<number, Spec>> = {}): SessionPlan {
  const specs: Record<number, Spec> = {
    1: { isReview: true },
    2: { isReview: true },
    3: { isReview: true },
    4: {},
    5: {},
    6: {},
    7: {},
    8: {},
    9: {},
    10: { type: 'remark' },
    11: { type: 'timeline' },
    12: { isFinale: true },
  }
  const exercises = Array.from({ length: 12 }, (_, i) => exercise(i + 1, { ...specs[i + 1], ...overrides[i + 1] }))
  return {
    id: '2026-01-05-city.1-1',
    cityId: 'city',
    lessonId: 'city.1',
    exercises,
    newItemIds: exercises.slice(3).map((e) => e.itemIds[0]),
    reviewItemIds: exercises.slice(0, 3).map((e) => e.itemIds[0]),
    createdAt: 0,
  }
}

/** One answer per exercise; the listed slots are wrong; extras patch individual answers. */
function answers(p: SessionPlan, wrongSlots: number[] = [], extras: Partial<Record<number, Partial<Answer>>> = {}): Answer[] {
  return p.exercises.map((e) => ({
    exerciseId: e.id,
    correct: !wrongSlots.includes(e.slot),
    itemIds: e.itemIds,
    msElapsed: 1000,
    ...extras[e.slot],
  }))
}

// ---------------------------------------------------------------------------

describe('gradeFor', () => {
  it.each([
    [0, 0, 'first'],
    [1, 0, 'first'],
    [1, 1, 'upper-second'],
    [2, 0, 'upper-second'],
    [2, 2, 'upper-second'],
    [3, 0, 'lower-second'],
    [4, 3, 'lower-second'],
    [5, 0, 'third'],
    [6, 6, 'third'],
    [7, 0, 'pass'],
    [12, 3, 'pass'],
  ] as Array<[number, number, Grade]>)('%i errors with %i review errors is a %s', (errors, reviewErrors, grade) => {
    expect(gradeFor(errors, reviewErrors)).toBe(grade)
  })
})

describe('gradeSession', () => {
  it('a clean sheet is a First', () => {
    const p = plan()
    expect(gradeSession(p, answers(p))).toEqual({ grade: 'first', correct: 12, total: 12, reviewErrors: 0 })
  })

  it.each([
    [[4], 'first', 0],
    [[12], 'first', 0],
    [[1], 'upper-second', 1], // one review error forfeits the First
    [[4, 5], 'upper-second', 0],
    [[1, 2], 'upper-second', 2],
    [[4, 5, 6], 'lower-second', 0],
    [[1, 4, 5, 6], 'lower-second', 1],
    [[4, 5, 6, 7, 8], 'third', 0],
    [[1, 2, 3, 4, 5, 6], 'third', 3],
    [[1, 2, 3, 4, 5, 6, 7], 'pass', 3],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'pass', 3],
  ] as Array<[number[], Grade, number]>)('wrong at slots %j is %s with %i review errors', (wrong, grade, reviewErrors) => {
    const p = plan()
    const result = gradeSession(p, answers(p, wrong))
    expect(result.grade).toBe(grade)
    expect(result.reviewErrors).toBe(reviewErrors)
    expect(result.correct).toBe(12 - wrong.length)
    expect(result.total).toBe(12)
  })

  it('an unanswered exercise is neither correct nor wrong but still counts in total', () => {
    const p = plan()
    const partial = answers(p).filter((a) => a.exerciseId !== 's.7')
    expect(gradeSession(p, partial)).toEqual({ grade: 'first', correct: 11, total: 12, reviewErrors: 0 })
  })

  it('ignores answers for exercises not in the plan and lets the last answer per exercise win', () => {
    const p = plan()
    const all = answers(p)
    const stray: Answer = { exerciseId: 'not.in.plan', correct: false, itemIds: [], msElapsed: 1 }
    const retry: Answer = { ...all[0], correct: false }
    const result = gradeSession(p, [...all, stray, retry])
    expect(result).toEqual({ grade: 'upper-second', correct: 11, total: 12, reviewErrors: 1 })
  })
})

describe('prestigeFor', () => {
  it('exposes the CLAUDE.md numbers', () => {
    expect(PRESTIGE.correct).toBe(10)
    expect(PRESTIGE.finale).toBe(15)
    expect(PRESTIGE.remarkBonus).toBe(5)
    expect(PRESTIGE.zoomOutMax).toBe(10)
    expect(PRESTIGE.gradeBonus).toEqual({ first: 25, 'upper-second': 15, 'lower-second': 5, third: 0, pass: 0 })
  })

  // Canonical plan: ten plain corrects (slots 1-9, 11) = 100, Remark 10+5, finale 15.
  it.each([
    [[], 'first', 100 + 15 + 15 + 25],
    [[4], 'first', 90 + 15 + 15 + 25],
    [[10], 'first', 100 + 0 + 15 + 25], // a wrong Remark earns nothing, not even the +5
    [[12], 'first', 100 + 15 + 0 + 25],
    [[1], 'upper-second', 90 + 15 + 15 + 15],
    [[4, 5], 'upper-second', 80 + 15 + 15 + 15],
    [[4, 5, 6], 'lower-second', 70 + 15 + 15 + 5],
    [[4, 5, 6, 7, 8], 'third', 50 + 15 + 15 + 0],
    [[4, 5, 6, 7, 8, 9, 11], 'pass', 30 + 15 + 15 + 0],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'pass', 0],
  ] as Array<[number[], Grade, number]>)('wrong at %j (%s) earns %i Prestige', (wrong, grade, expected) => {
    const p = plan()
    const a = answers(p, wrong)
    expect(gradeSession(p, a).grade).toBe(grade)
    expect(prestigeFor(p, a, grade)).toBe(expected)
  })

  it.each([
    [0.62, 6],
    [1, 10],
    [0.05, 1],
    [0.04, 0],
    [0, 0],
    [undefined, 0],
    [1.7, 10], // clamped
  ])('a correct Zoom Out with earlyFraction %s adds %i', (earlyFraction, bonus) => {
    const p = plan({ 5: { type: 'zoom-out' } })
    const a = answers(p, [], { 5: { earlyFraction } })
    expect(prestigeFor(p, a, 'first')).toBe(155 + bonus)
  })

  it('a wrong Zoom Out earns no early bonus', () => {
    const p = plan({ 5: { type: 'zoom-out' } })
    const a = answers(p, [5], { 5: { earlyFraction: 0.9 } })
    expect(prestigeFor(p, a, 'first')).toBe(145)
  })

  it('a correct finale that is also a Remark takes the finale rate plus the Remark bonus', () => {
    const p = plan({ 12: { type: 'remark', isFinale: true } })
    expect(prestigeFor(p, answers(p), 'first')).toBe(100 + 15 + (15 + 5) + 25)
  })

  it('the grade bonus is whatever grade is passed in', () => {
    const p = plan()
    const a = answers(p)
    expect(prestigeFor(p, a, 'pass')).toBe(130)
    expect(prestigeFor(p, a, 'lower-second')).toBe(135)
  })

  it('unanswered exercises earn nothing', () => {
    const p = plan()
    expect(prestigeFor(p, [], 'first')).toBe(25)
  })
})

describe('guineasFor', () => {
  it('exposes the CLAUDE.md numbers', () => {
    expect(GUINEAS.session).toBe(5)
    expect(GUINEAS.perCorrect).toBe(1)
    expect(GUINEAS.gradeBonus).toEqual({ first: 10, 'upper-second': 5, 'lower-second': 0, third: 0, pass: 0 })
  })

  it.each([
    [[], 'first', 5 + 12 + 10],
    [[4], 'first', 5 + 11 + 10],
    [[4, 5], 'upper-second', 5 + 10 + 5],
    [[4, 5, 6], 'lower-second', 5 + 9],
    [[4, 5, 6, 7, 8], 'third', 5 + 7],
    [[1, 2, 3, 4, 5, 6, 7], 'pass', 5 + 5],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'pass', 5],
  ] as Array<[number[], Grade, number]>)('wrong at %j (%s) earns %i Guineas', (wrong, grade, expected) => {
    const p = plan()
    const a = answers(p, wrong)
    expect(gradeSession(p, a).grade).toBe(grade)
    expect(guineasFor(p, a, grade)).toBe(expected)
  })

  it('a completed session with no answers still pays the 5 for completing', () => {
    expect(guineasFor(plan(), [], 'pass')).toBe(5)
  })
})
