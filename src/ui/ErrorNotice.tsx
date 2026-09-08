/**
 * The dry error state: one line saying what happened and a way to try again.
 * Never blames the user.
 */
import { Button } from './Button'

export interface ErrorNoticeProps {
  /** A plain sentence. Defaults to a general apology. */
  message?: string
  /** The underlying error, shown small for anyone who wants it. */
  detail?: unknown
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'An unknown fault.'
}

export function ErrorNotice({ message = 'Something has gone wrong on our side.', detail, onRetry, retryLabel = 'Try again', className = '' }: ErrorNoticeProps) {
  return (
    <div role="alert" className={`py-8 text-center ${className}`.trim()} data-testid="error-notice">
      <p className="text-ink">{message}</p>
      {detail !== undefined ? <p className="mt-2 font-sans text-xs text-ink-mute">{describeError(detail)}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-5">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default ErrorNotice
