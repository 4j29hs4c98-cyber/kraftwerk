import { Link, useNavigate, useParams } from 'react-router'
import { IconClose } from '../../app/icons'
import { Button } from '../../components/Button'
import { ErrorState, InlineError, LoadingState } from '../../components/States'
import { SyncStatus } from '../../components/SyncStatus'
import { useAsync } from '../../lib/useAsync'
import { fetchActivePlan, type PlanDay } from '../plan/api'
import { ExerciseList } from '../plan/DayCard'
import { fetchLastSets, findOpenWorkout, type WorkoutRow } from './api'
import { ExerciseBlock } from './ExerciseBlock'
import { RestTimer } from './RestTimer'
import { buildEntries, type ExerciseEntry } from './session'
import { useWorkout } from './useWorkout'
import { WorkoutSummary } from './WorkoutSummary'

interface Loaded {
  readonly day: PlanDay
  readonly entries: readonly ExerciseEntry[]
  readonly openWorkout: WorkoutRow | null
}

async function loadSession(dayId: string): Promise<Loaded | null> {
  const plan = await fetchActivePlan()
  const day = plan?.days.find((d) => d.id === dayId && !d.is_rest)
  if (!day) return null
  const [lastSets, open] = await Promise.all([fetchLastSets(day.exercises.map((e) => e.exercise_key)), findOpenWorkout(day.id)])
  return { day, entries: buildEntries(day.exercises, lastSets, open?.sets ?? []), openWorkout: open?.workout ?? null }
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl px-4 py-8">{children}</main>
}

export function WorkoutPage() {
  const { dayId = '' } = useParams()
  const state = useAsync(() => loadSession(dayId), [dayId])

  if (state.status === 'loading') return <Shell><LoadingState label="Training wird vorbereitet" /></Shell>
  if (state.status === 'error') return <Shell><ErrorState message={state.message} onRetry={state.reload} /></Shell>
  if (!state.data)
    return (
      <Shell>
        <ErrorState message="Diesen Trainingstag gibt es in deinem aktuellen Plan nicht mehr." />
        <Link to="/plan" className="mt-4 inline-flex min-h-12 items-center font-semibold text-accent">Zum Plan</Link>
      </Shell>
    )
  return <WorkoutSession key={state.data.day.id} loaded={state.data} />
}

function WorkoutSession({ loaded }: { readonly loaded: Loaded }) {
  const navigate = useNavigate()
  const session = useWorkout(loaded.day, loaded.entries, loaded.openWorkout)
  const { workout, started, entries } = session
  const title = loaded.day.title ?? 'Training'
  const loggedCount = entries.reduce((n, e) => n + e.sets.filter((s) => s.loggedId !== null).length, 0)
  const totalCount = entries.reduce((n, e) => n + e.sets.length, 0)

  if (workout?.finished_at) return <WorkoutSummary workout={workout} entries={entries} title={title} />

  async function handleFinish() {
    if (loggedCount === 0) {
      window.alert('Hake mindestens einen Satz ab, bevor du das Training beendest.')
      return
    }
    if (loggedCount < totalCount && !window.confirm(`Du hast ${loggedCount} von ${totalCount} Sätzen abgehakt. Training trotzdem beenden?`)) return
    await session.finish()
  }

  async function handleCancel() {
    if (workout && loggedCount > 0 && !window.confirm('Training abbrechen? Bereits abgehakte Sätze dieses Trainings werden gelöscht.')) return
    if (await session.discard()) navigate('/heute')
  }

  return (
    <div className={`min-h-dvh ${session.rest ? 'pb-36' : 'pb-10'}`}>
      <header className="top-safe sticky z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={handleCancel} aria-label="Training abbrechen" className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink">
            <IconClose className="size-6" />
          </button>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted">{started ? `${loggedCount} von ${totalCount} Sätzen` : 'Bereit'}</p>
            <h1 className="font-display text-2xl font-bold uppercase leading-none">{title}</h1>
          </div>
          {started && (
            <Button onClick={handleFinish} loading={session.busy} className="min-h-11 px-4">
              Beenden
            </Button>
          )}
        </div>
        {started && (
          <div className="h-1 bg-surface-2" aria-hidden="true">
            <div className="h-full bg-accent transition-all" style={{ width: `${totalCount ? (loggedCount / totalCount) * 100 : 0}%` }} />
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-5">
        <SyncStatus />
        <InlineError message={session.error} />
        {!started ? (
          <>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <ExerciseList day={loaded.day} />
            </div>
            <p className="text-sm text-muted">
              Gewicht und Wiederholungen sind aus deinem letzten Training vorbefüllt. Nach jedem abgehakten Satz startet der Pausen-Timer.
            </p>
            <Button block onClick={session.start} className="min-h-14 text-lg">
              Training starten
            </Button>
          </>
        ) : (
          entries.map((entry, i) => (
            <ExerciseBlock
              key={entry.planExercise.id}
              entry={entry}
              onEdit={(setIndex, patch) => session.edit(i, setIndex, patch)}
              onToggle={(setIndex) => void session.toggle(i, setIndex)}
            />
          ))
        )}
      </div>

      {session.rest && <RestTimer rest={session.rest} onChange={session.setRest} />}
    </div>
  )
}
