import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Supabase-Konfiguration fehlt: VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY in .env.local setzen.')
}

/** Unter diesem Schlüssel legt supabase-js die Session im localStorage ab (Standard der Bibliothek). */
export const AUTH_STORAGE_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export const supabase = createClient<Database>(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Fehler mit einer Meldung, die so wie sie ist angezeigt werden darf (zum Beispiel Validierung). */
export class UserFacingError extends Error {
  override readonly name = 'UserFacingError'
}

/** Wandelt Supabase-Fehler in verständliche deutsche Meldungen um. */
export function toMessage(error: unknown, fallback = 'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.'): string {
  if (error instanceof UserFacingError) return error.message
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Keine Internetverbindung. Bitte prüfe dein Netz.'
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const msg = error.message.toLowerCase()
    const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
    if (code === '42501') return 'Du bist nicht mehr angemeldet. Bitte melde dich neu an.'
    if (code === '22023') {
      // Meldungen der RPCs haben die Form "create_plan: <Grund>".
      const reason = error.message.replace(/^[a-z_]+:\s*/, '').trim()
      return reason ? `Ungültige Eingabe: ${reason}.` : 'Ungültige Eingabe. Bitte prüfe deine Angaben.'
    }
    if (msg.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmen nicht.'
    if (msg.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse.'
    if (msg.includes('user already registered')) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.'
    if (msg.includes('password should be at least')) return 'Das Passwort muss mindestens 8 Zeichen lang sein.'
    if (msg.includes('rate limit')) return 'Zu viele Versuche. Bitte warte kurz.'
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Server nicht erreichbar. Bitte prüfe deine Verbindung.'
  }
  return fallback
}

/** Liefert die Daten einer Supabase-Antwort oder wirft deren Fehler. Leere Antworten gelten als Fehler. */
export function unwrap<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error) throw result.error
  if (result.data === null || result.data === undefined) throw new Error('Keine Daten erhalten')
  return result.data
}

/** Wie unwrap, aber null ist ein gültiges Ergebnis (zum Beispiel bei maybeSingle). */
export function unwrapMaybe<T>(result: { data: T; error: unknown }): T | null {
  if (result.error) throw result.error
  return result.data
}

/** Für Schreibzugriffe ohne Rückgabe: wirft nur den Fehler. */
export function check(result: { error: unknown }): void {
  if (result.error) throw result.error
}
