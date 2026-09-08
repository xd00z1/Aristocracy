/**
 * App frame: a centred column and a bottom navigation bar with five serif,
 * small-caps links. The bar is hidden on the session and rank-up routes so a
 * thumb cannot wander out of a lesson.
 */
import { NavLink, Outlet, useLocation } from 'react-router-dom'

export interface NavItem {
  to: string
  label: string
  testId: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', testId: 'nav-today' },
  { to: '/estate', label: 'Estate', testId: 'nav-estate' },
  { to: '/tour', label: 'Tour', testId: 'nav-tour' },
  { to: '/collection', label: 'Collection', testId: 'nav-collection' },
  { to: '/settings', label: 'Settings', testId: 'nav-settings' },
]

/** Routes that take the whole screen, without the bottom bar. */
export const FOCUSED_ROUTES = ['/session', '/rank-up']

export function BottomNav() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-ivory/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex max-w-xl">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              data-testid={item.testId}
              className={({ isActive }) =>
                'flex min-h-14 items-center justify-center px-1 font-serif text-[13px] smallcaps ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gilt ' +
                (isActive ? 'text-oxblood font-semibold' : 'text-ink-soft hover:text-ink')
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const focused = FOCUSED_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
  return (
    <div className="flex min-h-dvh flex-col bg-ivory text-ink">
      <main className={`mx-auto w-full max-w-xl flex-1 px-4 pt-2 ${focused ? 'pb-8' : 'pb-24'}`}>
        <Outlet />
      </main>
      {focused ? null : <BottomNav />}
    </div>
  )
}
