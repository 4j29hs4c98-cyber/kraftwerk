import type { OutboxEntry } from '../../lib/offline/ops'
import type { Tables } from '../../types/database'

type FoodEntry = Tables<'food_entries'>

/**
 * Noch nicht übertragene Essens-Einträge über die geladene Liste legen
 * (anlegen, ändern, löschen in Reihenfolge). inRange wählt die Tage aus,
 * die die Liste abdeckt. Das Original bleibt unverändert.
 */
export function applyPendingFood(rows: readonly FoodEntry[], entries: readonly OutboxEntry[], userId: string, inRange: (day: string) => boolean): FoodEntry[] {
  let result = [...rows]
  for (const { op, createdAt } of entries) {
    if (op.kind === 'food.insert') {
      const e = op.entry
      const day = e.eaten_on ?? ''
      if (!inRange(day) || result.some((r) => r.id === e.id)) continue
      result = [
        ...result,
        {
          id: e.id,
          user_id: userId,
          eaten_on: day,
          name: e.name,
          kcal: e.kcal ?? null,
          protein_g: e.protein_g ?? null,
          carbs_g: e.carbs_g ?? null,
          fat_g: e.fat_g ?? null,
          grams: e.grams ?? null,
          meal_slot: e.meal_slot ?? null,
          meal_plan_item_id: e.meal_plan_item_id ?? null,
          status: e.status ?? 'frei',
          created_at: e.created_at ?? createdAt,
        },
      ]
    } else if (op.kind === 'food.update') {
      result = result.map((r) => (r.id === op.id ? { ...r, name: op.name, kcal: op.kcal, protein_g: op.proteinG, carbs_g: op.carbsG, fat_g: op.fatG } : r))
    } else if (op.kind === 'food.delete') {
      result = result.filter((r) => r.id !== op.id)
    }
  }
  return result.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
}
