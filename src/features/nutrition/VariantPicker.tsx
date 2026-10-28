import { useEffect, useRef, useState } from 'react'
import { IconCheck } from '../../app/icons'
import { Button } from '../../components/Button'
import { InlineError } from '../../components/States'
import type { FoodEntry, FoodValues, PlannedMeal } from './api'
import { FoodForm } from './FoodForm'
import { toFoodForm } from './foodInput'
import { SLOT_LABELS, type MealSlot } from './mealPlan/model'
import { budgetFit, remainingBudget, selectedVariant, sumItems, type DishVariant } from './mealPlan/variants'
import { entryMacros, macroLine } from './macroLine'

interface Props {
  readonly slot: MealSlot
  readonly variants: readonly DishVariant<PlannedMeal>[]
  readonly entries: readonly FoodEntry[]
  /** Tagesziel in kcal, null = unbekannt (dann ohne Budget-Hinweis). */
  readonly targetKcal: number | null
  readonly storedChoice: string | null
  readonly onChoose: (name: string) => void
  readonly onPlanned: (items: readonly PlannedMeal[]) => Promise<void>
  readonly onReplace: (item: PlannedMeal, values: FoodValues) => Promise<void>
  readonly onEdit: (entry: FoodEntry, values: FoodValues) => Promise<void>
  readonly onUndo: (entries: readonly FoodEntry[]) => Promise<void>
}

const entriesOf = (variant: DishVariant<PlannedMeal>, entries: readonly FoodEntry[]): FoodEntry[] =>
  entries.filter((e) => variant.items.some((item) => item.id === e.meal_plan_item_id))

/** Varianten einer Mahlzeit als Wisch-Kacheln; Antippen wählt, darunter die Aktionen für die gewählte Variante. */
export function VariantPicker({ slot, variants, entries, targetKcal, storedChoice, onChoose, ...actions }: Props) {
  const allIds = new Set(variants.flatMap((v) => v.items.map((i) => i.id)))
  const locked = entries.some((e) => e.meal_plan_item_id !== null && allIds.has(e.meal_plan_item_id))
  const selectedName = selectedVariant(variants, entries, storedChoice)
  const selected = variants.find((v) => v.name === selectedName) ?? null
  const remaining = targetKcal === null ? null : remainingBudget(targetKcal, entries, allIds)
  const scroller = useRef<HTMLDivElement>(null)

  // Die gewählte Kachel sichtbar machen, z. B. wenn eine spätere Variante schon abgehakt ist.
  useEffect(() => {
    const box = scroller.current
    const tile = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (box && tile) box.scrollTo({ left: tile.offsetLeft - box.offsetLeft })
  }, [selectedName])

  return (
    <div>
      <div ref={scroller} role="radiogroup" aria-label={`Varianten für ${SLOT_LABELS[slot]}`} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {variants.map((variant) => (
          <VariantTile
            key={variant.name}
            variant={variant}
            selected={variant.name === selectedName}
            done={variant.items.every((item) => entries.some((e) => e.meal_plan_item_id === item.id && e.status === 'wie_geplant'))}
            remaining={remaining}
            disabled={locked && variant.name !== selectedName}
            onSelect={() => onChoose(variant.name)}
          />
        ))}
      </div>
      {variants.length > 1 && (
        <p className="mt-1 text-xs text-muted">
          {locked ? 'Schon eingetragen. Zum Wechseln erst rückgängig machen.' : `${variants.length} Varianten: wischen und antippen zum Auswählen.`}
        </p>
      )}
      {selected && <VariantActions key={selected.name} variant={selected} entries={entriesOf(selected, entries)} {...actions} />}
    </div>
  )
}

interface TileProps {
  readonly variant: DishVariant<PlannedMeal>
  readonly selected: boolean
  readonly done: boolean
  readonly remaining: number | null
  readonly disabled: boolean
  readonly onSelect: () => void
}

function VariantTile({ variant, selected, done, remaining, disabled, onSelect }: TileProps) {
  const totals = sumItems(variant.items)
  const fit = remaining === null ? null : budgetFit(totals.kcal, remaining)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onSelect()}
      className={`flex w-[85%] max-w-sm shrink-0 snap-start flex-col rounded-2xl border bg-surface p-4 text-left transition ${
        selected ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-xl leading-tight font-bold uppercase">{variant.name}</span>
        {done ? (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok" aria-label="Wie geplant gegessen">
            <IconCheck className="size-4" />
          </span>
        ) : (
          selected && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Gewählt</span>
        )}
      </span>
      <ul className="mt-2 flex-1 space-y-0.5 text-sm">
        {variant.items.map((item) => (
          <li key={item.id}>
            {item.name}
            {item.amount && <span className="text-muted"> · {item.amount}</span>}
          </li>
        ))}
      </ul>
      <span className="mt-3 block text-sm text-muted tabular-nums">{macroLine(totals)}</span>
      {fit && (
        <span className={`mt-2 inline-block self-start rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${fit.fits ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>
          {fit.label}
        </span>
      )}
    </button>
  )
}

interface ActionProps extends Pick<Props, 'onPlanned' | 'onReplace' | 'onEdit' | 'onUndo'> {
  readonly variant: DishVariant<PlannedMeal>
  /** Einträge zu dieser Variante. */
  readonly entries: readonly FoodEntry[]
}

function VariantActions({ variant, entries, onPlanned, onReplace, onEdit, onUndo }: ActionProps) {
  const [mode, setMode] = useState<'view' | 'replace' | 'edit'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setBusy(false)
    }
  }

  const replaced = entries.find((e) => e.status === 'ersetzt') ?? null
  const missing = variant.items.filter((item) => !entries.some((e) => e.meal_plan_item_id === item.id))
  const done = !replaced && missing.length === 0
  const first = variant.items[0]

  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      {done && <p className="font-medium text-ok">{variant.name}: wie geplant gegessen</p>}
      {replaced && (
        <p className="text-sm">
          <span className="text-muted">Statt {variant.name}: </span>
          <span className="font-medium">{replaced.name}</span>
          <span className="text-muted tabular-nums"> · {macroLine(entryMacros(replaced))}</span>
        </p>
      )}
      {!done && !replaced && (
        <p className="text-sm text-muted">
          Gewählt: <span className="font-medium text-ink">{variant.name}</span>
          {entries.length > 0 && ' (noch nicht alle Zutaten eingetragen)'}
        </p>
      )}

      {mode === 'view' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!replaced && missing.length > 0 && (
            <Button loading={busy} onClick={() => void run(() => onPlanned(missing))}>
              Wie geplant
            </Button>
          )}
          {entries.length === 0 && first && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('replace')}>
              Etwas anderes
            </Button>
          )}
          {replaced && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('edit')}>
              Bearbeiten
            </Button>
          )}
          {entries.length > 0 && (
            <Button variant="ghost" loading={busy && missing.length === 0} disabled={busy} onClick={() => void run(() => onUndo(entries))}>
              Rückgängig
            </Button>
          )}
        </div>
      )}
      {mode === 'replace' && first && (
        <div className="mt-3">
          <FoodForm
            nameLabel="Was hast du stattdessen gegessen?"
            submitLabel="Speichern"
            onSubmit={async (values) => {
              await onReplace(first, values)
              setMode('view')
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}
      {mode === 'edit' && replaced && (
        <div className="mt-3">
          <FoodForm
            initial={toFoodForm({ name: replaced.name, ...entryMacros(replaced) })}
            submitLabel="Speichern"
            onSubmit={async (values) => {
              await onEdit(replaced, values)
              setMode('view')
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}
      <div className="mt-2">
        <InlineError message={error} />
      </div>
    </div>
  )
}
