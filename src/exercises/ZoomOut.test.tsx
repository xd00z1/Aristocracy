import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ChoiceExercise } from '../engine/types'
import { DEFAULT_FOCUS, REVEAL_MS, START_SCALE, ZoomOut, earlyFractionAt, ease, scaleAt } from './ZoomOut'
import type { MediaResolver } from './types'

const painting = {
  id: 'art.test.painting',
  discipline: 'art',
  kind: 'work',
  title: 'The Test Painting',
  city: 'testville',
  difficulty: 2,
  era: 'Testish',
  year: 1642,
  creator: 'Rembrandt Tester',
  facts: ['It is large.'],
  remark: 'It is not a night scene.',
  gaffe: 'Calling it small.',
  links: [],
  tags: [],
  sources: ['A catalogue'],
  reviewed_by: null,
  media: { image: { commons: 'File:Test.jpg', source: 'A museum', license: 'Public domain', focus: { x: 0.25, y: 0.8 } } },
} as unknown as Item

const unfocused = { ...painting, id: 'art.test.unfocused', media: { image: { source: 'A museum', license: 'Public domain' } } } as unknown as Item

function exerciseFor(item: Item): ChoiceExercise {
  return {
    id: 'sess.6',
    type: 'zoom-out',
    itemIds: [item.id],
    itemId: item.id,
    isReview: false,
    slot: 6,
    askFor: 'creator',
    question: 'Who painted this?',
    options: [
      { id: 'a', label: 'Frans Tester' },
      { id: 'b', label: 'Rembrandt Tester' },
      { id: 'c', label: 'Jan Tester' },
      { id: 'd', label: 'Pieter Tester' },
    ],
    correctOptionId: 'b',
  }
}

const withImage: MediaResolver = { imageUrl: (id) => `/media/img/${id}.jpg`, hasImage: () => true }
const noImage: MediaResolver = { imageUrl: () => null, hasImage: () => false }

// Deterministic time and frames: the component reads performance.now and
// schedules requestAnimationFrame; both are controlled here.
let t = 0
let frames: Array<() => void> = []
const cancel = vi.fn()

function flush() {
  const pending = frames.splice(0)
  act(() => {
    for (const f of pending) f()
  })
}

beforeEach(() => {
  t = 0
  frames = []
  cancel.mockClear()
  vi.spyOn(performance, 'now').mockImplementation(() => t)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(() => cb(t))
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', cancel)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function scaleOf(): number {
  return Number(screen.getByTestId('zoom-image').getAttribute('data-scale'))
}

describe('ZoomOut helpers', () => {
  it('eases from 4x to 1x over six seconds and reports the remaining fraction', () => {
    expect(ease(0)).toBe(0)
    expect(ease(0.5)).toBe(0.5)
    expect(ease(1)).toBe(1)
    expect(scaleAt(0)).toBe(START_SCALE)
    expect(scaleAt(REVEAL_MS / 2)).toBeCloseTo(2.5)
    expect(scaleAt(REVEAL_MS)).toBe(1)
    expect(scaleAt(REVEAL_MS * 2)).toBe(1)
    expect(earlyFractionAt(0)).toBe(1)
    expect(earlyFractionAt(1500)).toBe(0.75)
    expect(earlyFractionAt(REVEAL_MS)).toBe(0)
    expect(earlyFractionAt(REVEAL_MS + 1)).toBe(0)
    expect(DEFAULT_FOCUS).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('ZoomOut', () => {
  it('without an image renders the plain choice with a notice, a clue, and earlyFraction 0', () => {
    const onAnswer = vi.fn()
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={null} onAnswer={onAnswer} media={noImage} soundEnabled />)
    expect(screen.getByTestId('exercise-zoom-out')).toBeTruthy()
    expect(screen.queryByTestId('zoom-image')).toBeNull()
    expect(screen.getByTestId('choice-notice').textContent).toBe('Image not fetched yet.')
    expect(screen.getByTestId('zoom-clue').textContent).toContain('The Test Painting')
    expect(screen.getByText('Who painted this?')).toBeTruthy()
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, chosen: 'b', earlyFraction: 0 })
  })

  it('starts at 4x centred on the focus and eases down frame by frame', () => {
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={null} onAnswer={vi.fn()} media={withImage} soundEnabled />)
    const img = screen.getByTestId('zoom-image') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(`/media/img/${painting.id}.jpg`)
    expect(img.getAttribute('alt')).not.toContain('Test Painting')
    expect(img.style.transformOrigin).toBe('25% 80%')
    expect(scaleOf()).toBe(4)
    expect(screen.getByTestId('zoom-remaining').getAttribute('aria-valuenow')).toBe('100')
    expect(frames).toHaveLength(1)

    t = 3000
    flush()
    expect(scaleOf()).toBeCloseTo(2.5, 3)
    expect(screen.getByTestId('zoom-remaining').getAttribute('aria-valuenow')).toBe('50')
    expect(frames).toHaveLength(1) // another frame queued

    t = 6000
    flush()
    expect(scaleOf()).toBe(1)
    expect(screen.getByTestId('zoom-remaining').getAttribute('aria-valuenow')).toBe('0')
    expect(frames).toHaveLength(0) // reveal finished: no more frames
  })

  it('defaults the focus to the centre when the item has none', () => {
    render(<ZoomOut exercise={exerciseFor(unfocused)} items={{ [unfocused.id]: unfocused }} answered={null} onAnswer={vi.fn()} media={withImage} soundEnabled />)
    expect((screen.getByTestId('zoom-image') as HTMLImageElement).style.transformOrigin).toBe('50% 50%')
  })

  it('a picture that fails to load ends the reveal and pays no early bonus', () => {
    const onAnswer = vi.fn()
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={null} onAnswer={onAnswer} media={withImage} soundEnabled />)
    fireEvent.error(screen.getByTestId('zoom-image'))
    expect(screen.getByTestId('choice-notice').textContent).toContain('could not be loaded')
    expect(scaleOf()).toBe(1)
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, earlyFraction: 0 })
  })

  it('with reduced motion asked for, the picture is whole from the first frame and pays no early bonus', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query }))
    const onAnswer = vi.fn()
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={null} onAnswer={onAnswer} media={withImage} soundEnabled />)
    expect(scaleOf()).toBe(1)
    expect(screen.getByTestId('zoom-remaining').getAttribute('aria-valuenow')).toBe('0')
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, earlyFraction: 0 })
  })

  it('reports earlyFraction at the moment of answering and completes the reveal', () => {
    const onAnswer = vi.fn()
    const props = { exercise: exerciseFor(painting), items: { [painting.id]: painting }, media: withImage, soundEnabled: true }
    const { rerender } = render(<ZoomOut {...props} answered={null} onAnswer={onAnswer} />)
    t = 1000
    flush()
    expect(scaleOf()).toBeGreaterThan(3)

    t = 1500
    fireEvent.click(screen.getByTestId('option-c'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    const answer = onAnswer.mock.calls[0][0] as Answer
    expect(answer).toMatchObject({ exerciseId: 'sess.6', correct: false, chosen: 'c', itemIds: [painting.id], msElapsed: 1500, earlyFraction: 0.75 })
    // The reveal completes on answer and the pending frame is cancelled.
    expect(scaleOf()).toBe(1)
    expect(screen.getByTestId('zoom-remaining').getAttribute('aria-valuenow')).toBe('0')
    expect(cancel).toHaveBeenCalled()

    rerender(<ZoomOut {...props} answered={answer} onAnswer={onAnswer} />)
    expect((screen.getByTestId('option-a') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('option-b').getAttribute('data-state')).toBe('correct')
    expect(screen.getByTestId('option-c').getAttribute('data-state')).toBe('wrong')
    // Late frames do nothing.
    t = 4000
    flush()
    expect(scaleOf()).toBe(1)
    expect(frames).toHaveLength(0)
  })

  it('answering after the reveal has finished reports earlyFraction 0', () => {
    const onAnswer = vi.fn()
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={null} onAnswer={onAnswer} media={withImage} soundEnabled />)
    t = 7000
    flush()
    fireEvent.click(screen.getByTestId('option-b'))
    expect(onAnswer.mock.calls[0][0]).toMatchObject({ correct: true, earlyFraction: 0 })
  })

  it('mounted already answered, the picture is fully revealed at once', () => {
    const answered: Answer = { exerciseId: 'sess.6', correct: true, itemIds: [painting.id], msElapsed: 10, chosen: 'b', earlyFraction: 0.5 }
    render(<ZoomOut exercise={exerciseFor(painting)} items={{ [painting.id]: painting }} answered={answered} onAnswer={vi.fn()} media={withImage} soundEnabled />)
    expect(scaleOf()).toBe(1)
    expect(frames).toHaveLength(0)
    expect((screen.getByTestId('option-b') as HTMLButtonElement).disabled).toBe(true)
  })
})
