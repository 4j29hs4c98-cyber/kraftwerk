import { applyPendingFood } from '../../features/nutrition/pending'
import { applyPendingWeights } from '../../features/progress/pending'
import { applyPendingToOpenWorkout, type OpenWorkoutView } from '../../features/workout/pending'
import type { Tables } from '../../types/database'
import { KEEP } from './cache'
import type { OutboxEntry } from './ops'

/*
 * Nachdem ein Eintrag übertragen ist, verschwindet er aus der Warteschlange und
 * damit aus der lokalen Überlagerung. Damit er offline trotzdem sichtbar bleibt,
 * wird er hier in die abgelegten Serverstände eingearbeitet (dieselben reinen
 * Funktionen wie für die Überlagerung). Die Formen entsprechen den cachedRead-Aufrufen
 * in den api.ts-Dateien. Nicht nachgezogen werden Kennzahlen, Verlauf und Rotation;
 * die holen sich beim nächsten Laden mit Netz ohnehin den Serverstand.
 */

type FoodEntry = Tables<'food_entries'>
type BodyWeight = Tables<'body_weights'>

const DAY = /^\d{4}-\d{2}-\d{2}$/
const asArray = <T,>(v: unknown): T[] | null => (Array.isArray(v) ? (v as T[]) : null)
const asOpen = (v: unknown): OpenWorkoutView | null => (v && typeof v === 'object' && 'workout' in v && 'sets' in v ? (v as OpenWorkoutView) : null)

export interface WriteThroughContext {
  readonly userId: string
  /** Offene Trainings aus dem Vorrat, vor dem Umbau gelesen (für Sätze beim Abschließen). */
  readonly openWorkouts: readonly OpenWorkoutView[]
}

/** Liefert den neuen Wert für einen Vorrats-Schlüssel oder KEEP. */
export function writeThrough(key: string, value: unknown, entry: OutboxEntry, ctx: WriteThroughContext): unknown {
  const { op } = entry
  const one = [entry]

  if (op.kind.startsWith('food.')) {
    const rows = asArray<FoodEntry>(value)
    if (!rows) return KEEP
    const plan = /^food:plan:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(key)
    if (plan) {
      const [, from = '', to = ''] = plan
      return applyPendingFood(rows, one, ctx.userId, (d) => d >= from && d <= to).filter((r) => r.meal_plan_item_id !== null)
    }
    const day = key.startsWith('food:') ? key.slice('food:'.length) : ''
    return DAY.test(day) ? applyPendingFood(rows, one, ctx.userId, (d) => d === day) : KEEP
  }

  if (op.kind === 'weight.upsert') {
    if (key === 'weights:recent') {
      const rows = asArray<BodyWeight>(value)
      return rows ? applyPendingWeights(rows, one, ctx.userId) : KEEP
    }
    if (key === 'weights:latest') {
      const row = value as BodyWeight | null
      const merged = applyPendingWeights(row ? [row] : [], one, ctx.userId)
      return merged.reduce<BodyWeight | null>((best, r) => (!best || r.measured_on > best.measured_on ? r : best), null)
    }
    return KEEP
  }

  // Ab hier Trainings-Einträge.
  if (key.startsWith('workout:open:')) {
    if (value !== null && !asOpen(value)) return KEEP
    return applyPendingToOpenWorkout(asOpen(value), one, { planDayId: key.slice('workout:open:'.length), userId: ctx.userId, since: '' })
  }

  if (key.startsWith('workout:lastSets:') && op.kind === 'workout.finish' && value instanceof Map) {
    const sets = ctx.openWorkouts.find((w) => w.workout.id === op.id)?.sets ?? []
    if (sets.length === 0) return KEEP
    const next = new Map(value)
    for (const exerciseKey of key.slice('workout:lastSets:'.length).split(',')) {
      const own = sets.filter((s) => s.exercise_key === exerciseKey).sort((a, b) => a.set_index - b.set_index)
      if (own.length > 0) next.set(exerciseKey, own.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })))
    }
    return next
  }

  if (key.startsWith('workouts:days:') && op.kind === 'workout.start') {
    const rows = asArray<{ started_at: string }>(value)
    const [start = '', end = ''] = key.slice('workouts:days:'.length).split('|')
    if (!rows || op.startedAt < start || op.startedAt >= end || rows.some((r) => r.started_at === op.startedAt)) return KEEP
    return [...rows, { started_at: op.startedAt }]
  }

  return KEEP
}
