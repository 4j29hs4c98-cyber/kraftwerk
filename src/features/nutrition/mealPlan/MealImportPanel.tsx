import { useId, useState, type ChangeEvent } from 'react'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Field } from '../../../components/Field'
import { InlineError } from '../../../components/States'
import { toMessage } from '../../../lib/supabase'
import { ACCEPTED_FILES, planNameFromFile, readTable } from '../../plan/import/readFile'
import { saveMealPlan } from '../api'
import { DAY_LABELS, groupBySlot, MEAL_LIMITS, SLOT_LABELS, sortMealItems, DAY_KEYS } from './model'
import { importErrors, parseMealTable, type ImportedMealItem, type MealImportResult } from './parseMealTable'
import { downloadMealTemplate } from './template'

interface Props {
  readonly hasPlan: boolean
  readonly onImported: () => void
  readonly onCancel: () => void
}

interface Preview {
  readonly fileName: string
  readonly result: MealImportResult
}

export function MealImportPanel({ hasPlan, onImported, onCancel }: Props) {
  const inputId = useId()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [name, setName] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setPreview(null)
    setReading(true)
    try {
      const rows = await readTable(file)
      setPreview({ fileName: file.name, result: parseMealTable(rows) })
      setName((planNameFromFile(file.name) || 'Ernährungsplan').slice(0, MEAL_LIMITS.planNameMax))
    } catch (err) {
      setError(toMessage(err, 'Die Datei konnte nicht gelesen werden.'))
    } finally {
      setReading(false)
    }
  }

  const errors = preview ? importErrors(preview.result) : []

  async function apply() {
    if (!preview || errors.length > 0) return
    setSaving(true)
    setError(null)
    try {
      await saveMealPlan(name, preview.result.items)
      setConfirming(false)
      onImported()
    } catch (err) {
      setConfirming(false)
      setError(toMessage(err, 'Der Ernährungsplan konnte nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <p className="font-display text-2xl font-bold uppercase">Ernährungsplan importieren</p>
      <p className="mt-1 text-sm text-muted">
        Eine Zeile pro Lebensmittel mit Kopfzeile, z. B. Tag, Mahlzeit, Lebensmittel, Menge, kcal, Eiweiß, Kohlenhydrate, Fett und Hinweis. Als Tag gehen
        Montag bis Sonntag, Trainingstag, Ruhetag oder Täglich. Dateien: .xlsx oder .csv.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-strong"
        >
          {reading ? 'Datei wird gelesen' : 'Datei auswählen'}
        </label>
        <input id={inputId} type="file" accept={ACCEPTED_FILES} className="sr-only" onChange={(e) => void choose(e)} disabled={reading || saving} />
        <Button variant="secondary" onClick={downloadMealTemplate}>
          Vorlage herunterladen
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
      </div>
      <div className="mt-3">
        <InlineError message={error} />
      </div>
      {preview && (
        <section aria-label="Vorschau des Imports" className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-muted">
            {preview.fileName}: {preview.result.items.length} Einträge
          </p>
          <Messages errors={errors} warnings={preview.result.warnings} />
          <PreviewList items={preview.result.items} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Name des Ernährungsplans" className="flex-1" value={name} maxLength={MEAL_LIMITS.planNameMax} onChange={(e) => setName(e.target.value)} />
            <Button onClick={() => (hasPlan ? setConfirming(true) : void apply())} loading={saving && !confirming} disabled={errors.length > 0 || !name.trim()}>
              Übernehmen
            </Button>
          </div>
        </section>
      )}
      <ConfirmDialog
        open={confirming}
        title="Plan ersetzen?"
        confirmLabel="Übernehmen"
        busy={saving}
        onConfirm={() => void apply()}
        onCancel={() => setConfirming(false)}
      >
        Der importierte Plan ersetzt deinen aktuellen Ernährungsplan. Deine bisherigen Einträge bleiben erhalten.
      </ConfirmDialog>
    </Card>
  )
}

function Messages({ errors, warnings }: { readonly errors: readonly string[]; readonly warnings: readonly string[] }) {
  return (
    <>
      {errors.length > 0 && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <p className="font-semibold">So lässt sich die Datei noch nicht übernehmen:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Hinweise</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function PreviewList({ items }: { readonly items: readonly ImportedMealItem[] }) {
  const sorted = sortMealItems(items)
  const days = DAY_KEYS.filter((key) => sorted.some((i) => i.dayKey === key))
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      {days.map((day) => (
        <article key={day} className="rounded-xl border border-line bg-bg/30 p-3">
          <h3 className="font-display text-xl font-bold uppercase">{DAY_LABELS[day]}</h3>
          {groupBySlot(sorted.filter((i) => i.dayKey === day)).map((group) => (
            <div key={group.slot} className="mt-2">
              <p className="text-xs uppercase tracking-wider text-muted">{SLOT_LABELS[group.slot]}</p>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.row} className="flex items-start justify-between gap-3 py-1.5 text-sm">
                    <span>
                      {item.name}
                      {item.amount && <span className="text-muted"> · {item.amount}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{item.kcal === null ? '-' : `${item.kcal} kcal`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </article>
      ))}
    </div>
  )
}
