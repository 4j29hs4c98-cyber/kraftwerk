import { describe, expect, it } from 'vitest'
import { mostUsedWeight, suggestNext } from './progression'

const range = { repMin: 8, repMax: 12, plannedSets: 2 }

describe('suggestNext', () => {
  it('without history: no weight, target rep_min', () => {
    expect(suggestNext({ ...range, type: 'grund', lastSets: [] })).toEqual({ weightKg: null, targetReps: 8, reason: 'neu' })
  })

  it('all sets at rep_max on a compound lift: +2.5 kg and back to rep_min', () => {
    const lastSets = [
      { weightKg: 60, reps: 12 },
      { weightKg: 60, reps: 12 },
      { weightKg: 60, reps: 13 },
    ]
    expect(suggestNext({ ...range, plannedSets: 3, type: 'grund', lastSets })).toEqual({ weightKg: 62.5, targetReps: 8, reason: 'mehr_gewicht' })
  })

  it('review case 1: fewer sets than planned keeps the weight even if all were at rep_max', () => {
    const lastSets = [{ weightKg: 60, reps: 12 }, { weightKg: 60, reps: 12 }]
    expect(suggestNext({ ...range, plannedSets: 3, type: 'grund', lastSets })).toEqual({ weightKg: 60, targetReps: 12, reason: 'mehr_wiederholungen' })
  })

  it('review case 2: mixed weights keep the mostly used weight instead of increasing from the heaviest set', () => {
    const lastSets = [
      { weightKg: 70, reps: 12 },
      { weightKg: 60, reps: 12 },
      { weightKg: 60, reps: 12 },
    ]
    expect(suggestNext({ ...range, plannedSets: 3, type: 'grund', lastSets })).toEqual({ weightKg: 60, targetReps: 12, reason: 'mehr_wiederholungen' })
  })

  it('mixed weights below rep_max: same mostly used weight, +1 rep from its weakest set', () => {
    const lastSets = [
      { weightKg: 50, reps: 10 },
      { weightKg: 50, reps: 9 },
      { weightKg: 45, reps: 8 },
    ]
    expect(suggestNext({ ...range, plannedSets: 3, type: 'grund', lastSets })).toEqual({ weightKg: 50, targetReps: 10, reason: 'mehr_wiederholungen' })
  })

  it('all sets at rep_max on an isolation exercise: +1 kg', () => {
    const lastSets = [{ weightKg: 12.5, reps: 12 }, { weightKg: 12.5, reps: 12 }]
    expect(suggestNext({ ...range, type: 'isolation', lastSets }).weightKg).toBe(13.5)
  })

  it('one set short of rep_max: same weight, target +1 rep from the weakest set', () => {
    const lastSets = [{ weightKg: 60, reps: 12 }, { weightKg: 60, reps: 10 }]
    expect(suggestNext({ ...range, type: 'grund', lastSets })).toEqual({ weightKg: 60, targetReps: 11, reason: 'mehr_wiederholungen' })
  })

  it('never targets more than rep_max or fewer than rep_min while progressing reps', () => {
    expect(suggestNext({ ...range, type: 'grund', lastSets: [{ weightKg: 50, reps: 4 }] }).targetReps).toBe(8)
    expect(suggestNext({ ...range, type: 'grund', lastSets: [{ weightKg: 50, reps: 11 }, { weightKg: 50, reps: 12 }] }).targetReps).toBe(12)
  })

  it('bodyweight exercises keep progressing via reps', () => {
    const lastSets = [{ weightKg: 0, reps: 12 }, { weightKg: null, reps: 12 }]
    expect(suggestNext({ ...range, type: 'grund', lastSets })).toEqual({ weightKg: 0, targetReps: 13, reason: 'mehr_wiederholungen' })
  })

  it('mostUsedWeight prefers the higher weight on a tie', () => {
    expect(mostUsedWeight([{ weightKg: 50, reps: 8 }, { weightKg: 55, reps: 8 }])).toBe(55)
    expect(mostUsedWeight([{ weightKg: 50, reps: 8 }, { weightKg: 50, reps: 8 }, { weightKg: 55, reps: 8 }])).toBe(50)
  })

  it('uses the start weight only without history', () => {
    expect(suggestNext({ ...range, type: 'grund', lastSets: [], startWeightKg: 40 })).toEqual({ weightKg: 40, targetReps: 8, reason: 'neu' })
    expect(suggestNext({ ...range, type: 'grund', lastSets: [{ weightKg: 50, reps: 9 }, { weightKg: 50, reps: 9 }], startWeightKg: 40 }).weightKg).toBe(50)
  })

  it('ignores sets without reps', () => {
    expect(suggestNext({ ...range, type: 'grund', lastSets: [{ weightKg: 40, reps: null }] }).reason).toBe('neu')
  })
})
