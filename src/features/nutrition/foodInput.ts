import { parseNumber } from '../profile/body'
import type { FoodValues } from './api'

/** Eingabefelder eines Essens-Eintrags, als Text bis zum Speichern. */
export interface FoodFormValues {
  readonly name: string
  readonly kcal: string
  readonly protein: string
  readonly carbs: string
  readonly fat: string
}

export const EMPTY_FOOD_FORM: FoodFormValues = { name: '', kcal: '', protein: '', carbs: '', fat: '' }

/** Grenzen wie die Checks in food_entries. */
export const FOOD_LIMITS = { nameMax: 120, kcalMax: 10000, macroMax: 1000 } as const

const round1 = (n: number): number => Math.round(n * 10) / 10
const decimal = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','))

export function toFoodForm(values: { name: string; kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }): FoodFormValues {
  return { name: values.name, kcal: decimal(values.kcal), protein: decimal(values.proteinG), carbs: decimal(values.carbsG), fat: decimal(values.fatG) }
}

/** Optionales Makro-Feld: leer = null, sonst Zahl im erlaubten Bereich, undefined = ungültig. */
function optionalMacro(text: string): number | null | undefined {
  if (text.trim() === '') return null
  const n = parseNumber(text)
  return n === null || n > FOOD_LIMITS.macroMax ? undefined : round1(n)
}

export type ParsedFood = { readonly ok: true; readonly values: FoodValues } | { readonly ok: false; readonly error: string }

/** Prüft die Eingaben: Name und Kalorien sind Pflicht, Eiweiß leer = 0, Kohlenhydrate und Fett optional. */
export function parseFoodForm(form: FoodFormValues): ParsedFood {
  const name = form.name.trim()
  const kcal = parseNumber(form.kcal)
  const protein = parseNumber(form.protein.trim() === '' ? '0' : form.protein)
  const carbs = optionalMacro(form.carbs)
  const fat = optionalMacro(form.fat)
  if (!name) return { ok: false, error: 'Bitte gib an, was du gegessen hast.' }
  if (kcal === null || kcal > FOOD_LIMITS.kcalMax) return { ok: false, error: 'Bitte gib die Kalorien als Zahl ein.' }
  if (protein === null || protein > FOOD_LIMITS.macroMax) return { ok: false, error: 'Bitte gib das Eiweiß in Gramm ein.' }
  if (carbs === undefined) return { ok: false, error: 'Bitte gib die Kohlenhydrate in Gramm ein oder lass das Feld leer.' }
  if (fat === undefined) return { ok: false, error: 'Bitte gib das Fett in Gramm ein oder lass das Feld leer.' }
  return { ok: true, values: { name: name.slice(0, FOOD_LIMITS.nameMax), kcal: Math.round(kcal), proteinG: round1(protein), carbsG: carbs, fatG: fat } }
}

export interface MacroTotals {
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

/** Tagessummen; fehlende Werte zählen als 0. */
export function sumFood(entries: readonly { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }[]): MacroTotals {
  const totals = entries.reduce(
    (sum, e) => ({ kcal: sum.kcal + (e.kcal ?? 0), proteinG: sum.proteinG + (e.protein_g ?? 0), carbsG: sum.carbsG + (e.carbs_g ?? 0), fatG: sum.fatG + (e.fat_g ?? 0) }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
  return { kcal: totals.kcal, proteinG: round1(totals.proteinG), carbsG: round1(totals.carbsG), fatG: round1(totals.fatG) }
}
