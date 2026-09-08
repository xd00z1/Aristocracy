/**
 * Types of the compiled content bundle (src/content/generated/content.json),
 * produced by scripts/build-content.ts from content/*.yaml.
 */
import type { City, Discipline, Item, Scenario } from './schema'

export type { City, Discipline, Item, Scenario }
export type {
  ApocryphaItem,
  CreatorItem,
  Distractors,
  EpisodeItem,
  ImageMedia,
  ItemKind,
  Media,
  PersonItem,
  RemarkOption,
  RemarkOptionKind,
  TermItem,
  Theme,
  Verdict,
  WorkItem,
} from './schema'

export interface Lesson {
  id: string // `${cityId}.${order}`
  cityId: string
  order: number // 1-based
  title: string
  /** New items introduced in this lesson, in teaching order. */
  itemIds: string[]
  /** Remark scenarios available to this lesson (may be shared across lessons). */
  scenarioIds: string[]
}

export interface MediaIndexEntry {
  /** Path under /media/img, present only when the file exists on disk at build time. */
  file: string
  width?: number
  height?: number
}

export interface ContentBundle {
  version: 1
  builtAt: string
  cities: City[]
  lessons: Lesson[]
  items: Item[]
  scenarios: Scenario[]
  /** itemId -> image file actually present in public/media/img at build time. */
  mediaIndex: Record<string, MediaIndexEntry>
  stats: {
    items: number
    scenarios: number
    byDiscipline: Record<Discipline, number>
    byCity: Record<string, number>
    withTheme: number
    withImage: number
  }
}
