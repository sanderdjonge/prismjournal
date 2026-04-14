import { useQuery } from '@tanstack/react-query'

export interface StrategyAnalyticsData {
  winRate: number
  avgR: number
  profitFactor: number
  maxDrawdown: number
  bestTrade: { pnl: number; r: number | null; date: string } | null
  worstTrade: { pnl: number; r: number | null; date: string } | null
  totalPnl: number
  tradeCount: number
  expectancy: number
  equityCurve: Array<{ date: string; cumulative: number }>
  monthlyReturns: Array<{ month: number; year: number; pnl: number; returnPercent: number }>
  ruleBreakdown: Array<{
    ruleId: string
    ruleType: string
    violationCount: number
    violationPercent: number
    pnlImpact: number | null
  }>
  bySymbol: Array<{ symbol: string; winRate: number; pnl: number; count: number }>
  byDirection: {
    long: { winRate: number; pnl: number; avgR: number; count: number }
    short: { winRate: number; pnl: number; avgR: number; count: number }
  }
  byTimeOfDay: Array<{ period: string; winRate: number; pnl: number; count: number }>
  byDayOfWeek: Array<{ day: number; winRate: number; pnl: number; count: number }>
}

export function useStrategyAnalytics(strategyId: string) {
  return useQuery({
    queryKey: ['strategy-analytics', strategyId],
    queryFn: async (): Promise<StrategyAnalyticsData> => {
      const res = await fetch(`/api/strategies/${strategyId}/analytics`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Strategy not found')
        throw new Error('Failed to load analytics')
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!strategyId,
  })
}
