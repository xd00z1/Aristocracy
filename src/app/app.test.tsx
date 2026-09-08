/**
 * Routes through the full App. The engine is mocked through the per-screen
 * deps seams; the navigation contract is covered on its own in layout.test.tsx.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, RankDefinition, SessionSummary } from '../engine/types'

const { profile, commoner } = vi.hoisted(() => {
  const profile: Profile = {
    id: 'me',
    createdAt: 0,
    titleStyle: 'plain',
    displayName: '',
    prestige: 0,
    guineas: 0,
    standing: 0,
    lastSessionDay: null,
    countryWeekendsLeft: 2,
    countryWeekendMonth: null,
    currentCityId: 'testville',
    lessonProgress: {},
    completedCities: [],
    furnishings: [],
    sessionsCompleted: 0,
    soundEnabled: true,
  }
  const commoner: RankDefinition = { level: 1, names: { masculine: 'Commoner', feminine: 'Commoner', plain: 'Commoner' }, items: 0, cities: 0, peer: false }
  return { profile, commoner }
})

vi.mock('./today/deps', () => ({
  loadProfile: async () => profile,
  dueCount: async () => 0,
  collection: async () => [],
  rankFor: () => commoner,
  rankName: (r: RankDefinition, style: Profile['titleStyle']) => r.names[style],
  nextRank: () => null,
  getCity: () => undefined,
  lessonsForCity: () => [],
}))
vi.mock('./rankup/deps', () => ({
  loadProfile: async () => profile,
  collection: async () => [],
  rankFor: () => commoner,
  rankName: (r: RankDefinition, style: Profile['titleStyle']) => r.names[style],
  RANKS: [commoner],
}))
vi.mock('./session/deps', () => ({
  loadProfile: async () => profile,
  startSession: async () => {
    throw new Error('not in this test')
  },
  sessionAnswers: async () => [],
  recordAnswer: async () => {},
  completeSession: async () => {
    throw new Error('not in this test')
  },
  EXERCISE_COMPONENTS: {},
  getItem: () => undefined,
  hasImage: () => false,
  imageUrl: () => null,
}))

import App from './App'

function renderAt(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('App', () => {
  it('shows Today with the five navigation links, Today active', async () => {
    renderAt('/')
    await screen.findByTestId('today-screen')
    for (const id of ['nav-today', 'nav-estate', 'nav-tour', 'nav-collection', 'nav-settings']) {
      const link = screen.getByTestId(id)
      expect(link.getAttribute('href')).toBeTruthy()
    }
    expect(screen.getByTestId('nav-today').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('nav-estate').getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('nav-today').className).toContain('text-oxblood')
    expect(screen.getByTestId('nav-today').textContent).toBe('Today')
    expect(screen.getByTestId('nav-collection').textContent).toBe('Collection')
  })

  it('hides the navigation during a session and shows a Return on failure', async () => {
    renderAt('/session')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be prepared')
    expect(screen.queryByTestId('nav-today')).toBeNull()
    fireEvent.click(screen.getByText('Return'))
    await screen.findByTestId('today-screen')
    expect(screen.getByTestId('nav-today')).toBeTruthy()
  })

  it('shows a summary handed to /session in the router state', async () => {
    const summary: SessionSummary = {
      sessionId: 's',
      cityId: 'testville',
      lessonId: 'testville.1',
      grade: 'third',
      correct: 7,
      total: 12,
      reviewErrors: 2,
      prestigeEarned: 70,
      guineasEarned: 12,
      acquired: [],
      rankBefore: 1,
      rankAfter: 1,
      standing: 1,
      lessonCompleted: false,
      cityCompleted: false,
      completedAt: 0,
    }
    renderAt('/session', { summary })
    await screen.findByTestId('session-summary')
    expect(screen.getByTestId('summary-grade').textContent).toBe('Third')
    expect(screen.getByText(/2 slips on review items/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('return'))
    await screen.findByTestId('today-screen')
  })

  it('renders the rank-up ceremony without the navigation', async () => {
    renderAt('/rank-up')
    await screen.findByTestId('rank-up-screen')
    expect(screen.queryByTestId('nav-today')).toBeNull()
  })

  it('redirects unknown paths home', async () => {
    renderAt('/nowhere')
    await screen.findByTestId('today-screen')
  })
})
