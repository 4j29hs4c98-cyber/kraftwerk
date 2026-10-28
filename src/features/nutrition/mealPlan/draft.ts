import { parseNumber } from '../../profile/body'
import { sortMealItems, validateMealItems, type DayKey, type MealItem, type MealSlot } from './model'

/** Bearbeitungsstand eines Plan-Eintrags: Zahlen bleiben Text, bis gespeichert wird. */
export interface DraftMeal {
  readonly uid: string
  readonly dayKey: DayKey
  readonly mealSlot: MealSlot
  readonly name: string
  readonly amount: string
  readonly kcal: string
  readonly protein: string
  readonly carbs: string
  readonly fat: string
  readonly notes: string
}

let counter = 0
const nextUid = (): string => `m${++counter}`
const text = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','))

export function draftFromItems(items: readonly MealItem[]): DraftMeal[] {
  return sortMealItems(items).map((item) => ({
    uid: nextUid(),
    dayKey: item.dayKey,
    mealSlot: item.mealSlot,
    name: item.name,
    amount: item.amount ?? '',
    kcal: text(item.kcal),
    protein: text(item.proteinG),
    carbs: text(item.carbsG),
    fat: text(item.fatG),
    notes: item.notes ?? '',
  }))
}

export function newDraftMeal(dayKey: DayKey, mealSlot: MealSlot): DraftMeal {
  return { uid: nextUid(), dayKey, mealSlot, name: '', amount: '', kcal: '', protein: '', carbs: '', fat: '', notes: '' }
}

export const updateDraftMeal = (draft: readonly DraftMeal[], uid: string, patch: Partial<Omit<DraftMeal, 'uid'>>): DraftMeal[] =>
  draft.map((m) => (m.uid === uid ? { ...m, ...patch } : m))

export const removeDraftMeal = (draft: readonly DraftMeal[], uid: string): DraftMeal[] => draft.filter((m) => m.uid !== uid)

/** Leeres Zahlenfeld = null, sonst Zahl; undefined heißt ungültige Eingabe. */
function optionalNumber(value: string): number | null | undefined {
  if (value.trim() === '') return null
  const n = parseNumber(value)
  return n === null ? undefined : n
}

export type DraftResult = { readonly ok: true; readonly items: MealItem[] } | { readonly ok: false; readonly errors: string[] }

/** Wandelt den Bearbeitungsstand in Plan-Einträge und prüft ihn vollständig. */
export function draftToItems(draft: readonly DraftMeal[]): DraftResult {
  const errors: string[] = []
  const items = draft.map((m, i): MealItem => {
    const label = `Eintrag ${i + 1}${m.name.trim() ? ` (${m.name.trim()})` : ''}`
    const numbers = { kcal: optionalNumber(m.kcal), proteinG: optionalNumber(m.protein), carbsG: optionalNumber(m.carbs), fatG: optionalNumber(m.fat) }
    if (Object.values(numbers).some((n) => n === undefined)) errors.push(`${label}: Kalorien und Makros bitte als Zahl eingeben oder leer lassen.`)
    return {
      dayKey: m.dayKey,
      mealSlot: m.mealSlot,
      name: m.name.trim(),
      amount: m.amount.trim() || null,
      kcal: numbers.kcal ?? null,
      proteinG: numbers.proteinG ?? null,
      carbsG: numbers.carbsG ?? null,
      fatG: numbers.fatG ?? null,
      notes: m.notes.trim() || null,
    }
  })
  const all = [...errors, ...(errors.length === 0 ? validateMealItems(items) : [])]
  return all.length > 0 ? { ok: false, errors: all } : { ok: true, items }
}
