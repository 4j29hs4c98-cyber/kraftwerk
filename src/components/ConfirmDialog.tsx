import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface Props {
  readonly open: boolean
  readonly title: string
  readonly children?: ReactNode
  readonly confirmLabel: string
  readonly busy?: boolean
  readonly danger?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * Bestätigungsdialog auf Basis von <dialog>: Fokus bleibt im Dialog, Escape bricht ab.
 * Ersetzt window.confirm, das in installierten Web-Apps auf dem iPhone unzuverlässig ist.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, busy = false, danger = false, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/70"
    >
      <h2 id={titleId} className="font-display text-2xl font-bold uppercase">
        {title}
      </h2>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
