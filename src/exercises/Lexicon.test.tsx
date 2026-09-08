import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { ChoiceExercise } from '../engine/types'
import { Lexicon } from './Lexicon'
import type { MediaResolver } from './types'

const term = {
  id: 'music.test.term',
  discipline: 'music',
  kind: 'term',
  title: 'Testando',
  city: 'testville',
  difficulty: 1,
  era: 'Testish',
  facts: ['A made-up word.'],
  remark: 'Use it sparingly.',
  gaffe: 'Using it of a tempo.',
  links: [],
  tags: [],
  sources: ['A dictionary'],
  reviewed_by: null,
  definition: 'A passage played as if under test.',
  pronunciation: 'tes-TAHN-doh',
  language: 'Italian',
} as unknown as Item

const bare = { ...term, id: 'music.test.bare', pronunciation: undefined, language: undefined } as unknown as Item

const LONG = 'A German art song for solo voice and piano, in which the piano is a partner rather than an accompaniment; the plural is Lieder.'

function exerciseFor(item: Item): ChoiceExercise {
  return {
    id: 'sess.7',
    type: 'lexicon',
    itemIds: [item.id],
    itemId: item.id,
    isReview: false,
    slot: 7,
    askFor: 'term',
    question: 'What does “Testando” mean?',
    options: [
      { id: 'a', label: LONG },
      { id: 'b', label: 'A passage played as if under test.' },
      { id: 'c', label: 'A dance in triple time.' },
      { id: 'd', label: 'A choral movement in an oratorio.' },
    ],
    correctOptionId: 'b',
  }
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }

afterEach(cleanup)

describe('Lexicon', () => {
  it('shows the term large with pronunciation and language, then the question and definitions', () => {
    render(<Lexicon exercise={exerciseFor(term)} items={{ [term.id]: term }} answered={null} onAnswer={vi.fn()} media={media} soundEnabled />)
    expect(screen.getByTestId('exercise-lexicon')).toBeTruthy()
    const head = screen.getByTestId('lexicon-term')
    expect(head.textContent).toContain('Testando')
    expect(head.querySelector('.text-4xl')?.textContent).toBe('Testando')
    expect(screen.getByTestId('lexicon-meta').textContent).toBe('tes-TAHN-doh · Italian')
    expect(screen.getByText('What does “Testando” mean?')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(4)
    const long = screen.getByTestId('option-a')
    expect(long.textContent).toContain(LONG)
    expect(long.className).toContain('text-left')
    expect(long.className).not.toContain('truncate')
  })

  it('omits the pronunciation line when the item has none', () => {
    render(<Lexicon exercise={exerciseFor(bare)} items={{ [bare.id]: bare }} answered={null} onAnswer={vi.fn()} media={media} soundEnabled />)
    expect(screen.getByTestId('lexicon-term').textContent).toContain('Testando')
    expect(screen.queryByTestId('lexicon-meta')).toBeNull()
  })

  it('answers once with the right correct flag and locks when answered', () => {
    const onAnswer = vi.fn()
    const props = { exercise: exerciseFor(term), items: { [term.id]: term }, media, soundEnabled: true }
    const { rerender } = render(<Lexicon {...props} answered={null} onAnswer={onAnswer} />)
    fireEvent.click(screen.getByTestId('option-b'))
    fireEvent.click(screen.getByTestId('option-a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    const answer = onAnswer.mock.calls[0][0]
    expect(answer).toMatchObject({ exerciseId: 'sess.7', correct: true, chosen: 'b', itemIds: [term.id] })
    rerender(<Lexicon {...props} answered={answer} onAnswer={onAnswer} />)
    for (const id of ['a', 'b', 'c', 'd']) expect((screen.getByTestId(`option-${id}`) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
  })
})
