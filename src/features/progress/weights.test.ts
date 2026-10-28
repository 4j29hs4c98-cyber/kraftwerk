import { describe, expect, it } from 'vitest'
import { parseBodyFat, sortChronologically } from './weights'

describe('sortChronologically', () => {
  it('turns the newest-first query result into an ascending series', () => {
    const newestFirst = [{ measured_on: '2026-10-27' }, { measured_on: '2026-10-20' }, { measured_on: '2025-12-31' }]
    expect(sortChronologically(newestFirst).map((r) => r.measured_on)).toEqual(['2025-12-31', '2026-10-20', '2026-10-27'])
  })

  it('does not mutate the input', () => {
    const input = [{ measured_on: '2026-10-27' }, { measured_on: '2026-10-01' }]
    const snapshot = [...input]
    sortChronologically(input)
    expect(input).toEqual(snapshot)
  })

  it('returns an empty array for no rows', () => {
    expect(sortChronologically([])).toEqual([])
  })
})

describe('parseBodyFat', () => {
  it('is optional and accepts German decimals between 3 and 60 %', () => {
    expect(parseBodyFat('')).toBeNull()
    expect(parseBodyFat('18,46')).toBe(18.5)
    expect(parseBodyFat('3')).toBe(3)
    expect(parseBodyFat('60')).toBe(60)
  })
  it('rejects values outside the range and text', () => {
    expect(parseBodyFat('2,9')).toBeUndefined()
    expect(parseBodyFat('61')).toBeUndefined()
    expect(parseBodyFat('viel')).toBeUndefined()
  })
})
