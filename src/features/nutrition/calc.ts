import type { Goal, Sex } from '../profile/types'

export interface NutritionInput {
  readonly sex: Sex
  readonly weightKg: number
  readonly heightCm: number
  readonly age: number
  readonly daysPerWeek: number
  readonly goal: Goal
}

export interface NutritionTarget {
  readonly bmr: number
  readonly tdee: number
  readonly kcal: number
  readonly proteinG: number
  readonly activityFactor: number
}

const SEX_OFFSET: Record<Sex, number> = { m: 5, w: -161, d: -78 }

const GOAL_KCAL_ADJUST: Record<Goal, number> = { muskelaufbau: 300, fett_verlieren: -400, fitness: 0 }
const PROTEIN_PER_KG: Record<Goal, number> = { muskelaufbau: 1.8, fett_verlieren: 2.0, fitness: 1.8 }

/** Grober Aktivitätsfaktor aus den geplanten Trainingstagen pro Woche. */
export function activityFactor(daysPerWeek: number): number {
  if (daysPerWeek <= 2) return 1.375
  if (daysPerWeek === 3) return 1.45
  if (daysPerWeek === 4) return 1.55
  if (daysPerWeek === 5) return 1.65
  return 1.725
}

/** Grundumsatz nach Mifflin-St Jeor. "d" nutzt den Mittelwert der beiden Konstanten. */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_OFFSET[sex]
}

const roundTo = (n: number, step: number): number => Math.round(n / step) * step

/** Absolute Untergrenze des Kalorienziels, unabhängig vom Rechenergebnis. */
export const MIN_KCAL: Record<Sex, number> = { w: 1200, m: 1500, d: 1500 }

/** Das Ziel fällt nie unter den Grundumsatz und nie unter die Mindestmenge (auf 10 kcal aufgerundet). */
export function kcalFloor(sex: Sex, bmr: number): number {
  return Math.ceil(Math.max(bmr, MIN_KCAL[sex]) / 10) * 10
}

export function calculateTarget(input: NutritionInput): NutritionTarget {
  const bmr = mifflinStJeor(input.sex, input.weightKg, input.heightCm, input.age)
  const factor = activityFactor(input.daysPerWeek)
  const tdee = bmr * factor
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    kcal: Math.max(roundTo(tdee + GOAL_KCAL_ADJUST[input.goal], 10), kcalFloor(input.sex, bmr)),
    proteinG: Math.round(input.weightKg * PROTEIN_PER_KG[input.goal]),
    activityFactor: factor,
  }
}

export function ageFromBirthYear(birthYear: number, today: Date): number {
  return today.getFullYear() - birthYear
}
