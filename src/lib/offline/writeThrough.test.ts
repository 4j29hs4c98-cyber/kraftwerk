import { describe, expect, it } from 'vitest'
import { applyPendingFood } from '../../features/nutrition/pending'
import { createReadCache } from './cache'
import type { OutboxOp } from './ops'
import { createSyncEngine } from './outbox'
import { createMemoryStore } from './store'
import { writeThrough } from './writeThrough'
import type { Tables } from '../../types/database'

const NETWORK_ERROR = { message: 'TypeError: Failed to fetch', code: '' }
const DAY = '2026-10-28'

function setup() {
  const store = createMemoryStore()
  let online = true
  const cache = createReadCache(store, { isOnline: () => online })
  const engine = createSyncEngine({
    store,
    execute: async () => ({ status: 201, error: null }),
    isOnline: () => online,
    canSync: async () => true,
    autoReplay: false,
    onEntryApplied: async (entry) => cache.transform(entry.userId, (key, value) => writeThrough(key, value, entry, { userId: entry.userId, openWorkouts: [] })),
  })
  return { cache, engine, setOnline: (v: boolean) => (online = v) }
}

/** Wie fetchFoodEntries: Vorrat (leer als Rückfall) plus Warteschlange. */
async function readDay(ctx: ReturnType<typeof setup>): Promise<Tables<'food_entries'>[]> {
  const rows = await ctx.cache.read<Tables<'food_entries'>[]>('u1', `food:${DAY}`, () => Promise.reject(NETWORK_ERROR), { empty: [] })
  return applyPendingFood(rows, await ctx.engine.pending(), 'u1', (d) => d === DAY)
}

describe('Vorrat nach dem Abgleich', () => {
  it('zeigt offline geloggtes Essen auch nach Abgleich und erneutem Offline-Gehen, die Doppelprüfung greift', async () => {
    const ctx = setup()
    await ctx.engine.setUser('u1')
    await ctx.cache.read('u1', `food:${DAY}`, async () => [])
    ctx.setOnline(false)
    const add: OutboxOp = { kind: 'food.insert', entry: { id: 'f1', eaten_on: DAY, name: 'Skyr', status: 'wie_geplant', meal_plan_item_id: 'm1' } }
    await ctx.engine.enqueue(add)
    expect((await readDay(ctx)).map((e) => e.id)).toEqual(['f1'])

    ctx.setOnline(true)
    expect(await ctx.engine.replay()).toBe('done')
    expect(await ctx.engine.pending()).toEqual([])

    ctx.setOnline(false)
    const visible = await readDay(ctx)
    expect(visible.map((e) => e.id)).toEqual(['f1'])
    // Dieselbe Prüfung wie addFoodEntry vor dem Eintragen.
    expect(visible.some((e) => e.meal_plan_item_id === 'm1')).toBe(true)
  })

  it('zieht Gewicht, offenes Training und Trainingstage nach', async () => {
    const entry = (op: OutboxOp) => ({ key: 'k', userId: 'u1', createdAt: '2026-10-28T10:00:00.000Z', op })
    const ctx = { userId: 'u1', openWorkouts: [] }
    expect(writeThrough('weights:latest', null, entry({ kind: 'weight.upsert', measuredOn: DAY, weightKg: 80, bodyFatPct: null }), ctx)).toMatchObject({ weight_kg: 80 })
    const start: OutboxOp = { kind: 'workout.start', id: 'w1', planDayId: 'd1', startedAt: '2026-10-28T10:00:00.000Z' }
    expect(writeThrough('workout:open:d1', null, entry(start), ctx)).toMatchObject({ workout: { id: 'w1' }, sets: [] })
    expect(writeThrough('workouts:days:2026-10-27T23:00:00.000Z|2026-10-28T23:00:00.000Z', [], entry(start), ctx)).toEqual([{ started_at: start.startedAt }])
  })

  it('übernimmt beim Abschließen die Sätze in den Vorschlag', async () => {
    const open = {
      workout: { id: 'w1', user_id: 'u1', plan_day_id: 'd1', started_at: '2026-10-28T10:00:00.000Z', finished_at: null, created_at: '2026-10-28T10:00:00.000Z' },
      sets: [{ id: 's', user_id: 'u1', workout_id: 'w1', exercise_key: 'bench', set_index: 0, weight_kg: 70, reps: 5, created_at: '2026-10-28T10:10:00.000Z' }],
    }
    const finish = { key: 'k', userId: 'u1', createdAt: '', op: { kind: 'workout.finish', id: 'w1', finishedAt: '2026-10-28T11:00:00.000Z' } as const }
    const next = writeThrough('workout:lastSets:bench,squat', new Map([['bench', [{ weightKg: 60, reps: 8 }]]]), finish, { userId: 'u1', openWorkouts: [open] })
    expect(next).toEqual(new Map([['bench', [{ weightKg: 70, reps: 5 }]]]))
  })
})
