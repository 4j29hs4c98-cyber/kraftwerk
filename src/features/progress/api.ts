import { rpcTrainingStats } from '../../lib/rpc'
import { check, supabase, unwrap, unwrapMaybe } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { BODY_WEIGHT_LIMIT, sortChronologically } from './weights'

export type BodyWeightRow = Tables<'body_weights'>

/** Ein Wert pro Tag: vorhandener Eintrag wird überschrieben. */
export async function upsertBodyWeight(measuredOn: string, weightKg: number): Promise<void> {
  check(await supabase.from('body_weights').upsert({ measured_on: measuredOn, weight_kg: weightKg }, { onConflict: 'user_id,measured_on' }))
}

export async function deleteBodyWeight(id: string): Promise<void> {
  check(await supabase.from('body_weights').delete().eq('id', id))
}

/** Die jüngsten Messungen (absteigend geladen), für die Kurve zeitlich aufsteigend sortiert. */
export async function fetchBodyWeights(): Promise<BodyWeightRow[]> {
  const newestFirst = unwrap(await supabase.from('body_weights').select('*').order('measured_on', { ascending: false }).limit(BODY_WEIGHT_LIMIT))
  return sortChronologically(newestFirst)
}

export async function fetchLatestBodyWeight(): Promise<number | null> {
  const row = unwrapMaybe(await supabase.from('body_weights').select('weight_kg').order('measured_on', { ascending: false }).limit(1).maybeSingle())
  return row?.weight_kg ?? null
}

export interface TrainingStats {
  readonly finishedDates: readonly Date[]
  readonly totalWorkouts: number
  readonly totalVolumeKg: number
}

/** Für Serie und Kalender reichen die jüngsten Trainings; Summen kommen vollständig aus der RPC. */
const RECENT_WORKOUTS = 500

/**
 * Anzahl und Volumen rechnet die Datenbank (training_stats), damit die
 * 1000-Zeilen-Grenze der API nicht greift. Die Zeitstempel für Serie und
 * Kalender werden lokal umgerechnet, weil die RPC nur UTC-Daten liefert.
 */
export async function fetchTrainingStats(): Promise<TrainingStats> {
  const [stats, recent] = await Promise.all([
    rpcTrainingStats(),
    supabase.from('workouts').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(RECENT_WORKOUTS),
  ])
  return {
    finishedDates: unwrap(recent).flatMap((w) => (w.finished_at ? [new Date(w.finished_at)] : [])),
    totalWorkouts: stats.workoutsCount,
    totalVolumeKg: Math.round(stats.totalVolume),
  }
}
