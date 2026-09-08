/**
 * Timeline: three or four entries to put in chronological order by tapping,
 * never dragging. The shuffled entries wait in a pool as cards showing label
 * and sublabel but no year. Tapping one appends it to the numbered list above
 * and removes it from the pool; "Start again" empties the list; "Submit" is
 * enabled only once every entry is placed and answers exactly once, correct
 * when the placed ids equal `correctOrder`.
 *
 * Once the runner passes `answered` back, the working list gives way to the
 * entries in their correct order with their years, the misplaced ones ruled
 * in oxblood. The Feedback panel and the Continue button belong to the
 * session runner.
 */
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { Item } from '../content/types'
import type { TimelineEntry, TimelineExercise } from '../engine/types'
import { Button } from '../ui/Button'
import { nowMs } from './ChoiceBase'
import type { ExerciseProps } from './types'

/** True when the placed ids are exactly the correct order. */
export function isCorrectOrder(placed: readonly string[], correctOrder: readonly string[]): boolean {
  return placed.length === correctOrder.length && placed.every((id, i) => id === correctOrder[i])
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th". */
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

/** The entry's year, with "c." when the item marks it approximate. */
export function yearLabel(entry: TimelineEntry, item: Item | undefined): string {
  return `${item?.year_approx ? 'c. ' : ''}${entry.year}`
}

const ENTRY_BUTTON =
  'flex w-full min-h-11 flex-col items-start rounded-card border border-rule bg-parchment px-4 py-3 text-left font-serif text-base leading-snug text-ink ' +
  'transition-colors duration-150 select-none hover:bg-ivory-deep active:bg-ivory-deep ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-default'

function EntryText({ entry, muted = false }: { entry: TimelineEntry; muted?: boolean }) {
  return (
    <>
      <span>{entry.label}</span>
      {entry.sublabel ? <span className={`block font-sans text-xs ${muted ? 'text-ink-mute' : 'text-ink-soft'}`}>{entry.sublabel}</span> : null}
    </>
  )
}

export function Timeline({ exercise, items, answered, onAnswer }: ExerciseProps<TimelineExercise>) {
  const startedAt = useRef(nowMs())
  const fired = useRef(false)
  const questionId = useId()
  const [placed, setPlaced] = useState<string[]>([])
  const locked = Boolean(answered)

  const byId = useMemo(() => new Map(exercise.entries.map((e) => [e.id, e])), [exercise.entries])
  const pool = exercise.entries.filter((e) => !placed.includes(e.id))
  const complete = placed.length === exercise.entries.length

  const place = useCallback(
    (id: string) => {
      if (locked) return
      setPlaced((prev) => (prev.includes(id) ? prev : [...prev, id]))
    },
    [locked],
  )

  const reset = useCallback(() => {
    if (locked) return
    setPlaced([])
  }, [locked])

  const submit = useCallback(() => {
    if (fired.current || answered || !complete) return
    fired.current = true
    onAnswer({
      exerciseId: exercise.id,
      correct: isCorrectOrder(placed, exercise.correctOrder),
      itemIds: [...exercise.itemIds],
      msElapsed: Math.max(0, Math.round(nowMs() - startedAt.current)),
      chosen: [...placed],
    })
  }, [answered, complete, exercise, onAnswer, placed])

  if (answered) {
    // The order the user submitted: from the answer when the runner kept it, else from local state.
    const userOrder = Array.isArray(answered.chosen) ? answered.chosen : placed
    const known = userOrder.length > 0
    return (
      <section data-testid="exercise-timeline" className="space-y-5" aria-labelledby={questionId}>
        <h2 id={questionId} className="font-serif text-xl leading-snug text-ink">
          {exercise.question}
        </h2>
        <p className="smallcaps text-xs text-ink-mute">In order</p>
        <ol data-testid="timeline-result" aria-label="The correct order" className="space-y-2">
          {exercise.correctOrder.map((id, i) => {
            const entry = byId.get(id)
            if (!entry) return null
            const misplaced = known && userOrder[i] !== id
            const userPos = userOrder.indexOf(id)
            return (
              <li
                key={id}
                data-testid={`timeline-result-${id}`}
                data-state={misplaced ? 'misplaced' : 'correct'}
                className={`flex min-h-11 items-start gap-3 rounded-card border bg-parchment px-4 py-3 font-serif text-base leading-snug ring-1 ring-inset ${
                  misplaced ? 'border-oxblood text-oxblood ring-oxblood' : 'border-gilt text-ink ring-gilt'
                }`}
              >
                <span className="w-6 shrink-0 tabular-nums text-ink-mute">{i + 1}.</span>
                <span className="flex-1">
                  <EntryText entry={entry} muted={!misplaced} />
                  {misplaced && userPos >= 0 ? (
                    <span className="smallcaps block font-sans text-xs text-oxblood-soft">you had it {ordinal(userPos + 1)}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums" data-testid={`timeline-year-${id}`}>
                  {yearLabel(entry, items[entry.itemId])}
                </span>
              </li>
            )
          })}
        </ol>
      </section>
    )
  }

  return (
    <section data-testid="exercise-timeline" className="space-y-5" aria-labelledby={questionId}>
      <h2 id={questionId} className="font-serif text-xl leading-snug text-ink">
        {exercise.question}
      </h2>

      <ol data-testid="timeline-placed" aria-label="Your order" className="space-y-2">
        {exercise.entries.map((_, i) => {
          const entry = placed[i] ? byId.get(placed[i]) : undefined
          return (
            <li
              key={i}
              data-testid={`timeline-slot-${i + 1}`}
              data-entry={entry?.id ?? ''}
              className={`flex min-h-11 items-start gap-3 rounded-card border px-4 py-3 font-serif text-base leading-snug ${
                entry ? 'border-rule bg-parchment text-ink' : 'border-dashed border-rule text-ink-mute'
              }`}
            >
              <span className="w-6 shrink-0 tabular-nums text-ink-mute">{i + 1}.</span>
              <span className="flex-1">{entry ? <EntryText entry={entry} /> : <span aria-label="empty">—</span>}</span>
            </li>
          )
        })}
      </ol>

      {pool.length ? (
        <div role="group" aria-label="Entries to place" data-testid="timeline-pool" className="space-y-2">
          <p className="smallcaps text-xs text-ink-mute">Tap the earliest first</p>
          {pool.map((entry) => (
            <button key={entry.id} type="button" data-testid={`timeline-entry-${entry.id}`} onClick={() => place(entry.id)} className={ENTRY_BUTTON}>
              <EntryText entry={entry} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="secondary" data-testid="timeline-reset" disabled={placed.length === 0 || locked} onClick={reset}>
          Start again
        </Button>
        <Button variant="primary" data-testid="timeline-submit" disabled={!complete || locked} onClick={submit} className="flex-1">
          Submit
        </Button>
      </div>
    </section>
  )
}

export default Timeline
