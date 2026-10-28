import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'
import { matchExercise } from './matchExercise'
import { parsePlanTable, parseReps, parseRest, parseStartWeight, toImportedPlan, translateFocus, type TableRow } from './parsePlanTable'
import { TEMPLATE_ROWS } from './template'

const HEADER = ['Wochentag', 'Fokus', 'Übung', 'Sätze', 'Wiederholungen', 'Dein aktuelles Gewicht', 'Hinweise & App-Notiz']
const row = (line: string): string[] => line.split(' | ')

const EXAMPLES = [
  'Montag | Upper | Latzug (Obergriff) | 3 | 8-10 | 70-75 kg | Starker Fokus auf den Lat',
  'Mittwoch | Pause | - | - | - | - | Regeneration',
  'Samstag | Legs | Ausfallschritte (KH oder Multipresse) | 3 | 12 (pro Bein) | Leicht | Balance',
  'Dienstag | Lower | Beinheben (hängend oder am Holm) | 3 | Max | - | Core',
].map(row)

describe('parsePlanTable with the example rows', () => {
  const result = parsePlanTable([HEADER, ...EXAMPLES])

  it('has no errors, keeps the rest day and orders the days Monday to Sunday', () => {
    expect(result.errors).toEqual([])
    expect(result.days.map((d) => [d.weekday, d.title, d.isRest])).toEqual([
      [0, 'Oberkörper', false],
      [1, 'Unterkörper', false],
      [2, 'Ruhetag', true],
      [5, 'Beine', false],
    ])
  })

  it('maps "Latzug (Obergriff)" to the library, keeps the name and takes the weight as start weight and note', () => {
    const [latzug] = result.days[0]!.exercises
    expect(latzug).toMatchObject({
      exerciseKey: 'latzug',
      isCustom: false,
      displayName: 'Latzug (Obergriff)',
      sets: 3,
      repMin: 8,
      repMax: 10,
      restSeconds: 120,
      startWeightKg: 70,
      notes: 'Starker Fokus auf den Lat · Gewicht: 70-75 kg',
      row: 2,
    })
  })

  it('reads "12 (pro Bein)" as 12 reps and keeps the remark', () => {
    const [lunges] = result.days[3]!.exercises
    expect(lunges).toMatchObject({ exerciseKey: 'ausfallschritte', repMin: 12, repMax: 12, startWeightKg: null })
    expect(lunges?.notes).toBe('Balance · Gewicht: Leicht · Wdh.: 12 (pro Bein)')
  })

  it('reads "Max" as 6-15 with a note', () => {
    const [legRaise] = result.days[1]!.exercises
    expect(legRaise).toMatchObject({ exerciseKey: 'beinheben_haengend', repMin: 6, repMax: 15, restSeconds: 60 })
    expect(legRaise?.notes).toBe('Core · Bis zum Muskelversagen (Max)')
  })

  it('builds a valid plan for create_plan', () => {
    const { plan, errors } = toImportedPlan(result, 'UL PPL')
    expect(errors).toEqual([])
    expect(plan.days).toHaveLength(4)
    expect(plan.days[2]).toMatchObject({ weekday: 2, isRest: true, exercises: [] })
    expect(plan.split).toBe('import')
  })
})

describe('weekdays and rest days', () => {
  const week: TableRow[] = [
    HEADER,
    ['Mo', 'Upper', 'Latzug (Obergriff)', 3, '8-10', '70 kg', ''],
    ['', 'Upper', 'Bankdrücken', 3, '8-10', '', ''],
    ['Di', 'Lower', 'Kniebeuge', 3, '6-8', '', ''],
    ['Mi', 'Pause', '-', '-', '-', '-', 'Regeneration'],
    ['Do', 'Push', 'Schulterdrücken', 3, '8-10', '', ''],
    ['Fr', 'Pull', 'Rudern', 3, '8-10', '', ''],
    ['Sa', 'Legs', 'Beinpresse', 3, '10-12', '', ''],
    ['So', 'Ruhetag', '', '', '', '', ''],
  ]

  it("reads Lennox' week as 7 days with 2 rest days", () => {
    const result = parsePlanTable(week)
    expect(result.errors).toEqual([])
    expect(result.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(result.days.map((d) => d.title)).toEqual(['Oberkörper', 'Unterkörper', 'Ruhetag', 'Push', 'Pull', 'Beine', 'Ruhetag'])
    expect(result.days.filter((d) => d.isRest)).toHaveLength(2)
    expect(result.days[0]!.exercises).toHaveLength(2)
    const { plan, errors } = toImportedPlan(result, 'Woche')
    expect(errors).toEqual([])
    expect(plan.days.filter((d) => d.isRest).every((d) => d.exercises.length === 0)).toBe(true)
  })

  it('maps long and short weekday names to the same day', () => {
    const result = parsePlanTable([
      ['Wochentag', 'Übung', 'Sätze', 'Wdh'],
      ['Montag', 'Kniebeuge', 3, '5'],
      ['Mo', 'Beinpresse', 3, '10'],
      ['Sonntag', 'Rudern', 3, '10'],
    ])
    expect(result.days.map((d) => [d.weekday, d.exercises.length])).toEqual([[0, 2], [6, 1]])
  })

  it('without weekdays ("Tag 1") keeps the old behaviour and skips rest rows', () => {
    const result = parsePlanTable([
      ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wdh'],
      ['Tag 1', 'Push', 'Bankdrücken', 3, '8'],
      ['Tag 2', 'Pause', '-', '-', '-'],
      ['Tag 3', 'Pull', 'Rudern', 3, '8'],
    ])
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.days.map((d) => [d.title, d.weekday, d.isRest])).toEqual([['Push', null, false], ['Pull', null, false]])
  })

  it('falls back to no weekdays with a hint when the day column is mixed', () => {
    const result = parsePlanTable([
      ['Tag', 'Übung', 'Sätze', 'Wdh'],
      ['Montag', 'Kniebeuge', 3, '5'],
      ['Tag 2', 'Rudern', 3, '10'],
      ['Mittwoch', '-', '', ''],
    ])
    expect(result.days.map((d) => d.weekday)).toEqual([null, null])
    expect(result.days.some((d) => d.isRest)).toBe(false)
    expect(result.warnings[0]).toMatch(/Nicht alle Einträge/)
  })

  it('treats a weekday with exercises as a training day even after a pause row', () => {
    const result = parsePlanTable([
      ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wdh'],
      ['Mi', 'Pause', '-', '', ''],
      ['Mi', 'Core', 'Plank', 3, '30'],
    ])
    expect(result.days).toHaveLength(1)
    expect(result.days[0]).toMatchObject({ weekday: 2, isRest: false, title: 'Core' })
  })

  it('needs at least one training day', () => {
    const result = parsePlanTable([
      ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wdh'],
      ['Mo', 'Pause', '-', '', ''],
    ])
    expect(result.errors).toContain('Die Datei enthält keine Übungen.')
  })
})

describe('grouping and titles', () => {
  it('groups by day in order of appearance and inherits empty day cells', () => {
    const rows: TableRow[] = [
      ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wdh'],
      ['Montag', 'Push', 'Bankdrücken', 3, '8-10'],
      ['', 'Push', 'Seitheben', 3, '12-15'],
      ['Donnerstag', 'Push', 'Liegestütze', 3, '10'],
      ['Montag', 'Push', 'Dips', 3, '8'],
    ]
    const result = parsePlanTable(rows)
    expect(result.errors).toEqual([])
    expect(result.days.map((d) => d.title)).toEqual(['Push A', 'Push B'])
    expect(result.days[0]!.exercises.map((e) => e.exerciseKey)).toEqual(['bankdruecken_lh', 'seitheben_kh', 'custom:dips'])
  })

  it('translates focus names', () => {
    expect(translateFocus('upper')).toBe('Oberkörper')
    expect(translateFocus('LOWER')).toBe('Unterkörper')
    expect(translateFocus('Legs')).toBe('Beine')
    expect(translateFocus('Pull')).toBe('Pull')
    expect(translateFocus('Arme')).toBe('Arme')
  })

  it('makes a repeated library exercise on the same day a custom one', () => {
    const result = parsePlanTable([
      ['Tag', 'Übung', 'Sätze', 'Wiederholungen'],
      ['Mo', 'Latzug (Obergriff)', 3, '8-10'],
      ['Mo', 'Latzug (Enger Griff)', 3, '10-12'],
    ])
    expect(result.days[0]!.exercises.map((e) => e.exerciseKey)).toEqual(['latzug', 'custom:latzug_enger_griff'])
    expect(result.warnings).toHaveLength(1)
  })
})

describe('validation', () => {
  it('reports clear per-row errors', () => {
    const result = parsePlanTable([
      ['Tag', 'Übung', 'Sätze', 'Wiederholungen', 'Pause'],
      ['Mo', 'Kniebeuge', 'drei', '8-10', ''],
      ['Mo', 'Beinpresse', 3, 'viele', ''],
      ['Mo', 'Beinstrecker', 30, '10', ''],
      ['Mo', 'x'.repeat(81), 3, '10', ''],
      ['Mo', 'Wadenheben', 3, '10', 'lang'],
    ])
    expect(result.errors).toEqual([
      'Zeile 2: Sätze "drei" sind keine Zahl.',
      'Zeile 3: Wiederholungen "viele" nicht erkannt (Beispiele: 8-10, 12, Max).',
      'Zeile 4: Sätze müssen zwischen 1 und 20 liegen.',
      'Zeile 5: Der Übungsname ist länger als 80 Zeichen.',
      'Zeile 6: Pause "lang" nicht erkannt (Sekunden, z. B. 90).',
    ])
  })

  it('rejects more than 7 days and more than 15 exercises per day', () => {
    const days = Array.from({ length: 8 }, (_, i) => [`Tag${i}`, 'Kniebeuge', 3, '10'])
    expect(parsePlanTable([['Tag', 'Übung', 'Sätze', 'Wdh'], ...days]).errors).toContain('Die Datei enthält 8 Trainingstage, erlaubt sind höchstens 7.')
    const many = Array.from({ length: 16 }, (_, i) => ['Mo', `Übung ${i}`, 3, '10'])
    expect(parsePlanTable([['Tag', 'Übung', 'Sätze', 'Wdh'], ...many]).errors).toContain('Tag "Mo" hat 16 Übungen, erlaubt sind höchstens 15.')
  })

  it('needs a header with an exercise column', () => {
    expect(parsePlanTable([['a', 'b'], ['c', 'd']]).errors[0]).toMatch(/Keine Kopfzeile/)
  })

  it('uses the rest column and defaults to 90 s for custom exercises', () => {
    const result = parsePlanTable([
      ['Übung', 'Sätze', 'Wiederholungen', 'Pause (s)'],
      ['Kniebeuge', 3, '5', '180'],
      ['Schräge Brustpresse', 3, '10-12', ''],
      ['Beinpresse', 3, '10', '2 min'],
    ])
    expect(result.days[0]!.exercises.map((e) => e.restSeconds)).toEqual([180, 90, 120])
  })
})

describe('field parsers', () => {
  it('parseReps', () => {
    expect(parseReps('8-10')).toEqual({ repMin: 8, repMax: 10, note: null })
    expect(parseReps('15')).toEqual({ repMin: 15, repMax: 15, note: null })
    expect(parseReps('Versagen')).toEqual({ repMin: 6, repMax: 15, note: 'Bis zum Muskelversagen (Versagen)' })
    expect(parseReps('Max / 5-8')).toMatchObject({ repMin: 5, repMax: 8 })
    expect(parseReps('Max (Ziel 5+)')).toMatchObject({ repMin: 5, repMax: 15 })
    expect(parseReps('-')).toBeNull()
  })

  it('parseStartWeight', () => {
    expect(parseStartWeight('70-75 kg')).toBe(70)
    expect(parseStartWeight('10 kg/Seite')).toBe(10)
    expect(parseStartWeight('22,5 kg')).toBe(22.5)
    expect(parseStartWeight('Moderat')).toBeNull()
  })

  it('parseRest', () => {
    expect(parseRest('90')).toBe(90)
    expect(parseRest('1:30')).toBe(90)
    expect(parseRest('2 min')).toBe(120)
    expect(parseRest('')).toBeNull()
  })

  it('matchExercise maps synonyms and leaves combinations custom', () => {
    expect(matchExercise('Trizeps-Pushdown (Feste Stange)')).toEqual({ key: 'trizepsdruecken_kabel', isCustom: false })
    expect(matchExercise('Rumänisches Kreuzheben (KH oder Langhantel)').key).toBe('rumaenisches_kh')
    expect(matchExercise('Trizeps-Pushdown (Kabel/Seil)').key).toBe('trizepsdruecken_kabel')
    expect(matchExercise('Planks / Crunches')).toEqual({ key: 'custom:planks_crunches', isCustom: true })
  })
})

describe('csv', () => {
  it('parses semicolon CSV with quotes, BOM and CRLF', () => {
    expect(parseCsv('﻿Tag;Übung\r\nMo;"Rudern; eng"\r\nDi;"Sag ""hallo"""\r\n')).toEqual([
      ['Tag', 'Übung'],
      ['Mo', 'Rudern; eng'],
      ['Di', 'Sag "hallo"'],
    ])
  })

  it('detects comma CSV', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('the download template round-trips through the parser without errors', () => {
    const result = parsePlanTable(parseCsv(toCsv(TEMPLATE_ROWS)))
    expect(result.errors).toEqual([])
    expect(result.days.flatMap((d) => d.exercises)).toHaveLength(2)
  })
})
