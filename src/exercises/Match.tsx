/**
 * Match: pair each entry on the left with its partner on the right by tapping
 * one side and then the other; no dragging. The right column is shuffled with
 * the house PRNG seeded from the exercise id, so a session shows the same
 * board every time it is rendered. A correct pair locks and dims; a wrong pair
 * flashes oxblood for a moment and counts a mistake, shown as "Mistakes: n".
 * When every pair is locked the exercise answers exactly once: correct when
 * at most one mistake was made, `chosen` = the pair ids in the order matched.
 *
 * Once the runner passes `answered` back everything locks. The Feedback panel
 * and the Continue button belong to the session runner.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hashString, mulberry32, shuffle, type MatchExercise, type MatchPair } from '../engine/types'
import { nowMs } from './ChoiceBase'
import type { ExerciseProps } from './types'

/** A pair count above this is a wrong answer. */
export const MAX_MISTAKES = 1
/** How long a wrong pair stays oxblood. */
export const FLASH_MS = 700

export type MatchSide = 'left' | 'right'
export type MatchButtonState = 'idle' | 'selected' | 'locked' | 'wrong'

/**
 * The right column in display order: the pairs shuffled by
 * `mulberry32(hashString(exercise.id))`. Should the shuffle land on the
 * left column's own order, the column is rotated by one so the pairs never
 * line up across the board.
 */
export function rightColumn(exercise: Pick<MatchExercise, 'id' | 'pairs'>): MatchPair[] {
  const shuffled = shuffle(exercise.pairs, mulberry32(hashString(exercise.id)))
  const aligned = shuffled.length > 1 && shuffled.every((p, i) => p.id === exercise.pairs[i].id)
  return aligned ? [...shuffled.slice(1), shuffled[0]] : shuffled
}

const BUTTON_BASE =
  'flex w-full min-h-11 items-center rounded-card border bg-parchment px-3 py-2 text-left font-serif text-sm leading-snug sm:text-base ' +
  'transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-default'

const BUTTON_STATE: Record<MatchButtonState, string> = {
  idle: 'border-rule text-ink hover:bg-ivory-deep active:bg-ivory-deep',
  selected: 'border-ink bg-ivory-deep text-ink ring-1 ring-inset ring-ink',
  locked: 'border-rule bg-ivory text-ink-mute',
  wrong: 'border-oxblood text-oxblood ring-1 ring-inset ring-oxblood',
}

interface Selection {
  side: MatchSide
  id: string
}

interface Flash {
  left: string
  right: string
}

export function Match({ exercise, answered, onAnswer }: ExerciseProps<MatchExercise>) {
  const startedAt = useRef(nowMs())
  const fired = useRef(false)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [lockedIds, setLockedIds] = useState<string[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [flash, setFlash] = useState<Flash | null>(null)
  const done = Boolean(answered)

  const right = useMemo(() => rightColumn(exercise), [exercise])

  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(timer)
  }, [flash])

  const tap = useCallback(
    (side: MatchSide, id: string) => {
      if (done || lockedIds.includes(id)) return
      setFlash(null)
      if (!selected) {
        setSelected({ side, id })
        return
      }
      if (selected.side === side) {
        // Same column: switch the selection, or clear it when tapping the selected one again.
        setSelected(selected.id === id ? null : { side, id })
        return
      }
      const leftId = side === 'left' ? id : selected.id
      const rightId = side === 'right' ? id : selected.id
      setSelected(null)
      if (leftId !== rightId) {
        setMistakes((m) => m + 1)
        setFlash({ left: leftId, right: rightId })
        return
      }
      const next = [...lockedIds, leftId]
      setLockedIds(next)
      if (next.length === exercise.pairs.length && !fired.current) {
        fired.current = true
        onAnswer({
          exerciseId: exercise.id,
          correct: mistakes <= MAX_MISTAKES,
          itemIds: [...exercise.itemIds],
          msElapsed: Math.max(0, Math.round(nowMs() - startedAt.current)),
          chosen: next,
        })
      }
    },
    [done, exercise, lockedIds, mistakes, onAnswer, selected],
  )

  const stateFor = (side: MatchSide, id: string): MatchButtonState => {
    if (done || lockedIds.includes(id)) return 'locked'
    if (flash && flash[side] === id) return 'wrong'
    if (selected && selected.side === side && selected.id === id) return 'selected'
    return 'idle'
  }

  const renderButton = (side: MatchSide, pair: MatchPair) => {
    const state = stateFor(side, pair.id)
    return (
      <button
        key={pair.id}
        type="button"
        data-testid={`match-${side}-${pair.id}`}
        data-state={state}
        aria-pressed={state === 'selected'}
        disabled={state === 'locked'}
        onClick={() => tap(side, pair.id)}
        className={`${BUTTON_BASE} ${BUTTON_STATE[state]}`}
      >
        {side === 'left' ? pair.left : pair.right}
      </button>
    )
  }

  return (
    <section data-testid="exercise-match" className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-xl leading-snug text-ink">{exercise.question}</h2>
        <p className="font-sans text-xs text-ink-mute">Tap one on each side to pair them.</p>
      </div>

      <div role="group" aria-label="Pairs" className="grid grid-cols-2 gap-2">
        <div className="space-y-2" data-testid="match-left-column">
          {exercise.pairs.map((pair) => renderButton('left', pair))}
        </div>
        <div className="space-y-2" data-testid="match-right-column">
          {right.map((pair) => renderButton('right', pair))}
        </div>
      </div>

      <p
        data-testid="match-mistakes"
        aria-live="polite"
        className={`smallcaps text-sm ${mistakes > MAX_MISTAKES ? 'text-oxblood' : 'text-ink-mute'}`}
      >
        Mistakes: {mistakes}
      </p>
    </section>
  )
}

export default Match
