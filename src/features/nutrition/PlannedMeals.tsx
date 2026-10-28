import { useState } from 'react'
import { IconCheck } from '../../app/icons'
import { Button } from '../../components/Button'
import { InlineError } from '../../components/States'
import type { FoodEntry, FoodValues, PlannedMeal } from './api'
import { FoodForm } from './FoodForm'
import { toFoodForm } from './foodInput'
import { groupBySlot, SLOT_LABELS } from './mealPlan/model'

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

export function macroLine(v: { kcal: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null }): string {
  const parts = [
    v.kcal === null ? null : `${v.kcal} kcal`,
    v.proteinG === null ? null : `${NUMBER.format(v.proteinG)} g E`,
    v.carbsG === null ? null : `${NUMBER.format(v.carbsG)} g KH`,
    v.fatG === null ? null : `${NUMBER.format(v.fatG)} g F`,
  ]
  return parts.filter(Boolean).join(' · ')
}

export const entryMacros = (e: FoodEntry) => ({ kcal: e.kcal, proteinG: e.protein_g, carbsG: e.carbs_g, fatG: e.fat_g })

interface Props {
  readonly items: readonly PlannedMeal[]
  readonly entries: readonly FoodEntry[]
  readonly onPlanned: (item: PlannedMeal) => Promise<void>
  readonly onReplace: (item: PlannedMeal, values: FoodValues) => Promise<void>
  readonly onEdit: (entry: FoodEntry, values: FoodValues) => Promise<void>
  readonly onUndo: (entry: FoodEntry) => Promise<void>
}

/** Mahlzeiten des Plans für einen Tag, gruppiert nach Mahlzeit. */
export function PlannedMeals({ items, entries, ...actions }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {groupBySlot(items).map((group) => (
        <section key={group.slot} aria-label={SLOT_LABELS[group.slot]}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{SLOT_LABELS[group.slot]}</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {group.items.map((item) => (
              <PlannedMealRow key={item.id} item={item} entry={entries.find((e) => e.meal_plan_item_id === item.id) ?? null} {...actions} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

type RowProps = Omit<Props, 'items' | 'entries'> & { readonly item: PlannedMeal; readonly entry: FoodEntry | null }

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
              <Button loading={busy} onClick={() => void run(() => onPlanned(item))}>
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
            <Button variant="ghost" loading={busy} onClick={() => void run(() => onUndo(entry))}>
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
