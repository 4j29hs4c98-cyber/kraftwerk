import { describe, expect, it } from 'vitest'
import { budgetFit, groupSlotVariants, remainingBudget, selectedVariant, splitVariants, sumItems } from './variants'
import { parseVariantChoices, withVariantChoice } from './variantChoice'
import type { MealItem } from './model'

const item = (id: string, patch: Partial<MealItem>): MealItem & { id: string } => ({
  id,
  dayKey: 'alle',
  mealSlot: 'mittag',
  name: id,
  amount: null,
  kcal: 100,
  proteinG: 10,
  carbsG: 10,
  fatG: 1,
  notes: null,
  variant: null,
  ...patch,
})

describe('splitVariants', () => {
  it('separates common items and groups variants in order of appearance', () => {
    const items = [item('a', { variant: 'Lachs' }), item('b', {}), item('c', { variant: ' Hähnchen ' }), item('d', { variant: 'Lachs' }), item('e', { variant: ' ' })]
    const split = splitVariants(items, (i) => i.variant)
    expect(split.common.map((i) => i.id)).toEqual(['b', 'e'])
    expect(split.variants.map((v) => [v.name, v.items.map((i) => i.id)])).toEqual([
      ['Lachs', ['a', 'd']],
      ['Hähnchen', ['c']],
    ])
  })
})

describe('groupSlotVariants', () => {
  it('groups by meal in fixed order and splits variants per meal', () => {
    const groups = groupSlotVariants([item('m', { variant: 'A' }), item('f', { mealSlot: 'fruehstueck' }), item('n', { variant: 'B' })])
    expect(groups.map((g) => [g.slot, g.common.length, g.variants.map((v) => v.name)])).toEqual([
      ['fruehstueck', 1, []],
      ['mittag', 0, ['A', 'B']],
    ])
  })
})

describe('sumItems', () => {
  it('adds values, treats missing as 0 and rounds', () => {
    expect(sumItems([item('a', { kcal: 297.4, proteinG: 55.84, carbsG: null }), item('b', { kcal: 325, proteinG: 6.75, carbsG: 70, fatG: null })])).toEqual({
      kcal: 622,
      proteinG: 62.6,
      carbsG: 70,
      fatG: 1,
    })
    expect(sumItems([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})

describe('remainingBudget and budgetFit', () => {
  const entries = [
    { kcal: 500, meal_plan_item_id: null },
    { kcal: 300, meal_plan_item_id: 'x' },
    { kcal: 200, meal_plan_item_id: 'mine' },
    { kcal: null, meal_plan_item_id: null },
  ]
  it('subtracts eaten kcal except the excluded items', () => {
    expect(remainingBudget(2500, entries, new Set(['mine']))).toBe(1700)
    expect(remainingBudget(2500, entries, new Set())).toBe(1500)
  })
  it('says whether a dish fits', () => {
    expect(budgetFit(600, 1000)).toEqual({ fits: true, leftKcal: 400, label: 'passt, danach noch 400 kcal frei' })
    expect(budgetFit(1000, 1000).fits).toBe(true)
    expect(budgetFit(1180, 1000)).toEqual({ fits: false, overKcal: 180, label: '+180 kcal über Budget' })
    expect(budgetFit(2400, -200).label).toBe('+2.600 kcal über Budget')
  })
})

describe('selectedVariant', () => {
  const variants = [
    { name: 'A', items: [item('a1', {}), item('a2', {})] },
    { name: 'B', items: [item('b1', {})] },
  ]
  it('prefers a variant already eaten as planned', () => {
    expect(selectedVariant(variants, [{ meal_plan_item_id: 'b1', status: 'wie_geplant' }], 'A')).toBe('B')
    expect(selectedVariant(variants, [{ meal_plan_item_id: 'a2', status: 'ersetzt' }, { meal_plan_item_id: 'b1', status: 'wie_geplant' }], null)).toBe('B')
    expect(selectedVariant(variants, [{ meal_plan_item_id: 'a2', status: 'ersetzt' }], 'B')).toBe('A')
  })
  it('falls back to the stored choice, then the first variant', () => {
    expect(selectedVariant(variants, [], 'B')).toBe('B')
    expect(selectedVariant(variants, [], 'Gibt es nicht')).toBe('A')
    expect(selectedVariant(variants, [{ meal_plan_item_id: 'fremd', status: 'wie_geplant' }], null)).toBe('A')
    expect(selectedVariant([], [], 'A')).toBeNull()
  })
})

describe('variant choices in storage', () => {
  it('parses only valid dates, slots and names', () => {
    const raw = JSON.stringify({ '2026-10-28': { mittag: 'Pasta', brunch: 'x', abend: 3 }, kaputt: { mittag: 'y' }, '2026-10-27': [] })
    expect(parseVariantChoices(raw)).toEqual({ '2026-10-28': { mittag: 'Pasta' } })
    expect(parseVariantChoices('{nope')).toEqual({})
    expect(parseVariantChoices(null)).toEqual({})
  })
  it('sets a choice without mutating and drops old days', () => {
    const start = { '2026-01-01': { mittag: 'Alt' }, '2026-10-28': { abend: 'Suppe' } }
    const next = withVariantChoice(start, '2026-10-28', 'mittag', 'Pasta', '2026-10-28')
    expect(next).toEqual({ '2026-10-28': { abend: 'Suppe', mittag: 'Pasta' } })
    expect(start['2026-10-28']).toEqual({ abend: 'Suppe' })
  })
})
