import { describe, expect, it } from 'vitest'
import type { Item } from '../content/types'
import { answerFor, optionsFor, plausibleYears, redactNames, REDACTION } from './distractors'
import { mulberry32 } from './types'

function work(id: string, discipline: Item['discipline'], creator: string, year: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    discipline,
    kind: 'work',
    title: `Title of ${id}`,
    city: 'testville',
    difficulty: 1,
    era: 'Era',
    year,
    creator,
    facts: [`${creator} made ${id}.`],
    remark: 'A sayable remark about this work, long enough to pass the validator.',
    gaffe: 'The gaffe.',
    links: [],
    tags: [],
    sources: ['A source'],
    reviewed_by: null,
    ...extra,
  } as Item
}

const pool: Item[] = [
  work('music.w1', 'music', 'Composer One', 1800),
  work('music.w2', 'music', 'Composer Two', 1810),
  work('music.w3', 'music', 'Composer Three', 1820),
  work('music.w4', 'music', 'Composer Four', 1830),
  work('opera.w5', 'opera', 'Composer Five', 1840),
  work('art.w6', 'art', 'Painter Six', 1850),
  {
    id: 'history.episode.e1',
    discipline: 'history',
    kind: 'episode',
    title: 'The Event',
    city: 'testville',
    difficulty: 1,
    era: 'Era',
    year: 1789,
    year_end: 1794,
    facts: ['It happened.'],
    remark: 'A sayable remark about this event, long enough to pass the validator.',
    gaffe: 'The gaffe.',
    links: [],
    tags: [],
    sources: ['A source'],
    reviewed_by: null,
  },
]

const labels = (r: ReturnType<typeof optionsFor>) => r.options.map((o) => o.label)

describe('optionsFor', () => {
  it('uses authored distractors first and includes the correct answer once', () => {
    const item = work('music.w1', 'music', 'Composer One', 1800, {
      distractors: { creator: ['Alpha', 'Beta', 'Gamma'] },
    })
    const r = optionsFor(item, 'creator', pool, mulberry32(1))
    expect(r.options).toHaveLength(4)
    expect(labels(r).sort()).toEqual(['Alpha', 'Beta', 'Composer One', 'Gamma'])
    const correct = r.options.find((o) => o.id === r.correctOptionId)
    expect(correct?.label).toBe('Composer One')
    expect(new Set(r.options.map((o) => o.id)).size).toBe(4)
  })

  it('never duplicates the correct answer, even when an authored distractor repeats it', () => {
    const item = work('music.w1', 'music', 'Composer One', 1800, {
      distractors: { creator: ['composer one ', 'Beta', 'Gamma'] },
    })
    const r = optionsFor(item, 'creator', pool, mulberry32(2))
    const lower = labels(r).map((l) => l.trim().toLowerCase())
    expect(lower.filter((l) => l === 'composer one')).toHaveLength(1)
    expect(r.options).toHaveLength(4)
  })

  it('falls back to other items of the same discipline and kind before widening', () => {
    const item = pool[0]
    const r = optionsFor(item, 'creator', pool, mulberry32(3))
    expect(r.options).toHaveLength(4)
    const wrong = labels(r).filter((l) => l !== 'Composer One')
    expect(wrong.every((l) => ['Composer Two', 'Composer Three', 'Composer Four'].includes(l))).toBe(true)
  })

  it('widens to other kinds and disciplines when the narrow pool is short', () => {
    const item = pool[5] // the only art work
    const r = optionsFor(item, 'creator', pool, mulberry32(4))
    expect(r.options).toHaveLength(4)
    expect(labels(r)).toContain('Painter Six')
    expect(new Set(labels(r)).size).toBe(4)
  })

  it('generates plausible years for episodes without authored years, outside the item span', () => {
    const item = pool[6]
    const r = optionsFor(item, 'year', pool, mulberry32(5))
    expect(r.options).toHaveLength(4)
    expect(labels(r)).toContain('1789')
    const years = labels(r).map(Number)
    expect(new Set(years).size).toBe(4)
    for (const y of years) {
      if (y === 1789) continue
      expect(y >= 1789 && y <= 1794).toBe(false)
      expect(Math.abs(y - 1789)).toBeLessThanOrEqual(40)
    }
  })

  it('uses authored years when present', () => {
    const item = { ...pool[6], distractors: { year: [1776, 1804, 1815] } } as Item
    const r = optionsFor(item, 'year', pool, mulberry32(6))
    expect(labels(r).sort()).toEqual(['1776', '1789', '1804', '1815'])
  })

  it('is deterministic for a given PRNG seed', () => {
    const a = optionsFor(pool[0], 'creator', pool, mulberry32(42))
    const b = optionsFor(pool[0], 'creator', pool, mulberry32(42))
    expect(a).toEqual(b)
    const c = optionsFor(pool[0], 'creator', pool, mulberry32(43))
    expect(c.options.map((o) => o.label).sort()).toEqual(a.options.map((o) => o.label).sort())
  })

  it('throws when the item cannot answer the question', () => {
    expect(() => optionsFor(pool[0], 'term', pool, mulberry32(1))).toThrow(/no answer/)
  })
})

describe('answerFor', () => {
  it('lets a creator item answer for its own name', () => {
    const creator = { ...pool[0], kind: 'creator', creator: undefined, title: 'Composer Solo' } as unknown as Item
    expect(answerFor(creator, 'creator')).toBe('Composer Solo')
    expect(answerFor(creator, 'person')).toBe('Composer Solo')
    expect(answerFor(pool[0], 'person')).toBeUndefined()
  })
})

describe('plausibleYears', () => {
  it('scales offsets up for approximate years', () => {
    const item = { ...pool[6], year: 1200, year_end: undefined, year_approx: true } as Item
    const years = plausibleYears(item, 3, new Set(), mulberry32(7)).map(Number)
    expect(years).toHaveLength(3)
    for (const y of years) expect(Math.abs(y - 1200) % 5).toBe(0)
  })
})

describe('redactNames', () => {
  it('redacts the full name, its parts and possessives, case-insensitively', () => {
    const out = redactNames("Ludwig van Beethoven wrote it; beethoven's deafness was total. LUDWIG knew, and the van waited.", ['Ludwig van Beethoven'])
    expect(out).not.toMatch(/beethoven/i)
    expect(out).not.toMatch(/ludwig/i)
    expect(out).toContain(`${REDACTION}'s deafness`)
    expect(out).toContain('the van waited')
  })

  it('leaves particles, short parts and longer words alone', () => {
    const out = redactNames('J. M. W. Turner was Turnerian; the Turner Prize is named for him.', ['J. M. W. Turner'])
    expect(out).toBe(`${REDACTION} was Turnerian; the ${REDACTION} Prize is named for him.`)
    // Initials on their own are too short to redact.
    expect(redactNames('Signed J. M. W. in the corner.', ['J. M. W. Turner'])).toBe('Signed J. M. W. in the corner.')
  })

  it('handles diacritics and collapses adjacent redactions', () => {
    const out = redactNames('Élisabeth Vigée Le Brun painted Élisabeth often.', ['Élisabeth Vigée Le Brun'])
    expect(out).toBe(`${REDACTION} painted ${REDACTION} often.`)
  })

  it('ignores empty names and returns the text unchanged when nothing matches', () => {
    expect(redactNames('Nothing here.', ['', '  ', 'Nobody'])).toBe('Nothing here.')
  })
})
