import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ChoiceExercise } from '../engine/types'
import type { MediaResolver } from './types'

vi.mock('../engine/distractors', () => ({
  redactNames: (text: string, names: string[]) => names.reduce((acc, n) => acc.split(n).join('———'), text),
}))

import { WhosWho, portraitClue } from './WhosWho'

const sitter = {
  id: 'history.test.queen',
  discipline: 'history',
  kind: 'person',
  title: 'Queen Testia',
  city: 'testville',
  difficulty: 1,
  era: 'Testish',
  year: 1700,
  year_end: 1760,
  role: 'Queen of Testland',
  facts: ['Queen Testia was crowned in a tent.', 'Queen Testia kept forty cats.', 'A third fact.'],
  remark: 'Mention the cats.',
  gaffe: 'Calling her a duchess.',
  links: [],
  tags: [],
  sources: ['A biography'],
  reviewed_by: null,
  media: { image: { commons: 'File:Testia.jpg', source: 'Portrait of Queen Testia by A. Painter, via Commons', license: 'Public domain' } },
} as unknown as Item

const exercise: ChoiceExercise = {
  id: 'sess.8',
  type: 'whos-who',
  itemIds: [sitter.id],
  itemId: sitter.id,
  isReview: false,
  slot: 8,
  askFor: 'person',
  question: 'Whose portrait is this?',
  options: [
    { id: 'a', label: 'Queen Testia' },
    { id: 'b', label: 'Princess Probe' },
    { id: 'c', label: 'Lady Fixture' },
    { id: 'd', label: 'Madame Mock' },
  ],
  correctOptionId: 'a',
}

const withImage: MediaResolver = { imageUrl: (id) => `/media/img/${id}.jpg`, hasImage: () => true }
const noImage: MediaResolver = { imageUrl: () => null, hasImage: () => false }
const items = { [sitter.id]: sitter }

afterEach(cleanup)

describe('WhosWho', () => {
  it('shows the portrait in a frame without naming the sitter, then the names', () => {
    render(<WhosWho exercise={exercise} items={items} answered={null} onAnswer={vi.fn()} media={withImage} soundEnabled />)
    expect(screen.getByTestId('exercise-whos-who')).toBeTruthy()
    const img = screen.getByTestId('portrait-image') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(`/media/img/${sitter.id}.jpg`)
    expect(img.getAttribute('alt')).toBe('A portrait')
    expect(screen.getByTestId('portrait').className).toContain('max-w-xs')
    expect(screen.getByTestId('portrait').querySelector('.border-double')).toBeTruthy()
    expect(screen.queryByTestId('portrait-credit')).toBeNull()
    expect(screen.getByText('Whose portrait is this?')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.queryByTestId('portrait-clue')).toBeNull()
  })

  it('answers once, locks, and reveals the credit line once answered', () => {
    const onAnswer = vi.fn()
    const { rerender } = render(<WhosWho exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={withImage} soundEnabled />)
    fireEvent.click(screen.getByTestId('option-a'))
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    const answer = onAnswer.mock.calls[0][0] as Answer
    expect(answer).toMatchObject({ exerciseId: 'sess.8', correct: true, chosen: 'a', itemIds: [sitter.id] })
    rerender(<WhosWho exercise={exercise} items={items} answered={answer} onAnswer={onAnswer} media={withImage} soundEnabled />)
    expect((screen.getByTestId('option-b') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-a').getAttribute('data-state')).toBe('correct')
    expect(screen.getByTestId('portrait-credit').textContent).toContain('A. Painter')
  })

  it('without an image falls back to a notice and redacted facts, and stays answerable', () => {
    const onAnswer = vi.fn()
    render(<WhosWho exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={noImage} soundEnabled />)
    expect(screen.queryByTestId('portrait-image')).toBeNull()
    expect(screen.getByTestId('choice-notice').textContent).toBe('Portrait not fetched yet.')
    const clue = screen.getByTestId('portrait-clue')
    expect(clue.textContent).toContain('Queen of Testland')
    expect(clue.textContent).toContain('——— was crowned in a tent.')
    expect(clue.textContent).toContain('——— kept forty cats.')
    expect(clue.textContent).not.toContain('A third fact.')
    expect(clue.textContent).not.toContain('Queen Testia')
    fireEvent.click(screen.getByTestId('option-c'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: 'c' })
  })

  it('portraitClue handles a missing item', () => {
    expect(portraitClue(undefined)).toEqual([])
    expect(portraitClue(sitter)).toHaveLength(2)
  })
})
