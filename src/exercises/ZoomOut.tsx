/**
 * Zoom Out: the painting starts at brushwork (4x, centred on the item's
 * `media.image.focus`) and eases down to 1x over six seconds. Answering
 * earlier is worth more: the Answer carries `earlyFraction`, the share of the
 * reveal still to run at the moment of the tap (0..1). The reveal completes
 * as soon as the exercise is answered, and at once when the picture fails to
 * load or the reader has asked for reduced motion, so neither pays an early
 * bonus for a reveal nobody watched. Without an image on disk it degrades to
 * a plain choice with a notice.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Item } from '../content/types'
import type { Answer, ChoiceExercise } from '../engine/types'
import { ChoiceBase, nowMs } from './ChoiceBase'
import type { ExerciseProps } from './types'

export const REVEAL_SECONDS = 6
export const REVEAL_MS = REVEAL_SECONDS * 1000
export const START_SCALE = 4
export const DEFAULT_FOCUS = { x: 0.5, y: 0.5 }

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Smoothstep: slow to start, so the first second gives little away. */
export function ease(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Image scale `elapsedMs` into the reveal: START_SCALE at 0, 1 at the end. */
export function scaleAt(elapsedMs: number): number {
  return 1 + (START_SCALE - 1) * (1 - ease(elapsedMs / REVEAL_MS))
}

/** Share of the reveal still to run, 0..1. */
export function earlyFractionAt(elapsedMs: number): number {
  return clamp01((REVEAL_MS - elapsedMs) / REVEAL_MS)
}

/** True when the reader has asked the system for stillness. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

type FrameHandle = { kind: 'raf'; id: number } | { kind: 'timeout'; id: ReturnType<typeof setTimeout> }

function requestFrame(cb: () => void): FrameHandle {
  if (typeof requestAnimationFrame === 'function') return { kind: 'raf', id: requestAnimationFrame(cb) }
  return { kind: 'timeout', id: setTimeout(cb, 16) }
}

function cancelFrame(handle: FrameHandle): void {
  if (handle.kind === 'raf') {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle.id)
  } else {
    clearTimeout(handle.id)
  }
}

function Reveal({ url, item, ...props }: ExerciseProps<ChoiceExercise> & { url: string; item: Item | undefined }) {
  const { answered } = props
  const focus = item?.media?.image?.focus ?? DEFAULT_FOCUS
  // No reveal at all for a reader who has asked for reduced motion: the whole
  // picture from the first frame, and no early bonus for something never hidden.
  const still = useRef(prefersReducedMotion())
  const [scale, setScale] = useState(() => (answered || still.current ? 1 : START_SCALE))
  const [remaining, setRemaining] = useState(() => (answered || still.current ? 0 : 1))
  const [broken, setBroken] = useState(false)
  const startedAt = useRef<number | null>(null)
  const done = useRef(Boolean(answered) || still.current)
  const frame = useRef<FrameHandle | null>(null)

  const finish = useCallback(() => {
    done.current = true
    if (frame.current) {
      cancelFrame(frame.current)
      frame.current = null
    }
    setScale(1)
    setRemaining(0)
  }, [])

  useEffect(() => {
    if (done.current) return
    startedAt.current = nowMs()
    const tick = () => {
      frame.current = null
      if (done.current) return
      const elapsed = nowMs() - (startedAt.current ?? nowMs())
      setScale(scaleAt(elapsed))
      setRemaining(earlyFractionAt(elapsed))
      if (elapsed < REVEAL_MS) frame.current = requestFrame(tick)
    }
    frame.current = requestFrame(tick)
    return () => {
      if (frame.current) cancelFrame(frame.current)
      frame.current = null
    }
  }, [])

  // Answered elsewhere (or mounted already answered): show the whole picture.
  useEffect(() => {
    if (answered && !done.current) finish()
  }, [answered, finish])

  const answerExtras = useCallback((): Partial<Answer> => {
    if (done.current) return { earlyFraction: 0 }
    const elapsed = nowMs() - (startedAt.current ?? nowMs())
    return { earlyFraction: Math.round(earlyFractionAt(elapsed) * 1000) / 1000 }
  }, [])

  return (
    <ChoiceBase {...props} answerExtras={answerExtras} onAnswered={finish} notice={broken ? 'The image could not be loaded.' : undefined}>
      <div data-testid="zoom">
        <div className="relative aspect-square w-full overflow-hidden rounded-card border border-rule bg-ivory-deep shadow-card" data-testid="zoom-frame">
          <img
            src={url}
            alt="A painting, revealed over six seconds"
            draggable={false}
            onError={() => {
              // A picture that never arrived cannot be answered early: end the
              // reveal so the answer reports earlyFraction 0, as the
              // "not fetched yet" fallback does.
              setBroken(true)
              finish()
            }}
            className="h-full w-full select-none object-cover"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
              willChange: 'transform',
            }}
            data-testid="zoom-image"
            data-scale={scale.toFixed(3)}
          />
        </div>
        <div
          className="mt-2 h-0.5 w-full bg-rule"
          role="progressbar"
          aria-label="Reveal remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remaining * 100)}
          data-testid="zoom-remaining"
        >
          <div className="h-full bg-gilt" style={{ width: `${remaining * 100}%` }} />
        </div>
      </div>
    </ChoiceBase>
  )
}

/** No reveal to be early for: the fallback still reports a zero earlyFraction. */
const NO_REVEAL = (): Partial<Answer> => ({ earlyFraction: 0 })

export function ZoomOut(props: ExerciseProps<ChoiceExercise>) {
  const { exercise, items, media } = props
  const item = items[exercise.itemId]
  const url = media.imageUrl(exercise.itemId)
  if (!url) {
    return (
      <ChoiceBase {...props} notice="Image not fetched yet." answerExtras={NO_REVEAL}>
        {item ? (
          <div className="rounded-card border border-rule bg-parchment px-4 py-3 shadow-card" data-testid="zoom-clue">
            <p className="font-serif text-lg leading-snug text-ink">“{item.title}”</p>
            {item.year !== undefined ? (
              <p className="mt-1 text-sm text-ink-soft">
                {item.year_approx ? 'c. ' : ''}
                {item.year}
              </p>
            ) : null}
          </div>
        ) : null}
      </ChoiceBase>
    )
  }
  return <Reveal {...props} url={url} item={item} />
}

export default ZoomOut
