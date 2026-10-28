import { cachedRead } from '../../../lib/offline'
import { check, supabase, unwrap, UserFacingError } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'
import type { FoodNutrients } from './builtin'
import { validateFoodDef, type Food } from './foodMath'

const UNIQUE_VIOLATION = '23505'
const MAX_FOODS = 500

const isUniqueViolation = (error: unknown): boolean => Boolean(error && typeof error === 'object' && 'code' in error && error.code === UNIQUE_VIOLATION)

function toFood(row: Tables<'foods'>): Food {
  return {
    id: row.id,
    name: row.name,
    kcal100: Number(row.kcal_100),
    protein100: Number(row.protein_100),
    carbs100: Number(row.carbs_100),
    fat100: Number(row.fat_100),
    defaultGrams: row.default_grams === null ? null : Number(row.default_grams),
  }
}

const toRow = (food: FoodNutrients) => ({
  name: food.name.trim(),
  kcal_100: food.kcal100,
  protein_100: food.protein100,
  carbs_100: food.carbs100,
  fat_100: food.fat100,
  default_grams: food.defaultGrams,
})

function ensureValid(food: FoodNutrients): void {
  const error = validateFoodDef(food)
  if (error) throw new UserFacingError(error)
}

const DUPLICATE = 'Ein eigenes Lebensmittel mit diesem Namen gibt es schon.'

export function fetchFoods(): Promise<Food[]> {
  return cachedRead('foods:own', async () => unwrap(await supabase.from('foods').select('*').order('name').limit(MAX_FOODS)).map(toFood), { empty: [] })
}

export async function createFood(food: FoodNutrients): Promise<Food> {
  ensureValid(food)
  const result = await supabase.from('foods').insert(toRow(food)).select('*').single()
  if (isUniqueViolation(result.error)) throw new UserFacingError(DUPLICATE)
  return toFood(unwrap(result))
}

export async function updateFood(id: string, food: FoodNutrients): Promise<void> {
  ensureValid(food)
  const result = await supabase.from('foods').update(toRow(food)).eq('id', id)
  if (isUniqueViolation(result.error)) throw new UserFacingError(DUPLICATE)
  check(result)
}

export async function deleteFood(id: string): Promise<void> {
  check(await supabase.from('foods').delete().eq('id', id))
}
