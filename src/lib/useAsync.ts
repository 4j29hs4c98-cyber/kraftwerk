import { useCallback, useEffect, useRef, useState } from 'react'
import { syncEngine } from './offline'
import { toMessage } from './supabase'

/** Beim Zurückkehren in die App höchstens so oft neu laden (Fokuswechsel kommen am Rechner oft). */
const RESUME_RELOAD_MIN_MS = 15_000

export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly data: T }

/**
 * Lädt Daten und liefert Lade-, Fehler- und Erfolgszustand. Ändern sich die
 * Abhängigkeiten, wird neu geladen und kurz der Ladezustand gezeigt. reload()
 * lädt im Hintergrund nach und behält die alten Daten bis zur Antwort.
 * Still nachgeladen wird auch beim Zurückkehren in die App (Änderungen von
 * anderen Geräten) und nachdem offline gespeicherte Einträge übertragen wurden.
 * Scheitert ein stilles Nachladen, bleiben die bisherigen Daten stehen.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const silent = useRef(false)
  const stableLoad = useCallback(load, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    const isSilent = silent.current
    if (!isSilent) setState({ status: 'loading' })
    silent.current = false
    stableLoad()
      .then((data) => {
        if (active) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!active) return
        // Ein stilles Nachladen ersetzt geladene Daten nie durch einen Fehler (etwa offline mitten im Training).
        setState((prev) => (isSilent && prev.status === 'ready' ? prev : { status: 'error', message: toMessage(error) }))
      })
    return () => {
      active = false
    }
  }, [stableLoad, tick])

  const reload = useCallback(() => {
    silent.current = true
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let last = Date.now()
    function onResume() {
      if (document.visibilityState === 'hidden' || Date.now() - last < RESUME_RELOAD_MIN_MS) return
      last = Date.now()
      reload()
    }
    window.addEventListener('focus', onResume)
    document.addEventListener('visibilitychange', onResume)
    const unsubscribe = syncEngine.onApplied(reload)
    return () => {
      window.removeEventListener('focus', onResume)
      document.removeEventListener('visibilitychange', onResume)
      unsubscribe()
    }
  }, [reload])

  return { ...state, reload }
}
