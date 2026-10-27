import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-strong active:scale-[0.98]',
  secondary: 'bg-surface-2 text-ink border border-line hover:border-muted active:scale-[0.98]',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: Variant
  readonly loading?: boolean
  readonly block?: boolean
  readonly children: ReactNode
}

export function Button({ variant = 'primary', loading = false, block = false, className = '', disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner size={18} />}
      {children}
    </button>
  )
}
