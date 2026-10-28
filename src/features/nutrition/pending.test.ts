import { describe, expect, it } from 'vitest'
import type { OutboxEntry, OutboxOp } from '../../lib/offline/ops'
import type { Tables } from '../../types/database'
import { applyPendingWeights } from '../progress/pending'
import { applyPendingFood } from './pending'

const entries = (...ops: OutboxOp[]): OutboxEntry[] => ops.map((op, i) => ({ key: `k${i}`, userId: 'u1', createdAt: `2026-10-28T12:0${i}:00.000Z`, op }))

const serverFood: Tables<'food_entries'> = {
  id: 'f-srv',
  user_id: 'u1',
  eaten_on: '2026-10-28',
  name: 'Haferflocken',
  kcal: 380,
  protein_g: 13,
  carbs_g: 60,
  fat_g: 7,
  grams: 100,
  meal_slot: 'fruehstueck',
  meal_plan_item_id: null,
  status: 'frei',
  created_at: '2026-10-28T08:00:00.000Z',
}

const insert = (id: string, day = '2026-10-28'): OutboxOp => ({ kind: 'food.insert', entry: { id, eaten_on: day, name: 'Skyr', kcal: 120, protein_g: 20, status: 'frei' } })
const isToday = (day: string) => day === '2026-10-28'

describe('lokale Essens-Einträge', () => {
  it('ergänzt offline angelegte Einträge des Tages, chronologisch', () => {
    const result = applyPendingFood([serverFood], entries(insert('f1'), insert('f2', '2026-10-27')), 'u1', isToday)
    expect(result.map((r) => r.id)).toEqual(['f-srv', 'f1'])
    expect(result[1]).toMatchObject({ name: 'Skyr', carbs_g: null, user_id: 'u1' })
  })

  it('wendet Änderungen und Löschungen in Reihenfolge an', () => {
    const ops = entries(
      insert('f1'),
      { kind: 'food.update', id: 'f-srv', name: 'Porridge', kcal: 400, proteinG: 14, carbsG: 61, fatG: 8 },
      { kind: 'food.delete', id: 'f1' },
    )
    const result = applyPendingFood([serverFood], ops, 'u1', isToday)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'f-srv', name: 'Porridge', kcal: 400 })
    expect(serverFood.name).toBe('Haferflocken')
  })

  it('verdoppelt nichts, wenn der Eintrag schon vom Server kommt', () => {
    expect(applyPendingFood([{ ...serverFood, id: 'f1' }], entries(insert('f1')), 'u1', isToday)).toHaveLength(1)
  })
})

describe('lokale Gewichtsmessungen', () => {
  const server: Tables<'body_weights'>[] = [
    { id: 'b1', user_id: 'u1', measured_on: '2026-10-27', weight_kg: 80, body_fat_pct: 18, created_at: '2026-10-27T07:00:00.000Z' },
  ]

  it('ersetzt den Wert des Tages und behält Körperfett ohne neue Angabe', () => {
    const result = applyPendingWeights(server, entries({ kind: 'weight.upsert', measuredOn: '2026-10-27', weightKg: 79.6, bodyFatPct: null }), 'u1')
    expect(result).toEqual([{ ...server[0], weight_kg: 79.6 }])
  })

  it('ergänzt neue Tage', () => {
    const result = applyPendingWeights(server, entries({ kind: 'weight.upsert', measuredOn: '2026-10-28', weightKg: 79.4, bodyFatPct: 17.5 }), 'u1')
    expect(result.map((r) => [r.measured_on, r.weight_kg, r.body_fat_pct])).toEqual([
      ['2026-10-27', 80, 18],
      ['2026-10-28', 79.4, 17.5],
    ])
  })
})
