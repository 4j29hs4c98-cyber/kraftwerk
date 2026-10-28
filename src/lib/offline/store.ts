/**
 * Kleiner Schlüssel-Wert-Speicher für Offline-Daten. Im Browser liegt er in
 * IndexedDB, in Tests (und falls IndexedDB fehlt, etwa im privaten Modus) im
 * Arbeitsspeicher. Schlüssel werden als Text sortiert; Präfixe gruppieren
 * zusammengehörige Einträge (zum Beispiel alle Warteschlangen-Einträge eines Nutzers).
 */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  /** Alle Einträge mit diesem Präfix, aufsteigend nach Schlüssel. */
  entries(prefix: string): Promise<Array<readonly [string, unknown]>>
  deletePrefix(prefix: string): Promise<void>
  /** Erhöht einen Zähler atomar (auch zwischen mehreren Tabs) und liefert den neuen Wert. */
  increment(key: string): Promise<number>
}

const asCount = (v: unknown): number => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0)

/** Obergrenze für Präfix-Bereiche: höher als jedes Zeichen, das in Schlüsseln vorkommt. */
const PREFIX_END = '￿'

export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, unknown>()
  const sortedKeys = (prefix: string) => [...data.keys()].filter((k) => k.startsWith(prefix)).sort()
  return {
    async get(key) {
      return structuredClone(data.get(key))
    },
    async set(key, value) {
      data.set(key, structuredClone(value))
    },
    async delete(key) {
      data.delete(key)
    },
    async entries(prefix) {
      return sortedKeys(prefix).map((k) => [k, structuredClone(data.get(k))] as const)
    },
    async deletePrefix(prefix) {
      for (const k of sortedKeys(prefix)) data.delete(k)
    },
    async increment(key) {
      const next = asCount(data.get(key)) + 1
      data.set(key, next)
      return next
    },
  }
}

const DB_NAME = 'kraftwerk-offline'
const DB_VERSION = 1
const STORE = 'kv'

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Anfrage fehlgeschlagen'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB lässt sich nicht öffnen'))
    request.onblocked = () => reject(new Error('IndexedDB ist blockiert'))
  })
}

function createIndexedDbStore(db: IDBDatabase): KeyValueStore {
  async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const tx = db.transaction(STORE, mode)
    const result = await promisify(action(tx.objectStore(STORE)))
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Transaktion fehlgeschlagen'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Transaktion abgebrochen'))
      })
    }
    return result
  }
  const range = (prefix: string) => IDBKeyRange.bound(prefix, prefix + PREFIX_END)
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    set: async (key, value) => {
      await run('readwrite', (s) => s.put(value, key))
    },
    delete: async (key) => {
      await run('readwrite', (s) => s.delete(key))
    },
    async entries(prefix) {
      // Schlüssel und Werte aus derselben Transaktion, damit beide zusammenpassen.
      const store = db.transaction(STORE, 'readonly').objectStore(STORE)
      const [keys, values] = await Promise.all([promisify(store.getAllKeys(range(prefix))), promisify(store.getAll(range(prefix)))])
      return keys.map((k, i) => [String(k), values[i]] as const)
    },
    deletePrefix: async (prefix) => {
      await run('readwrite', (s) => s.delete(range(prefix)))
    },
    // Lesen und Schreiben in einer readwrite-Transaktion: IndexedDB führt solche nacheinander aus, auch über Tabs hinweg.
    increment: (key) =>
      new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        let next = 0
        const read = store.get(key)
        read.onsuccess = () => {
          next = asCount(read.result) + 1
          store.put(next, key)
        }
        tx.oncomplete = () => resolve(next)
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB-Zähler fehlgeschlagen'))
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB-Zähler abgebrochen'))
      }),
  }
}

/**
 * Öffnet IndexedDB; klappt das nicht, bleibt die App mit einem Speicher im
 * Arbeitsspeicher benutzbar (dann nur ohne Offline-Vorrat über Neustarts).
 */
export function createBrowserStore(): KeyValueStore {
  const ready: Promise<KeyValueStore> =
    typeof indexedDB === 'undefined'
      ? Promise.resolve(createMemoryStore())
      : openDatabase().then(createIndexedDbStore, (error: unknown) => {
          console.warn('IndexedDB nicht verfügbar, Offline-Daten bleiben nur bis zum Neuladen erhalten.', error)
          return createMemoryStore()
        })
  return {
    get: async (key) => (await ready).get(key),
    set: async (key, value) => (await ready).set(key, value),
    delete: async (key) => (await ready).delete(key),
    entries: async (prefix) => (await ready).entries(prefix),
    deletePrefix: async (prefix) => (await ready).deletePrefix(prefix),
    increment: async (key) => (await ready).increment(key),
  }
}
