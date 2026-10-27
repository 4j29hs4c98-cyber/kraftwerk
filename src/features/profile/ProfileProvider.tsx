import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { toMessage } from '../../lib/supabase'
import { fetchProfile } from './api'
import type { ProfileRow } from './types'

type ProfileState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly profile: ProfileRow }

interface ProfileContextValue {
  readonly state: ProfileState
  readonly reload: () => void
  readonly setProfile: (profile: ProfileRow) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ userId, children }: { readonly userId: string; readonly children: ReactNode }) {
  const [state, setState] = useState<ProfileState>({ status: 'loading' })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    fetchProfile(userId)
      .then((profile) => active && setState({ status: 'ready', profile }))
      .catch((error: unknown) => active && setState({ status: 'error', message: toMessage(error) }))
    return () => {
      active = false
    }
  }, [userId, tick])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setTick((t) => t + 1)
  }, [])
  const setProfile = useCallback((profile: ProfileRow) => setState({ status: 'ready', profile }), [])

  return <ProfileContext.Provider value={{ state, reload, setProfile }}>{children}</ProfileContext.Provider>
}

function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile muss innerhalb von ProfileProvider verwendet werden')
  return ctx
}

export function useProfileState(): ProfileContextValue {
  return useProfileContext()
}

/** Nur innerhalb geladener Bereiche nutzen: liefert das Profil sicher. */
export function useProfile(): { profile: ProfileRow; setProfile: (p: ProfileRow) => void } {
  const { state, setProfile } = useProfileContext()
  if (state.status !== 'ready') throw new Error('Profil ist noch nicht geladen')
  return { profile: state.profile, setProfile }
}
