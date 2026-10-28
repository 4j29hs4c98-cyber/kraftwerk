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
    expect(result.items).toHaveLength(7)
    expect(result.items.map((i) => i.dayKey)).toEqual(['alle', 'alle', 'alle', 'alle', 'alle', 'training', 'ruhe'])
    expect(result.items[5]).toMatchObject({ mealSlot: 'vor_training', kcal: 420, proteinG: 35, carbsG: 55, fatG: 5, row: 7, variant: null })
    expect(result.items[5]?.notes).toContain('Carb-Loading')
    expect(result.items.map((i) => i.variant)).toEqual([null, 'Hähnchen mit Reis', 'Hähnchen mit Reis', 'Lachs mit Kartoffeln', 'Lachs mit Kartoffeln', null, null])
  })

  it('detects the variant column under several names', () => {
    for (const header of ['Variante', 'Option', 'Gericht', 'Optionen']) {
      const result = parseMealTable([
        ['Mahlzeit', header, 'Lebensmittel', 'kcal'],
        ['Mittag', 'Pasta', 'Nudeln', '400'],
      ])
      expect(result.errors).toEqual([])
      expect(result.items[0]).toMatchObject({ name: 'Nudeln', variant: 'Pasta' })
    }
  })

  it('treats "Gericht" as the name when there is no food column', () => {
    const result = parseMealTable([
      ['Mahlzeit', 'Gericht', 'kcal'],
      ['Mittag', 'Pasta', '400'],
    ])
    expect(result.items[0]).toMatchObject({ name: 'Pasta', variant: null })
  })

  it('inherits empty variant cells within the same meal, "-" clears them', () => {
    const result = parseMealTable([
      ['Tag', 'Mahlzeit', 'Variante', 'Lebensmittel'],
      ['Montag', 'Mittag', 'Pasta', 'Nudeln'],
      ['', '', '', 'Tomatensoße'],
      ['', '', 'Bowl', 'Reis'],
      ['', '', '-', 'Salat'],
      ['', 'Abend', '', 'Brot'],
      ['Dienstag', 'Mittag', '', 'Suppe'],
    ])
    expect(result.errors).toEqual([])
    expect(result.items.map((i) => [i.name, i.variant])).toEqual([
      ['Nudeln', 'Pasta'],
      ['Tomatensoße', 'Pasta'],
      ['Reis', 'Bowl'],
      ['Salat', null],
      ['Brot', null],
      ['Suppe', null],
    ])
  })

  it('rejects variant names longer than 60 characters', () => {
    const result = parseMealTable([
      ['Mahlzeit', 'Variante', 'Lebensmittel'],
      ['Mittag', 'x'.repeat(61), 'Reis'],
    ])
    expect(result.errors[0]).toContain('Zeile 2: Variante')
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
