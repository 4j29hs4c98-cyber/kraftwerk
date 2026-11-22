import { describe, expect, it } from 'vitest'
import type { PlanExerciseRow } from '../plan/api'
import { buildEntriesFromLayout, loadLayout, parseLayout, serializeLayout, sessionKeys } from './layout'
import { addSet, adHocSpec, buildEntries, buildEntry, pickCustom, swapExercise } from './session'

const row = (key: string): PlanExerciseRow => ({
  id: key, plan_day_id: 'd', user_id: 'u', exercise_key: key, position: 0, sets: 3, rep_min: 8, rep_max: 12,
  rest_seconds: 90, created_at: '', display_name: null, notes: 'Notiz', start_weight_kg: null,
})
const logged = (key: string, index: number) => ({ id: `${key}-${index}`, exercise_key: key, set_index: index, weight_kg: 20, reps: 10 })

describe('layout', () => {
  const swapped = () => {
    const entries = buildEntries([row('curls_kh'), row('hammercurls')], new Map(), [])
    const custom = buildEntry(adHocSpec(pickCustom('Schräge Brustpresse')), [], [])
    return addSet(swapExercise(entries, entries[0]!.uid, custom), 0)
  }

  it('round-trips order, names, targets and set counts', () => {
    const specs = parseLayout(serializeLayout(swapped()))
    expect(specs?.map((s) => s.key)).toEqual(['custom:schraege_brustpresse', 'hammercurls'])
    expect(specs?.[0]).toMatchObject({ displayName: 'Schräge Brustpresse', sets: 4, repMin: 8, repMax: 12 })
    expect(specs?.[1]).toMatchObject({ notes: 'Notiz', restSeconds: 90 })
  })

  it('rejects garbage, wrong versions, bad keys and duplicate keys', () => {
    expect(parseLayout(null)).toBeNull()
    expect(parseLayout('{nope')).toBeNull()
    expect(parseLayout('{"v":2,"exercises":[]}')).toBeNull()
    const bad = (key: string) => JSON.stringify({ v: 1, exercises: [{ key, repMin: 8, repMax: 12, sets: 3 }] })
    expect(parseLayout(bad('Not Valid!'))).toBeNull()
    expect(parseLayout(bad('curls_kh'))).not.toBeNull()
    const dup = JSON.stringify({ v: 1, exercises: [1, 2].map(() => ({ key: 'curls_kh', repMin: 8, repMax: 12, sets: 3 })) })
    expect(parseLayout(dup)).toBeNull()
  })

  it('resumes from the layout, merges logged sets and appends keys missing from it', () => {
    const specs = parseLayout(serializeLayout(swapped()))!
    const existing = [logged('custom:schraege_brustpresse', 3), logged('hammercurls', 0), logged('curls_lh', 0)]
    const entries = buildEntriesFromLayout(specs, new Map(), existing)
    expect(entries.map((e) => e.key)).toEqual(['custom:schraege_brustpresse', 'hammercurls', 'curls_lh'])
    expect(entries[0]?.displayName).toBe('Schräge Brustpresse')
    expect(entries[0]?.sets[3]?.loggedId).toBe('custom:schraege_brustpresse-3')
    expect(entries[1]?.sets[0]?.loggedId).toBe('hammercurls-0')
  })

  it('asks for history of layout keys instead of plan keys', () => {
    const specs = parseLayout(serializeLayout(swapped()))!
    expect(sessionKeys(['curls_kh'], specs, [logged('x', 0)])).toEqual(['custom:schraege_brustpresse', 'hammercurls', 'x'])
    expect(sessionKeys(['curls_kh'], null, [])).toEqual(['curls_kh'])
  })

  it('degrades to null when storage is unavailable', () => {
    expect(loadLayout('w1')).toBeNull()
  })
})
