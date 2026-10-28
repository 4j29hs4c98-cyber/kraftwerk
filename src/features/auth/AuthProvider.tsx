import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearOfflineCache, setOfflineUser } from '../../lib/offline'
import { AUTH_STORAGE_KEY, supabase } from '../../lib/supabase'
import { readStoredSession } from './storedSession'

interface AuthState {
  readonly session: Session | null
  readonly loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

/**
 * Meldet supabase-js keine Session, liegt aber noch eine im Speicher, konnte
 * das Token nur nicht erneuert werden (typisch offline). Dann bleibt der Nutzer
 * angemeldet, statt auf die Login-Seite geworfen zu werden.
 */
const withOfflineFallback = (session: Session | null): Session | null => session ?? readStoredSession(AUTH_STORAGE_KEY)

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    let active = true
    function apply(session: Session | null) {
      // Vor dem Rendern setzen, damit Vorrat und Warteschlange schon dem richtigen Nutzer gehören.
      setOfflineUser(session?.user.id ?? null)
      setState({ session, loading: false })
    }
    supabase.auth
      .getSession()
      .then(({ data }) => active && apply(withOfflineFallback(data.session)))
      .catch(() => active && apply(withOfflineFallback(null)))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void clearOfflineCache()
        apply(null)
        return
      }
      apply(withOfflineFallback(session))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
