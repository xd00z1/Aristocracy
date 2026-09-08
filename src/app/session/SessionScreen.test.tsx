/**
 * /session hides the bottom navigation (Layout.FOCUSED_ROUTES), so every state
 * this screen can be in must carry its own way back to Today. A screen whose
 * only control is "Try again" against a failure that will fail again is a trap.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deps = vi.hoisted(() => ({ loadProfile: vi.fn() }))
vi.mock('./deps', () => ({
  ...deps,
  startSession: vi.fn(),
  sessionAnswers: vi.fn(),
  recordAnswer: vi.fn(),
  completeSession: vi.fn(),
  EXERCISE_COMPONENTS: {},
  getItem: () => undefined,
  hasImage: () => false,
  imageUrl: () => null,
}))

import SessionScreen from './SessionScreen'

function renderSession() {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/" element={<div data-testid="today-route">today</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
})

describe('SessionScreen', () => {
  it('offers a way back to Today when the profile cannot be read', async () => {
    deps.loadProfile.mockRejectedValue(new Error('IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb'))
    renderSession()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Your household records could not be opened.')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Lesson')

    // Two controls, not one: retrying the same failure is not an escape.
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toContain('Try again')
    expect(labels).toContain('Return')

    fireEvent.click(screen.getByText('Return'))
    expect(await screen.findByTestId('today-route')).toBeTruthy()
  })
})
