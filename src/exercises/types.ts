/**
 * Contract between the session runner (src/app) and exercise components
 * (src/exercises). One component per ExerciseType, registered in
 * src/exercises/index.ts.
 *
 * Flow: the runner renders the component with `answered = null`; the component
 * collects one answer and calls `onAnswer` exactly once; the runner then
 * re-renders it with `answered` set so it can lock and reveal the correct
 * answer, and renders the shared Feedback panel (remark, gaffe, links) plus a
 * Continue button below it. Components never render their own Continue button.
 */
import type { ComponentType } from 'react'
import type { Item } from '../content/types'
import type { Answer, Exercise } from '../engine/types'

export interface MediaResolver {
  /** URL for the item's image, or null when it is not available. */
  imageUrl(itemId: string): string | null
  hasImage(itemId: string): boolean
}

export interface ExerciseProps<E extends Exercise = Exercise> {
  exercise: E
  /** Every item the exercise references, by id. */
  items: Record<string, Item>
  /** Null until the user answers; then the answer, so the component can reveal. */
  answered: Answer | null
  onAnswer: (answer: Answer) => void
  media: MediaResolver
  /** Sound on/off; Drop the Needle shows a notice and auto-plays nothing when false. */
  soundEnabled: boolean
}

export type ExerciseComponent<E extends Exercise = Exercise> = ComponentType<ExerciseProps<E>>
