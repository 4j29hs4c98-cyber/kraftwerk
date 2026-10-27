import { Link } from 'react-router'
import { Stat } from '../../components/Card'
import { formatDuration } from '../../lib/date'
import type { WorkoutRow } from './api'
import { loggedSets, type ExerciseEntry } from './session'
import { totalVolume } from './summary'

const NUMBER = new Intl.NumberFormat('de-DE')

export function WorkoutSummary({ workout, entries, title }: { readonly workout: WorkoutRow; readonly entries: readonly ExerciseEntry[]; readonly title: string }) {
  const sets = loggedSets(entries)
  const duration = workout.finished_at ? new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime() : 0
  const exercisesDone = entries.filter((e) => e.sets.some((s) => s.loggedId !== null)).length

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Training abgeschlossen</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-none">Stark gemacht.</h1>
      <p className="mt-2 text-muted">{title} ist im Kasten.</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Stat label="Dauer" value={formatDuration(duration)} />
        <Stat label="Volumen" value={NUMBER.format(totalVolume(sets))} unit="kg" />
        <Stat label="Sätze" value={String(sets.length)} />
        <Stat label="Übungen" value={String(exercisesDone)} />
      </div>
      <Link to="/heute" className="mt-8 flex min-h-14 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
        Zur Übersicht
      </Link>
      <Link to="/fortschritt" className="mt-3 flex min-h-12 items-center justify-center font-semibold text-muted hover:text-ink">
        Fortschritt ansehen
      </Link>
    </main>
  )
}
