import { describe, expect, it } from 'vitest'
import { daysOfWeekUntil, weekAdherence } from './adherence'
import { groupBySlot, itemsForDay, sortMealItems, toCreateMealItems, validateMealItems, weekdayKey, type MealItem } from './model'

const item = (patch: Partial<MealItem>): MealItem => ({
  dayKey: 'alle',
  mealSlot: 'mittag',
  name: 'Reis',
  amount: null,
  kcal: 300,
  proteinG: 6,
  carbsG: 65,
  fatG: 1,
  notes: null,
  variant: null,
  ...patch,
})

// 27.10.2026 ist ein Dienstag.
const TUESDAY = new Date(2026, 9, 27)

describe('weekdayKey', () => {
  it('uses the local weekday', () => {
    expect(weekdayKey(TUESDAY)).toBe('di')
    expect(weekdayKey(new Date(2026, 10, 1))).toBe('so')
  })
})

describe('itemsForDay', () => {
  const items = [
    item({ dayKey: 'di', mealSlot: 'abend', name: 'Dienstag' }),
    item({ dayKey: 'mo', name: 'Montag' }),
    item({ dayKey: 'alle', mealSlot: 'fruehstueck', name: 'Täglich' }),
    item({ dayKey: 'training', mealSlot: 'vor_training', name: 'Carbs' }),
    item({ dayKey: 'ruhe', name: 'Ruhe' }),
  ]
  it('combines weekday, daily and training items', () => {
    expect(itemsForDay(items, TUESDAY, true).map((i) => i.name)).toEqual(['Täglich', 'Carbs', 'Dienstag'])
  })
  it('uses rest day items when not training', () => {
    expect(itemsForDay(items, TUESDAY, false).map((i) => i.name)).toEqual(['Täglich', 'Ruhe', 'Dienstag'])
  })
  it('groups by meal in a fixed order', () => {
    expect(groupBySlot(itemsForDay(items, TUESDAY, true)).map((g) => g.slot)).toEqual(['fruehstueck', 'vor_training', 'abend'])
  })
})

describe('sortMealItems', () => {
  it('sorts by day then meal and keeps the order within a meal', () => {
    const sorted = sortMealItems([item({ dayKey: 'mo', name: 'b' }), item({ dayKey: 'alle', name: 'x' }), item({ dayKey: 'mo', name: 'a' })])
    expect(sorted.map((i) => i.name)).toEqual(['x', 'b', 'a'])
  })
})

describe('toCreateMealItems', () => {
  it('numbers positions per day and meal, trims and rounds', () => {
    const args = toCreateMealItems([
      item({ name: ' Reis ', amount: ' ', kcal: 299.6, proteinG: 6.04 }),
      item({ name: 'Hähnchen', notes: 'mager' }),
      item({ mealSlot: 'abend', name: 'Brot' }),
    ])
    expect(args.map((a) => [a.meal_slot, a.position, a.name])).toEqual([
      ['mittag', 0, 'Reis'],
      ['mittag', 1, 'Hähnchen'],
      ['abend', 0, 'Brot'],
    ])
    expect(args[0]).toMatchObject({ amount: null, kcal: 300, protein_g: 6 })
    expect(args[1]?.notes).toBe('mager')
  })

  it('passes the trimmed variant or null', () => {
    const args = toCreateMealItems([item({ variant: ' Hähnchen mit Reis ' }), item({ variant: '  ' })])
    expect(args.map((a) => a.variant)).toEqual(['Hähnchen mit Reis', null])
  })
})

describe('validateMealItems', () => {
  it('accepts a valid list', () => {
    expect(validateMealItems([item({})])).toEqual([])
  })
  it('rejects empty lists, missing names and out of range values', () => {
    expect(validateMealItems([])).toHaveLength(1)
    const errors = validateMealItems([item({ name: ' ' }), item({ kcal: 6000 }), item({ fatG: -1 }), item({ amount: 'x'.repeat(501) })])
    expect(errors).toHaveLength(4)
    expect(errors[0]).toContain('Name fehlt')
  })
  it('rejects variants longer than 60 characters', () => {
    expect(validateMealItems([item({ variant: 'x'.repeat(61) })])[0]).toContain('Variante')
  })
})

describe('weekAdherence', () => {
  const items = [
    { id: 'a', dayKey: 'alle' as const, mealSlot: 'fruehstueck' as const, variant: null },
    { id: 't', dayKey: 'training' as const, mealSlot: 'vor_training' as const, variant: null },
    { id: 'r', dayKey: 'ruhe' as const, mealSlot: 'abend' as const, variant: null },
  ]
  const days = daysOfWeekUntil(TUESDAY).map((date, i) => ({ date, isTrainingDay: i === 0 }))

  it('lists Monday until today', () => {
    expect(days.map((d) => d.date.getDate())).toEqual([26, 27])
  })

  it('counts only meals eaten as planned on the right day', () => {
    const result = weekAdherence(items, days, [
      { eaten_on: '2026-10-26', meal_plan_item_id: 'a', status: 'wie_geplant' },
      { eaten_on: '2026-10-26', meal_plan_item_id: 't', status: 'ersetzt' },
      { eaten_on: '2026-10-27', meal_plan_item_id: 'r', status: 'wie_geplant' },
      { eaten_on: '2026-10-27', meal_plan_item_id: 't', status: 'wie_geplant' },
      { eaten_on: '2026-10-27', meal_plan_item_id: null, status: 'frei' },
    ])
    expect(result).toEqual({ done: 2, planned: 4 })
  })

  it('counts a meal with variants once, done when one variant is complete', () => {
    const withVariants = [
      { id: 'h1', dayKey: 'alle' as const, mealSlot: 'mittag' as const, variant: 'Hähnchen' },
      { id: 'h2', dayKey: 'alle' as const, mealSlot: 'mittag' as const, variant: 'Hähnchen' },
      { id: 'l1', dayKey: 'alle' as const, mealSlot: 'mittag' as const, variant: 'Lachs' },
      { id: 's', dayKey: 'alle' as const, mealSlot: 'mittag' as const, variant: null },
    ]
    const result = weekAdherence(withVariants, days, [
      { eaten_on: '2026-10-26', meal_plan_item_id: 'h1', status: 'wie_geplant' },
      { eaten_on: '2026-10-26', meal_plan_item_id: 'h2', status: 'wie_geplant' },
      { eaten_on: '2026-10-27', meal_plan_item_id: 'h1', status: 'wie_geplant' },
      { eaten_on: '2026-10-27', meal_plan_item_id: 's', status: 'wie_geplant' },
    ])
    // Pro Tag: Beilage s und eine Mahlzeit mit Varianten = 2 fällig.
    expect(result).toEqual({ done: 2, planned: 4 })
  })
})
