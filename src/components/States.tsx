import type { ReactNode } from 'react'
import { Button } from './Button'
import { Spinner } from './Spinner'

export function LoadingState({ label = 'Wird geladen' }: { readonly label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <span className="text-accent"><Spinner size={32} /></span>
      <span className="text-sm">{label} ...</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { readonly message: string; readonly onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-center">
      <p className="font-semibold text-danger">Das hat nicht geklappt</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, action }: { readonly title: string; readonly children?: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function InlineError({ message }: { readonly message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {message}
    </p>
  )
}
