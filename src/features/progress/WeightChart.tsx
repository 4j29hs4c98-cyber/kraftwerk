import { formatShortDate, parseISODate } from '../../lib/date'

export interface WeightPoint {
  readonly date: string
  readonly weightKg: number
}

const W = 600
const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 40 }
const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** Schlankes SVG-Liniendiagramm ohne Bibliothek. Zeitachse proportional zu den Tagen. */
export function WeightChart({ points }: { readonly points: readonly WeightPoint[] }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-muted">Ab zwei Einträgen siehst du hier deine Gewichtskurve.</p>
  }
  const times = points.map((p) => parseISODate(p.date).getTime())
  const weights = points.map((p) => p.weightKg)
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const minW = Math.floor(Math.min(...weights) - 1)
  const maxW = Math.ceil(Math.max(...weights) + 1)
  const x = (t: number) => PAD.left + ((t - minT) / Math.max(1, maxT - minT)) * (W - PAD.left - PAD.right)
  const y = (w: number) => PAD.top + (1 - (w - minW) / Math.max(1, maxW - minW)) * (H - PAD.top - PAD.bottom)
  const coords = points.map((p, i) => [x(times[i] ?? 0), y(p.weightKg)] as const)
  const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)?.[0] ?? 0},${H - PAD.bottom} L${coords[0]?.[0] ?? 0},${H - PAD.bottom} Z`
  const ticks = [minW, (minW + maxW) / 2, maxW]
  const first = points[0]
  const last = points.at(-1)

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Gewichtsverlauf von ${NUMBER.format(first?.weightKg ?? 0)} auf ${NUMBER.format(last?.weightKg ?? 0)} kg`}>
        <defs>
          <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="4 6" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">
              {NUMBER.format(t)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#weight-fill)" />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map(([cx, cy], i) => (
          <circle key={points[i]?.date} cx={cx} cy={cy} r="4" fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth="2" />
        ))}
        <text x={PAD.left} y={H - 8} fontSize="12" fill="var(--color-muted)">{first ? formatShortDate(parseISODate(first.date)) : ''}</text>
        <text x={W - PAD.right} y={H - 8} fontSize="12" textAnchor="end" fill="var(--color-muted)">{last ? formatShortDate(parseISODate(last.date)) : ''}</text>
      </svg>
    </figure>
  )
}
