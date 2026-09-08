/**
 * The Estate as an engraving: a cross-section of the house in thin ink
 * strokes on parchment. The only fills are ivory and parchment, hatching
 * for shade, and a gilt glow in the rooms whose discipline has something
 * acquired. Furnishings the household has bought are drawn as small glyphs
 * in their rooms; the Orangery extends the building to the east.
 */
import type { Discipline } from '../../content/types'
import { HOUSE, isLit, ROOMS, windowRect, type EstateProgress, type Room } from './house'

export interface EstateHouseProps {
  progress: EstateProgress
  /** Furnishing ids the household owns (see furnishings.ts). */
  furnishings: string[]
  className?: string
}

const INK = 'stroke-ink'
const INK_SOFT = 'stroke-ink-soft'
const INK_MUTE = 'stroke-ink-mute'

/** Small marks along the upper wall, one per acquired item (at most eight). */
function AcquiredMarks({ room, count }: { room: Room; count: number }) {
  const n = Math.min(count, 8)
  if (n === 0) return null
  const marks = []
  for (let i = 0; i < n; i++) {
    const x = room.x + 10 + i * 11
    const y = room.y + 38
    switch (room.discipline) {
      case 'music': // score spines on a shelf
        marks.push(<rect key={i} x={x + 1} y={y} width={4} height={9} className={INK_SOFT} strokeWidth={0.6} fill="none" />)
        break
      case 'opera': // playbills
        marks.push(
          <g key={i} className={INK_SOFT} strokeWidth={0.6} fill="none">
            <rect x={x} y={y} width={7} height={9} />
            <line x1={x + 1.5} y1={y + 3} x2={x + 5.5} y2={y + 3} />
            <line x1={x + 1.5} y1={y + 5.5} x2={x + 5.5} y2={y + 5.5} />
          </g>,
        )
        break
      case 'art': // small frames
        marks.push(
          <g key={i} className={INK_SOFT} strokeWidth={0.6} fill="none">
            <rect x={x} y={y} width={8} height={7} />
            <rect x={x + 1.5} y={y + 1.5} width={5} height={4} strokeWidth={0.4} />
          </g>,
        )
        break
      case 'history': // small ovals
        marks.push(<ellipse key={i} cx={x + 4} cy={y + 4.5} rx={3.5} ry={4.5} className={INK_SOFT} strokeWidth={0.6} fill="none" />)
        break
    }
  }
  return <g data-testid={`estate-marks-${room.discipline}`}>{marks}</g>
}

function Window({ room, lit }: { room: Room; lit: boolean }) {
  const r = windowRect(room)
  return (
    <g className={INK} strokeWidth={0.8}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} className={lit ? 'fill-gilt-soft/60' : 'fill-ivory'} />
      <line x1={r.x + r.w / 2} y1={r.y} x2={r.x + r.w / 2} y2={r.y + r.h} strokeWidth={0.6} />
      <line x1={r.x} y1={r.y + r.h / 2} x2={r.x + r.w} y2={r.y + r.h / 2} strokeWidth={0.6} />
      <line x1={r.x - 2} y1={r.y + r.h} x2={r.x + r.w + 2} y2={r.y + r.h} strokeWidth={0.8} />
    </g>
  )
}

function Chandelier({ room }: { room: Room }) {
  const cx = room.x + 104
  const top = room.y
  const arcY = top + 22
  return (
    <g data-testid="estate-furnishing-chandelier" className={INK} strokeWidth={0.7} fill="none">
      <line x1={cx} y1={top} x2={cx} y2={arcY - 6} />
      <path d={`M ${cx - 14} ${arcY} Q ${cx} ${arcY + 8} ${cx + 14} ${arcY}`} />
      <line x1={cx - 14} y1={arcY} x2={cx - 14} y2={arcY - 5} />
      <line x1={cx} y1={arcY + 4} x2={cx} y2={arcY - 2} />
      <line x1={cx + 14} y1={arcY} x2={cx + 14} y2={arcY - 5} />
      <circle cx={cx - 14} cy={arcY - 7} r={1.2} className="stroke-gilt" strokeWidth={0.6} />
      <circle cx={cx} cy={arcY - 4} r={1.2} className="stroke-gilt" strokeWidth={0.6} />
      <circle cx={cx + 14} cy={arcY - 7} r={1.2} className="stroke-gilt" strokeWidth={0.6} />
    </g>
  )
}

function Harpsichord({ room }: { room: Room }) {
  const x = room.x + 38
  const y = room.y + room.h - 34
  return (
    <g data-testid="estate-furnishing-harpsichord" className={INK} strokeWidth={0.7} fill="none">
      <rect x={x} y={y} width={66} height={12} />
      <line x1={x + 6} y1={y + 12} x2={x + 6} y2={y + 30} />
      <line x1={x + 60} y1={y + 12} x2={x + 60} y2={y + 30} />
      <line x1={x + 66} y1={y} x2={x + 32} y2={y - 20} />
      <line x1={x + 48} y1={y} x2={x + 40} y2={y - 14} strokeWidth={0.5} />
      {[8, 16, 24, 32, 40, 48, 56].map((k) => (
        <line key={k} x1={x + k} y1={y + 8} x2={x + k} y2={y + 12} strokeWidth={0.4} />
      ))}
    </g>
  )
}

function Canaletto({ room }: { room: Room }) {
  const x = room.x + 18
  const y = room.y + 48
  const w = 64
  const h = 38
  return (
    <g data-testid="estate-furnishing-canaletto-on-loan" className={INK} strokeWidth={0.7} fill="none">
      <rect x={x} y={y} width={w} height={h} className="stroke-gilt" />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} strokeWidth={0.5} />
      <line x1={x + 6} y1={y + 24} x2={x + w - 6} y2={y + 24} strokeWidth={0.5} />
      <path d={`M ${x + 24} ${y + 24} v -6 a 6 6 0 0 1 12 0 v 6`} strokeWidth={0.5} />
      <line x1={x + 30} y1={y + 12} x2={x + 30} y2={y + 18} strokeWidth={0.5} />
      <path d={`M ${x + 10} ${y + 30} q 6 -2 12 0`} strokeWidth={0.5} />
      <path d={`M ${x + 40} ${y + 31} q 6 -2 12 0`} strokeWidth={0.5} />
      <text x={x + w / 2} y={y + h + 10} textAnchor="middle" fontSize={9} className="fill-ink-soft" stroke="none">
        on loan
      </text>
    </g>
  )
}

function AncestralPortraits({ room }: { room: Room }) {
  const cy = room.y + 72
  return (
    <g data-testid="estate-furnishing-ancestral-portraits" className={INK} strokeWidth={0.7} fill="none">
      {[54, 84, 114].map((dx) => {
        const cx = room.x + dx
        return (
          <g key={dx}>
            <ellipse cx={cx} cy={cy} rx={10} ry={13} className="stroke-gilt" />
            <circle cx={cx} cy={cy - 3} r={3} strokeWidth={0.5} />
            <path d={`M ${cx - 6} ${cy + 9} q 6 -8 12 0`} strokeWidth={0.5} />
          </g>
        )
      })}
    </g>
  )
}

function Orangery() {
  const o = HOUSE.orangery
  const x2 = o.x + o.w
  const roofY2 = o.y + o.roofDrop
  const g = HOUSE.ground
  const roofYAt = (x: number) => o.y + ((x - o.x) / o.w) * o.roofDrop
  const bars = []
  for (let x = o.x + 10; x < x2; x += 10) bars.push(x)
  const tx = o.x + 32
  return (
    <g data-testid="estate-furnishing-orangery" className={INK} strokeWidth={0.8} fill="none">
      <polygon points={`${o.x},${g} ${o.x},${o.y} ${x2},${roofY2} ${x2},${g}`} className="fill-ivory" />
      <line x1={o.x} y1={o.y} x2={x2 + 3} y2={roofY2 + 0.6} strokeWidth={1} />
      {bars.map((x) => (
        <line key={x} x1={x} y1={roofYAt(x)} x2={x} y2={g} strokeWidth={0.5} />
      ))}
      <line x1={o.x} y1={o.y + 40} x2={x2} y2={o.y + 40} strokeWidth={0.5} />
      <rect x={tx - 6} y={g - 14} width={12} height={14} strokeWidth={0.6} />
      <line x1={tx} y1={g - 14} x2={tx} y2={g - 30} strokeWidth={0.6} />
      <circle cx={tx} cy={g - 38} r={9} strokeWidth={0.6} />
      <circle cx={tx - 4} cy={g - 40} r={1.4} className="stroke-gilt" strokeWidth={0.6} />
      <circle cx={tx + 3} cy={g - 35} r={1.4} className="stroke-gilt" strokeWidth={0.6} />
      <circle cx={tx + 1} cy={g - 43} r={1.4} className="stroke-gilt" strokeWidth={0.6} />
    </g>
  )
}

function RoomGlyphs({ room, furnishings }: { room: Room; furnishings: string[] }) {
  const has = (id: string) => furnishings.includes(id)
  switch (room.discipline) {
    case 'music':
      return (
        <>
          {has('chandelier') ? <Chandelier room={room} /> : null}
          {has('harpsichord') ? <Harpsichord room={room} /> : null}
        </>
      )
    case 'art':
      return has('canaletto-on-loan') ? <Canaletto room={room} /> : null
    case 'history':
      return has('ancestral-portraits') ? <AncestralPortraits room={room} /> : null
    default:
      return null
  }
}

function RoomView({ room, progress, furnishings }: { room: Room; progress: EstateProgress; furnishings: string[] }) {
  const lit = isLit(progress, room.discipline)
  return (
    <g data-testid={`estate-room-${room.discipline}`} data-lit={lit ? 'true' : 'false'}>
      <rect x={room.x} y={room.y} width={room.w} height={room.h} className="fill-parchment" stroke="none" />
      {lit ? (
        <rect x={room.x} y={room.y} width={room.w} height={room.h} fill={`url(#estate-glow-${room.discipline})`} stroke="none" />
      ) : (
        <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="url(#estate-shade)" stroke="none" opacity={0.55} />
      )}
      <Window room={room} lit={lit} />
      <AcquiredMarks room={room} count={progress[room.discipline]?.acquired ?? 0} />
      <RoomGlyphs room={room} furnishings={furnishings} />
      {/*
        Only the room's name is drawn here. SVG text scales with the drawing,
        not with the reader's font size, and the count set beneath it came out
        at about seven pixels on a 360px screen; the same count is in the list
        under the house, at the reader's own size.
      */}
      <text x={room.x + 8} y={room.y + 18} fontSize={15} className="smallcaps fill-ink" stroke="none">
        {room.name}
      </text>
    </g>
  )
}

function Tree() {
  const x = HOUSE.tree.x
  const g = HOUSE.ground
  return (
    <g className={INK_SOFT} strokeWidth={0.7} fill="none" aria-hidden="true">
      <line x1={x} y1={g} x2={x} y2={g - 34} />
      <path d={`M ${x - 4} ${g - 20} q -6 -4 -8 -12`} strokeWidth={0.5} />
      <circle cx={x} cy={g - 48} r={14} />
      <circle cx={x - 10} cy={g - 40} r={9} />
      <circle cx={x + 11} cy={g - 40} r={9} />
    </g>
  )
}

export function EstateHouse({ progress, furnishings, className = '' }: EstateHouseProps) {
  const { viewBox, body, roof, chimney, floorY, wallX, ground } = HOUSE
  const disciplines: Discipline[] = ROOMS.map((r) => r.discipline)
  return (
    <svg
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      className={`h-auto w-full font-serif ${className}`.trim()}
      role="img"
      aria-label="A cross-section of your Estate: the Long Gallery and the Gallery above, the Music Room and the Opera Box below."
      data-testid="estate-house"
    >
      <defs>
        <pattern id="estate-shade" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={5} className={INK_MUTE} strokeWidth={0.5} />
        </pattern>
        <pattern id="estate-tiles" width={6} height={4} patternUnits="userSpaceOnUse">
          <line x1={0} y1={0} x2={6} y2={0} className={INK_MUTE} strokeWidth={0.5} />
          <line x1={3} y1={0} x2={3} y2={4} className={INK_MUTE} strokeWidth={0.3} />
        </pattern>
        <pattern id="estate-turf" width={4} height={8} patternUnits="userSpaceOnUse">
          <line x1={1} y1={0} x2={1} y2={3} className={INK_MUTE} strokeWidth={0.4} />
          <line x1={3} y1={4} x2={3} y2={7} className={INK_MUTE} strokeWidth={0.4} />
        </pattern>
        {disciplines.map((d) => (
          <radialGradient key={d} id={`estate-glow-${d}`} cx="50%" cy="62%" r="70%">
            <stop offset="0%" style={{ stopColor: 'var(--color-gilt-soft)', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-gilt-soft)', stopOpacity: 0.04 }} />
          </radialGradient>
        ))}
      </defs>

      {/* Ground */}
      <line x1={0} y1={ground} x2={viewBox.w} y2={ground} className={INK} strokeWidth={0.8} />
      <rect x={0} y={ground} width={viewBox.w} height={10} fill="url(#estate-turf)" stroke="none" />
      <Tree />

      {/* Chimney, under the roof so the roof occludes its base */}
      <rect x={chimney.x} y={chimney.y} width={chimney.w} height={chimney.h} className={`fill-parchment ${INK}`} strokeWidth={0.8} />
      <line x1={chimney.x - 2} y1={chimney.y} x2={chimney.x + chimney.w + 2} y2={chimney.y} className={INK} strokeWidth={1} />

      {/* Roof */}
      <polygon
        points={`${roof.eaves.x1},${roof.eaves.y} ${roof.ridge.x1},${roof.ridge.y} ${roof.ridge.x2},${roof.ridge.y} ${roof.eaves.x2},${roof.eaves.y}`}
        className={`fill-parchment ${INK}`}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <polygon
        points={`${roof.eaves.x1},${roof.eaves.y} ${roof.ridge.x1},${roof.ridge.y} ${roof.ridge.x2},${roof.ridge.y} ${roof.eaves.x2},${roof.eaves.y}`}
        fill="url(#estate-tiles)"
        stroke="none"
        opacity={0.7}
      />

      {/* Orangery, attached to the east wall */}
      {furnishings.includes('orangery') ? <Orangery /> : null}

      {/* Rooms */}
      {ROOMS.map((room) => (
        <RoomView key={room.discipline} room={room} progress={progress} furnishings={furnishings} />
      ))}

      {/* Walls, floor and cornice */}
      <g className={INK} fill="none">
        <rect x={body.x} y={body.y} width={body.w} height={body.h} strokeWidth={1.2} />
        <line x1={body.x} y1={floorY} x2={body.x + body.w} y2={floorY} strokeWidth={1} />
        <line x1={wallX} y1={body.y} x2={wallX} y2={body.y + body.h} strokeWidth={1} />
        <line x1={roof.eaves.x1} y1={roof.eaves.y + 3} x2={roof.eaves.x2} y2={roof.eaves.y + 3} strokeWidth={0.5} />
      </g>
    </svg>
  )
}

export default EstateHouse
