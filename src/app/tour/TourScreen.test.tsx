import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { City, Lesson } from '../../content/types'
import type { Profile } from '../../engine/types'

const deps = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  citiesInOrder: vi.fn(),
  lessonsForCity: vi.fn(),
}))
vi.mock('./deps', () => deps)

import TourScreen, { stopFor, stopLine } from './TourScreen'

function city(id: string, order: number, release: City['release'] = 'mvp'): City {
  return { id, name: id[0].toUpperCase() + id.slice(1), order, blurb: `A blurb for ${id}.`, release, lesson_size: 6 }
}

function lessons(cityId: string, n: number): Lesson[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${cityId}.${i + 1}`, cityId, order: i + 1, title: `Lesson ${i + 1}`, itemIds: [], scenarioIds: [] }))
}

const CITIES = [city('alpha', 1), city('beta', 2), city('gamma', 3), city('delta', 4, 'v2'), city('epsilon', 5, 'v3')]
const LESSONS: Record<string, Lesson[]> = { alpha: lessons('alpha', 3), beta: lessons('beta', 3), gamma: lessons('gamma', 2) }

const profile: Profile = {
  id: 'me',
  createdAt: 0,
  titleStyle: 'plain',
  displayName: 'Georgiana',
  prestige: 0,
  guineas: 0,
  standing: 0,
  lastSessionDay: null,
  countryWeekendsLeft: 2,
  countryWeekendMonth: null,
  currentCityId: 'beta',
  lessonProgress: { alpha: 4, beta: 2 },
  completedCities: ['alpha'],
  furnishings: [],
  sessionsCompleted: 4,
  soundEnabled: true,
}

function renderTour() {
  return render(
    <MemoryRouter initialEntries={['/tour']}>
      <Routes>
        <Route path="/tour" element={<TourScreen />} />
        <Route path="/session" element={<div data-testid="session-route">session</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  deps.loadProfile.mockResolvedValue(profile)
  deps.citiesInOrder.mockReturnValue(CITIES)
  deps.lessonsForCity.mockImplementation((id: string) => LESSONS[id] ?? [])
})

describe('TourScreen', () => {
  it('draws the route with each city in its state', async () => {
    renderTour()
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByTestId('tour-screen')

    expect(screen.getByText('1 of 3 cities completed.')).toBeTruthy()

    const alpha = screen.getByTestId('tour-city-alpha')
    expect(alpha.getAttribute('data-status')).toBe('completed')
    expect(screen.getByTestId('tour-progress-alpha').textContent).toBe('3 lessons, all taken.')

    const beta = screen.getByTestId('tour-city-beta')
    expect(beta.getAttribute('data-status')).toBe('current')
    expect(beta.getAttribute('aria-current')).toBe('step')
    expect(screen.getByTestId('tour-progress-beta').textContent).toBe('Lesson 2 of 3.')
    expect(beta.textContent).toContain('A blurb for beta.')

    const gamma = screen.getByTestId('tour-city-gamma')
    expect(gamma.getAttribute('data-status')).toBe('ahead')
    expect(screen.getByTestId('tour-progress-gamma').textContent).toBe('2 lessons.')

    const delta = screen.getByTestId('tour-city-delta')
    expect(delta.getAttribute('data-status')).toBe('next-season')
    expect(screen.getByTestId('tour-progress-delta').textContent).toBe('Next season.')
    expect(screen.getByTestId('tour-city-epsilon').getAttribute('data-status')).toBe('next-season')

    // Later releases are never asked for lessons; the route order is the city order.
    expect(deps.lessonsForCity).not.toHaveBeenCalledWith('delta')
    const ids = screen.getAllByTestId(/^tour-city-/).map((el) => el.getAttribute('data-testid'))
    expect(ids).toEqual(['tour-city-alpha', 'tour-city-beta', 'tour-city-gamma', 'tour-city-delta', 'tour-city-epsilon'])
  })

  it('offers the next lesson only on the current city and goes to the session', async () => {
    renderTour()
    const begin = await screen.findByTestId('tour-begin')
    expect(begin.tagName).toBe('BUTTON')
    expect(screen.getAllByTestId('tour-begin')).toHaveLength(1)
    expect(screen.getByTestId('tour-city-beta').contains(begin)).toBe(true)
    fireEvent.click(begin)
    expect(screen.getByTestId('session-route')).toBeTruthy()
  })

  it('says when a city has no lessons written and when the map cannot be read', async () => {
    deps.loadProfile.mockResolvedValueOnce({ ...profile, currentCityId: 'alpha', completedCities: [], lessonProgress: {} })
    deps.lessonsForCity.mockImplementation((id: string) => (id === 'alpha' ? [] : (LESSONS[id] ?? [])))
    renderTour()
    await screen.findByTestId('tour-screen')
    expect(screen.getByTestId('tour-progress-alpha').textContent).toBe('No lessons written yet.')
    expect(screen.queryByTestId('tour-begin')).toBeNull()
    cleanup()

    deps.loadProfile.mockRejectedValueOnce(new Error('locked'))
    renderTour()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be read')
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByTestId('tour-screen')
  })
})

describe('stopFor', () => {
  it('derives status and lines from the profile', () => {
    const past = stopFor(city('alpha', 1), { ...profile, completedCities: [], currentCityId: 'alpha', lessonProgress: { alpha: 4 } }, lessons('alpha', 3))
    expect(past.status).toBe('completed')
    expect(past.nextLesson).toBeNull()
    expect(past.lessonsDone).toBe(3)

    const current = stopFor(city('beta', 2), profile, lessons('beta', 3))
    expect(current.status).toBe('current')
    expect(current.lessonsDone).toBe(1)
    expect(stopLine(current)).toBe('Lesson 2 of 3.')

    const untouched = stopFor(city('gamma', 3), profile, lessons('gamma', 1))
    expect(untouched.status).toBe('ahead')
    expect(stopLine(untouched)).toBe('1 lesson.')

    const revisited = stopFor(city('gamma', 3), { ...profile, lessonProgress: { gamma: 2 } }, lessons('gamma', 4))
    expect(stopLine(revisited)).toBe('1 of 4 lessons taken.')

    const later = stopFor(city('delta', 4, 'v2'), profile, [])
    expect(later.status).toBe('next-season')
    expect(stopLine(later)).toBe('Next season.')
  })
})
