import { describe, expect, it } from 'vitest'
import { sortChronologically } from './weights'

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
