import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ChoiceExercise } from '../engine/types'
import { ChoiceBase, optionState } from './ChoiceBase'
import type { MediaResolver } from './types'

// Synthetic fixtures only; never real content ids.
const item = {
  id: 'art.test.portrait',
  discipline: 'art',
  kind: 'work',
  title: 'The Test Portrait',
  city: 'testville',
  difficulty: 1,
  era: 'Testish',
  year: 1434,
  creator: 'Jan Tester',
  facts: ['Hangs somewhere.'],
  remark: 'Look at the mirror.',
  gaffe: 'Calling it a wedding.',
  links: [],
  tags: [],
  sources: ['A catalogue'],
  reviewed_by: null,
} as unknown as Item

const exercise: ChoiceExercise = {
  id: 'sess.3',
  type: 'identify',
  itemIds: [item.id],
  itemId: item.id,
  isReview: false,
  slot: 3,
  askFor: 'creator',
  question: 'Who painted this?',
  options: [
    { id: 'a', label: 'Hans Memling' },
    { id: 'b', label: 'Jan Tester', sublabel: 'Flemish' },
    { id: 'c', label: 'Rogier van der Weyden' },
    { id: 'd', label: 'Hans Holbein' },
  ],
  correctOptionId: 'b',
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

function renderBase(extra: Partial<Parameters<typeof ChoiceBase>[0]> = {}) {
  const onAnswer = vi.fn()
  const utils = render(<ChoiceBase exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled {...extra} />)
  return { onAnswer, ...utils }
}

describe('ChoiceBase', () => {
  it('renders the question, four option buttons and the exercise root testid', () => {
    renderBase()
    expect(screen.getByTestId('exercise-identify')).toBeTruthy()
    expect(screen.getByText('Who painted this?')).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
    for (const o of exercise.options) {
      const b = screen.getByTestId(`option-${o.id}`) as HTMLButtonElement
      expect(b.tagName).toBe('BUTTON')
      expect(b.getAttribute('type')).toBe('button')
      expect(b.className).toContain('min-h-11')
      expect(b.className).toContain('border')
      expect(b.disabled).toBe(false)
      expect(b.textContent).toContain(o.label)
    }
    expect(screen.getByTestId('option-b').textContent).toContain('Flemish')
  })

  it('calls onAnswer once with correct: true and the elapsed time on the right option', () => {
    const { onAnswer } = renderBase()
    t = 2500
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toEqual({
      exerciseId: 'sess.3',
      correct: true,
      itemIds: [item.id],
      msElapsed: 2500,
      chosen: 'b',
    })
  })

  it('calls onAnswer with correct: false on a wrong option', () => {
    const { onAnswer } = renderBase()
    fireEvent.click(screen.getByTestId('option-d'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: 'd' })
  })

  it('answers only once even when tapped twice before the runner re-renders', () => {
    const { onAnswer } = renderBase()
    fireEvent.click(screen.getByTestId('option-a'))
    fireEvent.click(screen.getByTestId('option-b'))
    fireEvent.click(screen.getByTestId('option-a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ chosen: 'a', correct: false })
  })

  it('locks the buttons and marks the answer and the wrong choice once answered', () => {
    const answered: Answer = { exerciseId: 'sess.3', correct: false, itemIds: [item.id], msElapsed: 10, chosen: 'c' }
    const { onAnswer } = renderBase({ answered })
    for (const o of exercise.options) expect((screen.getByTestId(`option-${o.id}`) as HTMLButtonElement).disabled).toBe(true)
    const right = screen.getByTestId('option-b')
    const wrong = screen.getByTestId('option-c')
    expect(right.getAttribute('data-state')).toBe('correct')
    expect(right.className).toContain('border-gilt')
    expect(right.textContent).toContain('the answer')
    expect(wrong.getAttribute('data-state')).toBe('wrong')
    expect(wrong.className).toContain('border-oxblood')
    expect(wrong.textContent).toContain('your answer')
    expect(screen.getByTestId('option-a').getAttribute('data-state')).toBe('dim')
    fireEvent.click(right)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('marks only the correct option when the answer was right', () => {
    const answered: Answer = { exerciseId: 'sess.3', correct: true, itemIds: [item.id], msElapsed: 10, chosen: 'b' }
    renderBase({ answered })
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.queryByText('your answer')).toBeNull()
  })

  it('renders children above the question, a notice, and merges answerExtras into the answer', () => {
    const onAnswered = vi.fn()
    const { onAnswer } = renderBase({
      children: <p data-testid="above">Media here</p>,
      notice: 'Image not fetched yet.',
      answerExtras: () => ({ earlyFraction: 0.5 }),
      onAnswered,
    })
    const root = screen.getByTestId('exercise-identify')
    expect(root.firstElementChild?.getAttribute('data-testid')).toBe('above')
    expect(screen.getByTestId('choice-notice').textContent).toBe('Image not fetched yet.')
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, earlyFraction: 0.5 })
    expect(onAnswered).toHaveBeenCalledTimes(1)
    expect(onAnswered.mock.calls[0][0]).toBe(onAnswer.mock.calls[0][0])
  })

  it('left-aligns long options on request', () => {
    renderBase({ optionAlign: 'left' })
    expect(screen.getByTestId('option-a').className).toContain('text-left')
    cleanup()
    renderBase()
    expect(screen.getByTestId('option-a').className).toContain('text-center')
  })

  it('optionState is idle before answering and correct/wrong/dim after', () => {
    expect(optionState(exercise, null, 'b')).toBe('idle')
    const a: Answer = { exerciseId: 'sess.3', correct: false, itemIds: [], msElapsed: 0, chosen: 'a' }
    expect(optionState(exercise, a, 'b')).toBe('correct')
    expect(optionState(exercise, a, 'a')).toBe('wrong')
    expect(optionState(exercise, a, 'c')).toBe('dim')
  })
})
