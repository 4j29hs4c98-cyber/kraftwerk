/** Verständliche deutsche Meldung, warum die Kamera nicht läuft. Der Code kann immer noch von Hand eingegeben werden. */
export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error || (typeof err === 'object' && err !== null && 'name' in err) ? String((err as { name: unknown }).name) : ''
  const manual = 'Gib den Code unten von Hand ein.'
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Der Zugriff auf die Kamera ist blockiert. Erlaube ihn in den Einstellungen von Browser oder App, oder gib den Code unten von Hand ein.`
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `Auf diesem Gerät wurde keine Kamera gefunden. ${manual}`
  if (name === 'NotReadableError' || name === 'AbortError') return `Die Kamera wird gerade von einer anderen App benutzt. ${manual}`
  return `Die Kamera lässt sich nicht starten. ${manual}`
}

export const NO_CAMERA_API = 'Dieser Browser kann die Kamera nicht ansteuern (dafür braucht er eine sichere Verbindung). Gib den Code unten von Hand ein.'
export const SCANNER_LOAD_FAILED = 'Der Scanner konnte nicht geladen werden, vermutlich fehlt die Verbindung. Gib den Code unten von Hand ein.'
