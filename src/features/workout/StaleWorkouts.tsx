import { useState } from 'react'
import { Button } from '../../components/Button'
import { InlineError } from '../../components/States'
import { formatLongDate } from '../../lib/date'
import { toMessage } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { cleanupStaleWorkouts, discardWorkout, finishStaleWorkout, type StaleWorkout } from './api'

/**
 * Räumt beim Laden liegengebliebene Trainings auf: leere werden still gelöscht,
 * solche mit Sätzen erscheinen hier zum Abschließen oder Verwerfen.
 */
export function StaleWorkouts({ onChanged }: { readonly onChanged: () => void }) {
  const stale = useAsync(cleanupStaleWorkouts, [])
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (stale.status !== 'ready') return null
  const open = stale.data.filter((w) => !handled.has(w.id))
  if (open.length === 0) return null

  async function resolve(workout: StaleWorkout, action: 'finish' | 'discard') {
    if (action === 'discard' && !window.confirm('Dieses Training mit allen Sätzen löschen?')) return
    setBusy(workout.id)
    setError(null)
    try {
      if (action === 'finish') await finishStaleWorkout(workout)
      else await discardWorkout(workout.id)
      setHandled((prev) => new Set([...prev, workout.id]))
      onChanged()
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Offene Trainings" className="mb-6 rounded-2xl border border-accent/40 bg-surface p-4">
      <p className="font-semibold">Nicht abgeschlossenes Training</p>
      <p className="mt-1 text-sm text-muted">Diese Trainings wurden begonnen, aber nie beendet. Abschließen übernimmt sie in deine Statistik.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {open.map((w) => (
          <li key={w.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm capitalize">
              {formatLongDate(new Date(w.startedAt))} · {w.setCount} {w.setCount === 1 ? 'Satz' : 'Sätze'}
            </span>
            <span className="flex gap-2">
              <Button className="min-h-11 px-4" loading={busy === w.id} onClick={() => void resolve(w, 'finish')}>Abschließen</Button>
              <Button variant="ghost" className="min-h-11 px-4" disabled={busy === w.id} onClick={() => void resolve(w, 'discard')}>Verwerfen</Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2"><InlineError message={error} /></div>
    </section>
  )
}
