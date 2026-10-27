import { customKey, EXERCISES, normalizeName } from '../exercises'

/** Gängige Schreibweisen aus Trainingsplänen, normalisiert, auf Bibliotheks-Schlüssel. */
const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  latzug: ['latzug', 'lat ziehen', 'lat pulldown', 'latziehen'],
  brustpresse: ['brustpresse', 'normale brustpresse', 'chest press', 'brustpresse maschine'],
  schraegbank_kh: ['schraegbankdruecken', 'schraegbank', 'schraegbankdruecken kurzhantel', 'incline press'],
  bankdruecken_lh: ['bankdruecken', 'flachbankdruecken', 'bench press'],
  rudern_kabel: ['enges rudern', 'kabelrudern', 'rudern kabel', 'rudern am kabel', 'sitzendes rudern', 'cable row'],
  trizepsdruecken_kabel: ['trizeps pushdown', 'trizepsdruecken', 'pushdown', 'trizepsdruecken am kabel'],
  curls_lh: ['bizeps z stange', 'sz curls', 'z stangen curls', 'bizepscurls', 'langhantelcurls'],
  schulterdruecken_kh: ['schulterdruecken', 'shoulder press', 'schulterpresse kurzhantel'],
  rumaenisches_kh: ['rumaenisches kreuzheben', 'rdl', 'romanian deadlift'],
  beinheben_haengend: ['beinheben', 'haengendes beinheben', 'hanging leg raises'],
  wadenheben_maschine: ['wadenheben', 'calf raises'],
  kniebeuge_lh: ['kniebeuge', 'kniebeugen', 'squat', 'squats'],
  ausfallschritte: ['ausfallschritte', 'ausfallschritt', 'lunges'],
  klimmzuege: ['klimmzuege', 'klimmzug', 'pull ups', 'pullups'],
  face_pulls: ['face pulls', 'face pull', 'facepulls'],
  hammercurls: ['hammercurls', 'hammer curls'],
  liegestuetze: ['liegestuetze', 'liegestuetz', 'push ups', 'pushups'],
  kreuzheben_lh: ['kreuzheben', 'deadlift'],
  plank: ['plank', 'planks', 'unterarmstuetz'],
  crunches: ['crunches', 'crunch'],
  beinpresse: ['beinpresse', 'leg press'],
  beinstrecker: ['beinstrecker', 'leg extension'],
  beinbeuger: ['beinbeuger', 'leg curl', 'leg curls'],
  seitheben_kh: ['seitheben', 'lateral raises', 'seitheben kurzhantel'],
  hip_thrust: ['hip thrust', 'hip thrusts'],
}

/** Klammerzusätze wie "(Obergriff)" oder "(KH oder Multipresse)" entfernen. */
const withoutParentheses = (name: string): string => name.replace(/\([^)]*\)/g, ' ')

function buildAliases(): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  const add = (alias: string, key: string) => {
    if (alias && !map.has(alias)) map.set(alias, key)
  }
  for (const e of EXERCISES) add(normalizeName(e.name), e.key)
  for (const [key, aliases] of Object.entries(SYNONYMS)) for (const alias of aliases) add(alias, key)
  // Grundnamen der Bibliothek ohne Klammer, die erste Übung gewinnt (Geräteübungen stehen vorn).
  for (const e of EXERCISES) add(normalizeName(withoutParentheses(e.name)), e.key)
  return map
}

const ALIASES = buildAliases()

export interface ExerciseMatch {
  readonly key: string
  readonly isCustom: boolean
}

/**
 * Ordnet einen Übungsnamen aus einer Tabelle einem Bibliotheks-Schlüssel zu:
 * zuerst der ganze Name, dann ohne Klammerzusatz. Kombinationen wie
 * "Planks / Crunches" werden nie zugeordnet, "Pushdown (Kabel/Seil)" schon. Sonst custom:<slug>.
 */
export function matchExercise(name: string): ExerciseMatch {
  // Ein Schrägstrich im Namen selbst (nicht im Klammerzusatz) heißt: mehrere Übungen in einer Zeile.
  if (!withoutParentheses(name).includes('/')) {
    const key = ALIASES.get(normalizeName(name)) ?? ALIASES.get(normalizeName(withoutParentheses(name)))
    if (key) return { key, isCustom: false }
  }
  return { key: customKey(name), isCustom: true }
}
