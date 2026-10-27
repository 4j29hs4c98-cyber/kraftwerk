import type { LoggedSet } from './progression'

export function totalVolume(sets: readonly LoggedSet[]): number {
  return Math.round(sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0))
}
