import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../../components/Button'
import { Field } from '../../../components/Field'
import { InlineError } from '../../../components/States'
import type { FoodNutrients } from './builtin'
import { decimalText, FOOD_DB_LIMITS, nutrientsFor, parseFoodDefForm, parseGrams, type Food, type FoodDefForm } from './foodMath'

/** Was nach dem Scan zur Bestätigung ansteht: ein schon gespeichertes Lebensmittel oder ein Vorschlag zum Anlegen. */
export interface BarcodeCandidate {
  readonly barcode: string
  /** Eigenes Lebensmittel mit diesem Code, dann wird nichts neu angelegt. */
  readonly existing: Food | null
  readonly form: FoodDefForm
  readonly servingGrams: number | null
  readonly notes: readonly string[]
}

export interface BarcodeConfirmed {
  /** Werte für ein neues Lebensmittel; bei einem vorhandenen die gespeicherten. */
  readonly food: FoodNutrients
  readonly grams: number | null
}

interface Props {
  readonly candidate: BarcodeCandidate
  /** Mit Menge und Eintragen oder nur das Lebensmittel anlegen. */
  readonly canLog: boolean
  readonly onSubmit: (confirmed: BarcodeConfirmed) => Promise<void>
  readonly onCancel: () => void
}

const per100Text = (f: FoodNutrients): string => `${decimalText(f.kcal100)} kcal · ${decimalText(f.protein100)} g E · ${decimalText(f.carbs100)} g KH · ${decimalText(f.fat100)} g F pro 100 g`

/** Bestätigung nach dem Scan: Name und Werte pro 100 g prüfen, Menge wählen, Nährwerte für die Menge sehen. */
export function BarcodeConfirm({ candidate, canLog, onSubmit, onCancel }: Props) {
  const { existing } = candidate
  const [form, setForm] = useState<FoodDefForm>(candidate.form)
  const [grams, setGrams] = useState(() => {
    const start = existing?.defaultGrams ?? candidate.servingGrams
    return start === null ? '100' : decimalText(start)
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // Fokus ins erste Feld (Name, bei bekanntem Lebensmittel die Menge), wenn der Scanner geschlossen wurde.
  useEffect(() => {
    formRef.current?.querySelector('input')?.focus()
  }, [])

  const update = (key: keyof FoodDefForm, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const parsedDef = existing ? null : parseFoodDefForm({ ...form, defaultGrams: candidate.servingGrams === null ? '' : decimalText(candidate.servingGrams) })
  const food: FoodNutrients | null = existing ?? (parsedDef?.ok ? parsedDef.food : null)
  const parsedGrams = parseGrams(grams)
  const preview = food && typeof parsedGrams === 'number' ? nutrientsFor(food, parsedGrams) : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (parsedDef && !parsedDef.ok) return setError(parsedDef.error)
    if (!food) return
    if (parsedGrams === undefined || (canLog && parsedGrams === null)) return setError(`Bitte gib die Menge in Gramm ein (bis ${FOOD_DB_LIMITS.gramsMax}).`)
    setError(null)
    setBusy(true)
    try {
      await onSubmit({ food, grams: canLog ? parsedGrams : null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Das hat nicht geklappt.')
      setBusy(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-surface-2 p-4">
      <p className="text-xs text-muted tabular-nums">Code {candidate.barcode}</p>
      {existing ? (
        <div>
          <p className="font-semibold">{existing.name}</p>
          <p className="text-xs text-muted tabular-nums">{per100Text(existing)}</p>
          <p className="mt-1 text-xs text-muted">Aus deinen Lebensmitteln.</p>
        </div>
      ) : (
        <>
          <Field label="Name" value={form.name} maxLength={FOOD_DB_LIMITS.nameMax} onChange={(e) => update('name', e.target.value)} />
          <p className="text-xs text-muted">Nährwerte pro 100 g. Prüfe sie mit der Packung.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kalorien" inputMode="decimal" suffix="kcal" value={form.kcal100} onChange={(e) => update('kcal100', e.target.value)} />
            <Field label="Eiweiß" inputMode="decimal" suffix="g" value={form.protein100} onChange={(e) => update('protein100', e.target.value)} />
            <Field label="Kohlenhydrate" inputMode="decimal" suffix="g" value={form.carbs100} onChange={(e) => update('carbs100', e.target.value)} />
            <Field label="Fett" inputMode="decimal" suffix="g" value={form.fat100} onChange={(e) => update('fat100', e.target.value)} />
          </div>
          {candidate.notes.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-warn">
              {candidate.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {canLog && (
        <>
          <Field label="Menge" inputMode="decimal" suffix="g" value={grams} onChange={(e) => setGrams(e.target.value)} />
          {preview && (
            <p className="text-sm tabular-nums" aria-live="polite">
              <span className="font-semibold">{preview.kcal} kcal</span>
              <span className="text-muted">
                {' '}
                · {decimalText(preview.proteinG)} g Eiweiß · {decimalText(preview.carbsG)} g Kohlenhydrate · {decimalText(preview.fatG)} g Fett
              </span>
            </p>
          )}
        </>
      )}

      <InlineError message={error} />
      <div className="flex gap-3">
        <Button type="submit" loading={busy} className="flex-1">
          {!canLog ? 'Lebensmittel anlegen' : existing ? 'Eintragen' : 'Speichern und eintragen'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
