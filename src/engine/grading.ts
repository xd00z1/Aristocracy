/**
 * Grades and points for a completed session, exactly as CLAUDE.md sets them
 * out under "Grading, meters, streaks, ranks":
 *
 *   errors        wrong answers; reviewErrors = wrong answers on isReview
 *   grade         First if reviewErrors = 0 and errors <= 1; Upper Second if
 *                 errors <= 2; Lower Second if <= 4; Third if <= 6; else Pass
 *   prestige      +10 per correct; a correct finale +15 instead; zoom-out adds
 *                 round(earlyFraction x 10); a correct Remark adds +5; grade
 *                 bonus First +25, Upper Second +15, Lower Second +5
 *   guineas       5 per completed session, +1 per correct, +10 for a First,
 *                 +5 for an Upper Second
 *
 * Answers are matched to the plan's exercises by `exerciseId`; an exercise
 * with no answer (the runner lets a slot whose component is missing be passed
 * over) counts as neither correct nor wrong. It still counts in `total`.
 */
import type { Answer, Exercise, Grade, SessionPlan } from './types'

export const PRESTIGE = Object.freeze({
  correct: 10,
  finale: 15,
  remarkBonus: 5,
  zoomOutMax: 10,
  gradeBonus: { first: 25, 'upper-second': 15, 'lower-second': 5, third: 0, pass: 0 } as Record<Grade, number>,
})

export const GUINEAS = Object.freeze({
  session: 5,
  perCorrect: 1,
  gradeBonus: { first: 10, 'upper-second': 5, 'lower-second': 0, third: 0, pass: 0 } as Record<Grade, number>,
})

/** One answer per exercise: the last answer recorded for an exercise id wins. */
function answersByExercise(plan: SessionPlan, answers: Answer[]): Array<[Exercise, Answer | undefined]> {
  const byId = new Map<string, Answer>()
  for (const a of answers) byId.set(a.exerciseId, a)
  return plan.exercises.map((e) => [e, byId.get(e.id)])
}

export function gradeFor(errors: number, reviewErrors: number): Grade {
  if (reviewErrors === 0 && errors <= 1) return 'first'
  if (errors <= 2) return 'upper-second'
  if (errors <= 4) return 'lower-second'
  if (errors <= 6) return 'third'
  return 'pass'
}

export function gradeSession(
  plan: SessionPlan,
  answers: Answer[],
): { grade: Grade; correct: number; total: number; reviewErrors: number } {
  let correct = 0
  let errors = 0
  let reviewErrors = 0
  for (const [exercise, answer] of answersByExercise(plan, answers)) {
    if (!answer) continue
    if (answer.correct) {
      correct++
    } else {
      errors++
      if (exercise.isReview) reviewErrors++
    }
  }
  return { grade: gradeFor(errors, reviewErrors), correct, total: plan.exercises.length, reviewErrors }
}

function clamp01(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** Prestige for one answered exercise, before the grade bonus. */
export function prestigeForAnswer(exercise: Exercise, answer: Answer | undefined): number {
  if (!answer || !answer.correct) return 0
  let points = exercise.isFinale ? PRESTIGE.finale : PRESTIGE.correct
  if (exercise.type === 'zoom-out') points += Math.round(clamp01(answer.earlyFraction) * PRESTIGE.zoomOutMax)
  if (exercise.type === 'remark') points += PRESTIGE.remarkBonus
  return points
}

export function prestigeFor(plan: SessionPlan, answers: Answer[], grade: Grade): number {
  let total = PRESTIGE.gradeBonus[grade]
  for (const [exercise, answer] of answersByExercise(plan, answers)) total += prestigeForAnswer(exercise, answer)
  return total
}

export function guineasFor(plan: SessionPlan, answers: Answer[], grade: Grade): number {
  let total = GUINEAS.session + GUINEAS.gradeBonus[grade]
  for (const [, answer] of answersByExercise(plan, answers)) if (answer?.correct) total += GUINEAS.perCorrect
  return total
}
