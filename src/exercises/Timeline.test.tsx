import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, TimelineExercise } from '../engine/types'
import { Timeline, isCorrectOrder, ordinal, yearLabel } from './Timeline'
import type { MediaResolver } from './types'

// Synthetic fixtures only; never real content ids.
function makeItem(id: string, title: string, year: number, extra: Record<string, unknown> = {}): Item {
  return {
    id,
    discipline: 'music',
    kind: 'work',
    title,
    city: 'testville',
    difficulty: 1,
    era: 'Testish',
    year,
    creator: 'A. Tester',
    facts: ['A fact.'],
    remark: 'A remark.',
    gaffe: 'A gaffe.',
    links: [],
    tags: [],
    sources: ['A source'],
    reviewed_by: null,
    ...extra,
  } as unknown as Item
}

const items: Record<string, Item> = {
  'music.test.first': makeItem('music.test.first', 'The First', 1701),
  'music.test.second': makeItem('music.test.second', 'The Second', 1750, { year_approx: true }),
  'music.test.third': makeItem('music.test.third', 'The Third', 1803),
  'music.test.fourth': makeItem('music.test.fourth', 'The Fourth', 1888),
}

// Presented (shuffled) order: c, a, d, b. Correct order: a, b, c, d.
const exercise: TimelineExercise = {
  id: 'sess.11',
  type: 'timeline',
  itemIds: ['music.test.third', 'music.test.first', 'music.test.fourth', 'music.test.second'],
  isReview: false,
  slot: 11,
  question: 'Put these in chronological order, earliest first.',
  entries: [
    { id: 'c', itemId: 'music.test.third', label: 'The Third', sublabel: 'A. Tester', year: 1803 },
    { id: 'a', itemId: 'music.test.first', label: 'The First', sublabel: 'A. Tester', year: 1701 },
    { id: 'd', itemId: 'music.test.fourth', label: 'The Fourth', year: 1888 },
    { id: 'b', itemId: 'music.test.second', label: 'The Second', sublabel: 'A. Tester', year: 1750 },
  ],
  correctOrder: ['a', 'b', 'c', 'd'],
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }

let t = 0
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderTimeline(extra: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const onAnswer = vi.fn()
  const utils = render(<Timeline exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled {...extra} />)
  return { onAnswer, ...utils }
}

const entry = (id: string) => screen.getByTestId(`timeline-entry-${id}`) as HTMLButtonElement
const reset = () => screen.getByTestId('timeline-reset') as HTMLButtonElement
const submit = () => screen.getByTestId('timeline-submit') as HTMLButtonElement
const poolIds = () => screen.queryAllByTestId(/^timeline-entry-/).map((b) => b.getAttribute('data-testid')!.replace('timeline-entry-', ''))
const placedIds = () =>
  within(screen.getByTestId('timeline-placed'))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-entry'))

describe('Timeline', () => {
  it('renders the question, the pool in presented order with label and sublabel but no year, and disabled buttons', () => {
    renderTimeline()
    expect(screen.getByTestId('exercise-timeline')).toBeTruthy()
    expect(screen.getByText(exercise.question)).toBeTruthy()
    expect(poolIds()).toEqual(['c', 'a', 'd', 'b'])
    for (const e of exercise.entries) {
      const b = entry(e.id)
      expect(b.tagName).toBe('BUTTON')
      expect(b.getAttribute('type')).toBe('button')
      expect(b.className).toContain('min-h-11')
      expect(b.textContent).toContain(e.label)
      if (e.sublabel) expect(b.textContent).toContain(e.sublabel)
      expect(b.textContent).not.toContain(String(e.year))
    }
    expect(screen.getByTestId('exercise-timeline').textContent).not.toMatch(/1[6-9]\d\d/)
    expect(placedIds()).toEqual(['', '', '', ''])
    expect(reset().disabled).toBe(true)
    expect(submit().disabled).toBe(true)
    expect(reset().textContent).toBe('Start again')
    expect(submit().textContent).toBe('Submit')
  })

  it('hands keyboard focus on: the next entry in the pool, then Submit, and says what was placed', () => {
    renderTimeline()
    // The button that was pressed unmounts, so focus has to be given somewhere
    // deliberately or it falls to <body> and the reader tabs in from the top.
    const order = poolIds()
    entry(order[0]).focus()
    fireEvent.click(entry(order[0]))
    expect(document.activeElement).toBe(entry(order[1]))
    expect(screen.getByTestId('timeline-status').textContent).toContain('placed 1st')
    expect(screen.getByTestId('timeline-status').textContent).toContain('3 to go')

    for (const id of order.slice(1)) fireEvent.click(entry(id))
    expect(document.activeElement).toBe(submit())
    expect(screen.getByTestId('timeline-status').textContent).toContain('placed 4th')
    expect(screen.getByTestId('timeline-status').textContent).toContain('submit when ready')
  })

  it('tapping an entry appends it to the numbered list and removes it from the pool; Submit enables once every entry is placed', () => {
    renderTimeline()
    fireEvent.click(entry('a'))
    expect(placedIds()).toEqual(['a', '', '', ''])
    expect(poolIds()).toEqual(['c', 'd', 'b'])
    expect(reset().disabled).toBe(false)
    expect(submit().disabled).toBe(true)
    const first = within(screen.getByTestId('timeline-placed')).getAllByRole('listitem')[0]
    expect(first.textContent).toContain('1.')
    expect(first.textContent).toContain('The First')

    fireEvent.click(entry('b'))
    fireEvent.click(entry('c'))
    expect(placedIds()).toEqual(['a', 'b', 'c', ''])
    expect(submit().disabled).toBe(true)
    fireEvent.click(entry('d'))
    expect(placedIds()).toEqual(['a', 'b', 'c', 'd'])
    expect(poolIds()).toEqual([])
    expect(submit().disabled).toBe(false)
  })

  it('Start again empties the list, restores the pool in presented order and disables Submit', () => {
    const { onAnswer } = renderTimeline()
    fireEvent.click(entry('d'))
    fireEvent.click(entry('a'))
    fireEvent.click(entry('b'))
    fireEvent.click(entry('c'))
    expect(submit().disabled).toBe(false)
    fireEvent.click(reset())
    expect(placedIds()).toEqual(['', '', '', ''])
    expect(poolIds()).toEqual(['c', 'a', 'd', 'b'])
    expect(submit().disabled).toBe(true)
    expect(reset().disabled).toBe(true)
    expect(onAnswer).not.toHaveBeenCalled()
    // The board is fully usable again after a reset.
    for (const id of exercise.correctOrder) fireEvent.click(entry(id))
    expect(placedIds()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('submits once with correct: true and chosen = the placed ids when the order is right', () => {
    const { onAnswer } = renderTimeline()
    for (const id of exercise.correctOrder) fireEvent.click(entry(id))
    t = 4200
    fireEvent.click(submit())
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toEqual({
      exerciseId: 'sess.11',
      correct: true,
      itemIds: exercise.itemIds,
      msElapsed: 4200,
      chosen: ['a', 'b', 'c', 'd'],
    })
  })

  it('submits with correct: false when the order is wrong, and fires exactly once', () => {
    const { onAnswer } = renderTimeline()
    for (const id of ['a', 'c', 'b', 'd']) fireEvent.click(entry(id))
    fireEvent.click(submit())
    fireEvent.click(submit())
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: ['a', 'c', 'b', 'd'] })
  })

  it('does not answer while entries remain in the pool', () => {
    const { onAnswer } = renderTimeline()
    fireEvent.click(entry('a'))
    fireEvent.click(entry('b'))
    fireEvent.click(submit())
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('once answered: shows the entries in correct order with their years, misplaced ones in oxblood, and no controls', () => {
    const answered: Answer = { exerciseId: 'sess.11', correct: false, itemIds: exercise.itemIds, msElapsed: 10, chosen: ['a', 'c', 'b', 'd'] }
    const { onAnswer } = renderTimeline({ answered })
    expect(screen.queryByTestId('timeline-pool')).toBeNull()
    expect(screen.queryByTestId('timeline-submit')).toBeNull()
    expect(screen.queryByTestId('timeline-reset')).toBeNull()
    expect(screen.queryAllByTestId(/^timeline-entry-/)).toHaveLength(0)

    const result = screen.getByTestId('timeline-result')
    const rows = within(result).getAllByRole('listitem')
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['timeline-result-a', 'timeline-result-b', 'timeline-result-c', 'timeline-result-d'])
    expect(screen.getByTestId('timeline-year-a').textContent).toBe('1701')
    expect(screen.getByTestId('timeline-year-b').textContent).toBe('c. 1750')
    expect(screen.getByTestId('timeline-year-c').textContent).toBe('1803')
    expect(screen.getByTestId('timeline-year-d').textContent).toBe('1888')

    const a = screen.getByTestId('timeline-result-a')
    const b = screen.getByTestId('timeline-result-b')
    const c = screen.getByTestId('timeline-result-c')
    const d = screen.getByTestId('timeline-result-d')
    expect(a.getAttribute('data-state')).toBe('correct')
    expect(d.getAttribute('data-state')).toBe('correct')
    expect(b.getAttribute('data-state')).toBe('misplaced')
    expect(c.getAttribute('data-state')).toBe('misplaced')
    expect(b.className).toContain('border-oxblood')
    expect(c.className).toContain('border-oxblood')
    expect(a.className).not.toContain('border-oxblood')
    expect(a.className).toContain('border-gilt')
    expect(b.textContent).toContain('you had it 3rd')
    expect(c.textContent).toContain('you had it 2nd')
    expect(a.textContent).not.toContain('you had it')
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('once answered correctly: nothing is in oxblood', () => {
    const answered: Answer = { exerciseId: 'sess.11', correct: true, itemIds: exercise.itemIds, msElapsed: 10, chosen: ['a', 'b', 'c', 'd'] }
    renderTimeline({ answered })
    for (const id of exercise.correctOrder) {
      const row = screen.getByTestId(`timeline-result-${id}`)
      expect(row.getAttribute('data-state')).toBe('correct')
      expect(row.className).not.toContain('border-oxblood')
    }
  })

  it('reveals from local state when the runner re-renders the same instance with the answer', () => {
    const { onAnswer, rerender } = renderTimeline()
    for (const id of ['d', 'a', 'b', 'c']) fireEvent.click(entry(id))
    fireEvent.click(submit())
    const answered = onAnswer.mock.calls[0][0] as Answer
    // Even without `chosen`, the component remembers what was placed.
    rerender(<Timeline exercise={exercise} items={items} answered={{ ...answered, chosen: undefined }} onAnswer={onAnswer} media={media} soundEnabled />)
    expect(screen.getByTestId('timeline-result-d').getAttribute('data-state')).toBe('misplaced')
    expect(screen.getByTestId('timeline-result-a').getAttribute('data-state')).toBe('misplaced')
    expect(screen.getByTestId('timeline-result-d').textContent).toContain('you had it 1st')
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('isCorrectOrder, ordinal and yearLabel', () => {
    expect(isCorrectOrder(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(isCorrectOrder(['b', 'a'], ['a', 'b'])).toBe(false)
    expect(isCorrectOrder(['a'], ['a', 'b'])).toBe(false)
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'])
    expect(yearLabel(exercise.entries[0], undefined)).toBe('1803')
    expect(yearLabel(exercise.entries[3], items['music.test.second'])).toBe('c. 1750')
  })
})
