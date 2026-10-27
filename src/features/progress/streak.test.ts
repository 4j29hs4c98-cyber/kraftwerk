import { describe, expect, it } from 'vitest'
import { trainingDaysInMonth, weekStreak } from './streak'

// 27.10.2026 ist ein Dienstag
const today = new Date(2026, 9, 27, 12)
const d = (month: number, day: number): Date => new Date(2026, month - 1, day, 18)

describe('weekStreak', () => {
  it('is 0 without workouts', () => {
    expect(weekStreak([], today)).toBe(0)
  })

  it('counts the current week', () => {
    expect(weekStreak([d(10, 26)], today)).toBe(1)
  })

  it('counts consecutive weeks including the current one', () => {
    expect(weekStreak([d(10, 27), d(10, 20), d(10, 18), d(10, 12)], today)).toBe(3)
  })

  it('keeps the streak alive if the current week has no workout yet', () => {
    expect(weekStreak([d(10, 20), d(10, 13)], today)).toBe(2)
  })

  it('breaks on a missing week', () => {
    expect(weekStreak([d(10, 26), d(10, 12), d(10, 5)], today)).toBe(1)
  })

  it('is 0 when the last workout is two weeks ago', () => {
    expect(weekStreak([d(10, 12)], today)).toBe(0)
  })

  it('treats Sunday as part of the week starting Monday', () => {
    // So 25.10. gehört zur Woche ab 19.10.
    expect(weekStreak([d(10, 25), d(10, 26)], today)).toBe(2)
  })

  it('counts multiple workouts in one week once', () => {
    expect(weekStreak([d(10, 26), d(10, 27), d(10, 27)], today)).toBe(1)
  })
})

describe('trainingDaysInMonth', () => {
  it('returns only days of the given month', () => {
    const days = trainingDaysInMonth([d(10, 1), d(10, 27), d(9, 30)], 2026, 9)
    expect([...days].sort()).toEqual(['2026-10-01', '2026-10-27'])
  })
})
