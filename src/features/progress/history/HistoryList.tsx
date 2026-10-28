import { useState } from 'react'
import { Link } from 'react-router'
import { IconChevron } from '../../../app/icons'
import { Button } from '../../../components/Button'
import { EmptyState, ErrorState, InlineError, LoadingState } from '../../../components/States'
import { formatDuration, formatShortDate } from '../../../lib/date'
import { toMessage } from '../../../lib/supabase'
import { useAsync } from '../../../lib/useAsync'
import { fetchWorkoutHistory, type WorkoutSummary } from './api'

const NUMBER = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** Liste der abgeschlossenen Workouts mit "Weitere laden". */
export function HistoryList() {
  const first = useAsync(() => fetchWorkoutHistory(0), [])
  const [more, setMore] = useState<{ readonly items: readonly WorkoutSummary[]; readonly page: number; readonly hasMore: boolean } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (first.status === 'loading') return <LoadingState label="Verlauf wird geladen" />
  if (first.status === 'error') return <ErrorState message={first.message} onRetry={first.reload} />

  const items = [...first.data.items, ...(more?.items ?? [])]
  const hasMore = more ? more.hasMore : first.data.hasMore

  async function loadMore() {
    const page = (more?.page ?? 0) + 1
    setLoadingMore(true)
    setError(null)
    try {
      const next = await fetchWorkoutHistory(page)
      setMore((current) => ({ items: [...(current?.items ?? []), ...next.items], page, hasMore: next.hasMore }))
    } catch (err) {
      setError(toMessage(err, 'Weitere Trainings konnten nicht geladen werden.'))
    } finally {
      setLoadingMore(false)
    }
  }

  if (items.length === 0) return <EmptyState title="Noch keine Trainings">Abgeschlossene Trainings erscheinen hier und lassen sich nachträglich korrigieren.</EmptyState>

  return (
    <>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {items.map((w) => (
          <li key={w.id}>
            <Link to={`/fortschritt/verlauf/${w.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{w.title}</p>
                <p className="text-sm text-muted tabular-nums">
                  {formatShortDate(new Date(w.finishedAt))}
                  {w.durationMs !== null && ` · ${formatDuration(w.durationMs)}`} · {NUMBER.format(w.volumeKg)} kg Volumen
                </p>
              </div>
              <IconChevron className="size-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <InlineError message={error} />
      </div>
      {hasMore && (
        <Button variant="secondary" block className="mt-3" loading={loadingMore} onClick={() => void loadMore()}>
          Weitere laden
        </Button>
      )}
    </>
  )
}
