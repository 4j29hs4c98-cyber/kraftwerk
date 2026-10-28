import { groupBySlot, type MealItem, type MealSlot } from './model'

/** Ein Gericht: alle Einträge einer Mahlzeit mit derselben Variante. */
export interface DishVariant<T> {
  readonly name: string
  readonly items: readonly T[]
}

/** Einträge einer Mahlzeit: ohne Variante (gelten immer) und die Varianten als Alternativen. */
export interface VariantSplit<T> {
  readonly common: readonly T[]
  readonly variants: readonly DishVariant<T>[]
}

export interface SlotVariants<T> extends VariantSplit<T> {
  readonly slot: MealSlot
}

export interface Totals {
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

/** Leere oder nur aus Leerzeichen bestehende Variante zählt als "keine Variante". */
export const variantName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/** Trennt Einträge in "gilt immer" und Gerichte; Gerichte stehen in der Reihenfolge ihres ersten Auftretens. */
export function splitVariants<T>(items: readonly T[], getVariant: (item: T) => string | null | undefined): VariantSplit<T> {
  const common = items.filter((item) => variantName(getVariant(item)) === null)
  const names = [...new Set(items.map((item) => variantName(getVariant(item))).filter((name): name is string => name !== null))]
  const variants = names.map((name) => ({ name, items: items.filter((item) => variantName(getVariant(item)) === name) }))
  return { common, variants }
}

/** Gruppiert nach Mahlzeit (feste Reihenfolge) und trennt darin die Varianten. */
export function groupSlotVariants<T extends Pick<MealItem, 'mealSlot' | 'variant'>>(items: readonly T[]): SlotVariants<T>[] {
  return groupBySlot(items).map((group) => ({ slot: group.slot, ...splitVariants(group.items, (item) => item.variant) }))
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/** Summe der Nährwerte; fehlende Werte zählen als 0, kcal ganzzahlig, Makros auf eine Nachkommastelle. */
export function sumItems(items: readonly Pick<MealItem, 'kcal' | 'proteinG' | 'carbsG' | 'fatG'>[]): Totals {
  const sum = items.reduce<Totals>(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal ?? 0),
      proteinG: acc.proteinG + (item.proteinG ?? 0),
      carbsG: acc.carbsG + (item.carbsG ?? 0),
      fatG: acc.fatG + (item.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
  return { kcal: Math.round(sum.kcal), proteinG: round1(sum.proteinG), carbsG: round1(sum.carbsG), fatG: round1(sum.fatG) }
}

export interface EatenEntry {
  readonly kcal: number | null
  readonly meal_plan_item_id: string | null
}

/**
 * Verbleibendes Tagesbudget in kcal: Ziel minus alles, was schon eingetragen ist.
 * Einträge zu den ausgenommenen Plan-Einträgen (die Mahlzeit, um die es gerade geht) zählen nicht,
 * damit eine schon abgehakte Variante sich nicht selbst aus dem Budget drängt.
 */
export function remainingBudget(targetKcal: number, entries: readonly EatenEntry[], excludeItemIds: ReadonlySet<string>): number {
  const eaten = entries
    .filter((e) => e.meal_plan_item_id === null || !excludeItemIds.has(e.meal_plan_item_id))
    .reduce((sum, e) => sum + (e.kcal ?? 0), 0)
  return Math.round(targetKcal - eaten)
}

export type BudgetFit = { readonly fits: true; readonly leftKcal: number; readonly label: string } | { readonly fits: false; readonly overKcal: number; readonly label: string }

const KCAL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/** Passt ein Gericht ins verbleibende Budget? "passt, noch 420 kcal frei" oder "+180 kcal über Budget". */
export function budgetFit(dishKcal: number, remainingKcal: number): BudgetFit {
  const left = Math.round(remainingKcal - dishKcal)
  if (left >= 0) return { fits: true, leftKcal: left, label: `passt, danach noch ${KCAL.format(left)} kcal frei` }
  return { fits: false, overKcal: -left, label: `+${KCAL.format(-left)} kcal über Budget` }
}

export interface ChoiceEntry {
  readonly meal_plan_item_id: string | null
  readonly status: string
}

/**
 * Welche Variante ausgewählt ist: eine schon abgehakte (oder ersetzte) hat Vorrang,
 * dann die gemerkte Auswahl, sonst die erste. Gibt den Namen zurück, null ohne Varianten.
 */
export function selectedVariant<T extends { readonly id: string }>(
  variants: readonly DishVariant<T>[],
  entries: readonly ChoiceEntry[],
  stored: string | null | undefined,
): string | null {
  const hasEntry = (variant: DishVariant<T>, status?: string) =>
    variant.items.some((item) => entries.some((e) => e.meal_plan_item_id === item.id && (status === undefined || e.status === status)))
  const done = variants.find((v) => hasEntry(v, 'wie_geplant')) ?? variants.find((v) => hasEntry(v))
  if (done) return done.name
  if (stored && variants.some((v) => v.name === stored)) return stored
  return variants[0]?.name ?? null
}
