import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { ChoiceExercise } from '../engine/types'
import type { MediaResolver } from './types'

// The audio hook is mocked: these tests never touch Web Audio.
const hook = vi.hoisted(() => ({
  play: vi.fn(),
  stop: vi.fn(),
  playing: false,
  progress: 0,
  durationSeconds: 3,
  calls: [] as Array<{ theme: unknown; enabled: boolean }>,
}))
vi.mock('../audio/useThemePlayer', () => ({
  useThemePlayer: (theme: unknown, enabled: boolean) => {
    hook.calls.push({ theme, enabled })
    return { play: hook.play, stop: hook.stop, playing: hook.playing, progress: hook.progress, durationSeconds: hook.durationSeconds }
  },
}))
vi.mock('../engine/distractors', () => ({
  redactNames: (text: string, names: string[]) => names.reduce((acc, n) => acc.split(n).join('———'), text),
}))

import { DropTheNeedle, needleClue } from './DropTheNeedle'

const theme = { notes: 'G4/8 G4/8 G4/8 Eb4/2', tempo: 120 }
const work = {
  id: 'music.test.symphony',
  discipline: 'music',
  kind: 'work',
  title: 'Test Symphony',
  city: 'testville',
  difficulty: 1,
  era: 'Testish',
  year: 1808,
  creator: 'Ludwig Tester',
  facts: ['The Test Symphony was premiered in a cold hall.'],
  remark: 'Mention the cold.',
  gaffe: 'Calling it a concerto.',
  links: [],
  tags: [],
  sources: ['A biography'],
  reviewed_by: null,
  theme,
} as unknown as Item

const silent = { ...work, id: 'music.test.silent', theme: undefined } as unknown as Item

function exerciseFor(item: Item, askFor: 'creator' | 'title' = 'creator'): ChoiceExercise {
  return {
    id: 'sess.4',
    type: 'drop-the-needle',
    itemIds: [item.id],
    itemId: item.id,
    isReview: false,
    slot: 4,
    askFor,
    question: askFor === 'creator' ? 'Who composed this?' : 'Which work is this?',
    options: [
      { id: 'a', label: askFor === 'creator' ? 'Joseph Tester' : 'Test Overture' },
      { id: 'b', label: askFor === 'creator' ? 'Ludwig Tester' : 'Test Symphony' },
      { id: 'c', label: askFor === 'creator' ? 'Franz Tester' : 'Test Sonata' },
      { id: 'd', label: askFor === 'creator' ? 'Wolfgang Tester' : 'Test Quartet' },
    ],
    correctOptionId: 'b',
  }
}

const media: MediaResolver = { imageUrl: () => null, hasImage: () => false }

beforeEach(() => {
  hook.play.mockClear()
  hook.stop.mockClear()
  hook.playing = false
  hook.progress = 0
  hook.calls.length = 0
})
afterEach(cleanup)

describe('DropTheNeedle', () => {
  it('renders the play button, auto-plays once on mount and passes the theme to the hook', () => {
    const onAnswer = vi.fn()
    render(<DropTheNeedle exercise={exerciseFor(work)} items={{ [work.id]: work }} answered={null} onAnswer={onAnswer} media={media} soundEnabled />)
    expect(screen.getByTestId('exercise-drop-the-needle')).toBeTruthy()
    const play = screen.getByTestId('play-theme') as HTMLButtonElement
    expect(play.tagName).toBe('BUTTON')
    expect(play.disabled).toBe(false)
    expect(play.textContent).toBe('Drop the needle')
    expect(hook.play).toHaveBeenCalledTimes(1)
    expect(hook.calls[0]).toEqual({ theme, enabled: true })
    expect(screen.getByText('Who composed this?')).toBeTruthy()
    expect(screen.queryByTestId('choice-notice')).toBeNull()
    expect(screen.queryByTestId('theme-clue')).toBeNull()
    expect(screen.queryByTestId('theme-progress')).toBeNull()
  })

  it('tapping the button plays; a progress line and a replay label appear once it has played', () => {
    const props = { exercise: exerciseFor(work), items: { [work.id]: work }, answered: null, onAnswer: vi.fn(), media, soundEnabled: true }
    const { rerender } = render(<DropTheNeedle {...props} />)
    fireEvent.click(screen.getByTestId('play-theme'))
    expect(hook.play).toHaveBeenCalledTimes(2) // mount + tap

    hook.playing = true
    hook.progress = 0.4
    rerender(<DropTheNeedle {...props} />)
    const line = screen.getByTestId('theme-progress')
    expect(line.getAttribute('aria-valuenow')).toBe('40')
    expect((line.firstElementChild as HTMLElement).style.width).toBe('40%')
    expect(screen.getByTestId('play-theme').textContent).toBe('Playing')

    hook.playing = false
    hook.progress = 1
    rerender(<DropTheNeedle {...props} />)
    expect(screen.getByTestId('play-theme').textContent).toBe('Play again')
    expect(screen.getByTestId('theme-progress').getAttribute('aria-valuenow')).toBe('100')
    fireEvent.click(screen.getByTestId('play-theme'))
    expect(hook.play).toHaveBeenCalledTimes(3)
  })

  it('with sound off: no auto-play, a notice, a clue, and the question can still be answered', () => {
    const onAnswer = vi.fn()
    render(<DropTheNeedle exercise={exerciseFor(work)} items={{ [work.id]: work }} answered={null} onAnswer={onAnswer} media={media} soundEnabled={false} />)
    expect(hook.play).not.toHaveBeenCalled()
    expect(hook.calls[0]).toEqual({ theme, enabled: false })
    expect((screen.getByTestId('play-theme') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('choice-notice').textContent).toContain('Sound is off')
    const clue = screen.getByTestId('theme-clue')
    expect(clue.textContent).toContain('Test Symphony')
    expect(clue.textContent).toContain('1808')
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, chosen: 'b', itemIds: [work.id] })
  })

  it('with no theme: no auto-play, a notice, and answering still works', () => {
    const onAnswer = vi.fn()
    render(<DropTheNeedle exercise={exerciseFor(silent)} items={{ [silent.id]: silent }} answered={null} onAnswer={onAnswer} media={media} soundEnabled />)
    expect(hook.play).not.toHaveBeenCalled()
    expect((screen.getByTestId('play-theme') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('choice-notice').textContent).toContain('No theme')
    fireEvent.click(screen.getByTestId('option-a'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: false, chosen: 'a' })
  })

  it('asked for the title with sound off, the clue names the composer and redacts the title from the fact', () => {
    render(<DropTheNeedle exercise={exerciseFor(work, 'title')} items={{ [work.id]: work }} answered={null} onAnswer={vi.fn()} media={media} soundEnabled={false} />)
    const clue = screen.getByTestId('theme-clue')
    expect(clue.textContent).toContain('By Ludwig Tester')
    expect(clue.textContent).toContain('——— was premiered in a cold hall.')
    expect(clue.textContent).not.toContain('Test Symphony was premiered')
  })

  it('locks the options and marks them once answered', () => {
    const answered = { exerciseId: 'sess.4', correct: false, itemIds: [work.id], msElapsed: 5, chosen: 'd' }
    render(<DropTheNeedle exercise={exerciseFor(work)} items={{ [work.id]: work }} answered={answered} onAnswer={vi.fn()} media={media} soundEnabled />)
    // Already answered on mount: nothing to auto-play.
    expect(hook.play).not.toHaveBeenCalled()
    expect((screen.getByTestId('option-a') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.getByTestId('option-d').getAttribute('data-state')).toBe('wrong')
  })

  it('needleClue handles a missing item and the remaining askFor kinds', () => {
    expect(needleClue(undefined, 'creator')).toBeNull()
    expect(needleClue(work, 'era')).toEqual({ line: '“Test Symphony”', detail: 'Ludwig Tester, 1808' })
    expect(needleClue(work, 'creator')).toEqual({ line: '“Test Symphony”', detail: '1808' })
  })
})
