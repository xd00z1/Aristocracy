/**
 * The furnishings catalogue: cosmetic purchases made with Guineas. The id is
 * what `Profile.furnishings` stores and the price is what `buyFurnishing`
 * deducts, so both are fixed here and nowhere else.
 */
import type { Discipline } from '../../content/types'

/** Where a furnishing is drawn: in one discipline's room, or on the house itself. */
export type FurnishingPlace = Discipline | 'house'

export interface Furnishing {
  id: string
  name: string
  /** Guineas. */
  price: number
  place: FurnishingPlace
  /** One dry line for the catalogue. */
  description: string
}

export const FURNISHINGS: readonly Furnishing[] = [
  {
    id: 'chandelier',
    name: 'Chandelier',
    price: 30,
    place: 'music',
    description: 'Cut glass and thirty candles, hung in the Music Room, where it does the least harm.',
  },
  {
    id: 'harpsichord',
    name: 'Harpsichord',
    price: 40,
    place: 'music',
    description: 'Two manuals and a painted lid. It wants tuning before every guest.',
  },
  {
    id: 'canaletto-on-loan',
    name: 'A Canaletto on loan',
    price: 50,
    place: 'art',
    description: 'A view of the Grand Canal for the Gallery. It hangs on loan until you have earned it.',
  },
  {
    id: 'ancestral-portraits',
    name: 'Ancestral portraits',
    price: 40,
    place: 'history',
    description: 'Three ancestors for the Long Gallery. Nobody need know they were bought.',
  },
  {
    id: 'orangery',
    name: 'Orangery',
    price: 60,
    place: 'house',
    description: 'A glass wing for wintering the citrus. The first extension to the house.',
  },
]

export function furnishingById(id: string): Furnishing | undefined {
  return FURNISHINGS.find((f) => f.id === id)
}

/** "1 Guinea", "30 Guineas". */
export function formatGuineas(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? 'Guinea' : 'Guineas'}`
}
