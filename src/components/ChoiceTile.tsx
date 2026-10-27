import type { ReactNode } from 'react'

interface Props {
  readonly selected: boolean
  readonly onSelect: () => void
  readonly title: string
  readonly description?: ReactNode
  readonly multi?: boolean
}

/** Große Auswahlfläche für Fragebogen und Einstellungen. */
export function ChoiceTile({ selected, onSelect, title, description, multi = false }: Props) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        selected ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${
          selected ? 'border-accent bg-accent text-accent-ink' : 'border-line'
        }`}
      >
        {selected && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        )}
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
    </button>
  )
}
