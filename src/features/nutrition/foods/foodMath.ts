import { normalizeName } from '../../plan/exercises'
import { parseNumber } from '../../profile/body'
import type { FoodNutrients } from './builtin'

/** Grenzen wie die Checks in foods und food_entries.grams. */
export const FOOD_DB_LIMITS = { nameMax: 80, kcal100Max: 1000, macro100Max: 100, defaultGramsMin: 1, defaultGramsMax: 2000, gramsMax: 5000 } as const

/** Ein Lebensmittel aus der Grundliste oder ein eigenes (mit Datenbank-id). */
export interface Food extends FoodNutrients {
  /** id aus der Tabelle foods, null für die Grundliste. */
  readonly id: string | null
}

export interface Nutrients {
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/** Nährwerte für eine Menge: kcal ganzzahlig, Makros auf eine Nachkommastelle. */
export function nutrientsFor(food: Pick<FoodNutrients, 'kcal100' | 'protein100' | 'carbs100' | 'fat100'>, grams: number): Nutrients {
  const factor = grams / 100
  return {
    kcal: Math.round(food.kcal100 * factor),
    proteinG: round1(food.protein100 * factor),
    carbsG: round1(food.carbs100 * factor),
    fatG: round1(food.fat100 * factor),
  }
}

/** Werte pro 100 g aus einer Menge zurückrechnen (eine Nachkommastelle). Ohne Gramm gelten die Werte schon als pro 100 g. */
export function per100From(values: Nutrients, grams: number | null): Pick<FoodNutrients, 'kcal100' | 'protein100' | 'carbs100' | 'fat100'> {
  const factor = grams === null || grams <= 0 ? 1 : 100 / grams
  return {
    kcal100: round1(values.kcal * factor),
    protein100: round1(values.proteinG * factor),
    carbs100: round1(values.carbsG * factor),
    fat100: round1(values.fatG * factor),
  }
}

/** Gramm-Eingabe mit deutschem Komma: leer = null, sonst Zahl über 0 bis 5000, undefined = ungültig. */
export function parseGrams(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const n = parseNumber(text)
  return n === null || n <= 0 || n > FOOD_DB_LIMITS.gramsMax ? undefined : round1(n)
}

/** Zahl für ein Eingabefeld mit deutschem Komma. */
export const decimalText = (n: number): string => String(n).replace('.', ',')

const key = (name: string): string => name.trim().toLowerCase()

/** Eigene Lebensmittel zuerst; sie überdecken Einträge der Grundliste mit gleichem Namen (ohne Groß/Klein). */
export function mergeFoods(own: readonly Food[], builtin: readonly FoodNutrients[]): Food[] {
  const ownNames = new Set(own.map((f) => key(f.name)))
  return [...own, ...builtin.filter((f) => !ownNames.has(key(f.name))).map((f) => ({ ...f, id: null }))]
}

/**
 * Sucht tolerant (Groß/Klein, Umlaute): alle Wörter der Suche müssen im Namen vorkommen.
 * Treffer am Namensanfang zuerst, sonst bleibt die Reihenfolge (eigene vor Grundliste).
 */
export function searchFoods(foods: readonly Food[], query: string, limit = 6): Food[] {
  const words = normalizeName(query).split(' ').filter(Boolean)
  if (words.length === 0) return []
  const first = words[0] ?? ''
  return foods
    .map((food, index) => ({ food, index, name: normalizeName(food.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((a, b) => Number(b.name.startsWith(first)) - Number(a.name.startsWith(first)) || a.index - b.index)
    .slice(0, limit)
    .map(({ food }) => food)
}

/** Eingaben für ein eigenes Lebensmittel, als Text bis zum Speichern. */
export interface FoodDefForm {
  readonly name: string
  readonly kcal100: string
  readonly protein100: string
  readonly carbs100: string
  readonly fat100: string
  readonly defaultGrams: string
}

export const EMPTY_FOOD_DEF: FoodDefForm = { name: '', kcal100: '', protein100: '', carbs100: '', fat100: '', defaultGrams: '' }

export function toFoodDefForm(food: FoodNutrients): FoodDefForm {
  return {
    name: food.name,
    kcal100: decimalText(food.kcal100),
    protein100: decimalText(food.protein100),
    carbs100: decimalText(food.carbs100),
    fat100: decimalText(food.fat100),
    defaultGrams: food.defaultGrams === null ? '' : decimalText(food.defaultGrams),
  }
}

export type ParsedFoodDef = { readonly ok: true; readonly food: FoodNutrients } | { readonly ok: false; readonly error: string }

/** Prüft Nährwerte pro 100 g wie die Tabelle foods. */
export function validateFoodDef(food: FoodNutrients): string | null {
  if (!food.name.trim()) return 'Bitte gib dem Lebensmittel einen Namen.'
  if (food.name.trim().length > FOOD_DB_LIMITS.nameMax) return `Der Name darf höchstens ${FOOD_DB_LIMITS.nameMax} Zeichen haben.`
  if (food.kcal100 < 0 || food.kcal100 > FOOD_DB_LIMITS.kcal100Max) return `Kalorien pro 100 g müssen zwischen 0 und ${FOOD_DB_LIMITS.kcal100Max} liegen.`
  const macros = [food.protein100, food.carbs100, food.fat100]
  if (macros.some((m) => m < 0 || m > FOOD_DB_LIMITS.macro100Max)) return `Eiweiß, Kohlenhydrate und Fett pro 100 g müssen zwischen 0 und ${FOOD_DB_LIMITS.macro100Max} g liegen.`
  if (food.defaultGrams !== null && (food.defaultGrams < FOOD_DB_LIMITS.defaultGramsMin || food.defaultGrams > FOOD_DB_LIMITS.defaultGramsMax)) {
    return `Die Portion muss zwischen ${FOOD_DB_LIMITS.defaultGramsMin} und ${FOOD_DB_LIMITS.defaultGramsMax} g liegen.`
  }
  return null
}

/** Liest das Formular für ein eigenes Lebensmittel; Makros leer = 0, Portion optional. */
export function parseFoodDefForm(form: FoodDefForm): ParsedFoodDef {
  const kcal = parseNumber(form.kcal100)
  const macro = (text: string) => (text.trim() === '' ? 0 : parseNumber(text))
  const protein = macro(form.protein100)
  const carbs = macro(form.carbs100)
  const fat = macro(form.fat100)
  const portion = form.defaultGrams.trim() === '' ? null : parseNumber(form.defaultGrams)
  if (kcal === null) return { ok: false, error: 'Bitte gib die Kalorien pro 100 g als Zahl ein.' }
  if (protein === null || carbs === null || fat === null) return { ok: false, error: 'Bitte gib die Makros pro 100 g als Zahl ein oder lass sie leer.' }
  if (form.defaultGrams.trim() !== '' && portion === null) return { ok: false, error: 'Bitte gib die Portion in Gramm ein oder lass das Feld leer.' }
  const food: FoodNutrients = {
    name: form.name.trim(),
    kcal100: round1(kcal),
    protein100: round1(protein),
    carbs100: round1(carbs),
    fat100: round1(fat),
    defaultGrams: portion === null ? null : round1(portion),
  }
  const error = validateFoodDef(food)
  return error ? { ok: false, error } : { ok: true, food }
}
