import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { InlineError } from '../../components/States'
import { parseNumber } from '../profile/body'

export interface FoodInput {
  readonly name: string
  readonly kcal: number
  readonly proteinG: number
}

const MAX_KCAL = 10000
const MAX_PROTEIN = 1000
const EMPTY = { name: '', kcal: '', protein: '' }

export function FoodForm({ onAdd }: { readonly onAdd: (input: FoodInput) => Promise<void> }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const kcal = parseNumber(form.kcal)
    const protein = parseNumber(form.protein === '' ? '0' : form.protein)
    if (!name) return setError('Bitte gib an, was du gegessen hast.')
    if (kcal === null || kcal < 0 || kcal > MAX_KCAL) return setError('Bitte gib die Kalorien als Zahl ein.')
    if (protein === null || protein < 0 || protein > MAX_PROTEIN) return setError('Bitte gib das Eiweiß in Gramm ein.')
    setError(null)
    setBusy(true)
    try {
      await onAdd({ name: name.slice(0, 120), kcal: Math.round(kcal), proteinG: Math.round(protein * 10) / 10 })
      setForm(EMPTY)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Eintrag konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Was hast du gegessen?" placeholder="z. B. Haferflocken mit Quark" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kalorien" inputMode="numeric" suffix="kcal" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} />
        <Field label="Eiweiß" inputMode="decimal" suffix="g" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} />
      </div>
      <InlineError message={error} />
      <Button type="submit" loading={busy}>Hinzufügen</Button>
    </form>
  )
}
