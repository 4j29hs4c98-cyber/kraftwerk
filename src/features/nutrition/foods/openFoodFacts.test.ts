import { describe, expect, it } from 'vitest'
import { mapOffResponse } from './openFoodFacts'

const CODE = '4000417025005'

const response = (product: Record<string, unknown>) => ({ code: CODE, status: 1, product })

const complete = {
  product_name: 'Ritter Sport Edel-Bitter',
  product_name_de: 'Edelbitter Schokolade',
  brands: 'Ritter Sport,Ritter',
  serving_quantity: 16.7,
  nutriments: { 'energy-kcal_100g': 496, energy_100g: 2069, proteins_100g: 7, carbohydrates_100g: 52, fat_100g: 27 },
}

describe('mapOffResponse', () => {
  it('maps a complete product with German name, brand and serving', () => {
    const result = mapOffResponse(response(complete), CODE)
    expect(result).toEqual({
      ok: true,
      product: { barcode: CODE, name: 'Edelbitter Schokolade (Ritter Sport)', kcal100: 496, protein100: 7, carbs100: 52, fat100: 27, servingGrams: 16.7, notes: [] },
    })
  })

  it('falls back to the plain product name and skips a brand already in the name', () => {
    const result = mapOffResponse(response({ ...complete, product_name_de: '', product_name: 'Ritter Sport Nuss' }), CODE)
    expect(result.ok && result.product.name).toBe('Ritter Sport Nuss')
  })

  it('converts kJ to kcal when kcal is missing', () => {
    const nutriments = { energy_100g: 2069, proteins_100g: 7, carbohydrates_100g: 52, fat_100g: 27 }
    const result = mapOffResponse(response({ ...complete, nutriments }), CODE)
    expect(result.ok && result.product.kcal100).toBe(494.5)
    const viaKj = mapOffResponse(response({ ...complete, nutriments: { 'energy-kj_100g': 418.4 } }), CODE)
    expect(viaKj.ok && viaKj.product.kcal100).toBe(100)
  })

  it('sets missing macros to 0 and says so', () => {
    const result = mapOffResponse(response({ ...complete, nutriments: { 'energy-kcal_100g': 120, proteins_100g: 3 } }), CODE)
    expect(result.ok && result.product).toMatchObject({ kcal100: 120, protein100: 3, carbs100: 0, fat100: 0 })
    expect(result.ok && result.product.notes).toEqual(['Kohlenhydrate fehlt bei Open Food Facts und steht auf 0.', 'Fett fehlt bei Open Food Facts und steht auf 0.'])
  })

  it('accepts numbers sent as text, also with a comma', () => {
    const nutriments = { 'energy-kcal_100g': '250', proteins_100g: '7,5', carbohydrates_100g: '30.2', fat_100g: '' }
    const result = mapOffResponse(response({ ...complete, nutriments, serving_quantity: '30' }), CODE)
    expect(result.ok && result.product).toMatchObject({ kcal100: 250, protein100: 7.5, carbs100: 30.2, fat100: 0, servingGrams: 30 })
  })

  it('fails without any energy value', () => {
    const result = mapOffResponse(response({ ...complete, nutriments: { proteins_100g: 7 } }), CODE)
    expect(result).toMatchObject({ ok: false })
    expect(mapOffResponse(response({ product_name: 'x' }), CODE)).toMatchObject({ ok: false })
  })

  it('reports an unknown product (status 0)', () => {
    const result = mapOffResponse({ code: CODE, status: 0, status_verbose: 'product not found' }, CODE)
    expect(result).toMatchObject({ ok: false })
    expect(!result.ok && result.error).toContain('kennt Open Food Facts nicht')
  })

  it('survives garbage without throwing', () => {
    for (const body of [null, undefined, 'text', 42, [], { product: 'x' }, { status: 1, product: [] }, { status: 1, product: { nutriments: 'x' } }]) {
      expect(mapOffResponse(body, CODE).ok).toBe(false)
    }
    const odd = mapOffResponse(response({ product_name: { a: 1 }, brands: 7, nutriments: { 'energy-kcal_100g': 'abc', 'energy-kj_100g': NaN, energy_100g: null } }), CODE)
    expect(odd.ok).toBe(false)
  })

  it('clamps out-of-range values to the database limits and notes it', () => {
    const nutriments = { 'energy-kcal_100g': 5000, proteins_100g: 250, carbohydrates_100g: -4, fat_100g: 1e9 }
    const result = mapOffResponse(response({ ...complete, nutriments }), CODE)
    expect(result.ok && result.product).toMatchObject({ kcal100: 1000, protein100: 100, carbs100: 0, fat100: 100 })
    expect(result.ok && result.product.notes).toHaveLength(4)
  })

  it('ignores an implausible serving size', () => {
    for (const serving of [0, -5, 99999, 'viel', null]) {
      const result = mapOffResponse(response({ ...complete, serving_quantity: serving }), CODE)
      expect(result.ok && result.product.servingGrams).toBeNull()
    }
  })

  it('trims the name to 80 characters, strips control characters and drops a long brand', () => {
    const long = 'A'.repeat(100)
    const trimmed = mapOffResponse(response({ ...complete, product_name_de: `  ${long}\n\t`, brands: 'X' }), CODE)
    expect(trimmed.ok && trimmed.product.name).toBe('A'.repeat(80))
    const clean = mapOffResponse(response({ ...complete, product_name_de: 'Skyr\u0000  natur\n', brands: 'A'.repeat(40) }), CODE)
    expect(clean.ok && clean.product.name).toBe('Skyr natur')
  })

  it('names a product without any name after its code', () => {
    const result = mapOffResponse(response({ nutriments: complete.nutriments }), CODE)
    expect(result.ok && result.product.name).toBe(`Produkt ${CODE}`)
  })

  it('rejects an invalid requested code and keeps only digits in the result', () => {
    expect(mapOffResponse(response(complete), '../etc/passwd')).toMatchObject({ ok: false })
    expect(mapOffResponse({ ...response(complete), code: '<script>' }, ` ${CODE} `)).toMatchObject({ ok: true, product: { barcode: CODE } })
  })
})
