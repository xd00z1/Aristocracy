/**
 * /session: loads the profile (for the title style and sound setting) and
 * hands over to the runner. Arriving with a summary in the router state (from
 * the rank-up ceremony) shows that summary instead of starting a new session.
 * Every state here keeps a way back to Today, because the bottom navigation is
 * hidden on this route.
 */
import { useLocation, useNavigate } from 'react-router-dom'
import { loadProfile } from './deps'
import type { Profile, SessionSummary } from '../../engine/types'
import { Button, ErrorNotice, PageTitle, Spinner, useAsync } from '../../ui'
import SessionRunner from './SessionRunner'
import Summary from './Summary'

export interface SessionRouteState {
  summary?: SessionSummary
}

export default function SessionScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = (location.state ?? null) as SessionRouteState | null
  const profile = useAsync<Profile>(() => loadProfile(), [])

  const goHome = () => navigate('/', { replace: true })

  if (routeState?.summary) {
    return <Summary summary={routeState.summary} onReturn={goHome} />
  }

  if (profile.status === 'loading' && !profile.data) return <Spinner label="Laying out the lesson." />
  if (profile.status === 'error' && !profile.data) {
    // The bottom bar is hidden on /session, so this branch carries its own way
    // out: a screen with only "Try again" on it is a dead end.
    return (
      <div data-testid="session-error">
        <PageTitle kicker="Aristocracy">The Lesson</PageTitle>
        <ErrorNotice message="Your household records could not be opened." detail={profile.error} onRetry={profile.reload} />
        <div className="text-center">
          <Button variant="quiet" onClick={goHome}>
            Return
          </Button>
        </div>
      </div>
    )
  }

  return (
    <SessionRunner
      profile={profile.data!}
      onRankUp={(summary) => navigate('/rank-up', { replace: true, state: { summary } })}
      onReturn={goHome}
    />
  )
}
