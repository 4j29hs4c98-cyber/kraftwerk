import { describe, expect, it } from 'vitest'
import { localDaysBetween, pauseStatus } from './pause'

const NOW = new Date(2026, 9, 27, 8, 0)
const daysAgo = (n: number, hour = 20): Date => new Date(2026, 9, 27 - n, hour, 0)

describe('localDaysBetween', () => {
  it('counts calendar days, not 24-hour blocks', () => {
    expect(localDaysBetween(new Date(2026, 9, 26, 23, 30), new Date(2026, 9, 27, 0, 30))).toBe(1)
    // Zeitumstellung am 25.10.2026
    expect(localDaysBetween(new Date(2026, 9, 24, 12), new Date(2026, 9, 26, 12))).toBe(2)
  })
})

describe('pauseStatus', () => {
  it('is hidden without any training', () => {
    expect(pauseStatus([], NOW)).toBeNull()
  })

  it('uses the most recent date regardless of order', () => {
    expect(pauseStatus([daysAgo(10), daysAgo(3), daysAgo(20)], NOW)?.days).toBe(3)
  })

  it('labels today and yesterday', () => {
    expect(pauseStatus([new Date(2026, 9, 27, 7)], NOW)?.label).toBe('Letztes Training heute')
    expect(pauseStatus([daysAgo(1)], NOW)?.label).toBe('Letztes Training gestern')
    expect(pauseStatus([daysAgo(9)], NOW)?.label).toBe('Letztes Training vor 9 Tagen')
  })

  it.each([
    [0, 'gruen'],
    [7, 'gruen'],
    [8, 'gelb'],
    [14, 'gelb'],
    [15, 'orange'],
    [21, 'orange'],
    [22, 'rot'],
    [90, 'rot'],
  ] as const)('%i days -> %s', (days, level) => {
    expect(pauseStatus([daysAgo(days)], NOW)?.level).toBe(level)
  })

  it('mentions muscle memory from day 22', () => {
    expect(pauseStatus([daysAgo(22)], NOW)?.message).toContain('Muskelgedächtnis')
  })
})
