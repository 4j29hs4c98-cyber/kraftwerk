export function Logo({ className = '' }: { readonly className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
        <path d="M18 4 8 18h7l-2 10 11-15h-7z" fill="var(--color-accent-ink)" />
      </svg>
      Kraftwerk
    </span>
  )
}
