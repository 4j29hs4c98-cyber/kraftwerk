import type { Food } from './foodMath'

/** Wie der Check foods_barcode_check: EAN-8, UPC-A, EAN-13 und GTIN-14 sind 8 bis 14 Ziffern lang. */
const BARCODE_PATTERN = /^[0-9]{8,14}$/

/** Gibt den Code ohne Leerzeichen zurück, wenn er eine gültige Länge hat und nur aus Ziffern besteht, sonst null. */
export function normalizeBarcode(text: string): string | null {
  const code = text.replace(/\s+/g, '')
  return BARCODE_PATTERN.test(code) ? code : null
}

const withoutLeadingZeros = (code: string): string => code.replace(/^0+/, '')

/** UPC-A ist ein EAN-13 mit führender 0, GTIN-14 und EAN-13 unterscheiden sich ebenso nur in Nullen davor. */
export const sameBarcode = (a: string, b: string): boolean => withoutLeadingZeros(a) === withoutLeadingZeros(b)

/** Eigenes Lebensmittel mit diesem Barcode; funktioniert offline, weil die Liste aus dem Vorrat kommt. */
export function findFoodByBarcode(foods: readonly Food[], code: string): Food | null {
  return foods.find((food) => food.barcode != null && sameBarcode(food.barcode, code)) ?? null
}

/** Open Food Facts führt UPC-A mit führender 0 als EAN-13. */
export const openFoodFactsCode = (code: string): string => (code.length === 12 ? `0${code}` : code)

/**
 * Was nach einem Unique-Konflikt beim Anlegen gilt: Gibt es das Lebensmittel mit diesem Barcode schon, wird es wiederverwendet
 * (egal welcher Index zuerst angeschlagen hat, auch der für den Namen). Sonst bleibt es ein Namens-Duplikat.
 */
export function conflictOutcome(barcode: string | null, existingWithBarcode: Food | null): 'reuse' | 'duplicate' {
  return barcode !== null && existingWithBarcode !== null ? 'reuse' : 'duplicate'
}
