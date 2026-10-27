import type { Tables } from '../../types/database'

export type Goal = 'muskelaufbau' | 'fett_verlieren' | 'fitness'
export type Level = 'anfaenger' | 'fortgeschritten' | 'profi'
export type Sex = 'm' | 'w' | 'd'
export type Location = 'home' | 'gym'
export type Equipment =
  | 'kurzhanteln'
  | 'langhantel'
  | 'klimmzugstange'
  | 'baender'
  | 'bank'
  | 'kabelzug'
  | 'maschinen'

export const GOALS: readonly Goal[] = ['muskelaufbau', 'fett_verlieren', 'fitness']
export const LEVELS: readonly Level[] = ['anfaenger', 'fortgeschritten', 'profi']
export const SEXES: readonly Sex[] = ['m', 'w', 'd']
export const LOCATIONS: readonly Location[] = ['home', 'gym']
export const ALL_EQUIPMENT: readonly Equipment[] = [
  'kurzhanteln',
  'langhantel',
  'klimmzugstange',
  'baender',
  'bank',
  'kabelzug',
  'maschinen',
]
export const MIN_DAYS = 2
export const MAX_DAYS = 6

export const GOAL_LABELS: Record<Goal, string> = {
  muskelaufbau: 'Muskeln aufbauen',
  fett_verlieren: 'Fett verlieren',
  fitness: 'Fitter werden',
}
export const LEVEL_LABELS: Record<Level, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  profi: 'Profi',
}
export const SEX_LABELS: Record<Sex, string> = { m: 'Männlich', w: 'Weiblich', d: 'Divers' }
export const LOCATION_LABELS: Record<Location, string> = { home: 'Zuhause', gym: 'Fitnessstudio' }
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  kurzhanteln: 'Kurzhanteln',
  langhantel: 'Langhantel',
  klimmzugstange: 'Klimmzugstange',
  baender: 'Widerstandsbänder',
  bank: 'Bank',
  kabelzug: 'Kabelzug',
  maschinen: 'Maschinen',
}

export type ProfileRow = Tables<'profiles'>

/** Vollständig ausgefülltes Profil, wie es nach dem Onboarding vorliegt. */
export interface TrainingProfile {
  readonly goal: Goal
  readonly level: Level
  readonly daysPerWeek: number
  readonly location: Location
  readonly equipment: readonly Equipment[]
}

export interface BodyProfile {
  readonly sex: Sex
  readonly birthYear: number
  readonly heightCm: number
}

function oneOf<T extends string>(values: readonly T[], value: string | null): T | null {
  return value !== null && (values as readonly string[]).includes(value) ? (value as T) : null
}

export function parseEquipment(values: readonly string[]): Equipment[] {
  return values.filter((v): v is Equipment => (ALL_EQUIPMENT as readonly string[]).includes(v))
}

export function toTrainingProfile(row: ProfileRow): TrainingProfile | null {
  const goal = oneOf(GOALS, row.goal)
  const level = oneOf(LEVELS, row.level)
  const location = oneOf(LOCATIONS, row.location)
  const days = row.days_per_week
  if (!goal || !level || !location || days === null) return null
  return { goal, level, location, daysPerWeek: days, equipment: parseEquipment(row.equipment) }
}

export function toBodyProfile(row: ProfileRow): BodyProfile | null {
  const sex = oneOf(SEXES, row.sex)
  if (!sex || row.birth_year === null || row.height_cm === null) return null
  return { sex, birthYear: row.birth_year, heightCm: row.height_cm }
}
