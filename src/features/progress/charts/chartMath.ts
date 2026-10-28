import { parseISODate } from '../../../lib/date'

export interface DatedValue {
  /** Lokales Datum YYYY-MM-DD. */
  readonly date: string
  readonly value: number
}

const DAY_MS = 86400000

/** Ganze Kalendertage zwischen zwei ISO-Daten (lokal, sommerzeitfest). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS)
}

/**
 * Gleitender Schnitt über die letzten windowDays Kalendertage (einschließlich des Tages selbst).
 * Erwartet zeitlich aufsteigende Werte; Lücken verkürzen das Fenster nicht künstlich.
 */
export function movingAverage(points: readonly DatedValue[], windowDays = 7): DatedValue[] {
  return points.map((point) => {
    const inWindow = points.filter((p) => {
      const diff = daysBetween(p.date, point.date)
      return diff >= 0 && diff < windowDays
    })
    const mean = inWindow.reduce((sum, p) => sum + p.value, 0) / inWindow.length
    return { date: point.date, value: Math.round(mean * 100) / 100 }
  })
}

/** Lineare Abbildung; ein leerer Wertebereich landet in der Mitte. */
export function linearScale(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  if (d1 === d0) return () => (r0 + r1) / 2
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

function niceStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep))
  const fraction = rawStep / 10 ** exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * 10 ** exponent
}

export interface Ticks {
  readonly min: number
  readonly max: number
  readonly ticks: readonly number[]
}

/** Runde Achsenwerte, die alle Daten einschließen (etwa count Abschnitte). */
export function niceTicks(minValue: number, maxValue: number, count = 4): Ticks {
  const lo = Math.min(minValue, maxValue)
  const hi = Math.max(minValue, maxValue)
  const span = hi - lo || Math.max(1, Math.abs(hi) * 0.1)
  const step = niceStep(span / Math.max(1, count))
  const min = Math.floor((hi === lo ? lo - span / 2 : lo) / step) * step
  const max = Math.ceil((hi === lo ? hi + span / 2 : hi) / step) * step
  const n = Math.round((max - min) / step)
  const ticks = Array.from({ length: n + 1 }, (_, i) => Math.round((min + i * step) * 1000) / 1000)
  return { min, max, ticks }
}

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** "+7,5 kg", "−1,2 kg", "±0 kg" (echtes Minuszeichen). */
export function formatSigned(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `±0 ${unit}`
  return `${rounded > 0 ? '+' : '−'}${NUMBER.format(Math.abs(rounded))} ${unit}`
}

/** "Latzug +7,5 kg seit Start" aus dem höchsten Gewicht der ersten und letzten Einheit. */
export function strengthSummary(name: string, maxWeights: readonly DatedValue[]): string | null {
  const first = maxWeights[0]
  const last = maxWeights.at(-1)
  if (!first || !last) return null
  if (maxWeights.length === 1) return `${name}: erste Einheit mit ${NUMBER.format(first.value)} kg`
  return `${name} ${formatSigned(last.value - first.value, 'kg')} seit Start`
}

const SUMMARY_WEEKS = 4

function periodLabel(days: number): string {
  if (days < 7) return days === 1 ? 'an 1 Tag' : `in ${days} Tagen`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'in 1 Woche' : `in ${weeks} Wochen`
}

/**
 * Veränderung über die letzten 4 Wochen (bei kürzerem Verlauf über alles), gemessen am
 * gleitenden Schnitt, damit einzelne Ausreißer die Aussage nicht kippen.
 */
export function weightTrendSummary(points: readonly DatedValue[], unit = 'kg'): string | null {
  const last = points.at(-1)
  if (!last || points.length < 2) return null
  const averaged = movingAverage(points)
  const fromIndex = averaged.findIndex((p) => daysBetween(p.date, last.date) <= SUMMARY_WEEKS * 7)
  const start = averaged[Math.max(0, fromIndex)]
  const end = averaged.at(-1)
  if (!start || !end) return null
  const days = daysBetween(start.date, end.date)
  if (days === 0) return null
  return `${formatSigned(end.value - start.value, unit)} ${periodLabel(days)}`
}

export interface ExerciseProgressPoint {
  readonly date: string
  readonly maxWeightKg: number
  readonly bestE1rm: number
}

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

/** Prüft die Antwort von exercise_progress und verwirft unvollständige Zeilen. */
export function parseExerciseProgress(data: unknown): ExerciseProgressPoint[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((row: unknown) => {
    if (!row || typeof row !== 'object') return []
    const record = row as Record<string, unknown>
    const date = typeof record.date === 'string' ? record.date.slice(0, 10) : null
    const maxWeightKg = toNumber(record.max_weight_kg)
    const bestE1rm = toNumber(record.best_e1rm)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || maxWeightKg === null || bestE1rm === null) return []
    return [{ date, maxWeightKg, bestE1rm }]
  })
}
