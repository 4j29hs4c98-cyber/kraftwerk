import type { BodyWeightRow } from '../api'
import { movingAverage, weightTrendSummary, type DatedValue } from './chartMath'
import { LineChart } from './LineChart'

/** Tageswerte als Punkte, gleitender 7-Tage-Schnitt als Linie. */
function TrendChart({ points, unit, label, ariaLabel }: { readonly points: readonly DatedValue[]; readonly unit: string; readonly label: string; readonly ariaLabel: string }) {
  return (
    <LineChart
      unit={unit}
      ariaLabel={ariaLabel}
      series={[
        { id: 'day', label: `${label} (Tageswert)`, color: 'var(--color-muted)', points, variant: 'dots' },
        { id: 'avg', label: 'Schnitt 7 Tage', color: 'var(--color-accent)', points: movingAverage(points), variant: 'line' },
      ]}
    />
  )
}

export function WeightTrend({ rows }: { readonly rows: readonly BodyWeightRow[] }) {
  if (rows.length < 2) return <p className="py-8 text-center text-sm text-muted">Ab zwei Einträgen siehst du hier deine Gewichtskurve.</p>
  const points = rows.map((r) => ({ date: r.measured_on, value: r.weight_kg }))
  const summary = weightTrendSummary(points)
  return (
    <>
      {summary && <p className="mb-2 text-sm text-muted">Trend: <span className="font-semibold text-ink">{summary}</span></p>}
      <TrendChart points={points} unit="kg" label="Gewicht" ariaLabel={`Gewichtsverlauf${summary ? `, ${summary}` : ''}`} />
    </>
  )
}

/** Nur sichtbar, wenn Körperfettwerte vorhanden sind. */
export function BodyFatTrend({ rows }: { readonly rows: readonly BodyWeightRow[] }) {
  const points = rows.flatMap((r) => (r.body_fat_pct === null ? [] : [{ date: r.measured_on, value: r.body_fat_pct }]))
  if (points.length === 0) return null
  const summary = weightTrendSummary(points, '%-Punkte')
  return (
    <>
      {summary && <p className="mb-2 text-sm text-muted">Trend: <span className="font-semibold text-ink">{summary}</span></p>}
      <TrendChart points={points} unit="%" label="Körperfett" ariaLabel={`Körperfettverlauf${summary ? `, ${summary}` : ''}`} />
      <p className="mt-2 text-xs text-muted">
        Waagen schätzen den Körperfettanteil über den Strom durch die Füße. Wasserhaushalt, Uhrzeit und Essen verschieben den Wert um mehrere Prozentpunkte. Achte nur
        auf den Trend über Wochen, nicht auf einzelne Messungen.
      </p>
    </>
  )
}
