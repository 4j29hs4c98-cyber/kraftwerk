import { describe, expect, it } from 'vitest'
import type { WriteResult } from './errors'
import type { OutboxOp } from './ops'
import { createSyncEngine, MAX_REACHABLE_ATTEMPTS, type SyncEngineDeps } from './outbox'
import { createMemoryStore } from './store'

const OK: WriteResult = { status: 201, error: null }
const NETWORK: WriteResult = { status: 0, error: { message: 'TypeError: Failed to fetch', code: '' } }
const CHECK_VIOLATION: WriteResult = { status: 400, error: { message: 'new row violates check constraint', code: '23514' } }

const set = (setIndex: number): OutboxOp => ({ kind: 'set.upsert', workoutId: 'w1', exerciseKey: 'bench', setIndex, weightKg: 60, reps: 8 })
const start: OutboxOp = { kind: 'workout.start', id: 'w1', planDayId: 'd1', startedAt: '2026-10-28T10:00:00.000Z' }

function setup(results: (op: OutboxOp, call: number) => WriteResult | Promise<WriteResult> = () => OK, overrides: Partial<SyncEngineDeps> = {}) {
  const sent: OutboxOp[] = []
  let online = true
  const engine = createSyncEngine({
    store: createMemoryStore(),
    execute: async (op) => {
      sent.push(op)
      return results(op, sent.length)
    },
    isOnline: () => online,
    canSync: async () => true,
    autoReplay: false,
    ...overrides,
  })
  return { engine, sent, setOnline: (value: boolean) => (online = value) }
}

describe('Warteschlange', () => {
  it('behält die Reihenfolge des Eintragens', async () => {
    const { engine } = setup()
    await engine.setUser('u1')
    await engine.enqueue(start)
    await engine.enqueue(set(0))
    await engine.enqueue(set(1))
    expect((await engine.pending()).map((e) => e.op)).toEqual([start, set(0), set(1)])
    expect(engine.getSnapshot().pending).toBe(3)
  })

  it('sendet beim Abgleich in derselben Reihenfolge (Workout vor seinen Sätzen) und leert die Schlange', async () => {
    const { engine, sent } = setup()
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(sent).toEqual([start, set(0), set(1)])
    expect(await engine.pending()).toEqual([])
    expect(engine.getSnapshot().pending).toBe(0)
  })

  it('bricht beim ersten Netzwerkfehler ab und lässt den Rest unverändert in der Schlange', async () => {
    const { engine, sent } = setup((_op, call) => (call === 2 ? NETWORK : OK))
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('interrupted')
    expect(sent).toEqual([start, set(0)])
    expect((await engine.pending()).map((e) => e.op)).toEqual([set(0), set(1)])
  })

  it('setzt nach einem Abbruch beim nächsten Abgleich an derselben Stelle fort', async () => {
    let failing = true
    const { engine, sent } = setup((op) => (failing && op.kind === 'set.upsert' && op.setIndex === 0 ? NETWORK : OK))
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('interrupted')
    failing = false
    expect(await engine.replay()).toBe('done')
    expect(sent.map((o) => (o.kind === 'set.upsert' ? o.setIndex : o.kind))).toEqual(['workout.start', 0, 0, 1])
    expect(engine.getSnapshot().pending).toBe(0)
  })

  it('verschiebt dauerhaft abgelehnte Einträge in die Fehlerliste und arbeitet den Rest ab', async () => {
    const { engine, sent } = setup((op) => (op.kind === 'set.upsert' && op.setIndex === 0 ? CHECK_VIOLATION : OK))
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('done')
    expect(sent).toHaveLength(3)
    expect(await engine.pending()).toEqual([])
    const failed = engine.getSnapshot().failed
    expect(failed).toHaveLength(1)
    expect(failed[0]?.op).toEqual(set(0))
    expect(failed[0]?.error).toContain('23514')
  })

  it('verwirft oder wiederholt fehlgeschlagene Einträge auf Wunsch', async () => {
    let reject = true
    const { engine } = setup((op) => (reject && op.kind === 'set.upsert' ? CHECK_VIOLATION : OK))
    await engine.setUser('u1')
    await engine.enqueue(set(0))
    await engine.enqueue(set(1))
    await engine.replay()
    const [a, b] = engine.getSnapshot().failed
    if (!a || !b) throw new Error('zwei Fehlereinträge erwartet')
    await engine.discardFailed(a.key)
    expect(engine.getSnapshot().failed.map((f) => f.op)).toEqual([set(1)])
    reject = false
    await engine.retryFailed(b.key)
    expect(engine.getSnapshot().failed).toEqual([])
    expect(await engine.replay()).toBe('done')
    expect(await engine.pending()).toEqual([])
  })

  it('wertet eine Ausnahme beim Senden als vorübergehend', async () => {
    const { engine } = setup(() => Promise.reject(new TypeError('Failed to fetch')))
    await engine.setUser('u1')
    await engine.enqueue(start)
    expect(await engine.replay()).toBe('interrupted')
    expect(await engine.pending()).toHaveLength(1)
    expect(engine.getSnapshot().failed).toEqual([])
  })

  it('wertet abgelaufene Anmeldung (401) und Serverfehler (503) als vorübergehend', async () => {
    for (const status of [401, 503]) {
      const { engine } = setup(() => ({ status, error: { message: 'JWT expired', code: 'PGRST303' } }))
      await engine.setUser('u1')
      await engine.enqueue(start)
      expect(await engine.replay()).toBe('interrupted')
      expect(engine.getSnapshot().failed).toEqual([])
    }
  })

  it('sendet nichts ohne Netz oder ohne gültige Anmeldung', async () => {
    const offline = setup()
    offline.setOnline(false)
    await offline.engine.setUser('u1')
    await offline.engine.enqueue(start)
    expect(await offline.engine.replay()).toBe('skipped')
    expect(offline.sent).toEqual([])

    const noSession = setup(() => OK, { canSync: async () => false })
    await noSession.engine.setUser('u1')
    await noSession.engine.enqueue(start)
    expect(await noSession.engine.replay()).toBe('skipped')
    expect(noSession.sent).toEqual([])
  })

  it('trennt die Schlangen verschiedener Nutzer', async () => {
    const store = createMemoryStore()
    const sent: OutboxOp[] = []
    const engine = createSyncEngine({ store, execute: async (op) => (sent.push(op), OK), isOnline: () => true, canSync: async () => true, autoReplay: false })
    await engine.setUser('anna')
    await engine.enqueue(start)
    await engine.setUser('ben')
    expect(await engine.pending()).toEqual([])
    expect(await engine.replay()).toBe('done')
    expect(sent).toEqual([])
    await engine.setUser('anna')
    expect(engine.getSnapshot().pending).toBe(1)
  })

  it('arbeitet Einträge mit ab, die während des Abgleichs dazukommen', async () => {
    let engineRef: ReturnType<typeof createSyncEngine> | null = null
    const { engine, sent } = setup(async (op) => {
      if (op.kind === 'workout.start') await engineRef?.enqueue(set(5))
      return OK
    })
    engineRef = engine
    await engine.setUser('u1')
    await engine.enqueue(start)
    expect(await engine.replay()).toBe('done')
    expect(sent.map((o) => o.kind)).toEqual(['workout.start', 'set.upsert'])
    expect(await engine.pending()).toEqual([])
  })

  it('meldet erfolgreich übertragene Änderungen an Zuhörer', async () => {
    const { engine } = setup()
    let applied = 0
    engine.onApplied(() => applied++)
    await engine.setUser('u1')
    await engine.replay()
    expect(applied).toBe(0)
    await engine.enqueue(start)
    await engine.replay()
    expect(applied).toBe(1)
  })
})

describe('Warteschlange: Absicherung', () => {
  it('wertet eine Ausnahme aus eigenem Code als dauerhaft statt als Netzwerkfehler', async () => {
    const { engine } = setup(() => Promise.reject(new TypeError("Cannot read properties of undefined (reading 'id')")))
    await engine.setUser('u1')
    await engine.enqueue(start)
    expect(await engine.replay()).toBe('done')
    expect(engine.getSnapshot().failed).toHaveLength(1)
  })

  it('gibt einen Eintrag nach mehreren 401/5xx bei erreichbarem Server auf, ohne Netz aber nie', async () => {
    const { engine } = setup(() => ({ status: 401, error: { message: 'JWT expired', code: 'PGRST303' } }))
    await engine.setUser('u1')
    await engine.enqueue(start)
    for (let i = 1; i < MAX_REACHABLE_ATTEMPTS; i++) expect(await engine.replay()).toBe('interrupted')
    expect(engine.getSnapshot().failed).toEqual([])
    expect(await engine.replay()).toBe('done')
    expect(engine.getSnapshot().failed[0]?.error).toContain('Versuchen')

    const offline = setup(() => NETWORK)
    await offline.engine.setUser('u1')
    await offline.engine.enqueue(start)
    for (let i = 0; i < MAX_REACHABLE_ATTEMPTS * 2; i++) expect(await offline.engine.replay()).toBe('interrupted')
    expect(offline.engine.getSnapshot().failed).toEqual([])
  })

  it('prüft die Anmeldung des Schlangen-Nutzers vor dem Start und vor jedem Eintrag', async () => {
    const checked: string[] = []
    let allowed = 2
    const { engine, sent } = setup(() => OK, {
      canSync: async (user) => {
        checked.push(user)
        return allowed-- > 0
      },
    })
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect(await engine.replay()).toBe('interrupted')
    expect(sent).toEqual([start])
    expect(new Set(checked)).toEqual(new Set(['u1']))
  })

  it('verschiebt ungültig gespeicherte oder ungültige Einträge in die Fehlerliste und sendet den Rest', async () => {
    const store = createMemoryStore()
    const sent: OutboxOp[] = []
    const engine = createSyncEngine({ store, execute: async (op) => (sent.push(op), OK), isOnline: () => true, canSync: async () => true, autoReplay: false })
    await store.set('outbox:u1:000000000000', { kaputt: true })
    await engine.setUser('u1')
    await engine.enqueue({ kind: 'set.upsert', workoutId: 'w1', exerciseKey: 'bench', setIndex: 0, weightKg: 60, reps: -3 })
    await engine.enqueue(start)
    expect(await engine.replay()).toBe('done')
    expect(sent).toEqual([start])
    expect(engine.getSnapshot().failed.map((f) => f.op)).toEqual([null, null])
  })

  it('hält die Reihenfolge über einen fortlaufenden Zähler, auch wenn die Uhr zurückspringt', async () => {
    let time = 10_000_000
    const { engine } = setup(() => OK, { now: () => new Date((time -= 1000)) })
    await engine.setUser('u1')
    for (const op of [start, set(0), set(1)]) await engine.enqueue(op)
    expect((await engine.pending()).map((e) => e.op)).toEqual([start, set(0), set(1)])
  })

  it('gleicht nur unter der Sperre ab', async () => {
    let locked = 0
    const { engine } = setup(() => OK, { withLock: (run) => (locked++, run()) })
    await engine.setUser('u1')
    await engine.enqueue(start)
    await engine.replay()
    expect(locked).toBe(1)
  })

  it('protokolliert nur Art und Schlüssel, keine Inhalte', async () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '))
    try {
      const { engine } = setup(() => CHECK_VIOLATION)
      await engine.setUser('u1')
      await engine.enqueue({ kind: 'food.insert', entry: { id: 'f1', eaten_on: '2026-10-28', name: 'Geheimes Essen', status: 'frei' } })
      await engine.replay()
    } finally {
      console.warn = original
    }
    expect(warnings.join(' ')).toContain('food.insert')
    expect(warnings.join(' ')).not.toContain('Geheimes Essen')
  })
})
