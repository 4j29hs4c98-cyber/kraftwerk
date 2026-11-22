import { useState } from 'react'
import { IconCheck } from '../../app/icons'
import { Button } from '../../components/Button'
import { exerciseName, getExercise, MUSCLE_LABELS, repsUnitLabel } from '../plan/exercises'
import { ExercisePicker } from '../plan/editor/ExercisePicker'
import type { ExercisePick, ExerciseEntry, SetEntry } from './session'
import { pickCustom, pickLibrary } from './session'

interface Props {
  readonly entry: ExerciseEntry
  /** Schlüssel, die im Training schon vorkommen (der Picker sperrt sie). */
  readonly taken: ReadonlySet<string>
  /** Tausch oder Löschen läuft: keine Eingaben bis es fertig ist. */
  readonly busy: boolean
  readonly onEdit: (setIndex: number, patch: Partial<SetEntry>) => void
  readonly onToggle: (setIndex: number) => void
  readonly onSwap: (pick: ExercisePick) => void
  readonly onAddSet: () => void
  readonly onRemoveSet: () => void
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

export function ExerciseBlock({ entry, taken, busy, onEdit, onToggle, onSwap, onAddSet, onRemoveSet }: Props) {
  const [picking, setPicking] = useState(false)
  const exercise = getExercise(entry.key)
  const locked = busy || entry.sets.some((s) => s.saving)
  const done = entry.sets.filter((s) => s.loggedId !== null).length
  const { repMin, repMax, restSeconds: rest, key, displayName, notes } = entry
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            disabled={locked}
            className="min-h-9 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-accent disabled:opacity-40"
          >
            Tauschen
          </button>
          <span className={`rounded-full rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${done === entry.sets.length ? 'bg-ok/15 text-ok' : 'bg-surface-2 text-muted'}`}>
            {done}/{entry.sets.length}
          </span>
          </div>
      </header>
      {picking && (
        <ExercisePicker
          taken={taken}
          onPickLibrary={(pickedKey) => {
            setPicking(false)
            onSwap(pickLibrary(pickedKey))
          }}
          onAddCustom={(name) => {
            setPicking(false)
            onSwap(pickCustom(name))
          }}
          onClose={() => setPicking(false)}
        />
      )}
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
                disabled={isLogged || set.saving || busy}
                onChange={(e) => onEdit(i, { weight: e.target.value })}
              />
              <input
                aria-label={`Satz ${i + 1} ${unit === 'Sek.' ? 'Sekunden' : 'Wiederholungen'}`}
                inputMode="numeric"
                className={inputClass}
                value={set.reps}
                disabled={isLogged || set.saving || busy}
                onChange={(e) => onEdit(i, { reps: e.target.value })}
              />
              <button
                type="button"
                aria-label={isLogged ? `Satz ${i + 1} wieder öffnen` : `Satz ${i + 1} abhaken`}
                aria-pressed={isLogged}
                disabled={set.saving || busy}
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
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="min-h-11 flex-1" disabled={locked} onClick={onAddSet}>
          Satz hinzufügen
        </Button>
        <Button variant="ghost" className="min-h-11 flex-1" disabled={entry.sets.length <= 1 || locked} onClick={onRemoveSet}>
          Letzten Satz entfernen
        </Button>
      </div>
    </section>
  )
}
