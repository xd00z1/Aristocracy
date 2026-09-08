/**
 * React hook around the theme synthesiser for Drop the Needle.
 *
 * `play()` is a no-op when sound is disabled, when there is no theme, and when
 * the shared AudioContext will not run (call it from a tap so autoplay policies
 * are satisfied): a suspended context sounds nothing, and the UI must not claim
 * otherwise. `playing` and `progress` (0..1, sampled each animation frame from
 * the audio clock) feed the UI. Playback stops on unmount, when the
 * theme changes, and when sound is switched off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Theme } from '../content/schema'
import { ensureRunningContext, playTheme, type ThemePlayback } from './synth'
import { parseTheme } from './theme'

export interface ThemePlayer {
  play(): void
  stop(): void
  playing: boolean
  /** 0..1 through the theme's musical length; 1 once it has finished. */
  progress: number
  durationSeconds: number
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

export function useThemePlayer(theme: Theme | undefined, enabled: boolean): ThemePlayer {
  const playbackRef = useRef<ThemePlayback | null>(null)
  const frameRef = useRef<FrameHandle | null>(null)
  /** Rises on every play() and stop(), so a resume that lands late is discarded. */
  const attemptRef = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  // Key on the notation, not object identity, so a re-render with an equal theme does not restart.
  const themeKey = theme ? `${theme.tempo}:${theme.notes}` : ''

  const notes = theme?.notes
  const tempo = theme?.tempo
  const durationSeconds = useMemo(() => {
    if (notes === undefined || tempo === undefined) return 0
    try {
      return parseTheme({ notes, tempo }).durationSeconds
    } catch {
      return 0
    }
  }, [notes, tempo])

  const cancelFrames = useCallback(() => {
    if (frameRef.current) {
      cancelFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    attemptRef.current++
    const playback = playbackRef.current
    playbackRef.current = null
    cancelFrames()
    if (playback) playback.stop()
    setPlaying(false)
  }, [cancelFrames])

  /**
   * Start the theme, once the shared context is actually running.
   *
   * A context that is still suspended (no gesture yet, or an iOS interruption)
   * has a frozen clock: notes scheduled against it never sound. Nothing is
   * claimed in that case — no graph, no `playing`, no meter — so the button
   * keeps reading "Drop the needle" rather than showing a full, silent play.
   */
  const play = useCallback(() => {
    if (!enabled || !theme) return
    stop()
    const attempt = ++attemptRef.current

    const begin = (context: AudioContext) => {
      if (attempt !== attemptRef.current) return // stopped or superseded while resuming
      if (context.state !== 'running') return
      let playback: ThemePlayback
      try {
        playback = playTheme(theme, { context })
      } catch (err) {
        // A malformed theme: the exercise stays answerable, just silent.
        console.warn('[audio] could not play theme', err)
        return
      }
      playbackRef.current = playback
      setPlaying(true)
      setProgress(0)

      // The meter follows the audio clock, not the wall clock, so a context
      // that suspends mid-theme freezes the line instead of running it to 100%.
      const startedAt = context.currentTime
      const total = playback.durationSeconds
      const tick = () => {
        frameRef.current = null
        if (playbackRef.current !== playback) return
        const fraction = total > 0 ? Math.min(1, Math.max(0, (context.currentTime - startedAt) / total)) : 1
        setProgress(fraction)
        if (fraction < 1) frameRef.current = requestFrame(tick)
      }
      frameRef.current = requestFrame(tick)

      void playback.done.then(() => {
        if (playbackRef.current !== playback) return // stopped or superseded
        playbackRef.current = null
        cancelFrames()
        setProgress(1)
        setPlaying(false)
      })
    }

    void ensureRunningContext()
      .then(begin)
      .catch((err: unknown) => {
        // No Web Audio here at all: the exercise stays answerable, just silent.
        console.warn('[audio] could not open the audio device', err)
      })
  }, [enabled, theme, stop, cancelFrames])

  // Stop when the theme changes (and reset the meter); the first run is a harmless no-op.
  useEffect(() => {
    stop()
    setProgress(0)
  }, [themeKey, stop])

  // Stop when sound is switched off mid-play.
  useEffect(() => {
    if (!enabled) stop()
  }, [enabled, stop])

  // Stop on unmount.
  useEffect(() => stop, [stop])

  return { play, stop, playing, progress, durationSeconds }
}
