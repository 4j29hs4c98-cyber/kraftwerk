import { useCallback, useEffect, useRef, useState } from 'react'
import { toMessage } from './supabase'

export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly data: T }

/**
 * Lädt Daten und liefert Lade-, Fehler- und Erfolgszustand. Ändern sich die
 * Abhängigkeiten, wird neu geladen und kurz der Ladezustand gezeigt. reload()
 * lädt im Hintergrund nach und behält die alten Daten bis zur Antwort.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const silent = useRef(false)
  const stableLoad = useCallback(load, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    if (!silent.current) setState({ status: 'loading' })
    silent.current = false
    stableLoad()
      .then((data) => {
        if (active) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: toMessage(error) })
      })
    return () => {
      active = false
    }
  }, [stableLoad, tick])

  const reload = useCallback(() => {
    silent.current = true
    setTick((t) => t + 1)
  }, [])
  return { ...state, reload }
}
