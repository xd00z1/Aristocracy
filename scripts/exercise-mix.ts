/**
 * Reports what a player actually meets: the mix of exercise types across every
 * lesson of every shipping city, on both seed parities.
 *
 *   npx tsx scripts/exercise-mix.ts
 *
 * Variety is the product. If one type dominates, the five minutes a day feel
 * like a quiz rather than a game, so this is the number to watch as content
 * grows. Two levers move it:
 *
 *   Images. Zoom Out and Who's Who need a file on disk. Until `npm run media`
 *   has run, those items fall back to a text question, which is why the report
 *   shows both the present mix and the mix you would get once every declared
 *   image is fetched.
 *
 *   Themes. Drop the Needle needs `theme` notation on a music or opera work.
 *   Themes are the scarcest thing in the content and the most valuable.
 *
 * The report ends with the items that would most improve the mix if someone
 * added a theme or an image to them.
 */
import { citiesInOrder, getContent, lessonsForCity } from '../src/content'
import { buildSession, type ContentSource } from '../src/engine/session'
import type { Profile } from '../src/engine/types'

const NOW = new Date('2026-05-14T09:00:00')
const content = getContent()

function profileFor(cityId: string, lessonOrder: number): Profile {
  return {
    id: 'me',
    createdAt: NOW.getTime(),
    titleStyle: 'plain',
    displayName: 'Traveller',
    prestige: 0,
    guineas: 0,
    standing: 0,
    lastSessionDay: null,
    countryWeekendsLeft: 2,
    countryWeekendMonth: null,
    currentCityId: cityId,
    lessonProgress: { [cityId]: lessonOrder },
    completedCities: [],
    furnishings: [],
    sessionsCompleted: 0,
    soundEnabled: true,
  }
}

function mix(source?: ContentSource): { counts: Map<string, number>; total: number; sessions: number } {
  const counts = new Map<string, number>()
  let total = 0
  let sessions = 0
  for (const city of citiesInOrder().filter((c) => c.release === 'mvp')) {
    for (const lesson of lessonsForCity(city.id)) {
      // Slot 11 is Timeline on even seeds and Match on odd ones.
      for (const parity of [0, 1]) {
        sessions++
        const plan = buildSession({ profile: profileFor(city.id, lesson.order), cards: new Map(), now: NOW, seed: 1000 + parity, source })
        for (const exercise of plan.exercises) {
          counts.set(exercise.type, (counts.get(exercise.type) ?? 0) + 1)
          total++
        }
      }
    }
  }
  return { counts, total, sessions }
}

function report(title: string, result: ReturnType<typeof mix>): void {
  console.log(`\n${title}  (${result.sessions} sessions, ${result.total} exercises)`)
  const rows = [...result.counts.entries()].sort((a, b) => b[1] - a[1])
  const width = Math.max(...rows.map(([type]) => type.length))
  for (const [type, n] of rows) {
    const pct = Math.round((n / result.total) * 100)
    console.log(`  ${type.padEnd(width)}  ${String(n).padStart(4)}  ${String(pct).padStart(3)}%  ${'█'.repeat(Math.round(pct / 2))}`)
  }
}

// The mix as the app stands, using the media index built from files on disk.
report('As it stands', mix())

// The mix once every declared image has been fetched by `npm run media`.
const declared = new Set(content.items.filter((i) => i.media?.image).map((i) => i.id))
const withImages: ContentSource = {
  items: content.items,
  lessons: content.lessons,
  scenarios: content.scenarios,
  cities: content.cities,
  hasImage: (id) => declared.has(id),
}
report('After npm run media', mix(withImages))

const themed = content.items.filter((i) => i.theme)
const onDisk = Object.keys(content.mediaIndex).length
console.log(`\nContent: ${content.items.length} items, ${content.scenarios.length} scenarios`)
console.log(`  images declared ${declared.size}, on disk ${onDisk}${onDisk === 0 ? '  (run npm run media)' : ''}`)
console.log(`  themes ${themed.length}`)

// Where the next hour of authoring would pay off most.
const needTheme = content.items.filter(
  (i) => (i.discipline === 'music' || i.discipline === 'opera') && i.kind === 'work' && !i.theme,
)
const needImage = content.items.filter(
  (i) => ((i.discipline === 'art' && i.kind === 'work') || i.kind === 'person') && !i.media?.image,
)
console.log(`\nBiggest wins for variety:`)
console.log(`  ${needTheme.length} music or opera works have no theme, so they ask a text question instead of playing one.`)
for (const item of needTheme.slice(0, 8)) console.log(`    ${item.id}`)
if (needTheme.length > 8) console.log(`    ... and ${needTheme.length - 8} more`)
console.log(`  ${needImage.length} paintings or portraits have no image declared.`)
for (const item of needImage.slice(0, 8)) console.log(`    ${item.id}`)
if (needImage.length > 8) console.log(`    ... and ${needImage.length - 8} more`)
