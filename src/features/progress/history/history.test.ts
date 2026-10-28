import { describe, expect, it } from 'vitest'
import { parseSetValues } from '../../workout/session'
import { groupSetsByExercise, nextSetIndex, workoutDurationMs, workoutVolume, type HistorySet } from './history'

const set = (exercise_key: string, set_index: number, weight_kg: number | null = 50, reps: number | null = 10): HistorySet => ({
  id: `${exercise_key}-${set_index}`,
  exercise_key,
  set_index,
  weight_kg,
  reps,
})

describe('groupSetsByExercise', () => {
  it('follows the plan order, keeps empty plan exercises and appends extra ones', () => {
    const groups = groupSetsByExercise(
      [set('custom:extra', 0), set('latzug', 1), set('latzug', 0)],
      [
        { exercise_key: 'latzug', display_name: null, position: 1 },
        { exercise_key: 'custom:meine_uebung', display_name: 'Meine Übung', position: 0 },
      ],
    )
    expect(groups.map((g) => g.exerciseKey)).toEqual(['custom:meine_uebung', 'latzug', 'custom:extra'])
    expect(groups[0]?.name).toBe('Meine Übung')
    expect(groups[0]?.sets).toEqual([])
    expect(groups[1]?.sets.map((s) => s.set_index)).toEqual([0, 1])
  })
})

describe('nextSetIndex', () => {
  it('uses the highest index plus one and starts at zero', () => {
    expect(nextSetIndex([set('a', 0), set('a', 3), set('b', 7)], 'a')).toBe(4)
    expect(nextSetIndex([set('b', 0)], 'a')).toBe(0)
  })
})

describe('workoutVolume', () => {
  it('sums weight times reps and ignores missing values', () => {
    expect(workoutVolume([set('a', 0, 50, 10), set('a', 1, 52.5, 8), set('a', 2, null, 10)])).toBe(920)
  })
})

describe('workoutDurationMs', () => {
  it('returns the duration or null', () => {
    expect(workoutDurationMs('2026-10-27T10:00:00Z', '2026-10-27T11:05:00Z')).toBe(65 * 60000)
    expect(workoutDurationMs('2026-10-27T10:00:00Z', null)).toBeNull()
    expect(workoutDurationMs('2026-10-27T10:00:00Z', '2026-10-27T09:00:00Z')).toBeNull()
  })
})

describe('parseSetValues (validation like in the workout)', () => {
  it('accepts German decimals and empty weight as bodyweight', () => {
    expect(parseSetValues('52,5', '8')).toEqual({ weightKg: 52.5, reps: 8 })
    expect(parseSetValues('', '12')).toEqual({ weightKg: 0, reps: 12 })
  })
  it('rejects broken input and values above the limits', () => {
    expect(parseSetValues('abc', '8')).toBeNull()
    expect(parseSetValues('50', '8,5')).toBeNull()
    expect(parseSetValues('1001', '8')).toBeNull()
    expect(parseSetValues('50', '')).toBeNull()
  })
})
