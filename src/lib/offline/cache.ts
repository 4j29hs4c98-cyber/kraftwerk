import { isNetworkError } from './errors'
import type { KeyValueStore } from './store'

/** Version im Schlüssel: ändert sich das Format, werden alte Einträge einfach nicht mehr gelesen. */
const PREFIX = 'cache:v1:'

interface CacheRecord {
  readonly value: unknown
  readonly savedAt: number
}

const isRecord = (v: unknown): v is CacheRecord => !!v && typeof v === 'object' && 'value' in v && 'savedAt' in v

/** Rückgabe eines Umbaus, der den Eintrag unverändert lassen will. */
export const KEEP: unique symbol = Symbol('unverändert')

export interface ReadOptions<T> {
  /**
   * Leerer Serverstand für Listen und optionale Abfragen. Ist offline nichts im
   * Vorrat (etwa ein noch nie geöffneter Tag), gilt dieser Wert statt eines Fehlers;
   * lokale Änderungen werden danach wie gewohnt darübergelegt.
   */
  readonly empty?: T
}

/**
 * Lese-Vorrat nach dem Muster "Netz zuerst": Jede erfolgreiche Antwort wird
 * je Nutzer abgelegt. Schlägt das Laden wegen fehlender Verbindung fehl (oder ist
 * das Gerät erkennbar offline), kommt der letzte Stand aus dem Vorrat.
 * Serverfehler werden weitergereicht, damit sie nicht hinter alten Daten verschwinden.
 */
export function createReadCache(store: KeyValueStore, deps: { readonly isOnline: () => boolean; readonly currentUser?: () => string | null }) {
  const userPrefix = (userId: string) => `${PREFIX}${userId}:`
  const keyFor = (userId: string, key: string) => userPrefix(userId) + key
  /** Zählt Umbauten je Nutzer; eine ältere Serverantwort darf einen neueren Umbau nicht überschreiben. */
  const generations = new Map<string, number>()
  const generation = (userId: string) => generations.get(userId) ?? 0

  async function lookup(fullKey: string): Promise<CacheRecord | null> {
    try {
      const hit = await store.get(fullKey)
      return isRecord(hit) ? hit : null
    } catch {
      return null
    }
  }

  async function write(userId: string | null, key: string, value: unknown): Promise<void> {
    if (!userId) return
    try {
      await store.set(keyFor(userId, key), { value, savedAt: Date.now() } satisfies CacheRecord)
    } catch (error) {
      console.warn('Offline-Vorrat konnte nicht gespeichert werden', error)
    }
  }

  async function peek(userId: string, prefix: string): Promise<Array<readonly [string, unknown]>> {
    const base = userPrefix(userId)
    const rows = await store.entries(base + prefix)
    return rows.flatMap(([k, v]) => (isRecord(v) ? [[k.slice(base.length), v.value] as const] : []))
  }

  return {
    /** Der Typ T wird nicht zur Laufzeit geprüft: Im Vorrat liegt nur, was load() oder ein Umbau zuvor geliefert hat. */
    async read<T>(userId: string | null, key: string, load: () => Promise<T>, options: ReadOptions<T> = {}): Promise<T> {
      if (!userId) return load()
      const fullKey = keyFor(userId, key)
      const hasEmpty = 'empty' in options
      if (!deps.isOnline()) {
        const hit = await lookup(fullKey)
        if (hit) return hit.value as T
        if (hasEmpty) return options.empty as T
      }
      const before = generation(userId)
      try {
        const value = await load()
        // Nur ablegen, wenn derselbe Nutzer noch angemeldet ist und der Vorrat inzwischen nicht nachgezogen wurde.
        const sameUser = !deps.currentUser || deps.currentUser() === userId
        if (sameUser && generation(userId) === before) await write(userId, key, value)
        return value
      } catch (error) {
        if (deps.isOnline() && !isNetworkError(error)) throw error
        const hit = await lookup(fullKey)
        if (hit) return hit.value as T
        if (hasEmpty) return options.empty as T
        throw error
      }
    },

    write,

    /** Alle Werte unter einem Schlüsselpräfix des Nutzers, Schlüssel ohne Nutzerteil. */
    peek,

    /**
     * Baut abgelegte Werte des Nutzers um (etwa nachdem ein Eintrag übertragen wurde).
     * change liefert den neuen Wert oder KEEP.
     */
    async transform(userId: string, change: (key: string, value: unknown) => unknown): Promise<void> {
      generations.set(userId, generation(userId) + 1)
      for (const [key, value] of await peek(userId, '')) {
        const next = change(key, value)
        if (next !== KEEP) await write(userId, key, next)
      }
    },

    async clear(): Promise<void> {
      generations.clear()
      await store.deletePrefix(PREFIX)
    },
  }
}

export type ReadCache = ReturnType<typeof createReadCache>
