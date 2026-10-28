import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Card, PageHeader } from '../../components/Card'
import { ErrorState, InlineError, LoadingState } from '../../components/States'
import { toMessage } from '../../lib/supabase'
import { DAYS_HINT } from '../profile/pickers'
import { useProfile } from '../profile/ProfileProvider'
import type { PlanDay, PlanDetail } from './api'
import { DayCard, RestDayCard } from './DayCard'
import { PlanEditor } from './editor/PlanEditor'
import { ImportPanel } from './import/ImportPanel'
import { NoPlan } from './NoPlan'
import { regeneratePlan } from './regenerate'
import { usePlanOverview } from './usePlan'
import { hasWeekdays, weekdayName, weekdayOf, weekSlots } from './weekdays'

export function PlanPage() {
  const overview = usePlanOverview()
  const { profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'import'>('view')

  function done() {
    setMode('view')
    overview.reload()
  }

  async function regenerate() {
    if (!window.confirm('Plan neu erzeugen? Dein bisheriger Plan wird archiviert, deine Trainingshistorie bleibt erhalten.')) return
    setBusy(true)
    setError(null)
    try {
      await regeneratePlan(profile)
      overview.reload()
    } catch (err) {
      setError(toMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Dein Wochenplan" title="Plan" />
      {overview.status === 'loading' && <LoadingState label="Plan wird geladen" />}
      {overview.status === 'error' && <ErrorState message={overview.message} onRetry={overview.reload} />}
      {overview.status === 'ready' && mode === 'import' && (
        <div className="mb-4"><ImportPanel onImported={done} onCancel={() => setMode('view')} /></div>
      )}
      {overview.status === 'ready' && overview.data.detail && mode === 'edit' && (
        <PlanEditor detail={overview.data.detail} onSaved={done} onCancel={() => setMode('view')} />
      )}
      {overview.status === 'ready' && !overview.data.detail && mode === 'view' && (
        <div className="flex flex-col gap-4">
          <NoPlan onCreated={overview.reload} />
          <Button variant="secondary" onClick={() => setMode('import')}>Plan aus Excel importieren</Button>
        </div>
      )}
      {overview.status === 'ready' && overview.data.detail && mode === 'view' && (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="font-display text-2xl font-bold uppercase">{overview.data.detail.plan.name}</p>
            {overview.data.detail.plan.split === 'ganzkoerper' && (profile.days_per_week ?? 0) > 3 && (
              <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                Mit deiner Ausrüstung reicht es nicht für einen geteilten Plan. Trainiere den Ganzkörperplan höchstens dreimal pro Woche, die übrigen Tage
                dienen der Erholung.
              </p>
            )}
            {hasWeekdays(overview.data.detail.days) ? (
              <p className="mt-1 text-sm text-muted">
                {overview.data.detail.days.filter((d) => !d.is_rest).length} Trainingstage pro Woche, fest nach Wochentagen. Heute ist hervorgehoben.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                {profile.days_per_week} Einheiten pro Woche. {profile.days_per_week !== null ? DAYS_HINT[profile.days_per_week] : ''}. Der nächste Tag
                richtet sich nach deinem letzten abgeschlossenen Training.
              </p>
            )}
          </Card>
          <PlanDays detail={overview.data.detail} nextDay={overview.data.nextDay} />
          <Card>
            <p className="font-semibold">Plan anpassen</p>
            <p className="mt-1 text-sm text-muted">
              Bearbeite Übungen und Tage direkt, importiere einen Plan aus Excel, oder erzeuge ihn mit den Angaben aus deinem Profil neu.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button onClick={() => setMode('edit')}>Plan bearbeiten</Button>
              <Button variant="secondary" onClick={() => setMode('import')}>Plan aus Excel importieren</Button>
              <Button variant="secondary" onClick={regenerate} loading={busy}>Plan neu erzeugen</Button>
              <Link to="/profil" className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-semibold text-accent">
                Einstellungen ändern
              </Link>
            </div>
            <div className="mt-3"><InlineError message={error} /></div>
          </Card>
        </div>
      )}
    </>
  )
}

/** Pläne mit Wochentagen zeigen die Woche Montag bis Sonntag, sonst die Tage in Planreihenfolge. */
function PlanDays({ detail, nextDay }: { readonly detail: PlanDetail; readonly nextDay: PlanDay | null }) {
  const todayWeekday = weekdayOf(new Date())
  if (hasWeekdays(detail.days)) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {weekSlots(detail.days).map(({ weekday, day }) =>
          day && !day.is_rest ? (
            <DayCard key={weekday} day={day} label={weekdayName(weekday)} isNext={weekday === todayWeekday} badge="Heute" />
          ) : (
            <RestDayCard key={weekday} label={weekdayName(weekday)} isToday={weekday === todayWeekday} />
          ),
        )}
      </div>
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {detail.days.map((day, i) =>
        day.is_rest ? (
          <RestDayCard key={day.id} label={`Tag ${i + 1}`} isToday={false} />
        ) : (
          <DayCard key={day.id} day={day} label={`Tag ${i + 1}`} isNext={day.id === nextDay?.id} />
        ),
      )}
    </div>
  )
}
