import { addDays, parseISODate, toISODate } from '../../lib/date'
import { isPlannedTrainingDay, type WeekdayDay } from '../plan/weekdays'

export interface TrainingDayDefault {
  readonly isTrainingDay: boolean
  /** Kurze Begründung für die Anzeige unter dem Schalter. */
  readonly reason: string
}

/**
 * Standard für den Schalter Trainingstag/Ruhetag: Wurde trainiert, ist es ein Trainingstag.
 * Sonst entscheidet ein Plan mit Wochentagen (Ruhetag oder Wochentag ohne Eintrag: Ruhetag),
 * ohne Wochentage bleibt es wie bisher beim Ruhetag, bis ein Training beginnt.
 */
export function defaultTrainingDay(date: Date, workedOut: boolean, planDays: readonly WeekdayDay[]): TrainingDayDefault {
  if (workedOut) return { isTrainingDay: true, reason: 'An diesem Tag hast du trainiert.' }
  const planned = isPlannedTrainingDay(planDays, date)
  if (planned === true) return { isTrainingDay: true, reason: 'Laut Wochenplan ein Trainingstag.' }
  if (planned === false) return { isTrainingDay: false, reason: 'Laut Wochenplan ein Ruhetag.' }
  return { isTrainingDay: false, reason: 'An diesem Tag gibt es noch kein Training.' }
}

export type TrainingOverrides = Readonly<Record<string, boolean>>

const STORAGE_KEY = 'kraftwerk.trainingDayOverride.v1'
/** Ältere Einträge braucht die Ansicht nicht mehr (Wochenauswertung reicht bis Montag). */
const KEEP_DAYS = 60
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Liest gespeicherte Überstimmungen; alles, was nicht Datum -> true/false ist, fällt weg. */
export function parseOverrides(raw: string | null): TrainingOverrides {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => ISO_DATE.test(entry[0]) && typeof entry[1] === 'boolean'))
  } catch {
    return {}
  }
}

/** Entfernt Einträge, die älter als KEEP_DAYS Tage vor today sind. */
export function pruneOverrides(overrides: TrainingOverrides, today: string): TrainingOverrides {
  const cutoff = toISODate(addDays(parseISODate(today), -KEEP_DAYS))
  return Object.fromEntries(Object.entries(overrides).filter(([date]) => date >= cutoff))
}

export function loadOverrides(): TrainingOverrides {
  try {
    return parseOverrides(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Privater Modus oder gesperrter Speicher: dann gilt der Schalter nur in dieser Sitzung.
    return {}
  }
}

export function saveOverrides(overrides: TrainingOverrides, today: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneOverrides(overrides, today)))
  } catch {
    // Speichern ist eine Bequemlichkeit; ohne Speicher bleibt der Wert bis zum Neuladen erhalten.
  }
}
