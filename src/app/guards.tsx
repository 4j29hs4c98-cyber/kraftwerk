import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState, LoadingState } from '../components/States'
import { useAuth } from '../features/auth/AuthProvider'
import { useSyncTriggers } from '../lib/offline/useSync'
import { ProfileProvider, useProfileState } from '../features/profile/ProfileProvider'

function FullPage({ children }: { readonly children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-md px-4 py-10">{children}</main>
}

/** Nur mit Session; lädt anschließend das Profil für alle geschützten Seiten. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  // Offline gespeicherte Einträge übertragen, sobald Netz und Anmeldung da sind.
  useSyncTriggers()
  if (loading) return <FullPage><LoadingState label="Anmeldung wird geprüft" /></FullPage>
  if (!session) return <Navigate to="/anmelden" replace state={{ from: location.pathname }} />
  return (
    <ProfileProvider userId={session.user.id}>
      <Outlet />
    </ProfileProvider>
  )
}

function useProfileGate(): { element: React.ReactNode } | { onboarded: boolean } {
  const { state, reload } = useProfileState()
  if (state.status === 'loading') return { element: <FullPage><LoadingState label="Profil wird geladen" /></FullPage> }
  if (state.status === 'error') return { element: <FullPage><ErrorState message={state.message} onRetry={reload} /></FullPage> }
  return { onboarded: state.profile.onboarded }
}

export function RequireOnboarded() {
  const gate = useProfileGate()
  if ('element' in gate) return gate.element
  return gate.onboarded ? <Outlet /> : <Navigate to="/onboarding" replace />
}

export function RequireNotOnboarded() {
  const gate = useProfileGate()
  if ('element' in gate) return gate.element
  return gate.onboarded ? <Navigate to="/heute" replace /> : <Outlet />
}
