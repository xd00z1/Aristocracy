/**
 * Routes. Today, Session and Rank-up are owned here; Estate, Tour, Collection
 * and Settings are loaded lazily from their own directories. A screen that
 * fails to load (not yet built, or a fault in its module) degrades to a dry
 * notice rather than a blank page.
 */
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorNotice, PageTitle, Spinner } from '../ui'
import Layout from './Layout'
import RankUpScreen from './rankup/RankUpScreen'
import SessionScreen from './session/SessionScreen'
import TodayScreen from './today/TodayScreen'

type ScreenModule = { default: ComponentType }

function unavailable(name: string): (err: unknown) => ScreenModule {
  return (err) => ({
    default: function Unavailable() {
      return (
        <>
          <PageTitle kicker="Aristocracy">{name}</PageTitle>
          <ErrorNotice message={`The ${name} is not open to visitors just now.`} detail={err} onRetry={() => window.location.reload()} retryLabel="Reload" />
        </>
      )
    },
  })
}

const EstateScreen = lazy(() => import('./estate/EstateScreen').catch(unavailable('Estate')))
const TourScreen = lazy(() => import('./tour/TourScreen').catch(unavailable('Tour')))
const CollectionScreen = lazy(() => import('./collection/CollectionScreen').catch(unavailable('Collection')))
const SettingsScreen = lazy(() => import('./settings/SettingsScreen').catch(unavailable('Settings')))

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TodayScreen />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="/rank-up" element={<RankUpScreen />} />
        <Route
          path="/estate"
          element={
            <Lazy>
              <EstateScreen />
            </Lazy>
          }
        />
        <Route
          path="/tour"
          element={
            <Lazy>
              <TourScreen />
            </Lazy>
          }
        />
        <Route
          path="/collection"
          element={
            <Lazy>
              <CollectionScreen />
            </Lazy>
          }
        />
        <Route
          path="/settings"
          element={
            <Lazy>
              <SettingsScreen />
            </Lazy>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
