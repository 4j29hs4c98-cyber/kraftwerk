import { toISODate } from '../../lib/date'
import { rpcCreateMealPlan } from '../../lib/rpc'
import { check, supabase, unwrap, unwrapMaybe, UserFacingError } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { isDayKey, isMealSlot, MEAL_LIMITS, toCreateMealItems, validateMealItems, type MealItem, type MealSlot } from './mealPlan/model'

export type FoodEntry = Tables<'food_entries'>
export type MealPlanRow = Tables<'meal_plans'>

export type FoodStatus = 'wie_geplant' | 'ersetzt' | 'frei'

/** Ein Plan-Eintrag aus der Datenbank, mit geprüftem Tag und geprüfter Mahlzeit. */
export interface PlannedMeal extends MealItem {
  readonly id: string
}

export interface ActiveMealPlan {
  readonly plan: MealPlanRow
  readonly items: readonly PlannedMeal[]
}

/** Werte eines Essens-Eintrags (frei, ersetzt oder aus dem Plan übernommen). */
export interface FoodValues {
  readonly name: string
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number | null
  readonly fatG: number | null
}

export interface NewFoodEntry extends FoodValues {
  readonly eatenOn: string
  readonly status: FoodStatus
  readonly mealSlot: MealSlot | null
  readonly mealPlanItemId: string | null
  /** Menge in Gramm, wenn der Eintrag aus einem Lebensmittel berechnet wurde. */
  readonly grams?: number | null
}

const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === UNIQUE_VIOLATION)
}

export async function fetchFoodEntries(day: string): Promise<FoodEntry[]> {
  return unwrap(await supabase.from('food_entries').select('*').eq('eaten_on', day).order('created_at'))
}

export async function addFoodEntry(entry: NewFoodEntry): Promise<FoodEntry> {
  const result = await supabase
    .from('food_entries')
    .insert({
      eaten_on: entry.eatenOn,
      name: entry.name,
      kcal: entry.kcal,
      protein_g: entry.proteinG,
      carbs_g: entry.carbsG,
      fat_g: entry.fatG,
      meal_slot: entry.mealSlot,
      meal_plan_item_id: entry.mealPlanItemId,
      status: entry.status,
      grams: entry.grams ?? null,
    })
    .select('*')
    .single()
  if (isUniqueViolation(result.error)) throw new UserFacingError('Für diese Mahlzeit gibt es an diesem Tag schon einen Eintrag.')
  return unwrap(result)
}

export async function updateFoodEntry(id: string, values: FoodValues): Promise<void> {
  check(
    await supabase
      .from('food_entries')
      .update({ name: values.name, kcal: values.kcal, protein_g: values.proteinG, carbs_g: values.carbsG, fat_g: values.fatG })
      .eq('id', id),
  )
}

export async function deleteFoodEntry(id: string): Promise<void> {
  check(await supabase.from('food_entries').delete().eq('id', id))
}

function toPlannedMeal(row: Tables<'meal_plan_items'>): PlannedMeal[] {
  if (!isDayKey(row.day_key) || !isMealSlot(row.meal_slot)) return []
  return [
    {
      id: row.id,
      dayKey: row.day_key,
      mealSlot: row.meal_slot,
      name: row.name,
      amount: row.amount,
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      notes: row.notes,
      variant: row.variant,
    },
  ]
}

export async function fetchActiveMealPlan(): Promise<ActiveMealPlan | null> {
  const plan = unwrapMaybe(await supabase.from('meal_plans').select('*').eq('is_active', true).maybeSingle())
  if (!plan) return null
  const rows = unwrap(await supabase.from('meal_plan_items').select('*').eq('meal_plan_id', plan.id).order('position').limit(MEAL_LIMITS.maxItems))
  return { plan, items: rows.flatMap(toPlannedMeal) }
}

/**
 * Speichert über create_meal_plan einen neuen aktiven Plan mit der kompletten Liste.
 * Schlägt etwas fehl, bleibt der bisherige Plan aktiv.
 */
export async function saveMealPlan(name: string, items: readonly MealItem[]): Promise<string> {
  const trimmed = name.trim().slice(0, MEAL_LIMITS.planNameMax)
  const errors = [...(trimmed ? [] : ['Bitte gib dem Ernährungsplan einen Namen.']), ...validateMealItems(items)]
  if (errors.length > 0) throw new UserFacingError(errors.join(' '))
  return rpcCreateMealPlan(trimmed, toCreateMealItems(items))
}

export type PlanEntry = Pick<FoodEntry, 'eaten_on' | 'meal_plan_item_id' | 'status'>

/** Plan-bezogene Einträge eines Zeitraums (für die Wochen-Kennzahl). */
export async function fetchPlanEntries(from: string, to: string): Promise<PlanEntry[]> {
  return unwrap(
    await supabase.from('food_entries').select('eaten_on, meal_plan_item_id, status').gte('eaten_on', from).lte('eaten_on', to).not('meal_plan_item_id', 'is', null),
  )
}

/**
 * Lokale Tage (YYYY-MM-DD), an denen ein Workout begonnen wurde, abgeschlossen oder offen.
 * Abgefragt wird in lokalen Tagesgrenzen, damit späte Trainings nicht auf den Folgetag rutschen.
 */
export async function fetchTrainingDays(from: Date, toExclusive: Date): Promise<ReadonlySet<string>> {
  const rows = unwrap(
    await supabase.from('workouts').select('started_at').gte('started_at', from.toISOString()).lt('started_at', toExclusive.toISOString()).limit(200),
  )
  return new Set(rows.map((w) => toISODate(new Date(w.started_at))))
}
