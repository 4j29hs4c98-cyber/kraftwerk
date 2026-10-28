import { useEffect, useState } from 'react'
import { describeOp, syncEngine, type FailedEntry } from '../lib/offline'
import { useSyncStatus } from '../lib/offline/useSync'

/** So lange bleibt "Synchronisiert" nach einem erfolgreichen Abgleich stehen. */
const DONE_VISIBLE_MS = 3000

const entries = (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`)
const wait = (n: number) => `${entries(n)} ${n === 1 ? 'wartet' : 'warten'} auf Sync`

type Tone = 'muted' | 'warn' | 'ok'

const TONES: Record<Tone, string> = {
  muted: 'border-line bg-surface text-muted',
  warn: 'border-warn/40 bg-warn/10 text-warn',
  ok: 'border-ok/40 bg-ok/10 text-ok',
}

function Pill({ tone, children }: { readonly tone: Tone; readonly children: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite" className={`inline-flex min-h-8 items-center gap-2 self-start rounded-full border px-3 text-sm font-medium ${TONES[tone]}`}>
      <span aria-hidden="true" className="size-2 rounded-full bg-current" />
      {children}
    </p>
  )
}

function FailedList({ failed }: { readonly failed: readonly FailedEntry[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-3 text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-10 w-full items-center justify-between gap-2 text-left font-semibold text-danger">
        {entries(failed.length)} konnte{failed.length === 1 ? '' : 'n'} nicht gespeichert werden
        <span className="text-xs font-medium text-muted">{open ? 'Ausblenden' : 'Details'}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-3">
          {failed.map((f) => (
            <li key={f.key} className="flex flex-col gap-1 border-t border-line pt-2">
              <span className="text-ink">{describeOp(f.op)}</span>
              <span className="break-words text-xs text-muted">Nicht übertragen: {f.error}</span>
              <span className="mt-1 flex gap-2">
                {f.op && (
                  <button type="button" onClick={() => void syncEngine.retryFailed(f.key)} className="min-h-10 rounded-lg border border-line px-3 font-medium text-ink hover:bg-surface-2">
                    Erneut senden
                  </button>
                )}
                <button type="button" onClick={() => void syncEngine.discardFailed(f.key)} className="min-h-10 rounded-lg px-3 font-medium text-danger hover:bg-danger/10">
                  Verwerfen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Zeigt den Stand der Offline-Synchronisation: offline mit Anzahl wartender
 * Einträge, laufender Abgleich, kurz "Synchronisiert" danach und dauerhaft
 * abgelehnte Einträge mit der Wahl, sie erneut zu senden oder zu verwerfen.
 * Ohne etwas zu melden, bleibt die Fläche leer.
 */
export function SyncStatus({ className = '' }: { readonly className?: string }) {
  const { online, pending, syncing, failed, lastSyncedAt } = useSyncStatus()
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    if (lastSyncedAt === null) return
    setShowDone(true)
    const timer = setTimeout(() => setShowDone(false), DONE_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [lastSyncedAt])

  let pill: React.ReactNode = null
  if (!online) pill = <Pill tone="warn">{pending > 0 ? `Offline · ${wait(pending)}` : 'Offline · Änderungen werden auf dem Gerät gespeichert'}</Pill>
  else if (pending > 0) pill = <Pill tone="muted">{syncing ? 'Synchronisiere …' : wait(pending)}</Pill>
  else if (showDone) pill = <Pill tone="ok">Synchronisiert</Pill>

  if (!pill && failed.length === 0) return null
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {pill}
      {failed.length > 0 && <FailedList failed={failed} />}
    </div>
  )
}
