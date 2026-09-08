/**
 * /rank-up: the ceremony. A letters-patent card naming the new rank, dated,
 * with one fleuron. No confetti. Continue goes on to the session summary when
 * one was handed over in the router state, otherwise home.
 */
import { useLocation, useNavigate } from 'react-router-dom'
import type { Profile, RankDefinition, SessionSummary } from '../../engine/types'
import { Button, Card, ErrorNotice, Fleuron, Spinner, useAsync } from '../../ui'
import { collection, loadProfile, RANKS, rankFor, rankName } from './deps'

export interface RankUpRouteState {
  summary?: SessionSummary
}

export interface RankUpData {
  profile: Profile
  rank: RankDefinition
  acquired: number
}

export function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** "the 8th day of September, 2026" */
export function letterDate(d: Date): string {
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  return `the ${ordinal(d.getDate())} day of ${month}, ${d.getFullYear()}`
}

export async function loadRankUp(summary: SessionSummary | undefined): Promise<RankUpData> {
  const profile = await loadProfile()
  const acquired = (await collection()).length
  const rank =
    (summary ? RANKS.find((r: RankDefinition) => r.level === summary.rankAfter) : undefined) ??
    rankFor({ acquired, cities: profile.completedCities.length, sessions: profile.sessionsCompleted })
  return { profile, rank, acquired }
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

export interface RankUpScreenProps {
  now?: () => Date
}

export default function RankUpScreen({ now = () => new Date() }: RankUpScreenProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const summary = ((location.state ?? null) as RankUpRouteState | null)?.summary
  const state = useAsync<RankUpData>(() => loadRankUp(summary), [summary?.sessionId])

  const proceed = () => {
    if (summary) navigate('/session', { replace: true, state: { summary } })
    else navigate('/', { replace: true })
  }

  if (state.status === 'loading' && !state.data) return <Spinner label="Sealing the letters." />
  if (state.status === 'error' && !state.data) {
    return (
      <div>
        <ErrorNotice message="The letters patent could not be drawn up." detail={state.error} onRetry={state.reload} />
        <div className="text-center">
          <Button variant="quiet" onClick={proceed}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  const { profile, rank, acquired } = state.data as RankUpData
  const name = rankName(rank, profile.titleStyle)
  const who = profile.displayName?.trim() ? profile.displayName.trim() : 'the bearer of these letters'
  const date = summary ? new Date(summary.completedAt) : now()
  const grounds =
    rank.level === 2
      ? 'having completed a first lesson'
      : `having acquired ${acquired} ${acquired === 1 ? 'item' : 'items'} for the Collection` +
        (profile.completedCities.length ? ` and completed ${profile.completedCities.length} ${profile.completedCities.length === 1 ? 'city' : 'cities'} of the Grand Tour` : '')

  return (
    <div className="py-6" data-testid="rank-up-screen">
      <Card as="article" className="px-6 py-8 text-center" aria-label="Letters patent">
        <p className="smallcaps text-xs text-ink-mute">Letters Patent</p>
        <p className="mt-5 text-ink">
          Know ye that <span className="font-semibold">{who}</span>, {grounds}, is by these presents raised to the rank of
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight text-ink" data-testid="rank-up-name">
          {name}
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          {rank.peer ? 'A peerage, with all that follows from it.' : `${name.charAt(0).toUpperCase() + name.slice(1)} is ${article(name)} rank, not a peerage. The peerage begins at Baron.`}
        </p>
        <Fleuron gilt />
        <p className="text-sm text-ink-mute" data-testid="rank-up-date">
          Given {letterDate(date)}.
        </p>
      </Card>
      <Button block className="mt-6" data-testid="rank-up-continue" onClick={proceed}>
        Continue
      </Button>
    </div>
  )
}
