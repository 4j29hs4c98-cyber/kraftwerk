import type { FoodEntry } from './api'

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** "520 kcal · 45 g E · 62 g KH · 8 g F"; fehlende Werte fallen weg. */
export function macroLine(v: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }): string {
  const parts = [
    v.kcal === null ? null : `${v.kcal} kcal`,
    v.proteinG === null ? null : `${NUMBER.format(v.proteinG)} g E`,
    v.carbsG === null ? null : `${NUMBER.format(v.carbsG)} g KH`,
    v.fatG === null ? null : `${NUMBER.format(v.fatG)} g F`,
  ]
  return parts.filter(Boolean).join(' · ')
}

export const entryMacros = (e: FoodEntry) => ({ kcal: e.kcal, proteinG: e.protein_g, carbsG: e.carbs_g, fatG: e.fat_g })
