import { useState } from 'react'
import { IconTrash } from '../../app/icons'
import { InlineError } from '../../components/States'
import type { FoodEntry, FoodValues } from './api'
import { FoodForm } from './FoodForm'
import { toFoodForm } from './foodInput'
import { entryMacros, macroLine } from './PlannedMeals'

interface Props {
  readonly entries: readonly FoodEntry[]
  readonly onEdit: (entry: FoodEntry, values: FoodValues) => Promise<void>
  readonly onDelete: (entry: FoodEntry) => Promise<void>
}

/** Freie Einträge (und Einträge zu Mahlzeiten, die heute nicht im Plan stehen). */
export function EntryList({ entries, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(entry: FoodEntry) {
    setDeleting(entry.id)
    setError(null)
    try {
      await onDelete(entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der Eintrag konnte nicht gelöscht werden.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <InlineError message={error} />
      <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
        {entries.map((e) =>
          editing === e.id ? (
            <li key={e.id} className="p-4">
              <FoodForm
                initial={toFoodForm({ name: e.name, ...entryMacros(e) })}
                submitLabel="Speichern"
                onSubmit={async (values) => {
                  await onEdit(e, values)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={e.id} className="flex items-center gap-2 py-2 pr-2 pl-4">
              <button type="button" onClick={() => setEditing(e.id)} className="min-h-11 min-w-0 flex-1 text-left" aria-label={`${e.name} bearbeiten`}>
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block text-sm text-muted tabular-nums">{macroLine(entryMacros(e)) || '0 kcal'}</span>
              </button>
              <button
                type="button"
                aria-label={`${e.name} löschen`}
                disabled={deleting === e.id}
                onClick={() => void remove(e)}
                className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
              >
                <IconTrash className="size-5" />
              </button>
            </li>
          ),
        )}
      </ul>
      <p className="mt-2 text-xs text-muted">Tipp: Tippe auf einen Eintrag, um ihn zu bearbeiten.</p>
    </>
  )
}
