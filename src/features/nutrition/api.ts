import { check, supabase, unwrap } from '../../lib/supabase'
import type { Tables } from '../../types/database'

export type FoodEntry = Tables<'food_entries'>

export async function fetchFoodEntries(day: string): Promise<FoodEntry[]> {
  return unwrap(await supabase.from('food_entries').select('*').eq('eaten_on', day).order('created_at'))
}

export async function addFoodEntry(entry: { eatenOn: string; name: string; kcal: number; proteinG: number }): Promise<FoodEntry> {
  return unwrap(
    await supabase
      .from('food_entries')
      .insert({ eaten_on: entry.eatenOn, name: entry.name, kcal: entry.kcal, protein_g: entry.proteinG })
      .select('*')
      .single(),
  )
}

export async function deleteFoodEntry(id: string): Promise<void> {
  check(await supabase.from('food_entries').delete().eq('id', id))
}
