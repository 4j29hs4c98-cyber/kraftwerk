import { Link, useNavigate, useParams } from 'react-router'
import { IconClose } from '../../app/icons'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExercisePicker } from '../plan/editor/ExercisePicker'
import { ErrorState, InlineError, LoadingState } from '../../components/States'
import { SyncStatus } from '../../components/SyncStatus'
import { useAsync } from '../../lib/useAsync'
import { fetchActivePlan, type PlanDay } from '../plan/api'
import { exerciseName } from '../plan/exercises'
import { ExerciseList } from '../plan/DayCard'
import { fetchLastSets, findOpenWorkout, type WorkoutRow } from './api'
import { ExerciseBlock } from './ExerciseBlock'
import { RestTimer } from './RestTimer'
import { buildEntriesFromLayout, loadLayout, sessionKeys } from './layout'
import { buildEntries, hasLoggedSets, pickCustom, pickLibrary, type ExerciseEntry, type ExercisePick } from './session'
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
  const planKeys = day.exercises.map((e) => e.exercise_key)
  const open = await findOpenWorkout(day.id)
  // Spontan geloggte Übungen außerhalb des Plans brauchen ebenfalls ihren Vorschlag.
  // Ein gemerkter Aufbau (Tausch, neue Übungen) hat Vorrang vor dem Plan.
  const layout = open ? loadLayout(open.workout.id) : null
  const sets = open?.sets ?? []
  const lastSets = await fetchLastSets(sessionKeys(planKeys, layout, sets))
  const entries = layout ? buildEntriesFromLayout(layout, lastSets, sets) : buildEntries(day.exercises, lastSets, sets)
  return { day, entries, openWorkout: open?.workout ?? null }
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

type PendingConfirm =
  | { readonly kind: 'swap'; readonly uid: string; readonly pick: ExercisePick }
  | { readonly kind: 'removeSet'; readonly uid: string }

function WorkoutSession({ loaded }: { readonly loaded: Loaded }) {
  const navigate = useNavigate()
  const session = useWorkout(loaded.day, loaded.entries, loaded.openWorkout)
  const { workout, started, entries } = session
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [adding, setAdding] = useState(false)
  const taken = new Set(entries.map((e) => e.key))
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

  function requestSwap(uid: string, pick: ExercisePick) {
    const entry = entries.find((e) => e.uid === uid)
    if (entry && hasLoggedSets(entry)) setConfirm({ kind: 'swap', uid, pick })
    else void session.swap(uid, pick)
  }

  function requestRemoveSet(uid: string) {
    const last = entries.find((e) => e.uid === uid)?.sets.at(-1)
    if (last && last.loggedId !== null) setConfirm({ kind: 'removeSet', uid })
    else void session.removeSet(uid)
  }

  function runConfirmed() {
    const pending = confirm
    setConfirm(null)
    if (pending?.kind === 'swap') void session.swap(pending.uid, pending.pick)
    if (pending?.kind === 'removeSet') void session.removeSet(pending.uid)
  }

  const confirmEntry = confirm ? entries.find((e) => e.uid === confirm.uid) : undefined

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
          <>
            {entries.map((entry) => (
              <ExerciseBlock
                key={entry.uid}
                entry={entry}
                taken={taken}
                busy={session.busyUids.includes(entry.uid)}
                onEdit={(setIndex, patch) => session.edit(entry.uid, setIndex, patch)}
                onToggle={(setIndex) => void session.toggle(entry.uid, setIndex)}
                onSwap={(pick) => requestSwap(entry.uid, pick)}
                onAddSet={() => session.addSetTo(entry.uid)}
                onRemoveSet={() => requestRemoveSet(entry.uid)}
              />
            ))}
            {adding ? (
              <ExercisePicker
                taken={taken}
                onPickLibrary={(key) => {
                  setAdding(false)
                  void session.addExercise(pickLibrary(key))
                }}
                onAddCustom={(name) => {
                  setAdding(false)
                  void session.addExercise(pickCustom(name))
                }}
                onClose={() => setAdding(false)}
              />
            ) : (
              <Button variant="secondary" block className="min-h-12" onClick={() => setAdding(true)}>
                Übung hinzufügen
              </Button>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        danger
        title={confirm?.kind === 'swap' ? 'Übung tauschen?' : 'Satz entfernen?'}
        confirmLabel={confirm?.kind === 'swap' ? 'Tauschen' : 'Entfernen'}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === 'swap' && confirmEntry
          ? `Die abgehakten Sätze von ${exerciseName(confirmEntry.key, confirmEntry.displayName)} werden gelöscht. Der Plan bleibt unverändert.`
          : 'Der letzte Satz ist abgehakt und wird gelöscht.'}
      </ConfirmDialog>

      {session.rest && <RestTimer rest={session.rest} onChange={session.setRest} />}
    </div>
  )
}
