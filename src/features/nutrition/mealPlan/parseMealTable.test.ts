import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../../plan/import/csv'
import { importErrors, parseCellNumber, parseDayKey, parseMealSlot, parseMealTable } from './parseMealTable'
import { MEAL_TEMPLATE_ROWS } from './template'

describe('parseDayKey', () => {
  it('recognises weekdays, training, rest and daily', () => {
    expect(parseDayKey('Montag')).toBe('mo')
    expect(parseDayKey('so')).toBe('so')
    expect(parseDayKey('Trainingstag')).toBe('training')
    expect(parseDayKey('Ruhetag')).toBe('ruhe')
    expect(parseDayKey('Täglich')).toBe('alle')
    expect(parseDayKey('Alle')).toBe('alle')
    expect(parseDayKey('Feiertag')).toBeNull()
  })
})

describe('parseMealSlot', () => {
  it('maps common spellings', () => {
    expect(parseMealSlot('Frühstück')).toBe('fruehstueck')
    expect(parseMealSlot('Snack vormittags')).toBe('snack_vormittag')
    expect(parseMealSlot('Mittag')).toBe('mittag')
    expect(parseMealSlot('Mittagessen')).toBe('mittag')
    expect(parseMealSlot('Snack nachmittags')).toBe('snack_nachmittag')
    expect(parseMealSlot('Abendessen')).toBe('abend')
    expect(parseMealSlot('Vor dem Training')).toBe('vor_training')
    expect(parseMealSlot('Nach dem Training')).toBe('nach_training')
    expect(parseMealSlot('Spätmahlzeit')).toBe('spaet')
    expect(parseMealSlot('Spät')).toBe('spaet')
    expect(parseMealSlot('Brunch')).toBeNull()
  })
})

describe('parseCellNumber', () => {
  it('reads German decimals, units and Excel numbers', () => {
    expect(parseCellNumber('32,5')).toBe(32.5)
    expect(parseCellNumber('32.5')).toBe(32.5)
    expect(parseCellNumber('160 kcal')).toBe(160)
    expect(parseCellNumber('12 g')).toBe(12)
    expect(parseCellNumber('1.200')).toBe(1200)
    expect(parseCellNumber(42)).toBe(42)
  })
  it('treats empty and dashes as missing and text as invalid', () => {
    expect(parseCellNumber('')).toBeNull()
    expect(parseCellNumber('-')).toBeNull()
    expect(parseCellNumber(null)).toBeNull()
    expect(parseCellNumber('viel')).toBeUndefined()
  })
})

describe('parseMealTable', () => {
  it('reads the downloadable template without errors', () => {
    const rows = parseCsv(toCsv(MEAL_TEMPLATE_ROWS))
    const result = parseMealTable(rows)
    expect(result.errors).toEqual([])
    expect(importErrors(result)).toEqual([])
    expect(result.items).toHaveLength(3)
    expect(result.items.map((i) => i.dayKey)).toEqual(['alle', 'training', 'ruhe'])
    expect(result.items[1]).toMatchObject({ mealSlot: 'vor_training', kcal: 420, proteinG: 35, carbsG: 55, fatG: 5, row: 3 })
    expect(result.items[1]?.notes).toContain('Carb-Loading')
  })

  it('detects synonyms and inherits empty day and meal cells', () => {
    const result = parseMealTable([
      ['Ernährungsplan Herbst'],
      ['Wochentag', 'Mahlzeit', 'Name', 'Kalorien', 'Protein', 'KH', 'Fett', 'Notiz'],
      ['Montag', 'Frühstück', 'Proteinshake', '160', '32', '3,5', '2', ''],
      ['', '', 'Banane', '105', '1,3', '27', '0,4', ''],
      ['', 'Abendessen', 'Nudeln', '600', '25', '100', '8', ''],
    ])
    expect(result.errors).toEqual([])
    expect(result.items.map((i) => [i.dayKey, i.mealSlot, i.name])).toEqual([
      ['mo', 'fruehstueck', 'Proteinshake'],
      ['mo', 'fruehstueck', 'Banane'],
      ['mo', 'abend', 'Nudeln'],
    ])
    expect(result.items[0]?.carbsG).toBe(3.5)
  })

  it('reports errors per row', () => {
    const result = parseMealTable([
      ['Tag', 'Mahlzeit', 'Lebensmittel', 'kcal'],
      ['Feiertag', 'Frühstück', 'Brot', '200'],
      ['Montag', 'Brunch', 'Ei', '80'],
      ['Montag', 'Mittag', 'Pizza', 'viel'],
      ['Montag', 'Mittag', 'Riesenportion', '9000'],
    ])
    expect(result.errors).toEqual([
      expect.stringContaining('Zeile 2: Tag "Feiertag"'),
      expect.stringContaining('Zeile 3: Mahlzeit "Brunch"'),
      expect.stringContaining('Zeile 4: Kalorien "viel"'),
      expect.stringContaining('Zeile 5: Kalorien muss zwischen 0 und 5000'),
    ])
  })

  it('needs a header with food and meal columns', () => {
    expect(parseMealTable([['a', 'b'], ['1', '2']]).errors[0]).toContain('Keine Kopfzeile')
    expect(parseMealTable([['Lebensmittel', 'kcal'], ['Brot', '200']]).errors).toEqual(['Spalte "Mahlzeit" fehlt.'])
  })

  it('warns about missing day column and skips dash rows', () => {
    const result = parseMealTable([
      ['Mahlzeit', 'Lebensmittel', 'kcal'],
      ['Mittag', '-', ''],
      ['Mittag', 'Salat', '150'],
    ])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.dayKey).toBe('alle')
    expect(result.warnings).toEqual([expect.stringContaining('Keine Spalte "Tag"'), expect.stringContaining('Zeile 2')])
  })

  it('reports an empty file', () => {
    expect(parseMealTable([['Mahlzeit', 'Lebensmittel']]).errors).toEqual(['Die Datei enthält keine Einträge.'])
  })
})
