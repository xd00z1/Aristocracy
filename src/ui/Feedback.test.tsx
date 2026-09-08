import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ApocryphaExercise, ChoiceExercise, RemarkExercise, TimelineExercise } from '../engine/types'
import { Feedback } from './Feedback'

// Synthetic fixtures: never real content ids.
const arnolfini = {
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
  links: ['art.test.ambassadors', 'history.test.missing'],
  tags: [],
  sources: ['A catalogue'],
  reviewed_by: null,
} as unknown as Item

const ambassadors = {
  id: 'art.test.ambassadors',
  discipline: 'art',
  kind: 'work',
  title: 'The Test Ambassadors',
  city: 'testville',
  difficulty: 2,
  era: 'Testish',
  year: 1533,
  creator: 'Hans Tester',
  facts: ['Has a skull.'],
  remark: 'Stand to the right.',
  gaffe: 'Missing the skull.',
  links: [],
  tags: [],
  sources: ['A catalogue'],
  reviewed_by: null,
} as unknown as Item

const items: Record<string, Item> = { [arnolfini.id]: arnolfini }
const lookup = (id: string) => ({ [arnolfini.id]: arnolfini, [ambassadors.id]: ambassadors })[id]

const choice: ChoiceExercise = {
  id: 's.1',
  type: 'identify',
  itemIds: [arnolfini.id],
  itemId: arnolfini.id,
  isReview: false,
  slot: 1,
  askFor: 'creator',
  question: 'Who painted this?',
  options: [
    { id: 'a', label: 'Hans Memling' },
    { id: 'b', label: 'Jan Tester' },
    { id: 'c', label: 'Rogier' },
    { id: 'd', label: 'Holbein' },
  ],
  correctOptionId: 'b',
}

function answer(partial: Partial<Answer>): Answer {
  return { exerciseId: 's.1', correct: true, itemIds: [arnolfini.id], msElapsed: 1000, ...partial }
}

afterEach(cleanup)

describe('Feedback', () => {
  it('praises a correct choice dryly and shows remark, gaffe and linked titles', () => {
    render(<Feedback exercise={choice} answer={answer({ correct: true, chosen: 'b' })} items={items} lookup={lookup} />)
    const panel = screen.getByTestId('feedback')
    expect(panel.getAttribute('data-correct')).toBe('true')
    expect(screen.getByTestId('feedback-verdict').textContent).toBe('Quite right.')
    expect(screen.queryByTestId('feedback-answer')).toBeNull()
    expect(screen.getByTestId('feedback-remark').textContent).toBe('Look at the mirror.')
    expect(screen.getByText('What not to say')).toBeTruthy()
    expect(screen.getByTestId('feedback-gaffe').textContent).toBe('Calling it a wedding.')
    const links = screen.getByTestId('feedback-links')
    expect(within(links).getByText('See also')).toBeTruthy()
    expect(links.textContent).toContain('The Test Ambassadors')
    // Unresolvable links are simply omitted.
    expect(links.textContent).not.toContain('missing')
  })

  it('names the right answer and what was chosen when wrong', () => {
    render(<Feedback exercise={choice} answer={answer({ correct: false, chosen: 'a' })} items={items} />)
    expect(screen.getByTestId('feedback').getAttribute('data-correct')).toBe('false')
    expect(screen.getByTestId('feedback-verdict').textContent).toBe('Not quite.')
    const line = screen.getByTestId('feedback-answer')
    expect(line.textContent).toContain('The answer is Jan Tester')
    expect(line.textContent).toContain('You chose Hans Memling')
    expect(screen.getByTestId('feedback-remark')).toBeTruthy()
    // Without a lookup, links that are not among the items are not shown.
    expect(screen.queryByTestId('feedback-links')).toBeNull()
  })

  it('shows the chosen reply’s explanation and the graceful reply for a Remark', () => {
    const remark: RemarkExercise = {
      id: 's.10',
      type: 'remark',
      itemIds: [arnolfini.id, ambassadors.id],
      isReview: false,
      slot: 10,
      scenario: {
        id: 'scenario.test.one',
        city: 'testville',
        discipline: 'art',
        difficulty: 2,
        setting: 'A gallery.',
        prompt: 'Is it a wedding?',
        options: [
          { text: 'Certainly a wedding.', kind: 'wrong', explanation: 'Nobody is certain of that.' },
          { text: 'Panofsky thought so; the mirror is the thing.', kind: 'correct', explanation: 'Specific and generous.' },
          { text: 'Who cares.', kind: 'gaffe', explanation: 'That closes the conversation.' },
        ],
        links: [arnolfini.id, ambassadors.id],
        sources: [],
        reviewed_by: null,
      },
      options: [
        { id: 'x', text: 'Certainly a wedding.', kind: 'wrong', explanation: 'Nobody is certain of that.' },
        { id: 'y', text: 'Panofsky thought so; the mirror is the thing.', kind: 'correct', explanation: 'Specific and generous.' },
        { id: 'z', text: 'Who cares.', kind: 'gaffe', explanation: 'That closes the conversation.' },
      ],
    }
    const { unmount } = render(
      <Feedback exercise={remark} answer={answer({ exerciseId: 's.10', correct: false, chosen: 'z', remarkKind: 'gaffe' })} items={{ [arnolfini.id]: arnolfini, [ambassadors.id]: ambassadors }} />,
    )
    expect(screen.getByTestId('feedback-verdict').textContent).toBe('That one is the gaffe.')
    expect(screen.getByTestId('feedback-explanation').textContent).toBe('That closes the conversation.')
    expect(screen.getByText('The graceful reply')).toBeTruthy()
    expect(screen.getByText(/Panofsky thought so/)).toBeTruthy()
    // Linked items are listed by title; no remark or gaffe of their own.
    const links = screen.getByTestId('feedback-links')
    expect(links.textContent).toContain('The Test Portrait')
    expect(links.textContent).toContain('The Test Ambassadors')
    expect(screen.queryByTestId('feedback-gaffe')).toBeNull()
    unmount()

    render(<Feedback exercise={remark} answer={answer({ exerciseId: 's.10', correct: true, chosen: 'y', remarkKind: 'correct' })} items={{}} />)
    expect(screen.getByTestId('feedback-verdict').textContent).toBe('Well said.')
    expect(screen.getByTestId('feedback-explanation').textContent).toBe('Specific and generous.')
    expect(screen.queryByText('The graceful reply')).toBeNull()
  })

  it('lists the chronological order with years for a Timeline', () => {
    const timeline: TimelineExercise = {
      id: 's.11',
      type: 'timeline',
      itemIds: [ambassadors.id, arnolfini.id],
      isReview: false,
      slot: 11,
      question: 'Order these.',
      entries: [
        { id: 'e1', itemId: ambassadors.id, label: 'The Test Ambassadors', year: 1533 },
        { id: 'e2', itemId: arnolfini.id, label: 'The Test Portrait', year: 1434 },
      ],
      correctOrder: ['e2', 'e1'],
    }
    render(<Feedback exercise={timeline} answer={answer({ exerciseId: 's.11', correct: false })} items={{ [arnolfini.id]: arnolfini, [ambassadors.id]: ambassadors }} />)
    const list = screen.getByTestId('feedback-answer').querySelectorAll('li')
    expect(list.length).toBe(2)
    expect(list[0].textContent).toContain('1434')
    expect(list[0].textContent).toContain('The Test Portrait')
    expect(list[1].textContent).toContain('1533')
    // Multi-item exercises show each item's remark under its title, without gaffes.
    expect(screen.getAllByTestId('feedback-remark').length).toBe(2)
    expect(screen.queryByTestId('feedback-gaffe')).toBeNull()
  })

  it('shows the verdict, the truth and the sources for Apocrypha', () => {
    const apocrypha: ApocryphaExercise = {
      id: 's.5',
      type: 'apocrypha',
      itemIds: [arnolfini.id],
      itemId: arnolfini.id,
      isReview: true,
      slot: 5,
      claim: 'Let them eat cake.',
      attributedTo: 'Someone',
      correctVerdict: 'invented',
      truth: 'Rousseau wrote it down before she could have said it.',
      sources: ['Rousseau, Confessions'],
    }
    render(<Feedback exercise={apocrypha} answer={answer({ exerciseId: 's.5', correct: false, chosen: 'attested' })} items={items} />)
    const line = screen.getByTestId('feedback-answer')
    expect(line.textContent).toContain('The verdict: Invented.')
    expect(line.textContent).toContain('You said attested.')
    expect(screen.getByTestId('feedback-truth').textContent).toContain('Rousseau')
    expect(screen.getByText('Rousseau, Confessions')).toBeTruthy()
  })
})
