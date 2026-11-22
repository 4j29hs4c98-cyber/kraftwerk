import { describe, expect, it } from 'vitest'
import { conflictOutcome, findFoodByBarcode, normalizeBarcode, openFoodFactsCode, sameBarcode } from './barcode'
import type { Food } from './foodMath'

const food = (name: string, barcode?: string | null): Food => ({ id: name, name, kcal100: 100, protein100: 10, carbs100: 10, fat100: 1, defaultGrams: null, barcode })

describe('normalizeBarcode', () => {
  it('accepts 8 to 14 digits and strips whitespace', () => {
    expect(normalizeBarcode('4000417025005')).toBe('4000417025005')
    expect(normalizeBarcode(' 4000 4170 25005 ')).toBe('4000417025005')
    expect(normalizeBarcode('20022706')).toBe('20022706')
    expect(normalizeBarcode('12345678901234')).toBe('12345678901234')
  })
  it('rejects wrong length and non-digits', () => {
    expect(normalizeBarcode('1234567')).toBeNull()
    expect(normalizeBarcode('123456789012345')).toBeNull()
    expect(normalizeBarcode('40004170250A5')).toBeNull()
    expect(normalizeBarcode('4000-4170-25005')).toBeNull()
    expect(normalizeBarcode('')).toBeNull()
  })
})

describe('sameBarcode and openFoodFactsCode', () => {
  it('treats UPC-A and EAN-13 with leading zero as equal', () => {
    expect(sameBarcode('012345678905', '0012345678905')).toBe(true)
    expect(sameBarcode('4000417025005', '4000417025006')).toBe(false)
  })
  it('pads a UPC-A to EAN-13 for Open Food Facts only', () => {
    expect(openFoodFactsCode('012345678905')).toBe('0012345678905')
    expect(openFoodFactsCode('4000417025005')).toBe('4000417025005')
    expect(openFoodFactsCode('20022706')).toBe('20022706')
  })
})

describe('findFoodByBarcode', () => {
  const foods = [food('Skyr', '4000417025005'), food('Reis'), food('Brot', null), food('Quark', '012345678905')]
  it('finds an own food by its barcode', () => {
    expect(findFoodByBarcode(foods, '4000417025005')?.name).toBe('Skyr')
  })
  it('finds it across UPC-A and EAN-13 spelling', () => {
    expect(findFoodByBarcode(foods, '0012345678905')?.name).toBe('Quark')
  })
  it('returns null for unknown codes and foods without barcode', () => {
    expect(findFoodByBarcode(foods, '20022706')).toBeNull()
    expect(findFoodByBarcode([food('Reis')], '4000417025005')).toBeNull()
  })
})

describe('conflictOutcome', () => {
  it('reuses the food that already has the barcode, whichever index fired first', () => {
    expect(conflictOutcome('4000417025005', food('Skyr', '4000417025005'))).toBe('reuse')
  })
  it('stays a name duplicate without barcode or without a food carrying it', () => {
    expect(conflictOutcome(null, null)).toBe('duplicate')
    expect(conflictOutcome(null, food('Skyr'))).toBe('duplicate')
    expect(conflictOutcome('4000417025005', null)).toBe('duplicate')
  })
})
