import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/Button'
import { Field } from '../../../components/Field'
import { InlineError } from '../../../components/States'
import type { FoodNutrients } from './builtin'
import { EMPTY_FOOD_DEF, FOOD_DB_LIMITS, parseFoodDefForm, type FoodDefForm as FoodDefValues } from './foodMath'

interface Props {
  readonly initial?: FoodDefValues
  readonly submitLabel?: string
  readonly onSubmit: (food: FoodNutrients) => Promise<void>
  readonly onCancel: () => void
}

/** Formular für ein eigenes Lebensmittel mit Nährwerten pro 100 g und optionaler Portion. */
export function FoodDefForm({ initial = EMPTY_FOOD_DEF, submitLabel = 'Speichern', onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<FoodDefValues>(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (key: keyof FoodDefValues, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseFoodDefForm(form)
    if (!parsed.ok) return setError(parsed.error)
    setError(null)
    setBusy(true)
    try {
      await onSubmit(parsed.food)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das Lebensmittel konnte nicht gespeichert werden.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Name" placeholder="z. B. Protein-Pudding" value={form.name} maxLength={FOOD_DB_LIMITS.nameMax} onChange={(e) => update('name', e.target.value)} />
      <p className="text-xs text-muted">Nährwerte pro 100 g, wie auf der Packung.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kalorien" inputMode="decimal" suffix="kcal" value={form.kcal100} onChange={(e) => update('kcal100', e.target.value)} />
        <Field label="Eiweiß" inputMode="decimal" suffix="g" value={form.protein100} onChange={(e) => update('protein100', e.target.value)} />
        <Field label="Kohlenhydrate" inputMode="decimal" suffix="g" value={form.carbs100} onChange={(e) => update('carbs100', e.target.value)} />
        <Field label="Fett" inputMode="decimal" suffix="g" value={form.fat100} onChange={(e) => update('fat100', e.target.value)} />
      </div>
      <Field label="Typische Portion" inputMode="decimal" suffix="g" placeholder="optional" value={form.defaultGrams} onChange={(e) => update('defaultGrams', e.target.value)} />
      <InlineError message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={busy} className="flex-1">
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
