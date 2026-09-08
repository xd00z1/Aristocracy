import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, Scenario } from '../content/types'
import type { Answer, RemarkExercise } from '../engine/types'
import { REMARK_KIND_LABEL, Remark, isChosenRemark, remarkState } from './Remark'
import type { MediaResolver } from './types'

// Synthetic fixtures only; never real content ids.
const item = {
  id: 'opera.test.tosca',
  discipline: 'opera',
  kind: 'work',
  title: 'Testca',
  city: 'testville',
  difficulty: 2,
  era: 'Testish',
  year: 1900,
  creator: 'Giacomo Tester',
  facts: ['Scarpia is a baritone.'],
  remark: 'The Te Deum ends Act I.',
  gaffe: 'Calling Scarpia a tenor.',
  links: [],
  tags: [],
  sources: ['A programme'],
  reviewed_by: null,
} as unknown as Item

const scenario: Scenario = {
  id: 'scenario.testville.interval',
  city: 'testville',
  discipline: 'opera',
  difficulty: 2,
  setting: 'Interval, the opera house, Testca.',
  prompt: 'Your host says: "The Scarpia was rather underpowered, didn\'t you think?"',
  options: [
    { kind: 'correct', text: 'He was, though the Te Deum still landed.', explanation: 'Specific and generous.' },
    { kind: 'wrong', text: 'I thought the tenor was wonderful as Scarpia.', explanation: 'Scarpia is a baritone role.' },
    { kind: 'gaffe', text: 'Baritones always are.', explanation: 'Sweeping, and wrong.' },
  ],
  links: [item.id],
  sources: [],
  reviewed_by: null,
}

// Shuffled order, as the builder would give it: gaffe, correct, wrong.
const exercise: RemarkExercise = {
  id: 'sess.10',
  type: 'remark',
  itemIds: [item.id],
  isReview: false,
  slot: 10,
  scenario,
  options: [
    { ...scenario.options[2], id: 'a' },
    { ...scenario.options[0], id: 'b' },
    { ...scenario.options[1], id: 'c' },
  ],
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }
const items = { [item.id]: item }

let t = 0
beforeEach(() => {
  t = 0
  vi.spyOn(performance, 'now').mockImplementation(() => t)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderRemark(extra: Partial<Parameters<typeof Remark>[0]> = {}) {
  const onAnswer = vi.fn()
  const utils = render(<Remark exercise={exercise} items={items} answered={null} onAnswer={onAnswer} media={media} soundEnabled {...extra} />)
  return { onAnswer, ...utils }
}

describe('Remark', () => {
  it('renders the setting in small caps, the prompt as a quotation, and three full-width reply buttons in the given order', () => {
    renderRemark()
    expect(screen.getByTestId('exercise-remark')).toBeTruthy()
    const setting = screen.getByTestId('remark-setting')
    expect(setting.textContent).toBe(scenario.setting)
    expect(setting.className).toContain('smallcaps')
    const prompt = screen.getByTestId('remark-prompt')
    expect(prompt.tagName).toBe('BLOCKQUOTE')
    expect(prompt.textContent).toBe(scenario.prompt)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(['option-a', 'option-b', 'option-c'])
    for (const o of exercise.options) {
      const b = screen.getByTestId(`option-${o.id}`) as HTMLButtonElement
      expect(b.tagName).toBe('BUTTON')
      expect(b.getAttribute('type')).toBe('button')
      expect(b.disabled).toBe(false)
      expect(b.className).toContain('w-full')
      expect(b.className).toContain('min-h-11')
      expect(b.getAttribute('data-state')).toBe('idle')
      expect(b.textContent).toContain(o.text)
      expect(screen.queryByTestId(`remark-explanation-${o.id}`)).toBeNull()
    }
  })

  it('answers once with correct: true, remarkKind and chosen on the graceful reply', () => {
    const { onAnswer } = renderRemark()
    t = 1800
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toEqual({
      exerciseId: 'sess.10',
      correct: true,
      itemIds: [item.id],
      msElapsed: 1800,
      remarkKind: 'correct',
      chosen: 'b',
    })
  })

  it('a wrong reply is incorrect with remarkKind wrong', () => {
    const { onAnswer } = renderRemark()
    fireEvent.click(screen.getByTestId('option-c'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, remarkKind: 'wrong', chosen: 'c' })
  })

  it('a gaffe is incorrect with remarkKind gaffe', () => {
    const { onAnswer } = renderRemark()
    fireEvent.click(screen.getByTestId('option-a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, remarkKind: 'gaffe', chosen: 'a' })
  })

  it('fires onAnswer exactly once even when tapped again before the runner re-renders', () => {
    const { onAnswer } = renderRemark()
    fireEvent.click(screen.getByTestId('option-a'))
    fireEvent.click(screen.getByTestId('option-b'))
    fireEvent.click(screen.getByTestId('option-a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ chosen: 'a' })
  })

  it('once answered with a gaffe: buttons lock, the graceful reply is gilt, the gaffe oxblood, the rest dim, and every explanation shows', () => {
    const answered: Answer = { exerciseId: 'sess.10', correct: false, itemIds: [item.id], msElapsed: 10, remarkKind: 'gaffe', chosen: 'a' }
    const { onAnswer } = renderRemark({ answered })
    for (const o of exercise.options) expect((screen.getByTestId(`option-${o.id}`) as HTMLButtonElement).disabled).toBe(true)

    const graceful = screen.getByTestId('option-b')
    expect(graceful.getAttribute('data-state')).toBe('correct')
    expect(graceful.className).toContain('border-gilt')
    expect(graceful.textContent).toContain('graceful')

    const gaffe = screen.getByTestId('option-a')
    expect(gaffe.getAttribute('data-state')).toBe('wrong')
    expect(gaffe.className).toContain('border-oxblood')
    expect(gaffe.textContent).toContain('your reply')

    const wrong = screen.getByTestId('option-c')
    expect(wrong.getAttribute('data-state')).toBe('dim')
    expect(wrong.className).not.toContain('border-oxblood')

    for (const o of exercise.options) {
      const explanation = screen.getByTestId(`remark-explanation-${o.id}`)
      expect(explanation.textContent).toContain(o.explanation)
      expect(explanation.textContent).toContain(REMARK_KIND_LABEL[o.kind])
    }
    expect(screen.getByTestId('remark-explanation-a').textContent).toContain('Your reply')
    expect(screen.getByTestId('remark-explanation-c').textContent).not.toContain('Your reply')

    fireEvent.click(graceful)
    fireEvent.click(gaffe)
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('once answered with the graceful reply: only gilt, nothing in oxblood', () => {
    const answered: Answer = { exerciseId: 'sess.10', correct: true, itemIds: [item.id], msElapsed: 10, remarkKind: 'correct', chosen: 'b' }
    renderRemark({ answered })
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.getByTestId('option-a').getAttribute('data-state')).toBe('dim')
    expect(screen.getByTestId('option-c').getAttribute('data-state')).toBe('dim')
    for (const o of exercise.options) expect(screen.getByTestId(`option-${o.id}`).className).not.toContain('border-oxblood')
    expect(screen.getByTestId('remark-explanation-b').textContent).not.toContain('Your reply')
  })

  it('locks when the answer arrives after a tap on the same instance', () => {
    const { onAnswer, rerender } = renderRemark()
    fireEvent.click(screen.getByTestId('option-c'))
    const answered = onAnswer.mock.calls[0][0] as Answer
    rerender(<Remark exercise={exercise} items={items} answered={answered} onAnswer={onAnswer} media={media} soundEnabled />)
    expect((screen.getByTestId('option-a') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-c').getAttribute('data-state')).toBe('wrong')
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.getAllByTestId(/^remark-explanation-/)).toHaveLength(3)
  })

  it('remarkState and isChosenRemark fall back to remarkKind when chosen is absent', () => {
    const [gaffe, graceful, wrong] = exercise.options
    expect(remarkState(null, graceful)).toBe('idle')
    const byId: Answer = { exerciseId: 'sess.10', correct: false, itemIds: [], msElapsed: 0, chosen: 'c' }
    expect(remarkState(byId, graceful)).toBe('correct')
    expect(remarkState(byId, wrong)).toBe('wrong')
    expect(remarkState(byId, gaffe)).toBe('dim')
    const byKind: Answer = { exerciseId: 'sess.10', correct: false, itemIds: [], msElapsed: 0, remarkKind: 'gaffe' }
    expect(isChosenRemark(byKind, gaffe)).toBe(true)
    expect(isChosenRemark(byKind, wrong)).toBe(false)
    expect(remarkState(byKind, gaffe)).toBe('wrong')
    expect(isChosenRemark(null, gaffe)).toBe(false)
  })
})
