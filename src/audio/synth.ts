/**
 * Web Audio synthesiser for Drop the Needle themes.
 *
 * Each sounding note is an oscillator pair (a sine at pitch plus a quiet,
 * slightly detuned triangle an octave up) through a per-note ADSR gain, into
 * a shared lowpass filter and master gain. Everything is scheduled up front on
 * the AudioContext clock; `done` resolves on a timer once the last release has
 * faded, and `stop()` fades out and tears the graph down.
 */
import type { Theme } from '../content/schema'
import { midiToFrequency, parseTheme, type ParsedNote } from './theme'

export interface ThemePlayback {
  /** Fade out and release every node. Safe to call more than once, and after `done`. */
  stop(): void
  /** Resolves when playback ends naturally or is stopped. Never rejects. */
  done: Promise<void>
  /** Musical length of the theme in seconds (excludes the lead-in and release tail). */
  durationSeconds: number
}

/** Timing and voicing constants, exported so tests and the hook share them. */
export const SYNTH = Object.freeze({
  /** Seconds between scheduling and the first note, so the first attack is not clipped. */
  leadIn: 0.05,
  attack: 0.01,
  decay: 0.06,
  sustain: 0.6,
  release: 0.15,
  /** Gap carved out of a note when the next note repeats its pitch, so repeats articulate. */
  repeatGap: 0.05,
  /** Fade applied by stop() before the graph is disconnected. */
  stopFade: 0.03,
  octaveGain: 0.12,
  octaveDetuneCents: 6,
  filterHz: 2400,
  filterQ: 0.7,
  defaultGain: 0.25,
})

/** A note that will actually sound: its pitch, onset and held length (before release). */
export interface NoteEvent {
  midi: number
  startSeconds: number
  holdSeconds: number
}

/**
 * Turn parsed notes into sounding events: rests are dropped, and a note whose
 * immediate successor repeats its pitch is shortened by `repeatGap` (never by
 * more than half its length) so the repeated attack is audible.
 */
export function articulate(notes: readonly ParsedNote[]): NoteEvent[] {
  const events: NoteEvent[] = []
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    if (note.midi === null) continue
    const next = notes[i + 1]
    const repeated = next !== undefined && next.midi === note.midi
    const holdSeconds = repeated ? Math.max(note.seconds - SYNTH.repeatGap, note.seconds / 2) : note.seconds
    events.push({ midi: note.midi, startSeconds: note.startSeconds, holdSeconds })
  }
  return events
}

type AudioContextCtor = new () => AudioContext

let singleton: AudioContext | null = null

function audioContextCtor(): AudioContextCtor | undefined {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return g.AudioContext ?? g.webkitAudioContext
}

/**
 * The app's single AudioContext. Creates it on first use and calls `resume()`
 * whenever it is not running, so call this from a user gesture (a tap on
 * Play) to satisfy autoplay policies. Throws when Web Audio is unavailable.
 */
export function ensureAudioContext(): AudioContext {
  if (!singleton) {
    const Ctor = audioContextCtor()
    if (!Ctor) throw new Error('Web Audio is not available: no AudioContext in this environment')
    singleton = new Ctor()
  }
  if (singleton.state !== 'running') {
    try {
      const resumed = singleton.resume()
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => undefined)
    } catch {
      // Some engines throw synchronously outside a user gesture; playback will simply be silent.
    }
  }
  return singleton
}

interface ScheduledNote {
  nodes: AudioNode[]
  oscillators: Array<{ osc: OscillatorNode; endsAt: number }>
}

function scheduleNote(ctx: AudioContext, destination: AudioNode, event: NoteEvent, origin: number): ScheduledNote {
  const t0 = origin + event.startSeconds
  const hold = event.holdSeconds
  const tOff = t0 + hold

  // Per-note ADSR on a gain node.
  const envelope = ctx.createGain()
  const attackEnd = t0 + Math.min(SYNTH.attack, hold / 2)
  const decayEnd = Math.min(attackEnd + SYNTH.decay, tOff)
  envelope.gain.setValueAtTime(0, t0)
  envelope.gain.linearRampToValueAtTime(1, attackEnd)
  envelope.gain.linearRampToValueAtTime(SYNTH.sustain, decayEnd)
  envelope.gain.setValueAtTime(SYNTH.sustain, tOff)
  envelope.gain.linearRampToValueAtTime(0, tOff + SYNTH.release)
  envelope.connect(destination)

  const frequency = midiToFrequency(event.midi)

  const fundamental = ctx.createOscillator()
  fundamental.type = 'sine'
  fundamental.frequency.value = frequency
  fundamental.connect(envelope)

  const octave = ctx.createOscillator()
  octave.type = 'triangle'
  octave.frequency.value = frequency * 2
  octave.detune.value = SYNTH.octaveDetuneCents
  const octaveGain = ctx.createGain()
  octaveGain.gain.value = SYNTH.octaveGain
  octave.connect(octaveGain)
  octaveGain.connect(envelope)

  const endsAt = tOff + SYNTH.release + 0.02
  fundamental.start(t0)
  fundamental.stop(endsAt)
  octave.start(t0)
  octave.stop(endsAt)

  return {
    nodes: [envelope, octaveGain, fundamental, octave],
    oscillators: [
      { osc: fundamental, endsAt },
      { osc: octave, endsAt },
    ],
  }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : SYNTH.defaultGain
}

/**
 * Schedule and play a theme. Parses first (so a bad theme throws before any
 * audio node exists), then builds the graph on `opts.context` or the shared
 * context. `gain` is the master level, 0..1 (default 0.25).
 */
export function playTheme(theme: Theme, opts: { context?: AudioContext; gain?: number } = {}): ThemePlayback {
  const { notes, durationSeconds } = parseTheme(theme)
  const ctx = opts.context ?? ensureAudioContext()

  const master = ctx.createGain()
  master.gain.value = clamp01(opts.gain ?? SYNTH.defaultGain)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = SYNTH.filterHz
  filter.Q.value = SYNTH.filterQ
  filter.connect(master)
  master.connect(ctx.destination)

  const origin = ctx.currentTime + SYNTH.leadIn
  const nodes: AudioNode[] = [filter, master]
  const oscillators: ScheduledNote['oscillators'] = []
  for (const event of articulate(notes)) {
    const scheduled = scheduleNote(ctx, filter, event, origin)
    nodes.push(...scheduled.nodes)
    oscillators.push(...scheduled.oscillators)
  }

  let resolveDone: () => void = () => undefined
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  let settled = false

  const teardown = () => {
    for (const node of nodes) {
      try {
        node.disconnect()
      } catch {
        // Already disconnected or context closed; nothing to do.
      }
    }
  }

  const tailSeconds = SYNTH.leadIn + durationSeconds + SYNTH.release + 0.02
  const timer = setTimeout(() => {
    if (settled) return
    settled = true
    teardown()
    resolveDone()
  }, Math.ceil(tailSeconds * 1000))

  const stop = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    const now = ctx.currentTime
    const fadeEnd = now + SYNTH.stopFade
    try {
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, fadeEnd)
    } catch {
      // A closed context rejects automation; fall through to the hard stop.
    }
    for (const { osc, endsAt } of oscillators) {
      if (endsAt <= now) continue
      try {
        osc.stop(fadeEnd)
      } catch {
        // Never started or already stopped.
      }
    }
    setTimeout(teardown, Math.ceil((SYNTH.stopFade + 0.02) * 1000))
    resolveDone()
  }

  return { stop, done, durationSeconds }
}
