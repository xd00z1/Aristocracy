/**
 * Parchment card with a hairline rule border and the house shadow. Used for
 * every self-contained block: an exercise, a meter row, a letter.
 */
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Render as a different element, e.g. 'section' or 'article'. */
  as?: 'div' | 'section' | 'article' | 'aside'
  /** Tighter padding for dense content. */
  compact?: boolean
  children: ReactNode
}

export function Card({ as: Tag = 'div', compact = false, className = '', children, ...rest }: CardProps) {
  return (
    <Tag className={`rounded-card border border-rule bg-parchment shadow-card ${compact ? 'p-3' : 'p-5'} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}

export default Card
