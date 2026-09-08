/**
 * Runtime access to the compiled content bundle. Import from here, never from
 * the generated JSON directly, so the shape can change in one place.
 */
import bundle from './generated/content.json'
import type { City, ContentBundle, Discipline, Item, Lesson, Scenario } from './types'

const content = bundle as unknown as ContentBundle

const itemById = new Map<string, Item>(content.items.map((i) => [i.id, i]))
const scenarioById = new Map<string, Scenario>(content.scenarios.map((s) => [s.id, s]))
const lessonById = new Map<string, Lesson>(content.lessons.map((l) => [l.id, l]))
const cityById = new Map<string, City>(content.cities.map((c) => [c.id, c]))

export function getContent(): ContentBundle {
  return content
}

export function getItem(id: string): Item | undefined {
  return itemById.get(id)
}

export function requireItem(id: string): Item {
  const item = itemById.get(id)
  if (!item) throw new Error(`Unknown item: ${id}`)
  return item
}

export function getScenario(id: string): Scenario | undefined {
  return scenarioById.get(id)
}

export function getLesson(id: string): Lesson | undefined {
  return lessonById.get(id)
}

export function getCity(id: string): City | undefined {
  return cityById.get(id)
}

export function citiesInOrder(): City[] {
  return [...content.cities].sort((a, b) => a.order - b.order)
}

export function lessonsForCity(cityId: string): Lesson[] {
  return content.lessons.filter((l) => l.cityId === cityId).sort((a, b) => a.order - b.order)
}

export function itemsForCity(cityId: string): Item[] {
  return content.items.filter((i) => i.city === cityId)
}

export function itemsForDiscipline(discipline: Discipline): Item[] {
  return content.items.filter((i) => i.discipline === discipline)
}

export function scenariosForCity(cityId: string): Scenario[] {
  return content.scenarios.filter((s) => s.city === cityId)
}

/** True when an image for the item exists on disk (see scripts/fetch-media.mjs). */
export function hasImage(itemId: string): boolean {
  return Boolean(content.mediaIndex[itemId])
}

/** URL for the item's image, or null when it has not been fetched. */
export function imageUrl(itemId: string): string | null {
  const entry = content.mediaIndex[itemId]
  return entry ? `/media/img/${entry.file}` : null
}

export function hasTheme(item: Item): boolean {
  return Boolean(item.theme)
}
