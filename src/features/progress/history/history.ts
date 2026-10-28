import { exerciseName } from '../../plan/exercises'
import { totalVolume } from '../../workout/summary'

export interface HistorySet {
  readonly id: string
  readonly exercise_key: string
  readonly set_index: number
  readonly weight_kg: number | null
  readonly reps: number | null
}

export interface HistoryPlanExercise {
  readonly exercise_key: string
  readonly display_name: string | null
  readonly position: number
}

export interface ExerciseGroup<S extends HistorySet = HistorySet> {
  readonly exerciseKey: string
  readonly name: string
  readonly sets: readonly S[]
}

/**
 * Gruppiert die Sätze eines Workouts nach Übung: zuerst die Übungen des Plan-Tags in
 * Plan-Reihenfolge (auch ohne Sätze, damit sich welche nachtragen lassen), danach
 * weitere geloggte Übungen in der Reihenfolge ihres ersten Satzes.
 */
export function groupSetsByExercise<S extends HistorySet>(sets: readonly S[], planExercises: readonly HistoryPlanExercise[]): ExerciseGroup<S>[] {
  const ordered = [...planExercises].sort((a, b) => a.position - b.position)
  const planKeys = ordered.map((e) => e.exercise_key)
  const extraKeys = [...new Set(sets.map((s) => s.exercise_key))].filter((key) => !planKeys.includes(key))
  return [...planKeys, ...extraKeys].map((key) => {
    const plan = ordered.find((e) => e.exercise_key === key)
    return {
      exerciseKey: key,
      name: exerciseName(key, plan?.display_name),
      sets: sets.filter((s) => s.exercise_key === key).sort((a, b) => a.set_index - b.set_index),
    }
  })
}

/** Nächster freier Satz-Index einer Übung (höchster + 1), damit nichts überschrieben wird. */
export function nextSetIndex(sets: readonly HistorySet[], exerciseKey: string): number {
  return sets.filter((s) => s.exercise_key === exerciseKey).reduce((max, s) => Math.max(max, s.set_index + 1), 0)
}

export function workoutVolume(sets: readonly Pick<HistorySet, 'weight_kg' | 'reps'>[]): number {
  return totalVolume(sets.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })))
}

/** Dauer in Millisekunden; ohne Ende oder bei unplausiblen Zeiten null. */
export function workoutDurationMs(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}
