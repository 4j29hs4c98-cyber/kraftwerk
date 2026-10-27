import { toCsv } from './csv'

export const TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wiederholungen', 'Gewicht', 'Hinweise', 'Pause (s)'],
  ['Montag', 'Upper', 'Latzug (Obergriff)', '3', '8-10', '70 kg', 'Schulterblätter zuerst nach unten', '120'],
  ['Dienstag', 'Lower', 'Beinpresse', '4', '10-12', '120 kg', 'Füße schulterbreit', ''],
]

export const TEMPLATE_FILE_NAME = 'kraftwerk-plan-vorlage.csv'

/** Erzeugt die Vorlage als Blob und lädt sie herunter, ohne Server-Pfad (funktioniert unter jedem base). */
export function downloadTemplate(): void {
  const blob = new Blob([toCsv(TEMPLATE_ROWS)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = TEMPLATE_FILE_NAME
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
