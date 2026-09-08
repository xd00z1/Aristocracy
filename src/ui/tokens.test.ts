/**
 * The palette has to be readable, not just tasteful.
 *
 * ink-mute carries real copy on every screen (meter labels, the Tour's city
 * list, the Estate's counts, the slot counter) and gilt carries the reward
 * figures and every focus ring, so both are held to WCAG AA against the three
 * grounds they land on. Change a token in src/index.css and this is where it
 * is checked.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

function token(name: string): string {
  const match = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`--color-${name} is not defined in src/index.css`)
  return match[1]
}

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = (hex.replace('#', '').match(/../g) as string[])
    .map((pair) => parseInt(pair, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const GROUNDS = ['ivory', 'parchment', 'ivory-deep'] as const

describe('the palette', () => {
  it('reaches AA for body text in every ink on every ground', () => {
    for (const ink of ['ink', 'ink-soft', 'ink-mute']) {
      for (const ground of GROUNDS) {
        const ratio = contrast(token(ink), token(ground))
        expect(ratio, `${ink} on ${ground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('reaches AA for gilt as text on the grounds it is written on', () => {
    // Meter values, the Estate's lit rooms, the Tour's completed cities.
    for (const ground of ['ivory', 'parchment'] as const) {
      const ratio = contrast(token('gilt'), token(ground))
      expect(ratio, `gilt on ${ground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('reaches the 3:1 a focus ring needs against its offset and the page behind it', () => {
    for (const ground of GROUNDS) {
      const ratio = contrast(token('gilt'), token(ground))
      expect(ratio, `the focus ring on ${ground} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps oxblood readable for errors and emphasis', () => {
    for (const ground of GROUNDS) {
      expect(contrast(token('oxblood'), token(ground))).toBeGreaterThanOrEqual(4.5)
    }
    // Oxblood is also a button fill with ivory text on it.
    expect(contrast(token('ivory'), token('oxblood'))).toBeGreaterThanOrEqual(4.5)
  })

  it('asks for stillness when the reader has', () => {
    expect(CSS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })
})
