import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ApocryphaExercise } from '../engine/types'
import { Apocrypha, VERDICT_GLOSS, verdictState } from './Apocrypha'
import type { MediaResolver } from './types'

const item = {
  id: 'history.apocrypha.test-line',
  discipline: 'history',
  kind: 'apocrypha',
  title: '“Let them test cake”',
  city: 'testville',
  difficulty: 1,
  era: 'Testish',
  facts: ['Nobody said it.'],
  remark: 'It was written down when she was ten.',
  gaffe: 'Quoting it as fact.',
  links: [],
  tags: [],
  sources: ['A memoir'],
  reviewed_by: null,
  claim: 'Told that the poor had no bread, she said: let them test cake.',
  attributed_to: 'Queen Testia',
  verdict: 'invented',
  truth: 'The line appears in a memoir written when she was a child.',
} as unknown as Item

const exercise: ApocryphaExercise = {
  id: 'sess.9',
  type: 'apocrypha',
  itemIds: [item.id],
  itemId: item.id,
  isReview: false,
  slot: 9,
  claim: 'Told that the poor had no bread, she said: let them test cake.',
  attributedTo: 'Queen Testia',
  correctVerdict: 'invented',
  truth: 'The line appears in a memoir written when she was a child.',
  sources: ['A memoir, Book VI', 'A biography (2001)'],
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }
const items = { [item.id]: item }

let t = 0
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Apocrypha', () => {
  it('renders the claim in quotation marks, the attribution, and three glossed verdict buttons', () => {
    render(<Apocrypha exercise={exercise} items={items} answered={null} onAnswer={vi.fn()} media={media} soundEnabled />)
    expect(screen.getByTestId('exercise-apocrypha')).toBeTruthy()
    const claim = screen.getByTestId('apocrypha-claim')
    expect(claim.textContent).toContain('“Told that the poor had no bread, she said: let them test cake.”')
    expect(claim.textContent).toContain('attributed to Queen Testia')
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    for (const v of ['attested', 'embellished', 'invented'] as const) {
      const b = screen.getByTestId(`apocrypha-${v}`) as HTMLButtonElement
      expect(b.tagName).toBe('BUTTON')
      expect(b.disabled).toBe(false)
      expect(b.className).toContain('min-h-11')
      expect(b.textContent).toContain(VERDICT_GLOSS[v])
    }
    expect(screen.getByTestId('apocrypha-attested').textContent).toContain('Attested')
    expect(screen.queryByTestId('apocrypha-truth')).toBeNull()
    expect(screen.queryByTestId('apocrypha-sources')).toBeNull()
  })

  it('answers once with correct = chosen === correctVerdict and the chosen verdict', () => {
    const onAnswer = vi.fn()
    render(<Apocrypha exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled />)
    t = 900
    fireEvent.click(screen.getByTestId('apocrypha-invented'))
    fireEvent.click(screen.getByTestId('apocrypha-attested'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toEqual({
      exerciseId: 'sess.9',
      correct: true,
      itemIds: [item.id],
      msElapsed: 900,
      chosen: 'invented',
    })
  })

  it('a wrong verdict is reported as incorrect', () => {
    const onAnswer = vi.fn()
    render(<Apocrypha exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled />)
    fireEvent.click(screen.getByTestId('apocrypha-embellished'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: 'embellished' })
  })

  it('once answered: buttons lock, the right verdict is gilt, the wrong one oxblood; the truth is left to the Feedback panel', () => {
    const onAnswer = vi.fn()
    const answered: Answer = { exerciseId: 'sess.9', correct: false, itemIds: [item.id], msElapsed: 10, chosen: 'attested' }
    render(<Apocrypha exercise={exercise} items={items} answered={answered} onAnswer={onAnswer} media={media} soundEnabled />)
    for (const v of ['attested', 'embellished', 'invented']) expect((screen.getByTestId(`apocrypha-${v}`) as HTMLButtonElement).disabled).toBe(true)
    const right = screen.getByTestId('apocrypha-invented')
    const wrong = screen.getByTestId('apocrypha-attested')
    expect(right.getAttribute('data-state')).toBe('correct')
    expect(right.className).toContain('border-gilt')
    expect(wrong.getAttribute('data-state')).toBe('wrong')
    expect(wrong.className).toContain('border-oxblood')
    expect(screen.getByTestId('apocrypha-embellished').getAttribute('data-state')).toBe('dim')
    expect(screen.queryByTestId('apocrypha-truth')).toBeNull()
    expect(screen.queryByTestId('apocrypha-sources')).toBeNull()
    fireEvent.click(right)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('verdictState mirrors the option states', () => {
    expect(verdictState(exercise, null, 'invented')).toBe('idle')
    const a: Answer = { exerciseId: 'sess.9', correct: false, itemIds: [], msElapsed: 0, chosen: 'attested' }
    expect(verdictState(exercise, a, 'invented')).toBe('correct')
    expect(verdictState(exercise, a, 'attested')).toBe('wrong')
    expect(verdictState(exercise, a, 'embellished')).toBe('dim')
  })
})
