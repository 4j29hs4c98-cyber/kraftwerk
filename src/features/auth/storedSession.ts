import type { Session } from '@supabase/supabase-js'

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Liest die von supabase-js gespeicherte Session, auch wenn ihr Token abgelaufen ist.
 * Offline kann supabase-js das Token nicht erneuern und meldet dann "keine Session",
 * obwohl sie noch gespeichert ist. Für die Offline-Nutzung zählt sie trotzdem als
 * angemeldet; erneuert wird sie, sobald das Netz zurück ist. Ist sie wirklich ungültig,
 * löscht supabase-js sie aus dem Speicher und meldet SIGNED_OUT.
 */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(value) || typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string') return null
  if (!isObject(value.user) || typeof value.user.id !== 'string' || value.user.id === '') return null
  // Form geprüft (Token, Refresh-Token, Nutzer-id); übrige Felder stammen unverändert von supabase-js.
  return value as unknown as Session
}

export function readStoredSession(storageKey: string): Session | null {
  try {
    return parseStoredSession(localStorage.getItem(storageKey))
  } catch {
    return null
  }
}
