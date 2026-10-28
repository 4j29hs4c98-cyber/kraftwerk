import type { TablesInsert } from '../../types/database'

/** Neuer Essens-Eintrag mit im Client erzeugter id, damit ein erneutes Senden keine Kopie anlegt. */
export type FoodInsertPayload = TablesInsert<'food_entries'> & { readonly id: string }

/**
 * Ein Schreibzugriff in der Warteschlange. Jede Art ist so gebaut, dass doppeltes
 * Senden (etwa wenn die Antwort verloren ging) dasselbe Ergebnis hat wie einfaches:
 * Anlegen per upsert auf id oder auf den fachlichen Schlüssel, Ändern und Löschen
 * über feste Schlüssel.
 */
export type OutboxOp =
  | { readonly kind: 'workout.start'; readonly id: string; readonly planDayId: string | null; readonly startedAt: string }
  | { readonly kind: 'workout.finish'; readonly id: string; readonly finishedAt: string }
  | { readonly kind: 'workout.delete'; readonly id: string }
  | {
      readonly kind: 'set.upsert'
      readonly workoutId: string
      readonly exerciseKey: string
      readonly setIndex: number
      readonly weightKg: number
      readonly reps: number
    }
  | { readonly kind: 'set.delete'; readonly workoutId: string; readonly exerciseKey: string; readonly setIndex: number }
  | { readonly kind: 'food.insert'; readonly entry: FoodInsertPayload }
  | {
      readonly kind: 'food.update'
      readonly id: string
      readonly name: string
      readonly kcal: number
      readonly proteinG: number
      readonly carbsG: number | null
      readonly fatG: number | null
    }
  | { readonly kind: 'food.delete'; readonly id: string }
  /** bodyFatPct null: ein schon gespeicherter Körperfettwert des Tages bleibt erhalten. */
  | { readonly kind: 'weight.upsert'; readonly measuredOn: string; readonly weightKg: number; readonly bodyFatPct: number | null }

export interface OutboxEntry {
  /** Speicherschlüssel; sortiert in Reihenfolge des Eintragens. */
  readonly key: string
  readonly userId: string
  readonly createdAt: string
  readonly op: OutboxOp
}

/** Vom Server abgelehnt, zu oft vergeblich gesendet oder ungültig gespeichert (dann ist op null). */
export interface FailedEntry {
  readonly key: string
  readonly userId: string
  readonly createdAt: string
  readonly op: OutboxOp | null
  readonly error: string
  readonly failedAt: string
}

type Fields = Record<string, unknown>

const isObj = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v)
const isText = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isIndex = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const optional = (v: unknown, check: (x: unknown) => boolean) => v === undefined || v === null || check(v)
const isId = (v: unknown) => isText(v, 64)

function isFoodPayload(e: unknown): boolean {
  return (
    isObj(e) &&
    isId(e.id) &&
    isDay(e.eaten_on) &&
    isText(e.name) &&
    isText(e.status, 40) &&
    optional(e.kcal, isNum) &&
    optional(e.protein_g, isNum) &&
    optional(e.carbs_g, isNum) &&
    optional(e.fat_g, isNum) &&
    optional(e.grams, isNum) &&
    optional(e.meal_slot, (x) => isText(x, 40)) &&
    optional(e.meal_plan_item_id, isId) &&
    optional(e.created_at, isTime)
  )
}

/** Prüft die Felder je Art. Was hier durchfällt, wird nie gesendet, sondern landet in der Fehlerliste. */
export function isValidOp(op: unknown): op is OutboxOp {
  if (!isObj(op)) return false
  switch (op.kind) {
    case 'workout.start':
      return isId(op.id) && optional(op.planDayId, isId) && isTime(op.startedAt)
    case 'workout.finish':
      return isId(op.id) && isTime(op.finishedAt)
    case 'workout.delete':
    case 'food.delete':
      return isId(op.id)
    case 'set.upsert':
      return isId(op.workoutId) && isText(op.exerciseKey, 100) && isIndex(op.setIndex) && isNum(op.weightKg) && op.weightKg >= 0 && isIndex(op.reps)
    case 'set.delete':
      return isId(op.workoutId) && isText(op.exerciseKey, 100) && isIndex(op.setIndex)
    case 'food.insert':
      return isFoodPayload(op.entry)
    case 'food.update':
      return isId(op.id) && isText(op.name) && isNum(op.kcal) && isNum(op.proteinG) && optional(op.carbsG, isNum) && optional(op.fatG, isNum)
    case 'weight.upsert':
      return isDay(op.measuredOn) && isNum(op.weightKg) && op.weightKg > 0 && optional(op.bodyFatPct, isNum)
    default:
      return false
  }
}

export function isOutboxEntry(value: unknown): value is OutboxEntry {
  return isObj(value) && typeof value.key === 'string' && typeof value.userId === 'string' && typeof value.createdAt === 'string' && isValidOp(value.op)
}

export function isFailedEntry(value: unknown): value is FailedEntry {
  return isObj(value) && typeof value.key === 'string' && typeof value.userId === 'string' && typeof value.error === 'string' && (value.op === null || isValidOp(value.op))
}

/** Kurzform für Protokolle: Art und Schlüssel, nie Inhalte wie Gewicht oder Essen. */
export function logLabel(key: string, op: unknown): string {
  const kind = isObj(op) && typeof op.kind === 'string' ? op.kind : 'unbekannt'
  return `${kind} (${key})`
}

/** Kurzbeschreibung auf Deutsch, für die Liste nicht übertragbarer Einträge. */
export function describeOp(op: OutboxOp | null): string {
  if (op === null) return 'Ungültiger gespeicherter Eintrag'
  switch (op.kind) {
    case 'workout.start':
      return 'Training begonnen'
    case 'workout.finish':
      return 'Training abgeschlossen'
    case 'workout.delete':
      return 'Training verworfen'
    case 'set.upsert':
      return `Satz ${op.setIndex + 1} (${op.weightKg} kg × ${op.reps})`
    case 'set.delete':
      return `Satz ${op.setIndex + 1} geöffnet`
    case 'food.insert':
      return `Essen: ${op.entry.name}`
    case 'food.update':
      return `Essen geändert: ${op.name}`
    case 'food.delete':
      return 'Essen gelöscht'
    case 'weight.upsert':
      return `Gewicht ${op.weightKg} kg am ${op.measuredOn}`
  }
}
