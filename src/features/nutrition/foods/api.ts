import { cachedRead } from '../../../lib/offline'
import { check, supabase, unwrap, unwrapMaybe, UserFacingError } from '../../../lib/supabase'
import type { Tables } from '../../../types/database'
import type { FoodNutrients } from './builtin'
import { conflictOutcome, normalizeBarcode } from './barcode'
import { validateFoodDef, type Food, type NewFood } from './foodMath'

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
    barcode: row.barcode,
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

/** Legt ein Lebensmittel an. Gibt es den Barcode schon, kommt das vorhandene Lebensmittel zurück, statt zu scheitern. */
export async function createFood(food: NewFood): Promise<Food> {
  ensureValid(food)
  const barcode = food.barcode == null ? null : normalizeBarcode(food.barcode)
  if (food.barcode != null && barcode === null) throw new UserFacingError('Der Barcode ist ungültig. Er hat 8 bis 14 Ziffern.')
  const result = await supabase.from('foods').insert({ ...toRow(food), barcode }).select('*').single()
  if (isUniqueViolation(result.error)) {
    // Je nach Index kann der Name zuerst anschlagen; deshalb nicht am Meldungstext, sondern am Barcode entscheiden.
    const row = barcode === null ? null : unwrapMaybe(await supabase.from('foods').select('*').eq('barcode', barcode).limit(1).maybeSingle())
    if (conflictOutcome(barcode, row ? toFood(row) : null) === 'reuse' && row) return toFood(row)
    throw new UserFacingError(DUPLICATE)
  }
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
