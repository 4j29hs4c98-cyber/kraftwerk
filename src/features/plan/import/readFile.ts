import { UserFacingError } from '../../../lib/supabase'
import { parseCsv } from './csv'
import type { Cell, TableRow } from './parsePlanTable'

/** Größere Dateien sind für einen Trainingsplan unplausibel. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024
export const ACCEPTED_FILES = '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Die Typen der Bibliothek führen Datumszellen fälschlich als typeof Date; zur Laufzeit sind es Date-Objekte. */
function toCell(value: unknown): Cell {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value
  return String(value)
}

/** Liest die erste Tabelle einer .xlsx- oder .csv-Datei. Die Excel-Bibliothek wird erst hier nachgeladen. */
export async function readTable(file: File): Promise<readonly TableRow[]> {
  if (file.size > MAX_FILE_BYTES) throw new UserFacingError('Die Datei ist größer als 2 MB. Bitte nur die Tabelle mit dem Plan exportieren.')
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return parseCsv(await file.text())
  if (!name.endsWith('.xlsx')) throw new UserFacingError('Bitte wähle eine .xlsx- oder .csv-Datei.')
  try {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const [sheet] = await readXlsxFile(file)
    if (!sheet) throw new UserFacingError('Die Excel-Datei enthält keine Tabelle.')
    return sheet.data.map((row) => row.map(toCell))
  } catch (error) {
    if (error instanceof UserFacingError) throw error
    throw new UserFacingError('Die Excel-Datei konnte nicht gelesen werden. Ist sie beschädigt oder passwortgeschützt?')
  }
}

export function planNameFromFile(fileName: string): string {
  return fileName.replace(/\.(xlsx|csv)$/i, '').replace(/[_-]+/g, ' ').trim()
}
