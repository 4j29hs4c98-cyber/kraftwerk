import { Link } from 'react-router'
import { Logo } from '../../components/Logo'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-4">
      <Logo />
      <h1 className="font-display text-4xl font-bold uppercase">Seite nicht gefunden</h1>
      <p className="text-muted">Diese Adresse gibt es bei Kraftwerk nicht.</p>
      <Link to="/" className="inline-flex min-h-12 items-center font-semibold text-accent">Zur Startseite</Link>
    </main>
  )
}
