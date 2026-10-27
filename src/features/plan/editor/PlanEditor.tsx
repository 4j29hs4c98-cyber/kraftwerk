import { useState } from 'react'
import { IconChevron, IconTrash } from '../../../app/icons'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { Field } from '../../../components/Field'
import { toMessage } from '../../../lib/supabase'
import { savePlan, type PlanDetail } from '../api'
import { isCustomKey, repsUnitLabel } from '../exercises'
import { PLAN_LIMITS } from '../planModel'
import {
  addExercise,
  draftExerciseName,
  draftFromDetail,
  draftToPlan,
  moveExercise,
  newExercise,
  removeExercise,
  renameDay,
  updateExercise,
  type DraftDay,
  type DraftExercise,
  type PlanDraft,
} from './draft'
import { ExercisePicker } from './ExercisePicker'

interface Props {
  readonly detail: PlanDetail
  readonly onSaved: () => void
  readonly onCancel: () => void
}

/** Speichern legt über create_plan einen neuen aktiven Plan mit gleichem Namen an; die Historie bleibt. */
export function PlanEditor({ detail, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState<PlanDraft>(() => draftFromDetail(detail))
  const [errors, setErrors] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)

  async function save() {
    const result = draftToPlan(draft)
    if (!result.ok) return setErrors(result.errors)
    setErrors([])
    setBusy(true)
    try {
      await savePlan(result.plan)
      onSaved()
    } catch (err) {
      setErrors([toMessage(err, 'Der Plan konnte nicht gespeichert werden.')])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-display text-2xl font-bold uppercase">Plan bearbeiten</p>
        <p className="mt-1 text-sm text-muted">
          Beim Speichern entsteht ein neuer aktiver Plan mit gleichem Namen. Deine bisherigen Trainings bleiben erhalten.
        </p>
      </Card>
      {draft.days.map((day, i) => (
        <DayEditor key={day.uid} day={day} position={i + 1} onChange={setDraft} />
      ))}
      <Card>
        {errors.length > 0 && (
          <ul role="alert" className="mb-3 list-disc rounded-xl border border-danger/40 bg-danger/10 py-2 pr-3 pl-7 text-sm text-danger">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={save} loading={busy}>Plan speichern</Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Abbrechen</Button>
        </div>
      </Card>
    </div>
  )
}

type Update = (fn: (draft: PlanDraft) => PlanDraft) => void

function DayEditor({ day, position, onChange }: { readonly day: DraftDay; readonly position: number; readonly onChange: Update }) {
  const [picking, setPicking] = useState(false)
  const full = day.exercises.length >= PLAN_LIMITS.maxExercisesPerDay

  function add(exercise: DraftExercise) {
    onChange((d) => addExercise(d, day.uid, exercise))
    setPicking(false)
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <Field label={`Tag ${position}`} value={day.title} maxLength={PLAN_LIMITS.dayTitleMax} onChange={(e) => onChange((d) => renameDay(d, day.uid, e.target.value))} />
      <ol className="mt-3 flex flex-col gap-3">
        {day.exercises.map((ex, i) => (
          <ExerciseEditor
            key={ex.uid}
            exercise={ex}
            isFirst={i === 0}
            isLast={i === day.exercises.length - 1}
            onPatch={(patch) => onChange((d) => updateExercise(d, day.uid, ex.uid, patch))}
            onMove={(delta) => onChange((d) => moveExercise(d, day.uid, ex.uid, delta))}
            onRemove={() => onChange((d) => removeExercise(d, day.uid, ex.uid))}
          />
        ))}
      </ol>
      {picking ? (
        <ExercisePicker
          taken={new Set(day.exercises.map((e) => e.exerciseKey))}
          onPickLibrary={(key) => add(newExercise({ key }))}
          onAddCustom={(name) => add(newExercise({ customName: name }))}
          onClose={() => setPicking(false)}
        />
      ) : (
        <Button variant="secondary" block className="mt-3" disabled={full} onClick={() => setPicking(true)}>
          {full ? `Höchstens ${PLAN_LIMITS.maxExercisesPerDay} Übungen pro Tag` : 'Übung hinzufügen'}
        </Button>
      )}
    </article>
  )
}

const smallInput = 'min-h-11 w-full rounded-lg border border-line bg-surface-2 px-2 text-center tabular-nums focus:border-accent focus:outline-none'

interface ExerciseEditorProps {
  readonly exercise: DraftExercise
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly onPatch: (patch: Partial<Omit<DraftExercise, 'uid' | 'exerciseKey'>>) => void
  readonly onMove: (delta: -1 | 1) => void
  readonly onRemove: () => void
}

function NumberCell({ label, value, onChange, decimal = false }: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void; readonly decimal?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input className={smallInput} inputMode={decimal ? 'decimal' : 'numeric'} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function ExerciseEditor({ exercise, isFirst, isLast, onPatch, onMove, onRemove }: ExerciseEditorProps) {
  const name = draftExerciseName(exercise)
  const unit = repsUnitLabel(exercise.exerciseKey)
  const iconButton = 'flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30'

  return (
    <li className="rounded-xl border border-line bg-bg/30 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {isCustomKey(exercise.exerciseKey) ? (
            <input
              aria-label="Name der eigenen Übung"
              className="min-h-11 w-full rounded-lg border border-line bg-surface-2 px-3 font-semibold focus:border-accent focus:outline-none"
              value={exercise.displayName}
              maxLength={PLAN_LIMITS.displayNameMax}
              onChange={(e) => onPatch({ displayName: e.target.value })}
            />
          ) : (
            <p className="py-2 font-semibold leading-tight">{name}</p>
          )}
          {isCustomKey(exercise.exerciseKey) && <p className="mt-1 text-xs text-muted">Eigene Übung</p>}
        </div>
        <button type="button" aria-label={`${name} nach oben`} disabled={isFirst} onClick={() => onMove(-1)} className={iconButton}>
          <IconChevron direction="left" className="size-5 rotate-90" />
        </button>
        <button type="button" aria-label={`${name} nach unten`} disabled={isLast} onClick={() => onMove(1)} className={iconButton}>
          <IconChevron direction="right" className="size-5 rotate-90" />
        </button>
        <button type="button" aria-label={`${name} entfernen`} onClick={onRemove} className={`${iconButton} hover:text-danger`}>
          <IconTrash className="size-5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <NumberCell label="Sätze" value={exercise.sets} onChange={(sets) => onPatch({ sets })} />
        <NumberCell label={`${unit} von`} value={exercise.repMin} onChange={(repMin) => onPatch({ repMin })} />
        <NumberCell label={`${unit} bis`} value={exercise.repMax} onChange={(repMax) => onPatch({ repMax })} />
        <NumberCell label="Pause (s)" value={exercise.rest} onChange={(rest) => onPatch({ rest })} />
        <NumberCell label="Start (kg)" value={exercise.startWeight} decimal onChange={(startWeight) => onPatch({ startWeight })} />
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs text-muted">
        Hinweis
        <textarea
          rows={2}
          maxLength={PLAN_LIMITS.notesMax}
          value={exercise.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </label>
    </li>
  )
}
