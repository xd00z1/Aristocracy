/**
 * Identify: the text-only choice question, used whenever an item has no
 * media to show. The question already carries any clue the builder wrote.
 */
import type { ChoiceExercise } from '../engine/types'
import { ChoiceBase } from './ChoiceBase'
import type { ExerciseProps } from './types'

export function Identify(props: ExerciseProps<ChoiceExercise>) {
  return <ChoiceBase {...props} />
}

export default Identify
