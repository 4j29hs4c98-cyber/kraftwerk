import type { Session } from '@supabase/supabase-js'
import { clearOfflineCache, isNetworkError } from '../../lib/offline'
import { AUTH_STORAGE_KEY, supabase } from '../../lib/supabase'

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export type SignUpResult = { readonly session: Session } | { readonly session: null; readonly needsConfirmation: true }

/**
 * Registriert ein Konto. Ist die E-Mail-Bestätigung im Projekt aus, kommt sofort
 * eine Session zurück. Ist sie an, ist die Session null und der Nutzer muss
 * zuerst den Link in der Mail öffnen.
 */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  if (error) throw error
  return data.session ? { session: data.session } : { session: null, needsConfirmation: true }
}

/**
 * Meldet überall ab. Ohne Netz erreicht das den Server nicht: supabase-js entfernt
 * die Session dann trotzdem lokal und meldet nur den Netzfehler, das gilt als Erfolg.
 * Ist offline zusätzlich das Token abgelaufen, entfernt supabase-js nichts; dann wird
 * die gespeicherte Session hier gelöscht und die App neu geladen.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (!error) return
  if (!isNetworkError(error)) throw error
  if (localStorage.getItem(AUTH_STORAGE_KEY) === null) return
  localStorage.removeItem(AUTH_STORAGE_KEY)
  await clearOfflineCache()
  window.location.assign(import.meta.env.BASE_URL)
}
