const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

export function ProgressBar({ label, value, target, unit }: { readonly label: string; readonly value: number; readonly target: number; readonly unit: string }) {
  const ratio = target > 0 ? value / target : 0
  const over = ratio > 1
  const rest = target - value
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span className="tabular-nums">
          <span className="font-display text-2xl font-bold">{NUMBER.format(value)}</span>
          <span className="text-sm text-muted"> / {NUMBER.format(target)} {unit}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={value}
        className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={`h-full rounded-full transition-all ${over ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{over ? `${NUMBER.format(-rest)} ${unit} über dem Ziel` : `Noch ${NUMBER.format(rest)} ${unit}`}</p>
    </div>
  )
}
