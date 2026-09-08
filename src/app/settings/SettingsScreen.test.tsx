import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../../engine/types'

const deps = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
  resetAll: vi.fn(),
  collection: vi.fn(),
}))
// Progress is mocked; the rank table is the real, contract-defined one.
vi.mock('./deps', async () => {
  const ranks = await vi.importActual<typeof import('../../engine/ranks')>('../../engine/ranks')
  return { ...deps, RANKS: ranks.RANKS, rankFor: ranks.rankFor, rankName: ranks.rankName }
})

import SettingsScreen, { rankPreview } from './SettingsScreen'

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
  currentCityId: 'testville',
  lessonProgress: {},
  completedCities: [],
  furnishings: [],
  sessionsCompleted: 4,
  soundEnabled: true,
}

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/" element={<div data-testid="today-route">today</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The stored row the mocked saveProfile merges into. */
let stored: Profile = { ...profile }

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  deps.loadProfile.mockResolvedValue(profile)
  // The real saveProfile merges the patch into the stored row and returns the
  // whole profile; the screen only ever sends the fields it changed.
  stored = { ...profile }
  deps.saveProfile.mockImplementation(async (patch: Partial<Profile>) => {
    stored = { ...stored, ...patch }
    return stored
  })
  deps.resetAll.mockResolvedValue(undefined)
  deps.collection.mockResolvedValue(new Array(30).fill({ acquired: true }))
})

describe('SettingsScreen', () => {
  it('shows the household book', async () => {
    renderSettings()
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByTestId('settings-screen')

    expect((screen.getByTestId('display-name') as HTMLInputElement).value).toBe('Georgiana')
    expect(screen.getByTestId('title-style-plain').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('title-style-feminine').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByTestId('sound-toggle').getAttribute('aria-checked')).toBe('true')
    // 30 items and 4 sessions make an Esquire.
    expect(screen.getByText('Presently Esquire.')).toBeTruthy()
    const preview = screen.getByTestId('rank-preview').textContent
    expect(preview).toContain('Commoner, Gentle, Esquire, Knight, Baronet')
    expect(preview).toContain('then the peerage: Baron, Viscount, Earl, Marquess, Duke.')
    expect(screen.queryByTestId('reset-confirm')).toBeNull()
  })

  it('persists a change of title style and previews the names in that style', async () => {
    renderSettings()
    await screen.findByTestId('settings-screen')

    const feminine = screen.getByTestId('title-style-feminine')
    expect(feminine.tagName).toBe('BUTTON')
    expect(feminine.getAttribute('role')).toBe('radio')
    fireEvent.click(feminine)

    await waitFor(() => expect(deps.saveProfile).toHaveBeenCalledTimes(1))
    // Only the field that changed: a session completed in another tab must not
    // be undone by a screen that read the profile minutes ago.
    expect(deps.saveProfile).toHaveBeenCalledWith({ titleStyle: 'feminine' })
    await waitFor(() => expect(screen.getByTestId('title-style-feminine').getAttribute('aria-checked')).toBe('true'))
    expect(screen.getByTestId('title-style-plain').getAttribute('aria-checked')).toBe('false')
    const preview = screen.getByTestId('rank-preview').textContent
    expect(preview).toContain('Gentlewoman')
    expect(preview).toContain('Dame')
    expect(preview).toContain('Duchess')
    expect(preview).not.toContain('Duke')

    // Choosing the style already in force saves nothing.
    fireEvent.click(screen.getByTestId('title-style-feminine'))
    expect(deps.saveProfile).toHaveBeenCalledTimes(1)
  })

  it('works the style radios from the keyboard: one tab stop, arrows move the choice', async () => {
    renderSettings()
    await screen.findByTestId('settings-screen')

    // Roving tabindex: only the checked radio is in the tab order.
    expect(screen.getByTestId('title-style-plain').getAttribute('tabindex')).toBe('0')
    expect(screen.getByTestId('title-style-masculine').getAttribute('tabindex')).toBe('-1')

    fireEvent.keyDown(screen.getByTestId('title-style-plain'), { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByTestId('title-style-masculine').getAttribute('aria-checked')).toBe('true'))
    expect(deps.saveProfile).toHaveBeenCalledWith({ titleStyle: 'masculine' })
    expect(screen.getByTestId('title-style-masculine').getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(screen.getByTestId('title-style-masculine'))

    fireEvent.keyDown(screen.getByTestId('title-style-masculine'), { key: 'ArrowUp' })
    await waitFor(() => expect(screen.getByTestId('title-style-plain').getAttribute('aria-checked')).toBe('true'))
  })

  it('saves the name when the field is left, and the sound switch at once', async () => {
    renderSettings()
    await screen.findByTestId('settings-screen')

    const input = screen.getByTestId('display-name') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Lady Bracknell  ' } })
    fireEvent.blur(input)
    await waitFor(() => expect(deps.saveProfile).toHaveBeenCalledWith({ displayName: 'Lady Bracknell' }))
    expect(input.value).toBe('Lady Bracknell')

    fireEvent.click(screen.getByTestId('sound-toggle'))
    await waitFor(() => expect(deps.saveProfile).toHaveBeenCalledWith({ soundEnabled: false }))
    expect(screen.getByTestId('display-name')).toHaveProperty('value', 'Lady Bracknell')
    expect(screen.getByTestId('sound-toggle').getAttribute('aria-checked')).toBe('false')
  })

  it('keeps the old value and says so when a save fails', async () => {
    deps.saveProfile.mockRejectedValueOnce(new Error('disk full'))
    renderSettings()
    await screen.findByTestId('settings-screen')
    fireEvent.click(screen.getByTestId('title-style-masculine'))
    const notice = await screen.findByTestId('settings-notice')
    expect(notice.textContent).toContain('could not be saved')
    expect(screen.getByTestId('title-style-plain').getAttribute('aria-checked')).toBe('true')
  })

  it('starts again only after the inline confirmation', async () => {
    renderSettings()
    await screen.findByTestId('settings-screen')

    fireEvent.click(screen.getByTestId('reset-start'))
    expect(deps.resetAll).not.toHaveBeenCalled()
    expect(screen.getByTestId('reset-confirmation').textContent).toContain('Are you sure?')

    fireEvent.click(screen.getByTestId('reset-cancel'))
    expect(screen.queryByTestId('reset-confirmation')).toBeNull()
    expect(deps.resetAll).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('reset-start'))
    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-confirm'))
    })
    expect(deps.resetAll).toHaveBeenCalledTimes(1)
    await screen.findByTestId('today-route')
  })

  it('shows a dry error with retry when the book cannot be opened', async () => {
    deps.loadProfile.mockRejectedValueOnce(new Error('locked'))
    renderSettings()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('could not be opened')
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByTestId('settings-screen')
  })
})

describe('rankPreview', () => {
  it('splits the ten ranks at the peerage, in the chosen style', () => {
    const plain = rankPreview('plain')
    expect(plain.commoners).toEqual(['Commoner', 'Gentle', 'Esquire', 'Knight', 'Baronet'])
    expect(plain.peers).toEqual(['Baron', 'Viscount', 'Earl', 'Marquess', 'Duke'])
    expect(rankPreview('feminine').peers).toEqual(['Baroness', 'Viscountess', 'Countess', 'Marchioness', 'Duchess'])
  })
})
