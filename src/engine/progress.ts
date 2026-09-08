/**
 * Progress service: the Dexie-backed glue between the engine and the screens.
 * Everything here is async and persists through `src/store/db.ts`.
 *
 * Responsibilities, per CLAUDE.md "Module APIs" and "Grading, meters,
 * streaks, ranks":
 *
 *   loadProfile / saveProfile     the single profile (id 'me'), created on first run
 *   loadCards                     every CardState, keyed by item id
 *   startSession                  resumes today's unfinished session for the
 *                                 lesson, or builds a new plan (attempt =
 *                                 today's records for the same lesson + 1) and
 *                                 writes a SessionRecord holding it
 *   sessionAnswers                what has been answered on a plan so far
 *   recordAnswer                  applies the scheduler to every item in the
 *                                 answer at once and persists the cards
 *   completeSession               grades, awards Prestige and Guineas, applies
 *                                 the Standing rule (with Country Weekends),
 *                                 advances lesson and city, detects rank-ups and
 *                                 acquisitions, stores the summary, returns it
 *   dueCount / collection / estateProgress / buyFurnishing / resetAll
 *
 * Every function takes an explicit `now` where the clock matters; the default
 * is `new Date()` so the app can omit it while tests never read the clock.
 */
import { getContent } from '../content'
import { DISCIPLINES, type Discipline } from '../content/constants'
import type { City, Lesson } from '../content/types'
import { db } from '../store/db'
import { gradeSession, guineasFor, prestigeFor } from './grading'
import { rankFor } from './ranks'
import { createScheduler } from './scheduler'
import { buildSession } from './session'
import {
  localDay,
  type Answer,
  type CardState,
  type Profile,
  type SessionPlan,
  type SessionRecord,
  type SessionSummary,
} from './types'

export const PROFILE_ID = 'me' as const
export const COUNTRY_WEEKENDS_PER_MONTH = 2
export const DEFAULT_DISPLAY_NAME = 'Traveller'

/**
 * What is actually written to the sessions table: the contract's SessionRecord
 * plus the ids already acquired when the session began (so `completeSession`
 * can tell which cards flipped during this session even after a reload) and
 * the plan itself (so an interrupted session resumes on exactly the twelve
 * slots it started with, rather than being silently replaced).
 */
interface StoredSessionRecord extends SessionRecord {
  acquiredBefore?: string[]
  plan?: SessionPlan
}

// ---------------------------------------------------------------------------
// Content helpers (read through getContent() only, so tests mock one function)
// ---------------------------------------------------------------------------

/** Every item id in the content today. Cards for anything else are ignored. */
function contentItemIds(): Set<string> {
  return new Set(getContent().items.map((i) => i.id))
}

function citiesInOrder(): City[] {
  return [...getContent().cities].sort((a, b) => a.order - b.order)
}

function mvpCities(): City[] {
  return citiesInOrder().filter((c) => c.release === 'mvp')
}

function lessonsFor(cityId: string): Lesson[] {
  return getContent()
    .lessons.filter((l) => l.cityId === cityId)
    .sort((a, b) => a.order - b.order)
}

/** The first `release: mvp` city by order; any city if none is marked mvp. */
export function defaultCityId(): string {
  return mvpCities()[0]?.id ?? citiesInOrder()[0]?.id ?? ''
}

/** The next mvp city after `cityId` that is not yet completed, or null. */
function nextMvpCity(cityId: string, completed: string[]): City | null {
  const cities = mvpCities()
  const index = cities.findIndex((c) => c.id === cityId)
  const after = index >= 0 ? cities.slice(index + 1) : cities
  return after.find((c) => !completed.includes(c.id)) ?? null
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function defaultProfile(now: Date): Profile {
  return {
    id: PROFILE_ID,
    createdAt: now.getTime(),
    titleStyle: 'plain',
    displayName: DEFAULT_DISPLAY_NAME,
    prestige: 0,
    guineas: 0,
    standing: 0,
    lastSessionDay: null,
    countryWeekendsLeft: COUNTRY_WEEKENDS_PER_MONTH,
    countryWeekendMonth: null,
    currentCityId: defaultCityId(),
    lessonProgress: {},
    completedCities: [],
    furnishings: [],
    sessionsCompleted: 0,
    soundEnabled: true,
  }
}

export async function loadProfile(now: Date = new Date()): Promise<Profile> {
  return db.transaction('rw', db.profile, async () => {
    const existing = await db.profile.get(PROFILE_ID)
    if (existing) return existing
    const fresh = defaultProfile(now)
    await db.profile.put(fresh)
    return fresh
  })
}

/**
 * Merge changes into the stored profile inside a transaction. A caller holding
 * a profile read minutes ago (the Settings screen) must not write back the
 * prestige, guineas and lesson progress a session completed meanwhile, so only
 * the fields it passes are applied.
 */
export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  return db.transaction('rw', db.profile, async () => {
    const current = await loadProfile()
    const next: Profile = { ...current, ...patch, id: PROFILE_ID }
    await db.profile.put(next)
    return next
  })
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function loadCards(): Promise<Map<string, CardState>> {
  const cards = await db.cards.toArray()
  return new Map(cards.map((c) => [c.itemId, c]))
}

function acquiredIds(cards: Iterable<CardState>): string[] {
  const out: string[] = []
  for (const c of cards) if (c.acquired) out.push(c.itemId)
  return out
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

async function findRecord(sessionId: string): Promise<StoredSessionRecord | undefined> {
  return (await db.sessions.where('sessionId').equals(sessionId).last()) as StoredSessionRecord | undefined
}

/** True while every item a stored plan touches is still in the content. */
function planIsCurrent(plan: SessionPlan): boolean {
  if (!plan?.exercises?.length) return false
  const known = contentItemIds()
  return plan.exercises.every((e) => e.itemIds.length > 0 && e.itemIds.every((id) => known.has(id)))
}

/**
 * Today's plan for the current lesson: the unfinished one if there is one,
 * otherwise a new attempt.
 *
 * A reload, a backgrounded tab evicted by the browser or a crash must not cost
 * the user the answers already applied to their cards, so the plan is stored
 * with the record and handed back verbatim; `sessionAnswers` returns what has
 * been answered so far. Finding and writing happen in one transaction, so two
 * clients starting at once cannot both add a record for the same attempt.
 */
export async function startSession(now: Date = new Date()): Promise<SessionPlan> {
  const [profile, cards] = await Promise.all([loadProfile(now), loadCards()])
  const probe = buildSession({ profile, cards, now, attempt: 1 })
  return db.transaction('rw', db.sessions, async () => {
    const today = (await db.sessions
      .where('sessionId')
      .startsWith(`${localDay(now)}-${probe.lessonId}-`)
      .toArray()) as StoredSessionRecord[]

    const unfinished = today
      .filter((r) => r.completedAt === null && r.plan && planIsCurrent(r.plan))
      .sort((a, b) => a.startedAt - b.startedAt)
      .pop()
    if (unfinished?.plan) return unfinished.plan

    const attempt = today.length + 1
    const plan = attempt === 1 ? probe : buildSession({ profile, cards, now, attempt })
    const record: StoredSessionRecord = {
      sessionId: plan.id,
      cityId: plan.cityId,
      lessonId: plan.lessonId,
      startedAt: now.getTime(),
      completedAt: null,
      summary: null,
      answers: [],
      acquiredBefore: acquiredIds(cards.values()),
      plan,
    }
    await db.sessions.add(record)
    return plan
  })
}

/** Answers already recorded for a session, in the plan's own slot order. */
export async function sessionAnswers(plan: SessionPlan): Promise<Answer[]> {
  const record = await findRecord(plan.id)
  if (!record?.answers?.length) return []
  const byExercise = new Map(record.answers.map((a) => [a.exerciseId, a]))
  return plan.exercises.map((e) => byExercise.get(e.id)).filter((a): a is Answer => Boolean(a))
}

function itemIdsForAnswer(plan: SessionPlan, answer: Answer): string[] {
  const ids = answer.itemIds.length ? answer.itemIds : (plan.exercises.find((e) => e.id === answer.exerciseId)?.itemIds ?? [])
  return [...new Set(ids)]
}

export async function recordAnswer(plan: SessionPlan, answer: Answer, now: Date = new Date()): Promise<void> {
  const ids = itemIdsForAnswer(plan, answer)
  const scheduler = createScheduler()
  await db.transaction('rw', db.cards, db.sessions, async () => {
    const existing = await db.cards.bulkGet(ids)
    const updated = ids.map((id, i) => scheduler.review(existing[i] ?? scheduler.newCard(id, now), answer.correct, now))
    if (updated.length) await db.cards.bulkPut(updated)

    const record = await findRecord(plan.id)
    if (record?.id !== undefined) {
      const answers = [...record.answers.filter((a) => a.exerciseId !== answer.exerciseId), answer]
      await db.sessions.update(record.id, { answers })
    }
  })
}

/** Whole days from local day `a` to local day `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/**
 * The Standing (streak) rule, applied in place on completion:
 *   same day -> unchanged; previous day -> +1; exactly one missed day with a
 *   Country Weekend left -> spend it, +1; otherwise -> 1.
 * Country Weekends reset to two when the calendar month changes, before the
 * rule is evaluated, so a gap that straddles a month boundary can use the new
 * month's allowance. A last day in the future (clock moved back) is treated
 * as the same day and the later day is kept.
 */
export function applyStanding(profile: Profile, now: Date): void {
  const today = localDay(now)
  const month = today.slice(0, 7)
  if (profile.countryWeekendMonth !== month) {
    profile.countryWeekendMonth = month
    profile.countryWeekendsLeft = COUNTRY_WEEKENDS_PER_MONTH
  }

  const last = profile.lastSessionDay
  const gap = last ? daysBetween(last, today) : null
  if (gap !== null && gap <= 0) {
    profile.standing = Math.max(1, profile.standing)
    return
  }
  if (gap === 1) {
    profile.standing += 1
  } else if (gap === 2 && profile.countryWeekendsLeft > 0) {
    profile.countryWeekendsLeft -= 1
    profile.standing += 1
  } else {
    profile.standing = 1
  }
  profile.lastSessionDay = today
}

/**
 * Lesson and city progress, applied in place:
 * completing the current lesson (or one at or past the pointer) moves
 * `lessonProgress[cityId]` to the next order; past the last lesson the city
 * joins `completedCities` and `currentCityId` moves to the next mvp city
 * (stays put if there is none). Repeating an earlier lesson changes nothing.
 */
function advanceProgress(profile: Profile, plan: SessionPlan): { lessonCompleted: boolean; cityCompleted: boolean } {
  const lessons = lessonsFor(plan.cityId)
  const lesson = lessons.find((l) => l.id === plan.lessonId)
  if (!lesson) return { lessonCompleted: false, cityCompleted: false }

  const pointer = profile.lessonProgress[plan.cityId] ?? 1
  let lessonCompleted = false
  if (lesson.order >= pointer) {
    profile.lessonProgress[plan.cityId] = lesson.order + 1
    lessonCompleted = true
  }

  let cityCompleted = false
  const past = (profile.lessonProgress[plan.cityId] ?? 1) > lessons.length
  if (past && !profile.completedCities.includes(plan.cityId)) {
    profile.completedCities.push(plan.cityId)
    cityCompleted = true
    const next = nextMvpCity(plan.cityId, profile.completedCities)
    if (next) profile.currentCityId = next.id
  }
  return { lessonCompleted, cityCompleted }
}

export async function completeSession(plan: SessionPlan, answers: Answer[], now: Date = new Date()): Promise<SessionSummary> {
  return db.transaction('rw', db.cards, db.profile, db.sessions, async () => {
    const profile = await loadProfile(now)
    const cards = await db.cards.toArray()
    const record = await findRecord(plan.id)

    // What this session acquired: cards acquired now that were not when it began.
    const before = record?.acquiredBefore ? new Set(record.acquiredBefore) : undefined
    const known = contentItemIds()
    const acquiredNow = cards.filter((c) => c.acquired && known.has(c.itemId))
    const acquired = acquiredNow
      .filter((c) => (before ? !before.has(c.itemId) : (c.acquiredAt ?? 0) >= plan.createdAt))
      .map((c) => c.itemId)
    const acquiredBeforeCount = acquiredNow.length - acquired.length

    const { grade, correct, total, reviewErrors } = gradeSession(plan, answers)
    const prestigeEarned = prestigeFor(plan, answers, grade)
    const guineasEarned = guineasFor(plan, answers, grade)

    const rankBefore = rankFor({
      acquired: acquiredBeforeCount,
      cities: profile.completedCities.length,
      sessions: profile.sessionsCompleted,
    }).level

    const next: Profile = {
      ...profile,
      lessonProgress: { ...profile.lessonProgress },
      completedCities: [...profile.completedCities],
      furnishings: [...profile.furnishings],
    }
    applyStanding(next, now)
    const { lessonCompleted, cityCompleted } = advanceProgress(next, plan)
    next.prestige += prestigeEarned
    next.guineas += guineasEarned
    next.sessionsCompleted += 1

    const rankAfter = rankFor({
      acquired: acquiredNow.length,
      cities: next.completedCities.length,
      sessions: next.sessionsCompleted,
    }).level

    const completedAt = now.getTime()
    const summary: SessionSummary = {
      sessionId: plan.id,
      cityId: plan.cityId,
      lessonId: plan.lessonId,
      grade,
      correct,
      total,
      reviewErrors,
      prestigeEarned,
      guineasEarned,
      acquired,
      rankBefore,
      rankAfter,
      standing: next.standing,
      lessonCompleted,
      cityCompleted,
      completedAt,
    }

    await db.profile.put(next)
    if (record?.id !== undefined) {
      await db.sessions.update(record.id, { completedAt, summary, answers })
    } else {
      await db.sessions.add({
        sessionId: plan.id,
        cityId: plan.cityId,
        lessonId: plan.lessonId,
        startedAt: plan.createdAt,
        completedAt,
        summary,
        answers,
      })
    }
    return summary
  })
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Due cards. A card whose item has left the content is never scheduled by the
 * session builder, so counting it here would leave the Correspondence at "one
 * item awaits your reply" that no session can clear.
 */
export async function dueCount(now: Date = new Date()): Promise<number> {
  const scheduler = createScheduler()
  const known = contentItemIds()
  const cards = await db.cards.toArray()
  return cards.filter((c) => known.has(c.itemId) && scheduler.isDue(c, now)).length
}

/** Acquired cards, in the order they were acquired; orphans are left out. */
export async function collection(): Promise<CardState[]> {
  const known = contentItemIds()
  const cards = (await db.cards.filter((c) => c.acquired).toArray()).filter((c) => known.has(c.itemId))
  return cards.sort((a, b) => (a.acquiredAt ?? 0) - (b.acquiredAt ?? 0) || a.itemId.localeCompare(b.itemId))
}

export async function estateProgress(): Promise<Record<Discipline, { acquired: number; total: number }>> {
  const owned = new Set((await collection()).map((c) => c.itemId))
  const out = {} as Record<Discipline, { acquired: number; total: number }>
  for (const d of DISCIPLINES) out[d] = { acquired: 0, total: 0 }
  for (const item of getContent().items) {
    const bucket = out[item.discipline]
    if (!bucket) continue
    bucket.total++
    if (owned.has(item.id)) bucket.acquired++
  }
  return out
}

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

export async function buyFurnishing(id: string, price: number): Promise<Profile> {
  if (!Number.isFinite(price) || price < 0) throw new Error(`Bad price for ${id}: ${price}`)
  return db.transaction('rw', db.profile, async () => {
    const profile = await loadProfile()
    if (profile.furnishings.includes(id)) return profile
    if (price > profile.guineas) throw new Error('Not enough Guineas')
    const next: Profile = { ...profile, guineas: profile.guineas - price, furnishings: [...profile.furnishings, id] }
    await db.profile.put(next)
    return next
  })
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.cards, db.profile, db.sessions, async () => {
    await Promise.all([db.cards.clear(), db.profile.clear(), db.sessions.clear()])
  })
}
