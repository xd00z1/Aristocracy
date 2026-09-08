/**
 * The share card: a 1080 × 1350 image of the Estate with rank, name, items
 * acquired and Standing, offered through the Web Share API as a PNG when the
 * device can share files, otherwise as a download. Drawing and sharing are
 * best-effort: any failure shows a dry notice and the screen carries on.
 */
import { useEffect, useRef, useState } from 'react'
import type { Discipline } from '../../content/types'
import { Button } from '../../ui'
import { HOUSE, ROOMS, windowRect } from '../estate/house'

export const SHARE_WIDTH = 1080
export const SHARE_HEIGHT = 1350
export const SHARE_FILE_NAME = 'aristocracy-estate.png'

export interface ShareCardData {
  /** Rank name in the household's chosen style. */
  rankLabel: string
  displayName: string
  acquired: number
  /** Consecutive days. */
  standing: number
  lit: Record<Discipline, boolean>
  furnishings: string[]
}

const FALLBACK_TOKENS: Record<string, string> = {
  '--color-ivory': '#f6f1e7',
  '--color-parchment': '#fbf8f1',
  '--color-ink': '#1f1a17',
  '--color-ink-soft': '#4a423c',
  '--color-ink-mute': '#8a7f75',
  '--color-rule': '#d8cdb9',
  '--color-gilt': '#b8912e',
  '--color-gilt-soft': '#d9bd6a',
}

const SERIF = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", serif'

/** A design token from index.css, or its documented value when no stylesheet is loaded. */
function token(name: string): string {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (value) return value
  } catch {
    // no DOM styles available (tests, prerender)
  }
  return FALLBACK_TOKENS[name] ?? '#000'
}

/** Draws text letter by letter so the label reads as spaced small caps. */
function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = [...text.toUpperCase()]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y)
    x += widths[i] + spacing
  })
}

function fleuronRule(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number): void {
  const rule = token('--color-rule')
  ctx.strokeStyle = rule
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - width / 2, y)
  ctx.lineTo(cx - 36, y)
  ctx.moveTo(cx + 36, y)
  ctx.lineTo(cx + width / 2, y)
  ctx.stroke()
  ctx.fillStyle = token('--color-ink-mute')
  ctx.font = `36px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('❦', cx, y)
  ctx.textBaseline = 'alphabetic'
}

/** The house silhouette in the shared HOUSE coordinates, scaled and offset. */
function drawHouse(ctx: CanvasRenderingContext2D, data: ShareCardData, ox: number, oy: number, s: number): void {
  const ink = token('--color-ink')
  const parchment = token('--color-parchment')
  const ivory = token('--color-ivory')
  const giltSoft = token('--color-gilt-soft')
  const mute = token('--color-ink-mute')
  const X = (x: number) => ox + x * s
  const Y = (y: number) => oy + y * s

  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Ground
  ctx.strokeStyle = ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(X(0), Y(HOUSE.ground))
  ctx.lineTo(X(HOUSE.viewBox.w), Y(HOUSE.ground))
  ctx.stroke()

  // Tree
  const tx = HOUSE.tree.x
  const g = HOUSE.ground
  ctx.strokeStyle = token('--color-ink-soft')
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(X(tx), Y(g))
  ctx.lineTo(X(tx), Y(g - 34))
  ctx.stroke()
  for (const [cx, cy, r] of [
    [tx, g - 48, 14],
    [tx - 10, g - 40, 9],
    [tx + 11, g - 40, 9],
  ]) {
    ctx.beginPath()
    ctx.arc(X(cx), Y(cy), r * s, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Chimney
  const c = HOUSE.chimney
  ctx.fillStyle = parchment
  ctx.strokeStyle = ink
  ctx.lineWidth = 2
  ctx.fillRect(X(c.x), Y(c.y), c.w * s, c.h * s)
  ctx.strokeRect(X(c.x), Y(c.y), c.w * s, c.h * s)

  // Roof
  const r = HOUSE.roof
  ctx.beginPath()
  ctx.moveTo(X(r.eaves.x1), Y(r.eaves.y))
  ctx.lineTo(X(r.ridge.x1), Y(r.ridge.y))
  ctx.lineTo(X(r.ridge.x2), Y(r.ridge.y))
  ctx.lineTo(X(r.eaves.x2), Y(r.eaves.y))
  ctx.closePath()
  ctx.fillStyle = parchment
  ctx.fill()
  ctx.lineWidth = 2.4
  ctx.stroke()
  // Tile lines
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = mute
  ctx.lineWidth = 1
  for (let y = r.ridge.y + 4; y < r.eaves.y; y += 4) {
    ctx.beginPath()
    ctx.moveTo(X(r.eaves.x1), Y(y))
    ctx.lineTo(X(r.eaves.x2), Y(y))
    ctx.stroke()
  }
  ctx.restore()

  // Orangery
  if (data.furnishings.includes('orangery')) {
    const o = HOUSE.orangery
    const x2 = o.x + o.w
    const roofY2 = o.y + o.roofDrop
    ctx.beginPath()
    ctx.moveTo(X(o.x), Y(g))
    ctx.lineTo(X(o.x), Y(o.y))
    ctx.lineTo(X(x2), Y(roofY2))
    ctx.lineTo(X(x2), Y(g))
    ctx.closePath()
    ctx.fillStyle = ivory
    ctx.fill()
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.lineWidth = 1
    for (let x = o.x + 10; x < x2; x += 10) {
      const ry = o.y + ((x - o.x) / o.w) * o.roofDrop
      ctx.beginPath()
      ctx.moveTo(X(x), Y(ry))
      ctx.lineTo(X(x), Y(g))
      ctx.stroke()
    }
  }

  // Rooms
  for (const room of ROOMS) {
    const lit = data.lit[room.discipline]
    ctx.fillStyle = parchment
    ctx.fillRect(X(room.x), Y(room.y), room.w * s, room.h * s)
    if (lit) {
      const grad = ctx.createRadialGradient(
        X(room.x + room.w / 2),
        Y(room.y + room.h * 0.62),
        0,
        X(room.x + room.w / 2),
        Y(room.y + room.h * 0.62),
        room.w * s * 0.7,
      )
      grad.addColorStop(0, giltSoft)
      grad.addColorStop(1, 'rgba(217, 189, 106, 0.05)')
      ctx.fillStyle = grad
      ctx.fillRect(X(room.x), Y(room.y), room.w * s, room.h * s)
    } else {
      // Hatched shade
      ctx.save()
      ctx.beginPath()
      ctx.rect(X(room.x), Y(room.y), room.w * s, room.h * s)
      ctx.clip()
      ctx.strokeStyle = mute
      ctx.lineWidth = 0.8
      ctx.globalAlpha = 0.5
      const span = room.w + room.h
      for (let k = 0; k < span; k += 5) {
        ctx.beginPath()
        ctx.moveTo(X(room.x + k), Y(room.y))
        ctx.lineTo(X(room.x), Y(room.y + k))
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(X(room.x + room.w), Y(room.y + k - room.w + room.h))
        ctx.lineTo(X(room.x + k - room.h), Y(room.y + room.h))
        ctx.stroke()
      }
      ctx.restore()
    }
    // Window
    const w = windowRect(room)
    ctx.fillStyle = lit ? giltSoft : ivory
    ctx.fillRect(X(w.x), Y(w.y), w.w * s, w.h * s)
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.4
    ctx.strokeRect(X(w.x), Y(w.y), w.w * s, w.h * s)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(X(w.x + w.w / 2), Y(w.y))
    ctx.lineTo(X(w.x + w.w / 2), Y(w.y + w.h))
    ctx.moveTo(X(w.x), Y(w.y + w.h / 2))
    ctx.lineTo(X(w.x + w.w), Y(w.y + w.h / 2))
    ctx.stroke()
    // Label
    ctx.fillStyle = ink
    ctx.font = `${Math.round(11 * s)}px ${SERIF}`
    ctx.textAlign = 'left'
    ctx.fillText(room.name.toUpperCase(), X(room.x + 8), Y(room.y + 17))
  }

  // Walls, floor, cornice
  const b = HOUSE.body
  ctx.strokeStyle = ink
  ctx.lineWidth = 3
  ctx.strokeRect(X(b.x), Y(b.y), b.w * s, b.h * s)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(X(b.x), Y(HOUSE.floorY))
  ctx.lineTo(X(b.x + b.w), Y(HOUSE.floorY))
  ctx.moveTo(X(HOUSE.wallX), Y(b.y))
  ctx.lineTo(X(HOUSE.wallX), Y(b.y + b.h))
  ctx.stroke()
  ctx.restore()
}

/** Paints the whole card. Throws when the canvas cannot give a 2D context. */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  canvas.width = SHARE_WIDTH
  canvas.height = SHARE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas context')

  const ink = token('--color-ink')
  const inkSoft = token('--color-ink-soft')
  const mute = token('--color-ink-mute')
  const gilt = token('--color-gilt')
  const cx = SHARE_WIDTH / 2

  ctx.fillStyle = token('--color-parchment')
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT)
  ctx.strokeStyle = token('--color-rule')
  ctx.lineWidth = 2
  ctx.strokeRect(40, 40, SHARE_WIDTH - 80, SHARE_HEIGHT - 80)
  ctx.lineWidth = 1
  ctx.strokeRect(52, 52, SHARE_WIDTH - 104, SHARE_HEIGHT - 104)

  ctx.fillStyle = mute
  ctx.font = `34px ${SERIF}`
  spacedText(ctx, 'Aristocracy', cx, 150, 10)
  fleuronRule(ctx, cx, 205, 360)

  ctx.fillStyle = ink
  ctx.font = `92px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.fillText(data.rankLabel, cx, 335)

  if (data.displayName.trim()) {
    ctx.fillStyle = inkSoft
    ctx.font = `48px ${SERIF}`
    ctx.fillText(data.displayName.trim(), cx, 410)
  }

  const scale = 1.9
  drawHouse(ctx, data, cx - (HOUSE.viewBox.w * scale) / 2, 470, scale)

  ctx.fillStyle = mute
  ctx.font = `26px ${SERIF}`
  spacedText(ctx, 'Items acquired', cx - 230, 1170, 4)
  spacedText(ctx, 'Standing', cx + 230, 1170, 4)
  ctx.textAlign = 'center'
  ctx.fillStyle = gilt
  ctx.font = `72px ${SERIF}`
  ctx.fillText(data.acquired.toLocaleString(), cx - 230, 1250)
  ctx.fillStyle = ink
  ctx.fillText(`${data.standing.toLocaleString()} ${data.standing === 1 ? 'day' : 'days'}`, cx + 230, 1250)
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('toBlob is not available'))
      return
    }
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded'))), 'image/png')
  })
}

export function canShareFile(file: File): boolean {
  try {
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
    return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
  } catch {
    return false
  }
}

type CardState =
  | { status: 'drawing' }
  | { status: 'ready'; file: File; url: string; shareable: boolean }
  | { status: 'failed'; error: unknown }

export interface ShareCardProps {
  data: ShareCardData
  onClose: () => void
}

const LINK_CLASSES =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-card border border-ink-soft px-5 py-2.5 font-serif text-base leading-tight text-ink ' +
  'hover:bg-ivory-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory'

export default function ShareCard({ data, onClose }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<CardState>({ status: 'drawing' })
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const run = async () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) throw new Error('No canvas')
        drawShareCard(canvas, data)
        const blob = await canvasToPng(canvas)
        const file = new File([blob], SHARE_FILE_NAME, { type: 'image/png' })
        url = URL.createObjectURL(blob)
        if (!cancelled) setState({ status: 'ready', file, url, shareable: canShareFile(file) })
      } catch (error) {
        if (!cancelled) setState({ status: 'failed', error })
      }
    }
    void run()
    return () => {
      cancelled = true
      if (url) {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // nothing to release
        }
      }
    }
    // The card is drawn once per opening; the data does not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const share = async () => {
    if (state.status !== 'ready') return
    try {
      await navigator.share({
        files: [state.file],
        title: 'My Estate',
        text: `${data.rankLabel}${data.displayName.trim() ? `, ${data.displayName.trim()}` : ''}. ${data.acquired} items acquired.`,
      })
      setNotice('Shared.')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setNotice('Sharing did not go through. The image can be saved instead.')
      setState({ ...state, shareable: false })
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-night/60 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      data-testid="share-card"
    >
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-card border border-rule bg-parchment p-4 shadow-card">
        <p className="smallcaps text-xs text-ink-mute">Share</p>
        <h2 id="share-card-title" className="mt-1 font-serif text-2xl text-ink">
          Your Estate
        </h2>
        <div className="mt-3 overflow-hidden rounded-card border border-rule bg-ivory" style={{ aspectRatio: `${SHARE_WIDTH} / ${SHARE_HEIGHT}` }}>
          <canvas ref={canvasRef} width={SHARE_WIDTH} height={SHARE_HEIGHT} className="block h-auto w-full" aria-label="Your Estate share card" />
        </div>
        <p className="mt-3 min-h-5 text-sm text-ink-mute" aria-live="polite" data-testid="share-status">
          {state.status === 'drawing' ? 'Drawing the card.' : null}
          {state.status === 'failed' ? 'The card could not be drawn on this device.' : null}
          {state.status === 'ready' && !notice ? (state.shareable ? 'Ready to share.' : 'Ready to save.') : null}
          {notice}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Button ref={closeRef} variant="quiet" onClick={onClose} data-testid="share-close">
            Close
          </Button>
          {state.status === 'ready' && state.shareable ? (
            <Button onClick={() => void share()} data-testid="share-native">
              Share
            </Button>
          ) : null}
          {state.status === 'ready' && !state.shareable ? (
            <a href={state.url} download={SHARE_FILE_NAME} className={LINK_CLASSES} data-testid="share-download">
              Save image
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
