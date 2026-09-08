/**
 * Runs one twelve-slot session. On mount it asks the engine for a plan, then
 * renders each exercise in turn through the EXERCISE_COMPONENTS registry.
 * An answer is recorded at once; the shared Feedback panel and a Continue
 * button follow; after the last slot the session is completed and the Summary
 * shown (or, on a rank-up, `onRankUp` is called first).
 *
 * Sessions are always completable: a failed save is noted, not fatal; an
 * exercise whose component is missing can be passed over.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from '../../content/types'
import type { Answer, Exercise, Profile, SessionPlan, SessionSummary } from '../../engine/types'
import type { ExerciseComponent, MediaResolver } from '../../exercises/types'
import { completeSession, EXERCISE_COMPONENTS, getItem, hasImage, imageUrl, recordAnswer, startSession } from './deps'
import { Button, ErrorNotice, Feedback, Spinner } from '../../ui'
import Summary from './Summary'

export const MEDIA: MediaResolver = { imageUrl, hasImage }

export interface SessionRunnerProps {
  profile: Profile
  /** Injectable clock; defaults to the real one. */
  now?: () => Date
  /** Called instead of showing the Summary when the session raised the rank. */
  onRankUp?: (summary: SessionSummary) => void
  /** Leave the session (from the Summary's Return, or the Leave button). */
  onReturn: () => void
}

type Phase = 'starting' | 'running' | 'completing' | 'summary'

function slotTag(exercise: Exercise): string | null {
  if (exercise.isFinale) return 'Finale'
  if (exercise.type === 'remark') return 'The Remark'
  if (exercise.type === 'timeline') return 'Timeline'
  if (exercise.type === 'match') return 'Match'
  if (exercise.isReview) return 'Correspondence'
  return null
}

export function itemsFor(exercise: Exercise, lookup: (id: string) => Item | undefined = getItem): Record<string, Item> {
  const out: Record<string, Item> = {}
  for (const id of exercise.itemIds) {
    const item = lookup(id)
    if (item) out[id] = item
  }
  if ('itemId' in exercise && !(exercise.itemId in out)) {
    const item = lookup(exercise.itemId)
    if (item) out[exercise.itemId] = item
  }
  return out
}

export function SlotProgress({ index, total, tag }: { index: number; total: number; tag: string | null }) {
  const pct = total > 0 ? Math.round(((index + 1) / total) * 100) : 0
  return (
    <div className="min-w-0 flex-1 pb-4 pt-2" data-testid="slot-progress">
      <div className="flex items-baseline justify-between gap-3">
        <p className="smallcaps text-xs text-ink-mute" data-testid="slot-label">
          {index + 1} of {total}
        </p>
        {tag ? <p className="smallcaps text-xs text-oxblood">{tag}</p> : null}
      </div>
      <div
        className="mt-2 h-0.5 w-full bg-rule"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + 1}
      >
        <div className="h-full bg-gilt transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function SessionRunner({ profile, now = () => new Date(), onRankUp, onReturn }: SessionRunnerProps) {
  const [phase, setPhase] = useState<Phase>('starting')
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answered, setAnswered] = useState<Answer | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [saveWarning, setSaveWarning] = useState(false)

  const started = useRef(false)
  const alive = useRef(true)
  /** Pending recordAnswer writes, chained so completion waits for them. */
  const pending = useRef<Promise<void>>(Promise.resolve())
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setPhase('starting')
    try {
      const p = await startSession(now())
      if (!alive.current) return
      setPlan(p)
      setIndex(0)
      setAnswers([])
      setAnswered(null)
      setPhase('running')
    } catch (e) {
      if (alive.current) setError(e)
    }
  }, [now])

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
  }, [start])

  const exercise = plan && phase === 'running' ? plan.exercises[index] : undefined
  const items = useMemo(() => (exercise ? itemsFor(exercise) : {}), [exercise])

  useEffect(() => {
    if (!answered) return
    const el = continueRef.current
    if (!el) return
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    el.focus({ preventScroll: true })
  }, [answered])

  const handleAnswer = useCallback(
    (answer: Answer) => {
      if (!plan || answered) return
      setAnswered(answer)
      setAnswers((prev) => [...prev, answer])
      pending.current = pending.current
        .then(() => recordAnswer(plan, answer, now()))
        .catch((e: unknown) => {
          console.warn('[session] answer could not be saved', e)
          if (alive.current) setSaveWarning(true)
        })
    },
    [plan, answered, now],
  )

  const complete = useCallback(
    async (finalAnswers: Answer[]) => {
      if (!plan) return
      setError(null)
      setPhase('completing')
      try {
        await pending.current
        const s = await completeSession(plan, finalAnswers, now())
        if (!alive.current) return
        setSummary(s)
        if (s.rankAfter > s.rankBefore && onRankUp) {
          onRankUp(s)
          return
        }
        setPhase('summary')
      } catch (e) {
        if (alive.current) setError(e)
      }
    },
    [plan, now, onRankUp],
  )

  const handleContinue = useCallback(() => {
    if (!plan) return
    const next = index + 1
    if (next >= plan.exercises.length) {
      void complete(answers)
      return
    }
    setIndex(next)
    setAnswered(null)
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo({ top: 0 })
      } catch {
        /* jsdom */
      }
    }
  }, [plan, index, answers, complete])

  /** A slot whose component is missing is passed over without an answer. */
  const skip = useCallback(() => {
    if (!plan) return
    const next = index + 1
    if (next >= plan.exercises.length) {
      void complete(answers)
      return
    }
    setIndex(next)
    setAnswered(null)
  }, [plan, index, answers, complete])

  // ---- render --------------------------------------------------------------

  if (error) {
    const retry = phase === 'completing' ? () => void complete(answers) : () => void start()
    return (
      <div data-testid="session-error">
        <ErrorNotice
          message={phase === 'completing' ? 'The session could not be marked.' : 'The lesson could not be prepared.'}
          detail={error}
          onRetry={retry}
        />
        <div className="text-center">
          <Button variant="quiet" onClick={onReturn}>
            Return
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'starting' || !plan) return <Spinner label="Laying out the lesson." />
  if (phase === 'completing') return <Spinner label="Marking." />
  if (phase === 'summary' && summary) return <Summary summary={summary} onReturn={onReturn} />

  if (!exercise) {
    // Should not happen: the plan always has at least one exercise.
    return <ErrorNotice message="There is nothing in this lesson." onRetry={() => void start()} />
  }

  const Component = EXERCISE_COMPONENTS[exercise.type] as ExerciseComponent | undefined
  const total = plan.exercises.length

  return (
    <div data-testid="session-runner">
      <div className="flex items-center justify-between gap-3">
        <SlotProgress index={index} total={total} tag={slotTag(exercise)} />
        <Button variant="quiet" className="-mr-3 px-3 text-sm" onClick={onReturn} data-testid="session-leave" aria-label="Leave the lesson">
          Leave
        </Button>
      </div>

      {Component ? (
        <Component
          key={exercise.id}
          exercise={exercise}
          items={items}
          answered={answered}
          onAnswer={handleAnswer}
          media={MEDIA}
          soundEnabled={profile.soundEnabled}
        />
      ) : (
        <div className="py-8 text-center" data-testid="exercise-unavailable">
          <p className="text-ink">This exercise cannot be shown just now.</p>
          <Button variant="secondary" className="mt-4" onClick={skip} data-testid="continue">
            Pass over
          </Button>
        </div>
      )}

      {answered ? (
        <div className="mt-5 space-y-4">
          <Feedback exercise={exercise} answer={answered} items={items} lookup={getItem} />
          {saveWarning ? (
            <p className="text-center font-sans text-xs text-ink-mute" data-testid="save-warning">
              Progress could not be saved just now; the lesson continues.
            </p>
          ) : null}
          <Button ref={continueRef} block data-testid="continue" onClick={handleContinue}>
            {index + 1 >= total ? 'Finish' : 'Continue'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
