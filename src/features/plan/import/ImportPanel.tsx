import { useId, useState, type ChangeEvent } from 'react'
import { Button } from '../../../components/Button'
import { Card } from '../../../components/Card'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Field } from '../../../components/Field'
import { InlineError } from '../../../components/States'
import { toMessage } from '../../../lib/supabase'
import { savePlan } from '../api'
import { PLAN_LIMITS } from '../planModel'
import { weekdayName } from '../weekdays'
import { parsePlanTable, toImportedPlan, type ImportResult } from './parsePlanTable'
import { ACCEPTED_FILES, planNameFromFile, readTable } from './readFile'
import { downloadTemplate } from './template'

interface Props {
  readonly onImported: () => void
  readonly onCancel: () => void
}

interface Preview {
  readonly fileName: string
  readonly result: ImportResult
}

export function ImportPanel({ onImported, onCancel }: Props) {
  const inputId = useId()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [name, setName] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setPreview(null)
    setReading(true)
    try {
      const rows = await readTable(file)
      setPreview({ fileName: file.name, result: parsePlanTable(rows) })
      setName(planNameFromFile(file.name) || 'Importierter Plan')
    } catch (err) {
      setError(toMessage(err, 'Die Datei konnte nicht gelesen werden.'))
    } finally {
      setReading(false)
    }
  }

  const checked = preview ? toImportedPlan(preview.result, name) : null

  function requestApply() {
    if (!checked || checked.errors.length > 0) return
    setConfirming(true)
  }

  async function apply() {
    if (!checked || checked.errors.length > 0) return
    setSaving(true)
    setError(null)
    try {
      await savePlan(checked.plan)
      setConfirming(false)
      onImported()
    } catch (err) {
      setConfirming(false)
      setError(toMessage(err, 'Der Plan konnte nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <p className="font-display text-2xl font-bold uppercase">Plan aus Excel importieren</p>
      <p className="mt-1 text-sm text-muted">
        Eine Zeile pro Übung mit Kopfzeile, z. B. Tag, Fokus, Übung, Sätze, Wiederholungen, Gewicht, Hinweise und optional Pause (s). Stehen in der
        Tag-Spalte Wochentage (Montag bis Sonntag), werden Zeilen mit Fokus "Pause" oder Übung "-" zu Ruhetagen, sonst übersprungen. Dateien: .xlsx
        oder .csv.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-strong"
        >
          {reading ? 'Datei wird gelesen' : 'Datei auswählen'}
        </label>
        <input id={inputId} type="file" accept={ACCEPTED_FILES} className="sr-only" onChange={(e) => void choose(e)} disabled={reading || saving} />
        <Button variant="secondary" onClick={downloadTemplate}>Vorlage herunterladen</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Abbrechen</Button>
      </div>
      <div className="mt-3"><InlineError message={error} /></div>
      {preview && checked && (
        <ImportPreview preview={preview} errors={checked.errors} name={name} onName={setName} saving={saving} onApply={requestApply} />
      )}
      <ConfirmDialog
        open={confirming}
        title="Plan übernehmen?"
        confirmLabel="Übernehmen"
        busy={saving}
        onConfirm={() => void apply()}
        onCancel={() => setConfirming(false)}
      >
        Der importierte Plan ersetzt deinen aktuellen Plan. Deine Trainingshistorie bleibt erhalten.
      </ConfirmDialog>
    </Card>
  )
}

interface PreviewProps {
  readonly preview: Preview
  readonly errors: readonly string[]
  readonly name: string
  readonly onName: (name: string) => void
  readonly saving: boolean
  readonly onApply: () => void
}

function ImportPreview({ preview, errors, name, onName, saving, onApply }: PreviewProps) {
  const { result } = preview
  const exercises = result.days.flatMap((d) => d.exercises)
  const customCount = exercises.filter((e) => e.isCustom).length
  const trainingCount = result.days.filter((d) => !d.isRest).length
  const restCount = result.days.length - trainingCount

  return (
    <section aria-label="Vorschau des Imports" className="mt-5 border-t border-line pt-4">
      <p className="text-sm text-muted">
        {preview.fileName}: {trainingCount} Trainingstage{restCount > 0 ? `, ${restCount} Ruhetage` : ''}, {exercises.length} Übungen, davon {customCount} als eigene Übung angelegt.
      </p>
      {errors.length > 0 && (
        <div role="alert" className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <p className="font-semibold">So lässt sich die Datei noch nicht übernehmen:</p>
          <ul className="mt-1 list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Hinweise</p>
          <ul className="mt-1 list-disc pl-5 text-muted">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {result.days.map((day, i) => {
          const label = day.weekday !== null ? weekdayName(day.weekday) : `Tag ${i + 1}`
          if (day.isRest) {
            return (
              <article key={`rest-${i}`} className="rounded-xl border border-dashed border-line p-3">
                <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
                <h3 className="font-display text-xl font-bold uppercase text-muted">Ruhetag</h3>
                <p className="text-sm text-muted">Keine Übungen, Zeit für Regeneration.</p>
              </article>
            )
          }
          return (
            <article key={`${day.title}-${i}`} className="rounded-xl border border-line bg-bg/30 p-3">
              <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
              <h3 className="font-display text-xl font-bold uppercase">{day.title}</h3>
              <ol className="mt-1 divide-y divide-line">
                {day.exercises.map((ex) => (
                  <li key={ex.row} className="py-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        {ex.sourceName}
                        {ex.isCustom && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">Eigene</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        {ex.sets} x {ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}-${ex.repMax}`}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {ex.restSeconds} s Pause{ex.startWeightKg !== null && ex.startWeightKg !== undefined ? ` · Start ${String(ex.startWeightKg).replace('.', ',')} kg` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </article>
          )
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Name des Plans" className="flex-1" value={name} maxLength={PLAN_LIMITS.planNameMax} onChange={(e) => onName(e.target.value)} />
        <Button onClick={onApply} loading={saving} disabled={errors.length > 0}>Übernehmen</Button>
      </div>
    </section>
  )
}
