/**
 * Distractor picker for choice exercises, plus the name redactor used to turn
 * an item's facts into a clue that does not give the answer away.
 *
 * Rules (CLAUDE.md, "Session rules"): distractors come from
 * `item.distractors[askFor]` first, then from other items of the same
 * discipline and kind, never duplicating the correct answer. Options are four,
 * shuffled with the session's seeded PRNG. Years without authored distractors
 * get generated, plausible neighbours instead of other items' years.
 */
import type { Item } from '../content/types'
import { shuffle, type ChoiceAsk, type Option } from './types'

/** Options per choice exercise (three for apocrypha verdicts, which do not come through here). */
export const OPTION_COUNT = 4

/** What a redacted name is replaced with in a clue. */
export const REDACTION = '———'

/**
 * Name parts that are never redacted on their own: particles, honorifics and
 * ranks. The full name is still redacted as a whole.
 */
const PARTICLES = new Set([
  'van', 'von', 'de', 'der', 'den', 'del', 'della', 'di', 'da', 'du', 'dos', 'das', 'do',
  'la', 'le', 'les', 'el', 'al', 'the', 'of', 'and', 'und', 'zu', 'af', 'y',
  'st', 'saint', 'san', 'santa', 'sir', 'lord', 'lady', 'king', 'queen', 'emperor', 'empress',
  'duke', 'duchess', 'count', 'countess', 'prince', 'princess', 'madame', 'monsieur',
  'mrs', 'mr', 'miss', 'dr', 'pope', 'don', 'doña', 'dame', 'baron', 'baroness', 'earl',
])

function normalise(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Year label: plain digits, "BC" for negative years. */
export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : String(year)
}

/**
 * The correct answer for `askFor` on this item, or undefined when the item has
 * nothing to answer with (a term asked for its creator, say). Also used to
 * harvest distractors from other items, so a `creator` item answers `creator`
 * with its own name.
 */
export function answerFor(item: Item, askFor: ChoiceAsk): string | undefined {
  switch (askFor) {
    case 'creator':
      if (item.creator) return item.creator
      return item.kind === 'creator' ? item.title : undefined
    case 'title':
      return item.title
    case 'era':
      return item.era
    case 'term':
      return item.kind === 'term' ? item.definition : undefined
    case 'person':
      return item.kind === 'person' || item.kind === 'creator' ? item.title : undefined
    case 'year':
      return typeof item.year === 'number' ? formatYear(item.year) : undefined
    case 'fact':
      return item.facts[0]
  }
}

/** Authored distractors for `askFor`, as labels. */
function authoredDistractors(item: Item, askFor: ChoiceAsk): string[] {
  const d = item.distractors
  if (!d) return []
  switch (askFor) {
    case 'creator':
      return d.creator ?? []
    case 'title':
      return d.title ?? []
    case 'era':
      return d.era ?? []
    case 'term':
      return d.term ?? []
    case 'person':
      return d.person ?? []
    case 'year':
      return (d.year ?? []).map(formatYear)
    case 'fact':
      return []
  }
}

/**
 * Plausible wrong years near the true one: small offsets for a dated event,
 * larger ones when the year is approximate. Never inside the item's own span
 * (`year`..`year_end`), so "when did it begin?" stays answerable.
 */
export function plausibleYears(item: Item, count: number, taken: Set<string>, rand: () => number): string[] {
  if (typeof item.year !== 'number') return []
  const year = item.year
  const end = typeof item.year_end === 'number' ? item.year_end : year
  const scale = item.year_approx ? 5 : 1
  const magnitudes = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40]
  const offsets = shuffle(
    magnitudes.flatMap((m) => [m * scale, -m * scale]),
    rand,
  )
  const out: string[] = []
  for (const off of offsets) {
    if (out.length >= count) break
    const candidate = year + off
    if (candidate >= year && candidate <= end) continue
    const label = formatYear(candidate)
    if (taken.has(normalise(label))) continue
    taken.add(normalise(label))
    out.push(label)
  }
  return out
}

/**
 * Build the four shuffled options for a choice question. `pool` is every item
 * distractors may be harvested from (the whole content is fine; the picker
 * narrows to the same discipline and kind first and only widens when short).
 * Option ids are positional letters (a, b, c, d) after the shuffle, so they
 * are stable for a given seed and unique within the exercise.
 *
 * Throws only when the item cannot answer `askFor` at all; the session
 * builder never asks for something the schema does not guarantee.
 */
export function optionsFor(
  item: Item,
  askFor: ChoiceAsk,
  pool: Item[],
  rand: () => number,
): { options: Option[]; correctOptionId: string } {
  const correct = answerFor(item, askFor)
  if (correct === undefined) throw new Error(`Item ${item.id} has no answer for "${askFor}"`)

  const taken = new Set<string>([normalise(correct)])
  const distractors: string[] = []
  const need = OPTION_COUNT - 1
  const add = (label: string): void => {
    const key = normalise(label)
    if (!key || taken.has(key)) return
    taken.add(key)
    distractors.push(label)
  }

  for (const label of shuffle(authoredDistractors(item, askFor), rand)) {
    if (distractors.length >= need) break
    add(label)
  }

  if (distractors.length < need) {
    if (askFor === 'year') {
      for (const label of plausibleYears(item, need - distractors.length, taken, rand)) distractors.push(label)
    } else {
      const tiers: Array<(other: Item) => boolean> = [
        (o) => o.discipline === item.discipline && o.kind === item.kind,
        (o) => o.kind === item.kind,
        (o) => o.discipline === item.discipline,
        () => true,
      ]
      for (const tier of tiers) {
        if (distractors.length >= need) break
        const candidates = pool.filter((o) => o.id !== item.id && tier(o))
        for (const other of shuffle(candidates, rand)) {
          if (distractors.length >= need) break
          const label = answerFor(other, askFor)
          if (label !== undefined) add(label)
        }
      }
    }
  }

  const labels = shuffle([correct, ...distractors], rand)
  const options: Option[] = labels.map((label, i) => ({ id: String.fromCharCode(97 + i), label }))
  const correctIndex = labels.indexOf(correct)
  return { options, correctOptionId: options[correctIndex].id }
}

/**
 * Replace every occurrence of the given names (and their significant parts:
 * surnames, given names of three letters or more, but not particles like
 * "van" or ranks like "Queen") with a redaction mark. Matching is
 * case-insensitive and respects word boundaries in any script, so "Turner"
 * is redacted in "Turner's" but not in "Turnerian".
 */
export function redactNames(text: string, names: string[]): string {
  const forms = new Set<string>()
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    forms.add(name)
    for (const part of name.split(/\s+/)) {
      const clean = part.replace(/^[("'“‘[]+|[)"'”’\],.:;!?]+$/g, '')
      if (clean.length < 3) continue
      if (PARTICLES.has(clean.toLowerCase())) continue
      forms.add(clean)
    }
  }
  let out = text
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(form)}(?![\\p{L}\\p{N}])`, 'giu')
    out = out.replace(re, REDACTION)
  }
  return out.replace(new RegExp(`${REDACTION}(?:\\s+${REDACTION})+`, 'g'), REDACTION)
}
