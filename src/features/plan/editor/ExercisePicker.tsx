import { useId, useMemo, useState } from 'react'
import { Button } from '../../../components/Button'
import { EXERCISES, MUSCLE_LABELS, normalizeName } from '../exercises'
import { PLAN_LIMITS } from '../planModel'

const MAX_RESULTS = 8

interface Props {
  /** Schlüssel, die an diesem Tag schon vorkommen. */
  readonly taken: ReadonlySet<string>
  readonly onPickLibrary: (key: string) => void
  readonly onAddCustom: (name: string) => void
  readonly onClose: () => void
}

/** Suche in der Bibliothek; ohne Treffer lässt sich der Suchtext als eigene Übung anlegen. */
export function ExercisePicker({ taken, onPickLibrary, onAddCustom, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputId = useId()
  const normalized = normalizeName(query)

  const results = useMemo(() => {
    const terms = normalized.split(' ').filter(Boolean)
    return EXERCISES.filter((e) => {
      const hay = `${normalizeName(e.name)} ${normalizeName(MUSCLE_LABELS[e.muscle])}`
      return terms.every((t) => hay.includes(t))
    }).slice(0, MAX_RESULTS)
  }, [normalized])

  const customName = query.trim()
  const canAddCustom = customName.length > 0 && customName.length <= PLAN_LIMITS.displayNameMax

  return (
    <div className="mt-3 rounded-xl border border-accent/40 bg-bg/40 p-3">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-muted">Übung suchen oder eigenen Namen eingeben</label>
      <input
        id={inputId}
        autoFocus
        value={query}
        maxLength={PLAN_LIMITS.displayNameMax}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="z. B. Latziehen oder Brust"
        className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base focus:border-accent focus:outline-none"
      />
      <ul className="mt-2 flex flex-col divide-y divide-line">
        {results.map((e) => {
          const isTaken = taken.has(e.key)
          return (
            <li key={e.key}>
              <button
                type="button"
                disabled={isTaken}
                onClick={() => onPickLibrary(e.key)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:text-accent disabled:opacity-40"
              >
                <span>{e.name}</span>
                <span className="shrink-0 text-xs text-muted">{isTaken ? 'schon im Tag' : MUSCLE_LABELS[e.muscle]}</span>
              </button>
            </li>
          )
        })}
        {results.length === 0 && <li className="py-2 text-sm text-muted">Keine Übung in der Bibliothek gefunden.</li>}
      </ul>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" disabled={!canAddCustom} onClick={() => onAddCustom(customName)} className="min-h-11">
          {canAddCustom ? `"${customName}" als eigene Übung` : 'Eigene Übung: Namen eingeben'}
        </Button>
        <Button variant="ghost" onClick={onClose} className="min-h-11">Schließen</Button>
      </div>
    </div>
  )
}
