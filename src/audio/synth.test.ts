// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Theme } from '../content/schema'
import { SYNTH, articulate, playTheme } from './synth'
import { parseTheme } from './theme'

type SynthModule = typeof import('./synth')
type HookModule = typeof import('./useThemePlayer')

// ---------------------------------------------------------------------------
// A minimal hand-written fake of the Web Audio API (jsdom has none).
// ---------------------------------------------------------------------------

interface ParamEvent {
  method: string
  value: number
  time: number
}

class FakeParam {
  value = 0
  events: ParamEvent[] = []
  setValueAtTime(value: number, time: number) {
    this.events.push({ method: 'setValueAtTime', value, time })
    return this
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ method: 'linearRampToValueAtTime', value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time })
    return this
  }
  setTargetAtTime(value: number, time: number) {
    this.events.push({ method: 'setTargetAtTime', value, time })
    return this
  }
  cancelScheduledValues(time: number) {
    this.events.push({ method: 'cancelScheduledValues', value: Number.NaN, time })
    return this
  }
}

class FakeNode {
  connections: FakeNode[] = []
  disconnected = false
  connect(target: FakeNode) {
    this.connections.push(target)
    return target
  }
  disconnect() {
    this.disconnected = true
    this.connections = []
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
  Q = new FakeParam()
}

class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  detune = new FakeParam()
  startedAt: number | null = null
  stopCalls: number[] = []
  start(when = 0) {
    if (this.startedAt !== null) throw new Error('InvalidStateError: oscillator already started')
    this.startedAt = when
  }
  stop(when = 0) {
    if (this.startedAt === null) throw new Error('InvalidStateError: oscillator not started')
    this.stopCalls.push(when)
  }
  get stoppedAt(): number | null {
    return this.stopCalls.length ? this.stopCalls[this.stopCalls.length - 1] : null
  }
}

class FakeAudioContext {
  currentTime = 0
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  filters: FakeFilter[] = []
  resumeCalls = 0
  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBiquadFilter() {
    const f = new FakeFilter()
    this.filters.push(f)
    return f
  }
  resume() {
    this.resumeCalls++
    this.state = 'running'
    return Promise.resolve()
  }
  /** Every node this context created, for teardown assertions. */
  get nodes(): FakeNode[] {
    return [...this.oscillators, ...this.gains, ...this.filters]
  }
}

const asContext = (ctx: FakeAudioContext) => ctx as unknown as AudioContext

const BEETHOVEN_5: Theme = { notes: 'R/8 G4/8 G4/8 G4/8 Eb4/2 | R/8 F4/8 F4/8 F4/8 D4/2', tempo: 120 }
const SOUNDING = 8 // ten tokens, two of them rests

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

// ---------------------------------------------------------------------------

describe('articulate', () => {
  it('drops rests and keeps note onsets', () => {
    const events = articulate(parseTheme(BEETHOVEN_5).notes)
    expect(events).toHaveLength(SOUNDING)
    expect(events.map((e) => e.midi)).toEqual([67, 67, 67, 63, 65, 65, 65, 62])
    expect(events.map((e) => e.startSeconds)).toEqual([0.25, 0.5, 0.75, 1, 2.25, 2.5, 2.75, 3])
  })

  it('carves a gap out of a note when the next note repeats its pitch', () => {
    const events = articulate(parseTheme({ notes: 'G4/8 G4/8 G4/8 Eb4/2', tempo: 120 }).notes)
    expect(events[0].holdSeconds).toBeCloseTo(0.25 - SYNTH.repeatGap, 9)
    expect(events[1].holdSeconds).toBeCloseTo(0.25 - SYNTH.repeatGap, 9)
    expect(events[2].holdSeconds).toBe(0.25) // followed by a different pitch
    expect(events[3].holdSeconds).toBe(1)
    // The gap between the end of one G and the start of the next is exactly repeatGap.
    expect(events[1].startSeconds - (events[0].startSeconds + events[0].holdSeconds)).toBeCloseTo(SYNTH.repeatGap, 9)
  })

  it('never shortens a repeated note by more than half', () => {
    const events = articulate(parseTheme({ notes: 'C4/32 C4/32', tempo: 240 }).notes)
    // A 32nd at 240 BPM is 0.03125 s, shorter than the gap.
    expect(events[0].holdSeconds).toBeCloseTo(0.03125 / 2, 9)
  })

  it('does not treat a repeat across a rest as a repeat', () => {
    const events = articulate(parseTheme({ notes: 'C4/4 R/4 C4/4', tempo: 120 }).notes)
    expect(events[0].holdSeconds).toBe(0.5)
  })
})

describe('playTheme', () => {
  let ctx: FakeAudioContext
  beforeEach(() => {
    ctx = new FakeAudioContext()
  })

  it('schedules one oscillator pair per sounding note and none for rests', () => {
    const playback = playTheme(BEETHOVEN_5, { context: asContext(ctx) })
    expect(ctx.oscillators).toHaveLength(SOUNDING * 2)
    const onsets = new Set(ctx.oscillators.map((o) => o.startedAt))
    expect(onsets.size).toBe(SOUNDING)
    expect(ctx.oscillators.every((o) => o.startedAt !== null && o.stoppedAt !== null)).toBe(true)
    expect(playback.durationSeconds).toBe(4)
    playback.stop()
  })

  it('places onsets at the parsed start times after the lead-in, on the context clock', () => {
    ctx.currentTime = 10
    const playback = playTheme(BEETHOVEN_5, { context: asContext(ctx) })
    const expected = articulate(parseTheme(BEETHOVEN_5).notes).map((e) => 10 + SYNTH.leadIn + e.startSeconds)
    const onsets = [...new Set(ctx.oscillators.map((o) => o.startedAt as number))].sort((a, b) => a - b)
    expect(onsets).toHaveLength(expected.length)
    onsets.forEach((t, i) => expect(t).toBeCloseTo(expected[i], 9))
    playback.stop()
  })

  it('pairs a sine at pitch with a quiet detuned triangle an octave up', () => {
    const playback = playTheme({ notes: 'A4/4', tempo: 120 }, { context: asContext(ctx) })
    const [sine, triangle] = ctx.oscillators
    expect(sine.type).toBe('sine')
    expect(sine.frequency.value).toBeCloseTo(440, 9)
    expect(triangle.type).toBe('triangle')
    expect(triangle.frequency.value).toBeCloseTo(880, 9)
    expect(triangle.detune.value).toBe(SYNTH.octaveDetuneCents)
    // The triangle goes through its own quiet gain; the sine goes straight into the envelope.
    const octaveGain = triangle.connections[0] as FakeGain
    expect(octaveGain.gain.value).toBe(SYNTH.octaveGain)
    const envelope = sine.connections[0] as FakeGain
    expect(octaveGain.connections[0]).toBe(envelope)
    playback.stop()
  })

  it('routes every note through the lowpass filter and master gain to the destination', () => {
    const playback = playTheme(BEETHOVEN_5, { context: asContext(ctx), gain: 0.4 })
    expect(ctx.filters).toHaveLength(1)
    const [filter] = ctx.filters
    expect(filter.type).toBe('lowpass')
    expect(filter.frequency.value).toBe(SYNTH.filterHz)
    const master = filter.connections[0] as FakeGain
    expect(master.gain.value).toBe(0.4)
    expect(master.connections[0]).toBe(ctx.destination)
    // Each sine's envelope feeds the filter.
    const sines = ctx.oscillators.filter((o) => o.type === 'sine')
    expect(sines).toHaveLength(SOUNDING)
    for (const sine of sines) expect(sine.connections[0].connections[0]).toBe(filter)
    playback.stop()
  })

  it('uses the default master gain and clamps out-of-range values', () => {
    const a = playTheme({ notes: 'C4/4', tempo: 120 }, { context: asContext(ctx) })
    expect(ctx.filters[0].connections[0]).toHaveProperty('gain.value', SYNTH.defaultGain)
    a.stop()
    const ctx2 = new FakeAudioContext()
    const b = playTheme({ notes: 'C4/4', tempo: 120 }, { context: asContext(ctx2), gain: 5 })
    expect(ctx2.filters[0].connections[0]).toHaveProperty('gain.value', 1)
    b.stop()
  })

  it('shapes each note with an ADSR envelope and stops the oscillators after the release', () => {
    const playback = playTheme({ notes: 'C4/4', tempo: 120 }, { context: asContext(ctx) })
    const [sine] = ctx.oscillators
    const envelope = sine.connections[0] as FakeGain
    const t0 = SYNTH.leadIn
    const tOff = t0 + 0.5
    const e = envelope.gain.events
    expect(e[0]).toMatchObject({ method: 'setValueAtTime', value: 0 })
    expect(close(e[0].time, t0)).toBe(true)
    expect(e[1]).toMatchObject({ method: 'linearRampToValueAtTime', value: 1 })
    expect(close(e[1].time, t0 + SYNTH.attack)).toBe(true)
    expect(e[2]).toMatchObject({ method: 'linearRampToValueAtTime', value: SYNTH.sustain })
    expect(close(e[2].time, t0 + SYNTH.attack + SYNTH.decay)).toBe(true)
    expect(e[3]).toMatchObject({ method: 'setValueAtTime', value: SYNTH.sustain })
    expect(close(e[3].time, tOff)).toBe(true)
    expect(e[4]).toMatchObject({ method: 'linearRampToValueAtTime', value: 0 })
    expect(close(e[4].time, tOff + SYNTH.release)).toBe(true)
    expect(sine.stoppedAt as number).toBeGreaterThanOrEqual(tOff + SYNTH.release)
    playback.stop()
  })

  it('shortens a repeated pitch so the next attack articulates', () => {
    const playback = playTheme({ notes: 'G4/8 G4/8 A4/8', tempo: 120 }, { context: asContext(ctx) })
    const sines = ctx.oscillators.filter((o) => o.type === 'sine')
    const releaseStart = (o: FakeOscillator) => {
      const env = o.connections[0] as FakeGain
      return env.gain.events.find((ev) => ev.method === 'linearRampToValueAtTime' && ev.value === 0)!.time - SYNTH.release
    }
    expect((sines[1].startedAt as number) - releaseStart(sines[0])).toBeCloseTo(SYNTH.repeatGap, 9)
    // G to A is not a repeat: the second G holds its full length.
    expect(releaseStart(sines[1]) - (sines[1].startedAt as number)).toBeCloseTo(0.25, 9)
    playback.stop()
  })

  it('throws on a bad theme before creating any audio node', () => {
    expect(() => playTheme({ notes: 'C4/4 X9/4', tempo: 120 }, { context: asContext(ctx) })).toThrow(/Bad theme token/)
    expect(ctx.nodes).toHaveLength(0)
  })

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('resolves done after the theme and its release tail have played, then tears down', async () => {
      const playback = playTheme(BEETHOVEN_5, { context: asContext(ctx) })
      let resolved = false
      void playback.done.then(() => {
        resolved = true
      })
      await vi.advanceTimersByTimeAsync(playback.durationSeconds * 1000 - 1)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync((SYNTH.leadIn + SYNTH.release + 0.1) * 1000)
      expect(resolved).toBe(true)
      expect(ctx.nodes.every((n) => n.disconnected)).toBe(true)
    })

    it('stop() resolves done, silences the oscillators and disconnects every node', async () => {
      ctx.currentTime = 1 // part way through the first G
      const playback = playTheme(BEETHOVEN_5, { context: asContext(ctx) })
      ctx.currentTime = 1.4
      playback.stop()
      await expect(playback.done).resolves.toBeUndefined()
      // Master gain fades to silence from now, and every still-live oscillator is told to stop at the end of the fade.
      const master = ctx.filters[0].connections[0] as FakeGain
      const fade = master.gain.events.at(-1)!
      expect(fade).toMatchObject({ method: 'linearRampToValueAtTime', value: 0 })
      expect(close(fade.time, 1.4 + SYNTH.stopFade)).toBe(true)
      for (const osc of ctx.oscillators) expect(close(osc.stoppedAt as number, 1.4 + SYNTH.stopFade)).toBe(true)
      expect(ctx.nodes.some((n) => n.disconnected)).toBe(false) // graph survives the fade
      await vi.advanceTimersByTimeAsync(SYNTH.stopFade * 1000 + 50)
      expect(ctx.nodes.every((n) => n.disconnected)).toBe(true)
      // The natural-end timer was cancelled: nothing else fires.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('stop() is idempotent and harmless after natural completion', async () => {
      const playback = playTheme({ notes: 'C4/8', tempo: 120 }, { context: asContext(ctx) })
      await vi.advanceTimersByTimeAsync(5_000)
      await expect(playback.done).resolves.toBeUndefined()
      expect(() => {
        playback.stop()
        playback.stop()
      }).not.toThrow()
      expect(ctx.oscillators[0].stopCalls).toHaveLength(1) // only the originally scheduled stop
    })

    it('stop() leaves oscillators that have already ended alone', () => {
      const playback = playTheme({ notes: 'C4/8 R/1 D4/8', tempo: 120 }, { context: asContext(ctx) })
      const [cSine, , dSine] = ctx.oscillators
      ctx.currentTime = 1.5 // C has ended, D is yet to start
      playback.stop()
      expect(cSine.stopCalls).toHaveLength(1)
      expect(dSine.stopCalls).toHaveLength(2)
    })
  })
})

describe('ensureAudioContext', () => {
  // The singleton lives in module state, so each test gets a fresh copy of the module.
  let synth: SynthModule
  let created: FakeAudioContext[]
  beforeEach(async () => {
    vi.resetModules()
    created = []
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor() {
          super()
          created.push(this)
        }
      },
    )
    synth = await import('./synth')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates one shared context and resumes it whenever it is not running', () => {
    const first = synth.ensureAudioContext()
    const second = synth.ensureAudioContext()
    expect(first).toBe(second)
    expect(created).toHaveLength(1)
    expect(created[0].resumeCalls).toBe(1) // suspended at creation, resumed once; running afterwards
    synth.ensureAudioContext()
    expect(created[0].resumeCalls).toBe(1)
    created[0].state = 'suspended'
    synth.ensureAudioContext()
    expect(created[0].resumeCalls).toBe(2)
  })

  it('falls back to webkitAudioContext', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', FakeAudioContext)
    expect(synth.ensureAudioContext()).toBeInstanceOf(FakeAudioContext)
  })

  it('throws a clear error when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    expect(() => synth.ensureAudioContext()).toThrow(/Web Audio is not available/)
  })

  it('playTheme uses the shared context when none is given', () => {
    const playback = synth.playTheme({ notes: 'C4/4', tempo: 120 })
    expect(created).toHaveLength(1)
    expect(created[0].oscillators).toHaveLength(2)
    expect(created[0].resumeCalls).toBe(1)
    playback.stop()
  })
})

describe('useThemePlayer', () => {
  const THEME: Theme = { notes: 'C4/4 D4/4', tempo: 120 }
  let created: FakeAudioContext[]
  let useThemePlayer: HookModule['useThemePlayer']

  beforeEach(async () => {
    vi.resetModules()
    created = []
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor() {
          super()
          created.push(this)
        }
      },
    )
    ;({ useThemePlayer } = await import('./useThemePlayer'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** The context the hook created in this test (undefined until play() has run). */
  const shared = () => created[0]
  const oscillatorCount = () => shared()?.oscillators.length ?? 0

  it('reports the duration without playing anything', () => {
    const { result } = renderHook(() => useThemePlayer(THEME, true))
    expect(result.current.durationSeconds).toBe(1)
    expect(result.current.playing).toBe(false)
    expect(result.current.progress).toBe(0)
  })

  it('play() does nothing when sound is disabled or there is no theme', () => {
    const disabled = renderHook(() => useThemePlayer(THEME, false))
    act(() => disabled.result.current.play())
    expect(disabled.result.current.playing).toBe(false)
    const themeless = renderHook(() => useThemePlayer(undefined, true))
    act(() => themeless.result.current.play())
    expect(themeless.result.current.playing).toBe(false)
    expect(themeless.result.current.durationSeconds).toBe(0)
    expect(oscillatorCount()).toBe(0)
  })

  it('play() ensures the context, schedules the theme and sets playing; stop() clears it', () => {
    const { result } = renderHook(() => useThemePlayer(THEME, true))
    act(() => result.current.play())
    expect(result.current.playing).toBe(true)
    expect(created).toHaveLength(1)
    expect(created[0].resumeCalls).toBe(1)
    const before = oscillatorCount()
    expect(before).toBe(4) // two notes, two oscillators each
    act(() => result.current.stop())
    expect(result.current.playing).toBe(false)
    expect(shared().oscillators.every((o) => o.stopCalls.length >= 1)).toBe(true)
  })

  it('replaying restarts rather than layering', () => {
    const { result } = renderHook(() => useThemePlayer(THEME, true))
    act(() => result.current.play())
    const first = shared().oscillators.slice()
    act(() => result.current.play())
    expect(first.every((o) => o.stopCalls.length === 2)).toBe(true) // scheduled stop plus the fade-out stop
    expect(result.current.playing).toBe(true)
  })

  it('stops when the theme changes and on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ theme }) => useThemePlayer(theme, true), {
      initialProps: { theme: THEME },
    })
    act(() => result.current.play())
    const first = shared().oscillators.slice()
    rerender({ theme: { notes: 'E4/2', tempo: 100 } })
    expect(result.current.playing).toBe(false)
    expect(first.every((o) => o.stopCalls.length === 2)).toBe(true)
    expect(result.current.durationSeconds).toBeCloseTo(1.2, 9)
    // A re-render with an equal (but new) theme object does not disturb playback.
    act(() => result.current.play())
    rerender({ theme: { notes: 'E4/2', tempo: 100 } })
    expect(result.current.playing).toBe(true)
    const second = shared().oscillators.slice(first.length)
    unmount()
    expect(second.every((o) => o.stopCalls.length === 2)).toBe(true)
  })

  it('stops when sound is switched off mid-play', () => {
    const { result, rerender } = renderHook(({ enabled }) => useThemePlayer(THEME, enabled), {
      initialProps: { enabled: true },
    })
    act(() => result.current.play())
    expect(result.current.playing).toBe(true)
    rerender({ enabled: false })
    expect(result.current.playing).toBe(false)
  })

  it('tracks progress to 1 and clears playing when playback ends', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useThemePlayer(THEME, true))
      act(() => result.current.play())
      expect(result.current.progress).toBe(0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(result.current.progress).toBeGreaterThan(0.3)
      expect(result.current.progress).toBeLessThan(0.8)
      expect(result.current.playing).toBe(true)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(result.current.progress).toBe(1)
      expect(result.current.playing).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
