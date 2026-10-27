import { describe, expect, it } from 'vitest'
import { parseNumber } from './body'

describe('parseNumber', () => {
  it('reads digits with an optional comma or dot', () => {
    expect(parseNumber('75')).toBe(75)
    expect(parseNumber(' 75,5 ')).toBe(75.5)
    expect(parseNumber('22.5')).toBe(22.5)
  })

  it('rejects everything else', () => {
    for (const value of ['', ' ', '1e3', '0x10', '-5', '1.000,5', '1,2,3', '12kg', ',5', 'Infinity']) {
      expect(parseNumber(value)).toBeNull()
    }
  })
})
