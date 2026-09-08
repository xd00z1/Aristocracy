/**
 * SessionRunner: answer -> feedback -> continue -> summary, with the engine
 * and the exercise registry mocked.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from '../content/types'
import type { Answer, ChoiceExercise, Exercise, Profile, RemarkExercise, SessionPlan, SessionSummary } from '../engine/types'
import type { ExerciseProps } from '../exercises/types'

// ---------------------------------------------------------------------------
// Mocks.
// ---------------------------------------------------------------------------

const progress = vi.hoisted(() => ({
  startSession: vi.fn(),
  sessionAnswers: vi.fn(),
  recordAnswer: vi.fn(),
  completeSession: vi.fn(),
  loadProfile: vi.fn(),
}))

const registry = vi.hoisted(() => ({ EXERCISE_COMPONENTS: {} as Record<string, unknown> }))

const fixtures = vi.hoisted(() => {
  const mk = (id: string, title: string, year: number): Item =>
    ({
      id,
      discipline: 'art',
      kind: 'work',
      title,
      city: 'testville',
      difficulty: 1,
      era: 'Testish',
      year,
      creator: 'A Tester',
      facts: ['A fact.'],
      remark: `Remark on ${title}.`,
      gaffe: `Gaffe on ${title}.`,
      links: [],
      tags: [],
      sources: ['A source'],
      reviewed_by: null,
    }) as unknown as Item
  const items: Record<string, Item> = {}
  for (let i = 1; i <= 12; i++) {
    const id = `art.test.item-${i}`
    items[id] = mk(id, `Test Item ${i}`, 1400 + i)
  }
  return { items }
})
// The runner reaches its siblings (engine/progress, exercises, content)
// through ./session/deps, mocked here as one module.
vi.mock('./session/deps', () => ({
  ...progress,
  get EXERCISE_COMPONENTS() {
    return registry.EXERCISE_COMPONENTS
  },
  getItem: (id: string) => fixtures.items[id],
  hasImage: () => false,
  imageUrl: () => null,
}))

import SessionRunner from './session/SessionRunner'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function Stub({ exercise, answered, onAnswer, soundEnabled }: ExerciseProps) {
  const itemIds = exercise.itemIds
  const reply = (correct: boolean) =>
    onAnswer({ exerciseId: exercise.id, correct, itemIds, msElapsed: 1234, chosen: correct ? 'ok' : 'no', ...(exercise.type === 'remark' ? { remarkKind: correct ? 'correct' : 'gaffe' } : {}) })
  return (
    <div data-testid={`exercise-${exercise.type}`} data-sound={String(soundEnabled)} data-answered={answered ? 'yes' : 'no'}>
      <p>{'question' in exercise ? exercise.question : exercise.type}</p>
      <button type="button" onClick={() => reply(true)} disabled={Boolean(answered)}>
        right
      </button>
      <button type="button" onClick={() => reply(false)} disabled={Boolean(answered)}>
        wrong
      </button>
    </div>
  )
}

function choice(slot: number, extra: Partial<ChoiceExercise> = {}): ChoiceExercise {
  const itemId = `art.test.item-${slot}`
  return {
    id: `s.${slot}`,
    type: 'identify',
    itemIds: [itemId],
    itemId,
    isReview: slot <= 3,
    slot,
    askFor: 'creator',
    question: `Question ${slot}`,
    options: [
      { id: 'ok', label: 'A Tester' },
      { id: 'no', label: 'Someone Else' },
      { id: 'c', label: 'Third' },
      { id: 'd', label: 'Fourth' },
    ],
    correctOptionId: 'ok',
    ...extra,
  }
}

function remark(slot: number): RemarkExercise {
  return {
    id: `s.${slot}`,
    type: 'remark',
    itemIds: ['art.test.item-1'],
    isReview: false,
    slot,
    scenario: {
      id: 'scenario.test.one',
      city: 'testville',
      discipline: 'art',
      difficulty: 1,
      setting: 'A hall.',
      prompt: 'Well?',
      options: [
        { text: 'Yes.', kind: 'correct', explanation: 'Right.' },
        { text: 'No.', kind: 'wrong', explanation: 'Wrong.' },
        { text: 'Pah.', kind: 'gaffe', explanation: 'Gaffe.' },
      ],
      links: ['art.test.item-1'],
      sources: [],
      reviewed_by: null,
    },
    options: [
      { id: 'ok', text: 'Yes.', kind: 'correct', explanation: 'Right.' },
      { id: 'no', text: 'No.', kind: 'wrong', explanation: 'Wrong.' },
      { id: 'g', text: 'Pah.', kind: 'gaffe', explanation: 'Gaffe.' },
    ],
  }
}

function makePlan(count = 12): SessionPlan {
  const exercises: Exercise[] = []
  for (let slot = 1; slot <= count; slot++) {
    if (slot === 10 && count >= 10) exercises.push(remark(slot))
    else exercises.push(choice(slot, slot === count ? { isFinale: true } : {}))
  }
  return {
    id: '2026-09-08-testville.1-1',
    cityId: 'testville',
    lessonId: 'testville.1',
    exercises,
    newItemIds: exercises.slice(3).flatMap((e) => e.itemIds),
    reviewItemIds: exercises.slice(0, 3).flatMap((e) => e.itemIds),
    createdAt: 0,
  }
}

function makeSummary(partial: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: '2026-09-08-testville.1-1',
    cityId: 'testville',
    lessonId: 'testville.1',
    grade: 'upper-second',
    correct: 10,
    total: 12,
    reviewErrors: 0,
    prestigeEarned: 115,
    guineasEarned: 20,
    acquired: ['art.test.item-2'],
    rankBefore: 3,
    rankAfter: 3,
    standing: 4,
    lessonCompleted: true,
    cityCompleted: false,
    completedAt: 0,
    ...partial,
  }
}

const profile: Profile = {
  id: 'me',
  createdAt: 0,
  titleStyle: 'plain',
  displayName: '',
  prestige: 0,
  guineas: 0,
  standing: 0,
  lastSessionDay: null,
  countryWeekendsLeft: 2,
  countryWeekendMonth: null,
  currentCityId: 'testville',
  lessonProgress: {},
  completedCities: [],
  furnishings: [],
  sessionsCompleted: 0,
  soundEnabled: false,
}

const NOW = new Date(2026, 8, 8, 9, 0, 0)
const now = () => NOW

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  registry.EXERCISE_COMPONENTS = { identify: Stub, remark: Stub }
  progress.startSession.mockResolvedValue(makePlan())
  progress.sessionAnswers.mockResolvedValue([])
  progress.recordAnswer.mockResolvedValue(undefined)
  progress.completeSession.mockResolvedValue(makeSummary())
})

async function firstSlot() {
  await screen.findByTestId('exercise-identify')
}

// ---------------------------------------------------------------------------

describe('SessionRunner', () => {
  it('starts a session on mount and shows the first slot', async () => {
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    expect(screen.getByRole('status')).toBeTruthy()
    await firstSlot()
    expect(progress.startSession).toHaveBeenCalledTimes(1)
    expect(progress.startSession).toHaveBeenCalledWith(NOW)
    expect(screen.getByTestId('slot-label').textContent).toBe('1 of 12')
    expect(screen.getByText('Question 1')).toBeTruthy()
    expect(screen.getByTestId('exercise-identify').getAttribute('data-sound')).toBe('false')
    expect(screen.queryByTestId('feedback')).toBeNull()
    expect(screen.queryByTestId('continue')).toBeNull()
  })

  it('resumes an interrupted session at the first slot still unanswered', async () => {
    const plan = makePlan()
    progress.startSession.mockResolvedValue(plan)
    progress.sessionAnswers.mockResolvedValue(
      plan.exercises.slice(0, 5).map((e) => ({ exerciseId: e.id, correct: true, itemIds: e.itemIds, msElapsed: 900 })),
    )
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()
    expect(screen.getByTestId('slot-label').textContent).toBe('6 of 12')
    expect(screen.getByText('Question 6')).toBeTruthy()

    // The answers already given still count towards the grade.
    for (let slot = 6; slot <= 12; slot++) {
      fireEvent.click(screen.getByText('right'))
      await screen.findByTestId('feedback')
      fireEvent.click(screen.getByTestId('continue'))
    }
    await waitFor(() => expect(progress.completeSession).toHaveBeenCalledTimes(1))
    expect((progress.completeSession.mock.calls[0][1] as Answer[]).length).toBe(12)
  })

  it('completes at once when every slot was answered before the interruption', async () => {
    const plan = makePlan()
    progress.startSession.mockResolvedValue(plan)
    progress.sessionAnswers.mockResolvedValue(
      plan.exercises.map((e) => ({ exerciseId: e.id, correct: true, itemIds: e.itemIds, msElapsed: 900 })),
    )
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await screen.findByTestId('session-summary')
    expect(progress.completeSession).toHaveBeenCalledTimes(1)
  })

  it('starts from the first slot when the earlier answers cannot be read', async () => {
    progress.sessionAnswers.mockRejectedValue(new Error('records are shut'))
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()
    expect(screen.getByTestId('slot-label').textContent).toBe('1 of 12')
  })

  it('passes the sound setting through to the exercise', async () => {
    render(<SessionRunner profile={{ ...profile, soundEnabled: true }} now={now} onReturn={() => {}} />)
    await firstSlot()
    expect(screen.getByTestId('exercise-identify').getAttribute('data-sound')).toBe('true')
  })

  it('records the answer, shows feedback, and continues to the next slot', async () => {
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()

    fireEvent.click(screen.getByText('wrong'))
    const feedback = await screen.findByTestId('feedback')
    expect(feedback.getAttribute('data-correct')).toBe('false')
    expect(screen.getByTestId('feedback-verdict').textContent).toBe('Not quite.')
    expect(feedback.textContent).toContain('The answer is A Tester')
    expect(feedback.textContent).toContain('Remark on Test Item 1.')
    expect(feedback.textContent).toContain('Gaffe on Test Item 1.')
    expect(screen.getByTestId('exercise-identify').getAttribute('data-answered')).toBe('yes')

    await waitFor(() => expect(progress.recordAnswer).toHaveBeenCalledTimes(1))
    const [plan, answer, at] = progress.recordAnswer.mock.calls[0] as [SessionPlan, Answer, Date]
    expect(plan.id).toBe('2026-09-08-testville.1-1')
    expect(answer).toMatchObject({ exerciseId: 's.1', correct: false, itemIds: ['art.test.item-1'] })
    expect(at).toBe(NOW)

    // A second answer on the same slot is ignored.
    fireEvent.click(screen.getByText('right'))
    expect(progress.recordAnswer).toHaveBeenCalledTimes(1)

    const cont = screen.getByTestId('continue')
    expect(cont.textContent).toBe('Continue')
    fireEvent.click(cont)
    expect(screen.getByTestId('slot-label').textContent).toBe('2 of 12')
    expect(screen.getByText('Question 2')).toBeTruthy()
    expect(screen.queryByTestId('feedback')).toBeNull()
    expect(screen.getByTestId('exercise-identify').getAttribute('data-answered')).toBe('no')
  })

  it('completes after the last slot and shows the summary', async () => {
    const onReturn = vi.fn()
    render(<SessionRunner profile={profile} now={now} onReturn={onReturn} />)
    await firstSlot()

    for (let slot = 1; slot <= 12; slot++) {
      expect(screen.getByTestId('slot-label').textContent).toBe(`${slot} of 12`)
      if (slot === 10) expect(screen.getByTestId('exercise-remark')).toBeTruthy()
      fireEvent.click(screen.getByText(slot % 4 === 0 ? 'wrong' : 'right'))
      await screen.findByTestId('feedback')
      const cont = screen.getByTestId('continue')
      expect(cont.textContent).toBe(slot === 12 ? 'Finish' : 'Continue')
      fireEvent.click(cont)
    }

    const summary = await screen.findByTestId('session-summary')
    expect(progress.completeSession).toHaveBeenCalledTimes(1)
    const [plan, answers, at] = progress.completeSession.mock.calls[0] as [SessionPlan, Answer[], Date]
    expect(plan.exercises.length).toBe(12)
    expect(answers.length).toBe(12)
    expect(answers.filter((a) => !a.correct).length).toBe(3)
    expect(answers.map((a) => a.exerciseId)).toEqual(plan.exercises.map((e) => e.id))
    expect(at).toBe(NOW)
    expect(progress.recordAnswer).toHaveBeenCalledTimes(12)

    expect(screen.getByTestId('summary-grade').textContent).toBe('Upper Second')
    expect(summary.textContent).toContain('10 of 12')
    expect(summary.textContent).toContain('+115')
    expect(summary.textContent).toContain('+20')
    expect(summary.textContent).toContain('Test Item 2')
    expect(screen.getByTestId('summary-standing').textContent).toContain('4')

    fireEvent.click(screen.getByTestId('return'))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('hands a rank-up to onRankUp instead of showing the summary', async () => {
    progress.startSession.mockResolvedValue(makePlan(2))
    progress.completeSession.mockResolvedValue(makeSummary({ rankBefore: 1, rankAfter: 2, total: 2, correct: 2, grade: 'first' }))
    const onRankUp = vi.fn()
    render(<SessionRunner profile={profile} now={now} onRankUp={onRankUp} onReturn={() => {}} />)
    await firstSlot()
    for (let slot = 1; slot <= 2; slot++) {
      fireEvent.click(screen.getByText('right'))
      await screen.findByTestId('feedback')
      fireEvent.click(screen.getByTestId('continue'))
    }
    await waitFor(() => expect(onRankUp).toHaveBeenCalledTimes(1))
    expect((onRankUp.mock.calls[0][0] as SessionSummary).rankAfter).toBe(2)
    expect(screen.queryByTestId('session-summary')).toBeNull()
  })

  it('shows a dry error with retry when the session cannot start', async () => {
    progress.startSession.mockRejectedValueOnce(new Error('IndexedDB is asleep'))
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toContain('The lesson could not be prepared.')
    expect(notice.textContent).toContain('IndexedDB is asleep')
    fireEvent.click(screen.getByText('Try again'))
    await firstSlot()
    expect(progress.startSession).toHaveBeenCalledTimes(2)
  })

  it('shows a retryable error when marking fails, then completes', async () => {
    progress.startSession.mockResolvedValue(makePlan(1))
    progress.completeSession.mockRejectedValueOnce(new Error('no ink'))
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()
    fireEvent.click(screen.getByText('right'))
    await screen.findByTestId('feedback')
    fireEvent.click(screen.getByTestId('continue'))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toContain('The session could not be marked.')
    fireEvent.click(screen.getByText('Try again'))
    await screen.findByTestId('session-summary')
    expect(progress.completeSession).toHaveBeenCalledTimes(2)
  })

  it('keeps going when an answer cannot be saved', async () => {
    progress.startSession.mockResolvedValue(makePlan(1))
    progress.recordAnswer.mockRejectedValueOnce(new Error('disk full'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()
    fireEvent.click(screen.getByText('right'))
    await screen.findByTestId('feedback')
    await screen.findByTestId('save-warning')
    fireEvent.click(screen.getByTestId('continue'))
    await screen.findByTestId('session-summary')
    warn.mockRestore()
  })

  it('lets a slot with no registered component be passed over', async () => {
    registry.EXERCISE_COMPONENTS = { identify: Stub }
    progress.startSession.mockResolvedValue(makePlan(10)) // slot 10 is a Remark with no component
    render(<SessionRunner profile={profile} now={now} onReturn={() => {}} />)
    await firstSlot()
    for (let slot = 1; slot <= 9; slot++) {
      fireEvent.click(screen.getByText('right'))
      await screen.findByTestId('feedback')
      fireEvent.click(screen.getByTestId('continue'))
    }
    expect(screen.getByTestId('exercise-unavailable')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByTestId('continue'))
    })
    await screen.findByTestId('session-summary')
    const [, answers] = progress.completeSession.mock.calls[0] as [SessionPlan, Answer[]]
    expect(answers.length).toBe(9)
  })

  it('offers a way out mid-session', async () => {
    const onReturn = vi.fn()
    render(<SessionRunner profile={profile} now={now} onReturn={onReturn} />)
    await firstSlot()
    fireEvent.click(screen.getByTestId('session-leave'))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})
