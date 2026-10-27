import { getExercise } from '../plan/exercises'
import type { PlanExerciseRow } from '../plan/api'
import { parseNumber } from '../profile/body'
import { suggestNext, type LoggedSet, type Suggestion } from './progression'

export interface SetEntry {
  readonly weight: string
  readonly reps: string
  /** id der gespeicherten Zeile in workout_sets, null = noch nicht abgehakt. */
  readonly loggedId: string | null
  readonly saving: boolean
}

export interface ExerciseEntry {
  readonly planExercise: PlanExerciseRow
  readonly suggestion: Suggestion
  readonly lastSets: readonly LoggedSet[]
  readonly sets: readonly SetEntry[]
}

export interface ExistingSet {
  readonly id: string
  readonly exercise_key: string
  readonly set_index: number
  readonly weight_kg: number | null
  readonly reps: number | null
}

const formatWeight = (kg: number): string => String(kg).replace('.', ',')

/** Baut die Eingabezeilen: Vorschlag aus dem letzten Mal, bereits geloggte Sätze haben Vorrang. */
export function buildEntries(
  exercises: readonly PlanExerciseRow[],
  lastSets: ReadonlyMap<string, readonly LoggedSet[]>,
  existing: readonly ExistingSet[],
): ExerciseEntry[] {
  return exercises.map((planExercise) => {
    const key = planExercise.exercise_key
    const history = lastSets.get(key) ?? []
    const repMin = planExercise.rep_min ?? 8
    const repMax = planExercise.rep_max ?? Math.max(repMin, 12)
    const setCount = planExercise.sets ?? 3
    const suggestion = suggestNext({ lastSets: history, repMin, repMax, type: getExercise(key)?.type ?? 'isolation', plannedSets: setCount, startWeightKg: planExercise.start_weight_kg })
    const sets = Array.from({ length: setCount }, (_, index): SetEntry => {
      const logged = existing.find((s) => s.exercise_key === key && s.set_index === index)
      if (logged) {
        return { weight: formatWeight(logged.weight_kg ?? 0), reps: String(logged.reps ?? ''), loggedId: logged.id, saving: false }
      }
      return {
        weight: suggestion.weightKg === null ? '' : formatWeight(suggestion.weightKg),
        reps: String(suggestion.targetReps),
        loggedId: null,
        saving: false,
      }
    })
    return { planExercise, suggestion, lastSets: history, sets }
  })
}

export function updateSet(entries: readonly ExerciseEntry[], exerciseIndex: number, setIndex: number, patch: Partial<SetEntry>): ExerciseEntry[] {
  return entries.map((entry, i) =>
    i !== exerciseIndex ? entry : { ...entry, sets: entry.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)) },
  )
}

export interface ParsedSet {
  readonly weightKg: number
  readonly reps: number
}

/** Obergrenzen wie die Checks in workout_sets. */
export const SET_LIMITS = { weightKg: 1000, reps: 1000 } as const

export function parseSet(set: SetEntry): ParsedSet | null {
  const weight = parseNumber(set.weight === '' ? '0' : set.weight)
  const reps = parseNumber(set.reps)
  if (weight === null || weight > SET_LIMITS.weightKg) return null
  if (reps === null || reps > SET_LIMITS.reps || !Number.isInteger(reps)) return null
  return { weightKg: Math.round(weight * 100) / 100, reps }
}

export function loggedSets(entries: readonly ExerciseEntry[]): LoggedSet[] {
  return entries.flatMap((e) => e.sets.filter((s) => s.loggedId !== null).flatMap((s) => {
    const parsed = parseSet(s)
    return parsed ? [parsed] : []
  }))
}
