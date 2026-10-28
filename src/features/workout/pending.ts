import type { OutboxEntry } from '../../lib/offline/ops'
import type { LoggedSet } from './progression'
import type { WorkoutRow, WorkoutSetRow } from './api'

/**
 * Noch nicht übertragene Änderungen am Training über den Serverstand legen,
 * damit ein offline begonnenes Training nach Neuladen oder Seitenwechsel
 * genauso weitergeht. Reine Funktionen, damit sie ohne Browser testbar sind.
 */

export interface OpenWorkoutView {
  readonly workout: WorkoutRow
  readonly sets: readonly WorkoutSetRow[]
}

const setKey = (workoutId: string, exerciseKey: string, setIndex: number) => `${workoutId}|${exerciseKey}|${setIndex}`

interface WorkoutChange {
  readonly start: { readonly planDayId: string | null; readonly startedAt: string; readonly createdAt: string } | null
  readonly finishedAt: string | null
  readonly deleted: boolean
}

interface PendingState {
  readonly workouts: ReadonlyMap<string, WorkoutChange>
  /** Satz je fachlichem Schlüssel; null = geöffnet (gelöscht). */
  readonly sets: ReadonlyMap<string, { readonly row: WorkoutSetRow } | null>
}

const NO_CHANGE: WorkoutChange = { start: null, finishedAt: null, deleted: false }

export function collectPending(entries: readonly OutboxEntry[], userId: string): PendingState {
  const workouts = new Map<string, WorkoutChange>()
  const sets = new Map<string, { readonly row: WorkoutSetRow } | null>()
  const change = (id: string, patch: Partial<WorkoutChange>) => workouts.set(id, { ...(workouts.get(id) ?? NO_CHANGE), ...patch })
  for (const { op, createdAt } of entries) {
    switch (op.kind) {
      case 'workout.start':
        change(op.id, { start: { planDayId: op.planDayId, startedAt: op.startedAt, createdAt } })
        break
      case 'workout.finish':
        change(op.id, { finishedAt: op.finishedAt })
        break
      case 'workout.delete':
        change(op.id, { deleted: true })
        break
      case 'set.upsert': {
        const key = setKey(op.workoutId, op.exerciseKey, op.setIndex)
        const row: WorkoutSetRow = {
          id: `lokal:${key}`,
          user_id: userId,
          workout_id: op.workoutId,
          exercise_key: op.exerciseKey,
          set_index: op.setIndex,
          weight_kg: op.weightKg,
          reps: op.reps,
          created_at: createdAt,
        }
        sets.set(key, { row })
        break
      }
      case 'set.delete':
        sets.set(setKey(op.workoutId, op.exerciseKey, op.setIndex), null)
        break
      default:
        break
    }
  }
  return { workouts, sets }
}

function mergeSets(workoutId: string, serverSets: readonly WorkoutSetRow[], pending: PendingState): WorkoutSetRow[] {
  const byKey = new Map(serverSets.map((s) => [setKey(s.workout_id, s.exercise_key, s.set_index), s] as const))
  for (const [key, value] of pending.sets) {
    if (!key.startsWith(`${workoutId}|`)) continue
    if (value === null) byKey.delete(key)
    else byKey.set(key, { ...value.row, id: byKey.get(key)?.id ?? value.row.id })
  }
  return [...byKey.values()]
}

/**
 * Offenes Training eines Plantags: Serverstand plus lokale Änderungen. Ein
 * lokal abgeschlossenes oder verworfenes Training gilt nicht mehr als offen;
 * ein lokal begonnenes (innerhalb des Fensters) schon.
 */
export function applyPendingToOpenWorkout(
  server: OpenWorkoutView | null,
  entries: readonly OutboxEntry[],
  input: { readonly planDayId: string; readonly userId: string; readonly since: string },
): OpenWorkoutView | null {
  const pending = collectPending(entries, input.userId)
  const candidates: WorkoutRow[] = []
  // Auch ein Serverstand aus dem Vorrat zählt nur innerhalb des Fortsetzungsfensters.
  if (server && server.workout.started_at >= input.since) {
    const c = pending.workouts.get(server.workout.id) ?? NO_CHANGE
    if (!c.deleted && !c.finishedAt) candidates.push(server.workout)
  }
  for (const [id, c] of pending.workouts) {
    if (!c.start || c.deleted || c.finishedAt || c.start.planDayId !== input.planDayId) continue
    if (c.start.startedAt < input.since || id === server?.workout.id) continue
    candidates.push({ id, user_id: input.userId, plan_day_id: c.start.planDayId, started_at: c.start.startedAt, finished_at: null, created_at: c.start.createdAt })
  }
  const newest = candidates.reduce<WorkoutRow | null>((best, w) => (!best || w.started_at > best.started_at ? w : best), null)
  if (!newest) return null
  const serverSets = server?.workout.id === newest.id ? server.sets : []
  return { workout: newest, sets: mergeSets(newest.id, serverSets, pending) }
}

/**
 * Letzte Sätze je Übung für den Vorschlag: Ein lokal abgeschlossenes, noch nicht
 * übertragenes Training ist neuer als alles auf dem Server und hat Vorrang. Das gilt
 * auch, wenn sein Beginn schon übertragen ist und nur das Abschließen wartet; dessen
 * schon übertragene Sätze kommen aus known (zuletzt gesehene offene Trainings).
 */
export function applyPendingToLastSets(
  server: ReadonlyMap<string, readonly LoggedSet[]>,
  entries: readonly OutboxEntry[],
  exerciseKeys: readonly string[],
  known: readonly OpenWorkoutView[] = [],
): ReadonlyMap<string, readonly LoggedSet[]> {
  const pending = collectPending(entries, '')
  const finished = [...pending.workouts.entries()]
    .flatMap(([id, c]) => (c.finishedAt && !c.deleted ? [{ id, finishedAt: c.finishedAt }] : []))
    .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))
  if (finished.length === 0) return server
  const setsOf = (workoutId: string) => mergeSets(workoutId, known.find((k) => k.workout.id === workoutId)?.sets ?? [], pending)
  const finishedSets = finished.map((w) => setsOf(w.id))
  return new Map(
    exerciseKeys.map((key) => {
      for (const rows of finishedSets) {
        const own = rows.filter((r) => r.exercise_key === key).sort((a, b) => a.set_index - b.set_index)
        if (own.length > 0) return [key, own.map((r) => ({ weightKg: r.weight_kg, reps: r.reps }))] as const
      }
      return [key, server.get(key) ?? []] as const
    }),
  )
}

/** Ids aller Trainings, auf die sich Einträge beziehen (wartend oder in der Fehlerliste). */
export function referencedWorkoutIds(ops: ReadonlyArray<OutboxEntry['op'] | null>): ReadonlySet<string> {
  return new Set(
    ops.flatMap((op) => {
      if (!op) return []
      if (op.kind === 'set.upsert' || op.kind === 'set.delete') return [op.workoutId]
      if (op.kind === 'workout.start' || op.kind === 'workout.finish' || op.kind === 'workout.delete') return [op.id]
      return []
    }),
  )
}

/** Lokale Tage (YYYY-MM-DD), an denen offline ein Training begonnen und nicht verworfen wurde. */
export function pendingTrainingStarts(entries: readonly OutboxEntry[]): readonly string[] {
  const pending = collectPending(entries, '')
  return [...pending.workouts.values()].flatMap((c) => (c.start && !c.deleted ? [c.start.startedAt] : []))
}
