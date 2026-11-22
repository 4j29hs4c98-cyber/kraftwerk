import { openFoodFactsCode } from './barcode'
import { mapOffResponse, type OffResult } from './openFoodFacts'

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product/'
const FIELDS = 'code,product_name,product_name_de,brands,nutriments,serving_quantity'
const TIMEOUT_MS = 8000

const OFFLINE = 'Keine Internetverbindung. Gescannte Produkte findest du offline nur, wenn du sie schon unter "Meine Lebensmittel" gespeichert hast.'
const UNREACHABLE = 'Open Food Facts ist gerade nicht erreichbar. Versuche es später noch einmal oder trag die Werte selbst ein.'

/** Fragt ein Produkt bei Open Food Facts ab. Meldet Fehler als Ergebnis statt zu werfen. */
export async function fetchOffProduct(code: string): Promise<OffResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: OFFLINE }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${ENDPOINT}${encodeURIComponent(openFoodFactsCode(code))}.json?fields=${FIELDS}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    // Unbekannte Produkte beantwortet Open Food Facts mit 404 und status 0 im Text.
    if (!response.ok && response.status !== 404) return { ok: false, error: UNREACHABLE }
    const body: unknown = response.status === 404 ? { status: 0 } : await response.json().catch(() => null)
    return mapOffResponse(body, code)
  } catch {
    return { ok: false, error: typeof navigator !== 'undefined' && !navigator.onLine ? OFFLINE : UNREACHABLE }
  } finally {
    clearTimeout(timer)
  }
}
