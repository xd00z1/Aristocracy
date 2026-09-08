/**
 * Geometry of the Estate: a two-storey cross-section with four rooms, one
 * per discipline, drawn in the same coordinates by the SVG on the Estate
 * screen and by the share card's canvas. Pure data and small helpers; no DOM.
 */
import { DISCIPLINES, type Discipline } from '../../content/schema'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Room extends Rect {
  discipline: Discipline
  name: string
  floor: 'upper' | 'ground'
  side: 'left' | 'right'
}

export type EstateProgress = Record<Discipline, { acquired: number; total: number }>

export const HOUSE = {
  viewBox: { w: 420, h: 330 },
  /** Ground line. */
  ground: 296,
  body: { x: 46, y: 98, w: 272, h: 198 },
  /** Floor between the two storeys. */
  floorY: 197,
  /** Wall between the left and right rooms. */
  wallX: 182,
  roof: { eaves: { x1: 38, x2: 326, y: 98 }, ridge: { x1: 110, x2: 254, y: 44 } },
  chimney: { x: 266, y: 40, w: 16, h: 32 },
  /** Lean-to glass wing on the east side, drawn only when bought. */
  orangery: { x: 318, y: 226, w: 62, roofDrop: 12 },
  tree: { x: 22 },
} as const

/** The four rooms. Upper floor first, left to right, then the ground floor. */
export const ROOMS: readonly Room[] = [
  { discipline: 'history', name: 'Long Gallery', floor: 'upper', side: 'left', x: 46, y: 98, w: 136, h: 99 },
  { discipline: 'art', name: 'Gallery', floor: 'upper', side: 'right', x: 182, y: 98, w: 136, h: 99 },
  { discipline: 'music', name: 'Music Room', floor: 'ground', side: 'left', x: 46, y: 197, w: 136, h: 99 },
  { discipline: 'opera', name: 'Opera Box', floor: 'ground', side: 'right', x: 182, y: 197, w: 136, h: 99 },
]

export function roomFor(discipline: Discipline): Room {
  const room = ROOMS.find((r) => r.discipline === discipline)
  if (!room) throw new Error(`No room for ${discipline}`)
  return room
}

/** A tall sash window on the room's outer wall. */
export function windowRect(room: Room): Rect {
  const w = 16
  const h = 30
  const x = room.side === 'left' ? room.x + 10 : room.x + room.w - 10 - w
  return { x, y: room.y + 56, w, h }
}

export function emptyProgress(): EstateProgress {
  const out = {} as EstateProgress
  for (const d of DISCIPLINES) out[d] = { acquired: 0, total: 0 }
  return out
}

/** A room is lit once its discipline has at least one acquired item. */
export function isLit(progress: EstateProgress, discipline: Discipline): boolean {
  return (progress[discipline]?.acquired ?? 0) >= 1
}

export function litRooms(progress: EstateProgress): Record<Discipline, boolean> {
  const out = {} as Record<Discipline, boolean>
  for (const d of DISCIPLINES) out[d] = isLit(progress, d)
  return out
}

export function totalAcquired(progress: EstateProgress): number {
  return DISCIPLINES.reduce((sum, d) => sum + (progress[d]?.acquired ?? 0), 0)
}

/** "3 of 80 acquired". */
export function acquiredLine(progress: EstateProgress, discipline: Discipline): string {
  const p = progress[discipline] ?? { acquired: 0, total: 0 }
  return `${p.acquired} of ${p.total} acquired`
}
