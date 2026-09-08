import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import { hashString, mulberry32, shuffle, type Answer, type MatchExercise } from '../engine/types'
import { FLASH_MS, MAX_MISTAKES, Match, rightColumn } from './Match'
import type { MediaResolver } from './types'

// Synthetic fixtures only; never real content ids.
function makeItem(id: string, title: string, creator: string): Item {
  return {
    id,
    discipline: 'art',
    kind: 'work',
    title,
    city: 'testville',
    difficulty: 1,
    era: 'Testish',
    year: 1500,
    creator,
    facts: ['A fact.'],
    remark: 'A remark.',
    gaffe: 'A gaffe.',
    links: [],
    tags: [],
    sources: ['A source'],
    reviewed_by: null,
  } as unknown as Item
}

const items: Record<string, Item> = {
  'art.test.one': makeItem('art.test.one', 'The Annunciation', 'Painter One'),
  'art.test.two': makeItem('art.test.two', 'The Deposition', 'Painter Two'),
  'art.test.three': makeItem('art.test.three', 'The Tribute', 'Painter Three'),
  'art.test.four': makeItem('art.test.four', 'The Feast', 'Painter Four'),
}

const exercise: MatchExercise = {
  id: 'sess.11',
  type: 'match',
  itemIds: Object.keys(items),
  isReview: false,
  slot: 11,
  question: 'Match each work to its creator.',
  pairs: [
    { id: 'a', itemId: 'art.test.one', left: 'The Annunciation', right: 'Painter One' },
    { id: 'b', itemId: 'art.test.two', left: 'The Deposition', right: 'Painter Two' },
    { id: 'c', itemId: 'art.test.three', left: 'The Tribute', right: 'Painter Three' },
    { id: 'd', itemId: 'art.test.four', left: 'The Feast', right: 'Painter Four' },
  ],
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
  vi.useRealTimers()
})

function renderMatch(extra: Partial<Parameters<typeof Match>[0]> = {}) {
  const onAnswer = vi.fn()
  const utils = render(<Match exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled {...extra} />)
  return { onAnswer, ...utils }
}

const left = (id: string) => screen.getByTestId(`match-left-${id}`) as HTMLButtonElement
const right = (id: string) => screen.getByTestId(`match-right-${id}`) as HTMLButtonElement
const mistakes = () => screen.getByTestId('match-mistakes').textContent
const pairUp = (id: string) => {
  fireEvent.click(left(id))
  fireEvent.click(right(id))
}
const columnIds = (testid: string) =>
  within(screen.getByTestId(testid))
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-testid')!.split('-').pop())

describe('rightColumn', () => {
  it('is the pairs shuffled by mulberry32(hashString(exercise.id)), the same every time', () => {
    const expected = shuffle(exercise.pairs, mulberry32(hashString(exercise.id))).map((p) => p.id)
    const a = rightColumn(exercise).map((p) => p.id)
    const b = rightColumn(exercise).map((p) => p.id)
    expect(a).toEqual(b)
    expect([...a].sort()).toEqual(['a', 'b', 'c', 'd'])
    // Either the plain shuffle, or (only when the shuffle would line up with the left column) that shuffle rotated by one.
    const aligned = expected.every((id, i) => id === exercise.pairs[i].id)
    expect(a).toEqual(aligned ? [...expected.slice(1), expected[0]] : expected)
  })

  it('never lines the right column up with the left', () => {
    const pairs = exercise.pairs.slice(0, 3)
    let alignedId: string | null = null
    for (let n = 0; n < 500 && alignedId === null; n++) {
      const id = `sess-${n}.11`
      const s = shuffle(pairs, mulberry32(hashString(id)))
      if (s.every((p, i) => p.id === pairs[i].id)) alignedId = id
    }
    expect(alignedId).not.toBeNull()
    const col = rightColumn({ id: alignedId as string, pairs }).map((p) => p.id)
    expect(col).not.toEqual(pairs.map((p) => p.id))
    expect([...col].sort()).toEqual(['a', 'b', 'c'])
    // Different ids may give different boards; the same id always gives the same one.
    expect(rightColumn({ id: alignedId as string, pairs })).toEqual(rightColumn({ id: alignedId as string, pairs }))
  })
})

describe('Match', () => {
  it('renders the question, the left column in pair order, the right column in the seeded order, and Mistakes: 0', () => {
    renderMatch()
    expect(screen.getByTestId('exercise-match')).toBeTruthy()
    expect(screen.getByText(exercise.question)).toBeTruthy()
    expect(columnIds('match-left-column')).toEqual(['a', 'b', 'c', 'd'])
    expect(columnIds('match-right-column')).toEqual(rightColumn(exercise).map((p) => p.id))
    for (const p of exercise.pairs) {
      expect(left(p.id).textContent).toBe(p.left)
      expect(right(p.id).textContent).toBe(p.right)
      for (const b of [left(p.id), right(p.id)]) {
        expect(b.tagName).toBe('BUTTON')
        expect(b.getAttribute('type')).toBe('button')
        expect(b.className).toContain('min-h-11')
        expect(b.disabled).toBe(false)
        expect(b.getAttribute('data-state')).toBe('idle')
      }
    }
    expect(screen.getAllByRole('button')).toHaveLength(8)
    expect(mistakes()).toBe('Mistakes: 0')
  })

  it('selects a left, then a matching right locks and dims both without a mistake', () => {
    const { onAnswer } = renderMatch()
    fireEvent.click(left('b'))
    expect(left('b').getAttribute('data-state')).toBe('selected')
    expect(left('b').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(right('b'))
    expect(left('b').getAttribute('data-state')).toBe('locked')
    expect(right('b').getAttribute('data-state')).toBe('locked')
    expect(left('b').disabled).toBe(true)
    expect(right('b').disabled).toBe(true)
    expect(left('a').getAttribute('data-state')).toBe('idle')
    expect(mistakes()).toBe('Mistakes: 0')
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('a wrong pair flashes both buttons oxblood, counts a mistake, clears the selection, and the flash fades', () => {
    vi.useFakeTimers()
    const { onAnswer } = renderMatch()
    fireEvent.click(left('a'))
    fireEvent.click(right('c'))
    expect(mistakes()).toBe('Mistakes: 1')
    expect(left('a').getAttribute('data-state')).toBe('wrong')
    expect(right('c').getAttribute('data-state')).toBe('wrong')
    expect(left('a').className).toContain('border-oxblood')
    expect(right('c').className).toContain('border-oxblood')
    expect(left('a').disabled).toBe(false)
    expect(right('c').disabled).toBe(false)
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    act(() => {
      vi.advanceTimersByTime(FLASH_MS + 10)
    })
    expect(left('a').getAttribute('data-state')).toBe('idle')
    expect(right('c').getAttribute('data-state')).toBe('idle')
    fireEvent.click(left('a'))
    fireEvent.click(right('d'))
    expect(mistakes()).toBe('Mistakes: 2')
    expect(screen.getByTestId('match-mistakes').className).toContain('text-oxblood')
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('tapping a right first then a left also pairs; tapping the selected button again deselects; another on the same side switches', () => {
    renderMatch()
    fireEvent.click(right('c'))
    expect(right('c').getAttribute('data-state')).toBe('selected')
    fireEvent.click(right('c'))
    expect(right('c').getAttribute('data-state')).toBe('idle')
    fireEvent.click(left('a'))
    fireEvent.click(left('b'))
    expect(left('a').getAttribute('data-state')).toBe('idle')
    expect(left('b').getAttribute('data-state')).toBe('selected')
    fireEvent.click(right('c'))
    expect(mistakes()).toBe('Mistakes: 1')
    fireEvent.click(right('c'))
    fireEvent.click(left('c'))
    expect(left('c').getAttribute('data-state')).toBe('locked')
    expect(right('c').getAttribute('data-state')).toBe('locked')
    expect(mistakes()).toBe('Mistakes: 1')
  })

  it('answers once with correct: true and chosen = the pair ids in matched order when every pair locks with no mistakes', () => {
    const { onAnswer } = renderMatch()
    for (const id of ['d', 'a', 'c']) pairUp(id)
    expect(onAnswer).not.toHaveBeenCalled()
    t = 6100
    pairUp('b')
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toEqual({
      exerciseId: 'sess.11',
      correct: true,
      itemIds: exercise.itemIds,
      msElapsed: 6100,
      chosen: ['d', 'a', 'c', 'b'],
    })
    for (const p of exercise.pairs) {
      expect(left(p.id).disabled).toBe(true)
      expect(right(p.id).disabled).toBe(true)
    }
  })

  it('one mistake is still correct', () => {
    const { onAnswer } = renderMatch()
    fireEvent.click(left('a'))
    fireEvent.click(right('b'))
    expect(mistakes()).toBe('Mistakes: 1')
    for (const id of ['a', 'b', 'c', 'd']) pairUp(id)
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, chosen: ['a', 'b', 'c', 'd'] })
    expect(MAX_MISTAKES).toBe(1)
  })

  it('two mistakes make the answer incorrect, and onAnswer still fires exactly once', () => {
    const { onAnswer } = renderMatch()
    fireEvent.click(left('a'))
    fireEvent.click(right('b'))
    fireEvent.click(left('a'))
    fireEvent.click(right('c'))
    expect(mistakes()).toBe('Mistakes: 2')
    for (const id of ['a', 'b', 'c', 'd']) pairUp(id)
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: ['a', 'b', 'c', 'd'] })
    // Nothing left to tap; further clicks change nothing.
    fireEvent.click(left('a'))
    fireEvent.click(right('a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('a locked pair cannot be tapped again and a mistake with a locked partner is impossible', () => {
    renderMatch()
    pairUp('a')
    fireEvent.click(left('a'))
    expect(left('a').getAttribute('data-state')).toBe('locked')
    fireEvent.click(left('b'))
    fireEvent.click(right('a'))
    expect(mistakes()).toBe('Mistakes: 0')
    expect(left('b').getAttribute('data-state')).toBe('selected')
  })

  it('once answered: every button locks and stays locked whatever is tapped', () => {
    const answered: Answer = { exerciseId: 'sess.11', correct: true, itemIds: exercise.itemIds, msElapsed: 10, chosen: ['a', 'b', 'c', 'd'] }
    const { onAnswer } = renderMatch({ answered })
    for (const p of exercise.pairs) {
      expect(left(p.id).disabled).toBe(true)
      expect(right(p.id).disabled).toBe(true)
      expect(left(p.id).getAttribute('data-state')).toBe('locked')
      expect(right(p.id).getAttribute('data-state')).toBe('locked')
    }
    fireEvent.click(left('a'))
    fireEvent.click(right('b'))
    expect(mistakes()).toBe('Mistakes: 0')
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('locks when the answer arrives on the same instance', () => {
    const { onAnswer, rerender } = renderMatch()
    for (const id of ['a', 'b', 'c', 'd']) pairUp(id)
    const answered = onAnswer.mock.calls[0][0] as Answer
    rerender(<Match exercise={exercise} items={items} answered={answered} onAnswer={onAnswer} media={media} soundEnabled />)
    for (const p of exercise.pairs) expect(left(p.id).getAttribute('data-state')).toBe('locked')
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
