/**
 * A labelled figure: Standing, Prestige, Guineas. Small-caps label above a
 * serif value. Gilt is reserved for the value when `reward` is set.
 */
import type { ReactNode } from 'react'

export interface MeterProps {
  label: string
  value: ReactNode
  /** A trailing unit or note, e.g. "days". */
  unit?: string
  /** Colour the value gilt, for earned things. */
  reward?: boolean
  className?: string
  'data-testid'?: string
}

export function Meter({ label, value, unit, reward = false, className = '', ...rest }: MeterProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`.trim()} data-testid={rest['data-testid']}>
      <span className="smallcaps text-xs text-ink-mute">{label}</span>
      <span className={`font-serif text-2xl leading-none ${reward ? 'text-gilt' : 'text-ink'}`}>
        {value}
        {unit ? <span className="ml-1 text-sm text-ink-mute">{unit}</span> : null}
      </span>
    </div>
  )
}

export default Meter
