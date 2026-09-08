/**
 * /tour: the Grand Tour as a route down the page. The cities that ship now
 * are stops with their lesson count and the household's progress; the city
 * being studied is set apart; later releases trail off as "Next season".
 */
import { useNavigate } from 'react-router-dom'
import type { City, Lesson } from '../../content/types'
import type { Profile } from '../../engine/types'
import { Button, Card, ErrorNotice, PageTitle, Spinner, useAsync } from '../../ui'
import { citiesInOrder, lessonsForCity, loadProfile } from './deps'

export type StopStatus = 'completed' | 'current' | 'ahead' | 'next-season'

export interface TourStop {
  city: City
  status: StopStatus
  lessonCount: number
  /** Lessons already completed in this city. */
  lessonsDone: number
  /** The lesson the household is on, 1-based, or null when past the last. */
  nextLesson: number | null
}

export function stopFor(city: City, profile: Profile, lessons: Lesson[]): TourStop {
  const lessonCount = lessons.length
  const pointer = profile.lessonProgress[city.id] ?? 1
  const lessonsDone = Math.min(Math.max(pointer - 1, 0), lessonCount)
  const past = lessonCount > 0 && pointer > lessonCount
  let status: StopStatus
  if (city.release !== 'mvp') status = 'next-season'
  else if (profile.completedCities.includes(city.id) || past) status = 'completed'
  else if (profile.currentCityId === city.id) status = 'current'
  else status = 'ahead'
  return { city, status, lessonCount, lessonsDone, nextLesson: past ? null : pointer }
}

export function tourStops(profile: Profile, cities: City[], lessonsFor: (cityId: string) => Lesson[]): TourStop[] {
  return cities.map((city) => stopFor(city, profile, city.release === 'mvp' ? lessonsFor(city.id) : []))
}

function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`
}

/** The one line of progress under a stop. */
export function stopLine(stop: TourStop): string {
  const { status, lessonCount, lessonsDone, nextLesson } = stop
  if (status === 'next-season') return 'Next season.'
  if (lessonCount === 0) return 'No lessons written yet.'
  if (status === 'completed') return `${plural(lessonCount, 'lesson')}, all taken.`
  if (status === 'current') return nextLesson ? `Lesson ${nextLesson} of ${lessonCount}.` : `${plural(lessonCount, 'lesson')}, all taken.`
  return lessonsDone > 0 ? `${lessonsDone} of ${plural(lessonCount, 'lesson')} taken.` : `${plural(lessonCount, 'lesson')}.`
}

const STATUS_LABEL: Record<StopStatus, string> = {
  completed: 'Completed',
  current: 'Where you are',
  ahead: 'Ahead',
  'next-season': 'Next season',
}

const MARKER: Record<StopStatus, string> = {
  completed: 'border-gilt bg-gilt',
  current: 'border-oxblood bg-oxblood',
  ahead: 'border-ink-soft bg-ivory',
  'next-season': 'border-dashed border-ink-mute bg-ivory',
}

function Stop({ stop, onBegin }: { stop: TourStop; onBegin: () => void }) {
  const { city, status } = stop
  const muted = status === 'next-season'
  const body = (
    <>
      <p className={`smallcaps text-xs ${status === 'current' ? 'text-oxblood' : status === 'completed' ? 'text-gilt' : 'text-ink-mute'}`}>
        {city.order}. {STATUS_LABEL[status]}
      </p>
      <h2 className={`mt-0.5 font-serif text-xl leading-tight ${muted ? 'text-ink-mute' : 'text-ink'}`}>{city.name}</h2>
      <p className={`mt-1 text-sm ${muted ? 'text-ink-mute' : 'text-ink-soft'}`}>{city.blurb}</p>
      <p className={`mt-1 text-sm ${muted ? 'text-ink-mute' : 'text-ink'}`} data-testid={`tour-progress-${city.id}`}>
        {stopLine(stop)}
      </p>
      {status === 'current' && stop.lessonCount > 0 ? (
        <Button className="mt-3" onClick={onBegin} data-testid="tour-begin">
          {stop.nextLesson ? 'Take the next lesson' : 'Take another lesson'}
        </Button>
      ) : null}
    </>
  )
  return (
    <li className="relative pb-7 pl-7" data-testid={`tour-city-${city.id}`} data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
      <span aria-hidden="true" className={`absolute top-1 -left-[8px] block size-[15px] rounded-full border ${MARKER[status]}`} />
      {status === 'current' ? (
        <Card as="div" compact className="border-oxblood/40">
          {body}
        </Card>
      ) : (
        <div className="px-1">{body}</div>
      )}
    </li>
  )
}

export default function TourScreen() {
  const navigate = useNavigate()
  const state = useAsync<Profile>(() => loadProfile(), [])

  if (state.status === 'loading' && !state.data) return <Spinner label="Unrolling the map." />
  if (state.status === 'error' && !state.data) {
    return (
      <>
        <PageTitle kicker="Aristocracy">The Grand Tour</PageTitle>
        <ErrorNotice message="The itinerary could not be read." detail={state.error} onRetry={state.reload} />
      </>
    )
  }

  const profile = state.data as Profile
  const stops = tourStops(profile, citiesInOrder(), lessonsForCity)
  const open = stops.filter((s) => s.status !== 'next-season')
  const later = stops.filter((s) => s.status === 'next-season')
  const completed = open.filter((s) => s.status === 'completed').length

  return (
    <div data-testid="tour-screen">
      <PageTitle
        kicker="Aristocracy"
        sub={open.length ? `${completed} of ${open.length} ${open.length === 1 ? 'city' : 'cities'} completed.` : 'No cities are open yet.'}
      >
        The Grand Tour
      </PageTitle>

      <ol className="relative ml-2 border-l border-rule" aria-label="The route">
        {open.map((stop) => (
          <Stop key={stop.city.id} stop={stop} onBegin={() => navigate('/session')} />
        ))}
        {later.length ? (
          <li className="relative pb-3 pl-7" aria-hidden="true">
            <p className="smallcaps text-xs text-ink-mute">Next season</p>
          </li>
        ) : null}
        {later.map((stop) => (
          <Stop key={stop.city.id} stop={stop} onBegin={() => navigate('/session')} />
        ))}
      </ol>
    </div>
  )
}
