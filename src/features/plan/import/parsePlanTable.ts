import { normalizeName, defaultRestSeconds, getExercise, customKey } from '../exercises'
import { PLAN_LIMITS, validatePlan, type NewPlan, type NewPlanExercise } from '../planModel'
import { parseWeekday, REST_DAY_TITLE } from '../weekdays'
import { matchExercise } from './matchExercise'

/** Eine Zelle, wie sie aus CSV (Text) oder Excel (Text, Zahl, Datum, Wahrheitswert) kommt. */
export type Cell = string | number | boolean | Date | null | undefined
export type TableRow = readonly Cell[]

type Column = 'day' | 'focus' | 'exercise' | 'sets' | 'reps' | 'weight' | 'notes' | 'rest'

export interface ImportedExercise extends NewPlanExercise {
  /** Zeilennummer in der Datei (1-basiert, wie in Excel). */
  readonly row: number
  readonly sourceName: string
  readonly isCustom: boolean
}

export interface ImportedDay {
  readonly title: string
  readonly exercises: readonly ImportedExercise[]
  /** 0 = Montag bis 6 = Sonntag, nur wenn die Tag-Spalte durchgehend Wochentage enthält. */
  readonly weekday: number | null
  readonly isRest: boolean
}

export interface ImportResult {
  readonly days: readonly ImportedDay[]
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

const HEADER_SCAN_ROWS = 10
const MAX_DEFAULT = { min: 6, max: 15 } as const
const DEFAULT_SETS = 3
export const IMPORT_SPLIT = 'import'

const HEADER_RULES: readonly (readonly [Column, (h: string) => boolean])[] = [
  ['exercise', (h) => h.startsWith('uebung') || ['exercise', 'exercises', 'name'].includes(h)],
  ['day', (h) => ['tag', 'wochentag', 'day', 'trainingstag', 'weekday'].includes(h)],
  ['focus', (h) => ['fokus', 'titel', 'focus', 'schwerpunkt', 'split', 'einheit', 'muskelgruppe', 'title'].includes(h)],
  ['sets', (h) => h.startsWith('saetze') || ['satz', 'sets', 'satzanzahl'].includes(h)],
  ['reps', (h) => h.startsWith('wiederholung') || ['wdh', 'reps', 'rep', 'repetitions'].includes(h)],
  ['weight', (h) => h.includes('gewicht') || ['weight', 'kg', 'last'].includes(h)],
  ['notes', (h) => h.includes('hinweis') || h.includes('notiz') || ['notes', 'note', 'bemerkung', 'bemerkungen', 'kommentar'].includes(h)],
  ['rest', (h) => h.startsWith('pause') || ['rest', 'satzpause', 'ruhe'].includes(h)],
]

export function cellText(cell: Cell): string {
  if (cell === null || cell === undefined || typeof cell === 'boolean') return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell).trim()
}

function detectColumns(row: TableRow): Partial<Record<Column, number>> {
  return row.reduce<Partial<Record<Column, number>>>((cols, cell, index) => {
    const h = normalizeName(cellText(cell))
    const match = HEADER_RULES.find(([col, test]) => cols[col] === undefined && h !== '' && test(h))
    return match ? { ...cols, [match[0]]: index } : cols
  }, {})
}

const isDash = (value: string): boolean => /^[-–—]*$/.test(value)
const MAX_PATTERN = /max|versagen|ausbelastung|amrap/

export interface ParsedReps {
  readonly repMin: number
  readonly repMax: number
  /** Hinweis, wenn die Angabe mehr enthielt als eine Zahl oder einen Bereich. */
  readonly note: string | null
}

/** "8-10", "12", "12 (pro Bein)", "Max", "Max / 5-8", "Versagen" in einen Bereich. */
export function parseReps(raw: string): ParsedReps | null {
  const text = raw.trim()
  if (isDash(text)) return null
  const lower = normalizeName(text)
  const isMax = MAX_PATTERN.test(lower)
  const range = text.match(/(\d+)\s*(?:-|–|bis)\s*(\d+)/)
  const single = text.match(/\d+/)
  const plain = /^\d+(?:\s*(?:-|–|bis)\s*\d+)?$/.test(text)
  const note = isMax ? `Bis zum Muskelversagen (${text})` : plain ? null : `Wdh.: ${text}`

  if (range?.[1] && range[2]) {
    const a = Number(range[1])
    const b = Number(range[2])
    return { repMin: Math.min(a, b), repMax: Math.max(a, b), note }
  }
  if (single) {
    const n = Number(single[0])
    return { repMin: n, repMax: isMax ? Math.max(n, MAX_DEFAULT.max) : n, note }
  }
  if (isMax) return { repMin: MAX_DEFAULT.min, repMax: MAX_DEFAULT.max, note }
  return null
}

/** Erste Zahl im Gewichtsfeld als Startgewicht: "70-75 kg" -> 70, "10 kg/Seite" -> 10, "Leicht" -> null. */
export function parseStartWeight(raw: string): number | null {
  const match = raw.match(/\d+(?:[.,]\d+)?/)
  if (!match) return null
  const n = Number(match[0].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "90", "90 s", "2 min", "1:30" in Sekunden. */
export function parseRest(raw: string): number | null {
  const text = raw.trim().toLowerCase()
  if (isDash(text)) return null
  const clock = text.match(/^(\d+):(\d{2})$/)
  if (clock?.[1] && clock[2]) return Number(clock[1]) * 60 + Number(clock[2])
  const n = text.match(/\d+(?:[.,]\d+)?/)
  if (!n) return null
  const value = Number(n[0].replace(',', '.'))
  return Math.round(/min/.test(text) ? value * 60 : value)
}

const FOCUS_TITLES: Readonly<Record<string, string>> = {
  upper: 'Oberkörper',
  'upper body': 'Oberkörper',
  oberkoerper: 'Oberkörper',
  lower: 'Unterkörper',
  'lower body': 'Unterkörper',
  unterkoerper: 'Unterkörper',
  legs: 'Beine',
  leg: 'Beine',
  beine: 'Beine',
  push: 'Push',
  pull: 'Pull',
  'full body': 'Ganzkörper',
  fullbody: 'Ganzkörper',
  ganzkoerper: 'Ganzkörper',
}

export function translateFocus(focus: string): string {
  return FOCUS_TITLES[normalizeName(focus)] ?? focus.trim()
}

const isRestDay = (focus: string): boolean => ['pause', 'ruhetag', 'rest', 'rest day', 'frei'].includes(normalizeName(focus))

/** Gleiche Titel bekommen A, B, C ... angehängt. */
function disambiguateTitles(titles: readonly string[]): string[] {
  const totals = titles.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())
  const seen = new Map<string, number>()
  return titles.map((t) => {
    if ((totals.get(t) ?? 0) < 2) return t
    const n = seen.get(t) ?? 0
    seen.set(t, n + 1)
    return `${t} ${String.fromCharCode(65 + n)}`
  })
}

interface Group {
  readonly key: string
  readonly weekday: number | null
  /** Fokus der ersten Übungszeile (bei reinen Ruhetagen der Tag-Text). */
  focus: string
  /** Eine Pause-Zeile hat den Tag als Ruhetag markiert. */
  restMarked: boolean
  readonly exercises: ImportedExercise[]
}

/**
 * Wochentag-Modus: Die Tag-Spalte enthält ausschließlich Wochentage (Montag, Mo ...).
 * Dann werden Pause-Zeilen zu Ruhetagen. Sonst (z. B. "Tag 1") wie bisher ohne Wochentag.
 */
function detectWeekdayMode(dataRows: readonly TableRow[], dayCol: number | undefined, warnings: string[]): boolean {
  if (dayCol === undefined) return false
  const texts = dataRows.map((r) => cellText(r[dayCol])).filter((t) => t !== '')
  const known = texts.filter((t) => parseWeekday(t) !== null).length
  if (known > 0 && known < texts.length) warnings.push('Nicht alle Einträge in der Tag-Spalte sind Wochentage. Der Plan wird ohne feste Wochentage übernommen, Pausen werden übersprungen.')
  return texts.length > 0 && known === texts.length
}

interface RowContext {
  readonly cols: Partial<Record<Column, number>>
  readonly rowNumber: number
  readonly errors: string[]
  readonly warnings: string[]
}

const get = (row: TableRow, index: number | undefined): string => (index === undefined ? '' : cellText(row[index]))

function parseExerciseRow(row: TableRow, ctx: RowContext, name: string, taken: ReadonlySet<string>): ImportedExercise | null {
  const at = `Zeile ${ctx.rowNumber}`
  const rowErrors: string[] = []
  if (name.length > PLAN_LIMITS.displayNameMax) rowErrors.push(`${at}: Der Übungsname ist länger als ${PLAN_LIMITS.displayNameMax} Zeichen.`)

  const setsText = get(row, ctx.cols.sets)
  const setsMatch = setsText.match(/\d+/)
  let sets = DEFAULT_SETS
  if (setsMatch) sets = Number(setsMatch[0])
  else if (isDash(setsText)) ctx.warnings.push(`${at}: Keine Satzzahl angegeben, ${DEFAULT_SETS} Sätze übernommen.`)
  else rowErrors.push(`${at}: Sätze "${setsText}" sind keine Zahl.`)
  if (setsMatch && (sets < PLAN_LIMITS.sets.min || sets > PLAN_LIMITS.sets.max)) rowErrors.push(`${at}: Sätze müssen zwischen 1 und ${PLAN_LIMITS.sets.max} liegen.`)

  const repsText = get(row, ctx.cols.reps)
  const reps = parseReps(repsText)
  if (!reps) rowErrors.push(`${at}: Wiederholungen "${repsText}" nicht erkannt (Beispiele: 8-10, 12, Max).`)
  else if (reps.repMin < PLAN_LIMITS.reps.min || reps.repMax > PLAN_LIMITS.reps.max) rowErrors.push(`${at}: Wiederholungen müssen zwischen 1 und ${PLAN_LIMITS.reps.max} liegen.`)

  const weightText = get(row, ctx.cols.weight)
  const hasWeight = !isDash(weightText)
  let startWeightKg = hasWeight ? parseStartWeight(weightText) : null
  if (startWeightKg !== null && startWeightKg > PLAN_LIMITS.startWeightKg.max) {
    ctx.warnings.push(`${at}: Gewicht über ${PLAN_LIMITS.startWeightKg.max} kg wird nur als Hinweis übernommen.`)
    startWeightKg = null
  }

  const restText = get(row, ctx.cols.rest)
  const rest = parseRest(restText)
  if (!isDash(restText) && rest === null) rowErrors.push(`${at}: Pause "${restText}" nicht erkannt (Sekunden, z. B. 90).`)
  if (rest !== null && rest > PLAN_LIMITS.rest.max) rowErrors.push(`${at}: Die Pause darf höchstens ${PLAN_LIMITS.rest.max} Sekunden lang sein.`)

  const hint = get(row, ctx.cols.notes)
  const notes = [isDash(hint) ? '' : hint, hasWeight ? `Gewicht: ${weightText}` : '', reps?.note ?? ''].filter(Boolean).join(' · ')
  if (notes.length > PLAN_LIMITS.notesMax) {
    rowErrors.push(`${at}: Hinweis ist zu lang (höchstens ${PLAN_LIMITS.notesMax} Zeichen inklusive Gewicht und Wiederholungsangabe).`)
  }

  if (rowErrors.length > 0 || !reps) {
    ctx.errors.push(...rowErrors)
    return null
  }

  const match = matchExercise(name)
  const library = match.isCustom ? undefined : getExercise(match.key)
  // Jede Übung darf pro Tag nur einmal vorkommen (ein Satz ist über Übung und Satznummer eindeutig).
  const duplicate = taken.has(match.key)
  const base = duplicate ? customKey(name) : match.key
  const key = taken.has(base) ? [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${base.slice(0, 57)}_${n}`).find((k) => !taken.has(k)) ?? base : base
  const isCustom = match.isCustom || duplicate
  if (duplicate) ctx.warnings.push(`${at}: "${name}" passt auf eine Übung, die an diesem Tag schon vorkommt, und wird als eigene Übung angelegt.`)

  return {
    row: ctx.rowNumber,
    sourceName: name,
    isCustom,
    exerciseKey: key,
    displayName: library && library.name === name ? null : name,
    sets,
    repMin: reps.repMin,
    repMax: reps.repMax,
    restSeconds: rest ?? defaultRestSeconds(key),
    notes: notes || null,
    startWeightKg,
  }
}

/**
 * Liest eine Tabelle mit einer Zeile pro Übung. Die Kopfzeile wird in den ersten
 * Zeilen gesucht und tolerant erkannt. Tage werden in der Reihenfolge ihres
 * Auftretens gebildet; leere Tag-Zellen gehören zum Tag darüber.
 */
export function parsePlanTable(rows: readonly TableRow[]): ImportResult {
  const headerIndex = rows.slice(0, HEADER_SCAN_ROWS).findIndex((r) => detectColumns(r).exercise !== undefined)
  if (headerIndex < 0) {
    return { days: [], errors: ['Keine Kopfzeile gefunden. Es braucht mindestens eine Spalte "Übung" (dazu z. B. Tag, Fokus, Sätze, Wiederholungen).'], warnings: [] }
  }
  const header = rows[headerIndex] ?? []
  const cols = detectColumns(header)
  const errors: string[] = []
  const warnings: string[] = []
  if (cols.reps === undefined) errors.push('Spalte "Wiederholungen" fehlt.')
  if (cols.day === undefined && cols.focus === undefined) warnings.push('Keine Spalte "Tag" oder "Fokus": alle Übungen landen in einem Trainingstag.')

  const dataRows = rows.slice(headerIndex + 1)
  const weekdayMode = detectWeekdayMode(dataRows, cols.day, warnings)
  const groups: Group[] = []
  const groupFor = (key: string, weekday: number | null, focus: string): Group => {
    const existing = groups.find((g) => g.key === key)
    if (existing) return existing
    const created: Group = { key, weekday, focus, restMarked: false, exercises: [] }
    groups.push(created)
    return created
  }

  let currentDay = ''
  dataRows.forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2
    if (row.every((c) => cellText(c) === '')) return
    const dayText = get(row, cols.day)
    if (dayText) currentDay = dayText
    const focus = get(row, cols.focus)
    const name = get(row, cols.exercise)
    const weekday = weekdayMode ? parseWeekday(currentDay) : null
    if (isRestDay(focus) || isDash(name)) {
      const isRestRow = isRestDay(focus) || !(name === '' && !isDash(get(row, cols.reps)))
      if (!isRestRow) warnings.push(`Zeile ${rowNumber}: Keine Übung angegeben, Zeile übersprungen.`)
      else if (weekday !== null) groupFor(`wd:${weekday}`, weekday, currentDay).restMarked = true
      return
    }
    const key = weekday !== null ? `wd:${weekday}` : cols.day !== undefined ? currentDay || focus : focus || 'Tag 1'
    const group = groupFor(key, weekday, focus || currentDay)
    // Ein bisher reiner Ruhetag bekommt mit der ersten Übung den Fokus dieser Zeile.
    if (group.exercises.length === 0 && focus) group.focus = focus
    const parsed = parseExerciseRow(row, { cols, rowNumber, errors, warnings }, name, new Set(group.exercises.map((e) => e.exerciseKey)))
    if (parsed) group.exercises.push(parsed)
  })

  if (cols.reps === undefined) return { days: [], errors, warnings }
  const ordered = weekdayMode ? [...groups].sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0)) : groups
  // Ruhetag nur, wenn am Tag keine Übung steht.
  const isRest = (g: Group): boolean => g.restMarked && g.exercises.length === 0
  const trainingGroups = ordered.filter((g) => !isRest(g))
  if (trainingGroups.length === 0 && errors.length === 0) errors.push('Die Datei enthält keine Übungen.')
  if (ordered.length > PLAN_LIMITS.maxDays) errors.push(`Die Datei enthält ${ordered.length} Trainingstage, erlaubt sind höchstens ${PLAN_LIMITS.maxDays}.`)

  const titles = disambiguateTitles(trainingGroups.map((g) => translateFocus(g.focus || g.key).slice(0, PLAN_LIMITS.dayTitleMax - 2)))
  const titleOf = new Map(trainingGroups.map((g, i) => [g, titles[i] ?? g.key]))
  const days: ImportedDay[] = ordered.map((g) =>
    isRest(g)
      ? { title: REST_DAY_TITLE, exercises: [], weekday: g.weekday, isRest: true }
      : { title: titleOf.get(g) ?? g.key, exercises: g.exercises, weekday: g.weekday, isRest: false },
  )
  days.forEach((d) => {
    if (d.exercises.length > PLAN_LIMITS.maxExercisesPerDay) {
      errors.push(`Tag "${d.title}" hat ${d.exercises.length} Übungen, erlaubt sind höchstens ${PLAN_LIMITS.maxExercisesPerDay}.`)
    }
  })
  return { days, errors, warnings }
}

/** Baut aus einem fehlerfreien Ergebnis den Plan für create_plan und prüft ihn noch einmal vollständig. */
export function toImportedPlan(result: ImportResult, name: string): { readonly plan: NewPlan; readonly errors: readonly string[] } {
  const plan: NewPlan = {
    name: name.trim().slice(0, PLAN_LIMITS.planNameMax) || 'Importierter Plan',
    split: IMPORT_SPLIT,
    days: result.days.map((d) => ({
      title: d.title,
      weekday: d.weekday,
      isRest: d.isRest,
      exercises: d.exercises.map(({ exerciseKey, displayName, sets, repMin, repMax, restSeconds, notes, startWeightKg }) => ({
        exerciseKey,
        displayName,
        sets,
        repMin,
        repMax,
        restSeconds,
        notes,
        startWeightKg,
      })),
    })),
  }
  return { plan, errors: [...result.errors, ...(result.errors.length === 0 ? validatePlan(plan) : [])] }
}
