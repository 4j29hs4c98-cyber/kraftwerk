import { useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { InlineError } from '../../components/States'
import { toISODate } from '../../lib/date'
import { toMessage } from '../../lib/supabase'
import { useToday } from '../../lib/useToday'
import { parseNumber, WEIGHT_RANGE } from '../profile/body'
import { upsertBodyWeight } from './api'

export function WeightForm({ onSaved }: { readonly onSaved: () => void }) {
  const [date, setDate] = useState(() => toISODate(new Date()))
  const today = useToday((previous, next) => setDate((current) => (current === previous ? next : current)))
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const kg = parseNumber(weight)
    if (kg === null || kg < WEIGHT_RANGE.min || kg > WEIGHT_RANGE.max) return setError(`Bitte gib ein Gewicht zwischen ${WEIGHT_RANGE.min} und ${WEIGHT_RANGE.max} kg ein.`)
    if (!date || date > today) return setError('Bitte wähle ein Datum, das nicht in der Zukunft liegt.')
    setError(null)
    setBusy(true)
    try {
      await upsertBodyWeight(date, Math.round(kg * 100) / 100)
      setWeight('')
      onSaved()
    } catch (err) {
      setError(toMessage(err, 'Das Gewicht konnte nicht gespeichert werden.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gewicht" inputMode="decimal" suffix="kg" placeholder="75,5" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <Field label="Datum" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <p className="text-xs text-muted">Pro Tag zählt ein Wert. Ein neuer Eintrag am selben Tag ersetzt den alten.</p>
      <InlineError message={error} />
      <Button type="submit" loading={busy}>Gewicht speichern</Button>
    </form>
  )
}
