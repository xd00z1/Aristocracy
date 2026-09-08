/**
 * Drop the Needle: a synthesised opening phrase, four options.
 *
 * A large "Drop the needle" button starts the theme (from the tap, so the
 * AudioContext is resumed inside a user gesture); on later slots, once that
 * context is running, the theme plays itself on mount. A thin gilt line tracks
 * playback and the button doubles as the replay affordance. When sound is off or the item has no
 * theme, a one-line notice and a short clue take the theme's place and the
 * question can still be answered: sessions never block on media.
 */
import { useEffect, useRef } from 'react'
import { audioContextRunning } from '../audio/synth'
import { useThemePlayer } from '../audio/useThemePlayer'
import type { Item } from '../content/types'
import { redactNames } from '../engine/distractors'
import type { ChoiceAsk, ChoiceExercise } from '../engine/types'
import { Button } from '../ui'
import { ChoiceBase } from './ChoiceBase'
import type { ExerciseProps } from './types'

export interface NeedleClue {
  line: string
  detail?: string
}

function yearLabel(item: Item): string | undefined {
  if (item.year === undefined) return undefined
  return `${item.year_approx ? 'c. ' : ''}${item.year}`
}

/**
 * What to show instead of the theme. Asking for the creator, the title will
 * do; asking for the title, the creator and a fact with the title redacted.
 */
export function needleClue(item: Item | undefined, askFor: ChoiceAsk): NeedleClue | null {
  if (!item) return null
  const year = yearLabel(item)
  if (askFor === 'creator') {
    return { line: `“${item.title}”`, detail: year }
  }
  if (askFor === 'title') {
    const fact = item.facts[0] ? redactNames(item.facts[0], [item.title, ...(item.parent ? [item.parent] : [])]) : undefined
    const by = item.creator ? `By ${item.creator}` : undefined
    const line = [by, year].filter(Boolean).join(', ')
    return { line: line || item.era, detail: fact }
  }
  return { line: `“${item.title}”`, detail: [item.creator, year].filter(Boolean).join(', ') || undefined }
}

export function DropTheNeedle(props: ExerciseProps<ChoiceExercise>) {
  const { exercise, items, answered, soundEnabled } = props
  const item = items[exercise.itemId]
  const theme = item?.theme
  const canPlay = soundEnabled && Boolean(theme)

  const player = useThemePlayer(theme, soundEnabled)
  const playRef = useRef(player.play)
  playRef.current = player.play

  // One attempt on mount, but only once the audio device is already running
  // (the reader has pressed play at least once this session). Before that a
  // context opened outside a tap is suspended and would sound nothing, so the
  // button is left to say "Drop the needle" instead.
  const autoplay = useRef(canPlay && !answered && audioContextRunning())
  useEffect(() => {
    if (autoplay.current) playRef.current()
  }, [])

  const hasPlayed = player.playing || player.progress > 0
  const label = player.playing ? 'Playing' : hasPlayed ? 'Play again' : 'Drop the needle'
  const notice = !soundEnabled
    ? 'Sound is off. Answer from the clue instead.'
    : !theme
      ? 'No theme is set for this work yet. Answer from the clue instead.'
      : undefined
  const clue = canPlay ? null : needleClue(item, exercise.askFor)

  return (
    <ChoiceBase {...props} notice={notice}>
      <div className="space-y-3" data-testid="needle">
        <Button
          block
          data-testid="play-theme"
          className="min-h-14 text-lg"
          disabled={!canPlay}
          aria-label={label}
          onClick={() => player.play()}
        >
          {label}
        </Button>
        {canPlay && hasPlayed ? (
          <div
            className="h-0.5 w-full bg-rule"
            role="progressbar"
            aria-label="Theme progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(player.progress * 100)}
            data-testid="theme-progress"
          >
            <div className="h-full bg-gilt" style={{ width: `${Math.round(player.progress * 100)}%` }} />
          </div>
        ) : null}
        {clue ? (
          <div className="rounded-card border border-rule bg-parchment px-4 py-3 shadow-card" data-testid="theme-clue">
            <p className="font-serif text-lg leading-snug text-ink">{clue.line}</p>
            {clue.detail ? <p className="mt-1 text-sm text-ink-soft">{clue.detail}</p> : null}
          </div>
        ) : null}
      </div>
    </ChoiceBase>
  )
}

export default DropTheNeedle
