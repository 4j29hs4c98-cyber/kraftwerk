import { Card, PageHeader, SectionTitle, Stat } from '../../components/Card'
import { ErrorState, LoadingState } from '../../components/States'
import { useAsync } from '../../lib/useAsync'
import { fetchBodyWeights, fetchTrainingStats } from './api'
import { MonthCalendar } from './MonthCalendar'
import { trainingDaysInMonth, weekStreak } from './streak'
import { WeightChart } from './WeightChart'
import { WeightForm } from './WeightForm'

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

function formatVolume(kg: number): { value: string; unit: string } {
  return kg >= 10000 ? { value: NUMBER.format(kg / 1000), unit: 't' } : { value: NUMBER.format(kg), unit: 'kg' }
}

export function ProgressPage() {
  const stats = useAsync(fetchTrainingStats, [])
  const weights = useAsync(fetchBodyWeights, [])
  const now = new Date()

  return (
    <>
      <PageHeader eyebrow="Was du schon geschafft hast" title="Fortschritt" />

      <SectionTitle>Training</SectionTitle>
      {stats.status === 'loading' && <LoadingState label="Statistik wird geladen" />}
      {stats.status === 'error' && <ErrorState message={stats.message} onRetry={stats.reload} />}
      {stats.status === 'ready' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Serie" value={String(weekStreak(stats.data.finishedDates, now))} unit="Wo." />
            <Stat label="Workouts" value={String(stats.data.totalWorkouts)} />
            <Stat label="Volumen" {...formatVolume(stats.data.totalVolumeKg)} />
          </div>
          <p className="mt-2 text-xs text-muted">Die Serie zählt aufeinanderfolgende Wochen mit mindestens einem abgeschlossenen Training.</p>
          <Card className="mt-4">
            <MonthCalendar month={now} trainingDays={trainingDaysInMonth(stats.data.finishedDates, now.getFullYear(), now.getMonth())} />
          </Card>
        </>
      )}

      <div className="mt-8">
        <SectionTitle>Körpergewicht</SectionTitle>
      </div>
      <Card>
        {weights.status === 'loading' && <LoadingState label="Gewichte werden geladen" />}
        {weights.status === 'error' && <ErrorState message={weights.message} onRetry={weights.reload} />}
        {weights.status === 'ready' && (
          <>
            {weights.data.length > 0 && (
              <p className="mb-2">
                <span className="font-display text-4xl font-bold">{NUMBER.format(weights.data.at(-1)?.weight_kg ?? 0)}</span>
                <span className="ml-1 text-muted">kg aktuell</span>
              </p>
            )}
            <WeightChart points={weights.data.map((w) => ({ date: w.measured_on, weightKg: w.weight_kg }))} />
          </>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <WeightForm onSaved={weights.reload} />
        </div>
      </Card>
    </>
  )
}
