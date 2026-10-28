import { parseISODate } from '../../lib/date'
import { useAsync } from '../../lib/useAsync'
import { useToday } from '../../lib/useToday'
import { fetchActivePlan, fetchTodayPlan, type PlanDay, type PlanDetail } from './api'
import type { TodayPlan } from './weekdays'

export interface PlanOverview {
  readonly detail: PlanDetail | null
  /** Was heute ansteht; null ohne Plan oder ohne Trainingstag. */
  readonly today: TodayPlan<PlanDay> | null
  /** Heute fälliger Trainingstag (Ruhetag: null). */
  readonly nextDay: PlanDay | null
}

/** Lädt den aktiven Plan und den heutigen Tag; springt beim Tageswechsel mit. */
export function usePlanOverview() {
  const todayIso = useToday()
  return useAsync<PlanOverview>(async () => {
    const detail = await fetchActivePlan()
    const today = detail ? await fetchTodayPlan(detail, parseISODate(todayIso)) : null
    return { detail, today, nextDay: today?.kind === 'training' ? today.day : null }
  }, [todayIso])
}
