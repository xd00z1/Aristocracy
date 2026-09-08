/**
 * Lexicon: the term in large serif with its pronunciation and language
 * beneath, and four definitions to choose from. Definitions run long, so the
 * options wrap and sit left-aligned.
 */
import type { ChoiceExercise } from '../engine/types'
import { ChoiceBase } from './ChoiceBase'
import type { ExerciseProps } from './types'

export function Lexicon(props: ExerciseProps<ChoiceExercise>) {
  const { exercise, items } = props
  const item = items[exercise.itemId]
  const meta = [item?.pronunciation, item?.language].filter((s): s is string => Boolean(s))

  return (
    <ChoiceBase {...props} optionAlign="left" questionClassName="text-base text-ink-soft">
      {item ? (
        <div className="text-center" data-testid="lexicon-term">
          <p className="font-serif text-4xl leading-tight text-ink">
            {item.title}
          </p>
          {meta.length ? (
            <p className="mt-1 font-sans text-sm text-ink-mute" data-testid="lexicon-meta">
              {meta.join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </ChoiceBase>
  )
}

export default Lexicon
