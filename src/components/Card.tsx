import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { readonly children: ReactNode; readonly className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { readonly children: ReactNode; readonly action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ eyebrow, title, action }: { readonly eyebrow?: string; readonly title: string; readonly action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function Stat({ label, value, unit }: { readonly label: string; readonly value: string; readonly unit?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none">
        {value}
        {unit && <span className="ml-1 text-base font-semibold text-muted">{unit}</span>}
      </p>
    </div>
  )
}
