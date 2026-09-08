/**
 * The one button. Three variants, all real <button> elements, all at least
 * 44 px tall with a visible focus ring. Primary is oxblood, secondary is an
 * outlined ivory, quiet is plain text for the least important action.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Stretch to the container's width. */
  block?: boolean
  children: ReactNode
}

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-5 py-2.5 font-serif text-base leading-tight ' +
  'transition-colors duration-150 select-none ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-gilt focus-visible:ring-offset-2 focus-visible:ring-offset-ivory ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-oxblood text-ivory hover:bg-oxblood-soft active:bg-oxblood shadow-card',
  secondary: 'border border-ink-soft bg-transparent text-ink hover:bg-ivory-deep active:bg-ivory-deep',
  quiet: 'bg-transparent text-oxblood underline-offset-4 hover:underline active:text-oxblood-soft',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', block = false, className = '', type = 'button', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`${BASE} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
})

export default Button
