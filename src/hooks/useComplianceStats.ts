import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

interface ComplianceStats {
  totalTrades: number
  compliantTrades: number
  violationCount: number
  adherenceRate: number
  costOfViolations: number
  violationsByType: Record<string, number>
}

export function useComplianceStats(
  periodDays: number = 30,
  strategyId?: string,
  accountId?: string,
) {
  return useQuery<ComplianceStats>({
    queryKey: [...queryKeys.complianceMetrics.all, periodDays, strategyId, accountId],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('periodDays', String(periodDays))
      if (strategyId) params.set('strategyId', strategyId)
      if (accountId) params.set('accountId', accountId)
      return apiFetch(`/api/analytics/compliance?${params}`)
    },
    staleTime: 60_000,
  })
}
