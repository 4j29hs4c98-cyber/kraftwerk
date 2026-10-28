/** Tag-Schlüssel wie in meal_plan_items.day_key. */
export const DAY_KEYS = ['alle', 'training', 'ruhe', 'mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Readonly<Record<DayKey, string>> = {
  alle: 'Täglich',
  training: 'Trainingstag',
  ruhe: 'Ruhetag',
  mo: 'Montag',
  di: 'Dienstag',
  mi: 'Mittwoch',
  do: 'Donnerstag',
  fr: 'Freitag',
  sa: 'Samstag',
  so: 'Sonntag',
}

/** Mahlzeiten in zeitlicher Reihenfolge (meal_plan_items.meal_slot). */
export const MEAL_SLOTS = ['fruehstueck', 'snack_vormittag', 'mittag', 'snack_nachmittag', 'vor_training', 'nach_training', 'abend', 'spaet'] as const
export type MealSlot = (typeof MEAL_SLOTS)[number]

export const SLOT_LABELS: Readonly<Record<MealSlot, string>> = {
  fruehstueck: 'Frühstück',
  snack_vormittag: 'Snack vormittags',
  mittag: 'Mittagessen',
  snack_nachmittag: 'Snack nachmittags',
  vor_training: 'Vor dem Training',
  nach_training: 'Nach dem Training',
  abend: 'Abendessen',
  spaet: 'Spätmahlzeit',
}

export const isDayKey = (value: string): value is DayKey => (DAY_KEYS as readonly string[]).includes(value)
export const isMealSlot = (value: string): value is MealSlot => (MEAL_SLOTS as readonly string[]).includes(value)

/** Grenzen wie die Checks in meal_plan_items und create_meal_plan. */
export const MEAL_LIMITS = {
  planNameMax: 80,
  nameMax: 120,
  amountMax: 60,
  notesMax: 300,
  kcalMax: 5000,
  macroMax: 1000,
  maxItems: 300,
} as const

export interface MealItem {
  readonly dayKey: DayKey
  readonly mealSlot: MealSlot
  readonly name: string
  readonly amount: string | null
  readonly kcal: number | null
  readonly proteinG: number | null
  readonly carbsG: number | null
  readonly fatG: number | null
  readonly notes: string | null
}

/** Form eines Eintrags in p_items für create_meal_plan. */
export interface CreateMealItemArg {
  readonly day_key: DayKey
  readonly meal_slot: MealSlot
  readonly position: number
  readonly name: string
  readonly amount: string | null
  readonly kcal: number | null
  readonly protein_g: number | null
  readonly carbs_g: number | null
  readonly fat_g: number | null
  readonly notes: string | null
}

const inRange = (n: number | null, max: number): boolean => n === null || (Number.isFinite(n) && n >= 0 && n <= max)

/** Prüft eine komplette Liste wie die Datenbank. Liefert verständliche Meldungen, leer = gültig. */
export function validateMealItems(items: readonly MealItem[]): string[] {
  if (items.length === 0) return ['Der Ernährungsplan braucht mindestens einen Eintrag.']
  const errors: string[] = []
  if (items.length > MEAL_LIMITS.maxItems) errors.push(`Höchstens ${MEAL_LIMITS.maxItems} Einträge sind erlaubt.`)
  items.forEach((item, i) => {
    const at = `Eintrag ${i + 1}${item.name.trim() ? ` (${item.name.trim()})` : ''}`
    if (!item.name.trim()) errors.push(`${at}: Name fehlt.`)
    if (item.name.length > MEAL_LIMITS.nameMax) errors.push(`${at}: Name ist länger als ${MEAL_LIMITS.nameMax} Zeichen.`)
    if ((item.amount?.length ?? 0) > MEAL_LIMITS.amountMax) errors.push(`${at}: Menge ist länger als ${MEAL_LIMITS.amountMax} Zeichen.`)
    if ((item.notes?.length ?? 0) > MEAL_LIMITS.notesMax) errors.push(`${at}: Hinweis ist länger als ${MEAL_LIMITS.notesMax} Zeichen.`)
    if (!inRange(item.kcal, MEAL_LIMITS.kcalMax)) errors.push(`${at}: Kalorien müssen zwischen 0 und ${MEAL_LIMITS.kcalMax} liegen.`)
    if (!inRange(item.proteinG, MEAL_LIMITS.macroMax) || !inRange(item.carbsG, MEAL_LIMITS.macroMax) || !inRange(item.fatG, MEAL_LIMITS.macroMax)) {
      errors.push(`${at}: Makronährstoffe müssen zwischen 0 und ${MEAL_LIMITS.macroMax} g liegen.`)
    }
  })
  return errors
}

const orderOf = (key: DayKey): number => DAY_KEYS.indexOf(key)
const slotOrder = (slot: MealSlot): number => MEAL_SLOTS.indexOf(slot)

/** Sortiert stabil nach Tag und Mahlzeit; die Reihenfolge innerhalb einer Mahlzeit bleibt erhalten. */
export function sortMealItems<T extends Pick<MealItem, 'dayKey' | 'mealSlot'>>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => orderOf(a.item.dayKey) - orderOf(b.item.dayKey) || slotOrder(a.item.mealSlot) - slotOrder(b.item.mealSlot) || a.index - b.index)
    .map(({ item }) => item)
}

const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10)
const emptyToNull = (s: string | null): string | null => (s && s.trim() ? s.trim() : null)

/** Baut p_items: Position zählt innerhalb von Tag und Mahlzeit ab 0. */
export function toCreateMealItems(items: readonly MealItem[]): CreateMealItemArg[] {
  const counters = new Map<string, number>()
  return sortMealItems(items).map((item) => {
    const group = `${item.dayKey}|${item.mealSlot}`
    const position = counters.get(group) ?? 0
    counters.set(group, position + 1)
    return {
      day_key: item.dayKey,
      meal_slot: item.mealSlot,
      position,
      name: item.name.trim(),
      amount: emptyToNull(item.amount),
      kcal: item.kcal === null ? null : Math.round(item.kcal),
      protein_g: round1(item.proteinG),
      carbs_g: round1(item.carbsG),
      fat_g: round1(item.fatG),
      notes: emptyToNull(item.notes),
    }
  })
}

const WEEKDAY_KEYS: readonly DayKey[] = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa']

/** Wochentag-Schlüssel eines lokalen Datums. */
export function weekdayKey(date: Date): DayKey {
  return WEEKDAY_KEYS[date.getDay()] ?? 'mo'
}

/** Welche Tag-Schlüssel an einem Datum gelten: Wochentag, täglich und Trainings- oder Ruhetag. */
export function activeDayKeys(date: Date, isTrainingDay: boolean): readonly DayKey[] {
  return [weekdayKey(date), 'alle', isTrainingDay ? 'training' : 'ruhe']
}

export function itemsForDay<T extends Pick<MealItem, 'dayKey' | 'mealSlot'>>(items: readonly T[], date: Date, isTrainingDay: boolean): T[] {
  const keys = activeDayKeys(date, isTrainingDay)
  return sortMealItems(items.filter((item) => keys.includes(item.dayKey)))
}

/** Gruppiert nach Mahlzeit in fester Reihenfolge, leere Mahlzeiten fallen weg. */
export function groupBySlot<T extends Pick<MealItem, 'mealSlot'>>(items: readonly T[]): { readonly slot: MealSlot; readonly items: readonly T[] }[] {
  return MEAL_SLOTS.map((slot) => ({ slot, items: items.filter((item) => item.mealSlot === slot) })).filter((g) => g.items.length > 0)
}
