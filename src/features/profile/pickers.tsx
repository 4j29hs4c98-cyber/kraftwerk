import { ChoiceTile } from '../../components/ChoiceTile'
import {
  ALL_EQUIPMENT,
  EQUIPMENT_LABELS,
  GOAL_LABELS,
  GOALS,
  LEVEL_LABELS,
  LEVELS,
  LOCATION_LABELS,
  LOCATIONS,
  MAX_DAYS,
  MIN_DAYS,
  SEX_LABELS,
  SEXES,
  type Equipment,
  type Goal,
  type Level,
  type Location,
  type Sex,
} from './types'

const GOAL_HINTS: Record<Goal, string> = {
  muskelaufbau: 'Mehr Kraft und sichtbar mehr Muskeln',
  fett_verlieren: 'Körperfett reduzieren, Muskeln halten',
  fitness: 'Allgemein fitter, belastbarer und beweglicher',
}
const LEVEL_HINTS: Record<Level, string> = {
  anfaenger: 'Weniger als ein Jahr regelmäßiges Training',
  fortgeschritten: 'Ein bis drei Jahre, die Grundübungen sitzen',
  profi: 'Mehr als drei Jahre strukturiertes Training',
}
const LOCATION_HINTS: Record<Location, string> = {
  home: 'Mit dem, was du zuhause hast, oder ganz ohne Geräte',
  gym: 'Volle Auswahl an Geräten',
}

interface PickerProps<T> {
  readonly value: T | null
  readonly onChange: (value: T) => void
}

function Group({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {children}
    </div>
  )
}

export function GoalPicker({ value, onChange }: PickerProps<Goal>) {
  return (
    <Group label="Ziel">
      {GOALS.map((g) => (
        <ChoiceTile key={g} selected={value === g} onSelect={() => onChange(g)} title={GOAL_LABELS[g]} description={GOAL_HINTS[g]} />
      ))}
    </Group>
  )
}

export function LevelPicker({ value, onChange }: PickerProps<Level>) {
  return (
    <Group label="Erfahrung">
      {LEVELS.map((l) => (
        <ChoiceTile key={l} selected={value === l} onSelect={() => onChange(l)} title={LEVEL_LABELS[l]} description={LEVEL_HINTS[l]} />
      ))}
    </Group>
  )
}

export function LocationPicker({ value, onChange }: PickerProps<Location>) {
  return (
    <Group label="Trainingsort">
      {LOCATIONS.map((l) => (
        <ChoiceTile key={l} selected={value === l} onSelect={() => onChange(l)} title={LOCATION_LABELS[l]} description={LOCATION_HINTS[l]} />
      ))}
    </Group>
  )
}

export function SexPicker({ value, onChange }: PickerProps<Sex>) {
  return (
    <div role="radiogroup" aria-label="Geschlecht" className="grid grid-cols-3 gap-2">
      {SEXES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={`min-h-12 rounded-xl border font-semibold transition ${value === s ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface-2 text-ink'}`}
        >
          {SEX_LABELS[s]}
        </button>
      ))}
    </div>
  )
}

export function DaysPicker({ value, onChange }: PickerProps<number>) {
  const options = Array.from({ length: MAX_DAYS - MIN_DAYS + 1 }, (_, i) => MIN_DAYS + i)
  return (
    <div role="radiogroup" aria-label="Trainingstage pro Woche" className="grid grid-cols-5 gap-2">
      {options.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          aria-label={`${d} Tage`}
          onClick={() => onChange(d)}
          className={`min-h-16 rounded-2xl border font-display text-3xl font-bold transition ${value === d ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink hover:border-muted'}`}
        >
          {d}
        </button>
      ))}
    </div>
  )
}

export function EquipmentPicker({ value, onChange }: { readonly value: readonly Equipment[]; readonly onChange: (v: Equipment[]) => void }) {
  const toggle = (item: Equipment) =>
    onChange(value.includes(item) ? value.filter((v) => v !== item) : ALL_EQUIPMENT.filter((e) => e === item || value.includes(e)))
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ALL_EQUIPMENT.map((e) => (
        <ChoiceTile key={e} multi selected={value.includes(e)} onSelect={() => toggle(e)} title={EQUIPMENT_LABELS[e]} />
      ))}
    </div>
  )
}

export const DAYS_HINT: Record<number, string> = {
  2: 'Zwei Ganzkörper-Einheiten, A und B im Wechsel',
  3: 'Drei Ganzkörper-Einheiten, A und B im Wechsel',
  4: 'Oberkörper und Unterkörper, je zweimal',
  5: 'Push, Pull, Beine plus Ober- und Unterkörper',
  6: 'Push, Pull, Beine, zweimal pro Woche',
}
