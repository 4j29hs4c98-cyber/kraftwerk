import { useId, useState } from 'react'
import { IconTrash } from '../../../app/icons'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { Field } from '../../../components/Field'
import { toMessage } from '../../../lib/supabase'
import { saveMealPlan, type ActiveMealPlan } from '../api'
import { draftFromItems, draftToItems, newDraftMeal, removeDraftMeal, updateDraftMeal, type DraftMeal } from './draft'
import { DAY_KEYS, DAY_LABELS, isDayKey, isMealSlot, MEAL_LIMITS, MEAL_SLOTS, SLOT_LABELS, type DayKey, type MealSlot } from './model'

interface Props {
  /** null = neuer Plan von Grund auf. */
  readonly current: ActiveMealPlan | null
  readonly onSaved: () => void
  readonly onCancel: () => void
}

function SelectField<T extends string>({ label, value, options, labels, onChange }: {
  readonly label: string
  readonly value: T
  readonly options: readonly T[]
  readonly labels: Readonly<Record<T, string>>
  readonly onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-ink focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Bearbeiten erzeugt über create_meal_plan einen neuen aktiven Plan mit der kompletten Liste. */
export function MealPlanEditor({ current, onSaved, onCancel }: Props) {
  const [name, setName] = useState(current?.plan.name ?? 'Mein Ernährungsplan')
  const [draft, setDraft] = useState<readonly DraftMeal[]>(() => draftFromItems(current?.items ?? []))
  const [openUid, setOpenUid] = useState<string | null>(null)
  const [newDay, setNewDay] = useState<DayKey>('alle')
  const [newSlot, setNewSlot] = useState<MealSlot>('fruehstueck')
  const [errors, setErrors] = useState<readonly string[]>([])
  const [busy, setBusy] = useState(false)

  function add() {
    const meal = newDraftMeal(newDay, newSlot)
    setDraft((d) => [...d, meal])
    setOpenUid(meal.uid)
  }

  async function save() {
    const result = draftToItems(draft)
    if (!result.ok) return setErrors(result.errors)
    setErrors([])
    setBusy(true)
    try {
      await saveMealPlan(name, result.items)
      onSaved()
    } catch (err) {
      setErrors([toMessage(err, 'Der Ernährungsplan konnte nicht gespeichert werden.')])
    } finally {
      setBusy(false)
    }
  }

  const days = DAY_KEYS.filter((key) => draft.some((m) => m.dayKey === key))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="font-display text-2xl font-bold uppercase">{current ? 'Ernährungsplan bearbeiten' : 'Ernährungsplan anlegen'}</p>
        <p className="mt-1 text-sm text-muted">Beim Speichern entsteht ein neuer aktiver Plan. Deine bisherigen Einträge bleiben erhalten.</p>
        <Field label="Name" className="mt-4" value={name} maxLength={MEAL_LIMITS.planNameMax} onChange={(e) => setName(e.target.value)} />
      </Card>

      {days.map((day) => (
        <Card key={day}>
          <h3 className="font-display text-xl font-bold uppercase">{DAY_LABELS[day]}</h3>
          {MEAL_SLOTS.filter((slot) => draft.some((m) => m.dayKey === day && m.mealSlot === slot)).map((slot) => (
            <div key={slot} className="mt-3">
              <p className="text-xs uppercase tracking-wider text-muted">{SLOT_LABELS[slot]}</p>
              <ul className="mt-1 divide-y divide-line">
                {draft
                  .filter((m) => m.dayKey === day && m.mealSlot === slot)
                  .map((meal) => (
                    <DraftRow
                      key={meal.uid}
                      meal={meal}
                      open={openUid === meal.uid}
                      onToggle={() => setOpenUid((uid) => (uid === meal.uid ? null : meal.uid))}
                      onChange={(patch) => setDraft((d) => updateDraftMeal(d, meal.uid, patch))}
                      onRemove={() => setDraft((d) => removeDraftMeal(d, meal.uid))}
                    />
                  ))}
              </ul>
            </div>
          ))}
        </Card>
      ))}

      <Card>
        <p className="font-semibold">Eintrag hinzufügen</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SelectField label="Tag" value={newDay} options={DAY_KEYS} labels={DAY_LABELS} onChange={(v) => isDayKey(v) && setNewDay(v)} />
          <SelectField label="Mahlzeit" value={newSlot} options={MEAL_SLOTS} labels={SLOT_LABELS} onChange={(v) => isMealSlot(v) && setNewSlot(v)} />
        </div>
        <Button variant="secondary" block className="mt-3" onClick={add}>
          Eintrag hinzufügen
        </Button>
      </Card>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => void save()} loading={busy} className="flex-1">
          Speichern
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}

interface RowProps {
  readonly meal: DraftMeal
  readonly open: boolean
  readonly onToggle: () => void
  readonly onChange: (patch: Partial<Omit<DraftMeal, 'uid'>>) => void
  readonly onRemove: () => void
}

function DraftRow({ meal, open, onToggle, onChange, onRemove }: RowProps) {
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-h-11 min-w-0 flex-1 rounded-lg text-left hover:text-accent">
          <span className="block truncate font-medium">{meal.name.trim() || 'Neuer Eintrag'}</span>
          <span className="block text-xs text-muted tabular-nums">
            {meal.kcal ? `${meal.kcal} kcal` : 'ohne kcal'}
            {meal.amount ? ` · ${meal.amount}` : ''}
          </span>
        </button>
        <button
          type="button"
          aria-label={`${meal.name || 'Eintrag'} entfernen`}
          onClick={onRemove}
          className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger"
        >
          <IconTrash className="size-5" />
        </button>
      </div>
      {open && (
        <div className="mt-2 flex flex-col gap-3 rounded-xl bg-bg/40 p-3">
          <Field label="Lebensmittel" value={meal.name} maxLength={MEAL_LIMITS.nameMax} onChange={(e) => onChange({ name: e.target.value })} />
          <Field label="Menge" placeholder="z. B. 80 g" value={meal.amount} maxLength={MEAL_LIMITS.amountMax} onChange={(e) => onChange({ amount: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kalorien" inputMode="numeric" suffix="kcal" value={meal.kcal} onChange={(e) => onChange({ kcal: e.target.value })} />
            <Field label="Eiweiß" inputMode="decimal" suffix="g" value={meal.protein} onChange={(e) => onChange({ protein: e.target.value })} />
            <Field label="Kohlenhydrate" inputMode="decimal" suffix="g" value={meal.carbs} onChange={(e) => onChange({ carbs: e.target.value })} />
            <Field label="Fett" inputMode="decimal" suffix="g" value={meal.fat} onChange={(e) => onChange({ fat: e.target.value })} />
            <SelectField label="Tag" value={meal.dayKey} options={DAY_KEYS} labels={DAY_LABELS} onChange={(v) => isDayKey(v) && onChange({ dayKey: v })} />
            <SelectField label="Mahlzeit" value={meal.mealSlot} options={MEAL_SLOTS} labels={SLOT_LABELS} onChange={(v) => isMealSlot(v) && onChange({ mealSlot: v })} />
          </div>
          <Field label="Hinweis" value={meal.notes} maxLength={MEAL_LIMITS.notesMax} onChange={(e) => onChange({ notes: e.target.value })} />
        </div>
      )}
    </li>
  )
}
