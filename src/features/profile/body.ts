export const MIN_BIRTH_YEAR = 1920
export const MIN_AGE = 12
export const HEIGHT_RANGE = { min: 120, max: 230 } as const
export const WEIGHT_RANGE = { min: 30, max: 300 } as const

const NUMBER_PATTERN = /^\d+(?:[.,]\d+)?$/

/**
 * Liest eine nicht negative Zahl aus einem Eingabefeld, auch mit deutschem Komma.
 * Erlaubt sind nur Ziffern mit höchstens einem Komma oder Punkt, also kein "1e3",
 * kein "0x10" und keine Tausenderpunkte.
 */
export function parseNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!NUMBER_PATTERN.test(trimmed)) return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export interface BodyInput {
  readonly birthYear: string
  readonly heightCm: string
  readonly weightKg: string
}

export function validateBody(input: BodyInput, today: Date): string | null {
  const year = parseNumber(input.birthYear)
  const maxYear = today.getFullYear() - MIN_AGE
  if (year === null || !Number.isInteger(year) || year < MIN_BIRTH_YEAR || year > maxYear) {
    return `Bitte gib ein Geburtsjahr zwischen ${MIN_BIRTH_YEAR} und ${maxYear} ein.`
  }
  const height = parseNumber(input.heightCm)
  if (height === null || height < HEIGHT_RANGE.min || height > HEIGHT_RANGE.max) {
    return `Bitte gib deine Größe in Zentimetern ein (${HEIGHT_RANGE.min} bis ${HEIGHT_RANGE.max}).`
  }
  const weight = parseNumber(input.weightKg)
  if (weight === null || weight < WEIGHT_RANGE.min || weight > WEIGHT_RANGE.max) {
    return `Bitte gib dein Gewicht in Kilogramm ein (${WEIGHT_RANGE.min} bis ${WEIGHT_RANGE.max}).`
  }
  return null
}
