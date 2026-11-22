import { customKey, defaultRestSeconds, getExercise, HOLD_SECONDS, isTimed } from '../plan/exercises'
import type { PlanExerciseRow } from '../plan/api'
import { parseNumber } from '../profile/body'
import { suggestNext, type LoggedSet, type Suggestion } from './progression'

export interface SetEntry {
  readonly weight: string
  readonly reps: string
  /** Kennung des gespeicherten Satzes (Server-id oder lokal vergeben), null = noch nicht abgehakt. */
  readonly loggedId: string | null
  readonly saving: boolean
}

/** Was für ein Training zählt: Planübung oder spontan gewählte Übung, mit festen Zielwerten. */
export interface ExerciseSpec {
  /** Stabil innerhalb der Sitzung, dient als React-key. */
  readonly uid: string
  readonly key: string
  readonly displayName: string | null
  readonly notes: string | null
  readonly repMin: number
  readonly repMax: number
  readonly sets: number
  readonly restSeconds: number | null
  readonly startWeightKg: number | null
}

export interface ExerciseEntry extends Omit<ExerciseSpec, 'sets'> {
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
  /** Optional; bestimmt die Reihenfolge spontan hinzugefügter Übungen beim Fortsetzen. */
  readonly created_at?: string
}

/** Auswahl aus dem ExercisePicker: Bibliotheksschlüssel oder eigene Übung mit Namen. */
export interface ExercisePick {
  readonly key: string
  readonly displayName: string | null
}

const DEFAULT_SETS = 3

const formatWeight = (kg: number): string => String(kg).replace('.', ',')

export const pickLibrary = (key: string): ExercisePick => ({ key, displayName: null })

export function pickCustom(name: string): ExercisePick {
  return { key: customKey(name), displayName: name.trim() }
}

export function planSpec(row: PlanExerciseRow): ExerciseSpec {
  const repMin = row.rep_min ?? 8
  return {
    uid: row.id,
    key: row.exercise_key,
    displayName: row.display_name,
    notes: row.notes,
    repMin,
    repMax: row.rep_max ?? Math.max(repMin, 12),
    sets: row.sets ?? DEFAULT_SETS,
    restSeconds: row.rest_seconds,
    startWeightKg: row.start_weight_kg,
  }
}

/** Spontan gewählte Übung mit denselben Standardwerten wie im Plan-Editor. */
export function adHocSpec(pick: ExercisePick): ExerciseSpec {
  const timed = isTimed(pick.key)
  return {
    uid: `adhoc:${pick.key}`,
    key: pick.key,
    displayName: pick.displayName,
    notes: null,
    repMin: timed ? HOLD_SECONDS.min : 8,
    repMax: timed ? HOLD_SECONDS.max : 12,
    sets: DEFAULT_SETS,
    restSeconds: defaultRestSeconds(pick.key),
    startWeightKg: null,
  }
}

/** Eine Übung mit Vorschlag aus dem letzten Mal; bereits geloggte Sätze haben Vorrang und erweitern die Satzzahl. */
export function buildEntry(spec: ExerciseSpec, history: readonly LoggedSet[], existing: readonly ExistingSet[]): ExerciseEntry {
  const { key, repMin, repMax } = spec
  const own = existing.filter((s) => s.exercise_key === key)
  const setCount = own.reduce((max, s) => Math.max(max, s.set_index + 1), spec.sets)
  const suggestion = suggestNext({ lastSets: history, repMin, repMax, type: getExercise(key)?.type ?? 'isolation', plannedSets: setCount, startWeightKg: spec.startWeightKg })
  const sets = Array.from({ length: setCount }, (_, index): SetEntry => {
    const logged = own.find((s) => s.set_index === index)
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
  const { sets: _planned, ...rest } = spec
  return { ...rest, suggestion, lastSets: history, sets }
}

/** Schlüssel geloggter Sätze, die nicht zu einer Planübung gehören, in Reihenfolge des ersten Satzes. */
export function extraKeys(planKeys: readonly string[], existing: readonly ExistingSet[]): string[] {
  const known = new Set(planKeys)
  const sorted = [...existing].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  return [...new Set(sorted.map((s) => s.exercise_key))].filter((key) => !known.has(key))
}

/** Baut die Eingabezeilen: Planübungen zuerst, danach spontan geloggte Übungen, die nur als Sätze existieren. */
export function buildEntries(
  exercises: readonly PlanExerciseRow[],
  lastSets: ReadonlyMap<string, readonly LoggedSet[]>,
  existing: readonly ExistingSet[],
): ExerciseEntry[] {
  const planned = exercises.map((row) => buildEntry(planSpec(row), lastSets.get(row.exercise_key) ?? [], existing))
  const extras = extraKeys(exercises.map((e) => e.exercise_key), existing).map((key) => buildEntry(adHocSpec(pickLibrary(key)), lastSets.get(key) ?? [], existing))
  return [...planned, ...extras]
}

/** Tauscht die Übung mit dieser uid; ändert nichts, wenn sie fehlt oder der neue Schlüssel schon vorkommt. */
export function swapExercise(entries: readonly ExerciseEntry[], uid: string, replacement: ExerciseEntry): ExerciseEntry[] {
  const duplicate = entries.some((e) => e.uid !== uid && e.key === replacement.key)
  if (duplicate || !entries.some((e) => e.uid === uid)) return [...entries]
  return entries.map((entry) => (entry.uid === uid ? replacement : entry))
}

/** Hängt eine Übung an; ein schon vorhandener Schlüssel wird nie doppelt aufgenommen. */
export function appendExercise(entries: readonly ExerciseEntry[], added: ExerciseEntry): ExerciseEntry[] {
  return entries.some((e) => e.key === added.key) ? [...entries] : [...entries, added]
}

const mapEntry = (entries: readonly ExerciseEntry[], index: number, fn: (entry: ExerciseEntry) => ExerciseEntry): ExerciseEntry[] =>
  entries.map((entry, i) => (i === index ? fn(entry) : entry))

/** Neuer Satz mit den Werten des letzten Satzes (oder dem Vorschlag, falls es keinen gibt). */
export function addSet(entries: readonly ExerciseEntry[], index: number): ExerciseEntry[] {
  return mapEntry(entries, index, (entry) => {
    const last = entry.sets[entry.sets.length - 1]
    const fresh: SetEntry = last
      ? { weight: last.weight, reps: last.reps, loggedId: null, saving: false }
      : { weight: entry.suggestion.weightKg === null ? '' : formatWeight(entry.suggestion.weightKg), reps: String(entry.suggestion.targetReps), loggedId: null, saving: false }
    return { ...entry, sets: [...entry.sets, fresh] }
  })
}

/** Entfernt nur den letzten Satz; einer bleibt immer stehen. Geloggte Sätze müssen vorher gelöscht werden. */
export function removeLastSet(entries: readonly ExerciseEntry[], index: number): ExerciseEntry[] {
  return mapEntry(entries, index, (entry) => (entry.sets.length <= 1 ? entry : { ...entry, sets: entry.sets.slice(0, -1) }))
}

export const hasLoggedSets = (entry: ExerciseEntry): boolean => entry.sets.some((s) => s.loggedId !== null)

/** Satznummern (0-basiert) der geloggten Sätze, die beim Tauschen gelöscht werden. */
export function loggedKeysToDelete(entry: ExerciseEntry): number[] {
  return entry.sets.flatMap((s, i) => (s.loggedId !== null ? [i] : []))
}

/** Wie updateSet, aber über die uid der Übung: bleibt richtig, auch wenn sich die Reihenfolge ändert. */
export function updateSetByUid(entries: readonly ExerciseEntry[], uid: string, setIndex: number, patch: Partial<SetEntry>): ExerciseEntry[] {
  return entries.map((entry) =>
    entry.uid !== uid ? entry : { ...entry, sets: entry.sets.map((set, j) => (j === setIndex ? { ...set, ...patch } : set)) },
  )
}

export const hasSavingSet = (entry: ExerciseEntry): boolean => entry.sets.some((s) => s.saving)

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
  return parseSetValues(set.weight, set.reps)
}

/** Prüft Gewicht (leer = 0 kg) und Wiederholungen aus Eingabefeldern wie im Workout. */
export function parseSetValues(weightText: string, repsText: string): ParsedSet | null {
  const weight = parseNumber(weightText === '' ? '0' : weightText)
  const reps = parseNumber(repsText)
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
