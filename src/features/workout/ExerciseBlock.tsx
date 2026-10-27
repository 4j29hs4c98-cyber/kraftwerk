import { IconCheck } from '../../app/icons'
import { exerciseName, getExercise, MUSCLE_LABELS, repsUnitLabel } from '../plan/exercises'
import type { ExerciseEntry, SetEntry } from './session'

interface Props {
  readonly entry: ExerciseEntry
  readonly onEdit: (setIndex: number, patch: Partial<SetEntry>) => void
  readonly onToggle: (setIndex: number) => void
}

function hint(entry: ExerciseEntry): string {
  const last = entry.lastSets
  if (last.length === 0) {
    return entry.suggestion.weightKg !== null
      ? 'Erstes Mal: Startgewicht aus deinem Plan. Passe es an, wenn es sich nicht sauber anfühlt.'
      : 'Erstes Mal: wähle ein Gewicht, mit dem du sauber im Zielbereich bleibst.'
  }
  const summary = last.map((s) => `${String(s.weightKg ?? 0).replace('.', ',')} x ${s.reps ?? 0}`).join(', ')
  const reason = entry.suggestion.reason === 'mehr_gewicht' ? 'Alle Sätze geschafft: mehr Gewicht.' : 'Ziel: eine Wiederholung mehr.'
  return `Letztes Mal: ${summary}. ${reason}`
}

const inputClass =
  'min-h-12 w-full rounded-xl border border-line bg-surface-2 px-2 text-center text-lg font-semibold tabular-nums focus:border-accent focus:outline-none disabled:opacity-60'

export function ExerciseBlock({ entry, onEdit, onToggle }: Props) {
  const exercise = getExercise(entry.planExercise.exercise_key)
  const done = entry.sets.filter((s) => s.loggedId !== null).length
  const { rep_min: repMin, rep_max: repMax, rest_seconds: rest, exercise_key: key, display_name: displayName, notes } = entry.planExercise
  const unit = repsUnitLabel(key)
  const muscle = exercise ? `${MUSCLE_LABELS[exercise.muscle]} · ` : ''

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{exerciseName(key, displayName)}</h2>
          <p className="text-xs text-muted">
            {muscle}Ziel {repMin}-{repMax} {unit} · {rest ?? 0} s Pause
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${done === entry.sets.length ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-muted'}`}>
          {done}/{entry.sets.length}
        </span>
      </header>
      {notes && <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">{notes}</p>}
      <p className="mt-2 text-xs text-muted">{hint(entry)}</p>

      <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <span>Satz</span>
        <span className="text-center">kg</span>
        <span className="text-center">{unit}</span>
        <span />
      </div>
      <ol className="mt-1 flex flex-col gap-2">
        {entry.sets.map((set, i) => {
          const isLogged = set.loggedId !== null
          return (
            <li key={i} className={`grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl ${isLogged ? 'bg-ok/5' : ''}`}>
              <span className="text-center font-display text-xl font-bold text-muted">{i + 1}</span>
              <input
                aria-label={`Satz ${i + 1} Gewicht in kg`}
                inputMode="decimal"
                className={inputClass}
                value={set.weight}
                placeholder="0"
                disabled={isLogged || set.saving}
                onChange={(e) => onEdit(i, { weight: e.target.value })}
              />
              <input
                aria-label={`Satz ${i + 1} ${unit === 'Sek.' ? 'Sekunden' : 'Wiederholungen'}`}
                inputMode="numeric"
                className={inputClass}
                value={set.reps}
                disabled={isLogged || set.saving}
                onChange={(e) => onEdit(i, { reps: e.target.value })}
              />
              <button
                type="button"
                aria-label={isLogged ? `Satz ${i + 1} wieder öffnen` : `Satz ${i + 1} abhaken`}
                aria-pressed={isLogged}
                disabled={set.saving}
                onClick={() => onToggle(i)}
                className={`flex size-12 items-center justify-center rounded-xl border-2 transition ${
                  isLogged ? 'border-ok bg-ok text-bg' : 'border-line text-muted hover:border-accent hover:text-accent'
                } ${set.saving ? 'animate-pulse' : ''}`}
              >
                <IconCheck className="size-6" />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
