/**
 * Netzwerkfehler erkennen. supabase-js wirft bei fehlender Verbindung nicht,
 * sondern liefert einen Fehler mit status 0 und Meldungen wie
 * "TypeError: Failed to fetch" (Chrome) oder "TypeError: Load failed" (Safari).
 */
const NETWORK_MESSAGE = /failed to fetch|load failed|networkerror|network request failed|fetch failed|^(TypeError|FetchError|AbortError|TimeoutError):/i
const NETWORK_NAMES = new Set(['AbortError', 'TimeoutError', 'AuthRetryableFetchError'])

const FETCH_TYPE_ERROR = /failed to fetch|load failed|networkerror|network request failed|fetch failed/i

/** Ein TypeError zählt nur mit der typischen fetch-Meldung als Netzwerkfehler, nicht als Fehler im eigenen Code. */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return FETCH_TYPE_ERROR.test(error.message)
  if (!error || typeof error !== 'object') return false
  if ('name' in error && typeof error.name === 'string' && NETWORK_NAMES.has(error.name)) return true
  return 'message' in error && typeof error.message === 'string' && NETWORK_MESSAGE.test(error.message)
}

export interface WriteResult {
  /** HTTP-Status; 0 heißt, der Server wurde nicht erreicht. */
  readonly status: number
  readonly error: unknown
}

/**
 * ok: angekommen. retry: vorübergehend (kein Netz, Serverfehler, abgelaufene
 * Anmeldung, Drosselung), später erneut senden. permanent: der Server lehnt den
 * Eintrag ab (Prüfregel, Eindeutigkeit, Zugriffsregel); erneutes Senden ändert nichts.
 */
export type WriteOutcome = 'ok' | 'retry' | 'permanent'

const RETRY_STATUS = new Set([0, 401, 408, 425, 429])

export function classifyWrite(result: WriteResult): WriteOutcome {
  if (!result.error) return 'ok'
  if (RETRY_STATUS.has(result.status) || result.status >= 500) return 'retry'
  if (isNetworkError(result.error)) return 'retry'
  return 'permanent'
}

/** Kurzer Text eines Serverfehlers für die Liste nicht übertragbarer Einträge. */
export function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' && error.code ? ` (${error.code})` : ''
    if ('message' in error && typeof error.message === 'string') return `${error.message}${code}`
  }
  return String(error)
}
