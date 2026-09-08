/**
 * /collection: everything acquired, grouped by discipline, each with the
 * remark you can now say about it. A filter row narrows to one discipline.
 */
import { useState } from 'react'
import { DISCIPLINES, type Discipline } from '../../content/schema'
import type { Item } from '../../content/types'
import type { CardState } from '../../engine/types'
import { Card, ErrorNotice, PageTitle, Spinner, useAsync } from '../../ui'
import { collection, getItem } from './deps'

export interface CollectionEntry {
  card: CardState
  item: Item
}

export interface CollectionGroup {
  discipline: Discipline
  label: string
  entries: CollectionEntry[]
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = { music: 'Music', opera: 'Opera', art: 'Art', history: 'History' }

const KIND_LABEL: Record<Item['kind'], string> = {
  work: 'Work',
  creator: 'Creator',
  movement: 'Movement',
  term: 'Term',
  venue: 'Venue',
  episode: 'Episode',
  person: 'Person',
  apocrypha: 'Apocrypha',
}

/** Acquired cards joined to their items; cards whose item has left the content are dropped. */
export async function loadCollection(): Promise<CollectionEntry[]> {
  const cards = await collection()
  const entries: CollectionEntry[] = []
  for (const card of cards) {
    const item = getItem(card.itemId)
    if (item) entries.push({ card, item })
  }
  return entries
}

export function groupByDiscipline(entries: CollectionEntry[]): CollectionGroup[] {
  return DISCIPLINES.map((discipline) => ({
    discipline,
    label: DISCIPLINE_LABEL[discipline],
    entries: entries.filter((e) => e.item.discipline === discipline),
  })).filter((g) => g.entries.length > 0)
}

/** "1808", "c. 1665", "1685–1759", or null when the item carries no year. */
export function yearLabel(item: Item): string | null {
  if (item.year === undefined) return null
  const start = `${item.year_approx ? 'c. ' : ''}${item.year}`
  return item.year_end !== undefined && item.year_end !== item.year ? `${start}–${item.year_end}` : start
}

function detailLine(item: Item): string {
  const parts: string[] = []
  if (item.creator) parts.push(item.creator)
  const year = yearLabel(item)
  if (year) parts.push(year)
  if (parts.length === 0) parts.push(KIND_LABEL[item.kind])
  return parts.join(' · ')
}

function EntryCard({ entry }: { entry: CollectionEntry }) {
  const { item } = entry
  return (
    <Card as="article" compact data-testid={`collection-item-${item.id}`} aria-label={item.title}>
      <h3 className="font-serif text-lg leading-tight text-ink">{item.title}</h3>
      <p className="mt-0.5 text-sm text-ink-mute">{detailLine(item)}</p>
      <p className="mt-2 text-ink-soft italic">{item.remark}</p>
    </Card>
  )
}

type Filter = 'all' | Discipline

const FILTER_BASE =
  'inline-flex min-h-11 items-center rounded-card border px-3 font-serif text-sm transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory'

export default function CollectionScreen() {
  const state = useAsync<CollectionEntry[]>(loadCollection, [])
  const [filter, setFilter] = useState<Filter>('all')

  if (state.status === 'loading' && !state.data) return <Spinner label="Fetching the catalogue." />
  if (state.status === 'error' && !state.data) {
    return (
      <>
        <PageTitle kicker="Aristocracy">The Collection</PageTitle>
        <ErrorNotice message="The catalogue could not be opened." detail={state.error} onRetry={state.reload} />
      </>
    )
  }

  const entries = state.data as CollectionEntry[]
  const groups = groupByDiscipline(entries)
  const shown = filter === 'all' ? groups : groups.filter((g) => g.discipline === filter)
  const total = entries.length

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: total },
    ...DISCIPLINES.map((d) => ({ key: d as Filter, label: DISCIPLINE_LABEL[d], count: entries.filter((e) => e.item.discipline === d).length })),
  ]

  return (
    <div data-testid="collection-screen">
      <PageTitle kicker="Aristocracy" sub={total === 0 ? 'Nothing acquired yet.' : `${total === 1 ? 'One item' : `${total} items`} acquired.`}>
        The Collection
      </PageTitle>

      {total > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {filters.map((f) => {
            const pressed = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={pressed}
                onClick={() => setFilter(f.key)}
                data-testid={`collection-filter-${f.key}`}
                className={`${FILTER_BASE} ${pressed ? 'border-oxblood bg-oxblood text-ivory' : 'border-rule bg-parchment text-ink hover:bg-ivory-deep'}`}
              >
                {f.label}
                <span className={`ml-1.5 text-xs ${pressed ? 'text-ivory/80' : 'text-ink-mute'}`}>{f.count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {total === 0 ? (
        <Card as="section" className="mt-4 text-center" data-testid="collection-empty">
          <p className="text-ink">Nothing acquired yet.</p>
          <p className="mt-1 text-sm text-ink-mute">Three correct days make an acquisition.</p>
        </Card>
      ) : shown.length === 0 ? (
        <Card as="section" className="mt-4 text-center" data-testid="collection-empty">
          <p className="text-ink">Nothing in {filter === 'all' ? 'the Collection' : DISCIPLINE_LABEL[filter]} yet.</p>
          <p className="mt-1 text-sm text-ink-mute">Three correct days make an acquisition.</p>
        </Card>
      ) : (
        shown.map((group) => (
          <section key={group.discipline} className="mt-6" aria-labelledby={`collection-${group.discipline}`} data-testid={`collection-group-${group.discipline}`}>
            <h2 id={`collection-${group.discipline}`} className="smallcaps mb-2 text-xs text-ink-mute">
              {group.label}
              <span className="ml-1.5">{group.entries.length}</span>
            </h2>
            <div className="space-y-3">
              {group.entries.map((entry) => (
                <EntryCard key={entry.item.id} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
