import { useId, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../../../components/States'
import { rpcExerciseProgress } from '../../../lib/rpc'
import { useAsync } from '../../../lib/useAsync'
import { fetchActivePlan } from '../../plan/api'
import { exerciseName } from '../../plan/exercises'
import { fetchLoggedExerciseKeys } from '../api'
import { parseExerciseProgress, strengthSummary } from './chartMath'
import { LineChart } from './LineChart'

interface ExerciseOption {
  readonly key: string
  readonly name: string
}

/** Geloggte Übungen; Übungen des aktiven Plans zuerst und mit ihrem eigenen Namen. */
async function fetchExerciseOptions(): Promise<ExerciseOption[]> {
  const [keys, plan] = await Promise.all([fetchLoggedExerciseKeys(), fetchActivePlan()])
  const planExercises = plan?.days.flatMap((d) => d.exercises) ?? []
  const planOrder = planExercises.map((e) => e.exercise_key)
  const rank = (key: string): number => {
    const i = planOrder.indexOf(key)
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...keys]
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => ({ key, name: exerciseName(key, planExercises.find((e) => e.exercise_key === key)?.display_name) }))
}

export function StrengthChart() {
  const options = useAsync(fetchExerciseOptions, [])
  const [chosen, setChosen] = useState<string | null>(null)
  const selectId = useId()

  if (options.status === 'loading') return <LoadingState label="Übungen werden geladen" />
  if (options.status === 'error') return <ErrorState message={options.message} onRetry={options.reload} />
  if (options.data.length === 0) return <EmptyState title="Noch keine Kraftwerte">Nach deinem ersten Training siehst du hier, wie deine Gewichte steigen.</EmptyState>

  const current = options.data.find((o) => o.key === chosen) ?? options.data[0]
  if (!current) return null

  return (
    <div>
      <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-muted">
        Übung
      </label>
      <select
        id={selectId}
        value={current.key}
        onChange={(e) => setChosen(e.target.value)}
        className="min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-ink focus:border-accent focus:outline-none"
      >
        {options.data.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name}
          </option>
        ))}
      </select>
      {/* key erzwingt beim Wechsel ein neues Diagramm, damit sich die Linie erneut aufbaut. */}
      <ExerciseCurve key={current.key} option={current} />
    </div>
  )
}

function ExerciseCurve({ option }: { readonly option: ExerciseOption }) {
  const progress = useAsync(async () => parseExerciseProgress(await rpcExerciseProgress(option.key)), [option.key])

  if (progress.status === 'loading') return <LoadingState label="Verlauf wird geladen" />
  if (progress.status === 'error') return <ErrorState message={progress.message} onRetry={progress.reload} />
  const points = progress.data
  if (points.length === 0) return <p className="py-8 text-center text-sm text-muted">Für diese Übung gibt es noch keine Sätze mit Gewicht.</p>

  const maxWeights = points.map((p) => ({ date: p.date, value: p.maxWeightKg }))
  const summary = strengthSummary(option.name, maxWeights)
  return (
    <div className="mt-4">
      {summary && <p className="mb-2 font-display text-2xl font-bold">{summary}</p>}
      <LineChart
        unit="kg"
        ariaLabel={`Kraftverlauf ${option.name}: ${summary ?? ''}`}
        series={[
          { id: 'e1rm', label: 'Geschätztes 1RM', color: 'var(--color-chart-2)', points: points.map((p) => ({ date: p.date, value: p.bestE1rm })), variant: 'line' },
          { id: 'max', label: 'Höchstes Gewicht', color: 'var(--color-accent)', points: maxWeights, variant: 'line' },
        ]}
      />
      <p className="mt-2 text-xs text-muted">Das 1RM ist geschätzt (Epley-Formel aus Gewicht und Wiederholungen), kein getesteter Maximalversuch.</p>
    </div>
  )
}
