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
