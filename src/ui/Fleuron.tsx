/**
 * A hairline rule with a centred glyph. The one flourish the design allows;
 * used to mark a completed session, a rank-up, a section break.
 */
export interface FleuronProps {
  /** The glyph in the middle. Defaults to a printer's fleuron. */
  glyph?: string
  /** Gilt for reward moments; otherwise muted ink. */
  gilt?: boolean
  className?: string
}

export function Fleuron({ glyph = '❦', gilt = false, className = '' }: FleuronProps) {
  return (
    <div className={`rule-fleuron my-4 ${gilt ? 'text-gilt' : ''} ${className}`.trim()} role="separator" aria-hidden="true">
      <span className="font-serif text-lg leading-none">{glyph}</span>
    </div>
  )
}

export default Fleuron
