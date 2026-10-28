import { normalizeName } from './exercises'

/** Wochentage wie in plan_days.weekday: 0 = Montag bis 6 = Sonntag. */
export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
export const WEEKDAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6]
export const REST_DAY_TITLE = 'Ruhetag'

const ALIASES: readonly (readonly string[])[] = [
  ['montag', 'mo', 'mon', 'monday'],
  ['dienstag', 'di', 'die', 'tue', 'tues', 'tuesday'],
  ['mittwoch', 'mi', 'mit', 'wed', 'wednesday'],
  ['donnerstag', 'do', 'don', 'thu', 'thur', 'thurs', 'thursday'],
  ['freitag', 'fr', 'fre', 'fri', 'friday'],
  ['samstag', 'sa', 'sam', 'sat', 'saturday', 'sonnabend'],
  ['sonntag', 'so', 'son', 'sun', 'sunday'],
]

/** "Montag", "Mo", "mo.", "Monday" in 0 bis 6; alles andere (z. B. "Tag 1") ergibt null. */
export function parseWeekday(text: string): number | null {
  const key = normalizeName(text).replace(/\.$/, '').trim()
  if (key === '') return null
  const index = ALIASES.findIndex((names) => names.includes(key))
  return index >= 0 ? index : null
}

/** Wochentag eines lokalen Datums, Montag = 0. */
export function weekdayOf(date: Date): number {
  return (date.getDay() + 6) % 7
}

export const weekdayName = (weekday: number): string => WEEKDAY_NAMES[weekday] ?? ''

/** Was ein Plantag mindestens mitbringen muss, damit die Wochenlogik arbeiten kann. */
export interface WeekdayDay {
  readonly weekday: number | null
  readonly is_rest: boolean
}

/** Ein Plan arbeitet mit Wochentagen, wenn jeder Tag einen hat (create_plan erzwingt alle oder keinen). */
export function hasWeekdays(days: readonly WeekdayDay[]): boolean {
  return days.length > 0 && days.every((d) => d.weekday !== null)
}

/** Die Woche von Montag bis Sonntag; Wochentage ohne Eintrag bleiben leer (gelten als Ruhetag). */
export function weekSlots<T extends WeekdayDay>(days: readonly T[]): readonly { readonly weekday: number; readonly day: T | null }[] {
  return WEEKDAYS.map((weekday) => ({ weekday, day: days.find((d) => d.weekday === weekday) ?? null }))
}

export type TodayPlan<T> =
  | { readonly kind: 'training'; readonly day: T }
  | { readonly kind: 'rest'; readonly day: T | null; readonly next: { readonly day: T; readonly weekday: number } | null }

/**
 * Plantag für einen Wochentag in einem Plan mit Wochentagen. Ruhetage und Wochentage
 * ohne Eintrag gelten als Ruhetag; dazu kommt der nächste Trainingstag danach.
 */
export function planForWeekday<T extends WeekdayDay>(days: readonly T[], weekday: number): TodayPlan<T> {
  const today = days.find((d) => d.weekday === weekday) ?? null
  if (today && !today.is_rest) return { kind: 'training', day: today }
  const next = [1, 2, 3, 4, 5, 6, 7]
    .map((offset) => (weekday + offset) % 7)
    .map((wd) => ({ weekday: wd, day: days.find((d) => d.weekday === wd && !d.is_rest) }))
    .find((slot): slot is { weekday: number; day: T } => slot.day !== undefined)
  return { kind: 'rest', day: today, next: next ?? null }
}

/**
 * Gilt ein Datum laut Plan als Trainingstag? null, wenn der Plan keine Wochentage hat
 * (dann entscheidet weiter, ob trainiert wurde).
 */
export function isPlannedTrainingDay(days: readonly WeekdayDay[], date: Date): boolean | null {
  if (!hasWeekdays(days)) return null
  return planForWeekday(days, weekdayOf(date)).kind === 'training'
}
