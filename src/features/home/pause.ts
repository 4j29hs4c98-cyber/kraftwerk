export type PauseLevel = 'gruen' | 'gelb' | 'orange' | 'rot'

export interface PauseStatus {
  readonly days: number
  readonly level: PauseLevel
  /** "Letztes Training heute", "gestern" oder "vor X Tagen". */
  readonly label: string
  readonly message: string
}

interface Stage {
  readonly maxDays: number
  readonly level: PauseLevel
  readonly message: string
}

const STAGES: readonly Stage[] = [
  { maxDays: 7, level: 'gruen', message: 'Alles im grünen Bereich.' },
  { maxDays: 14, level: 'gelb', message: 'Kraft und Muskeln bleiben, Ausdauer und Pump lassen etwas nach.' },
  { maxDays: 21, level: 'orange', message: 'Erste leichte Kraftverluste möglich.' },
  {
    maxDays: Number.POSITIVE_INFINITY,
    level: 'rot',
    message: 'Muskelabbau beginnt messbar. Gute Nachricht: Durch das Muskelgedächtnis kommt es schneller zurück als beim ersten Aufbau.',
  },
]

const DAY_MS = 86400000

/** Kalendertage zwischen zwei Zeitpunkten nach lokaler Uhr (nicht 24-Stunden-Blöcke). */
export function localDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

function label(days: number): string {
  if (days === 0) return 'Letztes Training heute'
  if (days === 1) return 'Letztes Training gestern'
  return `Letztes Training vor ${days} Tagen`
}

/** Stufe nach Tagen seit dem letzten abgeschlossenen Training. Ohne Training: null (Anzeige ausblenden). */
export function pauseStatus(finishedDates: readonly Date[], now: Date): PauseStatus | null {
  if (finishedDates.length === 0) return null
  const last = finishedDates.reduce((latest, d) => (d > latest ? d : latest))
  const days = Math.max(0, localDaysBetween(last, now))
  const stage = STAGES.find((s) => days <= s.maxDays) ?? STAGES[STAGES.length - 1]
  if (!stage) return null
  return { days, level: stage.level, label: label(days), message: stage.message }
}
