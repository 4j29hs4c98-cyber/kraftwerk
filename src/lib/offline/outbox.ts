import { classifyWrite, describeError, isNetworkError, type WriteResult } from './errors'
import { isFailedEntry, isOutboxEntry, logLabel, type FailedEntry, type OutboxEntry, type OutboxOp } from './ops'
import type { KeyValueStore } from './store'

export type Executor = (op: OutboxOp) => Promise<WriteResult>

export interface SyncEngineDeps {
  readonly store: KeyValueStore
  readonly execute: Executor
  readonly isOnline: () => boolean
  /**
   * Nur senden, wenn eine gültige Anmeldung genau dieses Nutzers besteht; sonst
   * würde die Zugriffsregel gültige Einträge ablehnen oder sie einem fremden Konto zuordnen.
   */
  readonly canSync: (userId: string) => Promise<boolean>
  /** Wird nach erfolgreichem Senden und vor dem Entfernen aus der Schlange abgewartet (Vorrat nachziehen). */
  readonly onEntryApplied?: (entry: OutboxEntry) => Promise<void>
  /** Sperre über Tabs hinweg, damit nie zwei Tabs gleichzeitig abgleichen. */
  readonly withLock?: <T>(run: () => Promise<T>) => Promise<T>
  /** Nach dem Eintragen sofort abgleichen (in Tests aus, um die Schlange zu prüfen). */
  readonly autoReplay?: boolean
  readonly now?: () => Date
}

export interface SyncSnapshot {
  readonly online: boolean
  readonly pending: number
  /** Wartende Einträge in Reihenfolge, etwa um zu zeigen, welche Trainings noch nicht übertragen sind. */
  readonly queued: readonly OutboxEntry[]
  readonly syncing: boolean
  readonly failed: readonly FailedEntry[]
  /** Zeitpunkt des letzten Abgleichs, der etwas übertragen hat (ms). */
  readonly lastSyncedAt: number | null
}

/** done: Schlange leer. interrupted: vorübergehender Fehler, Rest bleibt. skipped: kein Netz, keine Anmeldung oder kein Nutzer. */
export type ReplayOutcome = 'done' | 'interrupted' | 'skipped'

/**
 * So oft darf ein Eintrag hintereinander vorübergehend scheitern, obwohl der Server
 * erreichbar war (etwa 401 oder 5xx), bevor er in die Fehlerliste wandert.
 * Fehlendes Netz zählt nicht mit.
 */
export const MAX_REACHABLE_ATTEMPTS = 5

const SEQ_KEY = 'meta:outbox-seq'
const outboxPrefix = (userId: string) => `outbox:${userId}:`
const failedPrefix = (userId: string) => `failed:${userId}:`

/** Gespeicherter Eintrag mit Zähler vergeblicher Versuche bei erreichbarem Server. */
type StoredEntry = OutboxEntry & { readonly attempts?: number }

const runDirect = <T,>(run: () => Promise<T>): Promise<T> => run()

/**
 * Warteschlange für Schreibzugriffe. Einträge werden in der Reihenfolge
 * gespeichert und gesendet, in der sie entstanden sind (ein Workout also vor
 * seinen Sätzen); die Reihenfolge kommt aus einem fortlaufenden Zähler in
 * IndexedDB. Ein Netzwerkfehler hält die Schlange an, ohne etwas zu verlieren.
 * Lehnt der Server einen Eintrag dauerhaft ab, scheitert er zu oft oder ist er
 * ungültig gespeichert, wandert er in eine sichtbare Fehlerliste, damit er die
 * übrigen Einträge nicht für immer blockiert.
 */
export function createSyncEngine(deps: SyncEngineDeps) {
  const { store, execute } = deps
  const now = deps.now ?? (() => new Date())
  const autoReplay = deps.autoReplay ?? true
  const withLock = deps.withLock ?? runDirect
  let userId: string | null = null
  let snapshot: SyncSnapshot = { online: deps.isOnline(), pending: 0, queued: [], syncing: false, failed: [], lastSyncedAt: null }
  const listeners = new Set<() => void>()
  const appliedListeners = new Set<() => void>()
  let running: Promise<ReplayOutcome> | null = null
  let rerun = false

  function publish(patch: Partial<SyncSnapshot>) {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const readQueue = (user: string) => store.entries(outboxPrefix(user))

  async function refreshCounts(user: string) {
    const [queue, failedRows] = await Promise.all([readQueue(user), store.entries(failedPrefix(user))])
    const queued = queue.flatMap(([, v]) => (isOutboxEntry(v) ? [v] : []))
    const failed = failedRows.flatMap(([, v]) => (isFailedEntry(v) ? [v] : []))
    if (user === userId) publish({ pending: queue.length, queued, failed })
  }

  async function moveToFailed(user: string, key: string, base: { readonly createdAt: string; readonly op: OutboxOp | null }, error: string) {
    const failedKey = failedPrefix(user) + key.slice(outboxPrefix(user).length)
    const failed: FailedEntry = { key: failedKey, userId: user, createdAt: base.createdAt, op: base.op, error, failedAt: now().toISOString() }
    console.warn(`Offline-Eintrag in die Fehlerliste verschoben: ${logLabel(key, base.op)}: ${error}`)
    await store.set(failedKey, failed)
    await store.delete(key)
  }

  async function canSyncSafely(user: string): Promise<boolean> {
    try {
      return await deps.canSync(user)
    } catch {
      return false
    }
  }

  /** Sendet einen Eintrag; liefert true, wenn die Schlange weiterlaufen darf. */
  async function processEntry(user: string, entry: StoredEntry): Promise<{ readonly proceed: boolean; readonly applied: boolean }> {
    let result: WriteResult
    try {
      result = await execute(entry.op)
    } catch (error) {
      // Netzfehler liefert supabase-js als Ergebnis, nicht als Ausnahme. Eine Ausnahme ist ein Fehler im eigenen Code.
      result = { status: 400, error }
    }
    const outcome = classifyWrite(result)
    if (outcome === 'ok') {
      await deps.onEntryApplied?.(entry)
      await store.delete(entry.key)
      return { proceed: true, applied: true }
    }
    if (outcome === 'permanent') {
      await moveToFailed(user, entry.key, entry, describeError(result.error))
      return { proceed: true, applied: false }
    }
    const reachable = result.status !== 0 && !isNetworkError(result.error)
    if (!reachable) return { proceed: false, applied: false }
    const attempts = (entry.attempts ?? 0) + 1
    if (attempts < MAX_REACHABLE_ATTEMPTS) {
      await store.set(entry.key, { ...entry, attempts })
      return { proceed: false, applied: false }
    }
    await moveToFailed(user, entry.key, entry, `${describeError(result.error)} (nach ${attempts} Versuchen aufgegeben)`)
    return { proceed: true, applied: false }
  }

  async function replayOnce(): Promise<{ outcome: ReplayOutcome; applied: number }> {
    const user = userId
    if (!user || !deps.isOnline()) return { outcome: 'skipped', applied: 0 }
    if (!(await canSyncSafely(user))) return { outcome: 'skipped', applied: 0 }
    if (!snapshot.syncing) publish({ syncing: true })
    let applied = 0
    for (;;) {
      const queue = await readQueue(user)
      if (queue.length === 0) return { outcome: 'done', applied }
      for (const [key, raw] of queue) {
        if (user !== userId || !(await canSyncSafely(user))) return { outcome: 'interrupted', applied }
        if (!isOutboxEntry(raw) || raw.key !== key) {
          const createdAt = raw && typeof raw === 'object' && 'createdAt' in raw && typeof raw.createdAt === 'string' ? raw.createdAt : now().toISOString()
          await moveToFailed(user, key, { createdAt, op: null }, 'Ungültiger gespeicherter Eintrag')
        } else {
          const step = await processEntry(user, raw)
          if (step.applied) applied++
          if (!step.proceed) {
            await refreshCounts(user)
            return { outcome: 'interrupted', applied }
          }
        }
        await refreshCounts(user)
      }
    }
  }

  function replay(): Promise<ReplayOutcome> {
    if (running) {
      rerun = true
      return running
    }
    running = (async () => {
      let outcome: ReplayOutcome = 'skipped'
      let applied = 0
      try {
        do {
          rerun = false
          const result = await withLock(replayOnce)
          outcome = result.outcome
          applied += result.applied
        } while (rerun && outcome === 'done')
      } finally {
        running = null
        publish({ syncing: false, ...(applied > 0 ? { lastSyncedAt: now().getTime() } : {}) })
        if (applied > 0) for (const listener of appliedListeners) listener()
      }
      return outcome
    })()
    return running
  }

  async function enqueue(op: OutboxOp): Promise<void> {
    const user = userId
    if (!user) throw new Error('Kein angemeldeter Nutzer für die Warteschlange')
    // Fortlaufender Zähler statt Uhrzeit: Reihenfolge bleibt auch bei verstellter Uhr und zwischen Tabs eindeutig.
    const seq = await store.increment(SEQ_KEY)
    const key = `${outboxPrefix(user)}${String(seq).padStart(12, '0')}`
    const entry: OutboxEntry = { key, userId: user, createdAt: now().toISOString(), op }
    await store.set(key, entry)
    await refreshCounts(user)
    if (autoReplay) void replay()
  }

  return {
    async setUser(next: string | null): Promise<void> {
      if (next === userId) return
      userId = next
      publish({ pending: 0, queued: [], failed: [] })
      if (next) await refreshCounts(next)
    },

    enqueue,

    /** Noch nicht übertragene Einträge des aktuellen Nutzers, für die Anzeige lokaler Änderungen. */
    async pending(): Promise<OutboxEntry[]> {
      if (!userId) return []
      return (await readQueue(userId)).flatMap(([, v]) => (isOutboxEntry(v) ? [v] : []))
    },

    replay,

    async discardFailed(key: string): Promise<void> {
      if (!userId || !key.startsWith(failedPrefix(userId))) return
      await store.delete(key)
      await refreshCounts(userId)
    },

    /** Hängt einen abgelehnten Eintrag erneut ans Ende der Schlange; erst danach verschwindet er aus der Fehlerliste. */
    async retryFailed(key: string): Promise<void> {
      const user = userId
      if (!user || !key.startsWith(failedPrefix(user))) return
      const failed = await store.get(key)
      if (!isFailedEntry(failed) || failed.op === null) return
      await enqueue(failed.op)
      await store.delete(key)
      await refreshCounts(user)
    },

    setOnline(online: boolean) {
      if (online !== snapshot.online) publish({ online })
    },

    getSnapshot: (): SyncSnapshot => snapshot,

    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /** Wird aufgerufen, wenn ein Abgleich mindestens einen Eintrag übertragen hat. */
    onApplied(listener: () => void): () => void {
      appliedListeners.add(listener)
      return () => appliedListeners.delete(listener)
    },
  }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
