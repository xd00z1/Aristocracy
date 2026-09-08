/**
 * End of session: the grade in large serif, what was earned, what was
 * acquired, and a way back. Celebration is one gilt fleuron.
 */
import { getItem } from './deps'
import type { Item } from '../../content/types'
import { GRADE_LABELS, type Grade, type SessionSummary } from '../../engine/types'
import { Button, Card, Fleuron, Meter } from '../../ui'

const GRADE_NOTE: Record<Grade, string> = {
  first: 'Nothing to add.',
  'upper-second': 'Very creditable.',
  'lower-second': 'Respectable.',
  third: 'It counts.',
  pass: 'Completed, which is the point.',
}

export interface SummaryProps {
  summary: SessionSummary
  /** Resolves acquired item ids to items for their titles. Defaults to the content bundle. */
  lookup?: (id: string) => Item | undefined
  onReturn: () => void
}

export default function Summary({ summary, lookup = getItem, onReturn }: SummaryProps) {
  const acquired = summary.acquired.map((id) => lookup(id)).filter((i): i is Item => Boolean(i))
  return (
    <section data-testid="session-summary" className="py-4">
      <p className="smallcaps text-xs text-ink-mute">Lesson complete</p>
      <h1 className="mt-2 font-serif text-5xl leading-none text-ink" data-testid="summary-grade">
        {GRADE_LABELS[summary.grade]}
      </h1>
      <p className="mt-2 text-ink-soft">{GRADE_NOTE[summary.grade]}</p>

      <Fleuron gilt />

      <Card as="section" aria-label="Results">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Meter label="Correct" value={`${summary.correct} of ${summary.total}`} data-testid="summary-correct" />
          <Meter label="Standing" value={summary.standing} unit={summary.standing === 1 ? 'day' : 'days'} data-testid="summary-standing" />
          <Meter label="Prestige" value={`+${summary.prestigeEarned}`} reward data-testid="summary-prestige" />
          <Meter label="Guineas" value={`+${summary.guineasEarned}`} reward data-testid="summary-guineas" />
        </div>
        {summary.reviewErrors > 0 ? (
          <p className="mt-4 border-t border-rule pt-3 text-sm text-ink-mute">
            {summary.reviewErrors === 1 ? 'One slip' : `${summary.reviewErrors} slips`} on review items. A First asks for none.
          </p>
        ) : null}
      </Card>

      {summary.acquired.length ? (
        <Card as="section" className="mt-4" aria-label="Acquired" data-testid="summary-acquired">
          <p className="smallcaps text-xs text-ink-mute">
            Acquired for the Collection
          </p>
          <ul className="mt-2 space-y-1 text-ink">
            {acquired.map((item) => (
              <li key={item.id}>
                {item.title}
                {item.creator ? <span className="text-ink-mute"> · {item.creator}</span> : null}
              </li>
            ))}
            {summary.acquired.length > acquired.length ? (
              <li className="text-ink-mute">and {summary.acquired.length - acquired.length} more</li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {summary.lessonCompleted || summary.cityCompleted ? (
        <p className="mt-4 text-center text-sm text-ink-soft" data-testid="summary-progress">
          {summary.cityCompleted ? 'The city is complete; the Tour moves on.' : 'The lesson is complete; the next awaits.'}
        </p>
      ) : null}

      <Button block className="mt-6" data-testid="return" onClick={onReturn}>
        Return
      </Button>
    </section>
  )
}
