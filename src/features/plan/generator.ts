import type { Equipment, Goal, Level, TrainingProfile } from '../profile/types'
import { EXERCISES, HOLD_SECONDS, isAvailable, type Exercise, type ExerciseType, type MuscleGroup } from './exercises'

export interface GeneratedExercise {
  readonly exerciseKey: string
  readonly sets: number
  readonly repMin: number
  readonly repMax: number
  readonly restSeconds: number
}

export interface GeneratedDay {
  readonly title: string
  readonly exercises: readonly GeneratedExercise[]
}

export interface GeneratedPlan {
  readonly name: string
  readonly split: SplitKey
  readonly days: readonly GeneratedDay[]
}

export type SplitKey = 'ganzkoerper' | 'ober_unter' | 'ppl_ober_unter' | 'ppl'

interface Slot {
  readonly muscle: MuscleGroup
  readonly type: ExerciseType
  /** Wählt bei mehreren passenden Übungen die n-te, damit A- und B-Tage variieren. */
  readonly variant: number
  /** Darf auf den anderen Übungstyp ausweichen, wenn keine passende Übung verfügbar ist. */
  readonly fallback: boolean
}

interface DayTemplate {
  readonly title: string
  readonly slots: readonly Slot[]
}

const s = (muscle: MuscleGroup, type: ExerciseType, variant = 0, fallback = true): Slot => ({ muscle, type, variant, fallback })

const FULL_BODY_A: DayTemplate = {
  title: 'Ganzkörper A',
  slots: [s('quadrizeps', 'grund'), s('brust', 'grund'), s('ruecken', 'grund'), s('beinrueckseite', 'grund'), s('schultern', 'isolation'), s('bauch', 'isolation')],
}
const FULL_BODY_B: DayTemplate = {
  title: 'Ganzkörper B',
  slots: [s('beinrueckseite', 'grund', 1), s('schultern', 'grund'), s('ruecken', 'grund', 1), s('quadrizeps', 'grund', 1), s('brust', 'grund', 1), s('bizeps', 'isolation'), s('trizeps', 'isolation')],
}
const upper = (title: string, v: number): DayTemplate => ({
  title,
  slots: [s('brust', 'grund', v), s('ruecken', 'grund', v), s('schultern', 'grund', v), s('ruecken', 'grund', v + 1), s('schultern', 'isolation', v), s('bizeps', 'isolation', v), s('trizeps', 'isolation', v)],
})
const lower = (title: string, v: number): DayTemplate => ({
  title,
  slots: [s('quadrizeps', 'grund', v), s('beinrueckseite', 'grund', v), s('quadrizeps', 'grund', v + 1), s('beinrueckseite', 'isolation', v), s('waden', 'isolation', v), s('bauch', 'isolation', v)],
})
const push = (title: string, v: number): DayTemplate => ({
  title,
  slots: [s('brust', 'grund', v), s('schultern', 'grund', v), s('brust', 'grund', v + 1), s('brust', 'isolation', v), s('schultern', 'isolation', v), s('trizeps', 'isolation', v)],
})
const pull = (title: string, v: number): DayTemplate => ({
  title,
  // Kein Ausweichen bei den Schultern: sonst landet ohne Geräte eine Druckübung am Zugtag.
  slots: [s('ruecken', 'grund', v), s('ruecken', 'grund', v + 1), s('ruecken', 'isolation', v), s('schultern', 'isolation', v + 1, false), s('bizeps', 'isolation', v), s('bizeps', 'isolation', v + 1)],
})
const legs = (title: string, v: number): DayTemplate => ({
  title,
  slots: [s('quadrizeps', 'grund', v), s('beinrueckseite', 'grund', v), s('quadrizeps', 'grund', v + 1), s('beinrueckseite', 'isolation', v), s('waden', 'isolation', v), s('bauch', 'isolation', v)],
})

interface SplitDefinition {
  readonly key: SplitKey
  readonly name: string
  readonly days: readonly DayTemplate[]
}

/**
 * Bei 2 und 3 Tagen enthält der Plan nur die Tage A und B. Weil der nächste
 * Trainingstag nach dem letzten abgeschlossenen Workout rotiert, wechseln sich
 * A und B auch bei drei Einheiten pro Woche sauber ab (ABA, BAB, ...).
 */
const FULL_BODY: SplitDefinition = { key: 'ganzkoerper', name: 'Ganzkörper A/B', days: [FULL_BODY_A, FULL_BODY_B] }

export function splitForDays(daysPerWeek: number): SplitDefinition {
  if (daysPerWeek <= 3) return FULL_BODY
  if (daysPerWeek === 4) {
    return {
      key: 'ober_unter',
      name: 'Oberkörper / Unterkörper',
      days: [upper('Oberkörper A', 0), lower('Unterkörper A', 0), upper('Oberkörper B', 1), lower('Unterkörper B', 1)],
    }
  }
  if (daysPerWeek === 5) {
    return {
      key: 'ppl_ober_unter',
      name: 'Push / Pull / Beine + Ober / Unter',
      days: [push('Push', 0), pull('Pull', 0), legs('Beine', 0), upper('Oberkörper', 1), lower('Unterkörper', 1)],
    }
  }
  return {
    key: 'ppl',
    name: 'Push / Pull / Beine (2x)',
    days: [push('Push A', 0), pull('Pull A', 0), legs('Beine A', 0), push('Push B', 1), pull('Pull B', 1), legs('Beine B', 1)],
  }
}

interface Volume {
  readonly sets: number
  readonly repMin: number
  readonly repMax: number
  readonly restSeconds: number
}

const MIN_SETS = 2

export function volumeFor(goal: Goal, level: Level, type: ExerciseType): Volume {
  const isCompound = type === 'grund'
  const base: Volume = (() => {
    switch (goal) {
      case 'muskelaufbau':
        return { sets: isCompound ? 4 : 3, repMin: 8, repMax: 12, restSeconds: isCompound ? (level === 'profi' ? 150 : 120) : 60 }
      case 'fett_verlieren':
        return { sets: 3, repMin: 10, repMax: 15, restSeconds: isCompound ? 90 : 45 }
      case 'fitness':
        return { sets: 3, repMin: 8, repMax: 15, restSeconds: isCompound ? 90 : 60 }
    }
  })()
  const sets = level === 'anfaenger' ? Math.max(MIN_SETS, base.sets - 1) : base.sets
  return { ...base, sets }
}

function candidatesFor(slot: Slot, type: ExerciseType, owned: readonly Equipment[], used: ReadonlySet<string>): Exercise[] {
  return EXERCISES.filter((e) => e.muscle === slot.muscle && e.type === type && !used.has(e.key) && isAvailable(e, owned))
}

function pickExercise(slot: Slot, owned: readonly Equipment[], used: ReadonlySet<string>): Exercise | null {
  const otherType: ExerciseType = slot.type === 'grund' ? 'isolation' : 'grund'
  const preferred = candidatesFor(slot, slot.type, owned, used)
  const pool = preferred.length > 0 || !slot.fallback ? preferred : candidatesFor(slot, otherType, owned, used)
  if (pool.length === 0) return null
  return pool[slot.variant % pool.length] ?? null
}

function buildDay(template: DayTemplate, profile: TrainingProfile): GeneratedDay {
  const exercises = template.slots.reduce<{ used: ReadonlySet<string>; list: readonly GeneratedExercise[] }>(
    (acc, slot) => {
      const exercise = pickExercise(slot, profile.equipment, acc.used)
      if (!exercise) return acc
      const base = volumeFor(profile.goal, profile.level, exercise.type)
      const volume = exercise.unit === 'sekunden' ? { ...base, repMin: HOLD_SECONDS.min, repMax: HOLD_SECONDS.max } : base
      return {
        used: new Set([...acc.used, exercise.key]),
        list: [...acc.list, { exerciseKey: exercise.key, ...volume }],
      }
    },
    { used: new Set<string>(), list: [] },
  ).list
  return { title: template.title, exercises }
}

/** Unter dieser Zahl an Übungen ist ein Trainingstag zu dünn für einen geteilten Plan. */
export const MIN_EXERCISES_PER_DAY = 4

function buildPlan(split: SplitDefinition, profile: TrainingProfile): GeneratedPlan {
  return { name: split.name, split: split.key, days: split.days.map((template) => buildDay(template, profile)) }
}

/**
 * Reine, deterministische Funktion: gleiches Profil ergibt immer den gleichen Plan.
 * Reicht die Ausrüstung für einen geteilten Plan nicht (ein Tag hätte weniger als
 * vier Übungen, typisch ohne Geräte), wird auf Ganzkörper A/B ausgewichen. Mehr als
 * drei Ganzkörpertage pro Woche sind dann nicht sinnvoll, der Hinweis steht im Plan.
 */
export function generatePlan(profile: TrainingProfile): GeneratedPlan {
  const split = splitForDays(profile.daysPerWeek)
  const plan = buildPlan(split, profile)
  if (split.key === 'ganzkoerper' || plan.days.every((d) => d.exercises.length >= MIN_EXERCISES_PER_DAY)) return plan
  return buildPlan(FULL_BODY, profile)
}

/** Index des nächsten fälligen Trainingstags, rotierend nach dem letzten abgeschlossenen. */
export function nextDayIndex(dayCount: number, lastCompletedIndex: number | null): number {
  if (dayCount <= 0) return 0
  if (lastCompletedIndex === null || lastCompletedIndex < 0) return 0
  return (lastCompletedIndex + 1) % dayCount
}
