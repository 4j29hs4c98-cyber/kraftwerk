import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { InlineError } from '../../components/States'
import type { FoodValues } from './api'
import { EMPTY_FOOD_FORM, FOOD_LIMITS, parseFoodForm, type FoodFormValues } from './foodInput'

interface Props {
  readonly onSubmit: (values: FoodValues) => Promise<void>
  readonly initial?: FoodFormValues
  readonly submitLabel?: string
  readonly nameLabel?: string
  readonly onCancel?: () => void
}

/** Formular für freie, ersetzte und bearbeitete Einträge. Ohne Startwerte wird es nach dem Speichern geleert. */
export function FoodForm({ onSubmit, initial, submitLabel = 'Hinzufügen', nameLabel = 'Was hast du gegessen?', onCancel }: Props) {
  const [form, setForm] = useState<FoodFormValues>(initial ?? EMPTY_FOOD_FORM)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseFoodForm(form)
    if (!parsed.ok) return setError(parsed.error)
    setError(null)
    setBusy(true)
    try {
      await onSubmit(parsed.values)
      if (!initial) setForm(EMPTY_FOOD_FORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Eintrag konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  const update = (key: keyof FoodFormValues, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label={nameLabel} placeholder="z. B. Haferflocken mit Quark" value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={FOOD_LIMITS.nameMax} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kalorien" inputMode="numeric" suffix="kcal" value={form.kcal} onChange={(e) => update('kcal', e.target.value)} />
        <Field label="Eiweiß" inputMode="decimal" suffix="g" value={form.protein} onChange={(e) => update('protein', e.target.value)} />
        <Field label="Kohlenhydrate" inputMode="decimal" suffix="g" placeholder="optional" value={form.carbs} onChange={(e) => update('carbs', e.target.value)} />
        <Field label="Fett" inputMode="decimal" suffix="g" placeholder="optional" value={form.fat} onChange={(e) => update('fat', e.target.value)} />
      </div>
      <InlineError message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={busy} className="flex-1">
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  )
}
