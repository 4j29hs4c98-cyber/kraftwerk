import { useEffect, useState } from 'react'
import { formatClock } from '../../lib/date'

export interface RestState {
  readonly endsAt: number
  readonly total: number
}

const TICK_MS = 250
const EXTEND_SECONDS = 30
const VIBRATE_MS = 300

interface Props {
  readonly rest: RestState
  readonly onChange: (rest: RestState | null) => void
}

/** Pausen-Timer am unteren Rand. Rechnet mit Zeitstempeln, damit er auch im Hintergrund stimmt. */
export function RestTimer({ rest, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const remaining = (rest.endsAt - now) / 1000
  const isDone = remaining <= 0

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (isDone && 'vibrate' in navigator) navigator.vibrate(VIBRATE_MS)
  }, [isDone])

  const progress = Math.min(1, Math.max(0, 1 - remaining / rest.total))

  return (
    <div role="timer" aria-live="polite" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
      <div className="h-1 bg-surface-2">
        <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted">{isDone ? 'Pause vorbei' : 'Pause'}</p>
          <p className={`font-display text-4xl font-bold tabular-nums leading-none ${isDone ? 'text-ok' : ''}`}>
            {isDone ? 'Los geht’s' : formatClock(remaining)}
          </p>
        </div>
        {!isDone && (
          <button
            type="button"
            onClick={() => onChange({ endsAt: rest.endsAt + EXTEND_SECONDS * 1000, total: rest.total + EXTEND_SECONDS })}
            className="min-h-12 rounded-xl border border-line px-4 font-semibold"
          >
            +30 s
          </button>
        )}
        <button type="button" onClick={() => onChange(null)} className="min-h-12 rounded-xl bg-surface-2 px-4 font-semibold">
          {isDone ? 'Schließen' : 'Überspringen'}
        </button>
      </div>
    </div>
  )
}
