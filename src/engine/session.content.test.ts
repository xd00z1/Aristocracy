/**
 * The session builder against the REAL compiled content, not fixtures.
 *
 * Every other engine test uses a synthetic ContentSource, which proves the
 * rules but says nothing about the content people actually author. Content
 * changes daily and by many hands, so this file is the net that catches a
 * lesson the engine cannot fill, an item whose distractors collide with its
 * own answer, or a timeline whose years tie. It walks every lesson of every
 * shipping city, on both seed parities, and checks the invariants a player
 * would notice.
 *
 * A failure here is usually a content bug, not an engine bug: read the item
 * id in the message and fix the YAML.
 */
import { describe, expect, it } from 'vitest'
import { citiesInOrder, getContent, getItem, lessonsForCity } from '../content'
import { OPTION_COUNT } from './distractors'
import { buildSession } from './session'
import type { Exercise, Profile } from './types'
import { isChoice } from './types'

const NOW = new Date('2026-05-14T09:00:00')

function profileFor(cityId: string, lessonOrder: number): Profile {
  return {
    id: 'me',
    createdAt: NOW.getTime(),
    titleStyle: 'plain',
    displayName: 'Traveller',
    prestige: 0,
    guineas: 0,
    standing: 0,
    lastSessionDay: null,
    countryWeekendsLeft: 2,
    countryWeekendMonth: null,
    currentCityId: cityId,
    lessonProgress: { [cityId]: lessonOrder },
    completedCities: [],
    furnishings: [],
    sessionsCompleted: 0,
    soundEnabled: true,
  }
}

/** Every lesson of every city that ships in the app today, both seed parities. */
const CASES = citiesInOrder()
  .filter((c) => c.release === 'mvp')
  .flatMap((city) =>
    lessonsForCity(city.id).flatMap((lesson) =>
      [0, 1].map((parity) => ({
        cityId: city.id,
        cityName: city.name,
        order: lesson.order,
        // Slot 11 is Timeline on even seeds and Match on odd ones, so both
        // parities are needed to exercise each set piece.
        seed: 1000 + parity,
        label: `${city.name} lesson ${lesson.order} (${parity === 0 ? 'timeline' : 'match'} seed)`,
      })),
    ),
  )

describe('the compiled content', () => {
  it('ships at least one city with lessons', () => {
    const mvp = citiesInOrder().filter((c) => c.release === 'mvp')
    expect(mvp.length).toBeGreaterThan(0)
    for (const city of mvp) expect(lessonsForCity(city.id).length).toBeGreaterThan(0)
  })

  it('resolves every item link and every scenario link', () => {
    const content = getContent()
    for (const item of content.items) {
      for (const link of item.links) {
        expect(getItem(link), `${item.id} links to missing item ${link}`).toBeDefined()
      }
    }
    for (const scenario of content.scenarios) {
      for (const link of scenario.links) {
        expect(getItem(link), `${scenario.id} links to missing item ${link}`).toBeDefined()
      }
    }
  })
})

describe.each(CASES)('a session for $label', ({ cityId, order, seed, label }) => {
  const plan = buildSession({ profile: profileFor(cityId, order), cards: new Map(), now: NOW, seed })

  it('has twelve numbered slots with unique ids, the last one the finale', () => {
    expect(plan.exercises, label).toHaveLength(12)
    expect(plan.exercises.map((e) => e.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(new Set(plan.exercises.map((e) => e.id)).size).toBe(12)
    expect(plan.exercises[11].isFinale).toBe(true)
  })

  it('touches only items that exist', () => {
    for (const exercise of plan.exercises) {
      expect(exercise.itemIds.length, `${exercise.id} touches no items`).toBeGreaterThan(0)
      for (const id of exercise.itemIds) {
        expect(getItem(id), `${exercise.id} touches missing item ${id}`).toBeDefined()
      }
    }
  })

  it('offers answerable choices: four options, the right answer present once, the wrong ones distinct', () => {
    for (const exercise of plan.exercises.filter(isChoice)) {
      const labels = exercise.options.map((o) => o.label)
      // CLAUDE.md: options are always four (three for apocrypha verdicts, which
      // are not choice exercises). Fewer means the pool could not furnish
      // distractors, which makes the question unloseable.
      expect(exercise.options.length, `${exercise.id} (${exercise.itemId}, ${exercise.askFor}) has ${labels.length} options`).toBe(
        OPTION_COUNT,
      )
      expect(new Set(labels).size, `${exercise.id} repeats an option: ${labels.join(' | ')}`).toBe(labels.length)
      const correct = exercise.options.find((o) => o.id === exercise.correctOptionId)
      expect(correct, `${exercise.id} has no option matching correctOptionId`).toBeDefined()
      expect(exercise.question.trim().length, `${exercise.id} has an empty question`).toBeGreaterThan(0)
    }
  })

  it('never puts the answer in the question', () => {
    // "In which year was 1848 and the accession of Franz Joseph?" pays full
    // Prestige for reading, and feeds a free Good into the scheduler.
    const flatten = (s: string) => s.toLowerCase().replace(/[\s\u2014\u2013"“”‘’']+/g, ' ').trim()
    for (const exercise of plan.exercises.filter(isChoice)) {
      const correct = exercise.options.find((o) => o.id === exercise.correctOptionId)
      if (!correct) continue
      const answer = flatten(correct.label)
      if (answer.length < 3) continue
      expect(
        flatten(exercise.question).includes(answer),
        `${exercise.id} (${exercise.itemId}) asks "${exercise.question}" and answers "${correct.label}"`,
      ).toBe(false)
    }
  })

  it('builds set pieces that can be solved', () => {
    for (const exercise of plan.exercises) {
      if (exercise.type === 'timeline') {
        const years = exercise.entries.map((e) => e.year)
        expect(new Set(years).size, `${exercise.id} has tied years: ${years.join(', ')}`).toBe(years.length)
        expect(new Set(exercise.correctOrder)).toEqual(new Set(exercise.entries.map((e) => e.id)))
        const byId = new Map(exercise.entries.map((e) => [e.id, e.year]))
        const ordered = exercise.correctOrder.map((id) => byId.get(id)!)
        expect([...ordered].sort((a, b) => a - b), `${exercise.id} correctOrder is not chronological`).toEqual(ordered)
      }
      if (exercise.type === 'match') {
        expect(exercise.pairs.length, `${exercise.id} needs at least three pairs`).toBeGreaterThanOrEqual(3)
        const lefts = exercise.pairs.map((p) => p.left)
        const rights = exercise.pairs.map((p) => p.right)
        expect(new Set(lefts).size, `${exercise.id} repeats a left label`).toBe(lefts.length)
        // A repeated right label would make two pairings equally correct while
        // only one is accepted, so the player could be marked wrong for a
        // defensible answer.
        expect(new Set(rights).size, `${exercise.id} repeats a right label: ${rights.join(' | ')}`).toBe(rights.length)
      }
      if (exercise.type === 'remark') {
        expect(exercise.options.map((o) => o.kind).sort()).toEqual(['correct', 'gaffe', 'wrong'])
      }
      if (exercise.type === 'apocrypha') {
        expect(['attested', 'embellished', 'invented']).toContain(exercise.correctVerdict)
        expect(exercise.truth.trim().length, `${exercise.id} has no truth text`).toBeGreaterThan(0)
      }
    }
  })

  it('is deterministic for the same seed', () => {
    const again = buildSession({ profile: profileFor(cityId, order), cards: new Map(), now: NOW, seed })
    expect(JSON.stringify(again.exercises)).toEqual(JSON.stringify(plan.exercises))
  })
})

describe('exercise variety across the whole tour', () => {
  const everyExercise: Exercise[] = citiesInOrder()
    .filter((c) => c.release === 'mvp')
    .flatMap((city) =>
      lessonsForCity(city.id).flatMap((lesson) =>
        [0, 1].flatMap(
          (parity) =>
            buildSession({
              profile: profileFor(city.id, lesson.order),
              cards: new Map(),
              now: NOW,
              seed: 1000 + parity,
            }).exercises,
        ),
      ),
    )

  it('reaches the exercise types the content can support', () => {
    const seen = new Set(everyExercise.map((e) => e.type))
    // These need no media of any kind, so thin content is no excuse for missing them.
    for (const type of ['identify', 'remark', 'timeline', 'match', 'lexicon', 'apocrypha'] as const) {
      expect(seen, `no ${type} exercise anywhere in the tour`).toContain(type)
    }
    // Zoom Out and Who's Who are deliberately NOT required here: both need an
    // image on disk, and images are fetched by `npm run media`, which is a
    // local step (the build sandbox cannot reach Wikimedia). Until it has run,
    // those items degrade to `identify` by design. If you have run it and still
    // see no zoom-out, the media index is not being picked up: re-run
    // `npm run content`.
  })

  it('plays a synthesised theme somewhere, since Drop the Needle is the signature exercise', () => {
    const needles = everyExercise.filter((e) => e.type === 'drop-the-needle')
    expect(needles.length, 'no Drop the Needle exercise in any lesson: check that music or opera items carry themes').toBeGreaterThan(0)
  })
})
