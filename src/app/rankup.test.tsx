import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, RankDefinition, SessionSummary } from '../engine/types'

const deps = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  collection: vi.fn(),
  rankFor: vi.fn(),
  rankName: vi.fn(),
  RANKS: [] as RankDefinition[],
}))
vi.mock('./rankup/deps', () => deps)

import RankUpScreen, { letterDate, ordinal } from './rankup/RankUpScreen'

const gentleman: RankDefinition = { level: 2, names: { masculine: 'Gentleman', feminine: 'Gentlewoman', plain: 'Gentle' }, items: 0, cities: 0, peer: false }
const baron: RankDefinition = { level: 6, names: { masculine: 'Baron', feminine: 'Baroness', plain: 'Baron' }, items: 200, cities: 2, peer: true }

const profile: Profile = {
  id: 'me',
  createdAt: 0,
  titleStyle: 'masculine',
  displayName: 'Charles',
  prestige: 0,
  guineas: 0,
  standing: 1,
  lastSessionDay: '2026-09-08',
  countryWeekendsLeft: 2,
  countryWeekendMonth: '2026-09',
  currentCityId: 'testville',
  lessonProgress: {},
  completedCities: ['testville', 'otherville'],
  furnishings: [],
  sessionsCompleted: 1,
  soundEnabled: true,
}

const summary: SessionSummary = {
  sessionId: 's',
  cityId: 'testville',
  lessonId: 'testville.1',
  grade: 'first',
  correct: 12,
  total: 12,
  reviewErrors: 0,
  prestigeEarned: 160,
  guineasEarned: 27,
  acquired: [],
  rankBefore: 5,
  rankAfter: 6,
  standing: 1,
  lessonCompleted: true,
  cityCompleted: false,
  completedAt: new Date(2026, 8, 8, 18, 30).getTime(),
}

function SessionProbe() {
  const { state } = useLocation()
  return <div data-testid="session-route">{JSON.stringify(state)}</div>
}

function renderRankUp(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/rank-up', state }]}>
      <Routes>
        <Route path="/rank-up" element={<RankUpScreen now={() => new Date(2026, 0, 1)} />} />
        <Route path="/session" element={<SessionProbe />} />
        <Route path="/" element={<div data-testid="home-route">home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  deps.RANKS = [gentleman, baron]
  deps.loadProfile.mockResolvedValue(profile)
  deps.collection.mockResolvedValue(new Array(201).fill({ acquired: true }))
  deps.rankFor.mockReturnValue(gentleman)
  deps.rankName.mockImplementation((r: RankDefinition, style: Profile['titleStyle']) => r.names[style])
})

describe('ordinal and letterDate', () => {
  it('writes English ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st'])
  })
  it('dates a letter', () => {
    expect(letterDate(new Date(2026, 8, 8))).toBe('the 8th day of September, 2026')
  })
})

describe('RankUpScreen', () => {
  it('draws up letters patent for the rank after the session', async () => {
    renderRankUp({ summary })
    await screen.findByTestId('rank-up-screen')
    expect(screen.getByTestId('rank-up-name').textContent).toBe('Baron')
    expect(screen.getByText(/Know ye that/).textContent).toContain('Charles')
    expect(screen.getByText(/Know ye that/).textContent).toContain('201 items')
    expect(screen.getByText(/Know ye that/).textContent).toContain('2 cities')
    expect(screen.getByText(/A peerage/)).toBeTruthy()
    expect(screen.getByTestId('rank-up-date').textContent).toBe('Given the 8th day of September, 2026.')
    expect(screen.getByRole('separator', { hidden: true })).toBeTruthy()
    expect(document.querySelector('canvas')).toBeNull() // no confetti
    // rankFor is not consulted when the summary names the rank.
    expect(deps.rankFor).not.toHaveBeenCalled()
  })

  it('continues on to the session summary, carrying it in the router state', async () => {
    renderRankUp({ summary })
    const cont = await screen.findByTestId('rank-up-continue')
    fireEvent.click(cont)
    const probe = screen.getByTestId('session-route')
    expect(JSON.parse(probe.textContent || '{}').summary.sessionId).toBe('s')
  })

  it('falls back to the current rank and goes home when opened without a summary', async () => {
    deps.loadProfile.mockResolvedValue({ ...profile, displayName: '', titleStyle: 'plain' })
    renderRankUp(null)
    await screen.findByTestId('rank-up-screen')
    expect(deps.rankFor).toHaveBeenCalledWith({ acquired: 201, cities: 2, sessions: 1 })
    expect(screen.getByTestId('rank-up-name').textContent).toBe('Gentle')
    expect(screen.getByText(/Know ye that/).textContent).toContain('the bearer of these letters')
    expect(screen.getByText(/having completed a first lesson/)).toBeTruthy()
    expect(screen.getByText(/not a peerage/)).toBeTruthy()
    expect(screen.getByTestId('rank-up-date').textContent).toBe('Given the 1st day of January, 2026.')
    fireEvent.click(screen.getByTestId('rank-up-continue'))
    expect(screen.getByTestId('home-route')).toBeTruthy()
  })
})
