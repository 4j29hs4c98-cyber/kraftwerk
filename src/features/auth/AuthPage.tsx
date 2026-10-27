import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Logo } from '../../components/Logo'
import { InlineError } from '../../components/States'
import { toMessage } from '../../lib/supabase'
import { signIn, signUp } from './api'
import { useAuth } from './AuthProvider'

type Mode = 'login' | 'register'
const MIN_PASSWORD = 8

const COPY: Record<Mode, { title: string; submit: string; switchText: string; switchLink: string; switchTo: string }> = {
  login: { title: 'Willkommen zurück', submit: 'Anmelden', switchText: 'Noch kein Konto?', switchLink: 'Jetzt registrieren', switchTo: '/registrieren' },
  register: { title: 'Konto erstellen', submit: 'Registrieren', switchText: 'Schon dabei?', switchLink: 'Anmelden', switchTo: '/anmelden' },
}

/** Zielseite nach dem Login: die ursprünglich angefragte Seite, aber nur app-intern. */
function returnPath(state: unknown): string {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string') {
    const from = state.from
    if (from.startsWith('/') && !from.startsWith('//') && from !== '/anmelden' && from !== '/registrieren') return from
  }
  return '/heute'
}

function validate(mode: Mode, email: string, password: string): string | null {
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Bitte gib eine gültige E-Mail-Adresse ein.'
  if (mode === 'register' && password.length < MIN_PASSWORD) return `Dein Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`
  if (password.length === 0) return 'Bitte gib dein Passwort ein.'
  return null
}

export function AuthPage({ mode }: { readonly mode: Mode }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const target = returnPath(location.state)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null)
  const copy = COPY[mode]

  if (session) return <Navigate to={target} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    const invalid = validate(mode, trimmed, password)
    if (invalid) return setError(invalid)
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(trimmed, password)
        navigate(target, { replace: true })
        return
      }
      const result = await signUp(trimmed, password)
      if (result.session) {
        navigate('/onboarding', { replace: true })
        return
      }
      setConfirmSentTo(trimmed)
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <Link to="/" className="self-start">
        <Logo />
      </Link>
      <div className="flex flex-1 flex-col justify-center py-10">
        {confirmSentTo ? (
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h1 className="font-display text-3xl font-bold uppercase">Bitte bestätige deine E-Mail</h1>
            <p className="mt-3 text-muted">
              Wir haben dir einen Link an <span className="text-ink">{confirmSentTo}</span> geschickt. Öffne ihn, danach geht es direkt mit
              deinem Fragebogen weiter.
            </p>
            <Link to="/anmelden" className="mt-6 inline-flex min-h-12 items-center font-semibold text-accent">
              Zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-4xl font-bold uppercase leading-none">{copy.title}</h1>
            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
              <Field label="E-Mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Field
                label="Passwort"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={mode === 'register' ? `Mindestens ${MIN_PASSWORD} Zeichen` : undefined}
                required
              />
              <InlineError message={error} />
              <Button type="submit" block loading={busy} className="mt-2">
                {copy.submit}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted">
              {copy.switchText}{' '}
              <Link to={copy.switchTo} className="inline-flex min-h-11 items-center font-semibold text-accent">
                {copy.switchLink}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
