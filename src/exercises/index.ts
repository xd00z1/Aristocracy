/**
 * The exercise registry: one component per ExerciseType. The session runner
 * looks up `EXERCISE_COMPONENTS[exercise.type]` and renders it with the
 * ExerciseProps contract from ./types.
 */
import type { ExerciseType } from '../engine/types'
import Apocrypha from './Apocrypha'
import DropTheNeedle from './DropTheNeedle'
import Identify from './Identify'
import Lexicon from './Lexicon'
import Match from './Match'
import Remark from './Remark'
import Timeline from './Timeline'
import WhosWho from './WhosWho'
import ZoomOut from './ZoomOut'
import type { ExerciseComponent } from './types'

export const EXERCISE_COMPONENTS: Record<ExerciseType, ExerciseComponent<any>> = {
  'drop-the-needle': DropTheNeedle,
  'zoom-out': ZoomOut,
  remark: Remark,
  timeline: Timeline,
  match: Match,
  lexicon: Lexicon,
  'whos-who': WhosWho,
  apocrypha: Apocrypha,
  identify: Identify,
}

export { ChoiceBase, optionState, nowMs, type ChoiceBaseProps, type OptionState } from './ChoiceBase'
export { Apocrypha, DropTheNeedle, Identify, Lexicon, Match, Remark, Timeline, WhosWho, ZoomOut }
export type { ExerciseComponent, ExerciseProps, MediaResolver } from './types'
