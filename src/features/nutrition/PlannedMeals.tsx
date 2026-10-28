import { useState } from 'react'
import { IconCheck } from '../../app/icons'
import { Button } from '../../components/Button'
import { InlineError } from '../../components/States'
import type { FoodEntry, FoodValues, PlannedMeal } from './api'
import { FoodForm } from './FoodForm'
import { toFoodForm } from './foodInput'
import { entryMacros, macroLine } from './macroLine'
import { SLOT_LABELS, type MealSlot } from './mealPlan/model'
import { groupSlotVariants } from './mealPlan/variants'
import { VariantPicker } from './VariantPicker'

interface Actions {
  readonly onPlanned: (items: readonly PlannedMeal[]) => Promise<void>
  readonly onReplace: (item: PlannedMeal, values: FoodValues) => Promise<void>
  readonly onEdit: (entry: FoodEntry, values: FoodValues) => Promise<void>
  readonly onUndo: (entries: readonly FoodEntry[]) => Promise<void>
}

interface Props extends Actions {
  readonly items: readonly PlannedMeal[]
  readonly entries: readonly FoodEntry[]
  readonly targetKcal: number | null
  /** Gemerkte Variante je Mahlzeit für den angezeigten Tag. */
  readonly choices: Readonly<Partial<Record<MealSlot, string>>>
  readonly onChoose: (slot: MealSlot, name: string) => void
}

/** Mahlzeiten des Plans für einen Tag, gruppiert nach Mahlzeit; Varianten als Wisch-Kacheln. */
export function PlannedMeals({ items, entries, targetKcal, choices, onChoose, ...actions }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {groupSlotVariants(items).map((group) => (
        <section key={group.slot} aria-label={SLOT_LABELS[group.slot]}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{SLOT_LABELS[group.slot]}</h3>
          {group.common.length > 0 && (
            <ul className={`divide-y divide-line rounded-2xl border border-line bg-surface ${group.variants.length > 0 ? 'mb-3' : ''}`}>
              {group.common.map((item) => (
                <PlannedMealRow key={item.id} item={item} entry={entries.find((e) => e.meal_plan_item_id === item.id) ?? null} {...actions} />
              ))}
            </ul>
          )}
          {group.variants.length > 0 && (
            <VariantPicker
              slot={group.slot}
              variants={group.variants}
              entries={entries}
              targetKcal={targetKcal}
              storedChoice={choices[group.slot] ?? null}
              onChoose={(name) => onChoose(group.slot, name)}
              {...actions}
            />
          )}
        </section>
      ))}
    </div>
  )
}

interface RowProps extends Actions {
  readonly item: PlannedMeal
  readonly entry: FoodEntry | null
}

function PlannedMealRow({ item, entry, onPlanned, onReplace, onEdit, onUndo }: RowProps) {
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

  const done = entry?.status === 'wie_geplant'
  const replaced = entry?.status === 'ersetzt'

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        {done && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok" aria-hidden="true">
            <IconCheck className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${replaced ? 'text-muted line-through' : ''}`}>
            {item.name}
            {item.amount && <span className="font-normal text-muted"> · {item.amount}</span>}
          </p>
          <p className="text-sm text-muted tabular-nums">{macroLine(item) || 'Keine Nährwerte hinterlegt'}</p>
          {item.notes && <p className="mt-1 text-xs text-muted">{item.notes}</p>}
          {done && <p className="mt-1 text-sm font-medium text-ok">Wie geplant gegessen</p>}
          {replaced && entry && (
            <p className="mt-1 text-sm">
              <span className="text-muted">Stattdessen: </span>
              <span className="font-medium">{entry.name}</span>
              <span className="text-muted tabular-nums"> · {macroLine(entryMacros(entry))}</span>
            </p>
          )}
        </div>
      </div>

      {mode === 'view' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!entry && (
            <>
              <Button loading={busy} onClick={() => void run(() => onPlanned([item]))}>
                Wie geplant
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setMode('replace')}>
                Etwas anderes
              </Button>
            </>
          )}
          {replaced && (
            <Button variant="secondary" disabled={busy} onClick={() => setMode('edit')}>
              Bearbeiten
            </Button>
          )}
          {entry && (
            <Button variant="ghost" loading={busy} onClick={() => void run(() => onUndo([entry]))}>
              Rückgängig
            </Button>
          )}
        </div>
      )}
      {mode === 'replace' && (
        <div className="mt-3">
          <FoodForm
            nameLabel="Was hast du stattdessen gegessen?"
            submitLabel="Speichern"
            onSubmit={async (values) => {
              await onReplace(item, values)
              setMode('view')
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}
      {mode === 'edit' && entry && (
        <div className="mt-3">
          <FoodForm
            initial={toFoodForm({ name: entry.name, ...entryMacros(entry) })}
            submitLabel="Speichern"
            onSubmit={async (values) => {
              await onEdit(entry, values)
              setMode('view')
            }}
            onCancel={() => setMode('view')}
          />
        </div>
      )}
      <div className="mt-2">
        <InlineError message={error} />
      </div>
    </li>
  )
}
