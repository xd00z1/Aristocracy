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

/**
 * Faults we can name. The storage libraries speak for themselves otherwise,
 * and what they say ("IndexedDB API missing. Please visit https://tinyurl…")
 * is neither dry nor anything a reader should be told to click.
 */
const KNOWN: Array<{ test: RegExp; line: string }> = [
  {
    test: /missingapi|indexeddb api missing|indexeddb is not (available|supported)|securityerror/i,
    line: 'This browser will not let the app keep records. Private browsing often does that.',
  },
  { test: /quotaexceeded|quota exceeded|storage is full/i, line: 'There is no room left on this device to keep records.' },
]

/** Library messages arrive with URLs in them; a bare link in an error is not the house voice. */
function tidy(message: string): string {
  const withoutLinks = message.split(/\s+/).filter((word) => !/^https?:\/\//i.test(word) && !/^www\./i.test(word))
  return withoutLinks
    .join(' ')
    .replace(/\s*please visit\s*\.?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function describeError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : typeof err === 'string' ? err : ''
  if (!raw.trim()) return 'An unknown fault.'
  const known = KNOWN.find((k) => k.test.test(raw))
  if (known) return known.line
  const message = err instanceof Error ? err.message : raw
  return tidy(message) || 'An unknown fault.'
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
