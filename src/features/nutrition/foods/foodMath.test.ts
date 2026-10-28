import { describe, expect, it } from 'vitest'
import { BUILTIN_FOODS } from './builtin'
import { mergeFoods, nutrientsFor, parseFoodDefForm, parseGrams, per100From, searchFoods, validateFoodDef, type Food } from './foodMath'

const chicken = { kcal100: 165, protein100: 31, carbs100: 0, fat100: 3.6 }

describe('nutrientsFor', () => {
  it('scales per 100 g values and rounds kcal to integers, macros to one decimal', () => {
    expect(nutrientsFor(chicken, 180)).toEqual({ kcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.5 })
    expect(nutrientsFor({ kcal100: 130, protein100: 2.7, carbs100: 28, fat100: 0.3 }, 250)).toEqual({ kcal: 325, proteinG: 6.8, carbsG: 70, fatG: 0.8 })
    expect(nutrientsFor(chicken, 0)).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})

describe('per100From', () => {
  it('calculates back to 100 g when grams are known', () => {
    expect(per100From({ kcal: 297, proteinG: 55.8, carbsG: 0, fatG: 6.5 }, 180)).toEqual({ kcal100: 165, protein100: 31, carbs100: 0, fat100: 3.6 })
  })
  it('keeps the values as per 100 g without grams', () => {
    expect(per100From({ kcal: 120, proteinG: 4, carbsG: 20, fatG: 2 }, null)).toEqual({ kcal100: 120, protein100: 4, carbs100: 20, fat100: 2 })
  })
})

describe('parseGrams', () => {
  it('reads German decimals and checks the range', () => {
    expect(parseGrams('180')).toBe(180)
    expect(parseGrams('12,5')).toBe(12.5)
    expect(parseGrams(' ')).toBeNull()
    expect(parseGrams('0')).toBeUndefined()
    expect(parseGrams('5001')).toBeUndefined()
    expect(parseGrams('viel')).toBeUndefined()
  })
})

describe('mergeFoods and searchFoods', () => {
  const own: Food[] = [{ id: 'f1', name: 'reis gekocht', kcal100: 120, protein100: 2.5, carbs100: 26, fat100: 0.2, defaultGrams: 200 }]
  const all = mergeFoods(own, BUILTIN_FOODS)

  it('lets own foods replace builtin ones with the same name', () => {
    expect(all.filter((f) => f.name.toLowerCase() === 'reis gekocht')).toEqual(own)
    expect(all).toHaveLength(BUILTIN_FOODS.length)
    expect(all.find((f) => f.name === 'Banane')?.id).toBeNull()
  })

  it('finds foods by all words, tolerant to umlauts and case, prefix matches first', () => {
    expect(searchFoods(all, 'hähnchen').map((f) => f.name)).toEqual(['Hähnchenbrust roh', 'Hähnchenbrust gegart (Airfryer)'])
    expect(searchFoods(all, 'HAEHNCHEN gegart').map((f) => f.name)).toEqual(['Hähnchenbrust gegart (Airfryer)'])
    expect(searchFoods(all, 'gekocht').map((f) => f.name)[0]).toBe('reis gekocht')
    expect(searchFoods(all, 'reis')[0]?.name).toBe('reis gekocht')
    expect(searchFoods(all, '  ')).toEqual([])
    expect(searchFoods(all, 'e', 3)).toHaveLength(3)
  })
})

describe('builtin list', () => {
  it('is valid for the foods table and names are unique', () => {
    expect(BUILTIN_FOODS.map(validateFoodDef).filter(Boolean)).toEqual([])
    expect(new Set(BUILTIN_FOODS.map((f) => f.name.toLowerCase())).size).toBe(BUILTIN_FOODS.length)
  })
})

describe('parseFoodDefForm', () => {
  it('reads a complete form with German decimals', () => {
    expect(parseFoodDefForm({ name: ' Protein-Pudding ', kcal100: '75', protein100: '10,2', carbs100: '6', fat100: '', defaultGrams: '200' })).toEqual({
      ok: true,
      food: { name: 'Protein-Pudding', kcal100: 75, protein100: 10.2, carbs100: 6, fat100: 0, defaultGrams: 200 },
    })
  })
  it('reports missing or out of range values', () => {
    const base = { name: 'X', kcal100: '100', protein100: '', carbs100: '', fat100: '', defaultGrams: '' }
    expect(parseFoodDefForm({ ...base, name: '' })).toMatchObject({ ok: false, error: expect.stringContaining('Namen') })
    expect(parseFoodDefForm({ ...base, kcal100: '' })).toMatchObject({ ok: false })
    expect(parseFoodDefForm({ ...base, kcal100: '1200' })).toMatchObject({ ok: false, error: expect.stringContaining('1000') })
    expect(parseFoodDefForm({ ...base, fat100: '101' })).toMatchObject({ ok: false })
    expect(parseFoodDefForm({ ...base, defaultGrams: '3000' })).toMatchObject({ ok: false, error: expect.stringContaining('Portion') })
    expect(parseFoodDefForm({ ...base, defaultGrams: 'groß' })).toMatchObject({ ok: false })
  })
})
