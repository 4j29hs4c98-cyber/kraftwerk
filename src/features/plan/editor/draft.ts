import { parseNumber } from '../../profile/body'
import type { PlanDetail } from '../api'
import { customKey, defaultRestSeconds, exerciseName, getExercise, HOLD_SECONDS, isCustomKey, isTimed } from '../exercises'
import { validatePlan, type NewPlan, type NewPlanExercise } from '../planModel'

/** Bearbeitungsstand: Eingabefelder bleiben Text, bis gespeichert wird. */
export interface DraftExercise {
  readonly uid: string
  readonly exerciseKey: string
  readonly displayName: string
  readonly sets: string
  readonly repMin: string
  readonly repMax: string
  readonly rest: string
  readonly notes: string
  readonly startWeight: string
}

export interface DraftDay {
  readonly uid: string
  readonly title: string
  readonly exercises: readonly DraftExercise[]
}

export interface PlanDraft {
  readonly name: string
  readonly split: string
  readonly days: readonly DraftDay[]
}

let counter = 0
const nextUid = (): string => `d${++counter}`

const text = (n: number | null | undefined): string => (n === null || n === undefined ? '' : String(n).replace('.', ','))

export function draftFromDetail(detail: PlanDetail): PlanDraft {
  return {
    name: detail.plan.name,
    split: detail.plan.split ?? 'eigener',
    days: detail.days.map((day, i) => ({
      uid: nextUid(),
      title: day.title ?? `Tag ${i + 1}`,
      exercises: day.exercises.map((ex) => ({
        uid: nextUid(),
        exerciseKey: ex.exercise_key,
        displayName: ex.display_name ?? '',
        sets: text(ex.sets ?? 3),
        repMin: text(ex.rep_min ?? 8),
        repMax: text(ex.rep_max ?? 12),
        rest: text(ex.rest_seconds ?? defaultRestSeconds(ex.exercise_key)),
        notes: ex.notes ?? '',
        startWeight: text(ex.start_weight_kg),
      })),
    })),
  }
}

/** Neue Übung mit Standardwerten: aus der Bibliothek (key) oder eigene Übung (Name). */
export function newExercise(source: { readonly key: string } | { readonly customName: string }): DraftExercise {
  const key = 'key' in source ? source.key : customKey(source.customName)
  const timed = isTimed(key)
  return {
    uid: nextUid(),
    exerciseKey: key,
    displayName: 'customName' in source ? source.customName.trim() : '',
    sets: '3',
    repMin: String(timed ? HOLD_SECONDS.min : 8),
    repMax: String(timed ? HOLD_SECONDS.max : 12),
    rest: String(defaultRestSeconds(key)),
    notes: '',
    startWeight: '',
  }
}

const mapDay = (draft: PlanDraft, dayUid: string, fn: (day: DraftDay) => DraftDay): PlanDraft => ({
  ...draft,
  days: draft.days.map((d) => (d.uid === dayUid ? fn(d) : d)),
})

export function renameDay(draft: PlanDraft, dayUid: string, title: string): PlanDraft {
  return mapDay(draft, dayUid, (d) => ({ ...d, title }))
}

/** Hängt eine Übung an. Ist der Schlüssel am Tag schon vergeben, bekommt eine eigene Übung einen Zähler. */
export function addExercise(draft: PlanDraft, dayUid: string, exercise: DraftExercise): PlanDraft {
  return mapDay(draft, dayUid, (d) => ({ ...d, exercises: [...d.exercises, uniqueKey(d.exercises, exercise)] }))
}

function uniqueKey(existing: readonly DraftExercise[], exercise: DraftExercise): DraftExercise {
  const taken = new Set(existing.map((e) => e.exerciseKey))
  if (!taken.has(exercise.exerciseKey) || !isCustomKey(exercise.exerciseKey)) return exercise
  const base = exercise.exerciseKey.slice(0, 57)
  const free = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${base}_${n}`).find((k) => !taken.has(k))
  return free ? { ...exercise, exerciseKey: free } : exercise
}

export function hasExercise(day: DraftDay, key: string): boolean {
  return day.exercises.some((e) => e.exerciseKey === key)
}

export function removeExercise(draft: PlanDraft, dayUid: string, exerciseUid: string): PlanDraft {
  return mapDay(draft, dayUid, (d) => ({ ...d, exercises: d.exercises.filter((e) => e.uid !== exerciseUid) }))
}

export function moveExercise(draft: PlanDraft, dayUid: string, exerciseUid: string, delta: -1 | 1): PlanDraft {
  return mapDay(draft, dayUid, (d) => {
    const from = d.exercises.findIndex((e) => e.uid === exerciseUid)
    const to = from + delta
    if (from < 0 || to < 0 || to >= d.exercises.length) return d
    const list = d.exercises.filter((_, i) => i !== from)
    const moved = d.exercises[from]
    return moved ? { ...d, exercises: [...list.slice(0, to), moved, ...list.slice(to)] } : d
  })
}

export function updateExercise(draft: PlanDraft, dayUid: string, exerciseUid: string, patch: Partial<Omit<DraftExercise, 'uid' | 'exerciseKey'>>): PlanDraft {
  return mapDay(draft, dayUid, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.uid === exerciseUid ? { ...e, ...patch } : e)) }))
}

/** Ganze Zahl aus einem Feld; NaN, wenn ungültig, damit die Validierung greift. */
const int = (value: string): number => {
  const n = parseNumber(value)
  return n === null || !Number.isInteger(n) ? Number.NaN : n
}

function toExercise(e: DraftExercise): NewPlanExercise {
  const start = e.startWeight.trim() === '' ? null : (parseNumber(e.startWeight) ?? Number.NaN)
  // Bibliotheksübungen behalten nur einen abweichenden Namen.
  const name = e.displayName.trim()
  const library = getExercise(e.exerciseKey)
  return {
    exerciseKey: e.exerciseKey,
    displayName: name === '' || (library && name === library.name) ? null : name,
    sets: int(e.sets),
    repMin: int(e.repMin),
    repMax: int(e.repMax),
    restSeconds: int(e.rest),
    notes: e.notes.trim() || null,
    startWeightKg: start,
  }
}

export type DraftResult = { readonly ok: true; readonly plan: NewPlan } | { readonly ok: false; readonly errors: readonly string[] }

export function draftToPlan(draft: PlanDraft): DraftResult {
  const plan: NewPlan = {
    name: draft.name,
    split: draft.split,
    days: draft.days.map((d) => ({ title: d.title, exercises: d.exercises.map(toExercise) })),
  }
  const errors = validatePlan(plan)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, plan }
}

export function draftExerciseName(e: DraftExercise): string {
  return exerciseName(e.exerciseKey, e.displayName)
}
