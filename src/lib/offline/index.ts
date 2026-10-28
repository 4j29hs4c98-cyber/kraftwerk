import { supabase } from '../supabase'
import type { OpenWorkoutView } from '../../features/workout/pending'
import { createReadCache, type ReadOptions } from './cache'
import { createExecutor } from './execute'
import type { OutboxEntry, OutboxOp } from './ops'
import { createSyncEngine } from './outbox'
import { createBrowserStore } from './store'
import { writeThrough } from './writeThrough'

/** Nach einem vorübergehenden Fehler (Server kurz weg) wird so lange gewartet, bevor erneut gesendet wird. */
const RETRY_DELAY_MS = 30_000

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

/**
 * Senden nur mit gültiger Anmeldung genau des Nutzers, dem die Schlange gehört.
 * getSession() erneuert ein abgelaufenes Token, sofern das Netz da ist.
 */
async function hasFreshSessionFor(userId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  return !!session && session.user.id === userId && (!session.expires_at || session.expires_at * 1000 > Date.now())
}

/** Web Locks, wo vorhanden: verhindert, dass zwei Tabs gleichzeitig dieselbe Schlange abarbeiten. */
function withSyncLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return run()
  return navigator.locks.request('kraftwerk-sync', run)
}

let currentUser: string | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

const store = createBrowserStore()
const cache = createReadCache(store, { isOnline, currentUser: () => currentUser })

/** Übertragene Einträge in den Vorrat einarbeiten, damit sie offline sichtbar bleiben. */
async function openWorkoutsOf(userId: string): Promise<OpenWorkoutView[]> {
  return (await cache.peek(userId, 'workout:open:')).flatMap(([, v]) => (v && typeof v === 'object' && 'workout' in v ? [v as OpenWorkoutView] : []))
}

async function applyToCache(entry: OutboxEntry): Promise<void> {
  const userId = entry.userId
  const openWorkouts = await openWorkoutsOf(userId)
  await cache.transform(userId, (key, value) => writeThrough(key, value, entry, { userId, openWorkouts }))
}

export const syncEngine = createSyncEngine({
  store,
  execute: createExecutor(supabase),
  isOnline,
  canSync: hasFreshSessionFor,
  onEntryApplied: applyToCache,
  withLock: withSyncLock,
})

/** Setzt den Nutzer, dem Vorrat und Warteschlange gehören. Wird vom AuthProvider vor dem Rendern der Seiten gesetzt. */
export function setOfflineUser(userId: string | null): void {
  if (userId === currentUser) return
  currentUser = userId
  void syncEngine.setUser(userId).then(() => requestSync())
}

export function currentUserId(): string | null {
  return currentUser
}

/** Liest über den Vorrat des aktuellen Nutzers: Netz zuerst, offline der letzte Stand. */
export function cachedRead<T>(key: string, load: () => Promise<T>, options?: ReadOptions<T>): Promise<T> {
  return cache.read(currentUser, key, load, options)
}

/** Offene Trainings, wie sie zuletzt im Vorrat lagen (für Vorschläge nach offline abgeschlossenen Trainings). */
export function cachedOpenWorkouts(): Promise<OpenWorkoutView[]> {
  return currentUser ? openWorkoutsOf(currentUser) : Promise.resolve([])
}

/** Legt einen frisch gespeicherten Stand in den Vorrat (etwa nach einer Profiländerung). */
export function primeCache(key: string, value: unknown): Promise<void> {
  return cache.write(currentUser, key, value)
}

export function clearOfflineCache(): Promise<void> {
  return cache.clear()
}

/** Schreibzugriff: landet sofort in der Warteschlange und wird gesendet, sobald Netz und Anmeldung da sind. */
export function submit(op: OutboxOp): Promise<void> {
  return syncEngine.enqueue(op)
}

export function pendingEntries(): Promise<OutboxEntry[]> {
  return syncEngine.pending()
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

/** Startet einen Abgleich. Bleibt danach etwas liegen (Fehler oder keine gültige Anmeldung), folgt genau ein weiterer Versuch später. */
export function requestSync(): void {
  clearRetry()
  void syncEngine
    .replay()
    .then((outcome) => {
      clearRetry()
      if (outcome !== 'done' && isOnline() && syncEngine.getSnapshot().pending > 0) retryTimer = setTimeout(requestSync, RETRY_DELAY_MS)
    })
    .catch((error: unknown) => console.warn('Abgleich fehlgeschlagen', error))
}

/** Abgleich beim Start, bei Rückkehr des Netzes und beim Zurückkehren in die App. Liefert die Aufräumfunktion. */
export function startSyncTriggers(): () => void {
  const onOnline = () => {
    syncEngine.setOnline(true)
    requestSync()
  }
  const onOffline = () => syncEngine.setOnline(false)
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  window.addEventListener('focus', requestSync)
  document.addEventListener('visibilitychange', onVisible)
  syncEngine.setOnline(isOnline())
  requestSync()
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('focus', requestSync)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

export { isNetworkError } from './errors'
export { describeOp, type FailedEntry, type OutboxEntry, type OutboxOp } from './ops'
export type { SyncSnapshot } from './outbox'
