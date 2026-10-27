import { Link } from 'react-router'
import { exerciseName, isCustomKey, isTimed } from './exercises'
import type { PlanDay } from './api'

function repRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return ''
  if (min === max || max === null) return `${min}`
  if (min === null) return `${max}`
  return `${min}-${max}`
}

export function ExerciseList({ day }: { readonly day: PlanDay }) {
  return (
    <ol className="divide-y divide-line">
      {day.exercises.map((ex) => (
        <li key={ex.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="min-w-0 text-sm">
            {exerciseName(ex.exercise_key, ex.display_name)}
            {isCustomKey(ex.exercise_key) && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">Eigene</span>}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-muted">
            {ex.sets} x {repRange(ex.rep_min, ex.rep_max)}
            {isTimed(ex.exercise_key) ? ' s' : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function DayCard({ day, isNext, position }: { readonly day: PlanDay; readonly isNext: boolean; readonly position: number }) {
  return (
    <article className={`rounded-2xl border bg-surface p-4 ${isNext ? 'border-accent' : 'border-line'}`}>
      <header className="mb-1 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Tag {position}</p>
          <h3 className="font-display text-2xl font-bold uppercase leading-tight">{day.title ?? `Tag ${position}`}</h3>
        </div>
        {isNext && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-ink">Als Nächstes</span>}
      </header>
      <ExerciseList day={day} />
      <Link
        to={`/training/${day.id}`}
        className={`mt-3 flex min-h-12 items-center justify-center rounded-xl font-semibold transition ${isNext ? 'bg-accent text-accent-ink hover:bg-accent-strong' : 'border border-line bg-surface-2 hover:border-muted'}`}
      >
        {isNext ? 'Training starten' : 'Diesen Tag trainieren'}
      </Link>
    </article>
  )
}
