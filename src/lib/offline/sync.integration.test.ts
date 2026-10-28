import { describe, expect, it } from 'vitest'
import type { WriteResult } from './errors'
import { createExecutor } from './execute'
import type { OutboxOp } from './ops'
import { createSyncEngine } from './outbox'
import { createMemoryStore } from './store'

type Row = Record<string, unknown>
type Filter = readonly [string, unknown]

const USER = 'u1'
const NETWORK_LOST: WriteResult = { status: 0, error: { message: 'TypeError: Failed to fetch', code: '' } }

/**
 * Nachbau der nötigen PostgREST-Semantik im Speicher: upsert mit onConflict
 * und ignoreDuplicates, update/delete mit eq-Filtern, Fremdschlüssel von
 * workout_sets auf workouts. loseResponses lässt den Server die Änderung
 * ausführen, die Antwort aber "verloren gehen" (Netzabbruch nach dem Senden).
 */
function createFakeServer() {
  const tables: Record<string, Row[]> = { workouts: [], workout_sets: [], food_entries: [], body_weights: [] }
  let online = true
  let loseResponses = 0
  let nextId = 1

  function respond(apply: () => WriteResult): Promise<WriteResult> {
    if (!online) return Promise.resolve(NETWORK_LOST)
    const result = apply()
    if (loseResponses > 0) {
      loseResponses--
      return Promise.resolve(NETWORK_LOST)
    }
    return Promise.resolve(result)
  }

  const matches = (row: Row, filters: readonly Filter[]) => filters.every(([col, val]) => row[col] === val)

  function upsert(table: string, input: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }): WriteResult {
    const row: Row = { user_id: USER, ...input }
    if (table === 'workout_sets' && !tables.workouts!.some((w) => w.id === row.workout_id)) {
      return { status: 409, error: { message: 'violates foreign key constraint', code: '23503' } }
    }
    const cols = opts.onConflict.split(',')
    const rows = tables[table]!
    const index = rows.findIndex((r) => cols.every((c) => r[c] === row[c]))
    if (index >= 0) {
      if (!opts.ignoreDuplicates) tables[table] = rows.map((r, i) => (i === index ? { ...r, ...row, id: r.id } : r))
    } else {
      tables[table] = [...rows, { id: `srv-${nextId++}`, ...row }]
    }
    return { status: 201, error: null }
  }

  function filtered(action: (filters: readonly Filter[]) => void) {
    const filters: Filter[] = []
    const builder = {
      eq(col: string, val: unknown) {
        filters.push([col, val])
        return builder
      },
      then<R>(resolve: (r: WriteResult) => R) {
        return respond(() => {
          action(filters)
          return { status: 204, error: null }
        }).then(resolve)
      },
    }
    return builder
  }

  const client = {
    from(table: string) {
      return {
        upsert: (row: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }) => respond(() => upsert(table, row, opts)),
        update: (values: Row) =>
          filtered((filters) => {
            tables[table] = tables[table]!.map((r) => (matches(r, filters) ? { ...r, ...values } : r))
          }),
        delete: () =>
          filtered((filters) => {
            const removed = tables[table]!.filter((r) => matches(r, filters))
            tables[table] = tables[table]!.filter((r) => !matches(r, filters))
            if (table === 'workouts') {
              const ids = new Set(removed.map((r) => r.id))
              tables.workout_sets = tables.workout_sets!.filter((s) => !ids.has(s.workout_id))
            }
          }),
      }
    },
  }

  return {
    tables,
    client: client as unknown as Parameters<typeof createExecutor>[0],
    setOnline: (value: boolean) => (online = value),
    loseNextResponses: (n: number) => (loseResponses = n),
    rows: (table: string) => tables[table]!,
  }
}

function setup() {
  const server = createFakeServer()
  let deviceOnline = true
  const engine = createSyncEngine({
    store: createMemoryStore(),
    execute: createExecutor(server.client),
    isOnline: () => deviceOnline,
    canSync: async () => true,
    autoReplay: false,
  })
  const goOffline = () => {
    deviceOnline = false
    server.setOnline(false)
  }
  const goOnline = () => {
    deviceOnline = true
    server.setOnline(true)
  }
  return { server, engine, goOffline, goOnline }
}

const start: OutboxOp = { kind: 'workout.start', id: 'w-local', planDayId: 'd1', startedAt: '2026-10-28T10:00:00.000Z' }
const set = (setIndex: number, weightKg = 60, reps = 8): OutboxOp => ({ kind: 'set.upsert', workoutId: 'w-local', exerciseKey: 'bench', setIndex, weightKg, reps })
const finish: OutboxOp = { kind: 'workout.finish', id: 'w-local', finishedAt: '2026-10-28T11:00:00.000Z' }

describe('Offline-Training mit späterem Abgleich', () => {
  it('überträgt ein komplett offline geloggtes Training einmalig und vollständig', async () => {
    const { server, engine, goOffline, goOnline } = setup()
    await engine.setUser(USER)
    goOffline()
    for (const op of [start, set(0), set(1), set(2), finish]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('skipped')
    expect(server.rows('workouts')).toEqual([])

    goOnline()
    expect(await engine.replay()).toBe('done')
    expect(server.rows('workouts')).toHaveLength(1)
    expect(server.rows('workouts')[0]).toMatchObject({ id: 'w-local', finished_at: '2026-10-28T11:00:00.000Z' })
    expect(server.rows('workout_sets')).toHaveLength(3)
    expect(engine.getSnapshot().pending).toBe(0)
  })

  it('erzeugt keine Kopien, wenn Antworten verloren gehen und erneut gesendet wird', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    for (const op of [start, set(0), finish]) await engine.enqueue(op)
    // Jede Anfrage kommt an, aber die ersten drei Antworten gehen verloren.
    for (let attempt = 0; attempt < 3; attempt++) {
      server.loseNextResponses(1)
      expect(await engine.replay()).toBe('interrupted')
    }
    expect(await engine.replay()).toBe('done')
    expect(server.rows('workouts')).toHaveLength(1)
    expect(server.rows('workout_sets')).toHaveLength(1)
    expect(server.rows('workouts')[0]?.finished_at).toBe('2026-10-28T11:00:00.000Z')
  })

  it('ergibt bei doppelt gesendetem Satz eine Zeile mit dem letzten Wert', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    for (const op of [start, set(0, 60, 8), set(0, 60, 8), set(0, 62.5, 6)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(server.rows('workout_sets')).toHaveLength(1)
    expect(server.rows('workout_sets')[0]).toMatchObject({ weight_kg: 62.5, reps: 6 })
  })

  it('entfernt einen geöffneten Satz über seinen fachlichen Schlüssel, auch wiederholt', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    const remove: OutboxOp = { kind: 'set.delete', workoutId: 'w-local', exerciseKey: 'bench', setIndex: 0 }
    for (const op of [start, set(0), set(1), remove, remove]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(server.rows('workout_sets').map((s) => s.set_index)).toEqual([1])
  })

  it('lässt einen Satz ohne angelegtes Workout in die Fehlerliste fallen, ohne die Schlange zu blockieren', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    const orphan: OutboxOp = { kind: 'set.upsert', workoutId: 'gibt-es-nicht', exerciseKey: 'bench', setIndex: 0, weightKg: 50, reps: 5 }
    for (const op of [orphan, start, set(0)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(engine.getSnapshot().failed.map((f) => f.op)).toEqual([orphan])
    expect(engine.getSnapshot().failed[0]?.error).toContain('23503')
    expect(server.rows('workout_sets')).toHaveLength(1)
  })

  it('legt Essen und Gewicht trotz Wiederholung nur einmal an', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    const food: OutboxOp = { kind: 'food.insert', entry: { id: 'f-local', eaten_on: '2026-10-28', name: 'Skyr', kcal: 120, protein_g: 20, status: 'frei' } }
    const weight = (kg: number): OutboxOp => ({ kind: 'weight.upsert', measuredOn: '2026-10-28', weightKg: kg, bodyFatPct: null })
    for (const op of [food, weight(80), weight(79.5)]) await engine.enqueue(op)
    server.loseNextResponses(1)
    expect(await engine.replay()).toBe('interrupted')
    expect(await engine.replay()).toBe('done')
    expect(server.rows('food_entries')).toHaveLength(1)
    expect(server.rows('body_weights')).toHaveLength(1)
    expect(server.rows('body_weights')[0]?.weight_kg).toBe(79.5)
  })
})

describe('Offline-Training: Sonderfälle', () => {
  it('ergibt für [anlegen, Satz, öffnen, Satz] genau eine Zeile', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    const remove: OutboxOp = { kind: 'set.delete', workoutId: 'w-local', exerciseKey: 'bench', setIndex: 0 }
    for (const op of [start, set(0, 60, 8), remove, set(0, 62.5, 8)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(server.rows('workout_sets')).toHaveLength(1)
    expect(server.rows('workout_sets')[0]).toMatchObject({ weight_kg: 62.5 })
  })

  it('übernimmt keine user_id aus dem Client für Essens-Einträge', async () => {
    const { server, engine } = setup()
    await engine.setUser(USER)
    const entry = { id: 'f1', eaten_on: '2026-10-28', name: 'Skyr', status: 'frei', user_id: 'fremd' }
    await engine.enqueue({ kind: 'food.insert', entry })
    expect(await engine.replay()).toBe('done')
    expect(server.rows('food_entries')[0]?.user_id).toBe(USER)
  })
})
