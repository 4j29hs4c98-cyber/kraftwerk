import { useCallback, useRef, useState } from 'react'
import { toMessage } from '../../lib/supabase'
import type { PlanDay } from '../plan/api'
import { deleteSet, discardWorkout, finishWorkout, logSet, startWorkout, type WorkoutRow } from './api'
import type { RestState } from './RestTimer'
import { parseSet, updateSet, type ExerciseEntry, type SetEntry } from './session'

const DEFAULT_REST_SECONDS = 90

export function useWorkout(day: PlanDay, initialEntries: readonly ExerciseEntry[], initialWorkout: WorkoutRow | null) {
  const [workout, setWorkout] = useState<WorkoutRow | null>(initialWorkout)
  const [entries, setEntries] = useState<readonly ExerciseEntry[]>(initialEntries)
  const [rest, setRest] = useState<RestState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Das Workout entsteht erst mit dem ersten abgehakten Satz (lokal sofort, auf dem Server beim nächsten Abgleich).
  const [started, setStarted] = useState(initialWorkout !== null)
  const creating = useRef<Promise<WorkoutRow> | null>(null)
  // Aktueller Stand auch für schnell hintereinander abgehakte Sätze, bevor React neu gerendert hat.
  const workoutRef = useRef<WorkoutRow | null>(initialWorkout)

  const edit = useCallback((exerciseIndex: number, setIndex: number, patch: Partial<SetEntry>) => {
    setEntries((prev) => updateSet(prev, exerciseIndex, setIndex, patch))
  }, [])

  function start() {
    setError(null)
    setStarted(true)
  }

  /** Liefert das Workout und legt es beim ersten Aufruf an; parallele Aufrufe teilen sich die Anfrage. */
  async function ensureWorkout(): Promise<WorkoutRow> {
    if (workoutRef.current) return workoutRef.current
    if (!creating.current) {
      creating.current = startWorkout(day.id)
        .then((row) => {
          workoutRef.current = row
          setWorkout(row)
          return row
        })
        .finally(() => {
          creating.current = null
        })
    }
    return creating.current
  }

  async function toggle(exerciseIndex: number, setIndex: number) {
    const entry = entries[exerciseIndex]
    const set = entry?.sets[setIndex]
    if (!started || !entry || !set || set.saving) return
    setError(null)

    const exerciseKey = entry.planExercise.exercise_key
    if (set.loggedId !== null) {
      const current = workoutRef.current
      if (!current) return
      edit(exerciseIndex, setIndex, { saving: true })
      try {
        await deleteSet({ workoutId: current.id, exerciseKey, setIndex })
        edit(exerciseIndex, setIndex, { saving: false, loggedId: null })
      } catch (err) {
        edit(exerciseIndex, setIndex, { saving: false })
        setError(toMessage(err, 'Der Satz konnte nicht geöffnet werden.'))
      }
      return
    }

    const parsed = parseSet(set)
    if (!parsed) return setError(`Satz ${setIndex + 1}: Bitte gib Gewicht und Wiederholungen als Zahl ein.`)
    edit(exerciseIndex, setIndex, { saving: true })
    try {
      const current = await ensureWorkout()
      await logSet({ workoutId: current.id, exerciseKey, setIndex, ...parsed })
      // Lokale Kennung; geöffnet wird ein Satz über Workout, Übung und Satznummer.
      edit(exerciseIndex, setIndex, { saving: false, loggedId: `${current.id}|${exerciseKey}|${setIndex}` })
      const seconds = entry.planExercise.rest_seconds ?? DEFAULT_REST_SECONDS
      if (seconds > 0) setRest({ endsAt: Date.now() + seconds * 1000, total: seconds })
    } catch (err) {
      edit(exerciseIndex, setIndex, { saving: false })
      setError(toMessage(err, 'Der Satz konnte nicht gespeichert werden.'))
    }
  }

  async function finish(): Promise<WorkoutRow | null> {
    const current = workoutRef.current
    if (!current) return null
    setBusy(true)
    setError(null)
    try {
      const finished = await finishWorkout(current)
      setRest(null)
      workoutRef.current = finished
      setWorkout(finished)
      return finished
    } catch (err) {
      setError(toMessage(err, 'Das Training konnte nicht abgeschlossen werden.'))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function discard(): Promise<boolean> {
    const current = workoutRef.current
    if (!current) return true
    setBusy(true)
    try {
      await discardWorkout(current.id)
      return true
    } catch (err) {
      setError(toMessage(err, 'Das Training konnte nicht verworfen werden.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { workout, started, entries, rest, setRest, error, busy, start, edit, toggle, finish, discard }
}
