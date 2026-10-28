import { addDays, startOfWeek, toISODate } from '../../../lib/date'
import { itemsForDay, type MealItem } from './model'

export interface AdherenceItem extends Pick<MealItem, 'dayKey' | 'mealSlot'> {
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

/**
 * Planeinhaltung der Woche: Fällig ist jede Mahlzeit, die an einem Tag laut Plan gilt
 * (Wochentag, täglich, Trainings- oder Ruhetag). Eingehalten ist sie, wenn es dazu einen
 * Eintrag "wie geplant" am selben Tag gibt. Ersetzte Mahlzeiten zählen nicht als eingehalten.
 */
export function weekAdherence(
  items: readonly AdherenceItem[],
  days: readonly { readonly date: Date; readonly isTrainingDay: boolean }[],
  entries: readonly AdherenceEntry[],
): Adherence {
  return days.reduce<Adherence>(
    (sum, day) => {
      const iso = toISODate(day.date)
      const due = itemsForDay(items, day.date, day.isTrainingDay)
      const ids = new Set(due.map((item) => item.id))
      const done = new Set(
        entries.filter((e) => e.eaten_on === iso && e.status === 'wie_geplant' && e.meal_plan_item_id !== null && ids.has(e.meal_plan_item_id)).map((e) => e.meal_plan_item_id),
      ).size
      return { done: sum.done + done, planned: sum.planned + due.length }
    },
    { done: 0, planned: 0 },
  )
}
