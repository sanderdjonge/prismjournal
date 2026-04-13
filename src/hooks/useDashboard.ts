import { useSuspenseQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export type DashboardData = {
  equity: { time: string; value: number }[]
  allTimeEquity: { time: string; value: number }[]
  trades: Array<{
    id: string
    symbol: string
    direction: string
    pnl: number | null
    volume: number
    price: string
    time: string
    isActive: boolean
  }>
  calendar: Array<{
    date: string
    pnl: number
    trades: number
    wins: number
    losses: number
    avgRR: number | null
  }>
  winRate: number
  profitFactor: number
  totalTrades: number
  totalPnl: number
  expectancy: number
  maxDrawdown: number
  avgRMultiple: number
  bestTrade: number
  worstTrade: number
  consecutiveWins: number
  consecutiveLosses: number
  avgDurationMinutes: number | null
  accountBalance: number
}

export function useDashboard(period: string, accountId: string | null) {
  return useSuspenseQuery<DashboardData>({
    queryKey: queryKeys.dashboard.detail(period, accountId),
    queryFn: () => {
      const params = new URLSearchParams({ period })
      if (accountId) params.set('account', accountId)
      return apiFetch(`/api/dashboard?${params.toString()}`)
    },
    staleTime: 30_000,
  })
}
