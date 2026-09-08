/**
 * Apocrypha: a famous line or story, attributed to someone, and a verdict:
 * attested, embellished or invented. One tap answers; afterwards the buttons
 * lock, the right verdict is ruled in gilt and a wrong one in oxblood. The
 * truth and its sources follow in the shared Feedback panel, which the session
 * runner renders beneath every answered exercise; nothing is shown twice.
 */
import { useCallback, useRef } from 'react'
import { VERDICTS } from '../content/constants'
import type { Verdict } from '../content/types'
import type { Answer, ApocryphaExercise } from '../engine/types'
import { nowMs, type OptionState } from './ChoiceBase'
import type { ExerciseProps } from './types'

export const VERDICT_LABEL: Record<Verdict, string> = {
  attested: 'Attested',
  embellished: 'Embellished',
  invented: 'Invented',
}

export const VERDICT_GLOSS: Record<Verdict, string> = {
  attested: 'It was said or done, and a source has it.',
  embellished: 'Something like it happened; the telling has grown.',
  invented: 'No contemporary source; it was made up later.',
}

const BUTTON_BASE =
  'flex w-full min-h-11 flex-col items-start rounded-card border bg-parchment px-4 py-3 text-left font-serif leading-snug ' +
  'transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-default'

const BUTTON_STATE: Record<OptionState, string> = {
  idle: 'border-rule text-ink hover:bg-ivory-deep active:bg-ivory-deep',
  correct: 'border-gilt text-ink ring-1 ring-inset ring-gilt',
  wrong: 'border-oxblood text-oxblood ring-1 ring-inset ring-oxblood',
  dim: 'border-rule text-ink-mute',
}

export function verdictState(exercise: ApocryphaExercise, answered: Answer | null, verdict: Verdict): OptionState {
  if (!answered) return 'idle'
  if (verdict === exercise.correctVerdict) return 'correct'
  if (answered.chosen === verdict) return 'wrong'
  return 'dim'
}

export function Apocrypha({ exercise, answered, onAnswer }: ExerciseProps<ApocryphaExercise>) {
  const startedAt = useRef(nowMs())
  const fired = useRef(false)
  const locked = Boolean(answered)

  const choose = useCallback(
    (verdict: Verdict) => {
      if (fired.current || answered) return
      fired.current = true
      onAnswer({
        exerciseId: exercise.id,
        correct: verdict === exercise.correctVerdict,
        itemIds: [...exercise.itemIds],
        msElapsed: Math.max(0, Math.round(nowMs() - startedAt.current)),
        chosen: verdict,
      })
    },
    [answered, exercise, onAnswer],
  )

  return (
    <section data-testid="exercise-apocrypha" className="space-y-5">
      <blockquote className="space-y-2" data-testid="apocrypha-claim">
        <p className="font-serif text-2xl leading-snug text-ink">“{exercise.claim}”</p>
        <footer className="text-base italic text-ink-soft">attributed to {exercise.attributedTo}</footer>
      </blockquote>

      <p className="smallcaps text-xs text-ink-mute">Your verdict</p>
      <div role="group" aria-label="Verdict" className="space-y-2">
        {VERDICTS.map((verdict) => {
          const state = verdictState(exercise, answered, verdict)
          return (
            <button
              key={verdict}
              type="button"
              data-testid={`apocrypha-${verdict}`}
              data-state={state}
              disabled={locked}
              onClick={() => choose(verdict)}
              className={`${BUTTON_BASE} ${BUTTON_STATE[state]}`}
            >
              <span className="text-base">{VERDICT_LABEL[verdict]}</span>
              <span className={`font-sans text-xs ${state === 'wrong' ? 'text-oxblood-soft' : 'text-ink-mute'}`}>{VERDICT_GLOSS[verdict]}</span>
            </button>
          )
        })}
      </div>

    </section>
  )
}

export default Apocrypha
