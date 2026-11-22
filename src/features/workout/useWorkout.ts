import { useRef, useState } from 'react'
import { toMessage } from '../../lib/supabase'
import type { PlanDay } from '../plan/api'
import { deleteSet, discardWorkout, fetchLastSets, finishWorkout, logSet, startWorkout, type WorkoutRow } from './api'
import { clearLayout, saveLayout } from './layout'
import type { RestState } from './RestTimer'
import {
  addSet,
  adHocSpec,
  appendExercise,
  buildEntry,
  hasLoggedSets,
  hasSavingSet,
  loggedKeysToDelete,
  parseSet,
  removeLastSet,
  swapExercise,
  updateSetByUid,
  type ExerciseEntry,
  type ExercisePick,
  type SetEntry,
} from './session'

const DEFAULT_REST_SECONDS = 90

export function useWorkout(day: PlanDay, initialEntries: readonly ExerciseEntry[], initialWorkout: WorkoutRow | null) {
  const [workout, setWorkout] = useState<WorkoutRow | null>(initialWorkout)
  const [entries, setEntriesState] = useState<readonly ExerciseEntry[]>(initialEntries)
  const [rest, setRest] = useState<RestState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Übungen (uid), an denen gerade getauscht oder gelöscht wird: sie nehmen keine weiteren Eingaben an.
  const [busyUids, setBusyUids] = useState<readonly string[]>([])
  // Das Workout entsteht erst mit dem ersten abgehakten Satz (lokal sofort, auf dem Server beim nächsten Abgleich).
  const [started, setStarted] = useState(initialWorkout !== null)
  const creating = useRef<Promise<WorkoutRow> | null>(null)
  // Aktueller Stand auch für schnell hintereinander abgehakte Sätze, bevor React neu gerendert hat.
  const workoutRef = useRef<WorkoutRow | null>(initialWorkout)
  const entriesRef = useRef<readonly ExerciseEntry[]>(initialEntries)
  const busyRef = useRef<ReadonlySet<string>>(new Set())

  /** Wendet eine Änderung auf den aktuellen Stand an (nie auf einen veralteten) und merkt sich auf Wunsch den Aufbau. */
  function apply(fn: (prev: readonly ExerciseEntry[]) => readonly ExerciseEntry[], persist = false) {
    entriesRef.current = fn(entriesRef.current)
    setEntriesState(entriesRef.current)
    const current = workoutRef.current
    if (persist && current) saveLayout(current.id, entriesRef.current)
  }

  const edit = (uid: string, setIndex: number, patch: Partial<SetEntry>) => apply((prev) => updateSetByUid(prev, uid, setIndex, patch))

  function markBusy(uid: string, on: boolean) {
    const next = new Set(busyRef.current)
    if (on) next.add(uid)
    else next.delete(uid)
    busyRef.current = next
    setBusyUids([...next])
  }

  const findEntry = (uid: string) => entriesRef.current.find((e) => e.uid === uid)
  const isLocked = (entry: ExerciseEntry) => busyRef.current.has(entry.uid) || hasSavingSet(entry)

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
          // Ab jetzt gibt es ein Workout: den bisherigen Aufbau (Tausch, neue Übungen) festhalten.
          saveLayout(row.id, entriesRef.current)
          return row
        })
        .finally(() => {
          creating.current = null
        })
    }
    return creating.current
  }

  async function toggle(uid: string, setIndex: number) {
    const entry = findEntry(uid)
    const set = entry?.sets[setIndex]
    if (!started || !entry || !set || set.saving || busyRef.current.has(uid)) return
    setError(null)

    const exerciseKey = entry.key
    if (set.loggedId !== null) {
      const current = workoutRef.current
      if (!current) return
      edit(uid, setIndex, { saving: true })
      try {
        await deleteSet({ workoutId: current.id, exerciseKey, setIndex })
        edit(uid, setIndex, { saving: false, loggedId: null })
      } catch (err) {
        edit(uid, setIndex, { saving: false })
        setError(toMessage(err, 'Der Satz konnte nicht geöffnet werden.'))
      }
      return
    }

    const parsed = parseSet(set)
    if (!parsed) return setError(`Satz ${setIndex + 1}: Bitte gib Gewicht und Wiederholungen als Zahl ein.`)
    edit(uid, setIndex, { saving: true })
    try {
      const current = await ensureWorkout()
      await logSet({ workoutId: current.id, exerciseKey, setIndex, ...parsed })
      // Lokale Kennung; geöffnet wird ein Satz über Workout, Übung und Satznummer.
      edit(uid, setIndex, { saving: false, loggedId: `${current.id}|${exerciseKey}|${setIndex}` })
      const seconds = entry.restSeconds ?? DEFAULT_REST_SECONDS
      if (seconds > 0) setRest({ endsAt: Date.now() + seconds * 1000, total: seconds })
    } catch (err) {
      edit(uid, setIndex, { saving: false })
      setError(toMessage(err, 'Der Satz konnte nicht gespeichert werden.'))
    }
  }

  /** Löscht abgehakte Sätze einer Übung über den normalen Löschpfad (auch offline); bei einem Fehler bleibt der Rest abgehakt. */
  async function clearLogged(uid: string, onlyLast = false): Promise<boolean> {
    const entry = findEntry(uid)
    const current = workoutRef.current
    if (!entry || hasSavingSet(entry)) return false
    const indices = loggedKeysToDelete(entry)
    for (const setIndex of onlyLast ? indices.slice(-1) : indices) {
      if (!current) return false
      try {
        await deleteSet({ workoutId: current.id, exerciseKey: entry.key, setIndex })
        edit(uid, setIndex, { loggedId: null })
      } catch (err) {
        setError(toMessage(err, 'Die Sätze konnten nicht gelöscht werden.'))
        return false
      }
    }
    return true
  }

  /** Neuer Eintrag für eine gewählte Übung inklusive Vorschlag aus dem letzten Mal; null bei Dublette oder Fehler. */
  async function prepareEntry(pick: ExercisePick, ignoreUid?: string): Promise<ExerciseEntry | null> {
    if (entriesRef.current.some((e) => e.key === pick.key && e.uid !== ignoreUid)) {
      setError('Diese Übung ist in diesem Training schon dabei.')
      return null
    }
    try {
      const history = (await fetchLastSets([pick.key])).get(pick.key) ?? []
      return buildEntry(adHocSpec(pick), history, [])
    } catch (err) {
      setError(toMessage(err, 'Die Übung konnte nicht geladen werden.'))
      return null
    }
  }

  /** Tauscht eine Übung nur für heute; geloggte Sätze der alten Übung werden vorher gelöscht (Bestätigung im Aufrufer). */
  async function swap(uid: string, pick: ExercisePick) {
    const entry = findEntry(uid)
    if (!entry || pick.key === entry.key || isLocked(entry)) return
    setError(null)
    markBusy(uid, true)
    try {
      const fresh = await prepareEntry(pick, uid)
      if (!fresh) return
      if (hasLoggedSets(findEntry(uid) ?? entry) && !(await clearLogged(uid))) return
      // Zwischenzeitlich kann dieselbe Übung anderswo dazugekommen sein: dann wird nicht getauscht.
      const before = entriesRef.current
      apply((prev) => swapExercise(prev, uid, fresh), true)
      if (!entriesRef.current.some((e) => e.uid === fresh.uid) && before.some((e) => e.uid === uid)) {
        setError('Diese Übung ist in diesem Training schon dabei.')
      }
    } finally {
      markBusy(uid, false)
    }
  }

  async function addExercise(pick: ExercisePick) {
    setError(null)
    const fresh = await prepareEntry(pick)
    if (!fresh) return
    if (entriesRef.current.some((e) => e.key === fresh.key)) return setError('Diese Übung ist in diesem Training schon dabei.')
    apply((prev) => appendExercise(prev, fresh), true)
  }

  function addSetTo(uid: string) {
    const entry = findEntry(uid)
    if (!entry || busyRef.current.has(uid)) return
    apply((prev) => addSet(prev, prev.findIndex((e) => e.uid === uid)), true)
  }

  /** Entfernt den letzten Satz; ein abgehakter wird zuerst gelöscht (Bestätigung im Aufrufer). */
  async function removeSet(uid: string) {
    const entry = findEntry(uid)
    if (!entry || entry.sets.length <= 1 || isLocked(entry)) return
    setError(null)
    markBusy(uid, true)
    try {
      const last = entry.sets[entry.sets.length - 1]
      if (last?.loggedId !== null && !(await clearLogged(uid, true))) return
      apply((prev) => removeLastSet(prev, prev.findIndex((e) => e.uid === uid)), true)
    } finally {
      markBusy(uid, false)
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
      clearLayout(current.id)
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
      clearLayout(current.id)
      return true
    } catch (err) {
      setError(toMessage(err, 'Das Training konnte nicht verworfen werden.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { workout, started, entries, busyUids, rest, setRest, error, busy, start, edit, toggle, swap, addExercise, addSetTo, removeSet, finish, discard }
}
