/**
 * Screen heading: an optional small-caps kicker over a serif title, with an
 * optional line beneath in soft ink.
 */
import type { ReactNode } from 'react'

export interface PageTitleProps {
  children: ReactNode
  kicker?: ReactNode
  sub?: ReactNode
  className?: string
}

export function PageTitle({ children, kicker, sub, className = '' }: PageTitleProps) {
  return (
    <header className={`py-4 ${className}`.trim()}>
      {kicker ? <p className="smallcaps text-xs text-ink-mute">{kicker}</p> : null}
      <h1 className="mt-1 font-serif text-3xl leading-tight text-ink">{children}</h1>
      {sub ? <p className="mt-1 text-ink-soft">{sub}</p> : null}
    </header>
  )
}

export default PageTitle
