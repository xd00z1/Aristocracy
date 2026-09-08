import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile, RankDefinition } from '../../engine/types'
import type { EstateProgress } from './house'

const deps = vi.hoisted(() => ({
  loadProfile: vi.fn(),
  estateProgress: vi.fn(),
  buyFurnishing: vi.fn(),
  rankFor: vi.fn(),
  rankName: vi.fn(),
}))
vi.mock('./deps', () => deps)

import EstateScreen from './EstateScreen'
import { FURNISHINGS } from './furnishings'

const esquire: RankDefinition = { level: 3, names: { masculine: 'Esquire', feminine: 'Esquire', plain: 'Esquire' }, items: 25, cities: 0, peer: false }

const profile: Profile = {
  id: 'me',
  createdAt: 0,
  titleStyle: 'feminine',
  displayName: 'Georgiana',
  prestige: 0,
  guineas: 45,
  standing: 3,
  lastSessionDay: null,
  countryWeekendsLeft: 2,
  countryWeekendMonth: null,
  currentCityId: 'testville',
  lessonProgress: {},
  completedCities: [],
  furnishings: ['chandelier'],
  sessionsCompleted: 4,
  soundEnabled: true,
}

const progress: EstateProgress = {
  music: { acquired: 3, total: 10 },
  opera: { acquired: 0, total: 8 },
  art: { acquired: 1, total: 12 },
  history: { acquired: 0, total: 9 },
}

/** A 2D context with every method the card uses, all no-ops. */
function fakeContext(): CanvasRenderingContext2D {
  const noop = () => undefined
  const ctx: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 10 }),
    createRadialGradient: () => ({ addColorStop: noop }),
  }
  for (const m of ['fillRect', 'strokeRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'closePath', 'arc', 'save', 'restore', 'clip', 'rect']) {
    ctx[m] = noop
  }
  return ctx as unknown as CanvasRenderingContext2D
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.clearAllMocks()
  deps.loadProfile.mockResolvedValue(profile)
  deps.estateProgress.mockResolvedValue(progress)
  deps.rankFor.mockReturnValue(esquire)
  deps.rankName.mockImplementation((r: RankDefinition, style: Profile['titleStyle']) => r.names[style])
  deps.buyFurnishing.mockImplementation(async (id: string, price: number) => ({
    ...profile,
    guineas: profile.guineas - price,
    furnishings: [...profile.furnishings, id],
  }))
})

describe('EstateScreen', () => {
  it('lights the rooms with something acquired and counts the rest', async () => {
    render(<EstateScreen />)
    expect(screen.getByRole('status')).toBeTruthy()
    await screen.findByTestId('estate-screen')

    expect(deps.rankFor).toHaveBeenCalledWith({ acquired: 4, cities: 0, sessions: 4 })
    expect(screen.getByText('Georgiana, Esquire. 4 items acquired.')).toBeTruthy()
    expect(screen.getByTestId('estate-house').tagName.toLowerCase()).toBe('svg')

    for (const [d, lit, line] of [
      ['music', 'true', '3 of 10 acquired'],
      ['opera', 'false', '0 of 8 acquired'],
      ['art', 'true', '1 of 12 acquired'],
      ['history', 'false', '0 of 9 acquired'],
    ]) {
      expect(screen.getByTestId(`estate-room-${d}`).getAttribute('data-lit')).toBe(lit)
      expect(screen.getByTestId(`room-${d}`).getAttribute('data-lit')).toBe(lit)
      expect(screen.getByTestId(`room-progress-${d}`).textContent).toBe(line)
    }
    // One mark per acquired item, in the room's own glyph.
    expect(screen.getByTestId('estate-marks-music').childNodes).toHaveLength(3)
    expect(screen.queryByTestId('estate-marks-opera')).toBeNull()
  })

  it('draws owned furnishings, prices the rest, and buys one with Guineas', async () => {
    render(<EstateScreen />)
    await screen.findByTestId('estate-screen')

    expect(screen.getByTestId('estate-furnishing-chandelier')).toBeTruthy()
    expect(screen.getByTestId('owned-chandelier')).toBeTruthy()
    expect(screen.queryByTestId('buy-chandelier')).toBeNull()
    expect(screen.queryByTestId('estate-furnishing-harpsichord')).toBeNull()
    expect(screen.getByTestId('estate-guineas').textContent).toContain('45')

    // 45 Guineas: the Harpsichord (40) is affordable, the Canaletto (50) is not.
    const buyHarpsichord = screen.getByTestId('buy-harpsichord') as HTMLButtonElement
    expect(buyHarpsichord.tagName).toBe('BUTTON')
    expect(buyHarpsichord.disabled).toBe(false)
    expect(buyHarpsichord.textContent).toBe('40 Guineas')
    const buyCanaletto = screen.getByTestId('buy-canaletto-on-loan') as HTMLButtonElement
    expect(buyCanaletto.disabled).toBe(true)
    expect(screen.getByTestId('furnishing-canaletto-on-loan').textContent).toContain('Wants 5 Guineas more.')

    await act(async () => {
      fireEvent.click(buyHarpsichord)
    })
    expect(deps.buyFurnishing).toHaveBeenCalledWith('harpsichord', 40)
    await screen.findByTestId('owned-harpsichord')
    expect(screen.getByTestId('estate-furnishing-harpsichord')).toBeTruthy()
    expect(screen.getByTestId('estate-guineas').textContent).toContain('5')
    expect(screen.getByTestId('estate-notice').textContent).toBe('The Harpsichord is in the Music Room.')
    // Every catalogue entry is priced as the brief says.
    expect(FURNISHINGS.map((f) => [f.name, f.price])).toEqual([
      ['Chandelier', 30],
      ['Harpsichord', 40],
      ['A Canaletto on loan', 50],
      ['Ancestral portraits', 40],
      ['Orangery', 60],
    ])
  })

  it('reports a purchase the engine refuses without losing the screen', async () => {
    deps.buyFurnishing.mockRejectedValueOnce(new Error('Not enough Guineas'))
    render(<EstateScreen />)
    await screen.findByTestId('estate-screen')
    await act(async () => {
      fireEvent.click(screen.getByTestId('buy-harpsichord'))
    })
    expect(screen.getByTestId('estate-notice').textContent).toBe('The household cannot afford that just yet.')
    expect(screen.getByTestId('buy-harpsichord')).toBeTruthy()
  })

  it('opens the share card and offers a download when the device cannot share files', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext())
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(['png'], { type: 'image/png' }))
    }
    const url = URL as unknown as Record<string, unknown>
    url.createObjectURL = vi.fn(() => 'blob:estate')
    url.revokeObjectURL = vi.fn()

    render(<EstateScreen />)
    await screen.findByTestId('estate-screen')
    fireEvent.click(screen.getByTestId('share-estate'))
    const dialog = screen.getByTestId('share-card')
    expect(dialog.getAttribute('role')).toBe('dialog')

    const link = await screen.findByTestId('share-download')
    expect(link.getAttribute('href')).toBe('blob:estate')
    expect(link.getAttribute('download')).toBe('aristocracy-estate.png')
    expect(screen.queryByTestId('share-native')).toBeNull()
    expect(screen.getByTestId('share-status').textContent).toBe('Ready to save.')

    fireEvent.click(screen.getByTestId('share-close'))
    expect(screen.queryByTestId('share-card')).toBeNull()
    await waitFor(() => expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:estate'))
  })

  it('shares a PNG file through the Web Share API when it can', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext())
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
      cb(new Blob(['png'], { type: 'image/png' }))
    }
    const url = URL as unknown as Record<string, unknown>
    url.createObjectURL = vi.fn(() => 'blob:estate')
    url.revokeObjectURL = vi.fn()
    const share = vi.fn().mockResolvedValue(undefined)
    const nav = navigator as unknown as Record<string, unknown>
    nav.share = share
    nav.canShare = () => true
    try {
      render(<EstateScreen />)
      await screen.findByTestId('estate-screen')
      fireEvent.click(screen.getByTestId('share-estate'))
      const button = await screen.findByTestId('share-native')
      await act(async () => {
        fireEvent.click(button)
      })
      expect(share).toHaveBeenCalledTimes(1)
      const payload = share.mock.calls[0][0] as { files: File[]; text: string }
      expect(payload.files[0].name).toBe('aristocracy-estate.png')
      expect(payload.files[0].type).toBe('image/png')
      expect(payload.text).toBe('Esquire, Georgiana. 4 items acquired.')
      expect(screen.getByTestId('share-status').textContent).toBe('Shared.')
    } finally {
      delete nav.share
      delete nav.canShare
    }
  })

  it('says so when the card cannot be drawn', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<EstateScreen />)
    await screen.findByTestId('estate-screen')
    fireEvent.click(screen.getByTestId('share-estate'))
    await waitFor(() => expect(screen.getByTestId('share-status').textContent).toBe('The card could not be drawn on this device.'))
    expect(screen.queryByTestId('share-download')).toBeNull()
    expect(screen.getByTestId('share-close')).toBeTruthy()
  })
})
