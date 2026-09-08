/**
 * /settings: name, style of title (with the rank names previewed), sound,
 * and Start again behind an inline two-step confirmation. Every change is
 * saved as it is made; nothing here needs a Save button.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, RankDefinition, TitleStyle } from '../../engine/types'
import { Button, Card, ErrorNotice, PageTitle, Spinner, useAsync } from '../../ui'
import { collection, loadProfile, RANKS, rankFor, rankName, resetAll, saveProfile } from './deps'

export interface SettingsData {
  profile: Profile
  rank: RankDefinition
}

export async function loadSettings(): Promise<SettingsData> {
  const [profile, acquired] = await Promise.all([loadProfile(), collection()])
  const rank = rankFor({ acquired: acquired.length, cities: profile.completedCities.length, sessions: profile.sessionsCompleted })
  return { profile, rank }
}

export const TITLE_STYLES: Array<{ style: TitleStyle; label: string; note: string }> = [
  { style: 'masculine', label: 'Masculine', note: 'Gentleman, Knight, Duke' },
  { style: 'feminine', label: 'Feminine', note: 'Gentlewoman, Dame, Duchess' },
  { style: 'plain', label: 'Plain', note: 'The bare rank word, as the old system never offered' },
]

export const DISPLAY_NAME_MAX = 40

/** The rank names in one style, with the peerage marked where it begins. */
export function rankPreview(style: TitleStyle): { commoners: string[]; peers: string[] } {
  const commoners = RANKS.filter((r: RankDefinition) => !r.peer).map((r: RankDefinition) => rankName(r, style))
  const peers = RANKS.filter((r: RankDefinition) => r.peer).map((r: RankDefinition) => rankName(r, style))
  return { commoners, peers }
}

const RADIO_BASE =
  'flex min-h-11 w-full flex-col items-start rounded-card border px-3 py-2 text-left transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory'

const INPUT_CLASSES =
  'mt-2 w-full min-h-11 rounded-card border border-rule bg-parchment px-3 font-serif text-base text-ink placeholder:text-ink-mute ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory'

export default function SettingsScreen() {
  const navigate = useNavigate()
  const state = useAsync<SettingsData>(loadSettings, [])
  const [edited, setEdited] = useState<Profile | null>(null)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [resetStep, setResetStep] = useState<'idle' | 'confirm' | 'clearing'>('idle')
  const latest = useRef<Profile | null>(null)

  const profile = edited ?? state.data?.profile ?? null
  latest.current = profile

  // Move focus to the confirmation when it appears, so a thumb and a screen reader both land on it.
  const confirmRef = useRef<HTMLButtonElement>(null)
  const styleGroupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (resetStep === 'confirm') confirmRef.current?.focus()
  }, [resetStep])

  if (state.status === 'loading' && !state.data) return <Spinner label="Fetching the household book." />
  if (state.status === 'error' && !state.data) {
    return (
      <>
        <PageTitle kicker="Aristocracy">Settings</PageTitle>
        <ErrorNotice message="The household book could not be opened." detail={state.error} onRetry={state.reload} />
      </>
    )
  }
  if (!profile) return null
  const rank = (state.data as SettingsData).rank

  const persist = async (patch: Partial<Profile>, line?: string) => {
    const current = latest.current ?? profile
    const next: Profile = { ...current, ...patch }
    setEdited(next)
    setNotice(null)
    try {
      // Only the changed fields go to the store: this screen's profile was read
      // when it opened, and a session completed since then may have moved
      // prestige, guineas and lesson progress on.
      const saved = await saveProfile(patch)
      setEdited(saved)
      if (line) setNotice({ text: line })
    } catch (error) {
      setEdited(current)
      setNotice({ text: `That could not be saved. ${error instanceof Error ? error.message : ''}`.trim(), error: true })
    }
  }

  /**
   * The radio-group pattern a screen reader promises when it announces this as
   * a radio group: one tab stop for the whole group (the checked radio), and
   * the arrow keys moving the choice along it.
   */
  const onStyleKey = (e: KeyboardEvent<HTMLButtonElement>, style: TitleStyle) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    const step = keys[e.key]
    if (step === undefined) return
    e.preventDefault()
    const index = TITLE_STYLES.findIndex((o) => o.style === style)
    const next = TITLE_STYLES[(index + step + TITLE_STYLES.length) % TITLE_STYLES.length]
    void persist({ titleStyle: next.style })
    styleGroupRef.current?.querySelector<HTMLButtonElement>(`[data-testid="title-style-${next.style}"]`)?.focus()
  }

  const commitName = () => {
    if (nameDraft === null) return
    const trimmed = nameDraft.trim().slice(0, DISPLAY_NAME_MAX)
    setNameDraft(null)
    if (trimmed === profile.displayName) return
    void persist({ displayName: trimmed }, 'Name noted.')
  }

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const startAgain = async () => {
    setResetStep('clearing')
    try {
      await resetAll()
      navigate('/', { replace: true })
    } catch (error) {
      setResetStep('idle')
      setNotice({ text: `The house could not be cleared. ${error instanceof Error ? error.message : ''}`.trim(), error: true })
    }
  }

  const preview = rankPreview(profile.titleStyle)
  const currentName = rankName(rank, profile.titleStyle)

  return (
    <div data-testid="settings-screen">
      <PageTitle kicker="Aristocracy" sub={`Presently ${currentName}.`}>
        Settings
      </PageTitle>

      {notice ? (
        <p className={`mb-3 text-sm ${notice.error ? 'text-oxblood' : 'text-ink-mute'}`} role="status" data-testid="settings-notice">
          {notice.text}
        </p>
      ) : null}

      <Card as="section" aria-labelledby="settings-name">
        <label htmlFor="display-name" className="block">
          <span id="settings-name" className="smallcaps text-xs text-ink-mute">
            Your name
          </span>
          <input
            id="display-name"
            type="text"
            className={INPUT_CLASSES}
            value={nameDraft ?? profile.displayName}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="name"
            placeholder="As it should appear on the letters patent"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={onNameKey}
            data-testid="display-name"
          />
        </label>
        <p className="mt-2 text-sm text-ink-mute">Saved when you leave the field.</p>
      </Card>

      <Card as="section" className="mt-4" aria-labelledby="settings-style">
        <p id="settings-style" className="smallcaps text-xs text-ink-mute">
          Style of title
        </p>
        <div ref={styleGroupRef} role="radiogroup" aria-labelledby="settings-style" className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TITLE_STYLES.map((opt) => {
            const checked = profile.titleStyle === opt.style
            return (
              <button
                key={opt.style}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                onKeyDown={(e) => onStyleKey(e, opt.style)}
                onClick={() => {
                  if (!checked) void persist({ titleStyle: opt.style })
                }}
                data-testid={`title-style-${opt.style}`}
                className={`${RADIO_BASE} ${checked ? 'border-oxblood bg-ivory-deep text-ink' : 'border-rule bg-parchment text-ink hover:bg-ivory-deep'}`}
              >
                <span className={`font-serif text-base ${checked ? 'text-oxblood' : ''}`}>{opt.label}</span>
                <span className="text-xs text-ink-mute">{opt.note}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-ink-soft" data-testid="rank-preview">
          {preview.commoners.map((n, i) => (
            <span key={`c${i}`}>
              {i > 0 ? ', ' : ''}
              {n === currentName ? <strong className="text-ink">{n}</strong> : n}
            </span>
          ))}
          {preview.peers.length ? (
            <>
              <span className="text-ink-mute">; then the peerage: </span>
              {preview.peers.map((n, i) => (
                <span key={`p${i}`}>
                  {i > 0 ? ', ' : ''}
                  {n === currentName ? <strong className="text-ink">{n}</strong> : n}
                </span>
              ))}
              .
            </>
          ) : (
            '.'
          )}
        </p>
      </Card>

      <Card as="section" className="mt-4" aria-labelledby="settings-sound">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p id="settings-sound" className="smallcaps text-xs text-ink-mute">
              Sound
            </p>
            <p className="mt-1 text-sm text-ink-soft">Themes for Drop the Needle. Off, the exercise can still be answered.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.soundEnabled}
            aria-labelledby="settings-sound"
            onClick={() => void persist({ soundEnabled: !profile.soundEnabled })}
            data-testid="sound-toggle"
            className="inline-flex min-h-11 items-center gap-2 rounded-card px-2 font-serif text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory"
          >
            <span className="smallcaps text-sm">{profile.soundEnabled ? 'On' : 'Off'}</span>
            <span aria-hidden="true" className={`relative block h-6 w-11 rounded-full border transition-colors ${profile.soundEnabled ? 'border-oxblood bg-oxblood' : 'border-ink-mute bg-ivory-deep'}`}>
              <span className={`absolute top-0.5 block size-[18px] rounded-full transition-transform ${profile.soundEnabled ? 'translate-x-[22px] bg-ivory' : 'translate-x-0.5 bg-ink-mute'}`} />
            </span>
          </button>
        </div>
      </Card>

      <Card as="section" className="mt-4" aria-labelledby="settings-reset">
        <p id="settings-reset" className="smallcaps text-xs text-ink-mute">
          Start again
        </p>
        {resetStep === 'idle' ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">Clears the Collection, the Estate, your Standing and your Guineas from this device.</p>
            <Button variant="secondary" className="mt-3" onClick={() => setResetStep('confirm')} data-testid="reset-start">
              Start again
            </Button>
          </>
        ) : (
          <div role="group" aria-label="Confirm starting again" data-testid="reset-confirmation">
            <p className="mt-1 text-ink">Everything acquired here will be gone, and there is no getting it back. Are you sure?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button ref={confirmRef} onClick={() => void startAgain()} disabled={resetStep === 'clearing'} data-testid="reset-confirm">
                {resetStep === 'clearing' ? 'Clearing the house.' : 'Yes, start again'}
              </Button>
              <Button variant="quiet" onClick={() => setResetStep('idle')} disabled={resetStep === 'clearing'} data-testid="reset-cancel">
                Keep everything
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="mt-6 text-center text-xs text-ink-mute">Aristocracy, the Departure. Everything is kept on this device.</p>
    </div>
  )
}
