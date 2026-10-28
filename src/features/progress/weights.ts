import { parseNumber } from '../profile/body'

/** Wie viele Messungen die Gewichtskurve höchstens zeigt (die jüngsten). */
export const BODY_WEIGHT_LIMIT = 365

/**
 * Bringt Messungen in zeitlich aufsteigende Reihenfolge für die Kurve.
 * Gibt ein neues Array zurück, das Original bleibt unverändert.
 * `measured_on` ist ein ISO-Datum (YYYY-MM-DD), daher genügt der Zeichenvergleich.
 */
export function sortChronologically<T extends { readonly measured_on: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.measured_on < b.measured_on ? -1 : a.measured_on > b.measured_on ? 1 : 0))
}

/** Erlaubter Bereich für den Körperfettanteil wie der Check in body_weights. */
export const BODY_FAT_RANGE = { min: 3, max: 60 } as const

/** Optionales Körperfett-Feld: leer = null, gültige Zahl auf eine Nachkommastelle, sonst undefined. */
export function parseBodyFat(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const n = parseNumber(text)
  if (n === null || n < BODY_FAT_RANGE.min || n > BODY_FAT_RANGE.max) return undefined
  return Math.round(n * 10) / 10
}
