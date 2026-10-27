import { useState } from 'react'
import { Button } from '../../components/Button'
import { EmptyState, InlineError } from '../../components/States'
import { toMessage } from '../../lib/supabase'
import { useProfile } from '../profile/ProfileProvider'
import { regeneratePlan } from './regenerate'

export function NoPlan({ onCreated }: { readonly onCreated: () => void }) {
  const { profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await regeneratePlan(profile)
      onCreated()
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <EmptyState
      title="Noch kein aktiver Plan"
      action={
        <div className="flex flex-col gap-3">
          <InlineError message={error} />
          <Button onClick={create} loading={busy}>Plan aus meinem Profil erstellen</Button>
        </div>
      }
    >
      Erstelle deinen Plan aus den Angaben in deinem Profil.
    </EmptyState>
  )
}
