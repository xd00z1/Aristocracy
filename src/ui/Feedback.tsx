/**
 * The shared post-answer panel. Rendered by the session runner under every
 * exercise once it has been answered; exercise components never render their
 * own. Says, in the house voice, whether the answer was right; shows the
 * correct answer when it was not; then the item's remark and its gaffe under
 * "What not to say"; then the titles of linked items. For the Remark it shows
 * the chosen reply's explanation and, when the reply was not the graceful one,
 * the graceful one.
 *
 * Copy is dry and never mocks the user for not knowing.
 */
import type { ReactNode } from 'react'
import type { Item, RemarkOption, Verdict } from '../content/types'
import type { Answer, ApocryphaExercise, ChoiceExercise, Exercise, MatchExercise, RemarkExercise, TimelineExercise } from '../engine/types'

export interface FeedbackProps {
  exercise: Exercise
  answer: Answer
  /** Every item the exercise touches, by id. */
  items: Record<string, Item>
  /** Resolves ids not in `items` (the items' own links). Defaults to `items`. */
  lookup?: (id: string) => Item | undefined
  className?: string
}

const VERDICT_LABEL: Record<Verdict, string> = {
  attested: 'Attested',
  embellished: 'Embellished',
  invented: 'Invented',
}

function Label({ children }: { children: ReactNode }) {
  return <p className="smallcaps text-xs text-ink-mute">{children}</p>
}

function yearLabel(item: Item | undefined, fallback: number): string {
  const y = item?.year ?? fallback
  return `${item?.year_approx ? 'c. ' : ''}${y}`
}

// ---------------------------------------------------------------------------
// Per-type verdict and answer lines
// ---------------------------------------------------------------------------

function ChoiceLines({ exercise, answer }: { exercise: ChoiceExercise; answer: Answer }) {
  const correct = exercise.options.find((o) => o.id === exercise.correctOptionId)
  const chosen = typeof answer.chosen === 'string' ? exercise.options.find((o) => o.id === answer.chosen) : undefined
  if (answer.correct) return null
  return (
    <div className="space-y-1" data-testid="feedback-answer">
      <p className="text-ink">
        The answer is <strong className="font-semibold">{correct?.label ?? '—'}</strong>
        {correct?.sublabel ? <span className="text-ink-soft"> ({correct.sublabel})</span> : null}.
      </p>
      {chosen && chosen.id !== correct?.id ? <p className="text-ink-soft">You chose {chosen.label}.</p> : null}
    </div>
  )
}

function TimelineLines({ exercise, answer, items }: { exercise: TimelineExercise; answer: Answer; items: Record<string, Item> }) {
  const byId = new Map(exercise.entries.map((e) => [e.id, e]))
  const ordered = exercise.correctOrder.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e))
  return (
    <div data-testid="feedback-answer">
      <Label>{answer.correct ? 'In order' : 'The order'}</Label>
      <ol className="mt-1 space-y-0.5">
        {ordered.map((e) => (
          <li key={e.id} className="flex gap-3 text-ink">
            <span className="w-14 shrink-0 tabular-nums text-ink-mute">{yearLabel(items[e.itemId], e.year)}</span>
            <span>
              {e.label}
              {e.sublabel ? <span className="text-ink-soft">, {e.sublabel}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function MatchLines({ exercise, answer }: { exercise: MatchExercise; answer: Answer }) {
  return (
    <div data-testid="feedback-answer">
      <Label>{answer.correct ? 'The pairs' : 'The pairs are'}</Label>
      <ul className="mt-1 space-y-0.5">
        {exercise.pairs.map((p) => (
          <li key={p.id} className="text-ink">
            {p.left} <span className="text-ink-mute">—</span> {p.right}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ApocryphaLines({ exercise, answer }: { exercise: ApocryphaExercise; answer: Answer }) {
  const chosen = typeof answer.chosen === 'string' && answer.chosen in VERDICT_LABEL ? (answer.chosen as Verdict) : undefined
  return (
    <div className="space-y-2" data-testid="feedback-answer">
      <p className="text-ink">
        The verdict: <strong className="font-semibold">{VERDICT_LABEL[exercise.correctVerdict]}</strong>.
        {!answer.correct && chosen && chosen !== exercise.correctVerdict ? (
          <span className="text-ink-soft"> You said {VERDICT_LABEL[chosen].toLowerCase()}.</span>
        ) : null}
      </p>
      <p className="text-ink" data-testid="feedback-truth">
        {exercise.truth}
      </p>
      {exercise.sources.length ? (
        <div>
          <Label>Sources</Label>
          <ul className="mt-0.5 font-sans text-xs text-ink-mute">
            {exercise.sources.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function chosenRemarkOption(exercise: RemarkExercise, answer: Answer): (RemarkOption & { id: string }) | undefined {
  if (typeof answer.chosen === 'string') {
    const byId = exercise.options.find((o) => o.id === answer.chosen)
    if (byId) return byId
  }
  if (answer.remarkKind) return exercise.options.find((o) => o.kind === answer.remarkKind)
  return undefined
}

function RemarkLines({ exercise, answer }: { exercise: RemarkExercise; answer: Answer }) {
  const chosen = chosenRemarkOption(exercise, answer)
  const graceful = exercise.options.find((o) => o.kind === 'correct')
  return (
    <div className="space-y-3" data-testid="feedback-answer">
      {chosen ? (
        <p className="text-ink" data-testid="feedback-explanation">
          {chosen.explanation}
        </p>
      ) : null}
      {graceful && chosen?.kind !== 'correct' ? (
        <div>
          <Label>The graceful reply</Label>
          <p className="mt-0.5 text-ink">“{graceful.text}”</p>
        </div>
      ) : null}
    </div>
  )
}

function verdictLine(exercise: Exercise, answer: Answer): string {
  if (exercise.type === 'remark') {
    const kind = answer.remarkKind ?? chosenRemarkOption(exercise, answer)?.kind
    if (answer.correct) return 'Well said.'
    if (kind === 'gaffe') return 'That one is the gaffe.'
    return 'Not quite.'
  }
  return answer.correct ? 'Quite right.' : 'Not quite.'
}

// ---------------------------------------------------------------------------
// Item panels: remark, gaffe, links
// ---------------------------------------------------------------------------

function ItemNotes({ item, showTitle, showGaffe }: { item: Item; showTitle: boolean; showGaffe: boolean }) {
  return (
    <div className="space-y-2" data-testid={`feedback-item-${item.id}`}>
      {showTitle ? (
        <p className="smallcaps text-xs text-ink-soft">
          {item.title}
          {item.creator ? <span className="text-ink-mute"> · {item.creator}</span> : null}
        </p>
      ) : null}
      <p className="text-ink" data-testid="feedback-remark">
        {item.remark}
      </p>
      {showGaffe ? (
        <div>
          <Label>What not to say</Label>
          <p className="mt-0.5 text-ink-soft" data-testid="feedback-gaffe">
            {item.gaffe}
          </p>
        </div>
      ) : null}
    </div>
  )
}

export function Feedback({ exercise, answer, items, lookup, className = '' }: FeedbackProps) {
  const resolve = lookup ?? ((id: string) => items[id])

  // Items whose remark and gaffe are shown. The Remark exercise has no item of
  // its own; its links are listed by title below instead.
  const shown: Item[] =
    exercise.type === 'remark'
      ? []
      : exercise.type === 'timeline' || exercise.type === 'match'
        ? exercise.itemIds.map((id) => items[id] ?? resolve(id)).filter((i): i is Item => Boolean(i))
        : [items[exercise.itemId] ?? resolve(exercise.itemId)].filter((i): i is Item => Boolean(i))
  const single = shown.length === 1

  const shownIds = new Set(shown.map((i) => i.id))
  const linkIds = exercise.type === 'remark' ? exercise.itemIds : shown.flatMap((i) => i.links)
  const linked: Item[] = []
  for (const id of linkIds) {
    if (shownIds.has(id) || linked.some((l) => l.id === id)) continue
    const it = resolve(id)
    if (it) linked.push(it)
  }

  return (
    <section
      data-testid="feedback"
      data-correct={answer.correct ? 'true' : 'false'}
      aria-live="polite"
      className={`rounded-card border border-rule bg-parchment p-4 shadow-card ${className}`.trim()}
    >
      <p className={`smallcaps text-sm ${answer.correct ? 'text-ink' : 'text-oxblood'}`} data-testid="feedback-verdict">
        {verdictLine(exercise, answer)}
      </p>

      <div className="mt-2 space-y-4">
        {exercise.type === 'remark' ? <RemarkLines exercise={exercise} answer={answer} /> : null}
        {exercise.type === 'timeline' ? <TimelineLines exercise={exercise} answer={answer} items={items} /> : null}
        {exercise.type === 'match' ? <MatchLines exercise={exercise} answer={answer} /> : null}
        {exercise.type === 'apocrypha' ? <ApocryphaLines exercise={exercise} answer={answer} /> : null}
        {exercise.type === 'drop-the-needle' ||
        exercise.type === 'zoom-out' ||
        exercise.type === 'lexicon' ||
        exercise.type === 'whos-who' ||
        exercise.type === 'identify' ? (
          <ChoiceLines exercise={exercise} answer={answer} />
        ) : null}

        {shown.length ? (
          <div className={`space-y-4 ${single ? '' : 'border-t border-rule pt-3'}`}>
            {shown.map((item) => (
              <ItemNotes key={item.id} item={item} showTitle={!single} showGaffe={single} />
            ))}
          </div>
        ) : null}

        {linked.length ? (
          <div data-testid="feedback-links">
            <Label>{exercise.type === 'remark' ? 'Concerning' : 'See also'}</Label>
            <ul className="mt-0.5 text-ink-soft">
              {linked.map((l) => (
                <li key={l.id}>
                  {l.title}
                  {l.creator ? <span className="text-ink-mute"> · {l.creator}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default Feedback
