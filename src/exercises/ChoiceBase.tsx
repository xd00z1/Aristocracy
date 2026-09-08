/**
 * Shared layout for the four-option choice exercises: Drop the Needle,
 * Zoom Out, Lexicon, Who's Who and Identify.
 *
 * The question sits in serif over four full-width option buttons. The first
 * tap calls `onAnswer` exactly once with `{ exerciseId, correct, itemIds,
 * msElapsed, chosen }`; once the runner passes `answered` back the buttons
 * lock, the correct option is ruled in gilt and a wrong choice in oxblood.
 * The Feedback panel and the Continue button belong to the session runner.
 *
 * Wrappers put their media (a play button, a portrait, a term) in `children`,
 * above the question, and may merge extra fields into the Answer through
 * `answerExtras` (Zoom Out adds `earlyFraction`).
 */
import { useCallback, useId, useRef, type ReactNode } from 'react'
import type { Answer, ChoiceExercise, Option } from '../engine/types'
import type { ExerciseProps } from './types'

export type OptionState = 'idle' | 'correct' | 'wrong' | 'dim'

export interface ChoiceBaseProps extends ExerciseProps<ChoiceExercise> {
  /** Rendered above the question: a portrait, a play button, a term. */
  children?: ReactNode
  /** One dry line under the question, e.g. "Image not fetched yet." */
  notice?: string
  /** Long options (definitions) read better left-aligned. */
  optionAlign?: 'center' | 'left'
  /** Extra classes for the question, e.g. smaller when the term is shown large above it. */
  questionClassName?: string
  /** Called at the moment of answering; the result is merged into the Answer. */
  answerExtras?: () => Partial<Answer>
  /** Called after `onAnswer`, e.g. to finish a reveal. */
  onAnswered?: (answer: Answer) => void
}

/** Monotonic-ish clock for `msElapsed`; falls back to Date.now() where performance is absent. */
export function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
}

/** How an option should look once the exercise has been answered. */
export function optionState(exercise: ChoiceExercise, answered: Answer | null, optionId: string): OptionState {
  if (!answered) return 'idle'
  if (optionId === exercise.correctOptionId) return 'correct'
  if (answered.chosen === optionId) return 'wrong'
  return 'dim'
}

const OPTION_BASE =
  'flex w-full min-h-11 items-start gap-3 rounded-card border bg-parchment px-4 py-3 font-serif text-base leading-snug ' +
  'transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-default'

const OPTION_STATE: Record<OptionState, string> = {
  idle: 'border-rule text-ink hover:bg-ivory-deep active:bg-ivory-deep',
  correct: 'border-gilt text-ink ring-1 ring-inset ring-gilt',
  wrong: 'border-oxblood text-oxblood ring-1 ring-inset ring-oxblood',
  dim: 'border-rule text-ink-mute',
}

const OPTION_TAG: Partial<Record<OptionState, string>> = {
  correct: 'the answer',
  wrong: 'your answer',
}

export function ChoiceBase({
  exercise,
  answered,
  onAnswer,
  children,
  notice,
  optionAlign = 'center',
  questionClassName = '',
  answerExtras,
  onAnswered,
}: ChoiceBaseProps) {
  const startedAt = useRef(nowMs())
  const fired = useRef(false)
  const questionId = useId()
  const locked = Boolean(answered)

  const choose = useCallback(
    (option: Option) => {
      if (fired.current || answered) return
      fired.current = true
      const answer: Answer = {
        exerciseId: exercise.id,
        correct: option.id === exercise.correctOptionId,
        itemIds: [...exercise.itemIds],
        msElapsed: Math.max(0, Math.round(nowMs() - startedAt.current)),
        chosen: option.id,
        ...(answerExtras ? answerExtras() : {}),
      }
      onAnswer(answer)
      onAnswered?.(answer)
    },
    [answered, exercise, onAnswer, answerExtras, onAnswered],
  )

  const align = optionAlign === 'left' ? 'text-left' : 'justify-center text-center'

  return (
    <section data-testid={`exercise-${exercise.type}`} className="space-y-5" aria-labelledby={questionId}>
      {children}
      <div className="space-y-1">
        <h2 id={questionId} className={`font-serif text-xl leading-snug text-ink ${questionClassName}`.trim()}>
          {exercise.question}
        </h2>
        {notice ? (
          <p className="font-sans text-xs text-ink-mute" data-testid="choice-notice">
            {notice}
          </p>
        ) : null}
      </div>
      <div role="group" aria-label="Options" className="space-y-2">
        {exercise.options.map((option) => {
          const state = optionState(exercise, answered, option.id)
          const tag = OPTION_TAG[state]
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`option-${option.id}`}
              data-state={state}
              disabled={locked}
              onClick={() => choose(option)}
              className={`${OPTION_BASE} ${OPTION_STATE[state]} ${align}`}
            >
              <span className={optionAlign === 'left' ? 'flex-1' : ''}>
                {option.label}
                {option.sublabel ? <span className="block font-sans text-xs text-ink-mute">{option.sublabel}</span> : null}
              </span>
              {tag ? <span className="smallcaps shrink-0 self-center font-sans text-xs">{tag}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default ChoiceBase
