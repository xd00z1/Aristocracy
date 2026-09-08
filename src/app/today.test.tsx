import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, RankDefinition } from '../engine/types'

const deps = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  dueCount: vi.fn(),
  collection: vi.fn(),
  rankFor: vi.fn(),
  rankName: vi.fn(),
  nextRank: vi.fn(),
  getCity: vi.fn(),
  lessonsForCity: vi.fn(),
}))
vi.mock('./today/deps', () => deps)

import TodayScreen from './today/TodayScreen'

const esquire: RankDefinition = { level: 3, names: { masculine: 'Esquire', feminine: 'Esquire', plain: 'Esquire' }, items: 25, cities: 0, peer: false }
const knight: RankDefinition = { level: 4, names: { masculine: 'Knight', feminine: 'Dame', plain: 'Knight' }, items: 60, cities: 1, peer: false }

const profile: Profile = {
  id: 'me',
  createdAt: 0,
  titleStyle: 'feminine',
  displayName: 'Georgiana',
  prestige: 1234,
  guineas: 56,
  standing: 3,
  lastSessionDay: null,
  countryWeekendsLeft: 1,
  countryWeekendMonth: '2026-09',
  currentCityId: 'testville',
  lessonProgress: { testville: 2 },
  completedCities: [],
  furnishings: [],
  sessionsCompleted: 4,
  soundEnabled: true,
}

const NOW = new Date(2026, 8, 8, 9, 0, 0)

function renderToday() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TodayScreen now={() => NOW} />} />
        <Route path="/session" element={<div data-testid="session-route">session</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  deps.loadProfile.mockResolvedValue(profile)
  deps.dueCount.mockResolvedValue(7)
  deps.collection.mockResolvedValue(new Array(30).fill({ acquired: true }))
  deps.rankFor.mockReturnValue(esquire)
  deps.rankName.mockImplementation((r: RankDefinition, style: Profile['titleStyle']) => r.names[style])
  deps.nextRank.mockReturnValue(knight)
  deps.getCity.mockReturnValue({ id: 'testville', name: 'Testville', order: 1, blurb: 'A town for tests.', release: 'mvp', lesson_size: 6 })
  deps.lessonsForCity.mockReturnValue([
    { id: 'testville.1', cityId: 'testville', order: 1, title: 'Lesson 1', itemIds: [], scenarioIds: [] },
    { id: 'testville.2', cityId: 'testville', order: 2, title: 'Lesson 2', itemIds: [], scenarioIds: [] },
    { id: 'testville.3', cityId: 'testville', order: 3, title: 'Lesson 3', itemIds: [], scenarioIds: [] },
  ])
})

describe('TodayScreen', () => {
  it('shows rank, meters, the lesson, and the correspondence', async () => {
    renderToday()
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByTestId('today-screen')

    expect(deps.rankFor).toHaveBeenCalledWith({ acquired: 30, cities: 0, sessions: 4 })
    expect(deps.dueCount).toHaveBeenCalledWith(NOW)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Esquire')
    expect(screen.getByText('Georgiana')).toBeTruthy()
    expect(screen.getByTestId('meter-standing').textContent).toContain('3')
    expect(screen.getByTestId('meter-standing').textContent).toContain('days')
    expect(screen.getByTestId('meter-prestige').textContent).toContain('1,234')
    expect(screen.getByTestId('meter-guineas').textContent).toContain('56')
    expect(screen.getByTestId('today-city').textContent).toBe('Testville')
    expect(screen.getByTestId('today-lesson').textContent).toBe('Lesson 2 of 3')
    expect(screen.getByTestId('today-due').textContent).toBe('7 items await your reply.')
    expect(screen.getByText(/Dame follows, at 60 items in the Collection and 1 city completed/)).toBeTruthy()
    expect(screen.getByText(/1 Country Weekend left this month/)).toBeTruthy()
  })

  it('begins the session from the primary button', async () => {
    renderToday()
    const begin = await screen.findByTestId('begin-session')
    expect(begin.tagName).toBe('BUTTON')
    expect(begin.textContent).toBe('Begin today’s lesson')
    fireEvent.click(begin)
    expect(screen.getByTestId('session-route')).toBeTruthy()
  })

  it('notes when today’s lesson is already done and when nothing is due', async () => {
    deps.loadProfile.mockResolvedValue({ ...profile, lastSessionDay: '2026-09-08' })
    deps.dueCount.mockResolvedValue(0)
    renderToday()
    await screen.findByTestId('today-screen')
    expect(screen.getByTestId('begin-session').textContent).toBe('Begin another lesson')
    expect(screen.getByText(/Today’s lesson is done/)).toBeTruthy()
    expect(screen.getByTestId('today-due').textContent).toBe('Nothing awaits your reply.')
  })

  it('shows a dry error with retry when the records cannot be opened', async () => {
    deps.loadProfile.mockRejectedValueOnce(new Error('locked'))
    renderToday()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be opened')
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByTestId('today-screen')
    expect(deps.loadProfile).toHaveBeenCalledTimes(2)
  })
})
