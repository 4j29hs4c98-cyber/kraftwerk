import type { OutboxEntry } from '../../lib/offline/ops'
import type { Tables } from '../../types/database'

type BodyWeightRow = Tables<'body_weights'>

/**
 * Noch nicht übertragene Gewichtsmessungen über die geladenen legen: ein Wert
 * pro Tag, ohne Körperfett-Angabe bleibt ein vorhandener Wert des Tages stehen
 * (wie beim upsert auf dem Server). Reihenfolge der Eingabe bleibt erhalten,
 * neue Tage kommen ans Ende.
 */
export function applyPendingWeights(rows: readonly BodyWeightRow[], entries: readonly OutboxEntry[], userId: string): BodyWeightRow[] {
  let result = [...rows]
  for (const { op, createdAt } of entries) {
    if (op.kind !== 'weight.upsert') continue
    const existing = result.find((r) => r.measured_on === op.measuredOn)
    const row: BodyWeightRow = {
      id: existing?.id ?? `lokal:${op.measuredOn}`,
      user_id: userId,
      measured_on: op.measuredOn,
      weight_kg: op.weightKg,
      body_fat_pct: op.bodyFatPct ?? existing?.body_fat_pct ?? null,
      created_at: existing?.created_at ?? createdAt,
    }
    result = existing ? result.map((r) => (r === existing ? row : r)) : [...result, row]
  }
  return result
}
