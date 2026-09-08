/**
 * The ten ranks, ascending, with the thresholds from CLAUDE.md ("Grading,
 * meters, streaks, ranks"). Items are Collection items acquired; cities are
 * Grand Tour cities completed. A city requirement carries forward to the ranks
 * above it (a Baronet has necessarily been a Knight), so the table is monotone
 * and `rankFor` can walk it from the bottom.
 *
 * Rank 2 is the one threshold not expressed in items or cities: it needs a
 * first completed session, which `rankFor` reads from `stats.sessions`.
 *
 * The first five ranks are not peers; the peerage begins at Baron. The plain
 * style uses the bare rank word where the masculine and feminine forms differ.
 */
import type { RankDefinition, RankLevel, TitleStyle } from './types'

/** Sessions completed needed for rank 2 and above. */
export const RANK_2_MIN_SESSIONS = 1

function rank(
  level: RankLevel,
  names: [masculine: string, feminine: string, plain: string],
  items: number,
  cities: number,
  peer: boolean,
): RankDefinition {
  return { level, names: { masculine: names[0], feminine: names[1], plain: names[2] }, items, cities, peer }
}

export const RANKS: RankDefinition[] = [
  rank(1, ['Commoner', 'Commoner', 'Commoner'], 0, 0, false),
  rank(2, ['Gentleman', 'Gentlewoman', 'Gentle'], 0, 0, false),
  rank(3, ['Esquire', 'Esquire', 'Esquire'], 25, 0, false),
  rank(4, ['Knight', 'Dame', 'Knight'], 60, 1, false),
  rank(5, ['Baronet', 'Baronet', 'Baronet'], 120, 1, false),
  rank(6, ['Baron', 'Baroness', 'Baron'], 200, 2, true),
  rank(7, ['Viscount', 'Viscountess', 'Viscount'], 320, 2, true),
  rank(8, ['Earl', 'Countess', 'Earl'], 480, 4, true),
  rank(9, ['Marquess', 'Marchioness', 'Marquess'], 700, 4, true),
  rank(10, ['Duke', 'Duchess', 'Duke'], 1000, 4, true),
]

export interface RankStats {
  /** Items in the Collection. */
  acquired: number
  /** Grand Tour cities completed. */
  cities: number
  /** Sessions completed, all time. */
  sessions: number
}

/** True when the stats satisfy this one rank's own thresholds. */
export function meetsRank(rank: RankDefinition, stats: RankStats): boolean {
  if (rank.level >= 2 && stats.sessions < RANK_2_MIN_SESSIONS) return false
  return stats.acquired >= rank.items && stats.cities >= rank.cities
}

/**
 * The highest rank whose thresholds, and those of every rank beneath it, are
 * met. Never skips a rank: the walk stops at the first unmet threshold.
 */
export function rankFor(stats: RankStats): RankDefinition {
  let current = RANKS[0]
  for (const candidate of RANKS) {
    if (!meetsRank(candidate, stats)) break
    current = candidate
  }
  return current
}

export function rankByLevel(level: RankLevel): RankDefinition {
  return RANKS[level - 1]
}

export function rankName(rank: RankDefinition, style: TitleStyle): string {
  return rank.names[style]
}

/** The rank above `level`, or null at the top. */
export function nextRank(level: RankLevel): RankDefinition | null {
  return RANKS[level] ?? null
}
