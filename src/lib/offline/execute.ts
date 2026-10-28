import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from '../../types/database'
import type { WriteResult } from './errors'
import type { FoodInsertPayload, OutboxOp } from './ops'
import type { Executor } from './outbox'

type Client = Pick<SupabaseClient<Database>, 'from'>

/**
 * Nur die erlaubten Spalten senden. Vor allem user_id kommt nie aus dem Client:
 * Die Datenbank setzt sie per Standardwert aus der Anmeldung.
 */
function foodRow(e: FoodInsertPayload): TablesInsert<'food_entries'> {
  return {
    id: e.id,
    created_at: e.created_at,
    eaten_on: e.eaten_on,
    name: e.name,
    kcal: e.kcal,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    meal_slot: e.meal_slot,
    meal_plan_item_id: e.meal_plan_item_id,
    status: e.status,
    grams: e.grams,
  }
}

const toResult = ({ status, error }: { status: number; error: unknown }): WriteResult => ({ status, error })

/**
 * Übersetzt Einträge der Warteschlange in Supabase-Aufrufe. Alle sind
 * wiederholbar: Anlegen per upsert (Workouts und Essen auf ihre im Client
 * erzeugte id mit ignoreDuplicates, Sätze auf workout/Übung/Satznummer, Gewicht
 * auf Nutzer/Tag), Ändern und Löschen über feste Schlüssel.
 */
export function createExecutor(client: Client): Executor {
  return async (op: OutboxOp) => {
    switch (op.kind) {
      case 'workout.start':
        return toResult(
          await client
            .from('workouts')
            .upsert({ id: op.id, plan_day_id: op.planDayId, started_at: op.startedAt }, { onConflict: 'id', ignoreDuplicates: true }),
        )
      case 'workout.finish':
        return toResult(await client.from('workouts').update({ finished_at: op.finishedAt }).eq('id', op.id))
      case 'workout.delete':
        return toResult(await client.from('workouts').delete().eq('id', op.id))
      case 'set.upsert':
        return toResult(
          await client
            .from('workout_sets')
            .upsert(
              { workout_id: op.workoutId, exercise_key: op.exerciseKey, set_index: op.setIndex, weight_kg: op.weightKg, reps: op.reps },
              { onConflict: 'workout_id,exercise_key,set_index' },
            ),
        )
      case 'set.delete':
        return toResult(
          await client.from('workout_sets').delete().eq('workout_id', op.workoutId).eq('exercise_key', op.exerciseKey).eq('set_index', op.setIndex),
        )
      case 'food.insert':
        return toResult(await client.from('food_entries').upsert(foodRow(op.entry), { onConflict: 'id', ignoreDuplicates: true }))
      case 'food.update':
        return toResult(
          await client
            .from('food_entries')
            .update({ name: op.name, kcal: op.kcal, protein_g: op.proteinG, carbs_g: op.carbsG, fat_g: op.fatG })
            .eq('id', op.id),
        )
      case 'food.delete':
        return toResult(await client.from('food_entries').delete().eq('id', op.id))
      case 'weight.upsert':
        return toResult(
          await client
            .from('body_weights')
            .upsert(
              { measured_on: op.measuredOn, weight_kg: op.weightKg, ...(op.bodyFatPct === null ? {} : { body_fat_pct: op.bodyFatPct }) },
              { onConflict: 'user_id,measured_on' },
            ),
        )
    }
  }
}
