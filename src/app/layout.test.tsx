import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import Layout, { NAV_ITEMS } from './Layout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<div data-testid="page">today</div>} />
          <Route path="/estate" element={<div data-testid="page">estate</div>} />
          <Route path="/session" element={<div data-testid="page">session</div>} />
          <Route path="/rank-up" element={<div data-testid="page">rank-up</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('Layout', () => {
  it('renders the five navigation links with their test ids and serif small-caps labels', () => {
    renderAt('/')
    expect(NAV_ITEMS.map((n) => n.testId)).toEqual(['nav-today', 'nav-estate', 'nav-tour', 'nav-collection', 'nav-settings'])
    for (const item of NAV_ITEMS) {
      const link = screen.getByTestId(item.testId)
      expect(link.tagName).toBe('A')
      expect(link.getAttribute('href')).toBe(item.to)
      expect(link.textContent).toBe(item.label)
      expect(link.className).toContain('font-serif')
      expect(link.className).toContain('smallcaps')
      expect(link.className).toContain('min-h-14')
    }
    expect(screen.getByTestId('page').textContent).toBe('today')
  })

  it('marks the active link in oxblood', () => {
    renderAt('/estate')
    const estate = screen.getByTestId('nav-estate')
    expect(estate.getAttribute('aria-current')).toBe('page')
    expect(estate.className).toContain('text-oxblood')
    const today = screen.getByTestId('nav-today')
    expect(today.getAttribute('aria-current')).toBeNull()
    expect(today.className).not.toContain('text-oxblood')
  })

  it('hides the bar during a session and the rank-up ceremony', () => {
    const { unmount } = renderAt('/session')
    expect(screen.getByTestId('page').textContent).toBe('session')
    expect(screen.queryByRole('navigation')).toBeNull()
    unmount()
    renderAt('/rank-up')
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
