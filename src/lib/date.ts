const pad = (n: number): string => String(n).padStart(2, '0')

/** Lokales Datum als YYYY-MM-DD (nicht UTC, damit der Tag zur Uhr des Nutzers passt). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Montag der Woche, 00:00 Uhr lokal. */
export function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset)
}

const LONG_DATE = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const SHORT_DATE = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })
const MONTH = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })

export const formatLongDate = (d: Date): string => LONG_DATE.format(d)
export const formatShortDate = (d: Date): string => SHORT_DATE.format(d)
export const formatMonth = (d: Date): string => MONTH.format(d)

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}
