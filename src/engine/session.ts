/**
 * Session builder. Implements the twelve-slot plan in CLAUDE.md, "Session
 * rules":
 *
 *   1-3   review: due cards sorted by due date, topped up with new lesson items
 *   4-9   new items from the current lesson in lesson order, then earlier
 *         lessons in the same city, then remaining due cards, then other known
 *         cards, then today's items again as extra review (thin content never
 *         throws: a lesson with one item still yields twelve exercises)
 *   10    the Remark: a scenario from the lesson, rotated by seed; else an item
 *   11    Timeline on even seeds, Match on odd seeds; the other when the
 *         preferred one lacks material; else an item exercise
 *   12    the finale: the hardest unused item in the city, `isFinale: true`
 *
 * Every random choice draws from `mulberry32(seed)`, where the seed defaults
 * to `hashString(sessionId)` and the session id is `${localDay}-${lessonId}-${attempt}`.
 * Given the same input the plan is byte-for-byte the same.
 */
import { getContent, hasImage as contentHasImage } from '../content'
import type { City, Item, Lesson, Scenario } from '../content/types'
import { answerFor, optionsFor, redactNames } from './distractors'
import { createScheduler } from './scheduler'
import {
  hashString,
  localDay,
  mulberry32,
  shuffle,
  type ApocryphaExercise,
  type CardState,
  type ChoiceAsk,
  type ChoiceExercise,
  type Exercise,
  type MatchExercise,
  type Profile,
  type RemarkExercise,
  type SessionPlan,
  type TimelineEntry,
  type TimelineExercise,
} from './types'

// ---------------------------------------------------------------------------
// Content source
// ---------------------------------------------------------------------------

/** Everything the builder reads. Tests supply a synthetic one. */
export interface ContentSource {
  items: Item[]
  lessons: Lesson[]
  scenarios: Scenario[]
  cities: City[]
  /** True when an image for the item is actually on disk (media may be declared but not fetched). */
  hasImage(itemId: string): boolean
}

/** The compiled bundle in src/content/generated/content.json. */
export function defaultContentSource(): ContentSource {
  const c = getContent()
  return { items: c.items, lessons: c.lessons, scenarios: c.scenarios, cities: c.cities, hasImage: contentHasImage }
}

export interface BuildSessionInput {
  profile: Profile
  cards: Map<string, CardState>
  now: Date
  /** Overrides `hashString(sessionId)`; tests pass one for determinism and to choose Timeline (even) or Match (odd). */
  seed?: number
  /** 1-based; part of the session id so a repeat on the same day builds a different session. */
  attempt?: number
  /** Defaults to the compiled content bundle. */
  source?: ContentSource
}

export const SESSION_SLOTS = 12
export const REVIEW_SLOTS = 3
export const NEW_SLOTS = 6
export const REMARK_SLOT = 10
export const SET_PIECE_SLOT = 11
export const FINALE_SLOT = 12

/** Minimum entries for Timeline and pairs for Match; four are used when available. */
const SET_PIECE_MIN = 3
const SET_PIECE_MAX = 4

// ---------------------------------------------------------------------------
// Lesson and session id
// ---------------------------------------------------------------------------

function lessonsForCity(source: ContentSource, cityId: string): Lesson[] {
  return source.lessons.filter((l) => l.cityId === cityId).sort((a, b) => a.order - b.order)
}

/**
 * The lesson the profile is on: `lessonProgress[currentCityId]` (default 1).
 * Past the last lesson the city's last lesson is repeated. A city with no
 * lessons falls back to the first `mvp` city that has any, so a stale profile
 * never blocks a session.
 */
export function resolveLesson(profile: Profile, source: ContentSource): Lesson {
  let lessons = lessonsForCity(source, profile.currentCityId)
  if (lessons.length === 0) {
    const cities = [...source.cities].sort((a, b) => a.order - b.order)
    for (const city of [...cities.filter((c) => c.release === 'mvp'), ...cities]) {
      lessons = lessonsForCity(source, city.id)
      if (lessons.length) break
    }
  }
  if (lessons.length === 0) {
    // Lessons whose city is not listed at all: take them in id order rather than fail.
    lessons = [...source.lessons].sort((a, b) => a.cityId.localeCompare(b.cityId) || a.order - b.order).slice(0, 1)
    if (lessons.length) lessons = lessonsForCity(source, lessons[0].cityId)
  }
  if (lessons.length === 0) throw new Error('No lessons in content; run `npm run content`')
  const wanted = profile.lessonProgress[lessons[0].cityId] ?? 1
  return lessons.find((l) => l.order >= wanted) ?? lessons[lessons.length - 1]
}

export function sessionIdFor(now: Date, lessonId: string, attempt: number): string {
  return `${localDay(now)}-${lessonId}-${attempt}`
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface Ctx {
  source: ContentSource
  itemById: Map<string, Item>
  cards: Map<string, CardState>
  rand: () => number
  sessionId: string
  /** Items in slot order as they are used; reuse cycles through this. */
  usedOrder: Item[]
  /** How many times each item has appeared, so a reuse can vary its question. */
  useCount: Map<string, number>
}

function letter(i: number): string {
  return String.fromCharCode(97 + i)
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function creatorVerb(item: Item): string {
  switch (item.discipline) {
    case 'music':
    case 'opera':
      return 'composed'
    case 'art':
      return 'painted'
    default:
      return 'created'
  }
}

/** One or two facts, shuffled by seed, with the item's own name(s) redacted. */
function clueFor(item: Item, names: string[], rand: () => number, variant: number): string {
  const facts = shuffle(item.facts, rand)
  const start = facts.length > 2 ? (variant * 2) % facts.length : 0
  const picked = facts.slice(start, start + 2)
  if (picked.length < 2 && facts.length > 1) picked.push(...facts.slice(0, 2 - picked.length))
  return redactNames(picked.join(' '), names)
}

function yearQuestion(item: Item): string {
  const spanned = typeof item.year_end === 'number' && item.year_end !== item.year
  return spanned ? `In which year did ${item.title} begin?` : `In which year was ${item.title}?`
}

/**
 * Exercise type per item (CLAUDE.md): apocrypha → apocrypha; term → lexicon;
 * musical work with a theme → drop-the-needle; art work with an image on disk
 * → zoom-out; person with an image → whos-who; otherwise identify. `variant`
 * rises each time an item is reused within the session and varies the question
 * where the item allows it.
 */
function exerciseForItem(ctx: Ctx, item: Item, slot: number, opts: { isReview: boolean; isFinale?: boolean; variant: number }): Exercise {
  const base = { id: `${ctx.sessionId}.${slot}`, itemIds: [item.id], isReview: opts.isReview, slot, ...(opts.isFinale ? { isFinale: true } : {}) }
  const choice = (type: ChoiceExercise['type'], askFor: ChoiceAsk, question: string): ChoiceExercise => {
    // Content that cannot answer the question (an undated episode, say) degrades to a title clue rather than failing.
    if (askFor !== 'title' && answerFor(item, askFor) === undefined) {
      return withClue('title', [item.title], item.kind === 'episode' ? 'Which event is this?' : 'Which is this?')
    }
    const { options, correctOptionId } = optionsFor(item, askFor, ctx.source.items, ctx.rand)
    return { ...base, type, itemId: item.id, askFor, question, options, correctOptionId }
  }
  const withClue = (askFor: ChoiceAsk, names: string[], ask: string): ChoiceExercise =>
    choice('identify', askFor, `${clueFor(item, names, ctx.rand, opts.variant)} ${ask}`)

  switch (item.kind) {
    case 'apocrypha': {
      const ex: ApocryphaExercise = {
        ...base,
        type: 'apocrypha',
        itemId: item.id,
        claim: item.claim,
        attributedTo: item.attributed_to,
        correctVerdict: item.verdict,
        truth: item.truth,
        sources: item.sources,
      }
      return ex
    }
    case 'term':
      return choice('lexicon', 'term', `What does “${item.title}” mean?`)
    case 'work': {
      if ((item.discipline === 'music' || item.discipline === 'opera') && item.theme) {
        const first: ChoiceAsk = ctx.rand() < 0.5 ? 'creator' : 'title'
        const askFor: ChoiceAsk = opts.variant % 2 === 0 ? first : first === 'creator' ? 'title' : 'creator'
        return choice('drop-the-needle', askFor, askFor === 'creator' ? 'Who composed this?' : 'Which work is this?')
      }
      if (item.discipline === 'art' && ctx.source.hasImage(item.id)) {
        return choice('zoom-out', 'creator', 'Who painted this?')
      }
      if (opts.variant % 2 === 1) return withClue('title', [item.title], 'Which work is this?')
      return choice('identify', 'creator', `Who ${creatorVerb(item)} ${item.title}?`)
    }
    case 'person':
      if (ctx.source.hasImage(item.id)) return choice('whos-who', 'person', 'Whose portrait is this?')
      return withClue('person', [item.title], 'Who is this?')
    case 'creator':
      return withClue('person', [item.title], 'Who is this?')
    case 'episode':
      return choice('identify', 'year', yearQuestion(item))
    case 'venue':
      return withClue('title', [item.title], 'Which venue is this?')
    case 'movement':
      return withClue('title', [item.title], 'Which movement is this?')
  }
}

function markUsed(ctx: Ctx, item: Item): number {
  const count = ctx.useCount.get(item.id) ?? 0
  ctx.useCount.set(item.id, count + 1)
  if (count === 0) ctx.usedOrder.push(item)
  return count
}

function itemExercise(ctx: Ctx, item: Item, slot: number, isFinale = false): Exercise {
  const variant = markUsed(ctx, item)
  const isReview = variant > 0 || ctx.cards.has(item.id)
  return exerciseForItem(ctx, item, slot, { isReview, isFinale, variant })
}

/** First item in the queue not yet used this session. */
function takeFresh(ctx: Ctx, queue: Item[]): Item | undefined {
  return queue.find((i) => !ctx.useCount.has(i.id))
}

function remarkExercise(ctx: Ctx, scenario: Scenario, slot: number): RemarkExercise {
  return {
    id: `${ctx.sessionId}.${slot}`,
    type: 'remark',
    itemIds: scenario.links.filter((id) => ctx.itemById.has(id)),
    isReview: false,
    slot,
    scenario,
    options: shuffle(scenario.options, ctx.rand).map((o, i) => ({ ...o, id: letter(i) })),
  }
}

function timelineSublabel(item: Item): string | undefined {
  switch (item.kind) {
    case 'work':
      return item.creator
    case 'creator':
      return 'born'
    case 'person':
      return item.role ? `${item.role}, born` : 'born'
    case 'episode':
      return typeof item.year_end === 'number' && item.year_end !== item.year ? `began; ${item.era}` : item.era
    default:
      return item.era
  }
}

function timelineExercise(ctx: Ctx, material: Item[], slot: number): TimelineExercise | null {
  const chosen: Item[] = []
  const years = new Set<number>()
  for (const item of material) {
    if (typeof item.year !== 'number' || years.has(item.year)) continue
    years.add(item.year)
    chosen.push(item)
    if (chosen.length === SET_PIECE_MAX) break
  }
  if (chosen.length < SET_PIECE_MIN) return null
  let presented = shuffle(chosen, ctx.rand)
  const alreadyOrdered = presented.every((it, i) => i === 0 || (presented[i - 1].year as number) < (it.year as number))
  if (alreadyOrdered) presented = [...presented.slice(1), presented[0]]
  const entries: TimelineEntry[] = presented.map((it, i) => {
    const entry: TimelineEntry = { id: letter(i), itemId: it.id, label: it.title, year: it.year as number }
    const sub = timelineSublabel(it)
    if (sub) entry.sublabel = sub
    return entry
  })
  const correctOrder = [...entries].sort((a, b) => a.year - b.year).map((e) => e.id)
  const itemIds = entries.map((e) => e.itemId)
  return {
    id: `${ctx.sessionId}.${slot}`,
    type: 'timeline',
    itemIds,
    isReview: itemIds.every((id) => ctx.cards.has(id)),
    slot,
    question: 'Put these in chronological order, earliest first.',
    entries,
    correctOrder,
  }
}

function matchExercise(ctx: Ctx, material: Item[], slot: number): MatchExercise | null {
  const chosen: Item[] = []
  const titles = new Set<string>()
  const creators = new Set<string>()
  for (const item of material) {
    if (item.kind !== 'work' || !item.creator) continue
    const t = normalise(item.title)
    const c = normalise(item.creator)
    if (titles.has(t) || creators.has(c)) continue
    titles.add(t)
    creators.add(c)
    chosen.push(item)
    if (chosen.length === SET_PIECE_MAX) break
  }
  if (chosen.length < SET_PIECE_MIN) return null
  const pairs = shuffle(chosen, ctx.rand).map((it, i) => ({ id: letter(i), itemId: it.id, left: it.title, right: it.creator as string }))
  const itemIds = pairs.map((p) => p.itemId)
  return {
    id: `${ctx.sessionId}.${slot}`,
    type: 'match',
    itemIds,
    isReview: itemIds.every((id) => ctx.cards.has(id)),
    slot,
    question: 'Match each work to its creator.',
    pairs,
  }
}

/** Highest difficulty wins; ties are broken by seed. */
function hardest(ctx: Ctx, candidates: Item[]): Item {
  const top = Math.max(...candidates.map((i) => i.difficulty))
  const tied = candidates.filter((i) => i.difficulty === top)
  return tied[Math.floor(ctx.rand() * tied.length)]
}

export function buildSession(input: BuildSessionInput): SessionPlan {
  const source = input.source ?? defaultContentSource()
  const { profile, cards, now } = input
  const attempt = input.attempt ?? 1
  const lesson = resolveLesson(profile, source)
  const cityId = lesson.cityId
  const sessionId = sessionIdFor(now, lesson.id, attempt)
  const seed = input.seed ?? hashString(sessionId)
  const rand = mulberry32(seed)
  const itemById = new Map(source.items.map((i) => [i.id, i]))
  const scenarioById = new Map(source.scenarios.map((s) => [s.id, s]))
  const scheduler = createScheduler()
  const ctx: Ctx = { source, itemById, cards, rand, sessionId, usedOrder: [], useCount: new Map() }

  const lookup = (ids: string[]): Item[] => ids.map((id) => itemById.get(id)).filter((i): i is Item => Boolean(i))

  const lessonItems = lookup(lesson.itemIds)
  if (lessonItems.length === 0) throw new Error(`Lesson ${lesson.id} has no items in content`)

  const earlierItems = lessonsForCity(source, cityId)
    .filter((l) => l.order < lesson.order)
    .sort((a, b) => b.order - a.order)
    .flatMap((l) => lookup(l.itemIds))

  const knownCards = [...cards.values()]
    .filter((c) => itemById.has(c.itemId))
    .sort((a, b) => a.due - b.due || a.itemId.localeCompare(b.itemId))
  const dueQueue = knownCards.filter((c) => scheduler.isDue(c, now)).map((c) => itemById.get(c.itemId) as Item)
  const notDueQueue = knownCards.filter((c) => !scheduler.isDue(c, now)).map((c) => itemById.get(c.itemId) as Item)
  const newQueue = [...lessonItems, ...earlierItems]

  /** Fill order for any slot that needs an item once the primary queue is exhausted. */
  const nextItem = (primary: Item[][]): Item => {
    for (const queue of [...primary, dueQueue, notDueQueue]) {
      const item = takeFresh(ctx, queue)
      if (item) return item
    }
    // Everything has been seen: cycle through today's items again as extra review.
    const seen = ctx.usedOrder
    let best = seen[0]
    for (const item of seen) if ((ctx.useCount.get(item.id) ?? 0) < (ctx.useCount.get(best.id) ?? 0)) best = item
    return best
  }

  const exercises: Exercise[] = []

  // Slots 1-3: due cards by due date, then new lesson items.
  for (let slot = 1; slot <= REVIEW_SLOTS; slot++) {
    exercises.push(itemExercise(ctx, nextItem([dueQueue, newQueue]), slot))
  }

  // Slots 4-9: the lesson in order, then earlier lessons in the city.
  for (let slot = REVIEW_SLOTS + 1; slot <= REVIEW_SLOTS + NEW_SLOTS; slot++) {
    exercises.push(itemExercise(ctx, nextItem([newQueue]), slot))
  }

  // Slot 10: the Remark.
  const scenarios = lesson.scenarioIds.map((id) => scenarioById.get(id)).filter((s): s is Scenario => Boolean(s))
  if (scenarios.length) {
    exercises.push(remarkExercise(ctx, scenarios[Math.abs(seed) % scenarios.length], REMARK_SLOT))
  } else {
    exercises.push(itemExercise(ctx, nextItem([newQueue]), REMARK_SLOT))
  }

  // Slot 11: Timeline on even seeds, Match on odd; the other if short of material; else an item.
  const acquiredHere = knownCards.filter((c) => c.acquired).map((c) => itemById.get(c.itemId) as Item).filter((i) => i.city === cityId)
  const material: Item[] = []
  for (const item of [...ctx.usedOrder, ...acquiredHere]) {
    if (!material.some((m) => m.id === item.id)) material.push(item)
  }
  const builders = seed % 2 === 0 ? [timelineExercise, matchExercise] : [matchExercise, timelineExercise]
  let setPiece: Exercise | null = null
  for (const build of builders) {
    setPiece = build(ctx, material, SET_PIECE_SLOT)
    if (setPiece) break
  }
  exercises.push(setPiece ?? itemExercise(ctx, nextItem([newQueue]), SET_PIECE_SLOT))

  // Slot 12: the finale, the hardest unused item in the city.
  const touched = new Set(exercises.flatMap((e) => e.itemIds))
  const cityItems = source.items.filter((i) => i.city === cityId)
  const finaleCandidates =
    [
      cityItems.filter((i) => !touched.has(i.id) && i.kind !== 'apocrypha'),
      cityItems.filter((i) => !touched.has(i.id)),
      cityItems.filter((i) => i.kind !== 'apocrypha'),
      cityItems,
      lessonItems,
    ].find((c) => c.length > 0) ?? lessonItems
  exercises.push(itemExercise(ctx, hardest(ctx, finaleCandidates), FINALE_SLOT, true))

  // Items met for the first time this session versus items with a card already.
  const touchedInOrder = [...new Set(exercises.flatMap((e) => e.itemIds))]
  const newItemIds = touchedInOrder.filter((id) => !cards.has(id))
  const reviewItemIds = touchedInOrder.filter((id) => cards.has(id))

  return {
    id: sessionId,
    cityId,
    lessonId: lesson.id,
    exercises,
    newItemIds,
    reviewItemIds,
    createdAt: now.getTime(),
  }
}
