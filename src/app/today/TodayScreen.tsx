/**
 * Today: rank, meters, the lesson on offer and the Correspondence (items due
 * for review). One primary action: begin the lesson.
 */
import { useNavigate } from 'react-router-dom'
import type { Lesson } from '../../content/types'
import { localDay, type Profile, type RankDefinition } from '../../engine/types'
import { Button, Card, ErrorNotice, Meter, PageTitle, Spinner, useAsync } from '../../ui'
import { collection, dueCount, getCity, lessonsForCity, loadProfile, nextRank, rankFor, rankName } from './deps'

export interface TodayData {
  profile: Profile
  due: number
  acquired: number
  rank: RankDefinition
  next: RankDefinition | null
}

export async function loadToday(now: Date): Promise<TodayData> {
  const profile = await loadProfile()
  const [due, acquiredCards] = await Promise.all([dueCount(now), collection()])
  const acquired = acquiredCards.length
  const rank = rankFor({ acquired, cities: profile.completedCities.length, sessions: profile.sessionsCompleted })
  return { profile, due, acquired, rank, next: nextRank(rank.level) }
}

/** The lesson the profile is on in its current city, or null when the city has none. */
export function currentLesson(profile: Profile): { lesson: Lesson; count: number } | null {
  const lessons = lessonsForCity(profile.currentCityId)
  if (!lessons.length) return null
  const wanted = profile.lessonProgress[profile.currentCityId] ?? 1
  const lesson = lessons.find((l) => l.order >= wanted) ?? lessons[lessons.length - 1]
  return { lesson, count: lessons.length }
}

function correspondenceLine(due: number): string {
  if (due === 0) return 'Nothing awaits your reply.'
  if (due === 1) return 'One item awaits your reply.'
  return `${due} items await your reply.`
}

function nextRankLine(next: RankDefinition | null, style: Profile['titleStyle'], acquired: number, cities: number): string | null {
  if (!next) return null
  const wants: string[] = []
  if (next.items > acquired) wants.push(`${next.items} items in the Collection`)
  if (next.cities > cities) wants.push(`${next.cities} ${next.cities === 1 ? 'city' : 'cities'} completed`)
  if (next.level === 2 && wants.length === 0) wants.push('one completed lesson')
  if (wants.length === 0) return null
  return `${rankName(next, style)} follows, at ${wants.join(' and ')}.`
}

export interface TodayScreenProps {
  /** Injectable clock; defaults to the real one. */
  now?: () => Date
}

export default function TodayScreen({ now = () => new Date() }: TodayScreenProps) {
  const navigate = useNavigate()
  const state = useAsync<TodayData>(() => loadToday(now()), [])

  if (state.status === 'loading' && !state.data) return <Spinner label="Opening the day’s post." />
  if (state.status === 'error' && !state.data) {
    return (
      <>
        <PageTitle kicker="Aristocracy">Today</PageTitle>
        <ErrorNotice message="Your household records could not be opened." detail={state.error} onRetry={state.reload} />
      </>
    )
  }

  const { profile, due, acquired, rank, next } = state.data as TodayData
  const today = localDay(now())
  const doneToday = profile.lastSessionDay === today
  const city = getCity(profile.currentCityId)
  const lessonInfo = currentLesson(profile)
  const nextLine = nextRankLine(next, profile.titleStyle, acquired, profile.completedCities.length)
  const thisMonth = today.slice(0, 7)
  const weekends = profile.countryWeekendMonth === thisMonth ? profile.countryWeekendsLeft : null

  return (
    <div data-testid="today-screen">
      <PageTitle kicker="Aristocracy" sub={profile.displayName ? profile.displayName : undefined}>
        {rankName(rank, profile.titleStyle)}
      </PageTitle>

      <Card as="section" aria-label="Meters">
        <div className="grid grid-cols-3 gap-3">
          <Meter label="Standing" value={profile.standing} unit={profile.standing === 1 ? 'day' : 'days'} data-testid="meter-standing" />
          <Meter label="Prestige" value={profile.prestige.toLocaleString()} data-testid="meter-prestige" />
          <Meter label="Guineas" value={profile.guineas.toLocaleString()} reward data-testid="meter-guineas" />
        </div>
        {nextLine || weekends !== null ? (
          <div className="mt-3 space-y-0.5 border-t border-rule pt-3 text-sm text-ink-mute">
            {nextLine ? <p>{nextLine}</p> : null}
            {weekends !== null ? (
              <p>
                {weekends === 0 ? 'No' : weekends} Country {weekends === 1 ? 'Weekend' : 'Weekends'} left this month.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card as="section" className="mt-4" aria-label="Today’s lesson">
        <p className="smallcaps text-xs text-ink-mute">Today’s lesson</p>
        <h2 className="mt-1 font-serif text-2xl text-ink" data-testid="today-city">
          {city?.name ?? profile.currentCityId}
        </h2>
        {lessonInfo ? (
          <p className="text-ink-soft" data-testid="today-lesson">
            Lesson {lessonInfo.lesson.order} of {lessonInfo.count}
            {lessonInfo.lesson.title && lessonInfo.lesson.title !== `Lesson ${lessonInfo.lesson.order}` ? `: ${lessonInfo.lesson.title}` : ''}
          </p>
        ) : (
          <p className="text-ink-soft">No lessons are written for this city yet.</p>
        )}
        {city?.blurb ? <p className="mt-2 text-sm text-ink-mute">{city.blurb}</p> : null}
        {doneToday ? <p className="mt-3 text-sm text-ink-soft">Today’s lesson is done. Another is on offer, should you want it.</p> : null}
        <Button block className="mt-4" data-testid="begin-session" onClick={() => navigate('/session')}>
          {doneToday ? 'Begin another lesson' : 'Begin today’s lesson'}
        </Button>
      </Card>

      <Card as="section" className="mt-4" aria-label="Correspondence">
        <p className="smallcaps text-xs text-ink-mute">Correspondence</p>
        <p className="mt-1 text-ink" data-testid="today-due">
          {correspondenceLine(due)}
        </p>
        <p className="mt-1 text-sm text-ink-mute">Items due for review open the lesson.</p>
      </Card>
    </div>
  )
}
