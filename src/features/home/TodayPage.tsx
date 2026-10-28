import { Link } from 'react-router'
import { Card, SectionTitle, Stat } from '../../components/Card'
import { ErrorState, LoadingState } from '../../components/States'
import { formatLongDate, startOfWeek } from '../../lib/date'
import { useAsync } from '../../lib/useAsync'
import type { PlanDay } from '../plan/api'
import { ExerciseList } from '../plan/DayCard'
import { NoPlan } from '../plan/NoPlan'
import { usePlanOverview } from '../plan/usePlan'
import { weekdayName, weekdayOf, type TodayPlan } from '../plan/weekdays'
import { useProfile } from '../profile/ProfileProvider'
import { fetchTrainingStats } from '../progress/api'
import { weekStreak } from '../progress/streak'
import { StaleWorkouts } from '../workout/StaleWorkouts'
import { PauseIndicator } from './PauseIndicator'

/** Heute Ruhetag laut Wochenplan: Hinweis auf den nächsten Trainingstag, Training trotzdem möglich. */
function RestToday({ today, days }: { readonly today: Extract<TodayPlan<PlanDay>, { kind: 'rest' }>; readonly days: readonly PlanDay[] }) {
  const { next } = today
  const nextLabel = next ? (next.weekday === (weekdayOf(new Date()) + 1) % 7 ? 'morgen' : `am ${weekdayName(next.weekday)}`) : null
  const training = days.filter((d) => !d.is_rest)
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Laut Wochenplan</p>
      <h2 className="mt-1 font-display text-5xl font-extrabold uppercase leading-none">Heute ist Ruhetag</h2>
      <p className="mt-2 text-sm text-muted">
        Erholung gehört zum Training: Muskeln wachsen in der Pause.
        {next && nextLabel && (
          <>
            {' '}Weiter geht es {nextLabel} mit <span className="font-semibold text-ink">{next.day.title ?? weekdayName(next.weekday)}</span>.
          </>
        )}
      </p>
      {training.length > 0 && (
        <details className="mt-4 rounded-2xl bg-bg/40 px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">Trotzdem trainieren</summary>
          <ul className="divide-y divide-line">
            {training.map((day) => (
              <li key={day.id}>
                <Link to={`/training/${day.id}`} className="flex min-h-12 items-center justify-between gap-3 text-sm hover:text-accent">
                  <span className="font-semibold">{day.title ?? 'Training'}</span>
                  <span className="text-muted">{day.weekday !== null ? weekdayName(day.weekday) : ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Hallo'
  return 'Guten Abend'
}

export function TodayPage() {
  const { profile } = useProfile()
  const overview = usePlanOverview()
  const stats = useAsync(fetchTrainingStats, [])
  const now = new Date()
  const name = profile.display_name ? `, ${profile.display_name}` : ''

  const thisWeek =
    stats.status === 'ready' ? stats.data.finishedDates.filter((d) => d >= startOfWeek(now)).length : null

  return (
    <>
      <header className="mb-6">
        <p className="text-sm capitalize text-muted">{formatLongDate(now)}</p>
        <h1 className="font-display text-4xl font-bold uppercase leading-none">
          {greeting(now)}
          {name}
        </h1>
      </header>

      <StaleWorkouts
        onChanged={() => {
          stats.reload()
          overview.reload()
        }}
      />

      {stats.status === 'ready' && <PauseIndicator finishedDates={stats.data.finishedDates} now={now} />}

      <section aria-label="Nächstes Training" className="mb-6">
        {overview.status === 'loading' && <LoadingState label="Training wird geladen" />}
        {overview.status === 'error' && <ErrorState message={overview.message} onRetry={overview.reload} />}
        {overview.status === 'ready' && !overview.data.today && <NoPlan onCreated={overview.reload} />}
        {overview.status === 'ready' && overview.data.today?.kind === 'rest' && (
          <RestToday today={overview.data.today} days={overview.data.detail?.days ?? []} />
        )}
        {overview.status === 'ready' && overview.data.nextDay && (
          <div className="overflow-hidden rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/20 via-surface to-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {overview.data.nextDay.weekday !== null ? 'Dein Training heute' : 'Dein nächstes Training'}
            </p>
            <h2 className="mt-1 font-display text-5xl font-extrabold uppercase leading-none">{overview.data.nextDay.title}</h2>
            <p className="mt-2 text-sm text-muted">
              {overview.data.nextDay.exercises.length} Übungen, {overview.data.nextDay.exercises.reduce((n, e) => n + (e.sets ?? 0), 0)} Sätze
            </p>
            <div className="mt-4 rounded-2xl bg-bg/40 px-4">
              <ExerciseList day={overview.data.nextDay} />
            </div>
            <Link
              to={`/training/${overview.data.nextDay.id}`}
              className="mt-5 flex min-h-14 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink transition hover:bg-accent-strong active:scale-[0.98]"
            >
              Training starten
            </Link>
          </div>
        )}
      </section>

      <SectionTitle>Diese Woche</SectionTitle>
      {stats.status === 'error' ? (
        <ErrorState message={stats.message} onRetry={stats.reload} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Trainings" value={thisWeek === null ? '-' : String(thisWeek)} unit={profile.days_per_week ? `/ ${profile.days_per_week}` : undefined} />
          <Stat label="Wochenserie" value={stats.status === 'ready' ? String(weekStreak(stats.data.finishedDates, now)) : '-'} unit="Wo." />
        </div>
      )}

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Ernährung im Blick</p>
            <p className="text-sm text-muted">Trag ein, was du heute gegessen hast.</p>
          </div>
          <Link to="/ernaehrung" className="inline-flex min-h-12 shrink-0 items-center rounded-xl border border-line px-4 font-semibold hover:border-muted">
            Öffnen
          </Link>
        </div>
      </Card>
    </>
  )
}
