import { useState } from 'react'
import { IconTrash } from '../../../app/icons'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState, InlineError } from '../../../components/States'
import { toMessage } from '../../../lib/supabase'
import { createFood, deleteFood, updateFood } from './api'
import { BUILTIN_FOODS, type FoodNutrients } from './builtin'
import { FoodDefForm } from './FoodDefForm'
import { decimalText, toFoodDefForm, type Food } from './foodMath'

interface Props {
  readonly own: readonly Food[]
  readonly onChanged: () => void
  readonly onClose: () => void
}

/** Neues Lebensmittel (optional vorbefüllt, z. B. aus der Grundliste) oder ein bestehendes in Bearbeitung. */
type Editing = { readonly kind: 'new'; readonly template?: FoodNutrients } | { readonly kind: 'edit'; readonly food: Food } | null

const per100 = (f: FoodNutrients): string =>
  `${decimalText(f.kcal100)} kcal · ${decimalText(f.protein100)} g E · ${decimalText(f.carbs100)} g KH · ${decimalText(f.fat100)} g F`

/** Eigene Lebensmittel anlegen, bearbeiten und entfernen. Sie überdecken gleichnamige Einträge der Grundliste. */
export function MyFoodsPanel({ own, onChanged, onClose }: Props) {
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<Food | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownNames = new Set(own.map((f) => f.name.toLowerCase()))

  async function save(food: FoodNutrients) {
    if (editing?.kind === 'edit' && editing.food.id) await updateFood(editing.food.id, food)
    else await createFood(food)
    setEditing(null)
    onChanged()
  }

  async function confirmRemove() {
    if (!removing?.id) return
    setBusy(true)
    setError(null)
    try {
      await deleteFood(removing.id)
      setRemoving(null)
      onChanged()
    } catch (err) {
      setRemoving(null)
      setError(toMessage(err, 'Das Lebensmittel konnte nicht gelöscht werden.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-display text-2xl font-bold uppercase">Meine Lebensmittel</p>
        <p className="mt-1 text-sm text-muted">
          Nährwerte pro 100 g. Beim freien Eintrag findest du sie über die Suche, die Werte werden aus der Menge berechnet. Ein eigenes Lebensmittel ersetzt den
          gleichnamigen Eintrag der Grundliste.
        </p>
        {editing?.kind === 'new' ? (
          <div className="mt-4">
            <FoodDefForm
              key={editing.template?.name ?? 'neu'}
              initial={editing.template ? toFoodDefForm(editing.template) : undefined}
              submitLabel="Anlegen"
              onSubmit={save}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => setEditing({ kind: 'new' })}>Lebensmittel anlegen</Button>
            <Button variant="ghost" onClick={onClose}>
              Zurück
            </Button>
          </div>
        )}
      </Card>

      <InlineError message={error} />
      {own.length === 0 ? (
        <EmptyState title="Noch keine eigenen Lebensmittel">Lege Lebensmittel mit den Werten von der Packung an oder passe einen Eintrag der Grundliste an.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {own.map((food) =>
            editing?.kind === 'edit' && editing.food.id === food.id ? (
              <li key={food.id} className="p-4">
                <FoodDefForm initial={toFoodDefForm(food)} onSubmit={save} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={food.id ?? food.name} className="flex items-center gap-2 py-2 pr-2 pl-4">
                <button type="button" onClick={() => setEditing({ kind: 'edit', food })} className="min-h-11 min-w-0 flex-1 text-left" aria-label={`${food.name} bearbeiten`}>
                  <span className="block truncate font-medium">{food.name}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {per100(food)} pro 100 g{food.defaultGrams === null ? '' : ` · Portion ${decimalText(food.defaultGrams)} g`}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${food.name} löschen`}
                  onClick={() => setRemoving(food)}
                  className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <IconTrash className="size-5" />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <details className="rounded-2xl border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">Grundliste ({BUILTIN_FOODS.length} Lebensmittel)</summary>
        <p className="px-4 text-xs text-muted">Übliche Durchschnittswerte. Weicht deine Packung ab, übernimm den Eintrag als eigenes Lebensmittel und passe ihn an.</p>
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {BUILTIN_FOODS.map((food) => (
            <li key={food.name} className="flex items-center gap-2 py-2 pr-2 pl-4">
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${ownNames.has(food.name.toLowerCase()) ? 'text-muted line-through' : ''}`}>{food.name}</span>
                <span className="block text-xs text-muted tabular-nums">{per100(food)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditing({ kind: 'new', template: food })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="min-h-11 shrink-0 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-surface-2"
              >
                Anpassen
              </button>
            </li>
          ))}
        </ul>
      </details>

      <ConfirmDialog
        open={removing !== null}
        title="Lebensmittel löschen?"
        confirmLabel="Löschen"
        danger
        busy={busy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      >
        {removing?.name} wird aus deinen Lebensmitteln entfernt. Bisherige Einträge im Tagebuch bleiben erhalten.
      </ConfirmDialog>
    </div>
  )
}
