import { describe, expect, it } from 'vitest'
import type { PlanExerciseRow } from '../plan/api'
import { buildEntries, loggedSets, parseSet, updateSet } from './session'
import { totalVolume } from './summary'

const row = (key: string, sets = 3): PlanExerciseRow => ({
  id: key,
  plan_day_id: 'd',
  user_id: 'u',
  exercise_key: key,
  position: 0,
  sets,
  rep_min: 8,
  rep_max: 12,
  rest_seconds: 90,
  created_at: '',
  display_name: null,
  notes: null,
  start_weight_kg: null,
})

describe('buildEntries', () => {
  it('prefills from the progression suggestion', () => {
    const last = new Map([['kniebeuge_lh', [{ weightKg: 100, reps: 12 }, { weightKg: 100, reps: 12 }, { weightKg: 100, reps: 12 }]]])
    const [entry] = buildEntries([row('kniebeuge_lh')], last, [])
    expect(entry?.sets).toHaveLength(3)
    expect(entry?.sets[0]).toEqual({ weight: '102,5', reps: '8', loggedId: null, saving: false })
  })

  it('leaves weight empty without history', () => {
    const [entry] = buildEntries([row('curls_kh', 2)], new Map(), [])
    expect(entry?.sets[1]).toMatchObject({ weight: '', reps: '8' })
  })

  it('suggests the start weight from the plan when there is no history', () => {
    const [entry] = buildEntries([{ ...row('custom:schraege_brustpresse'), start_weight_kg: 25 }], new Map(), [])
    expect(entry?.sets[0]).toMatchObject({ weight: '25', reps: '8' })
  })

  it('restores already logged sets when resuming', () => {
    const [entry] = buildEntries([row('curls_kh')], new Map(), [{ id: 'x', exercise_key: 'curls_kh', set_index: 1, weight_kg: 12.5, reps: 10 }])
    expect(entry?.sets[1]).toEqual({ weight: '12,5', reps: '10', loggedId: 'x', saving: false })
    expect(entry?.sets[0]?.loggedId).toBeNull()
  })
})

describe('updateSet', () => {
  it('returns a new structure without mutating the input', () => {
    const entries = buildEntries([row('curls_kh')], new Map(), [])
    const next = updateSet(entries, 0, 1, { reps: '11' })
    expect(next[0]?.sets[1]?.reps).toBe('11')
    expect(entries[0]?.sets[1]?.reps).toBe('8')
  })
})

describe('parseSet and volume', () => {
  it('accepts German decimal commas and treats an empty weight as bodyweight', () => {
    expect(parseSet({ weight: '22,5', reps: '10', loggedId: null, saving: false })).toEqual({ weightKg: 22.5, reps: 10 })
    expect(parseSet({ weight: '', reps: '15', loggedId: null, saving: false })).toEqual({ weightKg: 0, reps: 15 })
    expect(parseSet({ weight: 'abc', reps: '10', loggedId: null, saving: false })).toBeNull()
    expect(parseSet({ weight: '10', reps: '', loggedId: null, saving: false })).toBeNull()
  })

  it('rejects values above the database limits', () => {
    expect(parseSet({ weight: '1000', reps: '1000', loggedId: null, saving: false })).toEqual({ weightKg: 1000, reps: 1000 })
    expect(parseSet({ weight: '1000,5', reps: '10', loggedId: null, saving: false })).toBeNull()
    expect(parseSet({ weight: '10', reps: '1001', loggedId: null, saving: false })).toBeNull()
    expect(parseSet({ weight: '10', reps: '8,5', loggedId: null, saving: false })).toBeNull()
  })

  it('sums weight x reps of logged sets only', () => {
    const entries = updateSet(updateSet(buildEntries([row('curls_kh', 2)], new Map(), []), 0, 0, { weight: '10', reps: '10', loggedId: 'a' }), 0, 1, { weight: '10', reps: '8' })
    expect(totalVolume(loggedSets(entries))).toBe(100)
  })
})
