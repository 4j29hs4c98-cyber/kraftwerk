import type { Json } from '../types/database'
import type { CreateMealItemArg } from '../features/nutrition/mealPlan/model'
import { supabase, unwrap } from './supabase'

/** Form von p_days für create_plan (in den generierten Typen nur als Json geführt). */
export interface CreatePlanExerciseArg {
  readonly exercise_key: string
  readonly position: number
  readonly sets: number
  readonly rep_min: number
  readonly rep_max: number
  readonly rest_seconds: number
  readonly display_name: string | null
  readonly notes: string | null
  readonly start_weight_kg: number | null
}

export interface CreatePlanDayArg {
  readonly day_index: number
  readonly title: string
  readonly exercises: readonly CreatePlanExerciseArg[]
}

export interface CreatePlanArgs {
  readonly p_name: string
  readonly p_split: string
  readonly p_days: readonly CreatePlanDayArg[]
}

export interface TrainingStatsResult {
  readonly workoutsCount: number
  readonly totalVolume: number
}

/** Plain-Objekte aus Zahlen, Text und null sind gültiges JSON; die Umwandlung prüft das zur Laufzeit nicht nach. */
const toJson = (value: readonly CreatePlanDayArg[]): Json => value as unknown as Json

export async function rpcCreatePlan(args: CreatePlanArgs): Promise<string> {
  return unwrap(await supabase.rpc('create_plan', { p_name: args.p_name, p_split: args.p_split, p_days: toJson(args.p_days) }))
}

function numberField(value: Json, key: string): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const field = value[key]
    if (typeof field === 'number' && Number.isFinite(field)) return field
    if (typeof field === 'string' && field.trim() !== '' && Number.isFinite(Number(field))) return Number(field)
  }
  throw new Error(`training_stats: Feld ${key} fehlt`)
}

/** Kennzahlen aus der RPC. finished_dates (UTC-Datum) wird bewusst nicht genutzt. */
export async function rpcTrainingStats(): Promise<TrainingStatsResult> {
  const data = unwrap(await supabase.rpc('training_stats'))
  return { workoutsCount: numberField(data, 'workouts_count'), totalVolume: numberField(data, 'total_volume') }
}

const mealItemsToJson = (value: readonly CreateMealItemArg[]): Json => value as unknown as Json

/** Legt einen neuen aktiven Ernährungsplan an (alter Plan aus, neuer an, in einer Transaktion). */
export async function rpcCreateMealPlan(name: string, items: readonly CreateMealItemArg[]): Promise<string> {
  return unwrap(await supabase.rpc('create_meal_plan', { p_name: name, p_items: mealItemsToJson(items) }))
}

/** Rohdaten aus exercise_progress; geprüft wird in parseExerciseProgress. */
export async function rpcExerciseProgress(exerciseKey: string): Promise<Json> {
  const { data, error } = await supabase.rpc('exercise_progress', { p_exercise_key: exerciseKey })
  if (error) throw error
  return data ?? []
}
