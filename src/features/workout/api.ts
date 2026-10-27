import { check, supabase, unwrap, unwrapMaybe } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import type { LoggedSet } from './progression'

export type WorkoutRow = Tables<'workouts'>
export type WorkoutSetRow = Tables<'workout_sets'>

/** Wie weit zurück nach dem letzten Mal einer Übung gesucht wird. */
const HISTORY_WORKOUTS = 30
/** Ein offenes Workout gilt nur so lange als fortsetzbar. */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000

/** Sätze des jeweils letzten abgeschlossenen Workouts, in dem die Übung vorkam. */
export async function fetchLastSets(exerciseKeys: readonly string[]): Promise<ReadonlyMap<string, readonly LoggedSet[]>> {
  if (exerciseKeys.length === 0) return new Map()
  const workouts = unwrap(
    await supabase
      .from('workouts')
      .select('id, finished_at')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(HISTORY_WORKOUTS),
  )
  if (workouts.length === 0) return new Map()
  const order = new Map(workouts.map((w, i) => [w.id, i]))
  const sets = unwrap(
    await supabase
      .from('workout_sets')
      .select('workout_id, exercise_key, set_index, weight_kg, reps')
      .in('workout_id', workouts.map((w) => w.id))
      .in('exercise_key', [...exerciseKeys]),
  )
  return new Map(
    exerciseKeys.map((key) => {
      const forKey = sets.filter((s) => s.exercise_key === key)
      const newest = forKey.reduce<number | null>((best, s) => {
        const rank = order.get(s.workout_id) ?? Number.MAX_SAFE_INTEGER
        return best === null || rank < best ? rank : best
      }, null)
      const latest = forKey
        .filter((s) => order.get(s.workout_id) === newest)
        .sort((a, b) => a.set_index - b.set_index)
        .map((s) => ({ weightKg: s.weight_kg, reps: s.reps }))
      return [key, latest] as const
    }),
  )
}

export interface OpenWorkout {
  readonly workout: WorkoutRow
  readonly sets: readonly WorkoutSetRow[]
}

export async function findOpenWorkout(planDayId: string): Promise<OpenWorkout | null> {
  const since = new Date(Date.now() - RESUME_WINDOW_MS).toISOString()
  const workout = unwrapMaybe(
    await supabase
      .from('workouts')
      .select('*')
      .eq('plan_day_id', planDayId)
      .is('finished_at', null)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  if (!workout) return null
  const sets = unwrap(await supabase.from('workout_sets').select('*').eq('workout_id', workout.id))
  return { workout, sets }
}

export async function startWorkout(planDayId: string): Promise<WorkoutRow> {
  return unwrap(await supabase.from('workouts').insert({ plan_day_id: planDayId }).select('*').single())
}

/** Upsert auf (workout_id, exercise_key, set_index): doppeltes Abhaken erzeugt keine zweite Zeile. */
export async function logSet(input: { workoutId: string; exerciseKey: string; setIndex: number; weightKg: number; reps: number }): Promise<WorkoutSetRow> {
  return unwrap(
    await supabase
      .from('workout_sets')
      .upsert(
        { workout_id: input.workoutId, exercise_key: input.exerciseKey, set_index: input.setIndex, weight_kg: input.weightKg, reps: input.reps },
        { onConflict: 'workout_id,exercise_key,set_index' },
      )
      .select('*')
      .single(),
  )
}

export async function deleteSet(id: string): Promise<void> {
  check(await supabase.from('workout_sets').delete().eq('id', id))
}

export async function finishWorkout(workoutId: string): Promise<WorkoutRow> {
  return unwrap(await supabase.from('workouts').update({ finished_at: new Date().toISOString() }).eq('id', workoutId).select('*').single())
}

export async function discardWorkout(workoutId: string): Promise<void> {
  check(await supabase.from('workouts').delete().eq('id', workoutId))
}

export interface StaleWorkout {
  readonly id: string
  readonly startedAt: string
  readonly planDayId: string | null
  readonly setCount: number
  /** Zeitpunkt des letzten Satzes, dient als Ende beim nachträglichen Abschließen. */
  readonly lastSetAt: string
}

/**
 * Räumt offene Workouts auf, die älter als das Fortsetzungsfenster sind:
 * ohne Sätze werden sie gelöscht, mit Sätzen zum Abschließen zurückgegeben.
 */
export async function cleanupStaleWorkouts(): Promise<StaleWorkout[]> {
  const before = new Date(Date.now() - RESUME_WINDOW_MS).toISOString()
  const open = unwrap(
    await supabase.from('workouts').select('id, started_at, plan_day_id').is('finished_at', null).lt('started_at', before).order('started_at').limit(50),
  )
  if (open.length === 0) return []
  const sets = unwrap(await supabase.from('workout_sets').select('workout_id, created_at').in('workout_id', open.map((w) => w.id)))
  const empty = open.filter((w) => !sets.some((s) => s.workout_id === w.id))
  if (empty.length > 0) check(await supabase.from('workouts').delete().in('id', empty.map((w) => w.id)))
  return open.flatMap((w) => {
    const own = sets.filter((s) => s.workout_id === w.id)
    if (own.length === 0) return []
    const lastSetAt = own.reduce((latest, s) => (s.created_at > latest ? s.created_at : latest), w.started_at)
    return [{ id: w.id, startedAt: w.started_at, planDayId: w.plan_day_id, setCount: own.length, lastSetAt }]
  })
}

/** Schließt ein liegengebliebenes Workout zum Zeitpunkt seines letzten Satzes ab. */
export async function finishStaleWorkout(workout: StaleWorkout): Promise<void> {
  check(await supabase.from('workouts').update({ finished_at: workout.lastSetAt }).eq('id', workout.id).is('finished_at', null))
}
