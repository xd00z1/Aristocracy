/**
 * /estate: the house in cross-section, a room per discipline lit as items are
 * acquired; the furnishings catalogue, bought with Guineas; and the share card.
 */
import { useState } from 'react'
import type { Discipline } from '../../content/types'
import type { Profile, RankDefinition } from '../../engine/types'
import { Button, Card, ErrorNotice, Meter, PageTitle, Spinner, useAsync } from '../../ui'
import ShareCard, { type ShareCardData } from '../share/ShareCard'
import { buyFurnishing, estateProgress, loadProfile, rankFor, rankName } from './deps'
import { EstateHouse } from './EstateHouse'
import { formatGuineas, FURNISHINGS, type Furnishing } from './furnishings'
import { acquiredLine, isLit, litRooms, ROOMS, totalAcquired, type EstateProgress } from './house'

export interface EstateData {
  profile: Profile
  progress: EstateProgress
  acquired: number
  rank: RankDefinition
}

export async function loadEstate(): Promise<EstateData> {
  const [profile, progress] = await Promise.all([loadProfile(), estateProgress()])
  const acquired = totalAcquired(progress)
  const rank = rankFor({ acquired, cities: profile.completedCities.length, sessions: profile.sessionsCompleted })
  return { profile, progress, acquired, rank }
}

const DISCIPLINE_LABEL: Record<Discipline, string> = { music: 'Music', opera: 'Opera', art: 'Art', history: 'History' }

/** What the Estate says about a purchase, in the house voice. */
export function purchaseLine(f: Furnishing): string {
  switch (f.place) {
    case 'house':
      return `The ${f.name} is built.`
    case 'music':
      return `The ${f.name} is in the Music Room.`
    case 'art':
      return `${f.name} hangs in the Gallery.`
    case 'history':
      return `${f.name} hang in the Long Gallery.`
    default:
      return `${f.name} is in the house.`
  }
}

function FurnishingRow({
  furnishing,
  owned,
  guineas,
  busy,
  onBuy,
}: {
  furnishing: Furnishing
  owned: boolean
  guineas: number
  busy: boolean
  onBuy: (f: Furnishing) => void
}) {
  const short = furnishing.price - guineas
  const affordable = short <= 0
  return (
    <li className="flex flex-col gap-2 border-t border-rule py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between" data-testid={`furnishing-${furnishing.id}`}>
      <div className="min-w-0">
        <p className="font-serif text-lg text-ink">{furnishing.name}</p>
        <p className="text-sm text-ink-soft">{furnishing.description}</p>
      </div>
      <div className="shrink-0 sm:pl-4 sm:text-right">
        {owned ? (
          <span className="smallcaps inline-flex min-h-11 items-center text-sm text-gilt" data-testid={`owned-${furnishing.id}`}>
            In the house
          </span>
        ) : (
          <>
            <Button variant="secondary" disabled={!affordable || busy} onClick={() => onBuy(furnishing)} data-testid={`buy-${furnishing.id}`}>
              {formatGuineas(furnishing.price)}
            </Button>
            {!affordable ? <p className="mt-1 text-xs text-ink-mute">Wants {formatGuineas(short)} more.</p> : null}
          </>
        )}
      </div>
    </li>
  )
}

export default function EstateScreen() {
  const state = useAsync<EstateData>(loadEstate, [])
  const [bought, setBought] = useState<Profile | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [sharing, setSharing] = useState(false)

  if (state.status === 'loading' && !state.data) return <Spinner label="Opening the house." />
  if (state.status === 'error' && !state.data) {
    return (
      <>
        <PageTitle kicker="Aristocracy">The Estate</PageTitle>
        <ErrorNotice message="The house could not be opened." detail={state.error} onRetry={state.reload} />
      </>
    )
  }

  const data = state.data as EstateData
  // A purchase returns the new profile; prefer it over the one loaded on entry.
  const profile = bought ?? data.profile
  const { progress, acquired, rank } = data
  const rankLabel = rankName(rank, profile.titleStyle)
  const name = profile.displayName.trim()

  const buy = async (f: Furnishing) => {
    setBusy(f.id)
    setNotice(null)
    try {
      const next = await buyFurnishing(f.id, f.price)
      setBought(next)
      setNotice({ text: purchaseLine(f) })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNotice({ text: /guineas/i.test(message) ? 'The household cannot afford that just yet.' : `The purchase fell through. ${message}`, error: true })
    } finally {
      setBusy(null)
    }
  }

  const shareData: ShareCardData = {
    rankLabel,
    displayName: name,
    acquired,
    standing: profile.standing,
    lit: litRooms(progress),
    furnishings: profile.furnishings,
  }

  return (
    <div data-testid="estate-screen">
      <PageTitle kicker="Aristocracy" sub={`${name ? `${name}, ` : ''}${rankLabel}. ${acquired === 1 ? 'One item' : `${acquired} items`} acquired.`}>
        The Estate
      </PageTitle>

      <Card as="section" aria-label="The house" data-testid="estate-house-card">
        <EstateHouse progress={progress} furnishings={profile.furnishings} />
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule pt-4" aria-label="Rooms">
          {ROOMS.map((room) => {
            const lit = isLit(progress, room.discipline)
            return (
              <li key={room.discipline} className="min-w-0" data-testid={`room-${room.discipline}`} data-lit={lit ? 'true' : 'false'}>
                <p className="smallcaps text-xs text-ink-mute">{DISCIPLINE_LABEL[room.discipline]}</p>
                <p className={`font-serif ${lit ? 'text-ink' : 'text-ink-mute'}`}>{room.name}</p>
                <p className={`text-sm ${lit ? 'text-gilt' : 'text-ink-mute'}`} data-testid={`room-progress-${room.discipline}`}>
                  {acquiredLine(progress, room.discipline)}
                </p>
              </li>
            )
          })}
        </ul>
        {acquired === 0 ? <p className="mt-4 text-sm text-ink-mute">The rooms are dark until something is acquired. Three correct days light the first one.</p> : null}
      </Card>

      <Card as="section" className="mt-4" aria-label="Furnishings">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="smallcaps text-xs text-ink-mute">Furnishings</p>
            <p className="mt-1 text-sm text-ink-soft">Cosmetic, and paid for in Guineas.</p>
          </div>
          <Meter label="Guineas" value={profile.guineas.toLocaleString()} reward data-testid="estate-guineas" className="items-end" />
        </div>
        {notice ? (
          <p className={`mt-3 text-sm ${notice.error ? 'text-oxblood' : 'text-ink'}`} role="status" data-testid="estate-notice">
            {notice.text}
          </p>
        ) : null}
        <ul className="mt-4">
          {FURNISHINGS.map((f) => (
            <FurnishingRow key={f.id} furnishing={f} owned={profile.furnishings.includes(f.id)} guineas={profile.guineas} busy={busy !== null} onBuy={(x) => void buy(x)} />
          ))}
        </ul>
      </Card>

      <div className="mt-6 text-center">
        <Button variant="secondary" onClick={() => setSharing(true)} data-testid="share-estate">
          Share your Estate
        </Button>
      </div>

      {sharing ? <ShareCard data={shareData} onClose={() => setSharing(false)} /> : null}
    </div>
  )
}
