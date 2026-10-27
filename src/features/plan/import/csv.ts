/** Kleiner CSV-Leser: Anführungszeichen, verdoppelte Anführungszeichen, Zeilenumbrüche in Feldern. */
export function detectDelimiter(firstLine: string): string {
  const counts = [';', ',', '\t'].map((d) => ({ d, n: firstLine.split(d).length - 1 }))
  return counts.reduce((best, c) => (c.n > best.n ? c : best), { d: ';', n: 0 }).d
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      rows.push([...row, field])
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows
}

const quote = (value: string): string => (/[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

/** Semikolon-CSV mit BOM, damit Excel Umlaute und Spalten richtig erkennt. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `﻿${rows.map((r) => r.map(quote).join(';')).join('\r\n')}\r\n`
}
