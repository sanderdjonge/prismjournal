import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME } from '@/constants/queryConfig'

export type CorrelationCell = {
  row: string
  column: string
  value: number
  significance?: 'high' | 'medium' | 'low'
}

export type CorrelationMatrixData = {
  variables: string[]
  matrix: CorrelationCell[][]
  generatedAt: string
  tradeCount: number
}

export function useWhatIfCorrelation(params: {
  accountIds?: string[]
  period?: number
}) {
  return useQuery<CorrelationMatrixData>({
    queryKey: queryKeys['what-if-correlation'].detail(params),
    queryFn: () => {
      const searchParams = new URLSearchParams()
      if (params.period) searchParams.set('period', String(params.period))
      if (params.accountIds?.length) searchParams.set('accountIds', params.accountIds.join(','))
      return apiFetch(`/api/analytics/what-if/correlation?${searchParams.toString()}`)
    },
    staleTime: STALE_TIME.MEDIUM,
  })
}
