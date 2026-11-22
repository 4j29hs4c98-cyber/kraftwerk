import { normalizeBarcode } from './barcode'
import { FOOD_DB_LIMITS } from './foodMath'

/** Ein Produkt aus Open Food Facts, auf unsere Grenzen gebracht. Werte gelten pro 100 g. */
export interface OffProduct {
  readonly barcode: string
  readonly name: string
  readonly kcal100: number
  readonly protein100: number
  readonly carbs100: number
  readonly fat100: number
  /** Portionsgröße der Packung in Gramm, null wenn unbekannt oder unplausibel. */
  readonly servingGrams: number | null
  /** Hinweise für die Bestätigung: fehlende oder zurechtgestutzte Werte. */
  readonly notes: readonly string[]
}

export type OffResult = { readonly ok: true; readonly product: OffProduct } | { readonly ok: false; readonly error: string }

const KJ_PER_KCAL = 4.184
const BRAND_MAX = 30
const FALLBACK_ERROR = 'Open Food Facts hat unlesbare Daten geliefert.'

const round1 = (n: number): number => Math.round(n * 10) / 10

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Zahl oder Zahl als Text (auch mit Komma); alles andere, NaN und Unendlich sind null. */
function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value.trim().replace(',', '.')) : Number.NaN
  return Number.isFinite(n) ? n : null
}

/** Text ohne Steuerzeichen und doppelte Leerzeichen; Nicht-Text ist leer. */
function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

/** Name auf Deutsch bevorzugt, dazu die erste Marke, wenn alles in die 80 Zeichen passt. */
function buildName(product: Record<string, unknown>, barcode: string): string {
  const name = cleanText(product.product_name_de) || cleanText(product.product_name)
  const brand = cleanText(product.brands).split(',')[0]?.trim() ?? ''
  if (!name) return (brand || `Produkt ${barcode}`).slice(0, FOOD_DB_LIMITS.nameMax)
  const withBrand = `${name} (${brand})`
  const brandFits = brand !== '' && brand.length <= BRAND_MAX && !name.toLowerCase().includes(brand.toLowerCase()) && withBrand.length <= FOOD_DB_LIMITS.nameMax
  return brandFits ? withBrand : name.slice(0, FOOD_DB_LIMITS.nameMax)
}

/** Energie in kcal pro 100 g; ohne kcal-Angabe aus kJ umgerechnet. */
function readKcal(nutriments: Record<string, unknown>): number | null {
  const kcal = toNumber(nutriments['energy-kcal_100g'])
  if (kcal !== null && kcal >= 0) return kcal
  const kj = toNumber(nutriments['energy-kj_100g']) ?? toNumber(nutriments['energy_100g'])
  return kj !== null && kj >= 0 ? kj / KJ_PER_KCAL : null
}

/** Auf 0 bis max begrenzen; ob dabei etwas abgeschnitten wurde, steht in clamped. */
function clamp(value: number, max: number): { readonly value: number; readonly clamped: boolean } {
  return value > max ? { value: max, clamped: true } : { value, clamped: false }
}

function readServing(product: Record<string, unknown>): number | null {
  const grams = toNumber(product.serving_quantity)
  return grams !== null && grams >= FOOD_DB_LIMITS.defaultGramsMin && grams <= FOOD_DB_LIMITS.defaultGramsMax ? round1(grams) : null
}

/**
 * Macht aus der Antwort von Open Food Facts ein Produkt. Die Antwort ist fremde Eingabe:
 * Typen werden geprüft, Werte auf FOOD_DB_LIMITS begrenzt, nur die Kalorien sind Pflicht.
 */
export function mapOffResponse(body: unknown, requestedCode: string): OffResult {
  const barcode = normalizeBarcode(requestedCode)
  if (!barcode) return { ok: false, error: 'Dieser Code ist ungültig. Barcodes haben 8 bis 14 Ziffern.' }
  if (!isRecord(body)) return { ok: false, error: FALLBACK_ERROR }
  if (toNumber(body.status) === 0 || !isRecord(body.product)) return { ok: false, error: 'Dieses Produkt kennt Open Food Facts nicht. Trag die Werte von der Packung selbst ein.' }

  const product = body.product
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {}
  const kcal = readKcal(nutriments)
  if (kcal === null) return { ok: false, error: 'Zu diesem Produkt hat Open Food Facts keine Kalorien. Trag die Werte von der Packung selbst ein.' }

  const notes: string[] = []
  const energy = clamp(round1(kcal), FOOD_DB_LIMITS.kcal100Max)
  if (energy.clamped) notes.push('Die Kalorien waren unplausibel hoch und wurden begrenzt.')

  const macro = (key: string, label: string): number => {
    const raw = toNumber(nutriments[key])
    if (raw === null || raw < 0) {
      notes.push(`${label} fehlt bei Open Food Facts und steht auf 0.`)
      return 0
    }
    const limited = clamp(round1(raw), FOOD_DB_LIMITS.macro100Max)
    if (limited.clamped) notes.push(`${label} war unplausibel hoch und wurde begrenzt.`)
    return limited.value
  }

  return {
    ok: true,
    product: {
      barcode,
      name: buildName(product, barcode),
      kcal100: energy.value,
      protein100: macro('proteins_100g', 'Eiweiß'),
      carbs100: macro('carbohydrates_100g', 'Kohlenhydrate'),
      fat100: macro('fat_100g', 'Fett'),
      servingGrams: readServing(product),
      notes,
    },
  }
}
