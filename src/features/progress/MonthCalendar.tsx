import { formatMonth, toISODate } from '../../lib/date'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export function MonthCalendar({ month, trainingDays }: { readonly month: Date; readonly trainingDays: ReadonlySet<string> }) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const leading = (new Date(year, m, 1).getDay() + 6) % 7
  const today = toISODate(new Date())
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1)),
  ]

  return (
    <div>
      <p className="mb-3 font-semibold capitalize">{formatMonth(month)}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <li key={`e${i}`} aria-hidden="true" />
          const iso = toISODate(date)
          const trained = trainingDays.has(iso)
          return (
            <li
              key={iso}
              aria-label={`${date.getDate()}.${trained ? ' Trainiert' : ''}`}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums ${
                trained ? 'bg-accent font-bold text-accent-ink' : 'bg-surface-2 text-muted'
              } ${iso === today ? 'ring-2 ring-ink' : ''}`}
            >
              {date.getDate()}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
