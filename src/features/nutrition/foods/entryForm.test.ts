import { describe, expect, it } from 'vitest'
import { EMPTY_ENTRY_FORM, formForFood, ownFoodFromEntry, parseEntryForm, withGrams } from './entryForm'

const rice = { name: 'Reis gekocht', kcal100: 130, protein100: 2.7, carbs100: 28, fat100: 0.3, defaultGrams: 250 }

describe('formForFood and withGrams', () => {
  it('prefills the typical portion and calculated values', () => {
    expect(formForFood(rice)).toEqual({ name: 'Reis gekocht', grams: '250', kcal: '325', protein: '6,8', carbs: '70', fat: '0,8' })
    expect(formForFood({ ...rice, defaultGrams: null }).grams).toBe('100')
  })
  it('recalculates on a valid amount with German decimals and keeps values otherwise', () => {
    const form = formForFood(rice)
    expect(withGrams(form, rice, '125,5')).toMatchObject({ grams: '125,5', kcal: '163', protein: '3,4' })
    expect(withGrams(form, rice, 'abc')).toEqual({ ...form, grams: 'abc' })
    expect(withGrams({ ...form, kcal: '999' }, null, '50')).toMatchObject({ grams: '50', kcal: '999' })
  })
})

describe('parseEntryForm', () => {
  it('returns values and grams', () => {
    expect(parseEntryForm(formForFood(rice))).toEqual({ ok: true, grams: 250, values: { name: 'Reis gekocht', kcal: 325, proteinG: 6.8, carbsG: 70, fatG: 0.8 } })
  })
  it('allows a manual entry without grams and rejects invalid grams', () => {
    expect(parseEntryForm({ ...EMPTY_ENTRY_FORM, name: 'Döner', kcal: '700' })).toMatchObject({ ok: true, grams: null })
    expect(parseEntryForm({ ...EMPTY_ENTRY_FORM, name: 'Döner', kcal: '700', grams: '0' })).toMatchObject({ ok: false, error: expect.stringContaining('Gramm') })
    expect(parseEntryForm({ ...EMPTY_ENTRY_FORM, name: '', kcal: '700' })).toMatchObject({ ok: false })
  })
})

describe('ownFoodFromEntry', () => {
  it('calculates back to 100 g and uses the amount as portion', () => {
    expect(ownFoodFromEntry({ name: 'Wrap', kcal: 450, proteinG: 30, carbsG: 45, fatG: 15 }, 300)).toEqual({
      ok: true,
      food: { name: 'Wrap', kcal100: 150, protein100: 10, carbs100: 15, fat100: 5, defaultGrams: 300 },
    })
  })
  it('treats values as per 100 g without grams and checks the limits', () => {
    expect(ownFoodFromEntry({ name: 'Riegel', kcal: 400, proteinG: 30, carbsG: null, fatG: null }, null)).toMatchObject({
      ok: true,
      food: { kcal100: 400, carbs100: 0, defaultGrams: null },
    })
    expect(ownFoodFromEntry({ name: 'Pizza', kcal: 900, proteinG: 30, carbsG: 100, fatG: 30 }, 50)).toMatchObject({ ok: false })
    expect(ownFoodFromEntry({ name: 'Topf', kcal: 3000, proteinG: 100, carbsG: 300, fatG: 100 }, 3000)).toMatchObject({ ok: true, food: { defaultGrams: null } })
  })
})
