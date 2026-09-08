import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { ChoiceExercise } from '../engine/types'
import { Identify } from './Identify'
import type { MediaResolver } from './types'

const item = {
  id: 'history.test.episode',
  discipline: 'history',
  kind: 'episode',
  title: 'The Test Uprising',
  city: 'testville',
  difficulty: 2,
  era: 'Testish',
  year: 1848,
  facts: ['It began in March.'],
  remark: 'Say March.',
  gaffe: 'Saying April.',
  links: [],
  tags: [],
  sources: ['A chronicle'],
  reviewed_by: null,
} as unknown as Item

const exercise: ChoiceExercise = {
  id: 'sess.5',
  type: 'identify',
  itemIds: [item.id],
  itemId: item.id,
  isReview: true,
  slot: 5,
  askFor: 'year',
  question: 'In which year was The Test Uprising?',
  options: [
    { id: 'a', label: '1830' },
    { id: 'b', label: '1848' },
    { id: 'c', label: '1871' },
    { id: 'd', label: '1815' },
  ],
  correctOptionId: 'b',
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }

afterEach(cleanup)

describe('Identify', () => {
  it('renders the question and options under the exercise-identify root', () => {
    render(<Identify exercise={exercise} items={{ [item.id]: item }} answered={null} onAnswer={() => {}} media={media} soundEnabled />)
    expect(screen.getByTestId('exercise-identify')).toBeTruthy()
    expect(screen.getByText('In which year was The Test Uprising?')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('answers once with the right correct flag and locks when answered', () => {
    const onAnswer = vi.fn()
    const { rerender } = render(<Identify exercise={exercise} items={{ [item.id]: item }} answered={null} onAnswer={onAnswer} media={media} soundEnabled />)
    fireEvent.click(screen.getByTestId('option-c'))
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    const answer = onAnswer.mock.calls[0][0]
    expect(answer).toMatchObject({ exerciseId: 'sess.5', correct: false, chosen: 'c', itemIds: [item.id] })
    expect(typeof answer.msElapsed).toBe('number')
    rerender(<Identify exercise={exercise} items={{ [item.id]: item }} answered={answer} onAnswer={onAnswer} media={media} soundEnabled />)
    expect((screen.getByTestId('option-a') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.getByTestId('option-c').getAttribute('data-state')).toBe('wrong')
  })
})
