import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { formatShortDate, parseISODate } from '../../../lib/date'
import { linearScale, niceTicks, type DatedValue } from './chartMath'

export interface ChartSeries {
  readonly id: string
  readonly label: string
  /** CSS-Farbe, z. B. var(--color-accent). */
  readonly color: string
  readonly points: readonly DatedValue[]
  /** line: Linie mit Punkten, dots: nur Punkte (z. B. Tageswerte unter einem Schnitt). */
  readonly variant: 'line' | 'dots'
}

interface Props {
  readonly series: readonly ChartSeries[]
  readonly unit: string
  readonly ariaLabel: string
}

const W = 600
const H = 240
const PAD = { top: 26, right: 16, bottom: 36, left: 58 }
const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const TOOLTIP = { w: 236, h: 54 }

/** Wird true, sobald das Element sichtbar ist; ohne IntersectionObserver sofort. */
function useInView<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])
  return [ref, visible]
}

interface Selected {
  readonly seriesId: string
  readonly index: number
}

/**
 * Schlankes SVG-Liniendiagramm ohne Bibliothek. Die Linie baut sich beim Einblenden auf
 * (stroke-dashoffset per CSS, bei reduzierter Bewegung sofort sichtbar). Punkte zeigen ihren
 * Wert bei Tippen, Hover oder Tastaturfokus.
 */
export function LineChart({ series, unit, ariaLabel }: Props) {
  const [ref, visible] = useInView<SVGSVGElement>()
  const [selected, setSelected] = useState<Selected | null>(null)
  const clipId = useId()
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return null

  const times = all.map((p) => parseISODate(p.date).getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const { min, max, ticks } = niceTicks(Math.min(...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)))
  const x = linearScale([minT, maxT], [PAD.left, W - PAD.right])
  const y = linearScale([min, max], [H - PAD.bottom, PAD.top])
  const coord = (p: DatedValue): readonly [number, number] => [x(parseISODate(p.date).getTime()), y(p.value)]
  const midT = minT + (maxT - minT) / 2
  const xLabels = maxT === minT ? [minT] : [minT, midT, maxT]

  const active = selected ? series.find((s) => s.id === selected.seriesId)?.points[selected.index] : undefined
  const activeSeries = selected ? series.find((s) => s.id === selected.seriesId) : undefined

  return (
    <figure>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className={`chart h-auto w-full touch-manipulation ${visible ? 'is-visible' : ''}`}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setSelected(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left - 8} y={0} width={W - PAD.left - PAD.right + 16} height={H} />
          </clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="4 6" />
            <text x={PAD.left - 8} y={y(t) + 6} textAnchor="end" fontSize="17" fill="var(--color-muted)">
              {NUMBER.format(t)}
            </text>
          </g>
        ))}
        <text x={PAD.left - 8} y={PAD.top - 8} textAnchor="end" fontSize="15" fill="var(--color-muted)">
          {unit}
        </text>
        {xLabels.map((t, i) => (
          <text
            key={t}
            x={x(t)}
            y={H - 10}
            fontSize="17"
            fill="var(--color-muted)"
            textAnchor={xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
          >
            {formatShortDate(new Date(t))}
          </text>
        ))}

        <g clipPath={`url(#${clipId})`}>
          {series.map((s) =>
            s.variant === 'line' && s.points.length > 1 ? (
              <path
                key={`${s.id}-line`}
                className="chart-line"
                pathLength={1}
                d={s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${coord(p)[0].toFixed(1)},${coord(p)[1].toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {series.map((s) =>
            s.points.map((p, i) => {
              const [cx, cy] = coord(p)
              const isActive = selected?.seriesId === s.id && selected.index === i
              return (
                <circle
                  key={`${s.id}-${p.date}`}
                  className="chart-dot"
                  cx={cx}
                  cy={cy}
                  r={isActive ? 6 : s.variant === 'dots' ? 3.5 : 4}
                  fill={s.variant === 'dots' ? s.color : 'var(--color-bg)'}
                  fillOpacity={s.variant === 'dots' ? 0.55 : 1}
                  stroke={s.color}
                  strokeWidth={s.variant === 'dots' ? 0 : 2}
                />
              )
            }),
          )}
        </g>

        {/* Größere, unsichtbare Trefferflächen für Finger und Tastatur. */}
        {series.map((s) =>
          s.points.map((p, i) => {
            const [cx, cy] = coord(p)
            const select = () => setSelected({ seriesId: s.id, index: i })
            return (
              <circle
                key={`${s.id}-${p.date}-hit`}
                cx={cx}
                cy={cy}
                r={14}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${s.label}, ${formatShortDate(parseISODate(p.date))}: ${NUMBER.format(p.value)} ${unit}`}
                onMouseEnter={select}
                onClick={select}
                onFocus={select}
                className="cursor-pointer focus:outline-none"
              />
            )
          }),
        )}

        {active && activeSeries && <Tooltip point={active} at={coord(active)} label={activeSeries.label} color={activeSeries.color} unit={unit} />}
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className={`inline-block ${s.variant === 'dots' ? 'size-2 rounded-full' : 'h-0.5 w-4 rounded'}`} style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}

function Tooltip({ point, at, label, color, unit }: { readonly point: DatedValue; readonly at: readonly [number, number]; readonly label: string; readonly color: string; readonly unit: string }) {
  const [cx, cy] = at
  const tx = Math.min(Math.max(cx - TOOLTIP.w / 2, PAD.left), W - PAD.right - TOOLTIP.w)
  const above = cy - TOOLTIP.h - 12 >= 0
  const ty = above ? cy - TOOLTIP.h - 12 : cy + 12
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect x={tx} y={ty} width={TOOLTIP.w} height={TOOLTIP.h} rx={8} fill="var(--color-surface-2)" stroke={color} strokeWidth="1" />
      <text x={tx + 12} y={ty + 21} fontSize="15" fill="var(--color-muted)">
        {formatShortDate(parseISODate(point.date))} · {label}
      </text>
      <text x={tx + 12} y={ty + 44} fontSize="19" fontWeight="700" fill="var(--color-ink)">
        {NUMBER.format(point.value)} {unit}
      </text>
    </g>
  )
}
