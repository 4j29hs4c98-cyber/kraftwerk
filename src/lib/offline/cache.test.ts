import { describe, expect, it } from 'vitest'
import { createReadCache, KEEP } from './cache'
import { createMemoryStore } from './store'

const NETWORK_ERROR = { message: 'TypeError: Failed to fetch', code: '' }

function setup() {
  let online = true
  const cache = createReadCache(createMemoryStore(), { isOnline: () => online })
  return { cache, setOnline: (value: boolean) => (online = value) }
}

describe('Lese-Vorrat', () => {
  it('lädt vom Server und legt das Ergebnis ab', async () => {
    const { cache } = setup()
    expect(await cache.read('u1', 'plan', async () => ({ name: 'PPL' }))).toEqual({ name: 'PPL' })
    expect(await cache.read('u1', 'plan', () => Promise.reject(NETWORK_ERROR))).toEqual({ name: 'PPL' })
  })

  it('fällt bei Netzwerkfehler auf den Vorrat zurück, auch für null als Ergebnis', async () => {
    const { cache } = setup()
    await cache.read('u1', 'plan', async () => null)
    expect(await cache.read('u1', 'plan', () => Promise.reject(new TypeError('Load failed')))).toBeNull()
  })

  it('wirft den Netzwerkfehler weiter, wenn nichts im Vorrat liegt', async () => {
    const { cache } = setup()
    await expect(cache.read('u1', 'plan', () => Promise.reject(NETWORK_ERROR))).rejects.toBe(NETWORK_ERROR)
  })

  it('wirft Serverfehler weiter statt alte Daten zu zeigen', async () => {
    const { cache } = setup()
    await cache.read('u1', 'plan', async () => 'alt')
    const serverError = { message: 'permission denied', code: '42501' }
    await expect(cache.read('u1', 'plan', () => Promise.reject(serverError))).rejects.toBe(serverError)
  })

  it('fragt offline gar nicht erst den Server, wenn der Vorrat etwas hat', async () => {
    const { cache, setOnline } = setup()
    await cache.read('u1', 'plan', async () => 'gespeichert')
    setOnline(false)
    let called = false
    const value = await cache.read('u1', 'plan', async () => {
      called = true
      return 'neu'
    })
    expect(value).toBe('gespeichert')
    expect(called).toBe(false)
  })

  it('zeigt einem anderen Nutzer nie den Vorrat eines anderen', async () => {
    const { cache } = setup()
    await cache.read('anna', 'plan', async () => 'Annas Plan')
    await expect(cache.read('ben', 'plan', () => Promise.reject(NETWORK_ERROR))).rejects.toBe(NETWORK_ERROR)
  })

  it('leert den Vorrat beim Abmelden', async () => {
    const { cache } = setup()
    await cache.read('u1', 'plan', async () => 'x')
    await cache.clear()
    await expect(cache.read('u1', 'plan', () => Promise.reject(NETWORK_ERROR))).rejects.toBe(NETWORK_ERROR)
  })

  it('speichert ohne Nutzer nichts', async () => {
    const { cache } = setup()
    await cache.read(null, 'plan', async () => 'x')
    await expect(cache.read(null, 'plan', () => Promise.reject(NETWORK_ERROR))).rejects.toBe(NETWORK_ERROR)
  })

  it('übersteht Map, Set und Date unverändert', async () => {
    const { cache } = setup()
    const value = { sets: new Map([['bench', [{ weightKg: 60, reps: 8 }]]]), days: new Set(['2026-10-28']), at: new Date(0) }
    await cache.read('u1', 'mix', async () => value)
    expect(await cache.read('u1', 'mix', () => Promise.reject(NETWORK_ERROR))).toEqual(value)
  })
})

describe('Lese-Vorrat: leerer Serverstand und Schutz vor alten Antworten', () => {
  it('liefert offline ohne Vorrat den leeren Serverstand statt eines Fehlers', async () => {
    const { cache, setOnline } = setup()
    expect(await cache.read('u1', 'food:2026-10-29', () => Promise.reject(NETWORK_ERROR), { empty: [] })).toEqual([])
    setOnline(false)
    expect(await cache.read('u1', 'workout:open:d9', async () => 'nie gefragt', { empty: null })).toBeNull()
  })

  it('legt eine Antwort nicht ab, wenn inzwischen ein anderer Nutzer angemeldet ist', async () => {
    let user: string | null = 'anna'
    const cache = createReadCache(createMemoryStore(), { isOnline: () => true, currentUser: () => user })
    await cache.read('anna', 'plan', async () => {
      user = 'ben'
      return 'Annas Plan'
    })
    await expect(cache.read('anna', 'plan', () => Promise.reject(NETWORK_ERROR))).rejects.toBe(NETWORK_ERROR)
  })

  it('überschreibt einen nachgezogenen Vorrat nicht mit einer älteren Serverantwort', async () => {
    const { cache } = setup()
    await cache.read('u1', 'food:2026-10-28', async () => [])
    let release: (v: string[]) => void = () => undefined
    const slow = cache.read('u1', 'food:2026-10-28', () => new Promise<string[]>((r) => (release = r)))
    await cache.transform('u1', (key) => (key === 'food:2026-10-28' ? ['nachgezogen'] : KEEP))
    release(['alt'])
    await slow
    expect(await cache.read('u1', 'food:2026-10-28', () => Promise.reject(NETWORK_ERROR))).toEqual(['nachgezogen'])
  })
})
