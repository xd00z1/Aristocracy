import { describe, expect, it, vi } from 'vitest'
import type { City, Item, Lesson, Scenario } from '../content/types'
import { buildSession, resolveLesson, sessionIdFor, type ContentSource } from './session'
import { isChoice, type CardState, type ChoiceExercise, type Exercise, type MatchExercise, type Profile, type TimelineExercise } from './types'

// The builder reads the compiled bundle only through defaultContentSource();
// tests pass their own source, and the bundle is being rebuilt by other
// agents, so keep it out of the picture entirely.
vi.mock('../content', () => ({
  getContent: () => ({ items: [], lessons: [], scenarios: [], cities: [], mediaIndex: {} }),
  hasImage: () => false,
}))

// Same semantics as the real scheduler (due <= now) without pulling in ts-fsrs.
vi.mock('./scheduler', () => ({
  createScheduler: () => ({
    isDue: (card: CardState, now: Date) => card.due <= now.getTime(),
    newCard: () => {
      throw new Error('not used')
    },
    review: () => {
      throw new Error('not used')
    },
    retrievability: () => 0,
  }),
}))

// ---------------------------------------------------------------------------
// Synthetic content
// ---------------------------------------------------------------------------

type Overrides = Partial<Record<string, unknown>>

function item(id: string, kind: Item['kind'], discipline: Item['discipline'], city: string, title: string, o: Overrides = {}): Item {
  return {
    id,
    discipline,
    kind,
    title,
    city,
    difficulty: 1,
    era: `${discipline} era`,
    facts: [`${title} is the subject of this item, and ${title} did something notable.`, `A second fact about ${title}.`],
    remark: `A sayable, defensible sentence about ${title} for the feedback panel.`,
    gaffe: `Mispronouncing ${title}.`,
    links: [],
    tags: [],
    sources: ['A standard reference'],
    reviewed_by: null,
    ...o,
  } as unknown as Item
}

const THEME = { notes: 'G4/8 G4/8 G4/8 Eb4/2', tempo: 108 }
const IMAGE = { image: { commons: 'File:Something.jpg', source: 'Commons', license: 'Public domain' } }

const T = 'testville'
const H = 'hamlet'

// Lesson 1 (six items)
const alpha = item('music.work.alpha', 'work', 'music', T, 'Alpha Symphony', {
  creator: 'Composer A', year: 1800, theme: THEME,
  distractors: { creator: ['Composer X', 'Composer Y', 'Composer Z'], title: ['Alpha Sonata', 'Alpha Quartet', 'Alpha Mass'] },
})
const beta = item('art.work.beta', 'work', 'art', T, 'Beta Portrait', { creator: 'Painter B', year: 1650, media: IMAGE })
const gamma = item('opera.work.gamma', 'work', 'opera', T, 'Gamma Aria', { creator: 'Composer C', year: 1720 })
const delta = item('music.work.delta', 'work', 'music', T, 'Delta Concerto', { creator: 'Composer D', year: 1850 })
const epsilon = item('history.person.epsilon', 'person', 'history', T, 'Epsilon of Testville', {
  year: 1700, role: 'Regent', media: IMAGE, distractors: { person: ['Person P', 'Person Q', 'Person R'] },
})
const zeta = item('music.term.zeta', 'term', 'music', T, 'zeta', {
  definition: 'The correct definition of zeta.',
  distractors: { term: ['A wrong definition one.', 'A wrong definition two.', 'A wrong definition three.'] },
})
// Lesson 2 (six items)
const eta = item('art.creator.eta', 'creator', 'art', T, 'Eta Painter', {
  year: 1600, year_end: 1660, facts: ['Eta Painter was born in Testville and trained under Painter B.', 'Late in life Eta Painter went blind.'],
})
const theta = item('history.episode.theta', 'episode', 'history', T, 'The Theta Rising', { year: 1789, year_end: 1794, difficulty: 2 })
const iota = item('history.apocrypha.iota', 'apocrypha', 'history', T, '"Iota"', {
  year: 1790, claim: 'Someone said iota.', attributed_to: 'Epsilon of Testville', verdict: 'embellished', truth: 'They said something like it.',
})
const kappa = item('opera.venue.kappa', 'venue', 'opera', T, 'The Kappa House', {
  year: 1730, location: 'Testville', distractors: { title: ['The Lambda House', 'Teatro Mu', 'The Nu Rooms'] },
})
const lambda = item('art.movement.lambda', 'movement', 'art', T, 'Lambdaism', {
  year: 1874, distractors: { title: ['Muism', 'Nuism', 'Xiism'] },
})
const mu = item('opera.work.mu', 'work', 'opera', T, 'Mu Overture', { creator: 'Composer M', year: 1900, theme: THEME, difficulty: 2 })
// Lesson 3 (the rest)
const nu = item('art.work.nu', 'work', 'art', T, 'Nu Altarpiece', { creator: 'Painter N', year: 1500, difficulty: 3 })
const xi = item('music.creator.xi', 'creator', 'music', T, 'Xi Composer', { year: 1685, difficulty: 2 })
const omicron = item('history.person.omicron', 'person', 'history', T, 'Omicron the Bold', { year: 1533, difficulty: 2 })
const pi = item('music.work.pi', 'work', 'music', T, 'Pi Cantata', { creator: 'Composer P', year: 1750, theme: THEME })
const rho = item('history.episode.rho', 'episode', 'history', T, 'The Rho Congress', { year: 1815, distractors: { year: [1805, 1812, 1821] } })
const sigma = item('music.term.sigma', 'term', 'music', T, 'sigma', {
  definition: 'The correct definition of sigma.',
  distractors: { term: ['Wrong sigma one.', 'Wrong sigma two.', 'Wrong sigma three.'] },
})
const tau = item('art.work.tau', 'work', 'art', T, 'Tau Landscape', { creator: 'Painter T', year: 1889, media: IMAGE, difficulty: 2 })
const upsilon = item('opera.work.upsilon', 'work', 'opera', T, 'Upsilon Duet', { creator: 'Composer U', year: 1830 })
// Hamlet: a city whose only lesson has two items
const hamletOne = item('music.work.hamlet-one', 'work', 'music', H, 'Hamlet Serenade', { creator: 'Composer H', year: 1700 })
const hamletTwo = item('art.creator.hamlet-two', 'creator', 'art', H, 'Hamlet Painter', { year: 1400 })

const LESSON1 = [alpha, beta, gamma, delta, epsilon, zeta]
const LESSON2 = [eta, theta, iota, kappa, lambda, mu]
const LESSON3 = [nu, xi, omicron, pi, rho, sigma, tau, upsilon]
const ALL_ITEMS = [...LESSON1, ...LESSON2, ...LESSON3, hamletOne, hamletTwo]

const scenario: Scenario = {
  id: 'scenario.testville.one',
  city: T,
  discipline: 'music',
  difficulty: 1,
  setting: 'Interval, the Kappa House.',
  prompt: 'Your host says something.',
  options: [
    { text: 'Graceful.', kind: 'correct', explanation: 'Yes.' },
    { text: 'Wrong.', kind: 'wrong', explanation: 'No.' },
    { text: 'Gaffe.', kind: 'gaffe', explanation: 'Oh dear.' },
  ],
  links: [alpha.id, 'music.work.does-not-exist'],
  sources: [],
  reviewed_by: null,
}

const cities: City[] = [
  { id: T, name: 'Testville', order: 1, blurb: 'A test.', release: 'mvp', lesson_size: 6 },
  { id: H, name: 'Hamlet', order: 2, blurb: 'Tiny.', release: 'mvp', lesson_size: 6 },
]

const lessons: Lesson[] = [
  { id: `${T}.1`, cityId: T, order: 1, title: 'Lesson 1', itemIds: LESSON1.map((i) => i.id), scenarioIds: [scenario.id] },
  { id: `${T}.2`, cityId: T, order: 2, title: 'Lesson 2', itemIds: LESSON2.map((i) => i.id), scenarioIds: [] },
  { id: `${T}.3`, cityId: T, order: 3, title: 'Lesson 3', itemIds: LESSON3.map((i) => i.id), scenarioIds: ['scenario.missing'] },
  { id: `${H}.1`, cityId: H, order: 1, title: 'Lesson 1', itemIds: [hamletOne.id, hamletTwo.id], scenarioIds: [] },
]

const WITH_IMAGES = new Set([beta.id, epsilon.id, tau.id])

function source(overrides: Partial<ContentSource> = {}): ContentSource {
  return { items: ALL_ITEMS, lessons, scenarios: [scenario], cities, hasImage: (id) => WITH_IMAGES.has(id), ...overrides }
}

function profile(o: Partial<Profile> = {}): Profile {
  return {
    id: 'me',
    createdAt: 0,
    titleStyle: 'plain',
    displayName: 'Tester',
    prestige: 0,
    guineas: 0,
    standing: 0,
    lastSessionDay: null,
    countryWeekendsLeft: 2,
    countryWeekendMonth: null,
    currentCityId: T,
    lessonProgress: {},
    completedCities: [],
    furnishings: [],
    sessionsCompleted: 0,
    soundEnabled: true,
    ...o,
  }
}

const NOW = new Date(2026, 8, 8, 9, 0, 0) // local time, so localDay is 2026-09-08
const HOUR = 3_600_000

function card(itemId: string, dueOffset: number, o: Partial<CardState> = {}): CardState {
  return { itemId, due: NOW.getTime() + dueOffset, stability: 1, difficulty: 5, reps: 1, lapses: 0, state: 2, correctDays: [], acquired: false, ...o }
}

function cards(...list: CardState[]): Map<string, CardState> {
  return new Map(list.map((c) => [c.itemId, c]))
}

function build(o: { profile?: Profile; cards?: Map<string, CardState>; seed?: number; attempt?: number; source?: ContentSource } = {}) {
  return buildSession({ profile: o.profile ?? profile(), cards: o.cards ?? new Map(), now: NOW, seed: o.seed ?? 2, attempt: o.attempt, source: o.source ?? source() })
}

const itemOf = (e: Exercise) => e.itemIds[0]
const choices = (plan: { exercises: Exercise[] }) => plan.exercises.filter(isChoice)

function expectWellFormedOptions(e: ChoiceExercise) {
  expect(e.options).toHaveLength(4)
  const labels = e.options.map((o) => o.label.trim().toLowerCase())
  expect(new Set(labels).size).toBe(4)
  expect(new Set(e.options.map((o) => o.id)).size).toBe(4)
  expect(e.options.some((o) => o.id === e.correctOptionId)).toBe(true)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSession: slot layout', () => {
  it('builds twelve exercises with unique ids sessionId.slot and the session id from day, lesson and attempt', () => {
    const plan = build()
    expect(plan.id).toBe('2026-09-08-testville.1-1')
    expect(plan.cityId).toBe(T)
    expect(plan.lessonId).toBe('testville.1')
    expect(plan.createdAt).toBe(NOW.getTime())
    expect(plan.exercises).toHaveLength(12)
    plan.exercises.forEach((e, i) => {
      expect(e.slot).toBe(i + 1)
      expect(e.id).toBe(`${plan.id}.${i + 1}`)
      expect(e.itemIds.length).toBeGreaterThan(0)
    })
    expect(new Set(plan.exercises.map((e) => e.id)).size).toBe(12)
    expect(build({ attempt: 2 }).id).toBe('2026-09-08-testville.1-2')
    expect(sessionIdFor(NOW, 'x.1', 3)).toBe('2026-09-08-x.1-3')
  })

  it('with nothing due, fills slots 1-3 and 4-9 from the lesson in order and reuses items as extra review when the lesson is short', () => {
    const plan = build()
    const ids = plan.exercises.slice(0, 9).map(itemOf)
    expect(ids.slice(0, 6)).toEqual(LESSON1.map((i) => i.id))
    // Six items for nine slots: the first three come round again, flagged as review.
    expect(ids.slice(6)).toEqual([alpha.id, beta.id, gamma.id])
    expect(plan.exercises.slice(0, 6).every((e) => e.isReview === false)).toBe(true)
    expect(plan.exercises.slice(6, 9).every((e) => e.isReview === true)).toBe(true)
  })

  it('puts the Remark in slot 10 with three shuffled options carrying ids and existing links only', () => {
    const plan = build()
    const remark = plan.exercises[9]
    expect(remark.type).toBe('remark')
    if (remark.type !== 'remark') return
    expect(remark.scenario.id).toBe(scenario.id)
    expect(remark.options).toHaveLength(3)
    expect(remark.options.map((o) => o.kind).sort()).toEqual(['correct', 'gaffe', 'wrong'])
    expect(new Set(remark.options.map((o) => o.id)).size).toBe(3)
    expect(remark.itemIds).toEqual([alpha.id])
    expect(remark.isReview).toBe(false)
  })

  it('uses an item exercise in slot 10 when the lesson has no scenario', () => {
    const plan = build({ profile: profile({ lessonProgress: { [T]: 2 } }) })
    expect(plan.exercises[9].type).not.toBe('remark')
    expect(plan.exercises[9].itemIds).toHaveLength(1)
  })

  it('builds a Timeline in slot 11 on even seeds with distinct years in a scrambled order', () => {
    const plan = build({ seed: 2 })
    const tl = plan.exercises[10]
    expect(tl.type).toBe('timeline')
    if (tl.type !== 'timeline') return
    expect(tl.entries).toHaveLength(4)
    expect(new Set(tl.entries.map((e) => e.year)).size).toBe(4)
    expect(new Set(tl.entries.map((e) => e.id)).size).toBe(4)
    const byId = new Map(tl.entries.map((e) => [e.id, e]))
    const years = tl.correctOrder.map((id) => byId.get(id)?.year)
    expect(years).toEqual([...years].sort((a, b) => (a as number) - (b as number)))
    expect(tl.entries.map((e) => e.id)).not.toEqual(tl.correctOrder)
    expect(tl.itemIds).toEqual(tl.entries.map((e) => e.itemId))
    // Timeline material is today's items: every entry was met in slots 1-10.
    const today = new Set(plan.exercises.slice(0, 10).flatMap((e) => e.itemIds))
    expect(tl.entries.every((e) => today.has(e.itemId))).toBe(true)
  })

  it('builds a Match in slot 11 on odd seeds: four works, title to creator', () => {
    const plan = build({ seed: 3 })
    const m = plan.exercises[10]
    expect(m.type).toBe('match')
    if (m.type !== 'match') return
    expect(m.pairs).toHaveLength(4)
    expect(new Set(m.pairs.map((p) => p.left)).size).toBe(4)
    expect(new Set(m.pairs.map((p) => p.right)).size).toBe(4)
    expect(new Set(m.pairs.map((p) => p.id)).size).toBe(4)
    for (const p of m.pairs) {
      const it = ALL_ITEMS.find((i) => i.id === p.itemId)
      expect(it?.kind).toBe('work')
      expect(p.left).toBe(it?.title)
      expect(p.right).toBe(it?.creator)
    }
  })

  it('makes slot 12 a finale on the hardest unused item in the city', () => {
    const plan = build()
    const finale = plan.exercises[11]
    expect(finale.isFinale).toBe(true)
    expect(isChoice(finale)).toBe(true)
    expect(itemOf(finale)).toBe(nu.id) // difficulty 3, not in lesson 1
    expect(plan.exercises.slice(0, 11).every((e) => e.isFinale !== true)).toBe(true)
    const before = new Set(plan.exercises.slice(0, 11).flatMap((e) => e.itemIds))
    expect(before.has(nu.id)).toBe(false)
  })
})

describe('buildSession: review ordering', () => {
  it('puts due cards first, sorted by due date, then the lesson in order', () => {
    const plan = build({
      cards: cards(card(eta.id, -2 * HOUR), card(theta.id, -1 * HOUR), card(nu.id, -3 * HOUR), card(kappa.id, +1 * HOUR)),
    })
    const first = plan.exercises.slice(0, 3)
    expect(first.map(itemOf)).toEqual([nu.id, eta.id, theta.id])
    expect(first.every((e) => e.isReview)).toBe(true)
    const next = plan.exercises.slice(3, 9)
    expect(next.map(itemOf)).toEqual(LESSON1.map((i) => i.id))
    expect(next.every((e) => !e.isReview)).toBe(true)
    expect(plan.reviewItemIds).toEqual(expect.arrayContaining([nu.id, eta.id, theta.id]))
    expect(plan.newItemIds).toEqual(expect.arrayContaining(LESSON1.map((i) => i.id)))
    for (const id of [nu.id, eta.id, theta.id]) expect(plan.newItemIds).not.toContain(id)
    // The finale still avoids anything already touched.
    const before = new Set(plan.exercises.slice(0, 11).flatMap((e) => e.itemIds))
    expect(before.has(itemOf(plan.exercises[11]))).toBe(false)
  })

  it('tops review slots up with lesson items when fewer than three are due, and reaches for other known cards before reusing', () => {
    const plan = build({ cards: cards(card(eta.id, -1 * HOUR), card(kappa.id, +5 * HOUR)) })
    const ids = plan.exercises.slice(0, 9).map(itemOf)
    // Reuse cycles through today's items from the first one used.
    expect(ids).toEqual([eta.id, alpha.id, beta.id, gamma.id, delta.id, epsilon.id, zeta.id, kappa.id, eta.id])
    expect(plan.exercises[0].isReview).toBe(true)
    expect(plan.exercises[1].isReview).toBe(false)
    expect(plan.exercises[7].isReview).toBe(true) // known card, not due
    expect(plan.exercises[8].isReview).toBe(true) // reuse
    expect(plan.reviewItemIds).toEqual([eta.id, kappa.id])
    expect(plan.newItemIds).toEqual(expect.arrayContaining(LESSON1.map((i) => i.id)))
  })

  it('fills a later lesson from earlier lessons in the same city, in lesson order', () => {
    const plan = build({ profile: profile({ lessonProgress: { [T]: 2 } }) })
    expect(plan.lessonId).toBe('testville.2')
    const ids = plan.exercises.slice(0, 9).map(itemOf)
    expect(ids.slice(0, 6)).toEqual(LESSON2.map((i) => i.id))
    expect(ids.slice(6)).toEqual([alpha.id, beta.id, gamma.id])
    expect(itemOf(plan.exercises[9])).toBe(delta.id)
  })

  it('includes the city’s acquired items as timeline material', () => {
    // Lessons 2 and 3 lose their years, so today's items alone cannot make a timeline;
    // four acquired (not due) lesson-1 items in the same city can.
    const undated = new Set([...LESSON2, ...LESSON3].map((i) => i.id))
    const src = source({
      items: ALL_ITEMS.map((i) => {
        if (!undated.has(i.id)) return i
        const copy = { ...i } as Record<string, unknown>
        delete copy.year
        delete copy.year_end
        return copy as unknown as Item
      }),
    })
    const acquired = cards(
      card(alpha.id, +HOUR, { acquired: true }),
      card(beta.id, +HOUR, { acquired: true }),
      card(gamma.id, +HOUR, { acquired: true }),
      card(delta.id, +HOUR, { acquired: true }),
    )
    const without = build({ source: src, seed: 4, profile: profile({ lessonProgress: { [T]: 3 } }) })
    expect(without.exercises[10].type).not.toBe('timeline')

    const plan = build({ source: src, seed: 4, profile: profile({ lessonProgress: { [T]: 3 } }), cards: acquired })
    const tl = plan.exercises[10]
    expect(tl.type).toBe('timeline')
    if (tl.type !== 'timeline') return
    expect(tl.entries.map((e) => e.itemId).sort()).toEqual([alpha.id, beta.id, gamma.id, delta.id].sort())
    expect(tl.isReview).toBe(true)
    // Acquired cards that are not due were not pulled into the item slots.
    expect(plan.exercises.slice(0, 10).some((e) => acquired.has(itemOf(e)))).toBe(false)

    // Acquired items in another city do not count.
    const elsewhere = cards(card(hamletOne.id, +HOUR, { acquired: true }), card(hamletTwo.id, +HOUR, { acquired: true }))
    const other = build({ source: src, seed: 4, profile: profile({ lessonProgress: { [T]: 3 } }), cards: elsewhere })
    expect(other.exercises[10].type).not.toBe('timeline')
  })
})

describe('buildSession: lesson resolution', () => {
  it('defaults to lesson 1, follows lessonProgress, and repeats the last lesson once past it', () => {
    expect(resolveLesson(profile(), source()).id).toBe('testville.1')
    expect(resolveLesson(profile({ lessonProgress: { [T]: 3 } }), source()).id).toBe('testville.3')
    expect(resolveLesson(profile({ lessonProgress: { [T]: 99 } }), source()).id).toBe('testville.3')
  })

  it('falls back to the first mvp city with lessons when the profile’s city has none', () => {
    expect(resolveLesson(profile({ currentCityId: 'atlantis' }), source()).id).toBe('testville.1')
  })

  it('throws a clear error when there is no content at all', () => {
    expect(() => build({ source: source({ lessons: [] }) })).toThrow(/No lessons/)
  })
})

describe('buildSession: exercise types per item', () => {
  it('maps kinds and media to exercise types', () => {
    const plan = build()
    const byItem = new Map(plan.exercises.slice(0, 6).map((e) => [itemOf(e), e]))
    expect(byItem.get(alpha.id)?.type).toBe('drop-the-needle')
    expect(byItem.get(beta.id)?.type).toBe('zoom-out')
    expect(byItem.get(gamma.id)?.type).toBe('identify')
    expect(byItem.get(delta.id)?.type).toBe('identify')
    expect(byItem.get(epsilon.id)?.type).toBe('whos-who')
    expect(byItem.get(zeta.id)?.type).toBe('lexicon')

    const dtn = byItem.get(alpha.id) as ChoiceExercise
    expect(['creator', 'title']).toContain(dtn.askFor)
    const zoom = byItem.get(beta.id) as ChoiceExercise
    expect(zoom.askFor).toBe('creator')
    expect(zoom.question).toBe('Who painted this?')
    const who = byItem.get(epsilon.id) as ChoiceExercise
    expect(who.askFor).toBe('person')
    expect(who.options.map((o) => o.label).sort()).toEqual(['Epsilon of Testville', 'Person P', 'Person Q', 'Person R'])
    const lex = byItem.get(zeta.id) as ChoiceExercise
    expect(lex.askFor).toBe('term')
    expect(lex.question).toContain('zeta')
    expect(lex.options.find((o) => o.id === lex.correctOptionId)?.label).toBe('The correct definition of zeta.')
    const ident = byItem.get(gamma.id) as ChoiceExercise
    expect(ident.askFor).toBe('creator')
    expect(ident.question).toBe('Who composed Gamma Aria?')
  })

  it('handles apocrypha, episodes, creators, venues and movements', () => {
    const plan = build({ profile: profile({ lessonProgress: { [T]: 2 } }) })
    const byItem = new Map(plan.exercises.slice(0, 6).map((e) => [itemOf(e), e]))

    const apo = byItem.get(iota.id)
    expect(apo?.type).toBe('apocrypha')
    if (apo?.type === 'apocrypha') {
      expect(apo.correctVerdict).toBe('embellished')
      expect(apo.attributedTo).toBe('Epsilon of Testville')
      expect(apo.claim).toBe('Someone said iota.')
      expect(apo.sources).toEqual(['A standard reference'])
    }

    const ep = byItem.get(theta.id) as ChoiceExercise
    expect(ep.type).toBe('identify')
    expect(ep.askFor).toBe('year')
    expect(ep.question).toBe('In which year did The Theta Rising begin?')
    expect(ep.options.find((o) => o.id === ep.correctOptionId)?.label).toBe('1789')
    for (const o of ep.options) {
      const y = Number(o.label)
      expect(Number.isInteger(y)).toBe(true)
      if (y !== 1789) expect(y >= 1789 && y <= 1794).toBe(false)
    }

    const cr = byItem.get(eta.id) as ChoiceExercise
    expect(cr.type).toBe('identify')
    expect(cr.askFor).toBe('person')
    expect(cr.question).not.toContain('Eta')
    expect(cr.question).toMatch(/Who is this\?$/)
    expect(cr.options.find((o) => o.id === cr.correctOptionId)?.label).toBe('Eta Painter')

    const ven = byItem.get(kappa.id) as ChoiceExercise
    expect(ven.askFor).toBe('title')
    expect(ven.question).not.toContain('Kappa')
    expect(ven.question).toMatch(/Which venue is this\?$/)
    expect(ven.options.map((o) => o.label).sort()).toEqual(['Teatro Mu', 'The Kappa House', 'The Lambda House', 'The Nu Rooms'])

    const mov = byItem.get(lambda.id) as ChoiceExercise
    expect(mov.askFor).toBe('title')
    expect(mov.question).toMatch(/Which movement is this\?$/)
    expect(mov.question).not.toContain('Lambdaism')
  })

  it('degrades to identify when images and themes are absent', () => {
    const stripped = source({
      items: ALL_ITEMS.map((i) => {
        const copy = { ...i } as Record<string, unknown>
        delete copy.theme
        delete copy.media
        return copy as unknown as Item
      }),
      hasImage: () => false,
    })
    const plan = build({ source: stripped })
    const types = new Set(plan.exercises.map((e) => e.type))
    expect(types.has('zoom-out')).toBe(false)
    expect(types.has('whos-who')).toBe(false)
    expect(types.has('drop-the-needle')).toBe(false)
    const byItem = new Map(plan.exercises.slice(0, 6).map((e) => [itemOf(e), e]))
    const art = byItem.get(beta.id) as ChoiceExercise
    expect(art.type).toBe('identify')
    expect(art.question).toBe('Who painted Beta Portrait?')
    const person = byItem.get(epsilon.id) as ChoiceExercise
    expect(person.type).toBe('identify')
    expect(person.question).not.toContain('Epsilon')
    expect(person.askFor).toBe('person')
    const music = byItem.get(alpha.id) as ChoiceExercise
    expect(music.type).toBe('identify')
    expect(music.question).toBe('Who composed Alpha Symphony?')
    expect(plan.exercises).toHaveLength(12)
  })

  it('keeps zoom-out for art works whose image is on disk even when the media block is declared elsewhere', () => {
    const declaredOnly = source({ hasImage: (id) => id === tau.id })
    const plan = build({ source: declaredOnly, profile: profile({ lessonProgress: { [T]: 3 } }) })
    const tauEx = plan.exercises.find((e) => itemOf(e) === tau.id)
    expect(tauEx?.type).toBe('zoom-out')
    const betaEx = build({ source: declaredOnly }).exercises.find((e) => itemOf(e) === beta.id)
    expect(betaEx?.type).toBe('identify')
  })
})

describe('buildSession: options and determinism', () => {
  it('gives every choice exercise four unique options containing the correct one', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const lesson of [1, 2, 3]) {
        const plan = build({ seed, profile: profile({ lessonProgress: { [T]: lesson } }) })
        for (const e of choices(plan)) expectWellFormedOptions(e)
      }
    }
  })

  it('is deterministic for a fixed seed and varies with the seed', () => {
    const a = build({ seed: 7 })
    const b = build({ seed: 7 })
    expect(a).toEqual(b)
    const c = build({ seed: 8 })
    expect(c.id).toBe(a.id)
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it('derives the seed from the session id when none is given', () => {
    const inputs = { profile: profile(), cards: new Map<string, CardState>(), now: NOW, source: source() }
    const a = buildSession(inputs)
    const b = buildSession(inputs)
    expect(a).toEqual(b)
    expect(a.exercises).toHaveLength(12)
    const other = buildSession({ ...inputs, attempt: 2 })
    expect(other.id).not.toBe(a.id)
  })

  it('rotates the Remark scenario by seed', () => {
    const second: Scenario = { ...scenario, id: 'scenario.testville.two' }
    const src = source({
      scenarios: [scenario, second],
      lessons: lessons.map((l) => (l.id === 'testville.1' ? { ...l, scenarioIds: [scenario.id, second.id] } : l)),
    })
    const even = build({ source: src, seed: 2 }).exercises[9]
    const odd = build({ source: src, seed: 3 }).exercises[9]
    expect(even.type).toBe('remark')
    expect(odd.type).toBe('remark')
    if (even.type === 'remark' && odd.type === 'remark') {
      expect(even.scenario.id).toBe(scenario.id)
      expect(odd.scenario.id).toBe(second.id)
    }
  })
})

describe('buildSession: thin content', () => {
  it('still yields twelve exercises for a lesson with two items, reusing them as review and never crashing', () => {
    for (const seed of [0, 1, 2, 3]) {
      const plan = build({ profile: profile({ currentCityId: H }), seed })
      expect(plan.lessonId).toBe('hamlet.1')
      expect(plan.exercises).toHaveLength(12)
      plan.exercises.forEach((e, i) => {
        expect(e.slot).toBe(i + 1)
        expect(e.id).toBe(`${plan.id}.${i + 1}`)
      })
      expect(plan.exercises.slice(0, 2).map(itemOf)).toEqual([hamletOne.id, hamletTwo.id])
      expect(plan.exercises.slice(0, 2).every((e) => !e.isReview)).toBe(true)
      expect(plan.exercises.slice(2, 10).every((e) => e.isReview)).toBe(true)
      expect(plan.exercises[10].type).not.toBe('timeline')
      expect(plan.exercises[10].type).not.toBe('match')
      expect(plan.exercises[11].isFinale).toBe(true)
      for (const e of choices(plan)) expectWellFormedOptions(e)
      expect(plan.newItemIds.sort()).toEqual([hamletOne.id, hamletTwo.id].sort())
    }
  })

  it('varies the question when a work comes round again', () => {
    const plan = build({ profile: profile({ currentCityId: H }), seed: 5 })
    const uses = plan.exercises.filter((e) => itemOf(e) === hamletOne.id && isChoice(e)) as ChoiceExercise[]
    expect(uses.length).toBeGreaterThan(2)
    expect(new Set(uses.map((u) => u.askFor)).size).toBe(2)
  })

  it('degrades an item that cannot answer its question to a title clue rather than crashing', () => {
    const undatedRho = { ...rho } as Record<string, unknown>
    delete undatedRho.year
    const src = source({ items: ALL_ITEMS.map((i) => (i.id === rho.id ? (undatedRho as unknown as Item) : i)) })
    const plan = build({ source: src, profile: profile({ lessonProgress: { [T]: 3 } }) })
    const ex = plan.exercises.find((e) => itemOf(e) === rho.id) as ChoiceExercise
    expect(ex.type).toBe('identify')
    expect(ex.askFor).toBe('title')
    expect(ex.question).toMatch(/Which event is this\?$/)
    expect(ex.question).not.toContain('Rho')
    expectWellFormedOptions(ex)
  })

  it('throws when the lesson has no items in content', () => {
    const src = source({ lessons: [{ id: 'testville.1', cityId: T, order: 1, title: 'Empty', itemIds: ['music.work.ghost'], scenarioIds: [] }] })
    expect(() => build({ source: src })).toThrow(/no items/)
  })

  it('falls back from the preferred set piece to the other, then to an item exercise', () => {
    // Lesson 3 begins with a 3-difficulty art work; strip creators from all but two works so Match is impossible on odd seeds
    // while Timeline still has material.
    const src = source({
      items: ALL_ITEMS.map((i) => (i.kind === 'work' && i.id !== nu.id && i.id !== tau.id ? ({ ...i, kind: 'movement' } as unknown as Item) : i)),
    })
    const plan = build({ source: src, seed: 3, profile: profile({ lessonProgress: { [T]: 3 } }) })
    const set = plan.exercises[10] as TimelineExercise | MatchExercise
    expect(set.type).toBe('timeline')
  })
})
