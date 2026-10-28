import { toISODate } from '../../lib/date'
import { cachedRead, currentUserId, pendingEntries, submit } from '../../lib/offline'
import type { FoodInsertPayload } from '../../lib/offline/ops'
import { rpcCreateMealPlan } from '../../lib/rpc'
import { supabase, unwrap, unwrapMaybe, UserFacingError } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { pendingTrainingStarts } from '../workout/pending'
import { applyPendingFood } from './pending'
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

/** Serverstand (offline aus dem Vorrat) plus noch nicht übertragene Einträge der Warteschlange. */
async function withPendingFood(rows: readonly FoodEntry[], inRange: (day: string) => boolean): Promise<FoodEntry[]> {
  const userId = currentUserId()
  return userId ? applyPendingFood(rows, await pendingEntries(), userId, inRange) : [...rows]
}

export async function fetchFoodEntries(day: string): Promise<FoodEntry[]> {
  const rows = await cachedRead(`food:${day}`, async () => unwrap(await supabase.from('food_entries').select('*').eq('eaten_on', day).order('created_at')), {
    empty: [],
  })
  return withPendingFood(rows, (d) => d === day)
}

/*
 * Schreibzugriffe auf Essens-Einträge laufen über die Offline-Warteschlange.
 * Neue Einträge bekommen ihre id im Client, damit erneutes Senden keine Kopie anlegt.
 */

export async function addFoodEntry(entry: NewFoodEntry): Promise<void> {
  const payload: FoodInsertPayload = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
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
  }
  if (entry.mealPlanItemId !== null) {
    // Die Datenbank erlaubt pro Plan-Mahlzeit und Tag nur einen Eintrag; lokal vorab prüfen, damit der Fehler sofort sichtbar ist.
    const existing = await fetchFoodEntries(entry.eatenOn)
    if (existing.some((e) => e.meal_plan_item_id === entry.mealPlanItemId)) throw new UserFacingError('Für diese Mahlzeit gibt es an diesem Tag schon einen Eintrag.')
  }
  await submit({ kind: 'food.insert', entry: payload })
}

export async function updateFoodEntry(id: string, values: FoodValues): Promise<void> {
  await submit({ kind: 'food.update', id, name: values.name, kcal: values.kcal, proteinG: values.proteinG, carbsG: values.carbsG, fatG: values.fatG })
}

export async function deleteFoodEntry(id: string): Promise<void> {
  await submit({ kind: 'food.delete', id })
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

export function fetchActiveMealPlan(): Promise<ActiveMealPlan | null> {
  return cachedRead('mealPlan:active', fetchActiveMealPlanFromServer)
}

async function fetchActiveMealPlanFromServer(): Promise<ActiveMealPlan | null> {
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
  const rows = await cachedRead(`food:plan:${from}:${to}`, async () =>
    unwrap(await supabase.from('food_entries').select('*').gte('eaten_on', from).lte('eaten_on', to).not('meal_plan_item_id', 'is', null)),
    { empty: [] },
  )
  const merged = await withPendingFood(rows, (d) => d >= from && d <= to)
  return merged.flatMap((e) => (e.meal_plan_item_id === null ? [] : [{ eaten_on: e.eaten_on, meal_plan_item_id: e.meal_plan_item_id, status: e.status }]))
}

/**
 * Lokale Tage (YYYY-MM-DD), an denen ein Workout begonnen wurde, abgeschlossen oder offen.
 * Abgefragt wird in lokalen Tagesgrenzen, damit späte Trainings nicht auf den Folgetag rutschen.
 */
export async function fetchTrainingDays(from: Date, toExclusive: Date): Promise<ReadonlySet<string>> {
  const [start, end] = [from.toISOString(), toExclusive.toISOString()]
  const rows = await cachedRead(
    `workouts:days:${start}|${end}`,
    async () => unwrap(await supabase.from('workouts').select('started_at').gte('started_at', start).lt('started_at', end).limit(200)),
    { empty: [] },
  )
  // Offline begonnene Trainings zählen schon, bevor sie übertragen sind.
  const local = pendingTrainingStarts(await pendingEntries()).filter((t) => t >= start && t < end)
  return new Set([...rows.map((w) => w.started_at), ...local].map((t) => toISODate(new Date(t))))
}
