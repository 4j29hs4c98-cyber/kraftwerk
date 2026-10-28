import type { CreatePlanArgs } from '../../lib/rpc'
import { getExercise, isCustomKey } from './exercises'
import type { GeneratedPlan } from './generator'

/** Grenzen wie in create_plan und den Tabellen-Checks der Datenbank. */
export const PLAN_LIMITS = {
  maxDays: 7,
  maxExercisesPerDay: 15,
  planNameMax: 100,
  splitMax: 60,
  dayTitleMax: 60,
  displayNameMax: 80,
  notesMax: 300,
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  rest: { min: 0, max: 1800 },
  startWeightKg: { min: 0, max: 1000 },
} as const

const KEY_PATTERN = /^(custom:)?[a-z0-9_]{1,60}$/

export interface NewPlanExercise {
  readonly exerciseKey: string
  readonly sets: number
  readonly repMin: number
  readonly repMax: number
  readonly restSeconds: number
  readonly displayName?: string | null
  readonly notes?: string | null
  /** Startgewicht für das erste Training ohne Verlauf (0 bis 1000 kg). */
  readonly startWeightKg?: number | null
}

export interface NewPlanDay {
  readonly title: string
  readonly exercises: readonly NewPlanExercise[]
  /** 0 = Montag bis 6 = Sonntag; entweder alle Tage eines Plans oder keiner. */
  readonly weekday?: number | null
  /** Ruhetage haben keine Übungen. */
  readonly isRest?: boolean
}

export interface NewPlan {
  readonly name: string
  readonly split: string
  readonly days: readonly NewPlanDay[]
}

export function fromGenerated(plan: GeneratedPlan): NewPlan {
  return { name: plan.name, split: plan.split, days: plan.days }
}

const inRange = (n: number, r: { readonly min: number; readonly max: number }): boolean => Number.isInteger(n) && n >= r.min && n <= r.max

function exerciseErrors(ex: NewPlanExercise, where: string): string[] {
  const errors: string[] = []
  const name = ex.displayName?.trim() ?? ''
  if (!KEY_PATTERN.test(ex.exerciseKey)) errors.push(`${where}: Ungültiger Übungsschlüssel.`)
  if (!isCustomKey(ex.exerciseKey) && !getExercise(ex.exerciseKey)) errors.push(`${where}: Unbekannte Übung.`)
  if (isCustomKey(ex.exerciseKey) && name === '') errors.push(`${where}: Eigene Übungen brauchen einen Namen.`)
  if (name.length > PLAN_LIMITS.displayNameMax) errors.push(`${where}: Der Name darf höchstens ${PLAN_LIMITS.displayNameMax} Zeichen lang sein.`)
  if ((ex.notes?.length ?? 0) > PLAN_LIMITS.notesMax) errors.push(`${where}: Der Hinweis darf höchstens ${PLAN_LIMITS.notesMax} Zeichen lang sein.`)
  if (!inRange(ex.sets, PLAN_LIMITS.sets)) errors.push(`${where}: Sätze müssen zwischen ${PLAN_LIMITS.sets.min} und ${PLAN_LIMITS.sets.max} liegen.`)
  if (!inRange(ex.repMin, PLAN_LIMITS.reps) || !inRange(ex.repMax, PLAN_LIMITS.reps)) {
    errors.push(`${where}: Wiederholungen müssen zwischen ${PLAN_LIMITS.reps.min} und ${PLAN_LIMITS.reps.max} liegen.`)
  } else if (ex.repMin > ex.repMax) {
    errors.push(`${where}: "Wdh. von" darf nicht größer sein als "Wdh. bis".`)
  }
  const start = ex.startWeightKg
  if (start !== null && start !== undefined && !(Number.isFinite(start) && start >= PLAN_LIMITS.startWeightKg.min && start <= PLAN_LIMITS.startWeightKg.max)) {
    errors.push(`${where}: Das Startgewicht muss zwischen 0 und ${PLAN_LIMITS.startWeightKg.max} kg liegen.`)
  }
  if (!inRange(ex.restSeconds, PLAN_LIMITS.rest)) errors.push(`${where}: Die Pause muss zwischen 0 und ${PLAN_LIMITS.rest.max} Sekunden liegen.`)
  return errors
}

function dayErrors(day: NewPlanDay, index: number): string[] {
  const label = `Tag ${index + 1}${day.title.trim() ? ` (${day.title.trim()})` : ''}`
  const errors: string[] = []
  if (day.title.trim() === '') errors.push(`${label}: Bitte gib dem Tag einen Namen.`)
  if (day.title.trim().length > PLAN_LIMITS.dayTitleMax) errors.push(`${label}: Der Name darf höchstens ${PLAN_LIMITS.dayTitleMax} Zeichen lang sein.`)
  if (day.isRest) {
    if (day.exercises.length > 0) errors.push(`${label}: Ein Ruhetag hat keine Übungen.`)
    return errors
  }
  if (day.exercises.length === 0) errors.push(`${label}: Mindestens eine Übung ist nötig.`)
  if (day.exercises.length > PLAN_LIMITS.maxExercisesPerDay) errors.push(`${label}: Höchstens ${PLAN_LIMITS.maxExercisesPerDay} Übungen pro Tag.`)
  const keys = day.exercises.map((e) => e.exerciseKey)
  if (new Set(keys).size !== keys.length) errors.push(`${label}: Eine Übung kommt doppelt vor. Jede Übung darf pro Tag nur einmal im Plan stehen.`)
  return [...errors, ...day.exercises.flatMap((ex, i) => exerciseErrors(ex, `${label}, Übung ${i + 1}`))]
}

/** Prüft einen Plan gegen die Regeln von create_plan. Leere Liste = gültig. */
export function validatePlan(plan: NewPlan): string[] {
  const errors: string[] = []
  const name = plan.name.trim()
  if (name === '' || name.length > PLAN_LIMITS.planNameMax) errors.push(`Der Planname muss 1 bis ${PLAN_LIMITS.planNameMax} Zeichen lang sein.`)
  if (plan.split.length > PLAN_LIMITS.splitMax) errors.push('Die Split-Bezeichnung ist zu lang.')
  if (plan.days.length === 0) errors.push('Der Plan braucht mindestens einen Trainingstag.')
  if (plan.days.length > PLAN_LIMITS.maxDays) errors.push(`Höchstens ${PLAN_LIMITS.maxDays} Tage pro Plan.`)
  if (plan.days.length > 0 && plan.days.every((d) => d.isRest)) errors.push('Der Plan braucht mindestens einen Trainingstag.')
  return [...errors, ...weekdayErrors(plan.days), ...plan.days.flatMap(dayErrors)]
}

/** Wie create_plan: entweder alle Tage mit Wochentag oder keiner, jeder Wochentag höchstens einmal. */
function weekdayErrors(days: readonly NewPlanDay[]): string[] {
  const weekdays = days.map((d) => d.weekday ?? null).filter((w): w is number => w !== null)
  if (weekdays.length === 0) return []
  const errors: string[] = []
  if (weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) errors.push('Ungültiger Wochentag.')
  if (weekdays.length !== days.length) errors.push('Entweder bekommen alle Tage einen Wochentag oder keiner.')
  if (new Set(weekdays).size !== weekdays.length) errors.push('Jeder Wochentag darf nur einmal im Plan vorkommen.')
  return errors
}

/** Tage mit Wochentag werden von Montag bis Sonntag gespeichert, sonst in der gegebenen Reihenfolge. */
export function orderDays<T extends NewPlanDay>(days: readonly T[]): readonly T[] {
  const allWeekdays = days.length > 0 && days.every((d) => d.weekday !== null && d.weekday !== undefined)
  return allWeekdays ? [...days].sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0)) : days
}

const emptyToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

export function toCreatePlanArgs(plan: NewPlan): CreatePlanArgs {
  return {
    p_name: plan.name.trim(),
    p_split: plan.split,
    p_days: orderDays(plan.days).map((day, dayIndex) => ({
      day_index: dayIndex,
      weekday: day.weekday ?? null,
      title: day.title.trim(),
      is_rest: day.isRest ?? false,
      exercises: (day.isRest ? [] : day.exercises).map((ex, position) => ({
        exercise_key: ex.exerciseKey,
        position,
        sets: ex.sets,
        rep_min: ex.repMin,
        rep_max: ex.repMax,
        rest_seconds: ex.restSeconds,
        display_name: emptyToNull(ex.displayName),
        notes: emptyToNull(ex.notes),
        start_weight_kg: ex.startWeightKg ?? null,
      })),
    })),
  }
}
