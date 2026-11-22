import { buildEntry, adHocSpec, extraKeys, pickLibrary, type ExerciseEntry, type ExerciseSpec, type ExistingSet } from './session'
import type { LoggedSet } from './progression'

/*
 * Der Aufbau des heutigen Trainings (getauschte, hinzugefügte Übungen, Satzzahlen) liegt nur lokal,
 * je Workout-id. Der Plan selbst bleibt unverändert; ohne Layout gilt wieder der Plan.
 */

const KEY_PATTERN = /^(custom:)?[a-z0-9_]{1,60}$/
const STORAGE_PREFIX = 'kraftwerk:workout-layout:'
const MAX_EXERCISES = 100
const MAX_SETS = 100

export function serializeLayout(entries: readonly ExerciseEntry[]): string {
  return JSON.stringify({
    v: 1,
    exercises: entries.map((e) => ({
      key: e.key,
      displayName: e.displayName,
      repMin: e.repMin,
      repMax: e.repMax,
      sets: e.sets.length,
      restSeconds: e.restSeconds,
      notes: e.notes,
      startWeightKg: e.startWeightKg,
    })),
  })
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Liest ein gespeichertes Layout; ungültige oder fremde Daten ergeben null. */
export function parseLayout(text: string | null): ExerciseSpec[] | null {
  if (!text) return null
  try {
    const data: unknown = JSON.parse(text)
    if (typeof data !== 'object' || data === null || (data as { v?: unknown }).v !== 1) return null
    const list = (data as { exercises?: unknown }).exercises
    if (!Array.isArray(list) || list.length > MAX_EXERCISES) return null
    const specs: ExerciseSpec[] = []
    for (const raw of list as unknown[]) {
      if (typeof raw !== 'object' || raw === null) return null
      const r = raw as Record<string, unknown>
      if (typeof r.key !== 'string' || !KEY_PATTERN.test(r.key)) return null
      if (!isNum(r.repMin) || !isNum(r.repMax) || !isNum(r.sets) || r.sets < 1 || r.sets > MAX_SETS) return null
      if (specs.some((s) => s.key === r.key)) return null
      specs.push({
        uid: `adhoc:${r.key}`,
        key: r.key,
        displayName: strOrNull(r.displayName),
        notes: strOrNull(r.notes),
        repMin: r.repMin,
        repMax: r.repMax,
        sets: Math.floor(r.sets),
        restSeconds: numOrNull(r.restSeconds),
        startWeightKg: numOrNull(r.startWeightKg),
      })
    }
    return specs
  } catch {
    return null
  }
}

/** Schlüssel, für die der Verlauf geladen werden muss: Layout (sonst Plan) plus nur geloggte Übungen. */
export function sessionKeys(planKeys: readonly string[], layout: readonly ExerciseSpec[] | null, existing: readonly ExistingSet[]): string[] {
  const base = layout ? layout.map((s) => s.key) : [...planKeys]
  return [...base, ...extraKeys(base, existing)]
}

/** Einträge aus dem Layout, danach geloggte Übungen, die im Layout fehlen. */
export function buildEntriesFromLayout(
  layout: readonly ExerciseSpec[],
  lastSets: ReadonlyMap<string, readonly LoggedSet[]>,
  existing: readonly ExistingSet[],
): ExerciseEntry[] {
  const fromLayout = layout.map((spec) => buildEntry(spec, lastSets.get(spec.key) ?? [], existing))
  const extras = extraKeys(layout.map((s) => s.key), existing).map((key) => buildEntry(adHocSpec(pickLibrary(key)), lastSets.get(key) ?? [], existing))
  return [...fromLayout, ...extras]
}

export function loadLayout(workoutId: string): ExerciseSpec[] | null {
  try {
    return parseLayout(localStorage.getItem(STORAGE_PREFIX + workoutId))
  } catch {
    return null
  }
}

export function saveLayout(workoutId: string, entries: readonly ExerciseEntry[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + workoutId, serializeLayout(entries))
  } catch {
    // Speicher gesperrt oder voll: das Training läuft trotzdem, nur der Aufbau geht beim Neuladen verloren.
  }
}

export function clearLayout(workoutId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + workoutId)
  } catch {
    // nichts zu tun
  }
}
