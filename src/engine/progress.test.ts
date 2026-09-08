/**
 * Progress service tests against fake-indexeddb (preloaded by src/test-setup.ts).
 *
 * Content and the session builder are replaced with synthetic fixtures so the
 * tests do not depend on what is in content.json today: three cities (one of
 * them not mvp and ordered first), three lessons, seven items. The scheduler
 * is the real one, so acquisition follows the real FSRS numbers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fx = vi.hoisted(() => {
  const item = (id: string, discipline: string, city: string) => ({
    id,
    discipline,
    kind: 'work',
    title: id,
    city,
    difficulty: 2,
    era: 'Test',
    year: 1800,
    creator: 'Someone',
    facts: ['A fact.'],
    remark: 'A remark.',
    gaffe: 'A gaffe.',
    links: [],
    tags: [],
    sources: ['A source.'],
    reviewed_by: null,
  })
  const city = (id: string, order: number, release: string) => ({ id, name: id, order, blurb: id, release, lesson_size: 6 })
  const lesson = (cityId: string, order: number, itemIds: string[]) => ({
    id: `${cityId}.${order}`,
    cityId,
    order,
    title: `Lesson ${order}`,
    itemIds,
    scenarioIds: [],
  })

  const cities = [city('zeta', 1, 'v2'), city('alpha', 2, 'mvp'), city('beta', 3, 'mvp'), city('gamma', 4, 'v3')]
  const items = [
    item('music.a1', 'music', 'alpha'),
    item('art.a2', 'art', 'alpha'),
    item('opera.a3', 'opera', 'alpha'),
    item('history.a4', 'history', 'alpha'),
    item('music.b1', 'music', 'beta'),
    item('art.b2', 'art', 'beta'),
    item('music.z1', 'music', 'zeta'),
  ]
  const lessons = [
    lesson('alpha', 1, ['music.a1', 'art.a2']),
    lesson('alpha', 2, ['opera.a3', 'history.a4']),
    lesson('beta', 1, ['music.b1', 'art.b2']),
  ]
  const bundle = {
    version: 1,
    builtAt: '2026-01-01T00:00:00Z',
    cities,
    lessons,
    items,
    scenarios: [],
    mediaIndex: {},
    stats: { items: items.length, scenarios: 0, byDiscipline: {}, byCity: {}, withTheme: 0, withImage: 0 },
  }

  const localDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  /** Stand-in for engine/session: one identify exercise per lesson item, the last one the finale. */
  function buildSession(input: {
    profile: { currentCityId: string; lessonProgress: Record<string, number> }
    cards: Map<string, unknown>
    now: Date
    attempt?: number
  }) {
    const { profile, cards, now, attempt = 1 } = input
    const cityLessons = lessons.filter((l) => l.cityId === profile.currentCityId).sort((a, b) => a.order - b.order)
    const wanted = profile.lessonProgress[profile.currentCityId] ?? 1
    const current = cityLessons.find((l) => l.order >= wanted) ?? cityLessons[cityLessons.length - 1]
    if (!current) throw new Error(`No lessons for ${profile.currentCityId}`)
    const id = `${localDay(now)}-${current.id}-${attempt}`
    const exercises = current.itemIds.map((itemId, i) => ({
      id: `${id}.${i + 1}`,
      type: 'identify',
      itemIds: [itemId],
      isReview: cards.has(itemId),
      slot: i + 1,
      itemId,
      askFor: 'creator',
      question: 'Who?',
      options: [{ id: 'a', label: 'Someone' }],
      correctOptionId: 'a',
      ...(i === current.itemIds.length - 1 ? { isFinale: true } : {}),
    }))
    return {
      id,
      cityId: current.cityId,
      lessonId: current.id,
      exercises,
      newItemIds: current.itemIds.filter((x) => !cards.has(x)),
      reviewItemIds: current.itemIds.filter((x) => cards.has(x)),
      createdAt: now.getTime(),
    }
  }

  return { bundle, buildSession, item }
})

vi.mock('../content', () => ({ getContent: () => fx.bundle }))
vi.mock('./session', () => ({ buildSession: fx.buildSession }))

import { db } from '../store/db'
import {
  COUNTRY_WEEKENDS_PER_MONTH,
  applyStanding,
  buyFurnishing,
  collection,
  completeSession,
  daysBetween,
  dueCount,
  estateProgress,
  loadCards,
  loadProfile,
  recordAnswer,
  resetAll,
  saveProfile,
  sessionAnswers,
  startSession,
} from './progress'
import type { Answer, CardState, Profile, SessionPlan } from './types'

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min, 0, 0)
const JAN5 = at(2026, 1, 5)
const JAN6 = at(2026, 1, 6)
const JAN13 = at(2026, 1, 13)
const JAN14 = at(2026, 1, 14)

function answerAll(plan: SessionPlan, wrongSlots: number[] = []): Answer[] {
  return plan.exercises.map((e) => ({
    exerciseId: e.id,
    correct: !wrongSlots.includes(e.slot),
    itemIds: e.itemIds,
    msElapsed: 1500,
  }))
}

function answerFor(plan: SessionPlan, itemId: string, correct = true): Answer {
  const exercise = plan.exercises.find((e) => e.itemIds.includes(itemId))
  return { exerciseId: exercise?.id ?? `${plan.id}.x`, correct, itemIds: [itemId], msElapsed: 1500 }
}

/** Play the whole session: start, answer every slot, complete. */
async function playSession(now: Date, wrongSlots: number[] = []) {
  const plan = await startSession(now)
  const answers = answerAll(plan, wrongSlots)
  for (const a of answers) await recordAnswer(plan, a, now)
  return { plan, summary: await completeSession(plan, answers, now) }
}

async function seedProfile(patch: Partial<Profile>, now = JAN5): Promise<Profile> {
  const base = await loadProfile(now)
  return saveProfile({ ...base, ...patch })
}

function acquiredCard(itemId: string, acquiredAt: number): CardState {
  return {
    itemId,
    due: acquiredAt + 30 * 86_400_000,
    stability: 30,
    difficulty: 5,
    reps: 5,
    lapses: 0,
    state: 2,
    lastReview: acquiredAt,
    correctDays: ['2025-12-01', '2025-12-02', '2025-12-09'],
    acquired: true,
    acquiredAt,
  }
}

/** The fixture content's own items; anything a test lends it is taken back after. */
const BASE_ITEMS = fx.bundle.items.length

/**
 * Lend the mocked content some extra items for one test. Cards for items that
 * are not in the content are ignored by the engine (they can never be
 * scheduled), so a test about counting acquired items must give them somewhere
 * to belong.
 */
function lendItems(ids: string[]): void {
  fx.bundle.items.push(...ids.map((id) => fx.item(id, 'music', 'alpha')))
}

beforeEach(async () => {
  fx.bundle.items.length = BASE_ITEMS
  await resetAll()
})

// ---------------------------------------------------------------------------

describe('loadProfile / saveProfile', () => {
  it('creates the default profile on first run, on the first mvp city', async () => {
    const p = await loadProfile(JAN5)
    expect(p).toEqual({
      id: 'me',
      createdAt: JAN5.getTime(),
      titleStyle: 'plain',
      displayName: 'Traveller',
      prestige: 0,
      guineas: 0,
      standing: 0,
      lastSessionDay: null,
      countryWeekendsLeft: 2,
      countryWeekendMonth: null,
      currentCityId: 'alpha', // zeta is ordered first but is not release: mvp
      lessonProgress: {},
      completedCities: [],
      furnishings: [],
      sessionsCompleted: 0,
      soundEnabled: true,
    })
    expect(await db.profile.count()).toBe(1)
  })

  it('returns the stored profile afterwards and persists saves', async () => {
    const first = await loadProfile(JAN5)
    const again = await loadProfile(JAN13)
    expect(again).toEqual(first)

    await saveProfile({ ...first, displayName: 'Lady Bracknell', titleStyle: 'feminine', soundEnabled: false })
    const stored = await loadProfile(JAN13)
    expect(stored.displayName).toBe('Lady Bracknell')
    expect(stored.titleStyle).toBe('feminine')
    expect(stored.soundEnabled).toBe(false)
    expect(stored.createdAt).toBe(JAN5.getTime())
  })
})

describe('startSession', () => {
  it('builds the plan for the current lesson and writes a SessionRecord', async () => {
    const plan = await startSession(JAN5)
    expect(plan.id).toBe('2026-01-05-alpha.1-1')
    expect(plan.cityId).toBe('alpha')
    expect(plan.lessonId).toBe('alpha.1')
    expect(plan.exercises).toHaveLength(2)

    const records = await db.sessions.toArray()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      sessionId: plan.id,
      cityId: 'alpha',
      lessonId: 'alpha.1',
      startedAt: JAN5.getTime(),
      completedAt: null,
      summary: null,
      answers: [],
    })
    expect(records[0].id).toBeTypeOf('number')
  })

  it('resumes today\'s unfinished session instead of starting a second one', async () => {
    const a = await startSession(JAN5)
    await recordAnswer(a, answerFor(a, 'music.a1', true), JAN5)

    // A reload: the same plan comes back, with the answers already given.
    const again = await startSession(at(2026, 1, 5, 21))
    expect(again.id).toBe(a.id)
    expect(again.exercises.map((e) => e.id)).toEqual(a.exercises.map((e) => e.id))
    expect(await db.sessions.count()).toBe(1)
    expect((await sessionAnswers(again)).map((x) => x.exerciseId)).toEqual([a.exercises[0].id])
  })

  it('numbers a repeat attempt on the same lesson once the earlier one is complete, and starts over on a new day', async () => {
    await playSession(JAN5)
    await seedProfile({ lessonProgress: { alpha: 1 } }) // play the same lesson again
    const b = await startSession(at(2026, 1, 5, 21))
    const c = await startSession(JAN6)
    expect(b.id).toBe('2026-01-05-alpha.1-2')
    expect(c.id).toBe('2026-01-06-alpha.1-1')
    expect(await db.sessions.count()).toBe(3)
  })

  it('starts a fresh session rather than resuming one whose items have left the content', async () => {
    const a = await startSession(JAN5)
    const record = (await db.sessions.where('sessionId').equals(a.id).first())!
    // `plan` is stored alongside the contract's SessionRecord fields (see
    // StoredSessionRecord in progress.ts), so the update spec is widened here.
    const stale = { plan: { ...a, exercises: a.exercises.map((e) => ({ ...e, itemIds: ['music.gone-away'] })) } }
    await db.sessions.update(record.id!, stale as unknown as Parameters<typeof db.sessions.update>[1])
    const b = await startSession(at(2026, 1, 5, 21))
    expect(b.id).toBe('2026-01-05-alpha.1-2')
  })

  it('starts the next lesson once the previous one is complete', async () => {
    await playSession(JAN5)
    const plan = await startSession(JAN6)
    expect(plan.id).toBe('2026-01-06-alpha.2-1')
  })
})

describe('recordAnswer', () => {
  it('creates and persists a card for every item in the answer at once', async () => {
    const plan = await startSession(JAN5)
    await recordAnswer(plan, { exerciseId: plan.exercises[0].id, correct: true, itemIds: ['music.a1', 'art.a2'], msElapsed: 900 }, JAN5)

    const cards = await loadCards()
    expect([...cards.keys()].sort()).toEqual(['art.a2', 'music.a1'])
    for (const card of cards.values()) {
      expect(card.reps).toBe(1)
      expect(card.correctDays).toEqual(['2026-01-05'])
      expect(card.acquired).toBe(false)
      expect(card.fsrs).toBeDefined()
    }
  })

  it('applies the scheduler to an existing card rather than starting over', async () => {
    const plan = await startSession(JAN5)
    await recordAnswer(plan, answerFor(plan, 'music.a1', true), JAN5)
    await recordAnswer(plan, answerFor(plan, 'music.a1', false), JAN6)
    const card = (await loadCards()).get('music.a1')!
    expect(card.reps).toBe(2)
    expect(card.lapses).toBeGreaterThanOrEqual(0)
    expect(card.correctDays).toEqual(['2026-01-05']) // the wrong day is not a correct day
    expect(card.due).toBeGreaterThanOrEqual(JAN6.getTime())
  })

  it('appends the answer to the SessionRecord, replacing an earlier answer for the same exercise', async () => {
    const plan = await startSession(JAN5)
    const first = answerFor(plan, 'music.a1', false)
    await recordAnswer(plan, first, JAN5)
    await recordAnswer(plan, { ...first, correct: true }, JAN5)
    await recordAnswer(plan, answerFor(plan, 'art.a2', true), JAN5)
    const record = (await db.sessions.where('sessionId').equals(plan.id).first())!
    expect(record.answers.map((a) => [a.exerciseId, a.correct])).toEqual([
      [first.exerciseId, true],
      [plan.exercises[1].id, true],
    ])
  })

  it('falls back to the exercise item ids when the answer carries none', async () => {
    const plan = await startSession(JAN5)
    await recordAnswer(plan, { exerciseId: plan.exercises[1].id, correct: true, itemIds: [], msElapsed: 1 }, JAN5)
    expect([...(await loadCards()).keys()]).toEqual(['art.a2'])
  })
})

describe('completeSession', () => {
  it('grades, pays, updates the profile, and stores the summary on the record', async () => {
    const { plan, summary } = await playSession(JAN5)
    // Two exercises: one plain correct (10) and a correct finale (15), a First (+25).
    expect(summary).toEqual({
      sessionId: plan.id,
      cityId: 'alpha',
      lessonId: 'alpha.1',
      grade: 'first',
      correct: 2,
      total: 2,
      reviewErrors: 0,
      prestigeEarned: 50,
      guineasEarned: 17,
      acquired: [],
      rankBefore: 1,
      rankAfter: 2,
      standing: 1,
      lessonCompleted: true,
      cityCompleted: false,
      completedAt: JAN5.getTime(),
    })

    const profile = await loadProfile(JAN5)
    expect(profile).toMatchObject({
      prestige: 50,
      guineas: 17,
      standing: 1,
      lastSessionDay: '2026-01-05',
      countryWeekendMonth: '2026-01',
      countryWeekendsLeft: 2,
      sessionsCompleted: 1,
      lessonProgress: { alpha: 2 },
      completedCities: [],
      currentCityId: 'alpha',
    })

    const record = (await db.sessions.where('sessionId').equals(plan.id).first())!
    expect(record.completedAt).toBe(JAN5.getTime())
    expect(record.summary).toEqual(summary)
    expect(record.answers).toHaveLength(2)
  })

  it('a session with errors grades and pays accordingly', async () => {
    const { summary } = await playSession(JAN5, [1])
    expect(summary.grade).toBe('first') // one error, none on review
    expect(summary.correct).toBe(1)
    expect(summary.prestigeEarned).toBe(15 + 25)
    expect(summary.guineasEarned).toBe(5 + 1 + 10)
  })

  it('accumulates Prestige, Guineas and sessions across sessions', async () => {
    await playSession(JAN5)
    await playSession(JAN6)
    const profile = await loadProfile(JAN6)
    expect(profile.prestige).toBe(100)
    expect(profile.guineas).toBe(34)
    expect(profile.sessionsCompleted).toBe(2)
  })

  it('writes a record even when the plan was never started here', async () => {
    const profile = await loadProfile(JAN5)
    const plan = fx.buildSession({ profile, cards: new Map(), now: JAN5 }) as unknown as SessionPlan
    const summary = await completeSession(plan, answerAll(plan), JAN5)
    expect(summary.grade).toBe('first')
    const records = await db.sessions.toArray()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ sessionId: plan.id, startedAt: plan.createdAt, completedAt: JAN5.getTime() })
    expect(records[0].summary).toEqual(summary)
  })
})

describe('Standing (streak) and Country Weekends', () => {
  it('a first ever session sets Standing to 1', async () => {
    const { summary } = await playSession(JAN5)
    expect(summary.standing).toBe(1)
  })

  it.each([
    ['the same day', '2026-01-05', 2, 3, 2],
    ['the previous day', '2026-01-04', 2, 4, 2],
    ['exactly one missed day with a Country Weekend left', '2026-01-03', 2, 4, 1],
    ['exactly one missed day with one Country Weekend left', '2026-01-03', 1, 4, 0],
    ['exactly one missed day with none left', '2026-01-03', 0, 1, 0],
    ['two missed days', '2026-01-02', 2, 1, 2],
    ['a long absence', '2025-11-20', 2, 1, 2],
  ])('after %s (last %s, %i weekends left) Standing becomes %i and %i weekends remain', async (_, last, left, standing, leftAfter) => {
    await seedProfile({ standing: 3, lastSessionDay: last, countryWeekendMonth: '2026-01', countryWeekendsLeft: left })
    const { summary } = await playSession(JAN5)
    expect(summary.standing).toBe(standing)
    const profile = await loadProfile(JAN5)
    expect(profile.standing).toBe(standing)
    expect(profile.countryWeekendsLeft).toBe(leftAfter)
    expect(profile.lastSessionDay).toBe('2026-01-05')
    expect(profile.countryWeekendMonth).toBe('2026-01')
  })

  it('resets the Country Weekends when the month changes, before the gap is judged', async () => {
    // Last session on 3 January, none left from December: the new month's allowance covers the gap.
    await seedProfile({ standing: 7, lastSessionDay: '2026-01-03', countryWeekendMonth: '2025-12', countryWeekendsLeft: 0 })
    const { summary } = await playSession(JAN5)
    expect(summary.standing).toBe(8)
    const profile = await loadProfile(JAN5)
    expect(profile.countryWeekendMonth).toBe('2026-01')
    expect(profile.countryWeekendsLeft).toBe(COUNTRY_WEEKENDS_PER_MONTH - 1)
  })

  it('carries a streak across consecutive days and across a spent weekend', async () => {
    expect((await playSession(JAN5)).summary.standing).toBe(1)
    expect((await playSession(JAN6)).summary.standing).toBe(2)
    expect((await playSession(at(2026, 1, 8))).summary.standing).toBe(3) // 7 Jan missed, weekend spent
    expect((await playSession(at(2026, 1, 10))).summary.standing).toBe(4) // 9 Jan missed, second spent
    expect((await playSession(at(2026, 1, 12))).summary.standing).toBe(1) // none left
    expect((await loadProfile(JAN13)).countryWeekendsLeft).toBe(0)
    expect((await playSession(at(2026, 2, 2))).summary.standing).toBe(1) // long gap, but February refills
    expect((await loadProfile(JAN13)).countryWeekendsLeft).toBe(2)
  })

  describe('applyStanding (pure)', () => {
    const base = (): Profile => ({
      id: 'me',
      createdAt: 0,
      titleStyle: 'plain',
      displayName: 'T',
      prestige: 0,
      guineas: 0,
      standing: 5,
      lastSessionDay: '2026-03-10',
      countryWeekendsLeft: 1,
      countryWeekendMonth: '2026-03',
      currentCityId: 'alpha',
      lessonProgress: {},
      completedCities: [],
      furnishings: [],
      sessionsCompleted: 9,
      soundEnabled: true,
    })

    it.each([
      [at(2026, 3, 10, 23, 59), 5, 1, '2026-03-10'],
      [at(2026, 3, 11, 0, 1), 6, 1, '2026-03-11'],
      [at(2026, 3, 12), 6, 0, '2026-03-12'],
      [at(2026, 3, 13), 1, 1, '2026-03-13'],
      [at(2026, 4, 1), 1, 2, '2026-04-01'],
    ])('at %s: standing %i, weekends %i, last day %s', (now, standing, left, last) => {
      const p = base()
      applyStanding(p, now)
      expect(p.standing).toBe(standing)
      expect(p.countryWeekendsLeft).toBe(left)
      expect(p.lastSessionDay).toBe(last)
    })

    it('treats a last day in the future as the same day and keeps the later day', () => {
      const p = base()
      applyStanding(p, at(2026, 3, 9))
      expect(p.standing).toBe(5)
      expect(p.lastSessionDay).toBe('2026-03-10')
    })

    it('daysBetween counts local calendar days, including across DST and month ends', () => {
      expect(daysBetween('2026-01-05', '2026-01-05')).toBe(0)
      expect(daysBetween('2026-01-04', '2026-01-05')).toBe(1)
      expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
      expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
      expect(daysBetween('2025-12-31', '2026-01-02')).toBe(2)
      expect(daysBetween('2026-01-05', '2026-01-04')).toBe(-1)
    })
  })
})

describe('lesson and city advancement', () => {
  it('advances through the lessons of a city, then moves to the next mvp city', async () => {
    const one = await playSession(JAN5)
    expect(one.plan.lessonId).toBe('alpha.1')
    expect(one.summary).toMatchObject({ lessonCompleted: true, cityCompleted: false })
    expect(await loadProfile(JAN5)).toMatchObject({ lessonProgress: { alpha: 2 }, completedCities: [], currentCityId: 'alpha' })

    const two = await playSession(JAN6)
    expect(two.plan.lessonId).toBe('alpha.2')
    expect(two.summary).toMatchObject({ lessonCompleted: true, cityCompleted: true })
    expect(await loadProfile(JAN6)).toMatchObject({
      lessonProgress: { alpha: 3 },
      completedCities: ['alpha'],
      currentCityId: 'beta',
    })
  })

  it('stays on the last mvp city when there is no next one', async () => {
    await playSession(JAN5)
    await playSession(JAN6)
    const three = await playSession(at(2026, 1, 7))
    expect(three.plan.lessonId).toBe('beta.1')
    expect(three.summary).toMatchObject({ lessonCompleted: true, cityCompleted: true })
    expect(await loadProfile(JAN6)).toMatchObject({
      lessonProgress: { alpha: 3, beta: 2 },
      completedCities: ['alpha', 'beta'],
      currentCityId: 'beta',
    })

    // Repeating the last lesson of a finished city changes nothing.
    const four = await playSession(at(2026, 1, 8))
    expect(four.plan.lessonId).toBe('beta.1')
    expect(four.summary).toMatchObject({ lessonCompleted: false, cityCompleted: false })
    expect((await loadProfile(JAN6)).completedCities).toEqual(['alpha', 'beta'])
  })

  it('does not advance when an earlier lesson is repeated', async () => {
    await seedProfile({ lessonProgress: { alpha: 2 } })
    const profile = await loadProfile(JAN5)
    const plan = fx.buildSession({ profile: { ...profile, lessonProgress: {} }, cards: new Map(), now: JAN5 }) as unknown as SessionPlan
    expect(plan.lessonId).toBe('alpha.1')
    const summary = await completeSession(plan, answerAll(plan), JAN5)
    expect(summary.lessonCompleted).toBe(false)
    expect((await loadProfile(JAN5)).lessonProgress).toEqual({ alpha: 2 })
  })
})

describe('acquisition and rank-up', () => {
  it('reports items that crossed the threshold during the session, once', async () => {
    // Three correct answers on three distinct days; the third flips the card.
    for (const day of [JAN5, JAN6]) {
      const plan = await startSession(day)
      await recordAnswer(plan, answerFor(plan, 'music.a1'), day)
      expect((await loadCards()).get('music.a1')!.acquired).toBe(false)
    }
    const plan = await startSession(JAN13)
    await recordAnswer(plan, answerFor(plan, 'music.a1'), JAN13)
    await recordAnswer(plan, answerFor(plan, 'art.a2'), JAN13)
    const card = (await loadCards()).get('music.a1')!
    expect(card.acquired).toBe(true)
    expect(card.acquiredAt).toBe(JAN13.getTime())

    const summary = await completeSession(plan, answerAll(plan), JAN13)
    expect(summary.acquired).toEqual(['music.a1'])
    expect((await collection()).map((c) => c.itemId)).toEqual(['music.a1'])

    // The next session does not report it again.
    const later = await startSession(JAN14)
    await recordAnswer(later, answerFor(later, 'music.a1'), JAN14)
    const next = await completeSession(later, answerAll(later), JAN14)
    expect(next.acquired).toEqual([])
    expect((await loadCards()).get('music.a1')!.acquired).toBe(true)
  })

  it('the first completed session is the rank-up from Commoner to Gentle', async () => {
    const { summary } = await playSession(JAN5)
    expect(summary.rankBefore).toBe(1)
    expect(summary.rankAfter).toBe(2)
    const again = await playSession(JAN6)
    expect(again.summary.rankBefore).toBe(2)
    expect(again.summary.rankAfter).toBe(2)
  })

  it('detects the rank-up to Esquire when the 25th item is acquired in the session', async () => {
    const earlier = at(2025, 12, 9).getTime()
    const seeded = Array.from({ length: 24 }, (_, i) => `music.seed-${i}`)
    lendItems(seeded)
    await db.cards.bulkPut(seeded.map((id) => acquiredCard(id, earlier)))
    await seedProfile({ sessionsCompleted: 3 })

    for (const day of [JAN5, JAN6]) {
      const plan = await startSession(day)
      await recordAnswer(plan, answerFor(plan, 'music.a1'), day)
      const summary = await completeSession(plan, answerAll(plan), day)
      expect(summary.rankBefore).toBe(2)
      expect(summary.rankAfter).toBe(2)
    }

    const plan = await startSession(JAN13)
    await recordAnswer(plan, answerFor(plan, 'music.a1'), JAN13)
    const summary = await completeSession(plan, answerAll(plan), JAN13)
    expect(summary.acquired).toEqual(['music.a1'])
    expect(summary.rankBefore).toBe(2)
    expect(summary.rankAfter).toBe(3)
    expect(await collection()).toHaveLength(25)
  })

  it('falls back to acquiredAt when the session has no record of its starting set', async () => {
    lendItems(['music.seed-old'])
    await db.cards.bulkPut([acquiredCard('music.seed-old', at(2025, 12, 9).getTime()), acquiredCard('music.a1', JAN5.getTime())])
    const profile = await loadProfile(JAN5)
    const plan = fx.buildSession({ profile, cards: new Map(), now: at(2026, 1, 5, 8) }) as unknown as SessionPlan
    const summary = await completeSession(plan, answerAll(plan), JAN5)
    expect(summary.acquired).toEqual(['music.a1'])
  })
})

describe('dueCount and collection', () => {
  it('counts cards whose due time has passed', async () => {
    expect(await dueCount(JAN5)).toBe(0)
    const plan = await startSession(JAN5)
    await recordAnswer(plan, { exerciseId: plan.exercises[0].id, correct: true, itemIds: ['music.a1', 'art.a2'], msElapsed: 1 }, JAN5)
    expect(await dueCount(JAN5)).toBe(0) // just answered: scheduled for later
    expect(await dueCount(JAN6)).toBe(2)
  })

  it('ignores cards whose item has left the content, which no session could ever clear', async () => {
    await db.cards.bulkPut([
      { ...acquiredCard('music.a1', JAN5.getTime()), due: JAN5.getTime() - 1000 },
      { ...acquiredCard('music.gone-away', JAN5.getTime()), due: JAN5.getTime() - 1000 },
    ])
    expect(await dueCount(JAN5)).toBe(1)
    expect((await collection()).map((c) => c.itemId)).toEqual(['music.a1'])
  })

  it('collection returns acquired cards in order of acquisition', async () => {
    await db.cards.bulkPut([
      acquiredCard('art.a2', JAN6.getTime()),
      acquiredCard('music.a1', JAN5.getTime()),
      { ...acquiredCard('opera.a3', 0), acquired: false, acquiredAt: undefined },
    ])
    expect((await collection()).map((c) => c.itemId)).toEqual(['music.a1', 'art.a2'])
  })
})

describe('estateProgress', () => {
  it('counts acquired against total items per discipline', async () => {
    expect(await estateProgress()).toEqual({
      music: { acquired: 0, total: 3 },
      opera: { acquired: 0, total: 1 },
      art: { acquired: 0, total: 2 },
      history: { acquired: 0, total: 1 },
    })
    await db.cards.bulkPut([
      acquiredCard('music.a1', JAN5.getTime()),
      acquiredCard('art.b2', JAN5.getTime()),
      acquiredCard('music.not-in-content', JAN5.getTime()),
    ])
    expect(await estateProgress()).toEqual({
      music: { acquired: 1, total: 3 },
      opera: { acquired: 0, total: 1 },
      art: { acquired: 1, total: 2 },
      history: { acquired: 0, total: 1 },
    })
  })
})

describe('buyFurnishing', () => {
  it('deducts the price and records the furnishing', async () => {
    await seedProfile({ guineas: 20 })
    const after = await buyFurnishing('chandelier', 15)
    expect(after.guineas).toBe(5)
    expect(after.furnishings).toEqual(['chandelier'])
    expect(await loadProfile(JAN5)).toMatchObject({ guineas: 5, furnishings: ['chandelier'] })
  })

  it('does not charge twice for a furnishing already owned', async () => {
    await seedProfile({ guineas: 20 })
    await buyFurnishing('chandelier', 15)
    const again = await buyFurnishing('chandelier', 15)
    expect(again.guineas).toBe(5)
    expect(again.furnishings).toEqual(['chandelier'])
  })

  it('throws when the Guineas are short and leaves the profile untouched', async () => {
    await seedProfile({ guineas: 9 })
    await expect(buyFurnishing('canaletto', 10)).rejects.toThrow('Not enough Guineas')
    expect(await loadProfile(JAN5)).toMatchObject({ guineas: 9, furnishings: [] })
  })

  it('can spend exactly what is held', async () => {
    await seedProfile({ guineas: 10 })
    expect((await buyFurnishing('canaletto', 10)).guineas).toBe(0)
  })
})

describe('resetAll', () => {
  it('clears cards, profile and sessions', async () => {
    await playSession(JAN5)
    await db.cards.put(acquiredCard('music.b1', JAN5.getTime()))
    expect(await db.cards.count()).toBeGreaterThan(0)
    expect(await db.profile.count()).toBe(1)
    expect(await db.sessions.count()).toBe(1)

    await resetAll()
    expect(await db.cards.count()).toBe(0)
    expect(await db.profile.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)

    const fresh = await loadProfile(JAN13)
    expect(fresh.sessionsCompleted).toBe(0)
    expect(fresh.createdAt).toBe(JAN13.getTime())
  })
})
