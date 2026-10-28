import { addDays, startOfWeek, toISODate } from '../../../lib/date'
import { itemsForDay, type MealItem } from './model'
import { groupSlotVariants } from './variants'

export interface AdherenceItem extends Pick<MealItem, 'dayKey' | 'mealSlot' | 'variant'> {
  readonly id: string
}

export interface AdherenceEntry {
  readonly eaten_on: string
  readonly meal_plan_item_id: string | null
  readonly status: string
}

export interface Adherence {
  /** Mahlzeiten, die wie geplant gegessen wurden. */
  readonly done: number
  /** Mahlzeiten, die laut Plan bis heute fällig waren. */
  readonly planned: number
}

/** Montag bis einschließlich heute (lokal). */
export function daysOfWeekUntil(today: Date): Date[] {
  const monday = startOfWeek(today)
  const count = ((today.getDay() + 6) % 7) + 1
  return Array.from({ length: count }, (_, i) => addDays(monday, i))
}

/** Fällige und eingehaltene Mahlzeiten eines Tages; eine Mahlzeit mit Varianten zählt als eine. */
function dayAdherence(due: readonly AdherenceItem[], doneIds: ReadonlySet<string>): Adherence {
  return groupSlotVariants(due).reduce<Adherence>(
    (sum, group) => {
      const common = group.common.filter((item) => doneIds.has(item.id)).length
      const variantDone = group.variants.some((v) => v.items.every((item) => doneIds.has(item.id)))
      const hasVariants = group.variants.length > 0
      return {
        done: sum.done + common + (hasVariants && variantDone ? 1 : 0),
        planned: sum.planned + group.common.length + (hasVariants ? 1 : 0),
      }
    },
    { done: 0, planned: 0 },
  )
}

/**
 * Planeinhaltung der Woche: Fällig ist jede Mahlzeit, die an einem Tag laut Plan gilt
 * (Wochentag, täglich, Trainings- oder Ruhetag). Eingehalten ist sie, wenn es dazu einen
 * Eintrag "wie geplant" am selben Tag gibt. Ersetzte Mahlzeiten zählen nicht als eingehalten.
 * Varianten sind Alternativen: eine Mahlzeit mit Varianten zählt einmal und ist eingehalten,
 * wenn alle Einträge einer Variante wie geplant gegessen wurden.
 */
export function weekAdherence(
  items: readonly AdherenceItem[],
  days: readonly { readonly date: Date; readonly isTrainingDay: boolean }[],
  entries: readonly AdherenceEntry[],
): Adherence {
  return days.reduce<Adherence>(
    (sum, day) => {
      const iso = toISODate(day.date)
      const doneIds = new Set(
        entries.flatMap((e) => (e.eaten_on === iso && e.status === 'wie_geplant' && e.meal_plan_item_id !== null ? [e.meal_plan_item_id] : [])),
      )
      const result = dayAdherence(itemsForDay(items, day.date, day.isTrainingDay), doneIds)
      return { done: sum.done + result.done, planned: sum.planned + result.planned }
    },
    { done: 0, planned: 0 },
  )
}
