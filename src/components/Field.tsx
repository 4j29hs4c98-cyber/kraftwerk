import { useId, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string
  readonly hint?: string
  readonly suffix?: string
}

export function Field({ label, hint, suffix, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...rest}
          className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
