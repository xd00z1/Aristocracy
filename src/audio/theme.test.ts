import { describe, expect, it } from 'vitest'
import type { Theme } from '../content/schema'
import { getContent } from '../content'
import { midiToFrequency, parseTheme, parseToken, pitchToMidi, tokenizeTheme } from './theme'

/** The example from src/content/schema.ts: the opening of Beethoven's Fifth. */
const BEETHOVEN_5: Theme = { notes: 'R/8 G4/8 G4/8 G4/8 Eb4/2 | R/8 F4/8 F4/8 F4/8 D4/2', tempo: 120 }

const theme = (notes: string, tempo = 120): Theme => ({ notes, tempo })

describe('parseTheme', () => {
  it('parses the Beethoven 5 example: pitches, rests, beats and cumulative timing', () => {
    const { notes, durationSeconds } = parseTheme(BEETHOVEN_5)
    expect(notes).toHaveLength(10)
    expect(notes.map((n) => n.midi)).toEqual([null, 67, 67, 67, 63, null, 65, 65, 65, 62])
    expect(notes.map((n) => n.beats)).toEqual([0.5, 0.5, 0.5, 0.5, 2, 0.5, 0.5, 0.5, 0.5, 2])
    // 120 BPM: one beat is 0.5 s.
    expect(notes.map((n) => n.seconds)).toEqual([0.25, 0.25, 0.25, 0.25, 1, 0.25, 0.25, 0.25, 0.25, 1])
    expect(notes.map((n) => n.startSeconds)).toEqual([0, 0.25, 0.5, 0.75, 1, 2, 2.25, 2.5, 2.75, 3])
    expect(durationSeconds).toBe(4)
  })

  it('ignores bar lines, including ones glued to tokens, and tolerates odd whitespace', () => {
    const spaced = parseTheme(theme('  C4/4\n\tD4/4 |  E4/4 | F4/4  '))
    const glued = parseTheme(theme('C4/4 D4/4|E4/4|F4/4'))
    const bars = parseTheme(theme('| C4/4 D4/4 | E4/4 F4/4 |'))
    const midis = [60, 62, 64, 65]
    for (const parsed of [spaced, glued, bars]) {
      expect(parsed.notes.map((n) => n.midi)).toEqual(midis)
      expect(parsed.durationSeconds).toBe(2)
    }
  })

  it('gives every note value its length in beats, dotted values one and a half times', () => {
    const { notes } = parseTheme(theme('C4/1 C4/2 C4/4 C4/8 C4/16 C4/32 C4/1. C4/2. C4/4. C4/8. C4/16. C4/32.'))
    expect(notes.map((n) => n.beats)).toEqual([4, 2, 1, 0.5, 0.25, 0.125, 6, 3, 1.5, 0.75, 0.375, 0.1875])
  })

  it('keeps rests silent but lets them take time', () => {
    const { notes, durationSeconds } = parseTheme(theme('R/4 C4/4 R/2. C4/8'))
    expect(notes[0]).toEqual({ midi: null, beats: 1, startSeconds: 0, seconds: 0.5 })
    expect(notes[1].startSeconds).toBe(0.5)
    expect(notes[2]).toEqual({ midi: null, beats: 3, startSeconds: 1, seconds: 1.5 })
    expect(notes[3].startSeconds).toBe(2.5)
    expect(durationSeconds).toBe(2.75)
  })

  it('reads accidentals and octaves in scientific pitch', () => {
    const { notes } = parseTheme(theme('C4/4 C#4/4 Db4/4 B3/4 Bb3/4 B#3/4 Cb4/4 A4/4 C0/4 G8/4 F#5/4 Eb2/4'))
    expect(notes.map((n) => n.midi)).toEqual([60, 61, 61, 59, 58, 60, 59, 69, 12, 115, 78, 39])
  })

  it('scales seconds with tempo: quarter note = 60 / tempo seconds', () => {
    const slow = parseTheme(theme('C4/4 D4/8 E4/2.', 60))
    const fast = parseTheme(theme('C4/4 D4/8 E4/2.', 180))
    expect(slow.notes.map((n) => n.seconds)).toEqual([1, 0.5, 3])
    expect(slow.durationSeconds).toBe(4.5)
    expect(fast.notes.map((n) => n.seconds).map((s) => Number(s.toFixed(6)))).toEqual([1 / 3, 1 / 6, 1].map((s) => Number(s.toFixed(6))))
    expect(fast.durationSeconds).toBeCloseTo(1.5, 9)
    // Beats are independent of tempo.
    expect(slow.notes.map((n) => n.beats)).toEqual(fast.notes.map((n) => n.beats))
  })

  it.each([
    ['H4/4', 'unknown letter'],
    ['c4/4', 'lowercase pitch'],
    ['C4/3', 'value not a power of two'],
    ['C4/64', 'value too small'],
    ['C4', 'missing value'],
    ['C4/4..', 'double dot'],
    ['C4/.4', 'misplaced dot'],
    ['C9/4', 'octave out of range'],
    ['Cx4/4', 'bad accidental'],
    ['R4/4', 'rest with an octave'],
    ['r/4', 'lowercase rest'],
    ['C4/4,', 'trailing punctuation'],
  ])('throws a clear error on the bad token %s (%s)', (bad) => {
    const notes = `C4/4 ${bad} E4/4`
    expect(() => parseTheme(theme(notes))).toThrow(/Bad theme token/)
    expect(() => parseTheme(theme(notes))).toThrow(bad)
    // The position is reported (1-based) so an editor can find it.
    expect(() => parseTheme(theme(notes))).toThrow(/position 2/)
  })

  it('throws when there are no notes at all', () => {
    expect(() => parseTheme(theme(''))).toThrow(/no notes/)
    expect(() => parseTheme(theme('  |  | '))).toThrow(/no notes/)
  })

  it('throws on a bad tempo', () => {
    expect(() => parseTheme(theme('C4/4', 0))).toThrow(/tempo/)
    expect(() => parseTheme(theme('C4/4', -60))).toThrow(/tempo/)
    expect(() => parseTheme(theme('C4/4', Number.NaN))).toThrow(/tempo/)
  })

  it('does not mutate the theme it is given', () => {
    const t = Object.freeze({ notes: 'C4/4 | D4/4', tempo: 90 })
    parseTheme(t)
    expect(t).toEqual({ notes: 'C4/4 | D4/4', tempo: 90 })
  })
})

describe('helpers', () => {
  it('tokenizeTheme drops bar lines and empty tokens', () => {
    expect(tokenizeTheme('R/8 G4/8 | G4/8|Eb4/2 |')).toEqual(['R/8', 'G4/8', 'G4/8', 'Eb4/2'])
    expect(tokenizeTheme('')).toEqual([])
  })

  it('parseToken returns pitch and beats and throws on rubbish', () => {
    expect(parseToken('Eb4/2.')).toEqual({ midi: 63, beats: 3 })
    expect(parseToken('R/16')).toEqual({ midi: null, beats: 0.25 })
    expect(() => parseToken('nonsense')).toThrow(/Bad theme token "nonsense"/)
  })

  it('pitchToMidi anchors middle C at 60 and A4 at 69', () => {
    expect(pitchToMidi('C4')).toBe(60)
    expect(pitchToMidi('A4')).toBe(69)
    expect(pitchToMidi('C5')).toBe(72)
    expect(pitchToMidi('Ab3')).toBe(56)
    expect(() => pitchToMidi('C')).toThrow(/Bad pitch/)
  })

  it('midiToFrequency uses A4 = 440 Hz equal temperament', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(81)).toBeCloseTo(880, 9)
    expect(midiToFrequency(57)).toBeCloseTo(220, 9)
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3)
    expect(midiToFrequency(70) / midiToFrequency(69)).toBeCloseTo(Math.pow(2, 1 / 12), 9)
  })
})

describe('shipped content', () => {
  it('every theme in the content bundle parses and has a sensible length', () => {
    const themed = getContent().items.filter((item) => item.theme)
    for (const item of themed) {
      const parsed = parseTheme(item.theme!)
      expect(parsed.notes.length, item.id).toBeGreaterThan(0)
      expect(parsed.durationSeconds, item.id).toBeGreaterThan(0)
      expect(parsed.durationSeconds, item.id).toBeLessThan(60)
      for (const note of parsed.notes) expect(note.midi === null || (note.midi >= 12 && note.midi <= 120), item.id).toBe(true)
    }
  })
})
