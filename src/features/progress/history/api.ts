import { cachedRead, syncEngine } from '../../../lib/offline'
import { check, supabase, unwrap, UserFacingError } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'
import { referencedWorkoutIds } from '../../workout/pending'
import { workoutDurationMs, workoutVolume } from './history'

export const HISTORY_PAGE_SIZE = 20

export interface WorkoutSummary {
  readonly id: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly title: string
  readonly durationMs: number | null
  readonly volumeKg: number
  readonly setCount: number
}

const titleOf = (planDay: { title: string | null } | null, fallback = 'Training'): string => planDay?.title?.trim() || fallback

/** Abgeschlossene Workouts, jüngste zuerst, seitenweise. Volumen wird aus den Sätzen der Seite berechnet. */
export function fetchWorkoutHistory(page: number): Promise<{ readonly items: WorkoutSummary[]; readonly hasMore: boolean }> {
  return cachedRead(`history:${page}`, () => fetchWorkoutHistoryFromServer(page), { empty: { items: [], hasMore: false } })
}

async function fetchWorkoutHistoryFromServer(page: number): Promise<{ readonly items: WorkoutSummary[]; readonly hasMore: boolean }> {
  const from = page * HISTORY_PAGE_SIZE
  const workouts = unwrap(
    await supabase
      .from('workouts')
      .select('id, started_at, finished_at, plan_days(title)')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .range(from, from + HISTORY_PAGE_SIZE),
  )
  const pageRows = workouts.slice(0, HISTORY_PAGE_SIZE)
  const sets =
    pageRows.length === 0
      ? []
      : unwrap(await supabase.from('workout_sets').select('workout_id, weight_kg, reps').in('workout_id', pageRows.map((w) => w.id)).limit(5000))
  const items = pageRows.flatMap((w) => {
    if (!w.finished_at) return []
    const own = sets.filter((s) => s.workout_id === w.id)
    return [
      {
        id: w.id,
        startedAt: w.started_at,
        finishedAt: w.finished_at,
        title: titleOf(w.plan_days),
        durationMs: workoutDurationMs(w.started_at, w.finished_at),
        volumeKg: workoutVolume(own),
        setCount: own.length,
      },
    ]
  })
  return { items, hasMore: workouts.length > HISTORY_PAGE_SIZE }
}

export type HistorySetRow = Tables<'workout_sets'>

export interface WorkoutDetail {
  readonly id: string
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly title: string
  readonly sets: readonly HistorySetRow[]
  readonly planExercises: readonly Pick<Tables<'plan_exercises'>, 'exercise_key' | 'display_name' | 'position'>[]
}

/** Ein Workout mit allen Sätzen und den Übungen seines Plan-Tags (für Namen und Nachträge). Null, wenn es nicht existiert. */
export async function fetchWorkoutDetail(id: string): Promise<WorkoutDetail | null> {
  const rows = unwrap(await supabase.from('workouts').select('id, started_at, finished_at, plan_day_id, plan_days(title)').eq('id', id).limit(1))
  const workout = rows[0]
  if (!workout) return null
  const [sets, planExercises] = await Promise.all([
    supabase.from('workout_sets').select('*').eq('workout_id', id).order('set_index'),
    workout.plan_day_id
      ? supabase.from('plan_exercises').select('exercise_key, display_name, position').eq('plan_day_id', workout.plan_day_id).order('position')
      : Promise.resolve({ data: [], error: null }),
  ])
  return {
    id: workout.id,
    startedAt: workout.started_at,
    finishedAt: workout.finished_at,
    title: titleOf(workout.plan_days),
    sets: unwrap(sets),
    planExercises: unwrap(planExercises),
  }
}

/** Hat das Training noch wartende oder abgelehnte Offline-Einträge? Dann wären direkte Korrekturen in falscher Reihenfolge. */
export function isWaitingForSync(workoutId: string, snapshot = syncEngine.getSnapshot()): boolean {
  return referencedWorkoutIds([...snapshot.queued.map((e) => e.op), ...snapshot.failed.map((f) => f.op)]).has(workoutId)
}

function assertSynced(workoutId: string): void {
  if (isWaitingForSync(workoutId)) throw new UserFacingError('Dieses Training wartet noch auf Sync. Bearbeiten geht wieder, sobald alles übertragen ist.')
}

export async function updateSetValues(workoutId: string, id: string, weightKg: number, reps: number): Promise<void> {
  assertSynced(workoutId)
  check(await supabase.from('workout_sets').update({ weight_kg: weightKg, reps }).eq('id', id))
}

/*
 * Nachträgliche Korrekturen im Verlauf gehen direkt an den Server (nicht über die
 * Offline-Warteschlange), damit die Detailseite danach sofort den Serverstand zeigt.
 */

export async function deleteHistorySet(workoutId: string, id: string): Promise<void> {
  assertSynced(workoutId)
  check(await supabase.from('workout_sets').delete().eq('id', id))
}

/** Upsert auf (workout_id, exercise_key, set_index), wie beim Abhaken im Training. */
export async function addHistorySet(input: { workoutId: string; exerciseKey: string; setIndex: number; weightKg: number; reps: number }): Promise<void> {
  assertSynced(input.workoutId)
  check(
    await supabase
      .from('workout_sets')
      .upsert(
        { workout_id: input.workoutId, exercise_key: input.exerciseKey, set_index: input.setIndex, weight_kg: input.weightKg, reps: input.reps },
        { onConflict: 'workout_id,exercise_key,set_index' },
      ),
  )
}

export async function deleteWorkout(id: string): Promise<void> {
  assertSynced(id)
  check(await supabase.from('workouts').delete().eq('id', id))
}
