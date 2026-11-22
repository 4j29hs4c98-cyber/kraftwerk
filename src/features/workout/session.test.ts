import { describe, expect, it } from 'vitest'
import type { PlanExerciseRow } from '../plan/api'
import { addSet, appendExercise, buildEntries, buildEntry, adHocSpec, hasLoggedSets, loggedKeysToDelete, updateSetByUid, pickCustom, pickLibrary, removeLastSet, swapExercise, loggedSets, parseSet, updateSet } from './session'
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

const logged = (key: string, index: number, id = `${key}-${index}`, createdAt = '') => ({ id, exercise_key: key, set_index: index, weight_kg: 20, reps: 10, created_at: createdAt })

describe('buildEntries with logged sets outside the plan', () => {
  it('appends exercises that only exist as logged sets, in order of first logged set', () => {
    const existing = [logged('custom:b', 0, 'b0', '2026-01-01T10:05'), logged('custom:a', 0, 'a0', '2026-01-01T10:01'), logged('custom:a', 1, 'a1', '2026-01-01T10:02')]
    const entries = buildEntries([row('curls_kh')], new Map(), existing)
    expect(entries.map((e) => e.key)).toEqual(['curls_kh', 'custom:a', 'custom:b'])
    expect(entries[1]?.sets.map((s) => s.loggedId)).toEqual(['a0', 'a1', null])
  })

  it('shows set indices beyond the planned count', () => {
    const [entry] = buildEntries([row('curls_kh', 2)], new Map(), [logged('curls_kh', 3)])
    expect(entry?.sets).toHaveLength(4)
    expect(entry?.sets[3]?.loggedId).toBe('curls_kh-3')
    expect(entry?.sets[2]?.loggedId).toBeNull()
  })

  it('names ad-hoc exercises from the key and uses default targets', () => {
    const [entry] = buildEntries([], new Map(), [logged('custom:schraege_brustpresse', 0)])
    expect(entry).toMatchObject({ key: 'custom:schraege_brustpresse', repMin: 8, repMax: 12 })
  })
})

describe('swap, add and remove helpers', () => {
  const base = () => buildEntries([row('curls_kh'), row('hammercurls')], new Map(), [])

  it('picks library and custom exercises', () => {
    expect(pickLibrary('curls_lh')).toEqual({ key: 'curls_lh', displayName: null })
    expect(pickCustom('  Schräge Brustpresse ')).toEqual({ key: 'custom:schraege_brustpresse', displayName: 'Schräge Brustpresse' })
  })

  it('swaps an exercise in place without touching the others or the input', () => {
    const entries = base()
    const fresh = buildEntry(adHocSpec(pickLibrary('curls_lh')), [], [])
    const next = swapExercise(entries, entries[0]!.uid, fresh)
    expect(next.map((e) => e.key)).toEqual(['curls_lh', 'hammercurls'])
    expect(next[1]).toBe(entries[1])
    expect(entries[0]?.key).toBe('curls_kh')
  })

  it('appends an ad-hoc exercise with 3 sets and the progression suggestion', () => {
    const history = [{ weightKg: 100, reps: 12 }, { weightKg: 100, reps: 12 }, { weightKg: 100, reps: 12 }]
    const added = buildEntry(adHocSpec(pickLibrary('kniebeuge_lh')), history, [])
    const next = appendExercise(base(), added)
    expect(next).toHaveLength(3)
    expect(next[2]?.sets).toHaveLength(3)
    expect(next[2]?.sets[0]).toMatchObject({ weight: '102,5', reps: '8' })
  })

  it('adds a set copying the last set values and removes only the last one', () => {
    const entries = updateSet(base(), 0, 2, { weight: '15', reps: '9' })
    const more = addSet(entries, 0)
    expect(more[0]?.sets).toHaveLength(4)
    expect(more[0]?.sets[3]).toEqual({ weight: '15', reps: '9', loggedId: null, saving: false })
    expect(entries[0]?.sets).toHaveLength(3)
    expect(removeLastSet(more, 0)[0]?.sets).toHaveLength(3)
  })

  it('keeps at least one set', () => {
    const one = buildEntries([row('curls_kh', 1)], new Map(), [])
    expect(removeLastSet(one, 0)[0]?.sets).toHaveLength(1)
  })

  it('reports logged sets of an entry for deletion before a swap', () => {
    const entries = updateSet(updateSet(base(), 0, 0, { loggedId: 'x' }), 0, 2, { loggedId: 'y' })
    expect(hasLoggedSets(entries[0]!)).toBe(true)
    expect(hasLoggedSets(entries[1]!)).toBe(false)
    expect(loggedKeysToDelete(entries[0]!)).toEqual([0, 2])
  })
})

describe('duplicate guards and uid updates', () => {
  const base = () => buildEntries([row('curls_kh'), row('hammercurls')], new Map(), [])

  it('never appends an exercise whose key is already present', () => {
    const entries = base()
    const dup = buildEntry(adHocSpec(pickLibrary('curls_kh')), [], [])
    expect(appendExercise(entries, dup)).toHaveLength(2)
    const once = appendExercise(entries, buildEntry(adHocSpec(pickLibrary('curls_lh')), [], []))
    expect(appendExercise(once, buildEntry(adHocSpec(pickLibrary('curls_lh')), [], []))).toHaveLength(3)
  })

  it('refuses a swap onto a key that exists elsewhere or when the uid is gone', () => {
    const entries = base()
    const clash = buildEntry(adHocSpec(pickLibrary('hammercurls')), [], [])
    expect(swapExercise(entries, entries[0]!.uid, clash).map((e) => e.key)).toEqual(['curls_kh', 'hammercurls'])
    const fresh = buildEntry(adHocSpec(pickLibrary('curls_lh')), [], [])
    expect(swapExercise(entries, 'missing', fresh).map((e) => e.key)).toEqual(['curls_kh', 'hammercurls'])
  })

  it('applies set updates by uid even after the order changed', () => {
    const entries = base()
    const uid = entries[1]!.uid
    const reordered = [entries[1]!, entries[0]!]
    const next = updateSetByUid(reordered, uid, 0, { loggedId: 'x' })
    expect(next[0]?.sets[0]?.loggedId).toBe('x')
    expect(next[1]?.sets[0]?.loggedId).toBeNull()
    expect(updateSetByUid(reordered, 'gone', 0, { loggedId: 'y' })).toEqual(reordered)
  })
})
