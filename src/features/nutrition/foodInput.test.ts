import { describe, expect, it } from 'vitest'
import { EMPTY_FOOD_FORM, parseFoodForm, sumFood, toFoodForm } from './foodInput'

describe('parseFoodForm', () => {
  it('parses German decimals and optional macros', () => {
    expect(parseFoodForm({ name: ' Skyr ', kcal: '120', protein: '22,4', carbs: '8', fat: '' })).toEqual({
      ok: true,
      values: { name: 'Skyr', kcal: 120, proteinG: 22.4, carbsG: 8, fatG: null },
    })
  })
  it('treats empty protein as zero', () => {
    const result = parseFoodForm({ ...EMPTY_FOOD_FORM, name: 'Apfel', kcal: '80' })
    expect(result.ok && result.values.proteinG).toBe(0)
  })
  it('rejects missing name, invalid kcal and invalid macros', () => {
    expect(parseFoodForm({ ...EMPTY_FOOD_FORM, kcal: '100' }).ok).toBe(false)
    expect(parseFoodForm({ ...EMPTY_FOOD_FORM, name: 'x', kcal: 'viel' }).ok).toBe(false)
    expect(parseFoodForm({ ...EMPTY_FOOD_FORM, name: 'x', kcal: '20000' }).ok).toBe(false)
    expect(parseFoodForm({ ...EMPTY_FOOD_FORM, name: 'x', kcal: '100', carbs: 'abc' }).ok).toBe(false)
    expect(parseFoodForm({ ...EMPTY_FOOD_FORM, name: 'x', kcal: '100', fat: '2000' }).ok).toBe(false)
  })
})

describe('toFoodForm', () => {
  it('turns numbers into German text fields', () => {
    expect(toFoodForm({ name: 'Shake', kcal: 160, proteinG: 32.5, carbsG: null, fatG: 2 })).toEqual({ name: 'Shake', kcal: '160', protein: '32,5', carbs: '', fat: '2' })
  })
})

describe('sumFood', () => {
  it('adds all macros and counts missing values as zero', () => {
    expect(
      sumFood([
        { kcal: 500, protein_g: 30.15, carbs_g: 60, fat_g: null },
        { kcal: null, protein_g: 10, carbs_g: null, fat_g: 5.5 },
      ]),
    ).toEqual({ kcal: 500, proteinG: 40.2, carbsG: 60, fatG: 5.5 })
  })
})
