import { addDays, startOfWeek, toISODate } from '../../lib/date'

/**
 * Anzahl aufeinanderfolgender Wochen (Montag bis Sonntag) mit mindestens einem
 * abgeschlossenen Workout. Die laufende Woche bricht die Serie nicht ab, solange
 * sie noch kein Workout hat: dann wird ab der Vorwoche gezählt.
 */
export function weekStreak(finishedDates: readonly Date[], today: Date): number {
  const weeks = new Set(finishedDates.map((d) => toISODate(startOfWeek(d))))
  const current = startOfWeek(today)
  const start = weeks.has(toISODate(current)) ? current : addDays(current, -7)

  const count = (week: Date, acc: number): number =>
    weeks.has(toISODate(week)) ? count(addDays(week, -7), acc + 1) : acc

  return count(start, 0)
}

/** Tage (YYYY-MM-DD) eines Monats, an denen trainiert wurde. */
export function trainingDaysInMonth(finishedDates: readonly Date[], year: number, month: number): ReadonlySet<string> {
  return new Set(
    finishedDates.filter((d) => d.getFullYear() === year && d.getMonth() === month).map((d) => toISODate(d)),
  )
}
