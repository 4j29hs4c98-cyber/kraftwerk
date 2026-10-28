import { cachedRead, currentUserId, pendingEntries, submit } from '../../lib/offline'
import { rpcTrainingStats } from '../../lib/rpc'
import { check, supabase, unwrap, unwrapMaybe } from '../../lib/supabase'
import type { Tables } from '../../types/database'
import { applyPendingWeights } from './pending'
import { BODY_WEIGHT_LIMIT, sortChronologically } from './weights'

export type BodyWeightRow = Tables<'body_weights'>

/**
 * Ein Wert pro Tag: vorhandener Eintrag wird überschrieben. Ohne Körperfett-Angabe bleibt
 * ein schon gespeicherter Körperfettwert des Tages erhalten (Feld wird nicht mitgeschickt).
 * Läuft über die Offline-Warteschlange (upsert auf Nutzer und Tag, daher wiederholbar).
 */
export async function upsertBodyWeight(measuredOn: string, weightKg: number, bodyFatPct: number | null = null): Promise<void> {
  await submit({ kind: 'weight.upsert', measuredOn, weightKg, bodyFatPct })
}

async function withPendingWeights(rows: readonly BodyWeightRow[]): Promise<BodyWeightRow[]> {
  const userId = currentUserId()
  return userId ? applyPendingWeights(rows, await pendingEntries(), userId) : [...rows]
}

export async function deleteBodyWeight(id: string): Promise<void> {
  check(await supabase.from('body_weights').delete().eq('id', id))
}

/** Die jüngsten Messungen (absteigend geladen), für die Kurve zeitlich aufsteigend sortiert. */
export async function fetchBodyWeights(): Promise<BodyWeightRow[]> {
  const newestFirst = await cachedRead('weights:recent', async () =>
    unwrap(await supabase.from('body_weights').select('*').order('measured_on', { ascending: false }).limit(BODY_WEIGHT_LIMIT)),
    { empty: [] },
  )
  return sortChronologically(await withPendingWeights(newestFirst))
}

export async function fetchLatestBodyWeight(): Promise<number | null> {
  const row = await cachedRead('weights:latest', async () =>
    unwrapMaybe(await supabase.from('body_weights').select('*').order('measured_on', { ascending: false }).limit(1).maybeSingle()),
    { empty: null },
  )
  const merged = sortChronologically(await withPendingWeights(row ? [row] : []))
  return merged.at(-1)?.weight_kg ?? null
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
export function fetchTrainingStats(): Promise<TrainingStats> {
  return cachedRead('stats:training', fetchTrainingStatsFromServer)
}

async function fetchTrainingStatsFromServer(): Promise<TrainingStats> {
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

/** Wie viele Satz-Zeilen für die Übungsauswahl höchstens gelesen werden (jüngste zuerst). */
const LOGGED_SETS_SCAN = 5000

/** Schlüssel aller Übungen, die schon mindestens einmal geloggt wurden. */
export function fetchLoggedExerciseKeys(): Promise<string[]> {
  return cachedRead(
    'workouts:exerciseKeys',
    async () => {
      const rows = unwrap(await supabase.from('workout_sets').select('exercise_key').order('created_at', { ascending: false }).limit(LOGGED_SETS_SCAN))
      return [...new Set(rows.map((r) => r.exercise_key))]
    },
    { empty: [] },
  )
}
