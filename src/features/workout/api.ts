import { cachedOpenWorkouts, cachedRead, currentUserId, pendingEntries, submit, syncEngine } from '../../lib/offline'
import { check, supabase, unwrap, unwrapMaybe } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { applyPendingToLastSets, applyPendingToOpenWorkout, referencedWorkoutIds } from './pending'
import type { LoggedSet } from './progression'

export type WorkoutRow = Tables<'workouts'>
export type WorkoutSetRow = Tables<'workout_sets'>

/** Wie weit zurück nach dem letzten Mal einer Übung gesucht wird. */
const HISTORY_WORKOUTS = 30
/** Ein offenes Workout gilt nur so lange als fortsetzbar. */
const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * Sätze des jeweils letzten abgeschlossenen Workouts, in dem die Übung vorkam.
 * Offline aus dem Vorrat; ein lokal abgeschlossenes, noch nicht übertragenes Training hat Vorrang.
 */
export async function fetchLastSets(exerciseKeys: readonly string[]): Promise<ReadonlyMap<string, readonly LoggedSet[]>> {
  if (exerciseKeys.length === 0) return new Map()
  const server = await cachedRead(`workout:lastSets:${[...exerciseKeys].sort().join(',')}`, () => fetchLastSetsFromServer(exerciseKeys), { empty: new Map() })
  return applyPendingToLastSets(server, await pendingEntries(), exerciseKeys, await cachedOpenWorkouts())
}

async function fetchLastSetsFromServer(exerciseKeys: readonly string[]): Promise<ReadonlyMap<string, readonly LoggedSet[]>> {
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

/** Offenes Workout des Plantags; lokal begonnene oder geänderte Trainings sind schon eingerechnet. */
export async function findOpenWorkout(planDayId: string): Promise<OpenWorkout | null> {
  const since = new Date(Date.now() - RESUME_WINDOW_MS).toISOString()
  const server = await cachedRead(`workout:open:${planDayId}`, () => findOpenWorkoutOnServer(planDayId, since), { empty: null })
  const userId = currentUserId()
  return userId ? applyPendingToOpenWorkout(server, await pendingEntries(), { planDayId, userId, since }) : server
}

async function findOpenWorkoutOnServer(planDayId: string, since: string): Promise<OpenWorkout | null> {
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

function requireUser(): string {
  const userId = currentUserId()
  if (!userId) throw new Error('Nicht angemeldet')
  return userId
}

/*
 * Schreibzugriffe im Training laufen über die Offline-Warteschlange: Sie gelten
 * sofort lokal und werden in Reihenfolge übertragen, sobald Netz da ist.
 */

/** Legt das Workout lokal mit eigener id an; auf dem Server entsteht es per upsert auf diese id. */
export async function startWorkout(planDayId: string): Promise<WorkoutRow> {
  const now = new Date().toISOString()
  const row: WorkoutRow = { id: crypto.randomUUID(), user_id: requireUser(), plan_day_id: planDayId, started_at: now, finished_at: null, created_at: now }
  await submit({ kind: 'workout.start', id: row.id, planDayId, startedAt: row.started_at })
  return row
}

/** Upsert auf (workout_id, exercise_key, set_index): doppeltes Abhaken erzeugt keine zweite Zeile. */
export async function logSet(input: { workoutId: string; exerciseKey: string; setIndex: number; weightKg: number; reps: number }): Promise<void> {
  await submit({ kind: 'set.upsert', ...input })
}

/** Öffnet einen abgehakten Satz wieder; gelöscht wird über den fachlichen Schlüssel, nicht über die id. */
export async function deleteSet(input: { workoutId: string; exerciseKey: string; setIndex: number }): Promise<void> {
  await submit({ kind: 'set.delete', ...input })
}

export async function finishWorkout(workout: WorkoutRow): Promise<WorkoutRow> {
  const finishedAt = new Date().toISOString()
  await submit({ kind: 'workout.finish', id: workout.id, finishedAt })
  return { ...workout, finished_at: finishedAt }
}

export async function discardWorkout(workoutId: string): Promise<void> {
  await submit({ kind: 'workout.delete', id: workoutId })
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
 * Workouts mit noch nicht übertragenen Änderungen bleiben unberührt, bis der Abgleich durch ist.
 */
export async function cleanupStaleWorkouts(): Promise<StaleWorkout[]> {
  // Löscht auf dem Server; ohne Netz wird gar nicht erst aufgeräumt.
  if (typeof navigator !== 'undefined' && !navigator.onLine) return []
  const before = new Date(Date.now() - RESUME_WINDOW_MS).toISOString()
  const { failed } = syncEngine.getSnapshot()
  const busy = referencedWorkoutIds([...(await pendingEntries()).map((e) => e.op), ...failed.map((f) => f.op)])
  const rows = unwrap(
    await supabase.from('workouts').select('id, started_at, plan_day_id').is('finished_at', null).lt('started_at', before).order('started_at').limit(50),
  )
  const open = rows.filter((w) => !busy.has(w.id))
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
