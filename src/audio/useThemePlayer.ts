/**
 * React hook around the theme synthesiser for Drop the Needle.
 *
 * `play()` is a no-op when sound is disabled or there is no theme; otherwise
 * it ensures the shared AudioContext (call it from a tap so autoplay policies
 * are satisfied) and starts playback. `playing` and `progress` (0..1, driven
 * by requestAnimationFrame) feed the UI. Playback stops on unmount, when the
 * theme changes, and when sound is switched off.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Theme } from '../content/schema'
import { ensureAudioContext, playTheme, type ThemePlayback } from './synth'
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

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
}

export function useThemePlayer(theme: Theme | undefined, enabled: boolean): ThemePlayer {
  const playbackRef = useRef<ThemePlayback | null>(null)
  const frameRef = useRef<FrameHandle | null>(null)
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
    const playback = playbackRef.current
    playbackRef.current = null
    cancelFrames()
    if (playback) playback.stop()
    setPlaying(false)
  }, [cancelFrames])

  const play = useCallback(() => {
    if (!enabled || !theme) return
    stop()
    let playback: ThemePlayback
    try {
      const context = ensureAudioContext()
      playback = playTheme(theme, { context })
    } catch (err) {
      // No Web Audio, or a malformed theme: the exercise stays answerable, just silent.
      console.warn('[audio] could not play theme', err)
      return
    }
    playbackRef.current = playback
    setPlaying(true)
    setProgress(0)

    const startedAt = nowMs()
    const totalMs = playback.durationSeconds * 1000
    const tick = () => {
      frameRef.current = null
      if (playbackRef.current !== playback) return
      const fraction = totalMs > 0 ? Math.min(1, (nowMs() - startedAt) / totalMs) : 1
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
