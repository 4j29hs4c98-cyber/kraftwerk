import { pauseStatus, type PauseLevel } from './pause'

const LEVEL_STYLES: Readonly<Record<PauseLevel, { readonly box: string; readonly dot: string; readonly text: string }>> = {
  gruen: { box: 'border-ok/30 bg-ok/5', dot: 'bg-ok', text: 'text-ok' },
  gelb: { box: 'border-warn/30 bg-warn/5', dot: 'bg-warn', text: 'text-warn' },
  orange: { box: 'border-accent/40 bg-accent/5', dot: 'bg-accent', text: 'text-accent' },
  rot: { box: 'border-danger/40 bg-danger/5', dot: 'bg-danger', text: 'text-danger' },
}

/** Tage seit dem letzten abgeschlossenen Training mit Einordnung. Ohne Training unsichtbar. */
export function PauseIndicator({ finishedDates, now }: { readonly finishedDates: readonly Date[]; readonly now: Date }) {
  const status = pauseStatus(finishedDates, now)
  if (!status) return null
  const style = LEVEL_STYLES[status.level]
  return (
    <section aria-label="Trainingspause" className={`mb-6 rounded-2xl border p-4 ${style.box}`}>
      <p className="flex items-center gap-2 font-semibold">
        <span className={`size-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
        <span className={style.text}>{status.label}</span>
      </p>
      <p className="mt-1 text-sm text-muted">{status.message}</p>
    </section>
  )
}
