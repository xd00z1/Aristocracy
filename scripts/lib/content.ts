/**
 * Shared loader for content/*.yaml used by validate-content.ts and
 * build-content.ts. Pure functions; no side effects beyond reading files.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from 'yaml'
import {
  CitiesFileSchema,
  ItemFileSchema,
  ScenarioFileSchema,
  THEME_TOKEN,
  type City,
  type Item,
  type Scenario,
} from '../../src/content/schema'
import type { Lesson, MediaIndexEntry } from '../../src/content/types'

export interface LoadedContent {
  cities: City[]
  items: Item[]
  scenarios: Scenario[]
  /** file path -> ids declared there, for error messages */
  origins: Map<string, string>
}

export interface Problem {
  level: 'error' | 'warning'
  where: string
  message: string
}

export const ROOT = join(import.meta.dirname ?? process.cwd(), '..', '..')
export const CONTENT_DIR = join(ROOT, 'content')
export const MEDIA_DIR = join(ROOT, 'public', 'media', 'img')
export const GENERATED = join(ROOT, 'src', 'content', 'generated', 'content.json')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.ya?ml$/.test(name)) out.push(p)
  }
  return out.sort()
}

function formatZodError(err: unknown): string {
  const e = err as { issues?: Array<{ path: Array<string | number>; message: string }> }
  if (!e.issues) return String(err)
  return e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

export function loadContent(): { content: LoadedContent; problems: Problem[] } {
  const problems: Problem[] = []
  const origins = new Map<string, string>()

  const citiesPath = join(CONTENT_DIR, 'cities.yaml')
  let cities: City[] = []
  try {
    cities = CitiesFileSchema.parse(parse(readFileSync(citiesPath, 'utf8'))).cities
  } catch (err) {
    problems.push({ level: 'error', where: 'content/cities.yaml', message: formatZodError(err) })
  }

  const items: Item[] = []
  for (const file of walk(join(CONTENT_DIR, 'items'))) {
    const where = relative(ROOT, file)
    let raw: unknown
    try {
      raw = parse(readFileSync(file, 'utf8'))
    } catch (err) {
      problems.push({ level: 'error', where, message: `YAML parse error: ${(err as Error).message}` })
      continue
    }
    // Validate item by item so one bad item reports its own id instead of an index.
    const list = (raw as { items?: unknown[] })?.items
    if (!Array.isArray(list) || list.length === 0) {
      problems.push({ level: 'error', where, message: 'file must contain a non-empty `items` list' })
      continue
    }
    list.forEach((entry, idx) => {
      const res = ItemFileSchema.shape.items.element.safeParse(entry)
      const label = (entry as { id?: string })?.id ?? `items[${idx}]`
      if (!res.success) {
        problems.push({ level: 'error', where: `${where} › ${label}`, message: formatZodError(res.error) })
        return
      }
      items.push(res.data)
      origins.set(res.data.id, where)
    })
  }

  const scenarios: Scenario[] = []
  for (const file of walk(join(CONTENT_DIR, 'scenarios'))) {
    const where = relative(ROOT, file)
    let raw: unknown
    try {
      raw = parse(readFileSync(file, 'utf8'))
    } catch (err) {
      problems.push({ level: 'error', where, message: `YAML parse error: ${(err as Error).message}` })
      continue
    }
    const list = (raw as { scenarios?: unknown[] })?.scenarios
    if (!Array.isArray(list) || list.length === 0) {
      problems.push({ level: 'error', where, message: 'file must contain a non-empty `scenarios` list' })
      continue
    }
    list.forEach((entry, idx) => {
      const res = ScenarioFileSchema.shape.scenarios.element.safeParse(entry)
      const label = (entry as { id?: string })?.id ?? `scenarios[${idx}]`
      if (!res.success) {
        problems.push({ level: 'error', where: `${where} › ${label}`, message: formatZodError(res.error) })
        return
      }
      scenarios.push(res.data)
      origins.set(res.data.id, where)
    })
  }

  return { content: { cities, items, scenarios, origins }, problems }
}

/** The runtime's option key: trimmed, lower-cased, inner whitespace collapsed. */
function normaliseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when a distractor list holds the correct answer, however it is spaced or cased. */
function collides(list: string[] | undefined, answer: string | undefined): boolean {
  if (!list || answer === undefined || answer === '') return false
  const key = normaliseLabel(answer)
  return list.some((d) => normaliseLabel(d) === key)
}

/** Cross-item rules that the schema alone cannot express. */
export function checkContent(c: LoadedContent): Problem[] {
  const problems: Problem[] = []
  const cityIds = new Set(c.cities.map((x) => x.id))
  const itemIds = new Set<string>()
  const err = (id: string, message: string) => problems.push({ level: 'error', where: `${c.origins.get(id) ?? '?'} › ${id}`, message })
  const warn = (id: string, message: string) => problems.push({ level: 'warning', where: `${c.origins.get(id) ?? '?'} › ${id}`, message })

  for (const item of c.items) {
    if (itemIds.has(item.id)) err(item.id, 'duplicate id')
    itemIds.add(item.id)
    if (!item.id.startsWith(item.discipline + '.')) err(item.id, `id must start with "${item.discipline}."`)
    if (!cityIds.has(item.city)) err(item.id, `unknown city "${item.city}"`)
    if (item.theme) {
      const tokens = item.theme.notes.split(/\s+/).filter((t) => t && t !== '|')
      const bad = tokens.filter((t) => !THEME_TOKEN.test(t))
      if (bad.length) err(item.id, `theme has invalid tokens: ${bad.join(' ')}`)
      if (tokens.length < 4) err(item.id, 'theme must have at least 4 notes')
      if (item.discipline !== 'music' && item.discipline !== 'opera') warn(item.id, 'theme on a non-musical item')
    }
    if (item.discipline === 'history' && item.links.length === 0) err(item.id, 'history items must link to at least one item in another discipline')
    if (item.remark.length < 40) warn(item.id, 'remark is very short; it should be a sayable sentence')
    if (item.remark.length > 320) warn(item.id, 'remark is long; one sentence, two at most')
    if (item.kind === 'work' && !item.creator) err(item.id, 'works need a creator')
    const d = item.distractors
    // Compared the way the runtime compares them (src/engine/distractors.ts),
    // so a distractor differing only in case or spacing is caught here rather
    // than silently dropped from the options at play time.
    if (collides(d?.creator, item.creator)) err(item.id, 'distractors.creator contains the correct creator')
    if (collides(d?.title, item.title)) err(item.id, 'distractors.title contains the correct title')
    if (collides(d?.era, item.era)) err(item.id, 'distractors.era contains the correct era')
    if (item.year !== undefined && d?.year?.includes(item.year)) err(item.id, 'distractors.year contains the correct year')
    if (item.kind === 'term' && collides(d?.term, item.definition)) err(item.id, 'distractors.term contains the correct definition')
    // The session builder asks "who is this?" of creators as well as persons,
    // and both answer with their own title.
    if ((item.kind === 'person' || item.kind === 'creator') && collides(d?.person, item.title)) {
      err(item.id, 'distractors.person contains the correct person')
    }
    if (item.year !== undefined && item.year_end !== undefined && item.year_end < item.year) err(item.id, 'year_end before year')
    if (item.media?.image && !item.media.image.commons && !item.media.image.file) err(item.id, 'media.image needs commons or file')
  }

  for (const item of c.items) {
    for (const l of item.links) {
      if (!itemIds.has(l)) err(item.id, `link to unknown item "${l}"`)
      else if (l === item.id) err(item.id, 'item links to itself')
    }
    if (item.discipline === 'history') {
      const cross = item.links.some((l) => !l.startsWith('history.'))
      if (item.links.length && !cross) warn(item.id, 'history item links only to other history items; it should reach another discipline')
    }
  }

  const scenarioIds = new Set<string>()
  for (const s of c.scenarios) {
    if (scenarioIds.has(s.id)) err(s.id, 'duplicate scenario id')
    scenarioIds.add(s.id)
    if (!cityIds.has(s.city)) err(s.id, `unknown city "${s.city}"`)
    const kinds = s.options.map((o) => o.kind).sort().join(',')
    if (kinds !== 'correct,gaffe,wrong') err(s.id, 'scenario needs exactly one correct, one wrong and one gaffe option')
    for (const l of s.links) if (!itemIds.has(l)) err(s.id, `link to unknown item "${l}"`)
  }

  return problems
}

/** Deterministic lesson generation: difficulty rises across lessons, disciplines interleave within them. */
export function generateLessons(c: LoadedContent): Lesson[] {
  const lessons: Lesson[] = []
  for (const city of [...c.cities].sort((a, b) => a.order - b.order)) {
    const cityItems = c.items.filter((i) => i.city === city.id)
    if (cityItems.length === 0) continue
    const byDiscipline = new Map<string, Item[]>()
    for (const it of cityItems) {
      const arr = byDiscipline.get(it.discipline) ?? []
      arr.push(it)
      byDiscipline.set(it.discipline, arr)
    }
    const queues = [...byDiscipline.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, arr]) => arr.sort((x, y) => x.difficulty - y.difficulty || x.id.localeCompare(y.id)))
    const ordered: Item[] = []
    let remaining = cityItems.length
    while (remaining > 0) {
      for (const q of queues) {
        const next = q.shift()
        if (next) {
          ordered.push(next)
          remaining--
        }
      }
    }
    const size = city.lesson_size
    const chunks: Item[][] = []
    for (let i = 0; i < ordered.length; i += size) chunks.push(ordered.slice(i, i + size))
    if (chunks.length > 1 && chunks[chunks.length - 1].length < 3) {
      const tail = chunks.pop()!
      chunks[chunks.length - 1].push(...tail)
    }
    const cityScenarios = c.scenarios.filter((s) => s.city === city.id).sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id))
    chunks.forEach((chunk, idx) => {
      const scenarioIds = cityScenarios.length
        ? cityScenarios.filter((_, sIdx) => sIdx % chunks.length === idx % chunks.length || cityScenarios.length < chunks.length).map((s) => s.id)
        : []
      // Every lesson gets at least one scenario when the city has any.
      if (cityScenarios.length && scenarioIds.length === 0) scenarioIds.push(cityScenarios[idx % cityScenarios.length].id)
      lessons.push({
        id: `${city.id}.${idx + 1}`,
        cityId: city.id,
        order: idx + 1,
        title: `Lesson ${idx + 1}`,
        itemIds: chunk.map((i) => i.id),
        scenarioIds: [...new Set(scenarioIds)],
      })
    })
  }
  return lessons
}

export function imageFileFor(item: Item): string | null {
  const img = item.media?.image
  if (!img) return null
  return img.file ?? `${item.id}.jpg`
}

export function buildMediaIndex(c: LoadedContent): Record<string, MediaIndexEntry> {
  const index: Record<string, MediaIndexEntry> = {}
  for (const item of c.items) {
    const file = imageFileFor(item)
    if (file && existsSync(join(MEDIA_DIR, file))) index[item.id] = { file }
  }
  return index
}
