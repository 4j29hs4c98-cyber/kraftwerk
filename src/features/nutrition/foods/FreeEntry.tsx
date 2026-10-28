import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../../components/Button'
import { Field } from '../../../components/Field'
import { InlineError } from '../../../components/States'
import type { FoodValues } from '../api'
import { FOOD_LIMITS } from '../foodInput'
import type { FoodNutrients } from './builtin'
import { EMPTY_ENTRY_FORM, formForFood, ownFoodFromEntry, parseEntryForm, withGrams, type EntryFormValues } from './entryForm'
import { decimalText, searchFoods, type Food } from './foodMath'

interface Props {
  /** Eigene Lebensmittel und Grundliste, eigene zuerst. */
  readonly foods: readonly Food[]
  readonly onAdd: (values: FoodValues, grams: number | null) => Promise<void>
  readonly onSaveFood: (food: FoodNutrients) => Promise<void>
}

const errorText = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback)

/**
 * Freier Eintrag: Lebensmittel suchen, Gramm eingeben, Nährwerte werden berechnet (überschreibbar).
 * Ohne Auswahl bleibt es ein manueller Eintrag, der sich als eigenes Lebensmittel speichern lässt.
 * Nach dem Speichern ist das Formular sofort frei für die nächste Zutat desselben Gerichts.
 */
export function FreeEntry({ foods, onAdd, onSaveFood }: Props) {
  const listId = useId()
  const [form, setForm] = useState<EntryFormValues>(EMPTY_ENTRY_FORM)
  const [food, setFood] = useState<Food | null>(null)
  const [saveAsFood, setSaveAsFood] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const suggestions = food ? [] : searchFoods(foods, form.name)

  function choose(next: Food) {
    setFood(next)
    setForm(formForFood(next))
    setSaveAsFood(false)
    setError(null)
    setNotice(null)
  }

  function changeName(name: string) {
    // Wer den Namen eines gewählten Lebensmittels ändert, trägt manuell weiter ein; die Werte bleiben stehen.
    if (food && name !== food.name) setFood(null)
    setForm((current) => ({ ...current, name }))
  }

  const update = (key: Exclude<keyof EntryFormValues, 'name' | 'grams'>, value: string) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseEntryForm(form)
    if (!parsed.ok) return setError(parsed.error)
    const own = saveAsFood && !food ? ownFoodFromEntry(parsed.values, parsed.grams) : null
    if (own && !own.ok) return setError(own.error)
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await onAdd(parsed.values, parsed.grams)
    } catch (err) {
      setBusy(false)
      return setError(errorText(err, 'Der Eintrag konnte nicht gespeichert werden.'))
    }
    const added = `${parsed.values.name}${parsed.grams === null ? '' : ` (${decimalText(parsed.grams)} g)`} eingetragen.`
    setForm(EMPTY_ENTRY_FORM)
    setFood(null)
    setSaveAsFood(false)
    if (own?.ok) {
      try {
        await onSaveFood(own.food)
        setNotice(`${added} Unter "Meine Lebensmittel" gespeichert.`)
      } catch (err) {
        setNotice(added)
        setError(`Als Lebensmittel nicht gespeichert: ${errorText(err, 'unbekannter Fehler')}`)
      }
    } else {
      setNotice(`${added} Für ein Gericht einfach die nächste Zutat suchen.`)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div>
        <Field
          label="Lebensmittel"
          placeholder="Suchen, z. B. Hähnchen oder Reis"
          autoComplete="off"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={form.name}
          maxLength={FOOD_LIMITS.nameMax}
          onChange={(e) => changeName(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul id={listId} role="listbox" aria-label="Vorschläge" className="mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-2">
            {suggestions.map((s) => (
              <li key={`${s.id ?? 'grund'}-${s.name}`} role="option" aria-selected={false}>
                <button type="button" onClick={() => choose(s)} className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {decimalText(s.kcal100)} kcal · {decimalText(s.protein100)} g E pro 100 g
                    </span>
                  </span>
                  {s.id !== null && <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">Eigenes</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field
        label="Menge"
        inputMode="decimal"
        suffix="g"
        placeholder={food ? '' : 'optional'}
        value={form.grams}
        onChange={(e) => setForm((current) => withGrams(current, food, e.target.value))}
      />
      {food && (
        <p className="-mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <span>
            Berechnet aus {decimalText(food.kcal100)} kcal pro 100 g ({food.id === null ? 'Grundliste' : 'eigenes Lebensmittel'}). Werte lassen sich überschreiben.
          </span>
          <button
            type="button"
            onClick={() => {
              setFood(null)
              setForm(EMPTY_ENTRY_FORM)
            }}
            className="min-h-11 font-semibold text-accent"
          >
            Anderes Lebensmittel
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kalorien" inputMode="numeric" suffix="kcal" value={form.kcal} onChange={(e) => update('kcal', e.target.value)} />
        <Field label="Eiweiß" inputMode="decimal" suffix="g" value={form.protein} onChange={(e) => update('protein', e.target.value)} />
        <Field label="Kohlenhydrate" inputMode="decimal" suffix="g" placeholder="optional" value={form.carbs} onChange={(e) => update('carbs', e.target.value)} />
        <Field label="Fett" inputMode="decimal" suffix="g" placeholder="optional" value={form.fat} onChange={(e) => update('fat', e.target.value)} />
      </div>

      {!food && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={saveAsFood} onChange={(e) => setSaveAsFood(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent" />
          <span>
            <span className="font-medium">Als eigenes Lebensmittel speichern</span>
            <span className="block text-xs text-muted">Mit Menge werden die Werte auf 100 g zurückgerechnet, ohne Menge gelten sie als Werte pro 100 g.</span>
          </span>
        </label>
      )}

      <InlineError message={error} />
      {notice && (
        <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">
          {notice}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Hinzufügen
      </Button>
    </form>
  )
}
