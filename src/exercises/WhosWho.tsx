/**
 * Who's Who: a portrait in an engraved-style frame and four names. The
 * portrait's credit line is withheld until the exercise is answered, since it
 * usually names the sitter. Without an image on disk the question stands on
 * its own, backed by one or two facts with the name redacted.
 */
import type { Item } from '../content/types'
import { redactNames } from '../engine/distractors'
import type { ChoiceExercise } from '../engine/types'
import { ChoiceBase } from './ChoiceBase'
import type { ExerciseProps } from './types'

/** Up to two facts with the sitter's name struck out. */
export function portraitClue(item: Item | undefined): string[] {
  if (!item) return []
  return item.facts.slice(0, 2).map((fact) => redactNames(fact, [item.title]))
}

export function WhosWho(props: ExerciseProps<ChoiceExercise>) {
  const { exercise, items, media, answered } = props
  const item = items[exercise.itemId]
  const url = media.imageUrl(exercise.itemId)
  const credit = item?.media?.image?.source

  if (!url) {
    const clue = portraitClue(item)
    const role = item && 'role' in item ? item.role : undefined
    const line = [role, item?.era].filter(Boolean).join(', ')
    return (
      <ChoiceBase {...props} notice="Portrait not fetched yet.">
        {clue.length ? (
          <div className="rounded-card border border-rule bg-parchment px-4 py-3 shadow-card" data-testid="portrait-clue">
            {line ? <p className="smallcaps text-xs text-ink-mute">{line}</p> : null}
            <ul className="mt-1 space-y-1 text-ink">
              {clue.map((fact, i) => (
                <li key={i}>{fact}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </ChoiceBase>
    )
  }

  return (
    <ChoiceBase {...props}>
      <figure className="mx-auto w-full max-w-xs" data-testid="portrait">
        <div className="border-4 border-double border-ink-soft bg-ivory-deep p-1 shadow-card">
          <div className="border border-ink-mute">
            <img src={url} alt="A portrait" draggable={false} className="aspect-[3/4] w-full select-none object-cover" data-testid="portrait-image" />
          </div>
        </div>
        {answered && credit ? (
          <figcaption className="mt-2 text-center font-sans text-xs text-ink-mute" data-testid="portrait-credit">
            {credit}
          </figcaption>
        ) : null}
      </figure>
    </ChoiceBase>
  )
}

export default WhosWho
