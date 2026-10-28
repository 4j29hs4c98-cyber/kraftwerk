import { normalizeName } from '../../plan/exercises'
import { cellText, type Cell, type TableRow } from '../../plan/import/parsePlanTable'
import { MEAL_LIMITS, validateMealItems, type DayKey, type MealItem, type MealSlot } from './model'

type Column = 'day' | 'slot' | 'name' | 'variant' | 'amount' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'notes'

export interface ImportedMealItem extends MealItem {
  /** Zeilennummer in der Datei (1-basiert, wie in Excel). */
  readonly row: number
}

export interface MealImportResult {
  readonly items: readonly ImportedMealItem[]
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

const HEADER_SCAN_ROWS = 10

const HEADER_RULES: readonly (readonly [Column, (h: string) => boolean])[] = [
  ['name', (h) => h.startsWith('lebensmittel') || ['name', 'essen', 'food', 'speise', 'produkt', 'zutat', 'zutaten', 'mahlzeit name'].includes(h)],
  ['variant', (h) => h.startsWith('variante') || h.startsWith('option') || ['gericht', 'gerichtname', 'alternative', 'variant'].includes(h)],
  ['slot', (h) => h.startsWith('mahlzeit') || ['slot', 'meal', 'zeitpunkt', 'uhrzeit'].includes(h)],
  ['day', (h) => ['tag', 'tage', 'wochentag', 'day', 'gilt fuer', 'gueltig', 'gueltig an'].includes(h)],
  ['amount', (h) => h.startsWith('menge') || ['portion', 'amount', 'portionsgroesse'].includes(h)],
  ['kcal', (h) => h.includes('kcal') || h.startsWith('kalorie') || h.startsWith('energie') || h === 'calories'],
  ['protein', (h) => h.startsWith('eiweiss') || h.startsWith('protein')],
  ['carbs', (h) => h.startsWith('kohlenhydrat') || h.startsWith('carb') || h === 'kh' || h.startsWith('kh ')],
  ['fat', (h) => h.startsWith('fett') || h === 'fat' || h.startsWith('fat ')],
  ['notes', (h) => h.includes('hinweis') || h.includes('notiz') || ['notes', 'note', 'bemerkung', 'bemerkungen', 'kommentar'].includes(h)],
]

function detectColumns(row: TableRow): Partial<Record<Column, number>> {
  const cols = row.reduce<Partial<Record<Column, number>>>((found, cell, index) => {
    const h = normalizeName(cellText(cell))
    const match = HEADER_RULES.find(([col, test]) => found[col] === undefined && h !== '' && test(h))
    return match ? { ...found, [match[0]]: index } : found
  }, {})
  // Ohne eigene Spalte "Lebensmittel" ist "Gericht" der Name (ältere Vorlagen), keine Variante.
  const variantHeader = cols.variant === undefined ? '' : normalizeName(cellText(row[cols.variant]))
  if (cols.name === undefined && variantHeader === 'gericht') return { ...cols, name: cols.variant, variant: undefined }
  return cols
}

const DAY_WORDS: Readonly<Record<string, DayKey>> = {
  mo: 'mo', montag: 'mo', monday: 'mo',
  di: 'di', dienstag: 'di', tuesday: 'di',
  mi: 'mi', mittwoch: 'mi', wednesday: 'mi',
  do: 'do', donnerstag: 'do', thursday: 'do',
  fr: 'fr', freitag: 'fr', friday: 'fr',
  sa: 'sa', samstag: 'sa', sonnabend: 'sa', saturday: 'sa',
  so: 'so', sonntag: 'so', sunday: 'so',
  training: 'training', trainingstag: 'training', trainingstage: 'training', 'an trainingstagen': 'training', 'training day': 'training',
  ruhe: 'ruhe', ruhetag: 'ruhe', ruhetage: 'ruhe', 'an ruhetagen': 'ruhe', pause: 'ruhe', trainingsfrei: 'ruhe', rest: 'ruhe', 'rest day': 'ruhe',
  alle: 'alle', 'alle tage': 'alle', taeglich: 'alle', 'jeden tag': 'alle', immer: 'alle', daily: 'alle', 'every day': 'alle',
}

/** "Montag", "Mo", "Trainingstag", "Ruhetag", "Täglich", "Alle" in einen Tag-Schlüssel. */
export function parseDayKey(raw: string): DayKey | null {
  return DAY_WORDS[normalizeName(raw)] ?? null
}

/** "Frühstück", "Snack vormittags", "Mittagessen", "Vor dem Training", "Spätmahlzeit" ... in eine Mahlzeit. */
export function parseMealSlot(raw: string): MealSlot | null {
  const h = normalizeName(raw)
  if (!h) return null
  if (h.includes('training') || h.includes('workout')) {
    if (/\b(vor|pre|vorher)\b/.test(h)) return 'vor_training'
    if (/\b(nach|post|danach)\b/.test(h)) return 'nach_training'
    return null
  }
  if (h.startsWith('fruehstueck') || h === 'breakfast' || h === 'morgens') return 'fruehstueck'
  if (h.includes('vormittag')) return 'snack_vormittag'
  if (h.includes('nachmittag')) return 'snack_nachmittag'
  if (h.startsWith('mittag') || h === 'lunch') return 'mittag'
  if (h.startsWith('abend') || h === 'dinner') return 'abend'
  if (h.startsWith('spaet') || h.includes('schlafen') || h.startsWith('nacht') || h === 'late') return 'spaet'
  return null
}

const isDash = (value: string): boolean => /^[-–—]*$/.test(value)

/**
 * Liest Zahlen aus Zellen: Excel-Zahl, "32,5", "32.5", "160 kcal", "12 g", "1.200" (Tausenderpunkt).
 * Leer oder Strich ergibt null (kein Wert), alles andere Unlesbare undefined (Fehler).
 */
export function parseCellNumber(cell: Cell): number | null | undefined {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined
  const text = cellText(cell).toLowerCase().replace(/\s*(kcal|kj|g|gramm)\s*$/, '').trim()
  if (isDash(text)) return null
  if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ''))
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return undefined
  return Number(text.replace(',', '.'))
}

const get = (row: TableRow, index: number | undefined): string => (index === undefined ? '' : cellText(row[index]))
const cellAt = (row: TableRow, index: number | undefined): Cell => (index === undefined ? null : row[index])

interface RowState {
  readonly day: DayKey | null
  readonly slot: MealSlot | null
  readonly variant: string | null
}

function readNumber(row: TableRow, index: number | undefined, label: string, max: number, at: string, errors: string[]): number | null {
  const value = parseCellNumber(cellAt(row, index))
  if (value === undefined) {
    errors.push(`${at}: ${label} "${get(row, index)}" ist keine Zahl.`)
    return null
  }
  if (value !== null && (value < 0 || value > max)) errors.push(`${at}: ${label} muss zwischen 0 und ${max} liegen.`)
  return value
}

function parseRow(row: TableRow, cols: Partial<Record<Column, number>>, rowNumber: number, state: RowState, errors: string[]): { item: ImportedMealItem | null; state: RowState } {
  const at = `Zeile ${rowNumber}`
  const rowErrors: string[] = []
  const dayText = get(row, cols.day)
  const slotText = get(row, cols.slot)
  const day = dayText ? parseDayKey(dayText) : state.day ?? 'alle'
  // Neuer Tag ohne Mahlzeit erbt die Mahlzeit nicht vom vorherigen Tag.
  const slot = slotText ? parseMealSlot(slotText) : dayText ? null : state.slot
  if (dayText && !day) rowErrors.push(`${at}: Tag "${dayText}" nicht erkannt (Montag bis Sonntag, Trainingstag, Ruhetag oder Täglich).`)
  if (slotText && !slot) rowErrors.push(`${at}: Mahlzeit "${slotText}" nicht erkannt (z. B. Frühstück, Mittagessen, Vor dem Training).`)
  if (!slotText && !slot) rowErrors.push(`${at}: Mahlzeit fehlt.`)
  // Leere Varianten-Zelle gehört zur Zeile darüber, solange Tag und Mahlzeit weiterlaufen; "-" heißt "keine Variante".
  const variantText = get(row, cols.variant)
  const variant = isDash(variantText) ? (variantText === '' && !dayText && !slotText ? state.variant : null) : variantText
  if ((variant?.length ?? 0) > MEAL_LIMITS.variantMax) rowErrors.push(`${at}: Variante ist länger als ${MEAL_LIMITS.variantMax} Zeichen.`)

  const name = get(row, cols.name)
  if (name.length > MEAL_LIMITS.nameMax) rowErrors.push(`${at}: Name ist länger als ${MEAL_LIMITS.nameMax} Zeichen.`)
  const amountText = get(row, cols.amount)
  const amount = isDash(amountText) ? null : amountText
  if ((amount?.length ?? 0) > MEAL_LIMITS.amountMax) rowErrors.push(`${at}: Menge ist länger als ${MEAL_LIMITS.amountMax} Zeichen.`)
  const notesText = get(row, cols.notes)
  const notes = isDash(notesText) ? null : notesText
  if ((notes?.length ?? 0) > MEAL_LIMITS.notesMax) rowErrors.push(`${at}: Hinweis ist länger als ${MEAL_LIMITS.notesMax} Zeichen.`)

  const kcal = readNumber(row, cols.kcal, 'Kalorien', MEAL_LIMITS.kcalMax, at, rowErrors)
  const proteinG = readNumber(row, cols.protein, 'Eiweiß', MEAL_LIMITS.macroMax, at, rowErrors)
  const carbsG = readNumber(row, cols.carbs, 'Kohlenhydrate', MEAL_LIMITS.macroMax, at, rowErrors)
  const fatG = readNumber(row, cols.fat, 'Fett', MEAL_LIMITS.macroMax, at, rowErrors)

  const nextState: RowState = { day: day ?? state.day, slot: slot ?? state.slot, variant }
  if (rowErrors.length > 0 || !day || !slot) {
    errors.push(...rowErrors)
    return { item: null, state: nextState }
  }
  const item: ImportedMealItem = {
    row: rowNumber,
    dayKey: day,
    mealSlot: slot,
    name,
    amount,
    kcal: kcal === null ? null : Math.round(kcal),
    proteinG,
    carbsG,
    fatG,
    notes,
    variant,
  }
  return { item, state: nextState }
}

/**
 * Liest eine Tabelle mit einer Zeile pro Lebensmittel. Die Kopfzeile wird in den ersten
 * Zeilen gesucht und tolerant erkannt. Leere Tag- oder Mahlzeit-Zellen gehören zur Zeile darüber.
 */
export function parseMealTable(rows: readonly TableRow[]): MealImportResult {
  const headerIndex = rows.slice(0, HEADER_SCAN_ROWS).findIndex((r) => detectColumns(r).name !== undefined)
  if (headerIndex < 0) {
    return { items: [], errors: ['Keine Kopfzeile gefunden. Es braucht mindestens die Spalten "Lebensmittel" und "Mahlzeit".'], warnings: [] }
  }
  const cols = detectColumns(rows[headerIndex] ?? [])
  const errors: string[] = []
  const warnings: string[] = []
  if (cols.slot === undefined) return { items: [], errors: ['Spalte "Mahlzeit" fehlt.'], warnings }
  if (cols.day === undefined) warnings.push('Keine Spalte "Tag": alle Einträge gelten täglich.')
  if (cols.kcal === undefined) warnings.push('Keine Spalte "kcal": Kalorien bleiben leer.')

  const items: ImportedMealItem[] = []
  let state: RowState = { day: null, slot: null, variant: null }
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2
    if (row.every((c) => cellText(c) === '')) return
    const name = get(row, cols.name)
    if (isDash(name)) {
      warnings.push(`Zeile ${rowNumber}: Kein Lebensmittel angegeben, Zeile übersprungen.`)
      return
    }
    const parsed = parseRow(row, cols, rowNumber, state, errors)
    state = parsed.state
    if (parsed.item) items.push(parsed.item)
  })

  if (items.length === 0 && errors.length === 0) errors.push('Die Datei enthält keine Einträge.')
  if (items.length > MEAL_LIMITS.maxItems) errors.push(`Die Datei enthält ${items.length} Einträge, erlaubt sind höchstens ${MEAL_LIMITS.maxItems}.`)
  return { items, errors, warnings }
}

/** Fehlerliste für die Übernahme: Zeilenfehler und die vollständige Prüfung der Liste. */
export function importErrors(result: MealImportResult): readonly string[] {
  return result.errors.length > 0 ? result.errors : validateMealItems(result.items)
}
