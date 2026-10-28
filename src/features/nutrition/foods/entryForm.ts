import type { FoodValues } from '../api'
import { parseFoodForm, type FoodFormValues } from '../foodInput'
import type { FoodNutrients } from './builtin'
import { decimalText, FOOD_DB_LIMITS, nutrientsFor, parseGrams, per100From, validateFoodDef } from './foodMath'

/** Freier Eintrag: Name, Menge in Gramm und Nährwerte als Text bis zum Speichern. */
export interface EntryFormValues extends FoodFormValues {
  readonly grams: string
}

export const EMPTY_ENTRY_FORM: EntryFormValues = { name: '', grams: '', kcal: '', protein: '', carbs: '', fat: '' }

/** Rechnet die Nährwerte für die eingegebene Menge neu; bei ungültiger Menge bleiben die Felder unverändert. */
export function withGrams(form: EntryFormValues, food: FoodNutrients | null, gramsText: string): EntryFormValues {
  const grams = parseGrams(gramsText)
  if (!food || grams === null || grams === undefined) return { ...form, grams: gramsText }
  const n = nutrientsFor(food, grams)
  return { ...form, grams: gramsText, kcal: String(n.kcal), protein: decimalText(n.proteinG), carbs: decimalText(n.carbsG), fat: decimalText(n.fatG) }
}

/** Formular nach Auswahl eines Lebensmittels: Name, typische Portion und berechnete Werte. */
export function formForFood(food: FoodNutrients): EntryFormValues {
  return withGrams({ ...EMPTY_ENTRY_FORM, name: food.name }, food, food.defaultGrams === null ? '100' : decimalText(food.defaultGrams))
}

export type ParsedEntry = { readonly ok: true; readonly values: FoodValues; readonly grams: number | null } | { readonly ok: false; readonly error: string }

/** Prüft den freien Eintrag: wie bisher Name und kcal Pflicht, Gramm optional (über 0 bis 5000). */
export function parseEntryForm(form: EntryFormValues): ParsedEntry {
  const grams = parseGrams(form.grams)
  if (grams === undefined) return { ok: false, error: `Bitte gib die Menge in Gramm ein (bis ${FOOD_DB_LIMITS.gramsMax}) oder lass das Feld leer.` }
  const parsed = parseFoodForm(form)
  return parsed.ok ? { ok: true, values: parsed.values, grams } : parsed
}

export type OwnFoodResult = { readonly ok: true; readonly food: FoodNutrients } | { readonly ok: false; readonly error: string }

/**
 * Macht aus einem manuellen Eintrag ein eigenes Lebensmittel: Mit Gramm werden die Werte auf 100 g
 * zurückgerechnet und die Menge wird zur Portion, ohne Gramm gelten die Werte als pro 100 g.
 */
export function ownFoodFromEntry(values: FoodValues, grams: number | null): OwnFoodResult {
  const per100 = per100From({ kcal: values.kcal, proteinG: values.proteinG, carbsG: values.carbsG ?? 0, fatG: values.fatG ?? 0 }, grams)
  const portionOk = grams !== null && grams >= FOOD_DB_LIMITS.defaultGramsMin && grams <= FOOD_DB_LIMITS.defaultGramsMax
  const food: FoodNutrients = { name: values.name.trim().slice(0, FOOD_DB_LIMITS.nameMax), ...per100, defaultGrams: portionOk ? grams : null }
  const error = validateFoodDef(food)
  return error ? { ok: false, error: `Als Lebensmittel nicht speicherbar: ${error}` } : { ok: true, food }
}
