import type { ExerciseType } from '../plan/exercises'

export interface LoggedSet {
  readonly weightKg: number | null
  readonly reps: number | null
}

export interface ProgressionInput {
  readonly lastSets: readonly LoggedSet[]
  readonly repMin: number
  readonly repMax: number
  readonly type: ExerciseType
  /** Geplante Satzzahl. Nur wenn mindestens so viele Sätze geschafft wurden, steigt das Gewicht. */
  readonly plannedSets: number
  /** Startgewicht aus dem Plan; wird nur ohne Verlauf vorgeschlagen. */
  readonly startWeightKg?: number | null
}

export interface Suggestion {
  /** null = noch kein Verlauf, Gewicht muss selbst gewählt werden. */
  readonly weightKg: number | null
  readonly targetReps: number
  readonly reason: 'neu' | 'mehr_gewicht' | 'mehr_wiederholungen'
}

export const INCREMENT_KG: Record<ExerciseType, number> = { grund: 2.5, isolation: 1 }

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Das am häufigsten genutzte Gewicht; bei Gleichstand das höhere. */
export function mostUsedWeight(sets: readonly LoggedSet[]): number {
  const counts = sets.reduce((map, s) => {
    const w = s.weightKg ?? 0
    return new Map(map).set(w, (map.get(w) ?? 0) + 1)
  }, new Map<number, number>())
  return [...counts.entries()].reduce((best, [w, n]) => {
    const bestCount = counts.get(best) ?? 0
    return n > bestCount || (n === bestCount && w > best) ? w : best
  }, sets[0]?.weightKg ?? 0)
}

/**
 * Doppelte Progression: Das Gewicht steigt nur, wenn beim letzten Mal mindestens
 * die geplante Zahl an Sätzen geschafft wurde und alle mit demselben (höchsten)
 * Gewicht das obere Ende des Wiederholungsbereichs erreicht haben. Dann fällt das
 * Ziel auf rep_min zurück. Sonst bleibt das überwiegend genutzte Gewicht und das
 * Ziel steigt um eine Wiederholung (höchstens bis rep_max).
 */
export function suggestNext({ lastSets, repMin, repMax, type, plannedSets, startWeightKg = null }: ProgressionInput): Suggestion {
  const done = lastSets.filter((s) => s.reps !== null)
  if (done.length === 0) return { weightKg: startWeightKg, targetReps: repMin, reason: 'neu' }

  const top = Math.max(...done.map((s) => s.weightKg ?? 0))
  const complete = done.length >= plannedSets
  const sameWeight = done.every((s) => (s.weightKg ?? 0) === top)
  const allAtMax = done.every((s) => (s.reps ?? 0) >= repMax)

  if (complete && sameWeight && allAtMax) {
    if (top > 0) return { weightKg: round2(top + INCREMENT_KG[type]), targetReps: repMin, reason: 'mehr_gewicht' }
    // Körpergewicht: ohne Zusatzlast weiter über Wiederholungen steigern.
    const minReps = Math.min(...done.map((s) => s.reps ?? 0))
    return { weightKg: 0, targetReps: minReps + 1, reason: 'mehr_wiederholungen' }
  }

  const weight = mostUsedWeight(done)
  const atWeight = done.filter((s) => (s.weightKg ?? 0) === weight)
  const minReps = Math.min(...atWeight.map((s) => s.reps ?? 0))
  return {
    weightKg: weight,
    targetReps: Math.min(repMax, Math.max(repMin, minReps + 1)),
    reason: 'mehr_wiederholungen',
  }
}
