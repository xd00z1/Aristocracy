/**
 * Theme notation parser for Drop the Needle.
 *
 * Notation (see THEME_TOKEN in src/content/schema.ts): tokens are
 * `<pitch>/<value>` or `R/<value>` for a rest, separated by whitespace. Pitch
 * is scientific (C4 = middle C = MIDI 60) with `#` and `b` accidentals; value
 * is 1, 2, 4, 8, 16 or 32, optionally dotted (`4.`). Bar lines `|` are
 * ignored. `tempo` is quarter-note beats per minute.
 */
import { THEME_TOKEN, type Theme } from '../content/schema'

export interface ParsedNote {
  /** MIDI note number, or null for a rest. */
  midi: number | null
  /** Length in beats; a quarter note is one beat. */
  beats: number
  /** Offset from the start of the theme, in seconds at the theme's tempo. */
  startSeconds: number
  /** Length in seconds at the theme's tempo. */
  seconds: number
}

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const ACCIDENTAL: Record<string, number> = { '': 0, '#': 1, b: -1 }
/** Beats per note value: a whole note is four beats, a quarter is one. */
const VALUE_BEATS: Record<string, number> = { '1': 4, '2': 2, '4': 1, '8': 0.5, '16': 0.25, '32': 0.125 }

/** Same grammar as THEME_TOKEN, with capture groups: pitch letter, accidental, octave, value, dot. */
const TOKEN_PARTS = /^(?:R|([A-G])([#b]?)([0-8]))\/(1|2|4|8|16|32)(\.?)$/

/** Split a notes string into tokens, dropping bar lines and surplus whitespace. */
export function tokenizeTheme(notes: string): string[] {
  return notes
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

/** Scientific pitch to MIDI: C4 = 60, A4 = 69. Accepts `#` and `b`. Throws on a bad pitch. */
export function pitchToMidi(pitch: string): number {
  const m = /^([A-G])([#b]?)([0-8])$/.exec(pitch)
  if (!m) throw new Error(`Bad pitch "${pitch}": expected a letter A-G, optional # or b, and an octave 0-8 (C4 is middle C)`)
  const [, letter, accidental, octave] = m
  return (Number(octave) + 1) * 12 + PITCH_CLASS[letter] + ACCIDENTAL[accidental]
}

/** Parse a single token into a pitch and a length in beats. Throws on a bad token. */
export function parseToken(token: string, index?: number): { midi: number | null; beats: number } {
  const where = index === undefined ? '' : ` at position ${index + 1}`
  if (!THEME_TOKEN.test(token)) {
    throw new Error(
      `Bad theme token "${token}"${where}: expected <pitch>/<value> or R/<value>, e.g. G4/8, Eb4/2. or R/4 (values 1, 2, 4, 8, 16, 32, optionally dotted)`,
    )
  }
  const m = TOKEN_PARTS.exec(token)
  if (!m) throw new Error(`Bad theme token "${token}"${where}`)
  const [, letter, accidental, octave, value, dot] = m
  const beats = VALUE_BEATS[value] * (dot ? 1.5 : 1)
  const midi = letter === undefined ? null : pitchToMidi(`${letter}${accidental}${octave}`)
  return { midi, beats }
}

/**
 * Parse a theme into timed notes. Seconds follow the theme's tempo (quarter
 * note = one beat = 60 / tempo seconds). Throws a descriptive Error on a bad
 * token, a bad tempo, or a theme with no notes.
 */
export function parseTheme(theme: Theme): { notes: ParsedNote[]; durationSeconds: number } {
  const tempo = theme.tempo
  if (typeof tempo !== 'number' || !Number.isFinite(tempo) || tempo <= 0) {
    throw new Error(`Bad theme tempo ${String(tempo)}: expected quarter-note beats per minute`)
  }
  const tokens = tokenizeTheme(theme.notes ?? '')
  if (tokens.length === 0) throw new Error('Theme has no notes')

  const secondsPerBeat = 60 / tempo
  let cursor = 0
  const notes: ParsedNote[] = tokens.map((token, index) => {
    const { midi, beats } = parseToken(token, index)
    const seconds = beats * secondsPerBeat
    const note: ParsedNote = { midi, beats, startSeconds: cursor, seconds }
    cursor += seconds
    return note
  })
  return { notes, durationSeconds: cursor }
}

/** Equal temperament, A4 (MIDI 69) = 440 Hz. */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
