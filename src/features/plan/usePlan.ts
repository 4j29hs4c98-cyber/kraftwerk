import { useAsync } from '../../lib/useAsync'
import { fetchActivePlan, fetchNextDay, type PlanDay, type PlanDetail } from './api'

export interface PlanOverview {
  readonly detail: PlanDetail | null
  readonly nextDay: PlanDay | null
}

export function usePlanOverview() {
  return useAsync<PlanOverview>(async () => {
    const detail = await fetchActivePlan()
    const nextDay = detail ? await fetchNextDay(detail) : null
    return { detail, nextDay }
  }, [])
}
