/**
 * The Remark: a social situation, something said to you, and three replies:
 * one graceful, one factually wrong, one gaffe. The setting sits in small caps
 * with the prompt beneath it as a quotation, then three full-width reply
 * buttons in the order the session builder shuffled them.
 *
 * One tap answers: `onAnswer` is called exactly once with `correct` (the reply
 * was the graceful one), `remarkKind` (which kind was chosen) and `chosen`
 * (the option id). Once the runner passes `answered` back the buttons lock,
 * the graceful reply is ruled in gilt, a wrong or gaffe choice in oxblood, and
 * every reply's explanation appears beneath it. The Feedback panel and the
 * Continue button belong to the session runner.
 */
import { useCallback, useId, useRef } from 'react'
import type { RemarkOption, RemarkOptionKind } from '../content/types'
import type { Answer, RemarkExercise } from '../engine/types'
import { nowMs, type OptionState } from './ChoiceBase'
import type { ExerciseProps } from './types'

export type RemarkChoice = RemarkOption & { id: string }

/** Small-caps label over each explanation once the exercise is answered. */
export const REMARK_KIND_LABEL: Record<RemarkOptionKind, string> = {
  correct: 'The graceful reply',
  wrong: 'Wrong',
  gaffe: 'A gaffe',
}

/** True when this option is the one the user chose. */
export function isChosenRemark(answered: Answer | null, option: RemarkChoice): boolean {
  if (!answered) return false
  if (typeof answered.chosen === 'string') return answered.chosen === option.id
  return answered.remarkKind === option.kind
}

/** How a reply should look: idle before answering; afterwards the graceful reply is correct, the user's other choice wrong, the rest dim. */
export function remarkState(answered: Answer | null, option: RemarkChoice): OptionState {
  if (!answered) return 'idle'
  if (option.kind === 'correct') return 'correct'
  if (isChosenRemark(answered, option)) return 'wrong'
  return 'dim'
}

const BUTTON_BASE =
  'flex w-full min-h-11 items-start gap-3 rounded-card border bg-parchment px-4 py-3 text-left font-serif text-base leading-snug ' +
  'transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-default'

const BUTTON_STATE: Record<OptionState, string> = {
  idle: 'border-rule text-ink hover:bg-ivory-deep active:bg-ivory-deep',
  correct: 'border-gilt text-ink ring-1 ring-inset ring-gilt',
  wrong: 'border-oxblood text-oxblood ring-1 ring-inset ring-oxblood',
  dim: 'border-rule text-ink-mute',
}

export function Remark({ exercise, answered, onAnswer }: ExerciseProps<RemarkExercise>) {
  const startedAt = useRef(nowMs())
  const fired = useRef(false)
  const promptId = useId()
  const locked = Boolean(answered)
  const { scenario } = exercise

  const choose = useCallback(
    (option: RemarkChoice) => {
      if (fired.current || answered) return
      fired.current = true
      onAnswer({
        exerciseId: exercise.id,
        correct: option.kind === 'correct',
        itemIds: [...exercise.itemIds],
        msElapsed: Math.max(0, Math.round(nowMs() - startedAt.current)),
        remarkKind: option.kind,
        chosen: option.id,
      })
    },
    [answered, exercise, onAnswer],
  )

  return (
    <section data-testid="exercise-remark" className="space-y-5" aria-labelledby={promptId}>
      <div className="space-y-2">
        <p className="smallcaps text-sm text-ink-soft" data-testid="remark-setting">
          {scenario.setting}
        </p>
        <blockquote id={promptId} className="font-serif text-xl leading-snug text-ink" data-testid="remark-prompt">
          {scenario.prompt}
        </blockquote>
      </div>

      <p className="smallcaps text-xs text-ink-mute">You reply</p>
      <div role="group" aria-label="Replies" className="space-y-3">
        {exercise.options.map((option) => {
          const state = remarkState(answered, option)
          const chosen = isChosenRemark(answered, option)
          const tag = state === 'correct' ? 'graceful' : chosen ? 'your reply' : null
          return (
            <div key={option.id} className="space-y-1">
              <button
                type="button"
                data-testid={`option-${option.id}`}
                data-state={state}
                data-kind={option.kind}
                disabled={locked}
                onClick={() => choose(option)}
                className={`${BUTTON_BASE} ${BUTTON_STATE[state]}`}
              >
                <span className="flex-1">“{option.text}”</span>
                {tag ? <span className="smallcaps shrink-0 self-center font-sans text-xs">{tag}</span> : null}
              </button>
              {answered ? (
                <div className="px-4 pb-1" data-testid={`remark-explanation-${option.id}`}>
                  <p className={`smallcaps text-xs ${state === 'wrong' ? 'text-oxblood' : 'text-ink-mute'}`}>
                    {chosen && state !== 'correct' ? 'Your reply · ' : ''}
                    {REMARK_KIND_LABEL[option.kind]}
                  </p>
                  <p className="text-sm leading-snug text-ink-soft">{option.explanation}</p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default Remark
