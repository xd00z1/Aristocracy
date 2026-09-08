import { describe, expect, it } from 'vitest'
import type { ExerciseType } from '../engine/types'
import * as mod from './index'

const TYPES: ExerciseType[] = ['drop-the-needle', 'zoom-out', 'remark', 'timeline', 'match', 'lexicon', 'whos-who', 'apocrypha', 'identify']

describe('EXERCISE_COMPONENTS', () => {
  it('maps every ExerciseType to a component', () => {
    expect(Object.keys(mod.EXERCISE_COMPONENTS).sort()).toEqual([...TYPES].sort())
    for (const type of TYPES) {
      const component = mod.EXERCISE_COMPONENTS[type]
      expect(component, `component for ${type}`).toBeTruthy()
      expect(typeof component === 'function' || typeof component === 'object').toBe(true)
    }
  })

  it('registers each component under its own type', () => {
    expect(mod.EXERCISE_COMPONENTS['drop-the-needle']).toBe(mod.DropTheNeedle)
    expect(mod.EXERCISE_COMPONENTS['zoom-out']).toBe(mod.ZoomOut)
    expect(mod.EXERCISE_COMPONENTS.remark).toBe(mod.Remark)
    expect(mod.EXERCISE_COMPONENTS.timeline).toBe(mod.Timeline)
    expect(mod.EXERCISE_COMPONENTS.match).toBe(mod.Match)
    expect(mod.EXERCISE_COMPONENTS.lexicon).toBe(mod.Lexicon)
    expect(mod.EXERCISE_COMPONENTS['whos-who']).toBe(mod.WhosWho)
    expect(mod.EXERCISE_COMPONENTS.apocrypha).toBe(mod.Apocrypha)
    expect(mod.EXERCISE_COMPONENTS.identify).toBe(mod.Identify)
  })
})
