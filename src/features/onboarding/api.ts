import { toISODate } from '../../lib/date'
import { updateProfile } from '../profile/api'
import type { Equipment, Goal, Level, Location, ProfileRow, Sex } from '../profile/types'
import { generatePlan } from '../plan/generator'
import { savePlan } from '../plan/api'
import { fromGenerated } from '../plan/planModel'
import { upsertBodyWeight } from '../progress/api'

export interface OnboardingResult {
  readonly displayName: string
  readonly goal: Goal
  readonly level: Level
  readonly daysPerWeek: number
  readonly location: Location
  readonly equipment: readonly Equipment[]
  readonly sex: Sex
  readonly birthYear: number
  readonly heightCm: number
  readonly weightKg: number
}

/**
 * Speichert die Antworten, legt den ersten Plan an und markiert das Profil
 * erst danach als fertig. Scheitert ein Schritt, bleibt der Fragebogen offen.
 */
export async function completeOnboarding(userId: string, r: OnboardingResult): Promise<ProfileRow> {
  await updateProfile(userId, {
    display_name: r.displayName || null,
    goal: r.goal,
    level: r.level,
    days_per_week: r.daysPerWeek,
    location: r.location,
    equipment: [...r.equipment],
    sex: r.sex,
    birth_year: r.birthYear,
    height_cm: r.heightCm,
  })
  await upsertBodyWeight(toISODate(new Date()), r.weightKg)
  await savePlan(fromGenerated(generatePlan(r)))
  return updateProfile(userId, { onboarded: true })
}
