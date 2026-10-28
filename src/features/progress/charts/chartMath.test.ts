import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  formatSigned,
  linearScale,
  movingAverage,
  niceTicks,
  parseExerciseProgress,
  strengthSummary,
  weightTrendSummary,
} from './chartMath'

describe('daysBetween', () => {
  it('counts calendar days across the DST switch', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(daysBetween('2026-10-26', '2026-10-24')).toBe(-2)
  })
})

describe('movingAverage', () => {
  it('averages the last 7 calendar days including the day itself', () => {
    const points = [
      { date: '2026-10-01', value: 80 },
      { date: '2026-10-04', value: 82 },
      { date: '2026-10-07', value: 81 },
      { date: '2026-10-08', value: 79 },
    ]
    expect(movingAverage(points).map((p) => p.value)).toEqual([80, 81, 81, 80.67])
  })
  it('returns a new array and leaves the input alone', () => {
    const points = [{ date: '2026-10-01', value: 80 }]
    const result = movingAverage(points)
    expect(result).not.toBe(points)
    expect(points).toEqual([{ date: '2026-10-01', value: 80 }])
  })
})

describe('linearScale', () => {
  it('maps domain to range, including inverted ranges', () => {
    const y = linearScale([0, 100], [200, 0])
    expect(y(0)).toBe(200)
    expect(y(50)).toBe(100)
  })
  it('centres a flat domain', () => {
    expect(linearScale([5, 5], [0, 10])(5)).toBe(5)
  })
})

describe('niceTicks', () => {
  it('produces round ticks that include the data', () => {
    expect(niceTicks(77.3, 81.9)).toEqual({ min: 76, max: 82, ticks: [76, 78, 80, 82] })
    const wide = niceTicks(40, 120)
    expect(wide.min).toBeLessThanOrEqual(40)
    expect(wide.max).toBeGreaterThanOrEqual(120)
    expect(wide.ticks).toEqual([40, 60, 80, 100, 120])
  })
  it('widens a single value', () => {
    const t = niceTicks(80, 80)
    expect(t.min).toBeLessThan(80)
    expect(t.max).toBeGreaterThan(80)
  })
})

describe('formatSigned', () => {
  it('uses plus, a real minus sign and German decimals', () => {
    expect(formatSigned(7.5, 'kg')).toBe('+7,5 kg')
    expect(formatSigned(-1.24, 'kg')).toBe('−1,2 kg')
    expect(formatSigned(0.01, 'kg')).toBe('±0 kg')
  })
})

describe('strengthSummary', () => {
  it('compares first and last session', () => {
    const points = [
      { date: '2026-09-01', value: 62.5 },
      { date: '2026-09-15', value: 65 },
      { date: '2026-10-20', value: 70 },
    ]
    expect(strengthSummary('Latzug', points)).toBe('Latzug +7,5 kg seit Start')
  })
  it('handles one or no session', () => {
    expect(strengthSummary('Latzug', [{ date: '2026-09-01', value: 60 }])).toBe('Latzug: erste Einheit mit 60 kg')
    expect(strengthSummary('Latzug', [])).toBeNull()
  })
})

describe('weightTrendSummary', () => {
  it('describes the change of the 7-day average over the last 4 weeks', () => {
    const points = [
      { date: '2026-08-01', value: 90 },
      { date: '2026-09-29', value: 82 },
      { date: '2026-10-13', value: 81.5 },
      { date: '2026-10-27', value: 80.8 },
    ]
    expect(weightTrendSummary(points)).toBe('−1,2 kg in 4 Wochen')
  })
  it('uses days for short histories and needs two points', () => {
    expect(weightTrendSummary([{ date: '2026-10-20', value: 80 }, { date: '2026-10-23', value: 79 }])).toBe('−0,5 kg in 3 Tagen')
    expect(weightTrendSummary([{ date: '2026-10-20', value: 80 }])).toBeNull()
  })
})

describe('parseExerciseProgress', () => {
  it('accepts numbers and numeric strings and drops broken rows', () => {
    expect(
      parseExerciseProgress([
        { date: '2026-10-20', max_weight_kg: 100, best_e1rm: 120 },
        { date: '2026-10-22', max_weight_kg: '102.5', best_e1rm: '123.0' },
        { date: 'gestern', max_weight_kg: 1, best_e1rm: 1 },
        { date: '2026-10-23', max_weight_kg: null, best_e1rm: 1 },
        'kaputt',
      ]),
    ).toEqual([
      { date: '2026-10-20', maxWeightKg: 100, bestE1rm: 120 },
      { date: '2026-10-22', maxWeightKg: 102.5, bestE1rm: 123 },
    ])
    expect(parseExerciseProgress(null)).toEqual([])
  })
})
