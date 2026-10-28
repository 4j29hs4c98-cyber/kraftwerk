interface Props {
  readonly value: boolean
  /** Erkannt aus den Workouts des Tages; null, solange noch geladen wird. */
  readonly detected: boolean | null
  readonly onChange: (isTrainingDay: boolean) => void
}

const OPTIONS = [
  { value: true, label: 'Trainingstag' },
  { value: false, label: 'Ruhetag' },
] as const

/** Umschalter zwischen Trainings- und Ruhetag; der Standard kommt aus den Workouts des Tages. */
export function TrainingDayToggle({ value, detected, onChange }: Props) {
  return (
    <div className="mb-4">
      <div role="radiogroup" aria-label="Heute ist" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-xl text-sm font-semibold transition ${value === o.value ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {detected !== null && (
        <p className="mt-1 text-xs text-muted">
          {detected ? 'An diesem Tag hast du trainiert.' : 'An diesem Tag gibt es noch kein Training.'} Du kannst es oben umstellen.
        </p>
      )}
    </div>
  )
}
