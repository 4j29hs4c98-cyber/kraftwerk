import { useEffect, useRef, useState } from 'react'
import { toISODate } from './date'

/**
 * Heutiges Datum (YYYY-MM-DD), das sich beim Zurückkehren in die App aktualisiert.
 * Eine PWA bleibt oft über Nacht offen; ohne diese Prüfung stünde morgens noch gestern da.
 * onChange bekommt alten und neuen Tag, wenn der Tag gewechselt hat.
 */
export function useToday(onChange?: (previous: string, next: string) => void): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'hidden') return
      const next = toISODate(new Date())
      setToday((previous) => {
        if (previous !== next) callback.current?.(previous, next)
        return next
      })
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}
