'use client'

import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, BarChart3, Activity, Percent } from 'lucide-react'
import { useCurrency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/formatNumber'

interface MetricsPanelProps {
  winRate: number
  avgR: number
  profitFactor: number
  maxDrawdown: number
  bestTrade: { pnl: number; r: number | null; date: string } | null
  worstTrade: { pnl: number; r: number | null; date: string } | null
  totalPnl: number
  tradeCount: number
  expectancy: number
}

export function StrategyMetricsPanel({
  winRate,
  avgR,
  profitFactor,
  maxDrawdown,
  bestTrade,
  worstTrade,
  totalPnl,
  tradeCount,
  expectancy,
}: MetricsPanelProps) {
  const { formatAmount } = useCurrency()

  const metrics = [
    {
      label: 'Win Rate',
      value: formatPercent(winRate, 1),
      icon: Percent,
      color: winRate >= 50 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Avg R',
      value: avgR.toFixed(2),
      icon: Target,
      color: avgR >= 0 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Profit Factor',
      value: profitFactor >= 999 ? '∞' : profitFactor.toFixed(2),
      icon: BarChart3,
      color: profitFactor >= 1 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Max Drawdown',
      value: formatPercent(maxDrawdown, 1),
      icon: AlertTriangle,
      color: 'text-loss',
    },
    {
      label: 'Best Trade',
      value: bestTrade ? formatAmount(bestTrade.pnl) : '—',
      sub: bestTrade?.r ? `${bestTrade.r.toFixed(2)}R` : undefined,
      icon: TrendingUp,
      color: 'text-profit',
    },
    {
      label: 'Worst Trade',
      value: worstTrade ? formatAmount(worstTrade.pnl) : '—',
      sub: worstTrade?.r ? `${worstTrade.r.toFixed(2)}R` : undefined,
      icon: TrendingDown,
      color: 'text-loss',
    },
    {
      label: 'Total P&L',
      value: formatAmount(totalPnl),
      icon: DollarSign,
      color: totalPnl >= 0 ? 'text-profit' : 'text-loss',
    },
    {
      label: 'Expectancy',
      value: formatAmount(expectancy),
      icon: Activity,
      color: expectancy >= 0 ? 'text-profit' : 'text-loss',
    },
  ]

  return (
    <div className="glass-card border-white/10 bg-white/[0.04] backdrop-blur-xl rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-100">Performance Metrics</h3>
        <span className="text-xs text-gray-500">{tradeCount} trades</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="space-y-1">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                <Icon size={10} />
                <span>{metric.label}</span>
              </div>
              <div className={cn('text-lg font-bold', metric.color)}>
                {metric.value}
                {metric.sub && <span className="text-xs text-gray-500 ml-1">{metric.sub}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
