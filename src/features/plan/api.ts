import { rpcCreatePlan } from '../../lib/rpc'
import { supabase, unwrap, unwrapMaybe, UserFacingError } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { nextDayIndex } from './generator'
import { toCreatePlanArgs, validatePlan, type NewPlan } from './planModel'
import { hasWeekdays, planForWeekday, weekdayOf, type TodayPlan } from './weekdays'

export type PlanRow = Tables<'plans'>
export type PlanExerciseRow = Tables<'plan_exercises'>
export interface PlanDay extends Tables<'plan_days'> {
  readonly exercises: readonly PlanExerciseRow[]
}
export interface PlanDetail {
  readonly plan: PlanRow
  readonly days: readonly PlanDay[]
}

/**
 * Legt über die RPC create_plan einen neuen aktiven Plan an. Die Funktion läuft
 * in einer Transaktion: alter Plan aus, neuer Plan mit Tagen und Übungen an.
 * Schlägt etwas fehl, bleibt der bisherige Plan unverändert aktiv.
 */
export async function savePlan(plan: NewPlan): Promise<string> {
  const errors = validatePlan(plan)
  if (errors.length > 0) throw new UserFacingError(errors.join(' '))
  return rpcCreatePlan(toCreatePlanArgs(plan))
}

export async function fetchActivePlan(): Promise<PlanDetail | null> {
  const plan = unwrapMaybe(await supabase.from('plans').select('*').eq('is_active', true).maybeSingle())
  if (!plan) return null
  const days = unwrap(await supabase.from('plan_days').select('*').eq('plan_id', plan.id).order('day_index'))
  const dayIds = days.map((d) => d.id)
  const exercises =
    dayIds.length === 0
      ? []
      : unwrap(await supabase.from('plan_exercises').select('*').in('plan_day_id', dayIds).order('position'))
  return {
    plan,
    days: days.map((day) => ({ ...day, exercises: exercises.filter((e) => e.plan_day_id === day.id) })),
  }
}

/**
 * Nächster fälliger Tag in einem Plan ohne Wochentage, rotierend nach dem letzten
 * abgeschlossenen Workout dieses Plans. Ruhetage werden übersprungen.
 */
export async function fetchNextDay(detail: PlanDetail): Promise<PlanDay | null> {
  const training = detail.days.filter((d) => !d.is_rest)
  if (training.length === 0) return null
  const last = unwrapMaybe(
    await supabase
      .from('workouts')
      .select('plan_day_id')
      .in('plan_day_id', training.map((d) => d.id))
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
  const lastIndex = training.findIndex((d) => d.id === last?.plan_day_id)
  return training[nextDayIndex(training.length, lastIndex >= 0 ? lastIndex : null)] ?? null
}

/**
 * Was heute ansteht. Plan mit Wochentagen: der Tag des heutigen Wochentags (lokal),
 * Ruhetag oder fehlender Eintrag als Ruhetag mit dem nächsten Trainingstag.
 * Plan ohne Wochentage: die bisherige Rotation.
 */
export async function fetchTodayPlan(detail: PlanDetail, today: Date): Promise<TodayPlan<PlanDay> | null> {
  if (hasWeekdays(detail.days)) return planForWeekday(detail.days, weekdayOf(today))
  const next = await fetchNextDay(detail)
  return next ? { kind: 'training', day: next } : null
}
