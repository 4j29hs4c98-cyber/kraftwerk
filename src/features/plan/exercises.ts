import type { Equipment } from '../profile/types'

export type MuscleGroup =
  | 'brust'
  | 'ruecken'
  | 'schultern'
  | 'quadrizeps'
  | 'beinrueckseite'
  | 'bizeps'
  | 'trizeps'
  | 'bauch'
  | 'waden'

export type ExerciseType = 'grund' | 'isolation'

export interface Exercise {
  readonly key: string
  readonly name: string
  readonly muscle: MuscleGroup
  /** Alle hier genannten Geräte werden benötigt. Leer = Körpergewicht. */
  readonly equipment: readonly Equipment[]
  readonly type: ExerciseType
  /** Gehaltene Übungen zählen Sekunden statt Wiederholungen. */
  readonly unit?: 'sekunden'
}

/** Zielbereich für gehaltene Übungen in Sekunden. */
export const HOLD_SECONDS = { min: 30, max: 60 } as const

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  quadrizeps: 'Oberschenkel vorn',
  beinrueckseite: 'Beinrückseite und Gesäß',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  bauch: 'Rumpf',
  waden: 'Waden',
}

/**
 * Reihenfolge ist bedeutsam: Der Generator nimmt bei gleicher Eignung die
 * erste passende Übung. Geräteübungen stehen deshalb vor Körpergewicht.
 */
export const EXERCISES: readonly Exercise[] = [
  // Brust
  { key: 'bankdruecken_lh', name: 'Bankdrücken (Langhantel)', muscle: 'brust', equipment: ['langhantel', 'bank'], type: 'grund' },
  { key: 'schraegbank_kh', name: 'Schrägbankdrücken (Kurzhanteln)', muscle: 'brust', equipment: ['kurzhanteln', 'bank'], type: 'grund' },
  { key: 'bankdruecken_kh', name: 'Bankdrücken (Kurzhanteln)', muscle: 'brust', equipment: ['kurzhanteln', 'bank'], type: 'grund' },
  { key: 'brustpresse', name: 'Brustpresse (Maschine)', muscle: 'brust', equipment: ['maschinen'], type: 'grund' },
  { key: 'brustpresse_band', name: 'Brustpresse mit Band', muscle: 'brust', equipment: ['baender'], type: 'grund' },
  { key: 'liegestuetze', name: 'Liegestütze', muscle: 'brust', equipment: [], type: 'grund' },
  { key: 'fliegende_kh', name: 'Fliegende (Kurzhanteln)', muscle: 'brust', equipment: ['kurzhanteln', 'bank'], type: 'isolation' },
  { key: 'kabelzug_crossover', name: 'Cable Crossover', muscle: 'brust', equipment: ['kabelzug'], type: 'isolation' },
  // Rücken
  { key: 'klimmzuege', name: 'Klimmzüge', muscle: 'ruecken', equipment: ['klimmzugstange'], type: 'grund' },
  { key: 'rudern_lh', name: 'Vorgebeugtes Rudern (Langhantel)', muscle: 'ruecken', equipment: ['langhantel'], type: 'grund' },
  { key: 'latzug', name: 'Latziehen', muscle: 'ruecken', equipment: ['kabelzug'], type: 'grund' },
  { key: 'rudern_kh', name: 'Einarmiges Rudern (Kurzhantel)', muscle: 'ruecken', equipment: ['kurzhanteln'], type: 'grund' },
  { key: 'rudern_kabel', name: 'Rudern am Kabel (sitzend)', muscle: 'ruecken', equipment: ['kabelzug'], type: 'grund' },
  { key: 'rudermaschine', name: 'Rudern (Maschine)', muscle: 'ruecken', equipment: ['maschinen'], type: 'grund' },
  { key: 'rudern_band', name: 'Rudern mit Band', muscle: 'ruecken', equipment: ['baender'], type: 'grund' },
  { key: 'tischrudern', name: 'Umgekehrtes Rudern am Tisch', muscle: 'ruecken', equipment: [], type: 'grund' },
  { key: 'pullover_kabel', name: 'Überzüge am Kabel', muscle: 'ruecken', equipment: ['kabelzug'], type: 'isolation' },
  { key: 'superman', name: 'Superman', muscle: 'ruecken', equipment: [], type: 'isolation' },
  // Schultern
  { key: 'schulterdruecken_lh', name: 'Schulterdrücken stehend (Langhantel)', muscle: 'schultern', equipment: ['langhantel'], type: 'grund' },
  { key: 'schulterdruecken_kh', name: 'Schulterdrücken (Kurzhanteln)', muscle: 'schultern', equipment: ['kurzhanteln'], type: 'grund' },
  { key: 'schulterpresse', name: 'Schulterpresse (Maschine)', muscle: 'schultern', equipment: ['maschinen'], type: 'grund' },
  { key: 'pike_liegestuetze', name: 'Pike-Liegestütze', muscle: 'schultern', equipment: [], type: 'grund' },
  { key: 'seitheben_kh', name: 'Seitheben (Kurzhanteln)', muscle: 'schultern', equipment: ['kurzhanteln'], type: 'isolation' },
  { key: 'face_pulls', name: 'Face Pulls', muscle: 'schultern', equipment: ['kabelzug'], type: 'isolation' },
  { key: 'seitheben_band', name: 'Seitheben mit Band', muscle: 'schultern', equipment: ['baender'], type: 'isolation' },
  { key: 'reverse_flys_kh', name: 'Reverse Flys (Kurzhanteln)', muscle: 'schultern', equipment: ['kurzhanteln'], type: 'isolation' },
  // Oberschenkel vorn
  { key: 'kniebeuge_lh', name: 'Kniebeuge (Langhantel)', muscle: 'quadrizeps', equipment: ['langhantel'], type: 'grund' },
  { key: 'beinpresse', name: 'Beinpresse', muscle: 'quadrizeps', equipment: ['maschinen'], type: 'grund' },
  { key: 'goblet_squat', name: 'Goblet Squat (Kurzhantel)', muscle: 'quadrizeps', equipment: ['kurzhanteln'], type: 'grund' },
  { key: 'bulgarische_kniebeuge', name: 'Bulgarische Kniebeuge', muscle: 'quadrizeps', equipment: [], type: 'grund' },
  { key: 'kniebeuge_kg', name: 'Kniebeuge (Körpergewicht)', muscle: 'quadrizeps', equipment: [], type: 'grund' },
  { key: 'ausfallschritte', name: 'Ausfallschritte', muscle: 'quadrizeps', equipment: [], type: 'grund' },
  { key: 'beinstrecker', name: 'Beinstrecker', muscle: 'quadrizeps', equipment: ['maschinen'], type: 'isolation' },
  // Beinrückseite und Gesäß
  { key: 'kreuzheben_lh', name: 'Kreuzheben (Langhantel)', muscle: 'beinrueckseite', equipment: ['langhantel'], type: 'grund' },
  { key: 'rumaenisches_kh', name: 'Rumänisches Kreuzheben (Kurzhanteln)', muscle: 'beinrueckseite', equipment: ['kurzhanteln'], type: 'grund' },
  { key: 'hip_thrust', name: 'Hip Thrust (Langhantel)', muscle: 'beinrueckseite', equipment: ['langhantel', 'bank'], type: 'grund' },
  { key: 'kreuzheben_band', name: 'Kreuzheben mit Band', muscle: 'beinrueckseite', equipment: ['baender'], type: 'grund' },
  { key: 'einbeiniges_kreuzheben', name: 'Einbeiniges Kreuzheben', muscle: 'beinrueckseite', equipment: [], type: 'grund' },
  { key: 'beinbeuger', name: 'Beinbeuger (Maschine)', muscle: 'beinrueckseite', equipment: ['maschinen'], type: 'isolation' },
  { key: 'glute_bridge', name: 'Glute Bridge', muscle: 'beinrueckseite', equipment: [], type: 'isolation' },
  // Bizeps
  { key: 'curls_lh', name: 'Bizepscurls (Langhantel)', muscle: 'bizeps', equipment: ['langhantel'], type: 'isolation' },
  { key: 'curls_kh', name: 'Bizepscurls (Kurzhanteln)', muscle: 'bizeps', equipment: ['kurzhanteln'], type: 'isolation' },
  { key: 'hammercurls', name: 'Hammercurls', muscle: 'bizeps', equipment: ['kurzhanteln'], type: 'isolation' },
  { key: 'curls_kabel', name: 'Bizepscurls am Kabel', muscle: 'bizeps', equipment: ['kabelzug'], type: 'isolation' },
  { key: 'curls_band', name: 'Bizepscurls mit Band', muscle: 'bizeps', equipment: ['baender'], type: 'isolation' },
  // Trizeps
  { key: 'trizepsdruecken_kabel', name: 'Trizepsdrücken am Kabel', muscle: 'trizeps', equipment: ['kabelzug'], type: 'isolation' },
  { key: 'ueberkopf_trizeps_kh', name: 'Trizepsstrecken über Kopf (Kurzhantel)', muscle: 'trizeps', equipment: ['kurzhanteln'], type: 'isolation' },
  { key: 'trizeps_band', name: 'Trizepsdrücken mit Band', muscle: 'trizeps', equipment: ['baender'], type: 'isolation' },
  { key: 'dips_stuhl', name: 'Dips am Stuhl', muscle: 'trizeps', equipment: [], type: 'isolation' },
  { key: 'enge_liegestuetze', name: 'Enge Liegestütze', muscle: 'trizeps', equipment: [], type: 'isolation' },
  // Rumpf
  { key: 'beinheben_haengend', name: 'Hängendes Beinheben', muscle: 'bauch', equipment: ['klimmzugstange'], type: 'isolation' },
  { key: 'kabel_crunch', name: 'Kabel-Crunch', muscle: 'bauch', equipment: ['kabelzug'], type: 'isolation' },
  { key: 'plank', name: 'Unterarmstütz (Sekunden)', muscle: 'bauch', equipment: [], type: 'isolation', unit: 'sekunden' },
  { key: 'crunches', name: 'Crunches', muscle: 'bauch', equipment: [], type: 'isolation' },
  // Waden
  { key: 'wadenheben_maschine', name: 'Wadenheben (Maschine)', muscle: 'waden', equipment: ['maschinen'], type: 'isolation' },
  { key: 'wadenheben_kh', name: 'Wadenheben (Kurzhanteln)', muscle: 'waden', equipment: ['kurzhanteln'], type: 'isolation' },
  { key: 'wadenheben', name: 'Wadenheben (Körpergewicht)', muscle: 'waden', equipment: [], type: 'isolation' },
]

const BY_KEY: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.key, e]))

export function getExercise(key: string): Exercise | undefined {
  return BY_KEY.get(key)
}

export const CUSTOM_PREFIX = 'custom:'
const SLUG_MAX = 60

export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_PREFIX)
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur a-z, 0-9 und Leerzeichen. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Schlüssel für eine eigene Übung: custom:<slug> mit slug aus a-z, 0-9 und _. */
export function customKey(name: string): string {
  const slug = normalizeName(name).replace(/ /g, '_').slice(0, SLUG_MAX).replace(/_+$/, '')
  return `${CUSTOM_PREFIX}${slug || 'uebung'}`
}

/** Anzeigename einer Planübung: eigener Name hat Vorrang vor dem Bibliotheksnamen. */
export function exerciseName(key: string, displayName?: string | null): string {
  const own = displayName?.trim()
  if (own) return own
  return BY_KEY.get(key)?.name ?? (isCustomKey(key) ? key.slice(CUSTOM_PREFIX.length).replace(/_/g, ' ') : key)
}

/** Pausenvorgabe, wenn keine angegeben ist: Grundübung 120 s, Isolation 60 s, eigene Übung 90 s. */
export const CUSTOM_REST_SECONDS = 90
export function defaultRestSeconds(key: string): number {
  const exercise = BY_KEY.get(key)
  if (!exercise) return CUSTOM_REST_SECONDS
  return exercise.type === 'grund' ? 120 : 60
}

export function isTimed(key: string): boolean {
  return BY_KEY.get(key)?.unit === 'sekunden'
}

/** Kurzbeschriftung der Zählweise: "Sek." für gehaltene Übungen, sonst "Wdh.". */
export function repsUnitLabel(key: string): string {
  return isTimed(key) ? 'Sek.' : 'Wdh.'
}

export function isAvailable(exercise: Exercise, owned: readonly Equipment[]): boolean {
  return exercise.equipment.every((item) => owned.includes(item))
}
