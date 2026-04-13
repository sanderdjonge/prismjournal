import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface TiltmeterDataPoint {
  date: string
  score: number
  violationCount: number
}

export interface TiltmeterHistoryResponse {
  snapshots: TiltmeterDataPoint[]
}

export interface TiltmeterScoreResponse {
  score: number
  components: Record<string, { count: number; weightedScore: number }>
  totalViolations: number
  periodStart: string
  periodEnd: string
}

export function useTiltmeterHistory(
  accountId?: string | null,
  startDate?: Date,
  endDate?: Date,
  enabled: boolean = true,
) {
  return useQuery<TiltmeterHistoryResponse>({
    queryKey: queryKeys['tiltmeter-history'].detail(accountId, startDate?.toISOString(), endDate?.toISOString()),
    queryFn: () => {
      const params = new URLSearchParams()
      if (accountId) params.set('account', accountId)
      if (startDate) params.set('startDate', startDate.toISOString())
      if (endDate) params.set('endDate', endDate.toISOString())
      params.set('history', 'true')
      return apiFetch(`/api/analytics/tiltmeter?${params.toString()}`)
    },
    staleTime: 60_000,
    enabled,
  })
}

export function useTiltmeterScore(
  accountId?: string | null,
  periodDays: number = 30,
  enabled: boolean = true,
) {
  return useQuery<TiltmeterScoreResponse>({
    queryKey: queryKeys['tiltmeter-score'].detail(accountId, periodDays),
    queryFn: () => {
      const params = new URLSearchParams({ periodDays: String(periodDays) })
      if (accountId) params.set('account', accountId)
      return apiFetch(`/api/analytics/tiltmeter?${params.toString()}`)
    },
    staleTime: 60_000,
    enabled,
  })
}
