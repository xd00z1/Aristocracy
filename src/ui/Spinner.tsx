/**
 * A quiet loading indicator: a thin turning ring in muted ink. Announces
 * itself to assistive technology as status.
 */
export interface SpinnerProps {
  label?: string
  className?: string
}

export function Spinner({ label = 'One moment.', className = '' }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center gap-3 py-10 text-ink-mute ${className}`.trim()}>
      <span aria-hidden="true" className="block size-6 animate-spin rounded-full border-2 border-rule border-t-ink-mute" />
      <span className="smallcaps text-xs">{label}</span>
    </div>
  )
}

export default Spinner
