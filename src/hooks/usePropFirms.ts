import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export interface PropFirm {
  id: string
  name: string
  phases: number
  maxDailyLossPercent: number
  maxOverallLossPercent: number
  profitTargetPercent: number
  minTradingDays: number
  maxCalendarDays: number
}

export function usePropFirms() {
  return useQuery<{ propFirms: PropFirm[] }>({
    queryKey: queryKeys['prop-firms'].all,
    queryFn: () => apiFetch('/api/prop-firms'),
    staleTime: 300_000,
  })
}
