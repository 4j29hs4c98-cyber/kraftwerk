import { addDays, parseISODate, toISODate } from '../../../lib/date'
import { isMealSlot, MEAL_LIMITS, type MealSlot } from './model'

/** Gewählte Variante je Datum und Mahlzeit, z. B. { "2026-10-28": { "mittag": "Hähnchen mit Reis" } }. */
export type VariantChoices = Readonly<Record<string, Readonly<Partial<Record<MealSlot, string>>>>>

const STORAGE_KEY = 'kraftwerk.mealVariantChoice.v1'
/** Ältere Auswahlen braucht die Ansicht nicht mehr. */
const KEEP_DAYS = 60
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseDay(value: unknown): Partial<Record<MealSlot, string>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const slots = Object.entries(value).filter(
    (entry): entry is [MealSlot, string] => isMealSlot(entry[0]) && typeof entry[1] === 'string' && entry[1].trim() !== '' && entry[1].length <= MEAL_LIMITS.variantMax,
  )
  return slots.length > 0 ? Object.fromEntries(slots) : null
}

/** Liest gespeicherte Auswahlen; alles, was nicht Datum -> Mahlzeit -> Name ist, fällt weg. */
export function parseVariantChoices(raw: string | null): VariantChoices {
  if (!raw) return {}
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).flatMap(([date, day]) => {
        const parsed = ISO_DATE.test(date) ? parseDay(day) : null
        return parsed ? [[date, parsed]] : []
      }),
    )
  } catch {
    return {}
  }
}

/** Setzt die Auswahl für Datum und Mahlzeit und entfernt Einträge älter als KEEP_DAYS Tage vor today. */
export function withVariantChoice(choices: VariantChoices, date: string, slot: MealSlot, name: string, today: string): VariantChoices {
  const cutoff = toISODate(addDays(parseISODate(today), -KEEP_DAYS))
  const next: VariantChoices = { ...choices, [date]: { ...choices[date], [slot]: name } }
  return Object.fromEntries(Object.entries(next).filter(([day]) => day >= cutoff))
}

export function loadVariantChoices(): VariantChoices {
  try {
    return parseVariantChoices(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Privater Modus oder gesperrter Speicher: Auswahl gilt dann nur in dieser Sitzung.
    return {}
  }
}

export function saveVariantChoices(choices: VariantChoices): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  } catch {
    // Speichern ist eine Bequemlichkeit; ohne Speicher bleibt die Auswahl bis zum Neuladen erhalten.
  }
}
