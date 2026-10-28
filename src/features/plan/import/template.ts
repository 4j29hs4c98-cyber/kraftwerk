import { toCsv } from './csv'

export const TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ['Tag', 'Fokus', 'Übung', 'Sätze', 'Wiederholungen', 'Gewicht', 'Hinweise', 'Pause (s)'],
  ['Montag', 'Upper', 'Latzug (Obergriff)', '3', '8-10', '70 kg', 'Schulterblätter zuerst nach unten', '120'],
  ['Dienstag', 'Lower', 'Beinpresse', '4', '10-12', '120 kg', 'Füße schulterbreit', ''],
]

export const TEMPLATE_FILE_NAME = 'kraftwerk-plan-vorlage.csv'

/** Lädt Zeilen als CSV herunter, ohne Server-Pfad (funktioniert unter jedem base). */
export function downloadCsv(rows: readonly (readonly string[])[], fileName: string): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadTemplate(): void {
  downloadCsv(TEMPLATE_ROWS, TEMPLATE_FILE_NAME)
}
