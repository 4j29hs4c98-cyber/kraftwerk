import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { IconChevron, IconTrash } from '../../../app/icons'
import { Button } from '../../../components/Button'
import { Card, PageHeader } from '../../../components/Card'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState, ErrorState, InlineError, LoadingState } from '../../../components/States'
import { formatDuration, formatLongDate } from '../../../lib/date'
import { toMessage } from '../../../lib/supabase'
import { useAsync } from '../../../lib/useAsync'
import { parseSetValues, SET_LIMITS } from '../../workout/session'
import { useSyncStatus } from '../../../lib/offline/useSync'
import { addHistorySet, deleteHistorySet, deleteWorkout, fetchWorkoutDetail, isWaitingForSync, updateSetValues, type HistorySetRow } from './api'
import { groupSetsByExercise, nextSetIndex, workoutDurationMs, workoutVolume } from './history'

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const text = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','))
const INVALID_SET = `Bitte Gewicht (0 bis ${SET_LIMITS.weightKg} kg) und ganze Wiederholungen (bis ${SET_LIMITS.reps}) eingeben.`

export function WorkoutDetailPage() {
  const { workoutId = '' } = useParams()
  const navigate = useNavigate()
  const detail = useAsync(() => fetchWorkoutDetail(workoutId), [workoutId])
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const waiting = isWaitingForSync(workoutId, useSyncStatus())

  async function removeWorkout() {
    setDeleting(true)
    setError(null)
    try {
      await deleteWorkout(workoutId)
      navigate('/fortschritt', { replace: true })
    } catch (err) {
      setConfirming(false)
      setError(toMessage(err, 'Das Training konnte nicht gelöscht werden.'))
    } finally {
      setDeleting(false)
    }
  }

  const back = (
    <Link to="/fortschritt" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      <IconChevron direction="left" className="size-4" />
      Fortschritt
    </Link>
  )

  if (detail.status === 'loading') return <>{back}<LoadingState label="Training wird geladen" /></>
  if (detail.status === 'error') return <>{back}<ErrorState message={detail.message} onRetry={detail.reload} /></>
  if (!detail.data) return <>{back}<EmptyState title="Training nicht gefunden">Vielleicht wurde es schon gelöscht.</EmptyState></>

  const workout = detail.data
  const groups = groupSetsByExercise(workout.sets, workout.planExercises)
  const duration = workoutDurationMs(workout.startedAt, workout.finishedAt)

  return (
    <>
      {back}
      <PageHeader eyebrow={formatLongDate(new Date(workout.startedAt))} title={workout.title} />
      {waiting && (
        <p role="status" className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Wartet auf Sync: Dieses Training lässt sich bearbeiten, sobald alle Einträge übertragen sind.
        </p>
      )}
      <p className="-mt-3 mb-5 text-sm text-muted tabular-nums">
        {duration !== null && `${formatDuration(duration)} · `}
        {workout.sets.length} Sätze · {NUMBER.format(workoutVolume(workout.sets))} kg Volumen
      </p>
      <p className="mb-4 text-xs text-muted">Korrekturen fließen sofort in die Vorschläge fürs nächste Training ein.</p>

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <Card key={group.exerciseKey}>
            <h2 className="font-display text-xl font-bold uppercase">{group.name}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {group.sets.map((set, i) => (
                <SetRow key={set.id} set={set} number={i + 1} onChanged={detail.reload} />
              ))}
            </ul>
            <AddSet workoutId={workout.id} exerciseKey={group.exerciseKey} sets={workout.sets} last={group.sets.at(-1) ?? null} onAdded={detail.reload} />
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <InlineError message={error} />
        <Button variant="danger" block className="mt-3" onClick={() => setConfirming(true)}>
          Training löschen
        </Button>
      </div>
      <ConfirmDialog open={confirming} title="Training löschen?" confirmLabel="Löschen" danger busy={deleting} onConfirm={() => void removeWorkout()} onCancel={() => setConfirming(false)}>
        Das Training mit allen {workout.sets.length} Sätzen wird endgültig gelöscht. Statistik und Vorschläge richten sich danach nach den übrigen Trainings.
      </ConfirmDialog>
    </>
  )
}

function SetRow({ set, number, onChanged }: { readonly set: HistorySetRow; readonly number: number; readonly onChanged: () => void }) {
  const [weight, setWeight] = useState(text(set.weight_kg))
  const [reps, setReps] = useState(text(set.reps))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = weight !== text(set.weight_kg) || reps !== text(set.reps)

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(toMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  function save() {
    const parsed = parseSetValues(weight, reps)
    if (!parsed) return setError(INVALID_SET)
    void run(async () => {
      await updateSetValues(set.workout_id, set.id, parsed.weightKg, parsed.reps)
      setWeight(text(parsed.weightKg))
      setReps(String(parsed.reps))
    }, 'Der Satz konnte nicht gespeichert werden.')
  }

  return (
    <li>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-sm font-semibold text-muted tabular-nums">{number}</span>
        <SetInputs weight={weight} reps={reps} onWeight={setWeight} onReps={setReps} label={`Satz ${number}`} />
        {dirty ? (
          <Button className="shrink-0 px-3" loading={busy} onClick={save}>
            Sichern
          </Button>
        ) : (
          <button
            type="button"
            aria-label={`Satz ${number} löschen`}
            disabled={busy}
            onClick={() => void run(() => deleteHistorySet(set.workout_id, set.id), 'Der Satz konnte nicht gelöscht werden.')}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
          >
            <IconTrash className="size-5" />
          </button>
        )}
      </div>
      {error && <div className="mt-2"><InlineError message={error} /></div>}
    </li>
  )
}

function SetInputs(props: { readonly weight: string; readonly reps: string; readonly onWeight: (v: string) => void; readonly onReps: (v: string) => void; readonly label: string }) {
  const input = 'min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-base tabular-nums text-ink focus:border-accent focus:outline-none'
  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
      <label className="relative">
        <span className="sr-only">{props.label}: Gewicht in kg</span>
        <input inputMode="decimal" value={props.weight} onChange={(e) => props.onWeight(e.target.value)} className={input} placeholder="0" />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">kg</span>
      </label>
      <label className="relative">
        <span className="sr-only">{props.label}: Wiederholungen</span>
        <input inputMode="numeric" value={props.reps} onChange={(e) => props.onReps(e.target.value)} className={input} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">Wdh.</span>
      </label>
    </div>
  )
}

interface AddSetProps {
  readonly workoutId: string
  readonly exerciseKey: string
  readonly sets: readonly HistorySetRow[]
  readonly last: HistorySetRow | null
  readonly onAdded: () => void
}

function AddSet({ workoutId, exerciseKey, sets, last, onAdded }: AddSetProps) {
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState(text(last?.weight_kg ?? null))
  const [reps, setReps] = useState(text(last?.reps ?? null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const parsed = parseSetValues(weight, reps)
    if (!parsed) return setError(INVALID_SET)
    setBusy(true)
    setError(null)
    try {
      await addHistorySet({ workoutId, exerciseKey, setIndex: nextSetIndex(sets, exerciseKey), weightKg: parsed.weightKg, reps: parsed.reps })
      setOpen(false)
      onAdded()
    } catch (err) {
      setError(toMessage(err, 'Der Satz konnte nicht nachgetragen werden.'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" className="mt-2 px-3" onClick={() => setOpen(true)}>
        + Satz nachtragen
      </Button>
    )
  }
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-sm font-semibold text-accent">+</span>
        <SetInputs weight={weight} reps={reps} onWeight={setWeight} onReps={setReps} label="Neuer Satz" />
      </div>
      {error && <div className="mt-2"><InlineError message={error} /></div>}
      <div className="mt-2 flex gap-2">
        <Button className="flex-1" loading={busy} onClick={() => void add()}>
          Satz speichern
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
