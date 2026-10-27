import { Link, Navigate } from 'react-router'
import { Logo } from '../../components/Logo'
import { useAuth } from '../auth/AuthProvider'

const FEATURES = [
  { n: '01', title: 'Plan nach Maß', text: 'Ein paar Fragen zu Ziel, Erfahrung und Ausrüstung, und Kraftwerk stellt deinen Trainingsplan zusammen. Zuhause oder im Studio.' },
  { n: '02', title: 'Jeder Satz zählt', text: 'Gewicht und Wiederholungen direkt im Training eintragen. Beim nächsten Mal schlägt Kraftwerk vor, wann du steigern kannst.' },
  { n: '03', title: 'Essen ohne Rechnen', text: 'Dein Kalorien- und Eiweißziel wird aus deinen Daten berechnet. Du trägst nur ein, was du gegessen hast.' },
  { n: '04', title: 'Fortschritt sehen', text: 'Gewichtskurve, Trainingskalender und deine Wochenserie zeigen, dass sich die Arbeit lohnt.' },
] as const

const linkBase = 'inline-flex min-h-12 items-center justify-center rounded-xl px-6 font-semibold transition'

export function LandingPage() {
  const { session, loading } = useAuth()
  if (!loading && session) return <Navigate to="/heute" replace />

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-accent/20 blur-3xl" />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Logo />
        <Link to="/anmelden" className={`${linkBase} px-4 text-muted hover:text-ink`}>
          Anmelden
        </Link>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 pb-16">
        <section className="pt-10 pb-14 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Dein Training. Dein Takt.</p>
          <h1 className="mt-4 font-display text-6xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-8xl">
            Stärker
            <br />
            mit System.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Kraftwerk plant dein Training, protokolliert jeden Satz und sagt dir, wann du mehr auflegen kannst. Ohne Tabellen, ohne Rätselraten.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/registrieren" className={`${linkBase} bg-accent text-accent-ink hover:bg-accent-strong`}>
              Kostenlos starten
            </Link>
            <Link to="/anmelden" className={`${linkBase} border border-line bg-surface-2 hover:border-muted`}>
              Ich habe schon ein Konto
            </Link>
          </div>
        </section>

        <section aria-label="Funktionen" className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.n} className="rounded-2xl border border-line bg-surface p-5">
              <p className="font-display text-xl font-bold text-accent">{f.n}</p>
              <h2 className="mt-2 text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-muted">{f.text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="relative mx-auto max-w-5xl border-t border-line px-4 py-6 text-sm text-muted">
        Kraftwerk ersetzt keine ärztliche Beratung. Bei Beschwerden bitte vorher abklären lassen.
      </footer>
    </div>
  )
}
