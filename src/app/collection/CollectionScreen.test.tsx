import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../../content/types'
import type { CardState } from '../../engine/types'

const deps = vi.hoisted(() => ({
  collection: vi.fn(),
  getItem: vi.fn(),
}))
vi.mock('./deps', () => deps)

import CollectionScreen, { yearLabel } from './CollectionScreen'

const base = {
  city: 'testville',
  difficulty: 1 as const,
  era: 'An era',
  facts: ['A fact.'],
  gaffe: 'A gaffe.',
  links: [],
  tags: [],
  sources: ['A source.'],
  reviewed_by: null,
}

const ITEMS: Record<string, Item> = {
  'music.test.symphony': { ...base, id: 'music.test.symphony', discipline: 'music', kind: 'work', title: 'A Symphony', creator: 'A. Composer', year: 1808, remark: 'Say this about the symphony.' },
  'art.test.portrait': { ...base, id: 'art.test.portrait', discipline: 'art', kind: 'work', title: 'A Portrait', creator: 'A. Painter', year: 1665, year_approx: true, remark: 'Say this about the portrait.' },
  'history.test.person': { ...base, id: 'history.test.person', discipline: 'history', kind: 'person', title: 'A Duchess', year: 1757, year_end: 1806, remark: 'Say this about the duchess.' },
  'opera.test.term': { ...base, id: 'opera.test.term', discipline: 'opera', kind: 'term', title: 'Bel canto', definition: 'Beautiful singing.', remark: 'Say this about bel canto.' },
}

function card(itemId: string, acquiredAt: number): CardState {
  return { itemId, due: 0, stability: 10, difficulty: 5, reps: 3, lapses: 0, state: 2, correctDays: [], acquired: true, acquiredAt }
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  deps.getItem.mockImplementation((id: string) => ITEMS[id])
  deps.collection.mockResolvedValue([
    card('art.test.portrait', 1),
    card('music.test.symphony', 2),
    card('history.test.person', 3),
    card('opera.test.term', 4),
    card('music.gone.from-content', 5),
  ])
})

describe('CollectionScreen', () => {
  it('groups acquired items by discipline with creator, year and remark', async () => {
    render(<CollectionScreen />)
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByTestId('collection-screen')

    // The card whose item has left the content is not counted.
    expect(screen.getByText('4 items acquired.')).toBeTruthy()
    const groups = screen.getAllByTestId(/^collection-group-/).map((el) => el.getAttribute('data-testid'))
    expect(groups).toEqual(['collection-group-music', 'collection-group-opera', 'collection-group-art', 'collection-group-history'])

    const symphony = screen.getByTestId('collection-item-music.test.symphony')
    expect(symphony.textContent).toContain('A Symphony')
    expect(symphony.textContent).toContain('A. Composer · 1808')
    expect(symphony.textContent).toContain('Say this about the symphony.')
    expect(screen.getByTestId('collection-item-art.test.portrait').textContent).toContain('A. Painter · c. 1665')
    expect(screen.getByTestId('collection-item-history.test.person').textContent).toContain('1757–1806')
    expect(screen.getByTestId('collection-item-opera.test.term').textContent).toContain('Term')
  })

  it('filters to one discipline with real buttons', async () => {
    render(<CollectionScreen />)
    await screen.findByTestId('collection-screen')
    const art = screen.getByTestId('collection-filter-art')
    expect(art.tagName).toBe('BUTTON')
    expect(art.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(art)
    expect(art.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('collection-filter-all').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getAllByTestId(/^collection-group-/)).toHaveLength(1)
    expect(screen.getByTestId('collection-item-art.test.portrait')).toBeTruthy()
    expect(screen.queryByTestId('collection-item-music.test.symphony')).toBeNull()
  })

  it('shows the empty state in the house voice', async () => {
    deps.collection.mockResolvedValue([])
    render(<CollectionScreen />)
    await screen.findByTestId('collection-empty')
    expect(screen.getByTestId('collection-empty').textContent).toBe('Nothing acquired yet.Three correct days make an acquisition.')
    expect(screen.queryByTestId('collection-filter-all')).toBeNull()
  })

  it('shows a dry error with retry', async () => {
    deps.collection.mockRejectedValueOnce(new Error('locked'))
    render(<CollectionScreen />)
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be opened')
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByTestId('collection-screen')
  })
})

describe('yearLabel', () => {
  it('formats plain, approximate and spanned years', () => {
    expect(yearLabel(ITEMS['music.test.symphony'])).toBe('1808')
    expect(yearLabel(ITEMS['art.test.portrait'])).toBe('c. 1665')
    expect(yearLabel(ITEMS['history.test.person'])).toBe('1757–1806')
    expect(yearLabel(ITEMS['opera.test.term'])).toBeNull()
  })
})
