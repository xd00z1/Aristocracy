import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildMediaIndex, checkContent, generateLessons, GENERATED, loadContent } from './lib/content'
import type { ContentBundle } from '../src/content/types'
import { DISCIPLINES } from '../src/content/schema'

const { content, problems } = loadContent()
problems.push(...checkContent(content))
const errors = problems.filter((p) => p.level === 'error')
for (const p of errors) console.error(`ERROR ${p.where}: ${p.message}`)
if (errors.length) {
  console.error(`content build aborted: ${errors.length} error(s)`)
  process.exit(1)
}

const mediaIndex = buildMediaIndex(content)
const lessons = generateLessons(content)
const byDiscipline = Object.fromEntries(DISCIPLINES.map((d) => [d, 0])) as ContentBundle['stats']['byDiscipline']
const byCity: Record<string, number> = {}
for (const it of content.items) {
  byDiscipline[it.discipline]++
  byCity[it.city] = (byCity[it.city] ?? 0) + 1
}

const bundle: ContentBundle = {
  version: 1,
  builtAt: new Date().toISOString(),
  cities: [...content.cities].sort((a, b) => a.order - b.order),
  lessons,
  items: content.items,
  scenarios: content.scenarios,
  mediaIndex,
  stats: {
    items: content.items.length,
    scenarios: content.scenarios.length,
    byDiscipline,
    byCity,
    withTheme: content.items.filter((i) => i.theme).length,
    withImage: Object.keys(mediaIndex).length,
  },
}

mkdirSync(dirname(GENERATED), { recursive: true })
writeFileSync(GENERATED, JSON.stringify(bundle, null, 2))
console.log(
  `content built: ${bundle.stats.items} items, ${bundle.stats.scenarios} scenarios, ${lessons.length} lessons, ${bundle.stats.withTheme} themes, ${bundle.stats.withImage} images on disk`,
)
