import { describe, expect, it } from 'vitest'
import { RANKS, meetsRank, nextRank, rankByLevel, rankFor, rankName } from './ranks'
import type { RankLevel, TitleStyle } from './types'

describe('RANKS', () => {
  it('has ten entries, levels 1..10 in order', () => {
    expect(RANKS).toHaveLength(10)
    RANKS.forEach((r, i) => expect(r.level).toBe(i + 1))
  })

  it.each([
    [1, 'Commoner', 'Commoner', 'Commoner', 0, 0, false],
    [2, 'Gentleman', 'Gentlewoman', 'Gentle', 0, 0, false],
    [3, 'Esquire', 'Esquire', 'Esquire', 25, 0, false],
    [4, 'Knight', 'Dame', 'Knight', 60, 1, false],
    [5, 'Baronet', 'Baronet', 'Baronet', 120, 1, false],
    [6, 'Baron', 'Baroness', 'Baron', 200, 2, true],
    [7, 'Viscount', 'Viscountess', 'Viscount', 320, 2, true],
    [8, 'Earl', 'Countess', 'Earl', 480, 4, true],
    [9, 'Marquess', 'Marchioness', 'Marquess', 700, 4, true],
    [10, 'Duke', 'Duchess', 'Duke', 1000, 4, true],
  ] as Array<[RankLevel, string, string, string, number, number, boolean]>)(
    'level %i is %s / %s / %s at %i items and %i cities',
    (level, masculine, feminine, plain, items, cities, peer) => {
      const r = rankByLevel(level)
      expect(r.names).toEqual({ masculine, feminine, plain })
      expect(r.items).toBe(items)
      expect(r.cities).toBe(cities)
      expect(r.peer).toBe(peer)
    },
  )

  it('thresholds never decrease as rank rises', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].items).toBeGreaterThanOrEqual(RANKS[i - 1].items)
      expect(RANKS[i].cities).toBeGreaterThanOrEqual(RANKS[i - 1].cities)
    }
  })

  it('the first five are not peers and the rest are', () => {
    expect(RANKS.slice(0, 5).every((r) => !r.peer)).toBe(true)
    expect(RANKS.slice(5).every((r) => r.peer)).toBe(true)
  })
})

describe('rankFor', () => {
  it.each([
    [{ acquired: 0, cities: 0, sessions: 0 }, 1],
    [{ acquired: 0, cities: 0, sessions: 1 }, 2],
    [{ acquired: 24, cities: 0, sessions: 5 }, 2],
    [{ acquired: 25, cities: 0, sessions: 0 }, 1], // no session yet: still a Commoner
    [{ acquired: 25, cities: 0, sessions: 1 }, 3],
    [{ acquired: 59, cities: 1, sessions: 1 }, 3],
    [{ acquired: 60, cities: 0, sessions: 1 }, 3], // Knight needs a completed city
    [{ acquired: 60, cities: 1, sessions: 1 }, 4],
    [{ acquired: 119, cities: 1, sessions: 1 }, 4],
    [{ acquired: 120, cities: 1, sessions: 1 }, 5],
    [{ acquired: 200, cities: 1, sessions: 1 }, 5], // Baron needs two cities
    [{ acquired: 200, cities: 2, sessions: 1 }, 6],
    [{ acquired: 320, cities: 2, sessions: 1 }, 7],
    [{ acquired: 480, cities: 2, sessions: 1 }, 7], // Earl needs four cities
    [{ acquired: 480, cities: 4, sessions: 1 }, 8],
    [{ acquired: 700, cities: 4, sessions: 1 }, 9],
    [{ acquired: 999, cities: 4, sessions: 1 }, 9],
    [{ acquired: 1000, cities: 4, sessions: 1 }, 10],
    [{ acquired: 5000, cities: 12, sessions: 400 }, 10],
  ])('%o is rank %i', (stats, level) => {
    expect(rankFor(stats).level).toBe(level)
  })

  it('never skips a rank whose threshold is unmet', () => {
    // 1000 items with only one city: Knight and Baronet are met, Baron is not.
    expect(rankFor({ acquired: 1000, cities: 1, sessions: 1 }).level).toBe(5)
    expect(meetsRank(rankByLevel(7), { acquired: 1000, cities: 1, sessions: 1 })).toBe(false)
  })
})

describe('rankName', () => {
  it.each([
    [2, 'masculine', 'Gentleman'],
    [2, 'feminine', 'Gentlewoman'],
    [2, 'plain', 'Gentle'],
    [4, 'feminine', 'Dame'],
    [8, 'feminine', 'Countess'],
    [8, 'plain', 'Earl'],
    [10, 'masculine', 'Duke'],
  ] as Array<[RankLevel, TitleStyle, string]>)('level %i in the %s style is %s', (level, style, name) => {
    expect(rankName(rankByLevel(level), style)).toBe(name)
  })
})

describe('nextRank', () => {
  it('returns the rank above, and null at the top', () => {
    expect(nextRank(1)?.level).toBe(2)
    expect(nextRank(9)?.level).toBe(10)
    expect(nextRank(10)).toBeNull()
  })

  it('chains from Commoner to Duke', () => {
    const seen: number[] = []
    let level: RankLevel | null = 1
    while (level) {
      seen.push(level)
      level = nextRank(level)?.level ?? null
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
